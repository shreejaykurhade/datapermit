import "server-only";
import {
  decodeBytes,
  importAesKey,
  seal,
  open,
  type EncryptedDataset,
  type CipherEnvelope,
} from "./encryption";
export async function gatewayMasterKey() {
  const encoded = process.env.DATA_ENCRYPTION_KEY;
  if (!encoded)
    throw new Error("DATA_ENCRYPTION_KEY is required for encrypted datasets.");
  return importAesKey(decodeBytes(encoded));
}
export async function wrapGatewayKey(encoded: string, id: string) {
  const raw = decodeBytes(encoded);
  try {
    return await seal(
      raw,
      await gatewayMasterKey(),
      `datapermit:${id}:gateway-key`,
    );
  } finally {
    raw.fill(0);
  }
}
export async function decryptGatewayDataset(
  encrypted: EncryptedDataset,
  envelope: CipherEnvelope,
  id: string,
) {
  const raw = await open(
    envelope,
    await gatewayMasterKey(),
    `datapermit:${id}:gateway-key`,
  );
  try {
    return JSON.parse(
      new TextDecoder().decode(
        await open(
          encrypted.records,
          await importAesKey(raw),
          `datapermit:${id}:records`,
        ),
      ),
    );
  } finally {
    raw.fill(0);
  }
}
