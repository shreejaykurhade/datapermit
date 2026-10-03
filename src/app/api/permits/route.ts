import { serverChainClient as chainClient } from "@/lib/chain-server";
import { decodeEventLog } from "viem";
import {
  db,
  user,
  fail,
  body,
  sameOrigin,
  newToken,
  tokenHash,
} from "@/lib/server";
import { contractAddress, permitAbi, datasetKey } from "@/lib/chain";
export async function GET() {
  try {
    const owner = await user();
    const { data, error } = await db()
      .from("permits")
      .select(
        "id,dataset_id,title,owner,expires_at,quota,used,revoked,tx_hash,created_at,provisioning_status",
      )
      .eq("owner", owner)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load permits.");
    return Response.json({ permits: data });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await user();
    const payload = await body(request);
    if (!contractAddress) throw new Error("Contract not configured.");
    if (
      typeof payload.txHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(payload.txHash)
    )
      throw new Error("Invalid transaction.");
    const receipt = await chainClient.getTransactionReceipt({
      hash: payload.txHash,
    });
    if (receipt.status !== "success")
      throw new Error("Payment did not succeed.");
    const latest = await chainClient.getBlockNumber();
    if (latest < receipt.blockNumber + 1n)
      throw new Error(
        "Wait for one more block and retry importing the receipt.",
      );
    let purchase;
    for (const entry of receipt.logs) {
      if (entry.address.toLowerCase() !== contractAddress.toLowerCase())
        continue;
      try {
        const event = decodeEventLog({
          abi: permitAbi,
          eventName: "PermitPurchased",
          data: entry.data,
          topics: entry.topics,
        });
        if (
          event.args.buyer.toLowerCase() === owner &&
          event.args.datasetId === datasetKey(payload.datasetId)
        )
          purchase = event.args;
      } catch {}
    }
    if (!purchase) throw new Error("No matching purchase event.");
    const { data: dataset } = await db()
      .from("datasets")
      .select("title")
      .eq("id", payload.datasetId)
      .single();
    if (!dataset) throw new Error("Dataset not found.");
    const token = newToken();
    const { error } = await db()
      .from("permits")
      .insert({
        id: purchase.permitId.toString(),
        dataset_id: payload.datasetId,
        title: dataset.title,
        owner,
        expires_at: new Date(Number(purchase.expiresAt) * 1000).toISOString(),
        quota: purchase.quota,
        token_hash: tokenHash(token),
        tx_hash: payload.txHash,
        provisioning_status:
          process.env.CRE_PROVISIONING_ENABLED === "true" ? "pending" : "ready",
      });
    if (error)
      throw new Error("Receipt already imported or storage unavailable.");
    return Response.json(
      { token, id: purchase.permitId.toString() },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const owner = await user();
    const data = await body(request);
    if (typeof data.id !== "string" || !/^\d+$/.test(data.id))
      throw new Error("Invalid permit.");
    if (data.action === "rotate") {
      const token = newToken();
      const { data: row, error } = await db()
        .from("permits")
        .update({ token_hash: tokenHash(token) })
        .eq("id", data.id)
        .eq("owner", owner)
        .select("id")
        .single();
      if (error || !row) throw new Error("Permit not found.");
      return Response.json({ token });
    }
    if (data.action !== "revoke" || !contractAddress)
      throw new Error("Invalid action.");
    const permit = await chainClient.readContract({
      address: contractAddress,
      abi: permitAbi,
      functionName: "permits",
      args: [BigInt(data.id)],
    });
    if (!permit[4] || permit[0].toLowerCase() !== owner)
      throw new Error("Revoke the permit on-chain first.");
    const { error } = await db()
      .from("permits")
      .update({ revoked: true })
      .eq("id", data.id)
      .eq("owner", owner);
    if (error) throw new Error("Could not update permit.");
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
