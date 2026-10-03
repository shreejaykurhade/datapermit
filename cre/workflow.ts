import {
  CronCapability,
  HTTPClient,
  handler,
  ok,
  consensusIdenticalAggregation,
  Runner,
  type Runtime,
  type NodeRuntime,
} from "@chainlink/cre-sdk";
import { z } from "zod";
const configSchema = z.object({
  schedule: z.string(),
  appUrl: z.string().url(),
  rpcUrl: z.string().url(),
});
type Config = z.infer<typeof configSchema>;
type Result = { processed: number; ready: string[] };
type Job = { id: string; tx_hash: string };
function fetchJobs(node: NodeRuntime<Config>, secret: string): Job[] {
  const response = new HTTPClient()
    .sendRequest(node, {
      url: node.config.appUrl + "/api/cre",
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cacheSettings: { store: true, maxAge: "10s" },
    })
    .result();
  if (!ok(response)) throw new Error("Could not read provisioning jobs.");
  return z
    .object({
      jobs: z
        .array(
          z.object({
            id: z.string(),
            tx_hash: z.string().regex(/^0x[\da-fA-F]{64}$/),
          }),
        )
        .max(20),
    })
    .parse(JSON.parse(Buffer.from(response.body).toString("utf8"))).jobs;
}
function provision(
  node: NodeRuntime<Config>,
  secret: string,
  jobs: Job[],
): Result {
  const http = new HTTPClient();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  const send = (url: string, method: "GET" | "POST", payload?: unknown) => {
    const response = http
      .sendRequest(node, {
        url,
        method,
        headers,
        body:
          payload === undefined
            ? undefined
            : Buffer.from(JSON.stringify(payload)).toString("base64"),
        cacheSettings: { store: true, maxAge: "10s" },
      })
      .result();
    if (!ok(response))
      throw new Error("DataPermit workflow HTTP request failed.");
    return JSON.parse(Buffer.from(response.body).toString("utf8"));
  };
  const ready: string[] = [];
  for (const job of jobs) {
    const receipt = http
      .sendRequest(node, {
        url: node.config.rpcUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt",
            params: [job.tx_hash],
          }),
        ).toString("base64"),
        cacheSettings: { store: true, maxAge: "10s" },
      })
      .result();
    if (!ok(receipt)) throw new Error("Monad receipt request failed.");
    const json = JSON.parse(Buffer.from(receipt.body).toString("utf8"));
    if (json.error) throw new Error("Monad RPC rejected receipt lookup.");
    if (json.result?.status !== "0x1") continue;
    const result = send(node.config.appUrl + "/api/cre", "POST", {
      permitId: job.id,
      txHash: job.tx_hash,
    });
    if (result.status !== "ready") throw new Error("Provisioning failed.");
    ready.push(job.id);
  }
  return { processed: jobs.length, ready };
}
const onCron = (runtime: Runtime<Config>) => {
  const secret = runtime
    .getSecret({ id: "DATAPERMIT_CRE_SECRET" })
    .result().value;
  const jobs = runtime
    .runInNodeMode(
      fetchJobs,
      consensusIdenticalAggregation<Job[]>(),
    )(secret)
    .result();
  return runtime
    .runInNodeMode(provision, consensusIdenticalAggregation<Result>())(
      secret,
      jobs,
    )
    .result();
};
const init = (config: Config) => [
  handler(new CronCapability().trigger({ schedule: config.schedule }), onCron),
];
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(init);
}
