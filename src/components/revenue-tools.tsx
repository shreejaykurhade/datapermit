"use client";
import { useState } from "react";
import type { RevenueShare } from "@/lib/revenue";
import { wallet } from "@/lib/wallet";
import { contractAddress, permitAbi, chainClient } from "@/lib/chain";
export function RevenueEditor({
  shares,
  onChange,
}: {
  shares: RevenueShare[];
  onChange: (s: RevenueShare[]) => void;
}) {
  const total = shares.reduce((sum, s) => sum + s.bps, 0);
  return (
    <fieldset className="revenue-editor">
      <legend>Company & contributor revenue</legend>
      <p>
        The company receives the remainder. Add contributor and expert wallets
        with their share of every sale. This split is locked for this version.
        Maximum 20 recipients.
      </p>
      {shares.map((share, i) => (
        <div className="revenue-row" key={i}>
          <label>
            Recipient wallet
            <input
              aria-label={`Recipient wallet ${i + 1}`}
              placeholder="0x…"
              value={share.recipient}
              onChange={(e) =>
                onChange(
                  shares.map((s, j) =>
                    j === i ? { ...s, recipient: e.target.value } : s,
                  ),
                )
              }
            />
          </label>
          <label>
            Role
            <select
              value={share.role}
              onChange={(e) =>
                onChange(
                  shares.map((s, j) =>
                    j === i
                      ? { ...s, role: e.target.value as RevenueShare["role"] }
                      : s,
                  ),
                )
              }
            >
              <option value="contributor">Contributor</option>
              <option value="verifier">Expert verifier</option>
            </select>
          </label>
          <label>
            Share (%)
            <input
              aria-label={`Revenue share ${i + 1}`}
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={share.bps / 100}
              onChange={(e) =>
                onChange(
                  shares.map((s, j) =>
                    j === i
                      ? { ...s, bps: Math.round(Number(e.target.value) * 100) }
                      : s,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="secondary"
            aria-label={`Remove recipient ${i + 1}`}
            onClick={() => onChange(shares.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={shares.length >= 20}
        onClick={() =>
          onChange([
            ...shares,
            { recipient: "", bps: 500, role: "contributor" },
          ])
        }
      >
        Add revenue recipient
      </button>
      <p className={total > 10000 ? "split-error" : ""}>
        Company: {(10000 - total) / 100}% · Contributors/verifiers:{" "}
        {total / 100}%
      </p>
      <p className="fine-print">
        Purchase funds accrue in the contract. Recipients withdraw accumulated
        earnings. Rounding fractions stay with the company.
      </p>
    </fieldset>
  );
}
export function Earnings({
  mode,
  earnings,
  onDemoWithdraw,
}: {
  mode: string;
  earnings: Record<string, string>;
  onDemoWithdraw: (recipient: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    try {
      setBusy(true);
      const response = await fetch("/api/earnings");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAmount(data.formatted);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Cannot read earnings.");
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    try {
      setBusy(true);
      if (!contractAddress)
        throw new Error("Deploy the updated revenue-sharing contract first.");
      const tx = await wallet().writeContract({
        address: contractAddress,
        abi: permitAbi,
        functionName: "withdrawEarnings",
      });
      await chainClient.waitForTransactionReceipt({ hash: tx });
      setAmount("0");
      setMessage("Earnings withdrawn to your passkey account.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Withdrawal failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel sponsor-tools">
      <h3>Revenue & withdrawals</h3>
      {mode === "live" ? (
        <>
          <p>
            Your accumulated earnings: {amount || "Refresh to read"}{" "}
            {process.env.NEXT_PUBLIC_PAYMENT_SYMBOL || "TEST"}
          </p>
          <button className="secondary" disabled={busy} onClick={load}>
            Refresh earnings
          </button>
          <button
            className="primary"
            disabled={busy || !amount || Number(amount) <= 0}
            onClick={withdraw}
          >
            Withdraw earnings
          </button>
        </>
      ) : (
        <>
          <p>Local simulation only. These credits are not tokens or money.</p>
          {Object.entries(earnings)
            .filter(([, v]) => BigInt(v) > 0n)
            .map(([recipient, value]) => (
              <div className="demo-earning" key={recipient}>
                <code>{recipient}</code>
                <span>{Number(BigInt(value)) / 1e6} demo credits</span>
                <button
                  className="secondary"
                  onClick={() => onDemoWithdraw(recipient)}
                >
                  Simulate withdrawal
                </button>
              </div>
            ))}
          {!Object.values(earnings).some((v) => BigInt(v) > 0n) && (
            <p>
              Buy a dataset to see the company and its recipients earn their
              locked shares.
            </p>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
