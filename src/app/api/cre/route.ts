import { timingSafeEqual } from "node:crypto";
import { db, body, fail } from "@/lib/server";
import { serverChainClient } from "@/lib/chain-server";
import { contractAddress, permitAbi, datasetKey } from "@/lib/chain";
import { z } from "zod";
function authorize(request: Request) {
  const secret = process.env.CRE_API_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("CRE secret is not configured.");
  const supplied = Buffer.from(
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "",
  );
  const expected = Buffer.from(secret);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new Error("Authentication required.");
}
export async function GET(request: Request) {
  try {
    authorize(request);
    const { data, error } = await db()
      .from("permits")
      .select("id,tx_hash")
      .eq("provisioning_status", "pending")
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(20);
    if (error) throw error;
    return Response.json({ jobs: data });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    authorize(request);
    const job = z
      .object({
        permitId: z.string().regex(/^\d+$/),
        txHash: z.string().regex(/^0x[\da-fA-F]{64}$/),
      })
      .parse(await body(request));
    if (!contractAddress) throw new Error("Contract unavailable.");
    const receipt = await serverChainClient.getTransactionReceipt({
      hash: job.txHash as `0x${string}`,
    });
    if (
      receipt.status !== "success" ||
      receipt.to?.toLowerCase() !== contractAddress.toLowerCase()
    )
      throw new Error("Invalid purchase receipt.");
    const { data: p, error } = await db()
      .from("permits")
      .select("owner,dataset_id,tx_hash")
      .eq("id", job.permitId)
      .single();
    if (error || !p || p.tx_hash.toLowerCase() !== job.txHash.toLowerCase())
      throw new Error("Receipt does not match permit.");
    const permit = await serverChainClient.readContract({
      address: contractAddress,
      abi: permitAbi,
      functionName: "permits",
      args: [BigInt(job.permitId)],
    });
    if (
      permit[0].toLowerCase() !== p.owner.toLowerCase() ||
      permit[1] !== datasetKey(p.dataset_id) ||
      permit[4] ||
      Number(permit[2]) * 1000 <= Date.now()
    )
      throw new Error("Permit is unavailable.");
    const { error: provisionError } = await db().rpc("provision_permit", {
      p_id: job.permitId,
      p_tx: job.txHash,
      p_block: receipt.blockNumber.toString(),
    });
    if (provisionError) throw provisionError;
    return Response.json({
      permitId: job.permitId,
      status: "ready",
      verifiedBlock: receipt.blockNumber.toString(),
    });
  } catch (e) {
    return fail(e);
  }
}
