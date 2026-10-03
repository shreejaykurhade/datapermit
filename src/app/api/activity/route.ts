import { db, user, fail } from "@/lib/server";
export async function GET() {
  try {
    const owner = await user();
    const store = db();
    const { data: permits, error } = await store
      .from("permits")
      .select("id,title,created_at,tx_hash")
      .eq("owner", owner);
    if (error) throw new Error("Activity unavailable.");
    const ids = (permits || []).map((p) => p.id);
    const { data: usage } = ids.length
      ? await store
          .from("access_receipts")
          .select("id,permit_id,used,created_at")
          .in("permit_id", ids)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };
    const { data: workflows } = ids.length
      ? await store
          .from("workflow_results")
          .select("id,permit_id,verified_block,created_at")
          .in("permit_id", ids)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };
    const activity = [
      ...(workflows || []).map((r) => ({
        id: r.id,
        action: "CRE access provisioned",
        detail: `Permit ${r.permit_id} · verified block ${r.verified_block}`,
        timestamp: r.created_at,
      })),
      ...(permits || []).map((p) => ({
        id: `purchase-${p.id}`,
        action: "On-chain permit purchased",
        detail: p.title,
        timestamp: p.created_at,
      })),
      ...(usage || []).map((r) => ({
        id: `access-${r.id}`,
        action: "Dataset accessed",
        detail: `Permit ${r.permit_id} · request ${r.used}`,
        timestamp: r.created_at,
      })),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return Response.json({ activity });
  } catch (e) {
    return fail(e);
  }
}
