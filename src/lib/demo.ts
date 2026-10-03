import { catalog } from "./catalog";
import type { DemoState, Dataset } from "./types";
export const freshState = (): DemoState => ({
  datasets: structuredClone(catalog),
  permits: [],
  activity: [],
});
export async function digest(records: Dataset["records"]) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(records)),
  );
  return (
    "0x" +
    Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}
export function checkPermit(
  permit: { revoked: boolean; expiresAt: string; used: number; quota: number },
  now = Date.now(),
) {
  if (permit.revoked) throw new Error("This permit has been revoked.");
  if (new Date(permit.expiresAt).getTime() <= now)
    throw new Error("This permit has expired.");
  if (permit.used >= permit.quota)
    throw new Error("Request allowance exhausted.");
}
export function log(
  state: DemoState,
  action: string,
  detail: string,
): DemoState {
  return {
    ...state,
    activity: [
      {
        id: crypto.randomUUID(),
        action,
        detail,
        timestamp: new Date().toISOString(),
      },
      ...state.activity,
    ].slice(0, 100),
  };
}
