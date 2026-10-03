import { rateLimit } from "@/lib/rate-limit";
import { randomBytes } from "node:crypto";
import { recoverMessageAddress, isAddress } from "viem";
import { cookies } from "next/headers";
import { db, setSession, user, fail, sameOrigin, body } from "@/lib/server";
export async function GET() {
  try {
    return Response.json({ address: await user() });
  } catch {
    return Response.json({ address: null });
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    (await cookies()).delete("dp_session");
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(
      "auth:" +
        (request.headers.get("x-forwarded-for")?.split(",")[0] || "local"),
      20,
    );
    const data = await body(request);
    if (!isAddress(data.address)) throw new Error("Invalid account.");
    if (!data.signature) {
      const nonce = randomBytes(24).toString("hex");
      const expires = new Date(Date.now() + 300000).toISOString();
      const message = `DataPermit sign-in\nOrigin: ${new URL(request.url).origin}\nAddress: ${data.address.toLowerCase()}\nNonce: ${nonce}\nExpires: ${expires}`;
      const { error } = await db().from("auth_challenges").insert({
        nonce,
        address: data.address.toLowerCase(),
        message,
        expires_at: expires,
      });
      if (error) throw new Error("Could not create sign-in challenge.");
      return Response.json({ nonce, message });
    }
    const { data: challenge, error } = await db()
      .from("auth_challenges")
      .delete()
      .eq("nonce", data.nonce)
      .eq("address", data.address.toLowerCase())
      .gt("expires_at", new Date().toISOString())
      .select()
      .single();
    if (error || !challenge)
      throw new Error("Sign-in challenge expired or already used.");
    const signer = await recoverMessageAddress({
      message: challenge.message,
      signature: data.signature,
    });
    if (signer.toLowerCase() !== challenge.address)
      throw new Error("Invalid signature.");
    await setSession(signer);
    return Response.json({ address: signer });
  } catch (e) {
    return fail(e);
  }
}
