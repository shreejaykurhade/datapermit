import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seedQuestions,
  validateAnswers,
  validateClusters,
  scoreSelection,
  imageGroup,
  freshContributions,
  createReviewedExport,
  demoParticipant,
  demoExpert,
  type Submission,
  type Cluster,
  type Review,
} from "../src/lib/contributions";
import { validateShares, allocateRevenue } from "../src/lib/revenue";
test("50 image questions have 4x4 grids, complete answers and unique layouts", () => {
  const questions = seedQuestions();
  assert.equal(questions.length, 50);
  assert.equal(new Set(questions.map((q) => JSON.stringify(q.cells))).size, 50);
  for (const q of questions) {
    assert.equal(q.cells.length, 16);
    const correct = q.cells.flatMap((c, i) =>
      imageGroup(c.key) === q.target ? [i] : [],
    );
    assert.equal(scoreSelection(q, correct), 100);
  }
  const answers = questions.map((q) => ({
    questionId: q.id,
    selected: [0],
    text: "My original answer",
    language: "mr" as const,
  }));
  assert.equal(validateAnswers(questions, answers).length, 50);
  assert.throws(() => validateAnswers(questions, answers.slice(1)));
  assert.throws(() =>
    validateAnswers(questions, [...answers.slice(1), answers[1]]),
  );
  assert.throws(() =>
    validateAnswers(
      questions,
      answers.map((a) => ({ ...a, selected: [0, 0] })),
    ),
  );
});
test("cluster memberships cannot omit, duplicate or invent responses or mix languages", () => {
  const submissions = [
    {
      id: "one",
      answers: [
        {
          questionId: "q01",
          selected: [0],
          text: "Answer one",
          language: "en",
        },
      ],
    },
    {
      id: "two",
      answers: [
        { questionId: "q01", selected: [1], text: "उत्तर", language: "mr" },
      ],
    },
  ] as Submission[];
  const valid = [
    {
      title: "First cluster",
      summary: "A meaning-based group",
      language: "en",
      members: ["one"],
    },
    {
      title: "Second cluster",
      summary: "A second language group",
      language: "mr",
      members: ["two"],
    },
  ];
  assert.equal(validateClusters(valid, submissions, "q01").length, 2);
  assert.throws(() => validateClusters(valid.slice(1), submissions, "q01"));
  assert.throws(() =>
    validateClusters(
      [...valid, { ...valid[0], members: ["one"] }],
      submissions,
      "q01",
    ),
  );
  assert.throws(() =>
    validateClusters(
      [{ ...valid[0], members: ["one", "two"] }],
      submissions,
      "q01",
    ),
  );
  assert.throws(() =>
    validateClusters(
      [{ ...valid[0], members: ["invented"] }],
      submissions,
      "q01",
    ),
  );
});
test("company export contains only expert-accepted answers and signed attribution", async () => {
  const campaign = freshContributions().campaigns[0];
  const submission: Submission = {
    id: "s1",
    campaign_id: campaign.id,
    participant: demoParticipant,
    answers: [
      {
        questionId: "q01",
        selected: [0],
        text: "Visual reasoning",
        language: "en",
      },
    ],
    signature: "submission-signature",
    created_at: "now",
  };
  const cluster: Cluster = {
    id: "c1",
    campaign_id: campaign.id,
    question_id: "q01",
    title: "Cluster",
    summary: "Summary",
    language: "en",
    members: ["s1"],
    provider: "Qwen",
    model: "configured",
    content_hash: "hash",
    created_at: "now",
  };
  const review: Review = {
    id: "r1",
    campaign_id: campaign.id,
    cluster_id: "c1",
    verifier: demoExpert,
    decision: "accepted",
    notes: "Checked image selections and reasoning",
    signature: "review-signature",
    created_at: "now",
  };
  await assert.rejects(
    createReviewedExport(campaign, [submission], [cluster], []),
  );
  const result = await createReviewedExport(
    campaign,
    [submission],
    [cluster],
    [review],
  );
  assert.equal(result.count, 1);
  assert.deepEqual(result.contributors, [demoParticipant]);
  assert.deepEqual(result.verifiers, [demoExpert]);
  const rows = result.rows as {
    submissionSignature: string;
    reviewSignature: string;
  }[];
  assert.equal(rows[0].submissionSignature, "submission-signature");
  assert.equal(rows[0].reviewSignature, "review-signature");
  await assert.rejects(
    createReviewedExport(
      campaign,
      [submission],
      [cluster],
      [{ ...review, verifier: demoParticipant }],
    ),
  );
});
test("revenue allocation preserves every token unit and rejects invalid shares", () => {
  const company = "0x" + "1".repeat(40),
    contributor = "0x" + "2".repeat(40),
    verifier = "0x" + "3".repeat(40);
  const shares = validateShares(
    [
      { recipient: verifier, bps: 500, role: "verifier" },
      { recipient: contributor, bps: 2500, role: "contributor" },
    ],
    company,
  );
  const allocation = allocateRevenue(10003n, shares, company);
  assert.deepEqual(
    allocation.map((s) => s.amount),
    [2500n, 500n, 7003n],
  );
  assert.equal(
    allocation.reduce((sum, s) => sum + s.amount, 0n),
    10003n,
  );
  assert.throws(() =>
    validateShares(
      [{ recipient: company, bps: 500, role: "contributor" }],
      company,
    ),
  );
  assert.throws(() =>
    validateShares(
      [
        { recipient: contributor, bps: 6000, role: "contributor" },
        { recipient: verifier, bps: 6000, role: "verifier" },
      ],
      company,
    ),
  );
  assert.throws(() =>
    validateShares(
      [
        { recipient: contributor, bps: 1000, role: "contributor" },
        { recipient: contributor, bps: 500, role: "verifier" },
      ],
      company,
    ),
  );
  assert.throws(() =>
    validateShares(
      [{ recipient: "0x" + "0".repeat(40), bps: 500, role: "verifier" }],
      company,
    ),
  );
});
