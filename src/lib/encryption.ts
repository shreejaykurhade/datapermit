import type { RecordRow } from "./types";
export type CipherEnvelope = { iv: string; ciphertext: string };
export type EncryptedDataset = {
  format: "datapermit-aes-gcm-v1";
  records: CipherEnvelope;
  publisherKey: CipherEnvelope;
};
const bytes = (data: Uint8Array) => new Uint8Array(data).buffer;
export function encodeBytes(data: Uint8Array) {
  return btoa(Array.from(data, (byte) => String.fromCharCode(byte)).join(""));
}
export function decodeBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
export async function derivePublisherKey(prf: Uint8Array) {
  const root = await crypto.subtle.importKey("raw", bytes(prf), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: bytes(new TextEncoder().encode("DataPermit publisher vault v1")),
      info: bytes(new TextEncoder().encode("non-wallet/dataset-key-wrapping")),
    },
    root,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function importAesKey(raw: Uint8Array) {
  if (raw.length !== 32) throw new Error("Encryption key must be 32 bytes.");
  return crypto.subtle.importKey(
    "raw",
    bytes(raw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  data: Uint8Array,
  key: CryptoKey,
  context: string,
): Promise<CipherEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: bytes(iv),
      additionalData: bytes(new TextEncoder().encode(context)),
    },
    key,
    bytes(data),
  );
  return {
    iv: encodeBytes(iv),
    ciphertext: encodeBytes(new Uint8Array(ciphertext)),
  };
}
export async function open(
  envelope: CipherEnvelope,
  key: CryptoKey,
  context: string,
) {
  const iv = decodeBytes(envelope.iv);
  if (iv.length !== 12) throw new Error("Invalid encryption IV.");
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(iv),
        additionalData: bytes(new TextEncoder().encode(context)),
      },
      key,
      bytes(decodeBytes(envelope.ciphertext)),
    ),
  );
}
export async function encryptDataset(
  records: RecordRow[],
  id: string,
  publisherKey: CryptoKey,
) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  try {
    const key = await importAesKey(raw);
    const encrypted: EncryptedDataset = {
      format: "datapermit-aes-gcm-v1",
      records: await seal(
        new TextEncoder().encode(JSON.stringify(records)),
        key,
        `datapermit:${id}:records`,
      ),
      publisherKey: await seal(
        raw,
        publisherKey,
        `datapermit:${id}:publisher-key`,
      ),
    };
    return { encrypted, gatewayKey: encodeBytes(raw) };
  } finally {
    raw.fill(0);
  }
}
export async function recoverDataset(
  encrypted: EncryptedDataset,
  id: string,
  publisherKey: CryptoKey,
): Promise<RecordRow[]> {
  const raw = await open(
    encrypted.publisherKey,
    publisherKey,
    `datapermit:${id}:publisher-key`,
  );
  try {
    const key = await importAesKey(raw);
    return JSON.parse(
      new TextDecoder().decode(
        await open(encrypted.records, key, `datapermit:${id}:records`),
      ),
    );
  } finally {
    raw.fill(0);
  }
}
