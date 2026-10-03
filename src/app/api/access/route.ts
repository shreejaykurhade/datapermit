import { serverChainClient as chainClient } from "@/lib/chain-server";
import { db, fail, tokenHash } from "@/lib/server";
import { contractAddress, permitAbi, datasetKey } from "@/lib/chain";
import { decryptGatewayDataset } from "@/lib/encryption-server";
export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token || !/^dp_[A-Za-z0-9_-]{43}$/.test(token))
      return Response.json(
        { error: "A valid Bearer token is required." },
        { status: 401 },
      );
    const store = db();
    const { data: p } = await store
      .from("permits")
      .select("id,dataset_id,owner,provisioning_status")
      .eq("token_hash", tokenHash(token))
      .single();
    if (!p)
      return Response.json({ error: "Unknown access token." }, { status: 401 });
    if (p.provisioning_status === "pending")
      return Response.json(
        {
          error:
            "Payment verified. Access provisioning is awaiting the CRE workflow.",
        },
        { status: 425 },
      );
    if (!contractAddress) throw new Error("Contract unavailable.");
    const chainPermit = await chainClient.readContract({
      address: contractAddress,
      abi: permitAbi,
      functionName: "permits",
      args: [BigInt(p.id)],
    });
    if (
      chainPermit[0].toLowerCase() !== p.owner.toLowerCase() ||
      chainPermit[1] !== datasetKey(p.dataset_id) ||
      chainPermit[4] ||
      Number(chainPermit[2]) * 1000 <= Date.now()
    )
      return Response.json(
        { error: "Permit expired or revoked." },
        { status: 403 },
      );
    const { data: dataset, error: readError } = await store
      .from("datasets")
      .select("records,version,digest,encrypted_data,gateway_envelope")
      .eq("id", p.dataset_id)
      .single();
    if (readError || !dataset) throw new Error("Dataset unavailable.");
    const records = dataset.encrypted_data
      ? await decryptGatewayDataset(
          dataset.encrypted_data,
          dataset.gateway_envelope,
          p.dataset_id,
        )
      : dataset.records;
    const { data: usage, error } = await store.rpc("consume_permit", {
      p_token_hash: tokenHash(token),
    });
    if (error)
      return Response.json(
        { error: "Permit expired, revoked, or request allowance exhausted." },
        { status: 403 },
      );

    return Response.json(
      {
        datasetId: p.dataset_id,
        version: dataset.version,
        digest: dataset.digest,
        records,
        used: usage[0].used,
        remaining: usage[0].quota - usage[0].used,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
