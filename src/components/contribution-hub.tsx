"use client";
import { useEffect, useState, useRef } from "react";
import {
  Car,
  Bus,
  Bike,
  Plane,
  Apple,
  Cherry,
  Grape,
  Citrus,
  Sun,
  Moon,
  Cloud,
  TreePine,
  Cat,
  Dog,
  Fish,
  Bird,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
} from "lucide-react";
import { wallet } from "@/lib/wallet";
import {
  freshContributions,
  seedQuestions,
  languageNames,
  languages,
  copy,
  instruction,
  scoreSelection,
  validateAnswers,
  answerSchema,
  campaignInput,
  contentHash,
  submissionMessage,
  reviewMessage,
  createReviewedExport,
  demoCompany,
  demoParticipant,
  demoExpert,
  type ContributionState,
  type Campaign,
  type Question,
  type Language,
  type Answer,
  type Cluster,
  type ReviewedExport,
} from "@/lib/contributions";
import type { RecordRow } from "@/lib/types";
const icons = {
  car: Car,
  bus: Bus,
  bike: Bike,
  plane: Plane,
  apple: Apple,
  cherry: Cherry,
  grape: Grape,
  citrus: Citrus,
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  tree: TreePine,
  cat: Cat,
  dog: Dog,
  fish: Fish,
  bird: Bird,
};
async function api(body?: unknown, id?: string) {
  const response = await fetch(
    "/api/contributions" + (id ? "?campaign=" + encodeURIComponent(id) : ""),
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function ImageGrid({
  question,
  selected,
  onChange,
  disabled = false,
}: {
  question: Question;
  selected: number[];
  onChange: (a: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="annotation-grid"
      role="group"
      aria-label="4 by 4 image selection grid"
    >
      {question.cells.map((cell, i) => {
        const Icon = icons[cell.key];
        return (
          <button
            type="button"
            className={`image-tile ${selected.includes(i) ? "selected" : ""} color-${Math.floor(Object.keys(icons).indexOf(cell.key) / 4)}`}
            aria-label={`Image ${i + 1}: ${cell.key}`}
            aria-pressed={selected.includes(i)}
            disabled={disabled}
            key={i}
            onClick={() =>
              onChange(
                selected.includes(i)
                  ? selected.filter((j) => j !== i)
                  : [...selected, i],
              )
            }
          >
            {cell.url ? (
              <img src={cell.url} alt={cell.key} referrerPolicy="no-referrer" />
            ) : (
              <Icon aria-hidden="true" size={42} strokeWidth={1.7} />
            )}
            <span className="tile-index">{i + 1}</span>
            {selected.includes(i) && <Check className="tile-check" size={15} />}
          </button>
        );
      })}
    </div>
  );
}
export function ContributionHub({
  mode,
  address,
  onPublish,
}: {
  mode: string;
  address: string;
  onPublish: (
    rows: RecordRow[],
    title: string,
    contributors: string[],
    verifiers: string[],
  ) => void;
}) {
  const stopClustering = useRef(false);
  const activeScope = useRef("");
  const [state, setState] = useState<ContributionState>(freshContributions);
  const [ready, setReady] = useState(false);
  const [campaignId, setCampaignId] = useState("demo-image-campaign");
  const [tab, setTab] = useState<"contribute" | "company" | "expert">(
    "contribute",
  );
  const [language, setLanguage] = useState<Language>("en");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [practice, setPractice] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("");
  const [questionId, setQuestionId] = useState("q01");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [experts, setExperts] = useState("");
  const [customQuestions, setCustomQuestions] =
    useState<Question[]>(seedQuestions);
  const [rights, setRights] = useState(false);
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  const q = campaign?.questions[index];
  const t = copy[language];
  const companyIdentity = mode === "demo" ? demoCompany : address.toLowerCase();
  const participantIdentity =
    mode === "demo" ? demoParticipant : address.toLowerCase();
  const expertIdentity = mode === "demo" ? demoExpert : address.toLowerCase();
  const company = campaign?.company === companyIdentity;
  const expert = !!campaign?.verifiers.includes(expertIdentity);
  const submissions = state.submissions.filter(
    (s) => s.campaign_id === campaignId,
  );
  const clusters = state.clusters.filter((c) => c.campaign_id === campaignId);
  const reviews = state.reviews.filter((r) => r.campaign_id === campaignId);
  const ownSubmission = submissions.find(
    (s) => s.participant === participantIdentity,
  );
  const draftKey = `datapermit.contribution-draft.${mode}.${participantIdentity}.${campaignId}`;
  activeScope.current = `${mode}:${address}:${campaignId}`;
  useEffect(
    () => () => {
      stopClustering.current = true;
    },
    [],
  );
  useEffect(() => {
    if (mode === "demo") {
      try {
        const saved = localStorage.getItem("datapermit.contributions.v1");
        if (saved) setState(JSON.parse(saved));
        else setState(freshContributions());
      } catch {
        setState(freshContributions());
      }
      setCampaignId("demo-image-campaign");
      setReady(true);
    } else {
      setState({
        campaigns: [],
        submissions: [],
        clusters: [],
        reviews: [],
        exports: [],
      });
      api()
        .then((data) => {
          if (!activeScope.current.startsWith(`${mode}:${address}:`)) return;
          setState((s) => ({ ...s, campaigns: data.campaigns }));
          setCampaignId(data.campaigns[0]?.id || "");
          setReady(true);
        })
        .catch((e) => {
          setMessage(e.message);
          setReady(true);
        });
    }
  }, [mode, address]);
  useEffect(() => {
    if (ready && mode === "demo")
      localStorage.setItem(
        "datapermit.contributions.v1",
        JSON.stringify(state),
      );
  }, [ready, state, mode]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      const draft = raw ? JSON.parse(raw) : [];
      setAnswers(draft);
      setIndex(0);
      setSelected(
        draft.find((a: Answer) => a.questionId === "q01")?.selected || [],
      );
      setText(draft.find((a: Answer) => a.questionId === "q01")?.text || "");
      setConsent(false);
    } catch {
      setAnswers([]);
    }
    if (mode === "live" && campaignId)
      refresh().catch((e) => setMessage(e.message));
  }, [draftKey]);
  useEffect(() => {
    if (ownSubmission) {
      setAnswers(ownSubmission.answers);
      const saved = ownSubmission.answers.find(
        (a) => a.questionId === campaign?.questions[index]?.id,
      );
      if (saved) {
        setSelected(saved.selected);
        setText(saved.text);
        setLanguage(saved.language);
      }
    }
  }, [ownSubmission?.id]);
  async function refresh() {
    const scope = activeScope.current;
    const data = await api(undefined, campaignId);
    if (scope !== activeScope.current) return;
    setState((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) =>
        c.id === campaignId ? data.campaign : c,
      ),
      submissions: data.submissions,
      clusters: data.clusters,
      reviews: data.reviews,
    }));
  }
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy("");
    }
  }
  function move(next: number, save = false) {
    if (!q) return;
    let updated = answers;
    if (save) {
      const answer = answerSchema.parse({
        questionId: q.id,
        selected,
        text,
        language,
      });
      updated = [...answers.filter((a) => a.questionId !== q.id), answer];
      setAnswers(updated);
      localStorage.setItem(draftKey, JSON.stringify(updated));
    }
    const nextQ = campaign!.questions[next],
      saved = updated.find((a) => a.questionId === nextQ.id);
    setIndex(next);
    setSelected(saved?.selected || []);
    setText(saved?.text || "");
    if (saved) setLanguage(saved.language);
  }
  async function submit() {
    if (!campaign || !q) return;
    if (!consent)
      throw new Error("Approve contribution consent before submitting.");
    const all = validateAnswers(campaign.questions, [
      ...answers.filter((a) => a.questionId !== q.id),
      { questionId: q.id, selected, text, language },
    ]);
    if (mode === "demo") {
      if (campaign.status !== "open") throw new Error("Campaign is closed.");
      if (ownSubmission)
        throw new Error("Your contribution was already submitted.");
      setState((s) => ({
        ...s,
        submissions: [
          ...s.submissions,
          {
            id: crypto.randomUUID(),
            campaign_id: campaign.id,
            participant: demoParticipant,
            answers: all,
            signature: "demo-not-a-wallet-signature",
            created_at: new Date().toISOString(),
          },
        ],
      }));
    } else {
      const signature = await wallet().signMessage({
        message: submissionMessage(campaign.id, await contentHash(all)),
      });
      await api({
        action: "submit",
        campaignId: campaign.id,
        answers: all,
        consent: true,
        signature,
      });
      await refresh();
    }
    setAnswers(all);
    localStorage.removeItem(draftKey);
    setMessage(
      "All 50 answers submitted to the requesting company. Awaiting clustering and expert review.",
    );
  }
  async function clusterQuestion(id: string) {
    if (!campaign || !company)
      throw new Error("Company ownership is required.");
    if (!aiConsent && mode === "live")
      throw new Error("Approve sending answers to Qwen first.");
    if (!submissions.length) throw new Error("No complete submissions yet.");
    if (clusters.some((c) => c.question_id === id)) return;
    if (mode === "demo") {
      const buckets = new Map<string, string[]>();
      for (const s of submissions) {
        const a = s.answers.find((a) => a.questionId === id)!;
        const key =
          a.language + ":" + [...a.selected].sort((x, y) => x - y).join(",");
        buckets.set(key, [...(buckets.get(key) || []), s.id]);
      }
      const next: Cluster[] = [];
      for (const [key, members] of buckets) {
        const record = {
          id: crypto.randomUUID(),
          campaign_id: campaign.id,
          question_id: id,
          title: "Matching image selections",
          summary:
            "Local grouping by language and image selection. Semantic Qwen clustering is available only in live mode.",
          language: key.split(":")[0] as Language,
          members,
          provider: "Local demo",
          model: "Deterministic grouping",
          created_at: new Date().toISOString(),
        };
        next.push({ ...record, content_hash: await contentHash(record) });
      }
      setState((s) => ({
        ...s,
        campaigns: s.campaigns.map((c) =>
          c.id === campaign.id ? { ...c, status: "closed" } : c,
        ),
        clusters: [...s.clusters, ...next],
      }));
    } else {
      await api({
        action: "cluster",
        campaignId: campaign.id,
        questionId: id,
        consent: true,
      });
      await refresh();
    }
  }
  async function reviewCluster(
    cluster: Cluster,
    decision: "accepted" | "rejected",
  ) {
    if (
      !campaign ||
      !expert ||
      campaign.company === expertIdentity ||
      submissions.some((s) => s.participant === expertIdentity)
    )
      throw new Error("An assigned independent expert must review.");
    const notes = (reviewNotes[cluster.id] || "").trim();
    if (notes.length < 5)
      throw new Error("Add review notes (at least 5 characters).");
    if (mode === "demo")
      setState((s) => ({
        ...s,
        reviews: [
          ...s.reviews,
          {
            id: crypto.randomUUID(),
            campaign_id: campaign.id,
            cluster_id: cluster.id,
            verifier: demoExpert,
            decision,
            notes,
            signature: "demo-not-a-wallet-signature",
            created_at: new Date().toISOString(),
          },
        ],
      }));
    else {
      const signature = await wallet().signMessage({
        message: reviewMessage(
          campaign.id,
          cluster.id,
          cluster.content_hash,
          decision,
          notes,
        ),
      });
      await api({
        action: "review",
        campaignId: campaign.id,
        clusterId: cluster.id,
        decision,
        notes,
        signature,
      });
      await refresh();
    }
    setMessage(
      "Expert decision recorded. The original answers remain unchanged.",
    );
  }
  async function exportData(publish = false) {
    if (!campaign || !company)
      throw new Error(
        "Only the requesting company can export approved results.",
      );
    const output: ReviewedExport =
      mode === "demo"
        ? await createReviewedExport(campaign, submissions, clusters, reviews)
        : await api({ action: "export", campaignId: campaign.id });
    if (publish) {
      const rows = (
        output.rows as Array<{ question: Question; answer: Answer }>
      ).map((r) => ({
        input: JSON.stringify({
          questionId: r.question.id,
          instruction: instruction(r.question, r.answer.language),
          cells: r.question.cells,
        }),
        expected: JSON.stringify({
          selected: r.answer.selected,
          explanation: r.answer.text,
          language: r.answer.language,
        }),
        category: "Human-reviewed image annotation",
      }));
      if (rows.length < 3)
        throw new Error(
          "Accept at least 3 answers before preparing a marketplace dataset.",
        );
      onPublish(rows, campaign.title, output.contributors, output.verifiers);
    } else download(campaign.id + "-reviewed-answers.json", output);
  }
  return (
    <section className="contribution-hub">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FROM HUMAN KNOWLEDGE TO LICENSED DATA</span>
          <h1>Contribution studio</h1>
          <p>
            Company questions → image selections and written answers → clusters
            → expert review → versioned dataset.
          </p>
        </div>
      </div>
      <div className="contribution-toolbar">
        <label>
          Campaign
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Choose a campaign</option>
            {state.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {c.status}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.language}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {languages.map((l) => (
              <option value={l} key={l}>
                {languageNames[l]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          onClick={() =>
            mode === "demo"
              ? setMessage("Local demo is current.")
              : run("Refreshing", refresh)
          }
        >
          Refresh campaign
        </button>
      </div>
      <div
        className="contribution-tabs"
        role="tablist"
        aria-label="Contribution workflow"
      >
        {(["contribute", "company", "expert"] as const).map((v) => (
          <button
            role="tab"
            aria-selected={tab === v}
            key={v}
            onClick={() => {
              setTab(v);
              setMessage("");
            }}
          >
            {v === "contribute"
              ? "Answer questions"
              : v === "company"
                ? "Company workspace"
                : "Expert verification"}
          </button>
        ))}
      </div>
      {mode === "demo" && (
        <p className="demo-role">
          LOCAL DEMO · Each tab simulates a distinct company, contributor, or
          expert wallet. No AI calls, payments, or transactions occur.
        </p>
      )}
      {busy && <p role="status">{busy}…</p>}
      {message && (
        <div className="contribution-message" role="status">
          {message}
        </div>
      )}
      {tab === "contribute" && campaign && q && (
        <>
          <div className="campaign-summary panel">
            <h3>{campaign.title}</h3>
            <p>{campaign.brief}</p>
            <p className="fine-print">
              Company: <code>{campaign.company}</code> · 50 questions · 16
              images each. Illustrations are starter assets; companies can
              import their own image questions. This is an annotation task, not
              a security CAPTCHA. No model is trained automatically.
            </p>
          </div>
          <details className="panel practice-panel">
            <summary>{t.practice}</summary>
            <p>{instruction(seedQuestions()[0], language)}</p>
            <ImageGrid
              question={seedQuestions()[0]}
              selected={practice}
              onChange={setPractice}
            />
            <button
              className="secondary"
              onClick={() => {
                const score = scoreSelection(seedQuestions()[0], practice);
                setFeedback(
                  score === 100
                    ? "✓ All four vehicle illustrations selected. You are ready to contribute."
                    : `${score}% cell decisions match. Select the car, bus, bike, and plane; leave other illustrations unselected.`,
                );
              }}
            >
              {t.check}
            </button>
            {feedback && <p role="status">{feedback}</p>}
          </details>
          <div className="annotation-workspace panel" lang={language}>
            <div className="question-progress">
              <span>
                {t.question} {index + 1} / 50
              </span>
              <span>
                {answers.length} / 50 {t.saved}
              </span>
            </div>
            <progress
              value={answers.length}
              max={50}
              aria-label="Saved answers"
            />
            <h2>{instruction(q, language)}</h2>
            {q.prompts && language !== "en" && !q.prompts[language] && (
              <p className="fine-print">
                The company supplied this question in English. Your answer
                language remains {languageNames[language]}.
              </p>
            )}
            {q.instruction && <p>{q.instruction}</p>}
            <ImageGrid
              question={q}
              selected={selected}
              onChange={setSelected}
              disabled={!!ownSubmission || campaign.status !== "open" || !!busy}
            />
            <label>
              {t.answer}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={800}
                disabled={!!ownSubmission || campaign.status !== "open"}
                placeholder={
                  language === "en"
                    ? "Describe the visual features that informed your choice."
                    : ""
                }
              />
            </label>
            <div className="question-navigation">
              <button
                className="secondary"
                disabled={index === 0 || !!busy}
                onClick={() => move(index - 1)}
              >
                <ChevronLeft size={16} />
                {t.back}
              </button>
              <label>
                Jump to question
                <select
                  value={index}
                  onChange={(e) => move(Number(e.target.value))}
                >
                  {campaign.questions.map((q, i) => (
                    <option key={q.id} value={i}>
                      {i + 1}
                      {answers.some((a) => a.questionId === q.id) ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={
                  !!ownSubmission || campaign.status !== "open" || !!busy
                }
                onClick={() =>
                  run("Saving answer", async () =>
                    move(Math.min(49, index + 1), true),
                  )
                }
              >
                {t.next}
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="fine-print">
              Answers are saved on this browser when you click Save & next. Save
              before jumping to another question. Your original answer language
              is retained.
            </p>
            {ownSubmission ? (
              <div className="submitted-banner">
                <ShieldCheck size={20} />
                50 answers submitted ·{" "}
                {new Date(ownSubmission.created_at).toLocaleString(language, {
                  timeZone: "Asia/Kolkata",
                })}
              </div>
            ) : (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {t.consent}
                </label>
                <button
                  className="primary full"
                  disabled={
                    !!busy ||
                    campaign.status !== "open" ||
                    !consent ||
                    answers.length < 49
                  }
                  onClick={() => run("Submitting signed answers", submit)}
                >
                  {t.submit}
                </button>
              </>
            )}
          </div>
        </>
      )}
      {tab === "company" && (
        <>
          <section className="panel campaign-create">
            <h3>Request a 50-question collection</h3>
            <p>
              Use the original illustration template or import exactly 50 image
              questions as JSON. Assign independent expert wallets before
              collecting answers.
            </p>
            <label>
              Campaign title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Regional image understanding study"
              />
            </label>
            <label>
              Company brief
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Describe what contributors should explain and how your company will use the answers."
              />
            </label>
            <label>
              Assigned expert wallets (comma-separated)
              <input
                value={experts}
                onChange={(e) => setExperts(e.target.value)}
                placeholder={mode === "demo" ? demoExpert : "0x…"}
              />
            </label>
            <div className="campaign-import">
              <button
                className="secondary"
                onClick={() =>
                  download("50-image-questions.json", seedQuestions())
                }
              >
                Download question template
              </button>
              <label className="secondary">
                Import 50-question JSON
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      run("Importing questions", async () => {
                        const questions = JSON.parse(await file.text());
                        const result =
                          campaignInput.shape.questions.parse(questions);
                        setCustomQuestions(result);
                        setMessage(
                          "50 questions imported. HTTPS image URLs override the illustration assets.",
                        );
                      });
                  }}
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rights}
                onChange={(e) => setRights(e.target.checked)}
              />
              I have permission to use these images and will honor the
              participants’ contribution terms.
            </label>
            <button
              className="primary"
              disabled={!!busy || !rights}
              onClick={() =>
                run("Creating campaign", async () => {
                  const data = campaignInput.parse({
                    title,
                    brief,
                    verifiers: (experts || (mode === "demo" ? demoExpert : ""))
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    questions: customQuestions,
                  });
                  if (data.verifiers.includes(companyIdentity))
                    throw new Error("Use an independent expert wallet.");
                  if (mode === "demo") {
                    const next = {
                      ...data,
                      id: crypto.randomUUID(),
                      company: demoCompany,
                      status: "open" as const,
                    };
                    setState((s) => ({
                      ...s,
                      campaigns: [...s.campaigns, next],
                    }));
                    setCampaignId(next.id);
                  } else {
                    const result = await api({ action: "create", ...data });
                    const all = await api();
                    setState((s) => ({ ...s, campaigns: all.campaigns }));
                    setCampaignId(result.id);
                  }
                  setTitle("");
                  setBrief("");
                  setRights(false);
                  setMessage(
                    "Campaign created. Contributors can start answering.",
                  );
                })
              }
            >
              Create campaign
            </button>
          </section>
          {campaign && (
            <section className="panel campaign-results">
              <h3>Company results · {campaign.title}</h3>
              <p>
                {submissions.length} complete submissions ·{" "}
                {new Set(clusters.map((c) => c.question_id)).size}/50 questions
                clustered ·{" "}
                {reviews.filter((r) => r.decision === "accepted").length}{" "}
                accepted clusters
              </p>
              {!company ? (
                <p>
                  Connect the company wallet to view, cluster, or export these
                  results.
                </p>
              ) : (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={aiConsent}
                      onChange={(e) => setAiConsent(e.target.checked)}
                    />
                    I approve sending submitted answers to Qwen. Starting
                    clustering closes this campaign to new submissions.
                  </label>
                  <label>
                    Question
                    <select
                      value={questionId}
                      onChange={(e) => setQuestionId(e.target.value)}
                    >
                      {campaign.questions.map((q) => (
                        <option value={q.id} key={q.id}>
                          {q.id}
                          {clusters.some((c) => c.question_id === q.id)
                            ? " · clustered"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary"
                    disabled={
                      !!busy ||
                      !submissions.length ||
                      (mode === "live" && !aiConsent)
                    }
                    onClick={() =>
                      run(
                        mode === "demo"
                          ? "Grouping locally"
                          : "Clustering with Qwen",
                        () => clusterQuestion(questionId),
                      )
                    }
                  >
                    {mode === "demo"
                      ? "Group question locally"
                      : "Cluster question with Qwen"}
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      !!busy ||
                      !submissions.length ||
                      (mode === "live" && !aiConsent)
                    }
                    onClick={() =>
                      run("Clustering all 50 questions", async () => {
                        stopClustering.current = false;
                        for (const q of campaign.questions) {
                          if (stopClustering.current) break;
                          setBusy("Clustering " + q.id + " of 50");
                          await clusterQuestion(q.id);
                        }
                        setMessage(
                          stopClustering.current
                            ? "Clustering stopped. Completed questions are saved; run again to resume."
                            : "All questions grouped. Assigned experts can now review clusters.",
                        );
                      })
                    }
                  >
                    Cluster all 50 questions
                  </button>
                  {busy.startsWith("Clustering") && (
                    <button
                      className="secondary"
                      onClick={() => {
                        stopClustering.current = true;
                      }}
                    >
                      Stop after current question
                    </button>
                  )}
                  <div className="company-answer-list">
                    {submissions.map((s) => (
                      <details key={s.id}>
                        <summary>{s.participant} · 50 signed answers</summary>
                        {s.answers.map((a) => (
                          <article key={a.questionId}>
                            <strong>
                              {a.questionId} · {languageNames[a.language]}
                            </strong>
                            <p>
                              Images: {a.selected.map((i) => i + 1).join(", ")}
                            </p>
                            <p lang={a.language}>{a.text}</p>
                            <small>Signature: {s.signature}</small>
                          </article>
                        ))}
                      </details>
                    ))}
                  </div>
                  <button
                    className="secondary"
                    disabled={
                      !!busy || !reviews.some((r) => r.decision === "accepted")
                    }
                    onClick={() =>
                      run("Exporting reviewed results", () => exportData())
                    }
                  >
                    <Download size={16} />
                    Download approved answers & provenance
                  </button>
                  <button
                    className="primary"
                    disabled={
                      !!busy || !reviews.some((r) => r.decision === "accepted")
                    }
                    onClick={() =>
                      run("Preparing dataset", () => exportData(true))
                    }
                  >
                    Prepare reviewed dataset for publishing
                  </button>
                  <p className="fine-print">
                    Only accepted answers enter the export. Download the
                    provenance file for your audit trail. Publishing stores
                    version hashes, company ownership, and the payout split
                    on-chain; individual responses and reviews remain off-chain.
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}
      {tab === "expert" && campaign && (
        <section className="panel expert-workspace">
          <h3>Question-by-question expert verification</h3>
          <p>
            Inspect each image set, original response, and Qwen grouping. Accept
            or reject the entire cluster with a signed explanation. Reviews are
            immutable; company and contributor wallets cannot verify their own
            campaign.
          </p>
          {!expert ? (
            <p>Connect an assigned expert wallet to review this campaign.</p>
          ) : (
            <>
              <label>
                Question
                <select
                  value={questionId}
                  onChange={(e) => setQuestionId(e.target.value)}
                >
                  {campaign.questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.id} ·{" "}
                      {clusters.filter((c) => c.question_id === q.id).length}{" "}
                      clusters
                    </option>
                  ))}
                </select>
              </label>
              {clusters
                .filter((c) => c.question_id === questionId)
                .map((cluster) => {
                  const review = reviews.find(
                    (r) => r.cluster_id === cluster.id,
                  );
                  const question = campaign.questions.find(
                    (q) => q.id === cluster.question_id,
                  )!;
                  return (
                    <article className="expert-cluster" key={cluster.id}>
                      <span className="eyebrow">
                        {cluster.provider} · {languageNames[cluster.language]} ·{" "}
                        {cluster.members.length} answers
                      </span>
                      <h3>{cluster.title}</h3>
                      <p>{cluster.summary}</p>
                      <p>{instruction(question, cluster.language)}</p>
                      <ImageGrid
                        question={question}
                        selected={[]}
                        onChange={() => {}}
                        disabled
                      />
                      {cluster.members.map((id) => {
                        const submission = submissions.find((s) => s.id === id);
                        const answer = submission?.answers.find(
                          (a) => a.questionId === cluster.question_id,
                        );
                        return (
                          answer && (
                            <div className="expert-answer" key={id}>
                              <code>{submission!.participant}</code>
                              <p>
                                Selected images:{" "}
                                {answer.selected.map((i) => i + 1).join(", ")}
                              </p>
                              <p lang={answer.language}>{answer.text}</p>
                              <small>
                                Original submission: {submission!.id}
                              </small>
                            </div>
                          )
                        );
                      })}
                      {review ? (
                        <div className="review-decision">
                          <strong>{review.decision.toUpperCase()}</strong>
                          <p>{review.notes}</p>
                          <code>{review.verifier}</code>
                        </div>
                      ) : (
                        <>
                          <label>
                            Expert decision notes
                            <textarea
                              value={reviewNotes[cluster.id] || ""}
                              onChange={(e) =>
                                setReviewNotes((n) => ({
                                  ...n,
                                  [cluster.id]: e.target.value,
                                }))
                              }
                              placeholder="Explain accuracy, ambiguity, and whether these answers are usable."
                              maxLength={1000}
                            />
                          </label>
                          <button
                            className="primary"
                            disabled={!!busy}
                            onClick={() =>
                              run("Signing expert acceptance", () =>
                                reviewCluster(cluster, "accepted"),
                              )
                            }
                          >
                            Accept cluster
                          </button>
                          <button
                            className="secondary"
                            disabled={!!busy}
                            onClick={() =>
                              run("Signing expert rejection", () =>
                                reviewCluster(cluster, "rejected"),
                              )
                            }
                          >
                            Reject cluster
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
              {!clusters.some((c) => c.question_id === questionId) && (
                <p>
                  No clusters yet for this question. The company must run
                  clustering first.
                </p>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
