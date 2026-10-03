"use client";
import { useState, useEffect, useRef } from "react";
import {
  createIntentsConnectApi,
  createExecutionRunner,
  type ExecutionPreview,
  type ExecutionRunner,
  type SupportedToken,
} from "@aurora-is-near/intents-connect";
import { parseUnits } from "viem";
import { wallet, publisherVaultKey } from "@/lib/wallet";
import { recoverDataset } from "@/lib/encryption";
import type { Dataset } from "@/lib/types";
async function api(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
export function SponsorTools({
  mode,
  address,
  datasets,
  recordsText,
}: {
  mode: string;
  address: string;
  datasets: Dataset[];
  recordsText: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState<unknown>();
  const [account, setAccount] = useState<unknown>();
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel sponsor-tools">
      <div className="panel-heading">
        <h3>Publisher vault & infrastructure</h3>
        <span>LIVE INTEGRATIONS</span>
      </div>
      <p>
        Encrypted publishing uses a separate Mera PRF key. The gateway can
        decrypt records for valid permits; the publisher can recover a copy with
        their passkey.
      </p>
      <button
        className="secondary"
        disabled={busy || mode !== "live"}
        onClick={() => run(async () => setAccount(await api("/api/account")))}
      >
        Refresh account balances
      </button>
      {account !== undefined && <pre>{JSON.stringify(account, null, 2)}</pre>}
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I approve sending up to 50 current publisher records to Kimi for a
        quality review.
      </label>
      <button
        className="secondary"
        disabled={busy || mode !== "live" || !consent}
        onClick={() =>
          run(async () => {
            const records = JSON.parse(recordsText);
            if (!Array.isArray(records))
              throw new Error("Records must be an array.");
            setReview(
              await api("/api/kimi", {
                records: records.slice(0, 50),
                consent: true,
              }),
            );
          })
        }
      >
        Review dataset with Kimi
      </button>
      {review !== undefined && <pre>{JSON.stringify(review, null, 2)}</pre>}
      {datasets
        .filter((d) => d.publisher.toLowerCase() === address.toLowerCase())
        .map((d) => (
          <button
            className="secondary"
            disabled={busy || mode !== "live"}
            key={d.id}
            onClick={() =>
              run(async () => {
                const data = await api(
                  "/api/vault?id=" + encodeURIComponent(d.id),
                );
                const records = await recoverDataset(
                  data.encrypted_data,
                  d.id,
                  publisherVaultKey(),
                );
                const { digest } = await import("@/lib/demo");
                if ((await digest(records)) !== data.digest)
                  throw new Error("Dataset digest mismatch.");
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(records, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = d.id + ".json";
                a.click();
                URL.revokeObjectURL(url);
                setMessage("Dataset recovered locally with your Mera passkey.");
              })
            }
          >
            Unlock publisher copy: {d.title}
          </button>
        ))}
      {mode !== "live" && (
        <p>
          Connect a passkey in live mode to use these services. Demo records
          remain local.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function AuroraFunding({ address }: { address: string }) {
  const [tokens, setTokens] = useState<SupportedToken[]>([]);
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<ExecutionPreview<undefined>>();
  const [message, setMessage] = useState("");
  const [deposit, setDeposit] = useState<{
    address: string;
    deadline?: string;
  }>();
  const [busy, setBusy] = useState(false);
  const runner = useRef<ExecutionRunner | null>(null);
  const enabled =
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID === "143" &&
    !!process.env.NEXT_PUBLIC_AURORA_DESTINATION_ASSET;
  useEffect(() => {
    if (!enabled) return;
    const api = createIntentsConnectApi({
      baseUrl:
        process.env.NEXT_PUBLIC_AURORA_API_URL ||
        "https://intents-connect-alpha-api.aurora.dev",
      apiKeyProxyUrl: location.origin + "/api/intents/",
    });
    const provider = {
      request: async ({
        method,
        params,
      }: {
        method: string;
        params?: unknown[] | object;
      }) => {
        if (method === "eth_requestAccounts") return [address];
        if (method === "personal_sign") {
          const values = params as string[];
          if (values[1]?.toLowerCase() !== address.toLowerCase())
            throw new Error("Signing address mismatch.");
          return wallet().signMessage({
            message: values[0].startsWith("0x")
              ? { raw: values[0] as `0x${string}` }
              : values[0],
          });
        }
        throw new Error("Unsupported passkey provider request.");
      },
    };
    const current = createExecutionRunner({
      api,
      wallet: {
        id: "mera",
        name: "Mera passkey",
        chains: ["eth", "base", "arb", "monad"],
        signingStandard: "erc191",
        connect: async () => {},
        disconnect: async () => {},
        getAddress: () => address,
        getProviders: () => ({ evm: provider }),
      },
      onEvent: (e) => {
        if (e.type === "deposit-address")
          setDeposit({ address: e.address, deadline: e.deadline });
        if (e.type === "status") setMessage(e.status);
        if (e.type === "created")
          localStorage.setItem("datapermit.aurora." + address, e.executionId);
      },
    });
    runner.current = current;
    api
      .listSupportedTokens("inOperation")
      .then((result) => {
        const dest = result.in?.find(
          (t) =>
            t.assetId === process.env.NEXT_PUBLIC_AURORA_DESTINATION_ASSET &&
            t.blockchain === "monad" &&
            t.contractAddress?.toLowerCase() ===
              process.env.NEXT_PUBLIC_PAYMENT_TOKEN?.toLowerCase(),
        );
        if (!dest)
          throw new Error(
            "Configured Monad settlement token is not supported by Aurora.",
          );
        setTokens(
          (result.in || []).filter(
            (t) =>
              t.assetId &&
              t.decimals !== undefined &&
              ["eth", "base", "arb"].includes(t.blockchain || ""),
          ),
        );
      })
      .catch((e) => setMessage(e.message));
    return () => {
      current.dispose();
      runner.current = null;
    };
  }, [address, enabled]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Funding failed");
    } finally {
      setBusy(false);
    }
  }
  if (!enabled)
    return (
      <section className="panel sponsor-tools">
        <h3>Aurora cross-chain funding</h3>
        <p>
          Available with Monad mainnet, an Aurora API key, and a supported
          settlement token. Testnet demo does not bridge real funds.
        </p>
      </section>
    );
  return (
    <section className="panel sponsor-tools">
      <h3>Fund your passkey account from another chain</h3>
      <p>
        Aurora settles the payment token into your Mera account. Review the
        quote, sign the intent, then deposit from your chosen source. Purchase a
        permit separately after settlement. Keep MON for transaction gas.
      </p>
      <label>
        Source token
        <select
          disabled={busy}
          value={asset}
          onChange={(e) => {
            setAsset(e.target.value);
            setPreview(undefined);
          }}
        >
          <option value="">Choose supported asset</option>
          {tokens.map((t) => (
            <option key={t.assetId} value={t.assetId}>
              {t.blockchain} · {t.symbol}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source amount
        <input
          disabled={busy}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setPreview(undefined);
          }}
        />
      </label>
      <button
        className="secondary"
        disabled={busy || !asset}
        onClick={() =>
          run(async () => {
            const token = tokens.find((t) => t.assetId === asset)!;
            if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0)
              throw new Error("Enter a positive amount.");
            setPreview(
              await runner.current!.preview({
                recipe: {
                  id: "datapermit-fund",
                  intent: "datapermit_fund",
                  title: "Fund DataPermit",
                  flow: "bridge-in",
                  type: "evm",
                  destination: {
                    chain: "monad",
                    assetId: process.env.NEXT_PUBLIC_AURORA_DESTINATION_ASSET!,
                    tokenAddress: process.env.NEXT_PUBLIC_PAYMENT_TOKEN,
                  },
                  buildSteps: ({ userAddress, amount }) => [
                    {
                      to: process.env.NEXT_PUBLIC_PAYMENT_TOKEN!,
                      functionSignature: "transfer(address,uint256)",
                      parameters: [userAddress, amount],
                      value: "0",
                    },
                  ],
                },
                params: undefined,
                quote: {
                  originAsset: asset,
                  destinationAsset:
                    process.env.NEXT_PUBLIC_AURORA_DESTINATION_ASSET!,
                  amount: parseUnits(amount, token.decimals!).toString(),
                  swapType: "EXACT_INPUT",
                  slippageTolerance: 100,
                  deadline: new Date(Date.now() + 20 * 60000).toISOString(),
                },
                originChain: token.blockchain!,
                originToken: {
                  decimals: token.decimals!,
                  contractAddress: token.contractAddress,
                },
                depositViaWallet: false,
              }),
            );
          })
        }
      >
        Get Aurora quote
      </button>
      {preview && (
        <>
          <pre>
            {JSON.stringify(
              {
                minimumSettlementAtomic: preview.execution.quote.minAmountOut,
                sourceDepositAtomic: preview.execution.quote.amountIn,
                networkFeeAtomic: preview.execution.details.networkFee,
                steps: preview.execution.steps,
              },
              null,
              2,
            )}
          </pre>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const execution = await runner.current!.run(preview.plan);
                setMessage("Aurora execution: " + execution.status);
                if (execution.status === "SUCCESS") setAccountBalance();
              })
            }
          >
            Approve quote & sign funding intent
          </button>
        </>
      )}
      {deposit && (
        <p>
          Deposit address: <code>{deposit.address}</code>
          <br />
          Deadline: {deposit.deadline}. Send only the quoted source asset and
          amount. Execution will monitor settlement.
        </p>
      )}
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const id = localStorage.getItem("datapermit.aurora." + address);
            if (!id) throw new Error("No saved funding execution.");
            const execution = await runner.current!.resume(id, {
              depositViaWallet: false,
            });
            setMessage("Aurora execution: " + execution.status);
          })
        }
      >
        Resume saved funding
      </button>
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const id = localStorage.getItem("datapermit.aurora." + address);
            if (!id) throw new Error("No saved funding execution.");
            await runner.current!.cancel(id);
            localStorage.removeItem("datapermit.aurora." + address);
            setMessage("Execution cancelled.");
          })
        }
      >
        Cancel saved intent
      </button>
      <p role="status">{message}</p>
    </section>
  );
  function setAccountBalance() {
    api("/api/account")
      .then((data) =>
        setMessage(
          "Settled. Current payment-token balance: " + data.tokenBalance,
        ),
      )
      .catch((e) => setMessage(e.message));
  }
}
