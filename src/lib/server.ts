import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Live storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => `dp_${randomBytes(32).toString("base64url")}`;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32)
    throw new Error("Set SESSION_SECRET to at least 32 random characters.");
  return value;
}
export async function setSession(address: string) {
  const payload = Buffer.from(
    JSON.stringify({
      address: address.toLowerCase(),
      exp: Date.now() + 3600000,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  (await cookies()).set("dp_session", `${payload}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  });
}
export async function user() {
  const value = (await cookies()).get("dp_session")?.value;
  if (!value) throw new Error("Authentication required.");
  const [payload, sig] = value.split(".");
  if (!payload || !sig) throw new Error("Authentication required.");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Authentication required.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (data.exp < Date.now()) throw new Error("Session expired.");
  return data.address as string;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Error("Invalid request origin.");
}
export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  return Response.json(
    { error: message },
    {
      status:
        message.includes("Authentication") ||
        message.includes("Session expired")
          ? 401
          : 400,
    },
  );
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 2_000_000) throw new Error("Payload exceeds 2 MB.");
  return JSON.parse(raw);
}
