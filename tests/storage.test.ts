import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("Postgres quota consumption is atomic and denies revoked, expired and unknown permits", async () => {
  const database = new PGlite();
  await database.exec(
    "create role anon; create role authenticated; create role service_role;",
  );
  await database.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  await database.exec(
    `insert into datasets(id,title,description,category,language,publisher,price,duration_days,quota,version,terms,digest,records,sample,record_count) values ('test','Dataset','Test description','Agent safety','English','publisher',5,7,2,'1','terms','digest','[]','[]',3); insert into permits(id,dataset_id,title,owner,expires_at,quota,token_hash,tx_hash) values ('1','test','Dataset','buyer',now()+interval '1 day',2,'hash','tx1'),('2','test','Dataset','buyer',now()-interval '1 day',2,'expired','tx2'),('3','test','Dataset','buyer',now()+interval '1 day',2,'revoked','tx3'); update permits set revoked=true where id='3';`,
  );
  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      database.query("select * from consume_permit('hash')"),
    ),
  );
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 2);
  assert.equal(attempts.filter((a) => a.status === "rejected").length, 3);
  const usage = await database.query<{ used: number }>(
    "select used from permits where id='1'",
  );
  assert.equal(usage.rows[0].used, 2);
  const receipts = await database.query<{ count: number }>(
    "select count(*)::int as count from access_receipts",
  );
  assert.equal(receipts.rows[0].count, 2);
  await assert.rejects(
    database.query("select * from consume_permit('expired')"),
  );
  await assert.rejects(
    database.query("select * from consume_permit('revoked')"),
  );
  await assert.rejects(
    database.query("select * from consume_permit('unknown')"),
  );
  await database.exec(
    "insert into permits(id,dataset_id,title,owner,expires_at,quota,token_hash,tx_hash,provisioning_status) values ('4','test','Dataset','buyer',now()+interval '1 day',2,'pending','tx4','pending');",
  );
  await assert.rejects(
    database.query("select * from consume_permit('pending')"),
  );
  await assert.rejects(
    database.query("select provision_permit('4','wrong','100')"),
  );
  await database.query("select provision_permit('4','tx4','100')");
  await database.query("select provision_permit('4','tx4','100')");
  const workflow = await database.query<{ count: number }>(
    "select count(*)::int as count from workflow_results where permit_id='4'",
  );
  assert.equal(workflow.rows[0].count, 1);
  assert.equal(
    (
      await database.query<{ used: number }>(
        "select * from consume_permit('pending')",
      )
    ).rows[0].used,
    1,
  );
  await database.close();
});
