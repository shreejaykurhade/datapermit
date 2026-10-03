import { test } from "node:test";
import assert from "node:assert/strict";
import {
  derivePublisherKey,
  encryptDataset,
  recoverDataset,
  decodeBytes,
  encodeBytes,
} from "../src/lib/encryption";
const records = [
  { input: "hello", expected: "friendly greeting", category: "support" },
];
test("Mera non-wallet key recovers datasets; another passkey and dataset context cannot decrypt", async () => {
  const prf = crypto.getRandomValues(new Uint8Array(32));
  const key = await derivePublisherKey(prf);
  assert.equal(key.extractable, false);
  const payload = await encryptDataset(records, "collection-a", key);
  assert.equal(
    JSON.stringify(payload.encrypted).includes("friendly greeting"),
    false,
  );
  assert.deepEqual(
    await recoverDataset(
      payload.encrypted,
      "collection-a",
      await derivePublisherKey(prf),
    ),
    records,
  );
  await assert.rejects(
    recoverDataset(
      payload.encrypted,
      "collection-a",
      await derivePublisherKey(crypto.getRandomValues(new Uint8Array(32))),
    ),
  );
  await assert.rejects(recoverDataset(payload.encrypted, "collection-b", key));
  const corrupted = structuredClone(payload.encrypted);
  const bytes = decodeBytes(corrupted.records.ciphertext);
  bytes[0] ^= 1;
  corrupted.records.ciphertext = encodeBytes(bytes);
  await assert.rejects(recoverDataset(corrupted, "collection-a", key));
  const second = await encryptDataset(records, "collection-a", key);
  assert.notEqual(second.encrypted.records.iv, payload.encrypted.records.iv);
  assert.notEqual(second.gatewayKey, payload.gatewayKey);
});
