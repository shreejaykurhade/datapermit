import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPermit, digest } from "../src/lib/demo";
import { publishSchema } from "../src/lib/validation";
import { catalog } from "../src/lib/catalog";
const valid = {
  revoked: false,
  expiresAt: "2030-01-01T00:00:00Z",
  used: 0,
  quota: 2,
};
test("valid permit grants access", () =>
  assert.doesNotThrow(() => checkPermit(valid)));
test("revoked permits cannot retrieve data", () =>
  assert.throws(() => checkPermit({ ...valid, revoked: true }), /revoked/));
test("expiry is enforced at the boundary", () =>
  assert.throws(
    () => checkPermit(valid, Date.parse(valid.expiresAt)),
    /expired/,
  ));
test("request allowance is enforced", () =>
  assert.throws(() => checkPermit({ ...valid, used: 2 }), /exhausted/));
test("content digest changes if a record changes", async () => {
  const first = await digest(catalog[0].records);
  const second = await digest([
    { ...catalog[0].records[0], input: "Different input" },
    ...catalog[0].records.slice(1),
  ]);
  assert.match(first, /^0x[0-9a-f]{64}$/);
  assert.notEqual(first, second);
});
test("publisher validation rejects empty datasets and zero-priced permits", () => {
  assert.equal(
    publishSchema.safeParse({ ...catalog[0], records: [] }).success,
    false,
  );
  assert.equal(
    publishSchema.safeParse({ ...catalog[0], price: "0" }).success,
    false,
  );
  assert.equal(publishSchema.safeParse(catalog[0]).success, true);
});
