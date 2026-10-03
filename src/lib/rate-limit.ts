import "server-only";
import { db, tokenHash } from "./server";
export async function rateLimit(key: string, limit: number) {
  const { error } = await db().rpc("consume_rate_limit", {
    p_key: tokenHash(key),
    p_limit: limit,
  });
  if (error)
    throw new Error("Request limit reached. Please try again in one minute.");
}
