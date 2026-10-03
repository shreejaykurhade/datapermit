"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  ShieldCheck,
  Database,
  KeyRound,
  LayoutGrid,
  Plus,
  Activity as ActivityIcon,
  Terminal,
  ChevronRight,
  X,
  Check,
  Copy,
  FileJson,
  Globe,
  Lock,
  BookOpen,
  LogOut,
  LoaderCircle,
  FlaskConical,
  Menu,
} from "lucide-react";
import { parseUnits } from "viem";
import type { Dataset, DemoState, Permit, RecordRow } from "@/lib/types";
import { freshState, digest, checkPermit, log } from "@/lib/demo";
import { defaultTerms } from "@/lib/catalog";
import { publishSchema } from "@/lib/validation";
import {
  chainClient,
  appChain,
  explorerUrl,
  contractAddress,
  tokenAddress,
  tokenAbi,
  permitAbi,
  datasetKey,
  termsKey,
} from "@/lib/chain";
import { SponsorTools, AuroraFunding } from "./sponsor-tools";
import { encryptDataset } from "@/lib/encryption";
import {
  connectWallet,
  wallet,
  disconnectWallet,
  publisherVaultKey,
} from "@/lib/wallet";

type View =
  "Discover" | "My permits" | "Publisher studio" | "Activity" | "Developer";
const navigation = [
  { name: "Discover" as View, icon: LayoutGrid },
  { name: "My permits" as View, icon: KeyRound },
  { name: "Publisher studio" as View, icon: Plus },
  { name: "Activity" as View, icon: ActivityIcon },
  { name: "Developer" as View, icon: Terminal },
];
const symbol = process.env.NEXT_PUBLIC_PAYMENT_SYMBOL || "TEST";
const emptyForm = {
  title: "",
  description: "",
  language: "English",
  category: "Customer support",
  price: "5",
  durationDays: 7,
  quota: 100,
  version: "1.0",
  terms: defaultTerms,
};
const exampleRecords: RecordRow[] = [
  {
    input: "My order is late.",
    expected: "Ask for the order number and check its delivery status.",
    category: "Delivery",
  },
  {
    input: "I was charged twice.",
    expected: "Investigate the duplicate charge.",
    category: "Billing",
  },
  {
    input: "Please connect me to a person.",
    expected: "Offer human escalation.",
    category: "Escalation",
  },
];
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
function mapDataset(d: Record<string, unknown>): Dataset {
  return {
    id: String(d.id),
    title: String(d.title),
    description: String(d.description),
    category: String(d.category),
    language: String(d.language),
    publisher: String(d.publisher),
    price: String(d.price),
    durationDays: Number(d.duration_days),
    quota: Number(d.quota),
    version: String(d.version),
    terms: String(d.terms),
    digest: String(d.digest),
    records: d.sample as RecordRow[],
    createdAt: String(d.created_at),
  };
}
function mapPermit(p: Record<string, unknown>): Permit {
  return {
    id: String(p.id),
    datasetId: String(p.dataset_id),
    title: String(p.title),
    owner: String(p.owner),
    expiresAt: String(p.expires_at),
    quota: Number(p.quota),
    used: Number(p.used),
    revoked: Boolean(p.revoked),
    token: "",
    createdAt: String(p.created_at),
    txHash: String(p.tx_hash),
    provisioningStatus:
      p.provisioning_status === "pending" ? "pending" : "ready",
  };
}
function short(value: string) {
  return value.length > 24 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Workspace() {
  const [state, setState] = useState<DemoState>(freshState);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("Discover");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All datasets");
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [address, setAddress] = useState("");
  const [accountModal, setAccountModal] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [health, setHealth] = useState<{
    storage: boolean;
    contract: boolean;
    qwen: boolean;
    envio: boolean;
    encryption: boolean;
    alchemy: boolean;
    kimi: boolean;
    cre: boolean;
    aurora: boolean;
  } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [recordsText, setRecordsText] = useState(
    JSON.stringify(exampleRecords, null, 2),
  );
  const [rights, setRights] = useState(false);
  const [activePermit, setActivePermit] = useState("");
  const [result, setResult] = useState<{
    records: RecordRow[];
    remaining: number;
    version?: string;
  } | null>(null);
  const [answer, setAnswer] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    score: number;
    verdict: string;
    reasoning: string;
  } | null>(null);
  const [tokenVisible, setTokenVisible] = useState("");
  const [receipt, setReceipt] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [goal, setGoal] = useState(
    "Find a dataset to evaluate a Marathi customer support assistant.",
  );
  const [agentResult, setAgentResult] = useState<{
    message: string;
    datasetId: string | null;
    trace: { tool: string; result: unknown }[];
  } | null>(null);
  const [indexed, setIndexed] = useState<
    {
      id: string;
      permitId: string;
      amount: string;
      txHash: string;
      revoked: boolean;
    }[]
  >([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("datapermit.demo.v1");
      if (saved) {
        const value = JSON.parse(saved);
        if (
          Array.isArray(value.datasets) &&
          Array.isArray(value.permits) &&
          Array.isArray(value.activity)
        )
          setState(value);
      }
    } catch {}
    setReady(true);
    api("/api/health")
      .then(setHealth)
      .catch(() => {});
    return () => disconnectWallet();
  }, []);
  useEffect(() => {
    if (ready && mode === "demo")
      localStorage.setItem("datapermit.demo.v1", JSON.stringify(state));
  }, [state, ready, mode]);
  async function task(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }
  async function refresh() {
    const [datasets, permits, activity, indexer] = await Promise.all([
      api("/api/datasets"),
      api("/api/permits"),
      api("/api/activity"),
      api("/api/indexer").catch(() => ({ purchases: [] })),
    ]);
    setState((previous) => ({
      ...previous,
      datasets: datasets.datasets.map(mapDataset),
      permits: permits.permits.map(mapPermit),
      activity: activity.activity,
    }));
    setIndexed(indexer.purchases);
  }
  async function signIn(create: boolean) {
    await task("Connecting passkey", async () => {
      if (!health?.storage || !health.contract)
        throw new Error(
          "Live mode needs Supabase and deployed contract configuration. Open Developer for setup.",
        );
      const client = await connectWallet(create);
      const challenge = await api(
        "/api/auth",
        json({ address: client.account.address }),
      );
      const signature = await client.signMessage({
        message: challenge.message,
      });
      await api(
        "/api/auth",
        json({
          address: client.account.address,
          nonce: challenge.nonce,
          signature,
        }),
      );
      setAddress(client.account.address);
      setMode("live");
      setAccountModal(false);
      setState(freshState());
      await refresh();
      setNotice(`Signed in with Mera on ${appChain.name}.`);
    });
  }
  async function register() {
    await task("Publishing dataset", async () => {
      if (!rights)
        throw new Error(
          "Confirm that you have permission to license these records.",
        );
      let records;
      try {
        records = JSON.parse(recordsText);
      } catch {
        throw new Error("Records must be valid JSON.");
      }
      const parsed = publishSchema.safeParse({ ...form, records });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" · "),
        );
      const hash = await digest(parsed.data.records);
      const id = `${form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
      if (mode === "live") {
        if (!contractAddress || !tokenAddress)
          throw new Error("Configure the contract first.");
        if (!health?.encryption)
          throw new Error(
            "Configure DATA_ENCRYPTION_KEY before encrypted live publishing.",
          );
        const encryptedPayload = await encryptDataset(
          parsed.data.records,
          id,
          publisherVaultKey(),
        );
        const client = wallet();
        const decimals = await chainClient.readContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "decimals",
        });
        const tx = await client.writeContract({
          address: contractAddress,
          abi: permitAbi,
          functionName: "registerDataset",
          args: [
            datasetKey(id),
            parseUnits(form.price, decimals),
            BigInt(form.durationDays * 86400),
            form.quota,
            hash as `0x${string}`,
            termsKey(form.terms),
          ],
        });
        await chainClient.waitForTransactionReceipt({ hash: tx });
        await api(
          "/api/datasets",
          json({ ...parsed.data, id, ...encryptedPayload }),
        );
        await refresh();
      } else {
        const dataset: Dataset = {
          ...parsed.data,
          id,
          publisher: "You · demo publisher",
          digest: hash,
          createdAt: new Date().toISOString(),
        };
        setState((s) =>
          log(
            { ...s, datasets: [dataset, ...s.datasets] },
            "Dataset published",
            `${dataset.title} · version ${dataset.version}`,
          ),
        );
      }
      setForm(emptyForm);
      setRights(false);
      setView("Discover");
      setNotice("Dataset published. Buyers can now preview and license it.");
    });
  }
  async function importReceipt(dataset: Dataset, txHash: string) {
    const imported = await api(
      "/api/permits",
      json({ datasetId: dataset.id, txHash }),
    );
    await refresh();
    setTokenVisible(imported.token);
    setTokens((t) => ({ ...t, [imported.id]: imported.token }));
    setActivePermit(imported.id);
    setSelected(null);
    setView("My permits");
    setReceipt("");
    setNotice(
      "Payment verified. Save your access token; only its hash is stored.",
    );
  }
  async function purchase() {
    if (!selected) return;
    await task("Creating permit", async () => {
      if (!accepted) throw new Error("Accept the license terms to continue.");
      if (mode === "live") {
        if (!contractAddress || !tokenAddress)
          throw new Error("Configure a payment contract first.");
        const client = wallet();
        const decimals = await chainClient.readContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "decimals",
        });
        const amount = parseUnits(selected.price, decimals);
        const approval = await client.writeContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "approve",
          args: [contractAddress, amount],
        });
        await chainClient.waitForTransactionReceipt({ hash: approval });
        const txHash = await client.writeContract({
          address: contractAddress,
          abi: permitAbi,
          functionName: "purchase",
          args: [datasetKey(selected.id), termsKey(selected.terms)],
        });
        setReceipt(txHash);
        await chainClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 2,
        });
        await importReceipt(selected, txHash);
      } else {
        const permit: Permit = {
          id: crypto.randomUUID(),
          datasetId: selected.id,
          title: selected.title,
          owner: "demo-buyer",
          expiresAt: new Date(
            Date.now() + selected.durationDays * 86400000,
          ).toISOString(),
          quota: selected.quota,
          used: 0,
          revoked: false,
          token: `demo_${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
        };
        setState((s) =>
          log(
            { ...s, permits: [permit, ...s.permits] },
            "Demo permit created",
            `${selected.title} · license v${selected.version}`,
          ),
        );
        setActivePermit(permit.id);
        setSelected(null);
        setView("My permits");
        setNotice("Demo permit created. No funds were transferred.");
      }
    });
  }
  async function access(id: string) {
    await task("Checking access", async () => {
      setEvaluation(null);
      setResult(null);
      setActivePermit(id);
      const p = state.permits.find((p) => p.id === id);
      if (!p) throw new Error("Select a permit first.");
      if (mode === "live") {
        let token = tokens[id];
        if (!token) {
          const rotated = await api(
            "/api/permits",
            json({ id, action: "rotate" }, "PATCH"),
          );
          token = rotated.token;
          setTokens((t) => ({ ...t, [id]: token }));
          setTokenVisible(token);
        }
        const data = await api("/api/access", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setResult(data);
        await refresh();
      } else {
        checkPermit(p);
        const d = state.datasets.find((d) => d.id === p.datasetId);
        if (!d) throw new Error("Dataset not found.");
        setState((s) =>
          log(
            {
              ...s,
              permits: s.permits.map((x) =>
                x.id === id ? { ...x, used: x.used + 1 } : x,
              ),
            },
            "Dataset accessed",
            `${p.title} · request ${p.used + 1}/${p.quota}`,
          ),
        );
        setResult({
          records: d.records,
          remaining: p.quota - p.used - 1,
          version: d.version,
        });
      }
      setView("Developer");
      setNotice("Access granted. One API request consumed.");
    });
  }
  async function revoke(p: Permit) {
    await task("Revoking permit", async () => {
      if (mode === "live") {
        if (!contractAddress) throw new Error("Contract missing.");
        const tx = await wallet().writeContract({
          address: contractAddress,
          abi: permitAbi,
          functionName: "revoke",
          args: [BigInt(p.id)],
        });
        await chainClient.waitForTransactionReceipt({ hash: tx });
        await api(
          "/api/permits",
          json({ id: p.id, action: "revoke" }, "PATCH"),
        );
        await refresh();
      } else
        setState((s) =>
          log(
            {
              ...s,
              permits: s.permits.map((x) =>
                x.id === p.id ? { ...x, revoked: true } : x,
              ),
            },
            "Permit revoked",
            p.title,
          ),
        );
      setResult(null);
      setTokenVisible("");
      setNotice(
        "Future gateway access revoked. Previously downloaded data remains with its recipient.",
      );
    });
  }
  async function evaluate(generate = false) {
    await task("Evaluating response", async () => {
      if (!result?.records[0] || (!generate && !answer.trim()))
        throw new Error(
          "Retrieve a dataset and enter an assistant response first.",
        );
      if (mode === "live") {
        if (!aiConsent)
          throw new Error(
            "Approve sending the retrieved record to Qwen first.",
          );
        const data = await api(
          "/api/evaluate",
          json({
            record: result.records[0],
            response: generate ? undefined : answer,
            consent: true,
          }),
        );
        setEvaluation(data);
        if (data.response) setAnswer(data.response);
      } else {
        setEvaluation({
          score: 0,
          verdict: "Manual evaluation preview",
          reasoning: `Expected behavior: ${result.records[0].expected}\nCompare your response against this rubric. Configure Qwen and use live mode for model scoring; this preview does not call AI.`,
        });
      }
      setNotice(
        mode === "live"
          ? "Qwen evaluation complete."
          : "Manual preview complete. No AI provider was called.",
      );
    });
  }
  async function reset() {
    disconnectWallet();
    await api("/api/auth", { method: "DELETE" }).catch(() => {});
    setMode("demo");
    setAddress("");
    setTokens({});
    setIndexed([]);
    setAgentResult(null);
    setState(freshState());
    setSelected(null);
    setResult(null);
    setTokenVisible("");
    setEvaluation(null);
    setView("Discover");
    setNotice("Demo reset to the original sample catalog.");
  }
  const datasets = state.datasets.filter(
    (d) =>
      (filter === "All datasets" || d.category === filter) &&
      `${d.title} ${d.language} ${d.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const currentPermit = state.permits.find((p) => p.id === activePermit);
  const active = state.permits.filter(
    (p) =>
      !p.revoked &&
      new Date(p.expiresAt).getTime() > Date.now() &&
      p.used < p.quota,
  ).length;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <a className="brand" href="/" aria-label="DataPermit home">
          <span className="brand-mark">
            <Database size={20} />
          </span>
          DataPermit<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${view === name ? "active" : ""}`}
              onClick={() => {
                setView(name);
                setMobileNav(false);
              }}
            >
              <Icon size={18} />
              {name}
              {name === "My permits" && active > 0 && (
                <span className="nav-count">{active}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="network">
            <span className="status-dot" />
            {appChain.name}
            <span className="network-id">{appChain.id}</span>
          </div>
          <div className="sidebar-tip">
            <ShieldCheck size={22} />
            <strong>Your data. Your terms.</strong>
            <p>Clear permissions from the first request to the last.</p>
            <button onClick={() => setView("Developer")}>
              Explore the protocol <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-foot">BUILT FOR A MORE OPEN AI ECONOMY</div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="top-actions">
            <span className={`mode-pill ${mode === "live" ? "live" : ""}`}>
              <span className="status-dot" />
              {mode === "demo" ? "Demo workspace" : "Live · testnet"}
            </span>
            <button
              className="account-button"
              onClick={() => setAccountModal(true)}
            >
              <KeyRound size={15} />
              {address ? short(address) : "Connect passkey"}
            </button>
          </div>
        </header>
        <div className="content">
          {(notice || error) && (
            <div
              role={error ? "alert" : "status"}
              className={`toast ${error ? "error" : ""}`}
            >
              {error || notice}
              <button
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === "Discover" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="tiny-square" />
                    THE DATA LAYER FOR BETTER AI
                  </div>
                  <h1>
                    Good data.
                    <br />
                    <span>Clear permission.</span>
                  </h1>
                  <p>
                    Discover specialist datasets. License what you need.
                    <br className="desktop-break" /> Build better AI with access
                    you can verify.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="primary"
                      onClick={() =>
                        document
                          .getElementById("catalog")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Explore datasets <ArrowRight size={16} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setView("Publisher studio")}
                    >
                      Publish your data <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="hero-proof">
                    <span>
                      <KeyRound size={13} />
                      Passkey accounts
                    </span>
                    <span>
                      <ShieldCheck size={13} />
                      Explicit licenses
                    </span>
                    <span>
                      <Globe size={13} />
                      Monad settlement
                    </span>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />
                  <div className="art-label label-one">
                    DATA, WITH DIRECTION
                  </div>
                  <div className="data-tile tile-back">
                    <FileJson size={34} />
                    <span>DATASET / v1.0</span>
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="data-tile tile-front">
                    <div className="tile-heading">
                      <span className="mini-logo">
                        <Database size={16} />
                      </span>
                      <span>ACCESS PERMIT</span>
                      <ArrowUpRight size={16} />
                    </div>
                    <div className="tile-key">
                      <KeyRound size={38} />
                    </div>
                    <div className="tile-footer">
                      <span>
                        <span className="status-dot" />
                        AUTHORIZED
                      </span>
                      <ShieldCheck size={19} />
                    </div>
                  </div>
                  <div className="art-label label-two">
                    01 / OWNERSHIP → ACCESS
                  </div>
                </div>
              </section>
              <section className="summary-strip">
                <div>
                  <Database size={20} />
                  <span>
                    <strong>
                      {state.datasets.length.toString().padStart(2, "0")}
                    </strong>
                    curated datasets
                  </span>
                </div>
                <div>
                  <Globe size={20} />
                  <span>
                    <strong>
                      {new Set(state.datasets.map((d) => d.language)).size
                        .toString()
                        .padStart(2, "0")}
                    </strong>
                    languages represented
                  </span>
                </div>
                <div>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Explicit</strong>versioned permissions
                  </span>
                </div>
                <div>
                  <Lock size={20} />
                  <span>
                    <strong>Private</strong>records stay off-chain
                  </span>
                </div>
              </section>
              <section id="catalog" className="catalog">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow muted">
                      FIND YOUR NEXT BENCHMARK
                    </div>
                    <h2>
                      Explore datasets{" "}
                      <span className="count-label">{datasets.length}</span>
                    </h2>
                  </div>
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search datasets"
                      placeholder="Search datasets, languages…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <span>⌕</span>
                  </label>
                </div>
                <div className="filters">
                  {[
                    "All datasets",
                    "Customer support",
                    "Language understanding",
                    "Agent safety",
                  ].map((item) => (
                    <button
                      className={filter === item ? "selected" : ""}
                      key={item}
                      onClick={() => setFilter(item)}
                    >
                      {item}
                    </button>
                  ))}
                  <span className="filter-caption">
                    Original sample collections
                  </span>
                </div>
                <div className="dataset-grid">
                  {datasets.map((d, index) => (
                    <button
                      key={d.id}
                      className="dataset-card"
                      onClick={() => {
                        setSelected(d);
                        setAccepted(false);
                        setReceipt("");
                      }}
                    >
                      <div className={`card-art art-${index % 3}`}>
                        <div className="art-grid" />
                        <span className="language-script">
                          {d.language === "Marathi"
                            ? "अ"
                            : d.language === "Hindi"
                              ? "क"
                              : "{ }"}
                        </span>
                        <span className="art-version">
                          {d.language.toUpperCase()} / v{d.version}
                        </span>
                        <span className="art-icon">
                          <ArrowUpRight size={21} />
                        </span>
                      </div>
                      <div className="card-body">
                        <div className="card-category">
                          <span className="category-tag">{d.category}</span>
                          <span>{d.language}</span>
                        </div>
                        <h3>{d.title}</h3>
                        <p>{d.description}</p>
                        <div className="card-meta">
                          <FileJson size={13} />{" "}
                          {mode === "demo"
                            ? `${d.records.length} records`
                            : "Preview available"}
                          <span>·</span>
                          {d.durationDays}-day access
                        </div>
                        <div className="card-footer">
                          <span>
                            <strong>{d.price}</strong>{" "}
                            {mode === "demo" ? "demo credits" : symbol}
                            <small> / permit</small>
                          </span>
                          <span className="card-link">
                            View dataset <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {datasets.length === 0 && (
                  <div className="empty">
                    <Search size={30} />
                    <h3>No matching datasets</h3>
                    <p>Try another language or clear the filters.</p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("All datasets");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </section>
              <section className="publisher-callout">
                <div className="callout-icon">
                  <Database size={23} />
                </div>
                <div>
                  <h3>Your expertise could power the next great model.</h3>
                  <p>
                    Publish a specialist dataset. Set your terms. Get paid for
                    access.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setView("Publisher studio")}
                >
                  Become a publisher <ArrowUpRight size={16} />
                </button>
              </section>
            </>
          )}
          {view === "My permits" && (
            <>
              <PageHeading
                label="YOUR ACCESS, IN ONE PLACE"
                title="My permits"
                description="Manage dataset access, request allowances, and license receipts."
              />
              <div className="metric-row">
                <Metric value={String(active)} label="Active permits" />
                <Metric
                  value={String(state.permits.reduce((n, p) => n + p.used, 0))}
                  label="Requests consumed"
                />
                <Metric
                  value={String(state.permits.filter((p) => p.revoked).length)}
                  label="Revoked permits"
                />
              </div>
              {tokenVisible && (
                <div className="token-box">
                  <strong>Save your access token</strong>
                  <p>
                    Shown for this session only. Generating another token
                    invalidates the previous one.
                  </p>
                  <code>{tokenVisible}</code>
                  <button
                    className="icon-button"
                    aria-label="Copy access token"
                    onClick={() =>
                      task("Copying", async () => {
                        await navigator.clipboard.writeText(tokenVisible);
                        setNotice("Token copied.");
                      })
                    }
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}
              {!state.permits.length ? (
                <Empty
                  icon={<KeyRound size={30} />}
                  title="Your first permit starts here"
                  description="License a dataset to unlock its records and evaluation tools."
                  action={() => setView("Discover")}
                  actionText="Explore datasets"
                />
              ) : (
                <div className="permit-list">
                  {state.permits.map((p) => {
                    let status = "Active";
                    try {
                      checkPermit(p);
                    } catch (e) {
                      status = p.revoked
                        ? "Revoked"
                        : new Date(p.expiresAt).getTime() <= Date.now()
                          ? "Expired"
                          : "Exhausted";
                    }
                    return (
                      <article className="panel permit-card" key={p.id}>
                        <div className="permit-symbol">
                          <KeyRound size={23} />
                        </div>
                        <div className="permit-info">
                          <span
                            className={`badge ${status === "Active" ? "green" : ""}`}
                          >
                            {status}
                          </span>
                          <h3>{p.title}</h3>
                          <p>
                            Expires {new Date(p.expiresAt).toLocaleDateString()}{" "}
                            · {p.used}/{p.quota} requests used
                          </p>
                          <div className="progress-track">
                            <span
                              style={{ width: `${(p.used / p.quota) * 100}%` }}
                            />
                          </div>
                          {p.txHash && (
                            <a
                              className="small-link"
                              href={`${explorerUrl}/tx/${p.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View payment receipt <ArrowUpRight size={12} />
                            </a>
                          )}
                        </div>
                        <div className="permit-actions">
                          <button
                            className="primary"
                            disabled={Boolean(busy)}
                            onClick={() => access(p.id)}
                          >
                            Access dataset <ArrowRight size={14} />
                          </button>
                          <button
                            className="text-button danger"
                            disabled={p.revoked || Boolean(busy)}
                            onClick={() => revoke(p)}
                          >
                            Revoke access
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="fine-print">
                Revocation blocks future gateway requests. It cannot recall
                records that were already retrieved.
              </p>
            </>
          )}
          {view === "Publisher studio" && (
            <>
              <PageHeading
                label="TURN EXPERTISE INTO ACCESS"
                title="Publisher studio"
                description="Publish an original evaluation collection with a clear, versioned license."
              />
              <SponsorTools
                mode={mode}
                address={address}
                datasets={datasets}
                recordsText={recordsText}
              />
              <div className="studio-grid">
                <form
                  className="panel publish-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    register();
                  }}
                >
                  <div className="panel-heading">
                    <FileJson size={20} />
                    <h3>Dataset details</h3>
                    <span>01 / PUBLISH</span>
                  </div>
                  <label>
                    Dataset title
                    <input
                      required
                      minLength={5}
                      maxLength={100}
                      placeholder="e.g. Tamil customer support benchmark"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      required
                      minLength={20}
                      maxLength={1000}
                      rows={3}
                      placeholder="What does this dataset help an AI team evaluate?"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Language
                      <input
                        required
                        value={form.language}
                        onChange={(e) =>
                          setForm({ ...form, language: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Category
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm({ ...form, category: e.target.value })
                        }
                      >
                        {[
                          "Customer support",
                          "Language understanding",
                          "Agent safety",
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-row three">
                    <label>
                      Price ({mode === "demo" ? "demo credits" : symbol})
                      <input
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        required
                        value={form.price}
                        onChange={(e) =>
                          setForm({ ...form, price: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Access days
                      <input
                        type="number"
                        min={1}
                        max={365}
                        required
                        value={form.durationDays}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            durationDays: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Request allowance
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        required
                        value={form.quota}
                        onChange={(e) =>
                          setForm({ ...form, quota: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    License terms
                    <textarea
                      rows={3}
                      required
                      value={form.terms}
                      onChange={(e) =>
                        setForm({ ...form, terms: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    JSON records{" "}
                    <span className="label-help">
                      3–1,000 records · input, expected, category
                    </span>
                    <textarea
                      className="code-input"
                      rows={9}
                      required
                      value={recordsText}
                      onChange={(e) => setRecordsText(e.target.value)}
                    />
                  </label>
                  <label className="file-upload">
                    <Plus size={15} /> Import a JSON file
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2_000_000) {
                            setError("File must be under 2 MB.");
                            return;
                          }
                          file
                            .text()
                            .then(setRecordsText)
                            .catch(() => setError("Could not read file."));
                        }
                      }}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rights}
                      onChange={(e) => setRights(e.target.checked)}
                    />
                    I created these records or have permission to license them,
                    and the sample can be public.
                  </label>
                  <button
                    type="submit"
                    className="primary full"
                    disabled={Boolean(busy) || !rights}
                  >
                    {busy === "Publishing dataset" ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Publish dataset
                  </button>
                </form>
                <aside className="studio-aside">
                  <div className="panel">
                    <div className="eyebrow">A GOOD DATASET HAS</div>
                    <h3>
                      Useful data.
                      <br />
                      Honest expectations.
                    </h3>
                    <ul className="check-list">
                      <li>
                        <Check size={16} />
                        Original, permissioned records
                      </li>
                      <li>
                        <Check size={16} />A representative public sample
                      </li>
                      <li>
                        <Check size={16} />A clear evaluation rubric
                      </li>
                      <li>
                        <Check size={16} />
                        Specific licensing terms
                      </li>
                    </ul>
                    <p>
                      Records stay off-chain. A digest identifies the published
                      version; it does not prove quality or ownership.
                    </p>
                  </div>
                  <div className="studio-note">
                    <Lock size={19} />
                    <h4>
                      {mode === "demo"
                        ? "You’re publishing in demo mode"
                        : `Live publishing on ${appChain.name}`}
                    </h4>
                    <p>
                      {mode === "demo"
                        ? "Your collection is saved in this browser. Switch to live mode for shared storage and contract registration."
                        : "Registration requires a funded Mera account. Publish on a stable domain so your passkey remains usable."}
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {view === "Activity" && (
            <>
              <PageHeading
                label="A RECORD OF EVERY STEP"
                title="Workspace activity"
                description="Follow publications, permits, and dataset access in your current workspace."
              />
              {state.activity.length ? (
                <div className="panel timeline">
                  {state.activity.map((a) => (
                    <div className="timeline-item" key={a.id}>
                      <div className="timeline-icon">
                        <ActivityIcon size={17} />
                      </div>
                      <div>
                        <h3>{a.action}</h3>
                        <p>{a.detail}</p>
                      </div>
                      <time>{new Date(a.timestamp).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<ActivityIcon size={30} />}
                  title="A clean slate"
                  description={
                    mode === "demo"
                      ? "Publish a dataset or create a permit to start your activity history."
                      : "Live payment receipts appear under My permits. Gateway usage is stored in access_receipts."
                  }
                  action={() => setView("Discover")}
                  actionText="Explore datasets"
                />
              )}
            </>
          )}
          {view === "Developer" && (
            <>
              <PageHeading
                label="FROM PERMISSION TO YOUR PIPELINE"
                title="Developer workspace"
                description="Retrieve licensed records, inspect access, and evaluate an assistant response."
              />
              {mode === "live" && <AuroraFunding address={address} />}
              <section className="panel agent-panel">
                <div className="panel-heading">
                  <FlaskConical size={20} />
                  <h3>Dataset procurement agent</h3>
                  <span>HUMAN APPROVAL BEFORE PAYMENT</span>
                </div>
                <label>
                  What do you need to evaluate?
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Describe your AI evaluation goal"
                  />
                </label>
                <button
                  className="primary"
                  disabled={Boolean(busy) || mode === "demo"}
                  onClick={() =>
                    task("Finding a dataset", async () => {
                      const data = await api("/api/agent", json({ goal }));
                      setAgentResult(data);
                    })
                  }
                >
                  Find with Qwen <ArrowRight size={15} />
                </button>
                {mode === "demo" && (
                  <p className="fine-print">
                    Available in live mode with Qwen credentials. No model
                    response is fabricated in demo mode.
                  </p>
                )}
                {agentResult && (
                  <div className="evaluation-result">
                    <p>{agentResult.message}</p>
                    <div className="agent-trace">
                      {agentResult.trace.map((step, i) => (
                        <span className="badge green" key={i}>
                          {step.tool}
                        </span>
                      ))}
                    </div>
                    {agentResult.datasetId && (
                      <button
                        className="secondary"
                        onClick={() => {
                          const d = state.datasets.find(
                            (d) => d.id === agentResult.datasetId,
                          );
                          if (d) {
                            setSelected(d);
                            setAccepted(false);
                          }
                        }}
                      >
                        Review proposed license <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                )}
              </section>
              <div className="developer-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <Terminal size={20} />
                    <h3>Access playground</h3>
                  </div>
                  <label>
                    Choose a permit
                    <select
                      value={activePermit}
                      onChange={(e) => {
                        setActivePermit(e.target.value);
                        setResult(null);
                        setEvaluation(null);
                        setTokenVisible("");
                      }}
                    >
                      <option value="">Select a dataset permit</option>
                      {state.permits.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                          {p.revoked
                            ? " · revoked"
                            : p.provisioningStatus === "pending"
                              ? " · awaiting CRE"
                              : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary full"
                    disabled={!activePermit || Boolean(busy)}
                    onClick={() => access(activePermit)}
                  >
                    Send authenticated request <ArrowRight size={15} />
                  </button>
                  <div className="code-block">
                    <span>
                      {mode === "demo"
                        ? "LOCAL DEMO — NO NETWORK PAYMENT"
                        : "HTTP REQUEST"}
                    </span>
                    <pre>
                      {mode === "demo"
                        ? "checkPermit(permit)\nconsumeRequest(permit)\nreturn dataset.records"
                        : `curl "${typeof window !== "undefined" ? window.location.origin : ""}/api/access" \\\n  -H "Authorization: Bearer YOUR_TOKEN"`}
                    </pre>
                  </div>
                  {result && (
                    <div className="access-result">
                      <div className="result-heading">
                        <span className="badge green">
                          200 · Access granted
                        </span>
                        <span>{result.remaining} requests left</span>
                      </div>
                      <pre>{JSON.stringify(result.records, null, 2)}</pre>
                      <button
                        className="secondary full"
                        onClick={() =>
                          download(
                            `${currentPermit?.datasetId || "dataset"}.json`,
                            result.records,
                          )
                        }
                      >
                        Download retrieved records <FileJson size={15} />
                      </button>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <FlaskConical size={20} />
                    <h3>Response evaluation</h3>
                    <span>{mode === "demo" ? "MANUAL PREVIEW" : "QWEN"}</span>
                  </div>
                  <p className="panel-description">
                    Compare an assistant response with the first retrieved
                    record’s expected behavior.
                  </p>
                  {result && (
                    <div className="evaluation-prompt">
                      <span>TEST INPUT</span>
                      <p>{result.records[0]?.input}</p>
                    </div>
                  )}
                  <label>
                    Assistant response
                    <textarea
                      rows={5}
                      placeholder="Paste the response you want to evaluate…"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary full"
                    disabled={!result || Boolean(busy)}
                    onClick={() => evaluate()}
                  >
                    {mode === "demo"
                      ? "Show evaluation rubric"
                      : "Evaluate with Qwen"}
                    <FlaskConical size={15} />
                  </button>
                  {mode === "live" && (
                    <>
                      <label className="consent">
                        <input
                          type="checkbox"
                          checked={aiConsent}
                          onChange={(e) => setAiConsent(e.target.checked)}
                        />
                        I approve sending this licensed record to Qwen for
                        generation and evaluation.
                      </label>
                      <button
                        className="secondary full"
                        disabled={!result || Boolean(busy) || !aiConsent}
                        onClick={() => evaluate(true)}
                      >
                        Run licensed benchmark with Qwen
                      </button>
                    </>
                  )}
                  {evaluation && (
                    <div className="evaluation-result">
                      <span className="eyebrow">
                        {mode === "demo"
                          ? "MANUAL COMPARISON"
                          : `MODEL SCORE · ${evaluation.score}/100`}
                      </span>
                      <h3>{evaluation.verdict}</h3>
                      <p>{evaluation.reasoning}</p>
                    </div>
                  )}
                </section>
              </div>
              <section className="panel integration-panel">
                <div className="section-heading">
                  <div>
                    <h3>Integration readiness</h3>
                    <p>Configured does not mean deployed or live-verified.</p>
                  </div>
                  <a
                    className="small-link"
                    href="https://hackathon.monad.xyz/tracks"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hackathon tracks <ArrowUpRight size={14} />
                  </a>
                </div>
                <div className="integration-grid">
                  <Integration
                    name="Mera"
                    detail="Real PRF passkey accounts and signing"
                    status="Implemented · device test required"
                  />
                  <Integration
                    name="Mera non-wallet keys"
                    detail="PRF-derived encryption and publisher recovery"
                    status={
                      health?.encryption
                        ? "Configured · verify passkey recovery"
                        : "Needs DATA_ENCRYPTION_KEY"
                    }
                  />
                  <Integration
                    name="Alchemy"
                    detail="Receipt verification and account balances"
                    status={
                      health?.alchemy
                        ? "Configured · verify RPC"
                        : "Needs Alchemy Monad RPC"
                    }
                  />
                  <Integration
                    name="Kimi"
                    detail="Consented dataset quality review"
                    status={
                      health?.kimi
                        ? "Configured · verify model access"
                        : "Needs API key & model"
                    }
                  />
                  <Integration
                    name="Chainlink CRE"
                    detail="Receipt checks and recorded access provisioning"
                    status={
                      health?.cre
                        ? "Gate enabled · verify workflow"
                        : "Workflow source ready · needs deployment"
                    }
                  />
                  <Integration
                    name="Aurora Intents"
                    detail="Cross-chain funding to passkey account"
                    status={
                      health?.aurora
                        ? "Configured · verify settlement"
                        : "Needs mainnet & supported token"
                    }
                  />
                  <Integration
                    name="Monad contract"
                    detail="ERC-20 payments and revocable permits"
                    status={
                      health?.contract
                        ? "Configured · verify deployment"
                        : "Needs deployment & token"
                    }
                  />
                  <Integration
                    name="Supabase"
                    detail="Persistent catalog and atomic quotas"
                    status={
                      health?.storage
                        ? "Configured · verify schema"
                        : "Needs project & schema"
                    }
                  />
                  <Integration
                    name="Envio"
                    detail="Indexed purchase and revocation receipts"
                    status={
                      health?.envio
                        ? "Configured · verify indexer"
                        : "Needs deployed indexer"
                    }
                  />
                  <Integration
                    name="Qwen"
                    detail="Tool-based procurement and evaluation"
                    status={
                      health?.qwen
                        ? "Configured · verify model access"
                        : "Needs API key, URL & model"
                    }
                  />
                </div>
                <div className="integration-note">
                  <BookOpen size={18} />
                  <p>
                    Follow README.md for database, contract, and Vercel setup.
                    Envio and CRE run separately from Vercel. Live sponsor
                    credentials, workflow deployment, and real settlement
                    evidence are still required.
                  </p>
                </div>
              </section>
            </>
          )}
          {view === "Activity" && mode === "live" && health?.envio && (
            <section className="panel indexed-panel">
              <h3>Envio settlement receipts</h3>
              <p className="fine-print">
                Contract purchases and revocations indexed by HyperIndex. These
                receipts do not replace gateway authorization.
              </p>
              {indexed.length ? (
                indexed.map((p) => (
                  <div className="indexed-row" key={p.id}>
                    <span>Permit #{p.permitId}</span>
                    <span>{p.revoked ? "Revoked" : "Purchased"}</span>
                    <a
                      className="small-link"
                      target="_blank"
                      rel="noreferrer"
                      href={`${explorerUrl}/tx/${p.txHash}`}
                    >
                      Transaction <ArrowUpRight size={12} />
                    </a>
                  </div>
                ))
              ) : (
                <p className="fine-print">
                  No indexed purchases available yet. Check the indexer
                  configuration and sync status.
                </p>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              DataPermit <span>© 2026</span>
            </span>
            <span>Good data deserves clear permission.</span>
            <button onClick={() => task("Resetting demo", reset)}>
              {mode === "demo" ? "Reset demo" : "Sign out to demo"}{" "}
              <ArrowUpRight size={12} />
            </button>
          </footer>
        </div>
      </main>
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle size={17} className="spin" />
          {busy}…
        </div>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setSelected(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dataset-title"
            className="modal detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setSelected(null)}
              aria-label="Close dataset"
            >
              <X size={20} />
            </button>
            <span className="category-tag">{selected.category}</span>
            <h2 id="dataset-title">{selected.title}</h2>
            <p className="modal-description">{selected.description}</p>
            <div className="detail-metrics">
              <span>
                <Globe size={16} />
                {selected.language}
              </span>
              <span>
                <FileJson size={16} />v{selected.version}
              </span>
              <span>
                <KeyRound size={16} />
                {selected.quota} requests
              </span>
            </div>
            <div className="detail-section">
              <div className="eyebrow">
                PUBLIC SAMPLE · {Math.min(2, selected.records.length)} RECORDS
              </div>
              {selected.records.slice(0, 2).map((r, i) => (
                <div className="sample-record" key={i}>
                  <span>{r.category}</span>
                  <p>{r.input}</p>
                  <small>Expected: {r.expected}</small>
                </div>
              ))}
            </div>
            <div className="detail-section">
              <div className="eyebrow">LICENSE TERMS</div>
              <p className="terms">{selected.terms}</p>
              <p className="fine-print">
                Publisher: {short(selected.publisher)} · {selected.durationDays}
                -day access
                {selected.digest && <> · SHA-256: {short(selected.digest)}</>}
              </p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I accept the terms for dataset version {selected.version}.
            </label>
            <div className="checkout">
              <div>
                <strong>{selected.price}</strong>{" "}
                {mode === "demo" ? "demo credits" : symbol}
                <small>One permit · {selected.durationDays} days</small>
              </div>
              <button
                className="primary"
                disabled={!accepted || Boolean(busy)}
                onClick={purchase}
              >
                {mode === "demo" ? "Create demo permit" : "Pay & get access"}
                <ArrowRight size={16} />
              </button>
            </div>
            {receipt && (
              <div className="receipt-retry">
                <p>
                  Payment submitted: {short(receipt)}. If import failed, retry
                  after confirmation.
                </p>
                <button
                  className="secondary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    task("Importing receipt", () =>
                      importReceipt(selected, receipt),
                    )
                  }
                >
                  Retry receipt import
                </button>
              </div>
            )}
            <p className="fine-print">
              {mode === "demo"
                ? "Demo runs locally in your browser. No blockchain payment or AI call is simulated as real."
                : `You approve the token amount, then purchase on ${appChain.name}. Gas requires MON.`}
            </p>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
      {accountModal && (
        <div className="modal-backdrop" onClick={() => setAccountModal(false)}>
          <section
            className="modal account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setAccountModal(false)}
              aria-label="Close account"
            >
              <X size={20} />
            </button>
            <div className="account-icon">
              <KeyRound size={29} />
            </div>
            <h2 id="account-title">
              One passkey.
              <br />
              Your data workspace.
            </h2>
            <p>
              Use Mera to create or recover a Monad account. Requires a
              PRF-capable passkey provider and a configured backend.
            </p>
            <button
              className="primary full"
              disabled={Boolean(busy)}
              onClick={() => signIn(false)}
            >
              Sign in with passkey <ArrowRight size={16} />
            </button>
            <button
              className="secondary full"
              disabled={Boolean(busy)}
              onClick={() => signIn(true)}
            >
              Create a new passkey <Plus size={16} />
            </button>
            <button
              className="text-button full"
              onClick={() => {
                setAccountModal(false);
                if (mode === "live") task("Signing out", reset);
              }}
            >
              Continue in demo workspace
            </button>
            <p className="fine-print">
              Create passkeys on your stable deployment domain. Keys are held
              only in memory and cleared at sign-out or after 10 minutes.
            </p>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function PageHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow muted">{label}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="panel metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function Empty({
  icon,
  title,
  description,
  action,
  actionText,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: () => void;
  actionText: string;
}) {
  return (
    <div className="empty panel">
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="primary" onClick={action}>
        {actionText}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function Integration({
  name,
  detail,
  status,
}: {
  name: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="integration">
      <strong>{name}</strong>
      <p>{detail}</p>
      <span>{status}</span>
    </div>
  );
}
