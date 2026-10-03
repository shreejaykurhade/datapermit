import "server-only";
export function qwenConfig() {
  const key = process.env.QWEN_API_KEY,
    model = process.env.QWEN_MODEL,
    url = process.env.QWEN_BASE_URL;
  if (!key || !model || !url)
    throw new Error("Qwen needs QWEN_API_KEY, QWEN_BASE_URL, and QWEN_MODEL.");
  return { key, model, url };
}
export async function qwen(
  payload: Record<string, unknown>,
  timeoutMs = 25000,
) {
  const { key, model, url } = qwenConfig();
  const response = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, ...payload }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(
      "Qwen request failed. Verify the model and region endpoint.",
    );
  return response.json();
}
