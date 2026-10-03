import { serverChainClient as chainClient } from "@/lib/chain-server";
import { createHash } from "node:crypto";
import { parseUnits } from "viem";
import { db, user, fail, sameOrigin, body } from "@/lib/server";
import { publishSchema } from "@/lib/validation";
import { encryptedDatasetSchema } from "@/lib/validation";
import { validateShares } from "@/lib/revenue";
import { wrapGatewayKey, decryptGatewayDataset } from "@/lib/encryption-server";
import {
  contractAddress,
  permitAbi,
  datasetKey,
  termsKey,
  tokenAddress,
  tokenAbi,
} from "@/lib/chain";
export async function GET() {
  try {
    const { data, error } = await db()
      .from("datasets")
      .select(
        "id,title,description,category,language,publisher,price,duration_days,quota,version,terms,digest,record_count,sample,created_at,family_id,revenue_shares",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load datasets.");
    return Response.json({ datasets: data });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const publisher = await user();
    const payload = await body(request);
    const parsed = publishSchema.parse(payload);
    const revenueShares = validateShares(parsed.revenueShares, publisher);
    if (!contractAddress || !tokenAddress)
      throw new Error("Contract is not configured.");
    const id = payload.id;
    if (
      typeof id !== "string" ||
      !parsed.familyId ||
      id !== `${parsed.familyId}@${parsed.version}`
    )
      throw new Error("Invalid dataset ID.");
    const digest =
      "0x" +
      createHash("sha256").update(JSON.stringify(parsed.records)).digest("hex");
    const [registered, decimals] = await Promise.all([
      chainClient.readContract({
        address: contractAddress,
        abi: permitAbi,
        functionName: "datasets",
        args: [datasetKey(id)],
      }),
      chainClient.readContract({
        address: tokenAddress,
        abi: tokenAbi,
        functionName: "decimals",
      }),
    ]);
    if (
      registered[0].toLowerCase() !== publisher ||
      registered[1] !== parseUnits(parsed.price, decimals) ||
      registered[2] !== BigInt(parsed.durationDays * 86400) ||
      registered[3] !== parsed.quota ||
      registered[4] !== digest ||
      registered[5] !== termsKey(parsed.terms)
    )
      throw new Error("Dataset registration does not match submitted data.");
    const [version, onchainShares] = await Promise.all([
      chainClient.readContract({
        address: contractAddress,
        abi: permitAbi,
        functionName: "versions",
        args: [datasetKey(id)],
      }),
      chainClient.readContract({
        address: contractAddress,
        abi: permitAbi,
        functionName: "getShares",
        args: [datasetKey(id)],
      }),
    ]);
    const actualShares = onchainShares.map((s) => ({
      recipient: s.recipient.toLowerCase(),
      bps: s.bps,
      role: s.role === 1 ? "contributor" : "verifier",
    }));
    if (
      version[0] !== datasetKey(parsed.familyId) ||
      version[1] !== termsKey(parsed.version) ||
      JSON.stringify(actualShares) !== JSON.stringify(revenueShares)
    )
      throw new Error(
        "Registered ownership, version, or revenue split does not match.",
      );
    let encryptedData = null,
      gatewayEnvelope = null;
    if (payload.encrypted) {
      encryptedData = encryptedDatasetSchema.parse(payload.encrypted);
      if (typeof payload.gatewayKey !== "string")
        throw new Error("Gateway key is required.");
      gatewayEnvelope = await wrapGatewayKey(payload.gatewayKey, id);
      const decrypted = await decryptGatewayDataset(
        encryptedData,
        gatewayEnvelope,
        id,
      );
      if (JSON.stringify(decrypted) !== JSON.stringify(parsed.records))
        throw new Error("Encrypted records do not match registered content.");
    }
    const { error } = await db()
      .from("datasets")
      .insert({
        id,
        title: parsed.title,
        description: parsed.description,
        language: parsed.language,
        category: parsed.category,
        price: parsed.price,
        publisher,
        duration_days: parsed.durationDays,
        quota: parsed.quota,
        version: parsed.version,
        family_id: parsed.familyId,
        revenue_shares: revenueShares,
        terms: parsed.terms,
        digest,
        records: encryptedData ? [] : parsed.records,
        encrypted_data: encryptedData,
        gateway_envelope: gatewayEnvelope,
        sample: parsed.records.slice(0, 2),
        record_count: parsed.records.length,
      });
    if (error) throw new Error("Could not save dataset. ID may already exist.");
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
