import { user, fail } from "@/lib/server";
import { z } from "zod";
export async function GET() {
  try {
    const buyer = await user();
    const url = process.env.ENVIO_GRAPHQL_URL;
    if (!url) return Response.json({ configured: false, purchases: [] });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ENVIO_GRAPHQL_TOKEN
          ? { Authorization: `Bearer ${process.env.ENVIO_GRAPHQL_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        query:
          "query Purchases($buyer: String!) { Purchase(where: {buyer: {_eq: $buyer}}, order_by: {timestamp: desc}, limit: 50) { id permitId datasetId amount txHash timestamp revoked } }",
        variables: { buyer },
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Envio query failed.");
    const payload = await response.json();
    if (payload.errors) throw new Error("Envio schema query failed.");
    const purchases = z
      .array(
        z.object({
          id: z.string(),
          permitId: z.string(),
          datasetId: z.string(),
          amount: z.union([z.string(), z.number()]),
          txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
          timestamp: z.union([z.string(), z.number()]),
          revoked: z.boolean(),
        }),
      )
      .parse(payload.data.Purchase);
    return Response.json({ configured: true, purchases });
  } catch (e) {
    return fail(e);
  }
}
