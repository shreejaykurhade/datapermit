import { user, sameOrigin, body, fail } from "@/lib/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateFunding } from "@/lib/intents-policy";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    sameOrigin(request);
    const owner = await user();
    await rateLimit("aurora:" + owner, 10);
    const { path } = await params;
    if (
      path.length !== 4 ||
      path.slice(0, 3).join("/") !== "api/v1/executions" ||
      path[3].toLowerCase() !== owner
    )
      throw new Error("Invalid execution path.");
    if (
      process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143" ||
      !process.env.AURORA_API_KEY
    )
      throw new Error("Aurora funding requires configured Monad mainnet.");
    const input = validateFunding(await body(request), owner, {
      destinationAsset: process.env.NEXT_PUBLIC_AURORA_DESTINATION_ASSET || "",
      tokenAddress: process.env.NEXT_PUBLIC_PAYMENT_TOKEN || "",
    });
    const upstream = await fetch(
      `${process.env.AURORA_API_URL || "https://intents-connect-alpha-api.aurora.dev"}/api/v1/executions/${owner}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.AURORA_API_KEY,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!upstream.ok)
      return Response.json(
        {
          error:
            "Aurora rejected this quote. Check supported tokens and account configuration.",
        },
        { status: upstream.status },
      );
    return Response.json(await upstream.json());
  } catch (e) {
    return fail(e);
  }
}
