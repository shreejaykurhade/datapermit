import { z } from "zod";
export const languages = ["en", "hi", "mr", "ta"] as const;
export type Language = (typeof languages)[number];
export const languageNames = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  ta: "தமிழ்",
};
export const imageKeys = [
  "car",
  "bus",
  "bike",
  "plane",
  "apple",
  "cherry",
  "grape",
  "citrus",
  "sun",
  "moon",
  "cloud",
  "tree",
  "cat",
  "dog",
  "fish",
  "bird",
] as const;
export type ImageKey = (typeof imageKeys)[number];
export const groups = ["vehicles", "fruit", "nature", "animals"] as const;
export type ImageGroup = (typeof groups)[number];
const groupNames: Record<Language, Record<ImageGroup, string>> = {
  en: {
    vehicles: "vehicles",
    fruit: "fruit",
    nature: "nature symbols",
    animals: "animals",
  },
  hi: {
    vehicles: "वाहन",
    fruit: "फल",
    nature: "प्रकृति के चिह्न",
    animals: "जानवर",
  },
  mr: {
    vehicles: "वाहने",
    fruit: "फळे",
    nature: "निसर्गाची चिन्हे",
    animals: "प्राणी",
  },
  ta: {
    vehicles: "வாகனங்கள்",
    fruit: "பழங்கள்",
    nature: "இயற்கைச் சின்னங்கள்",
    animals: "விலங்குகள்",
  },
};
export const copy: Record<
  Language,
  {
    select: string;
    answer: string;
    next: string;
    back: string;
    submit: string;
    saved: string;
    language: string;
    practice: string;
    check: string;
    consent: string;
    question: string;
  }
> = {
  en: {
    select: "Select every image showing",
    answer: "Explain your selection in your own words",
    next: "Save & next",
    back: "Previous",
    submit: "Submit all 50 answers",
    saved: "answers saved",
    language: "Answer language",
    practice: "Practice before contributing",
    check: "Check practice selection",
    consent:
      "I permit the requesting company to use my answers for dataset creation and model training, share them with Qwen and assigned experts for review, and record my wallet attribution on-chain.",
    question: "Question",
  },
  hi: {
    select: "इनकी सभी तस्वीरें चुनें:",
    answer: "अपने शब्दों में अपना चयन समझाएँ",
    next: "सहेजें और आगे बढ़ें",
    back: "पिछला",
    submit: "सभी 50 उत्तर जमा करें",
    saved: "उत्तर सहेजे गए",
    language: "उत्तर की भाषा",
    practice: "योगदान से पहले अभ्यास करें",
    check: "अभ्यास के चयन की जाँच करें",
    consent:
      "मैं कंपनी को डेटासेट और मॉडल प्रशिक्षण के लिए अपने उत्तर उपयोग करने, समीक्षा के लिए Qwen और नियुक्त विशेषज्ञों से साझा करने तथा ब्लॉकचेन पर अपना वॉलेट श्रेय दर्ज करने की अनुमति देता हूँ।",
    question: "प्रश्न",
  },
  mr: {
    select: "या प्रकारच्या सर्व प्रतिमा निवडा:",
    answer: "तुमची निवड स्वतःच्या शब्दांत समजावून सांगा",
    next: "जतन करा आणि पुढे जा",
    back: "मागील",
    submit: "सर्व 50 उत्तरे जमा करा",
    saved: "उत्तरे जतन केली",
    language: "उत्तराची भाषा",
    practice: "योगदान देण्यापूर्वी सराव करा",
    check: "सरावातील निवड तपासा",
    consent:
      "मी कंपनीला डेटासेट आणि मॉडेल प्रशिक्षणासाठी माझी उत्तरे वापरण्याची, पुनरावलोकनासाठी Qwen आणि नियुक्त तज्ज्ञांना देण्याची आणि ब्लॉकचेनवर माझ्या वॉलेटचे श्रेय नोंदवण्याची परवानगी देतो.",
    question: "प्रश्न",
  },
  ta: {
    select: "இந்த வகையின் எல்லா படங்களையும் தேர்ந்தெடுக்கவும்:",
    answer: "உங்கள் தேர்வை உங்கள் சொந்த வார்த்தைகளில் விளக்கவும்",
    next: "சேமித்து அடுத்து",
    back: "முந்தையது",
    submit: "50 பதில்களையும் சமர்ப்பிக்கவும்",
    saved: "பதில்கள் சேமிக்கப்பட்டன",
    language: "பதிலின் மொழி",
    practice: "பங்களிப்புக்கு முன் பயிற்சி",
    check: "பயிற்சித் தேர்வைச் சரிபார்க்கவும்",
    consent:
      "எனது பதில்களை தரவுத்தொகுப்பு மற்றும் மாதிரி பயிற்சிக்கு நிறுவனம் பயன்படுத்தவும், மதிப்பாய்வுக்கு Qwen மற்றும் நியமிக்கப்பட்ட நிபுணர்களிடம் பகிரவும், எனது வாலட் பங்களிப்பை பிளாக்செயினில் பதிவு செய்யவும் அனுமதிக்கிறேன்.",
    question: "கேள்வி",
  },
};
export const questionSchema = z.object({
  id: z.string().regex(/^q(0[1-9]|[1-4]\d|50)$/),
  target: z.enum(groups),
  instruction: z.string().max(500).optional(),
  prompts: z
    .object({
      en: z.string().min(5).max(500),
      hi: z.string().min(5).max(500).optional(),
      mr: z.string().min(5).max(500).optional(),
      ta: z.string().min(5).max(500).optional(),
    })
    .optional(),
  cells: z
    .array(
      z.object({
        key: z.enum(imageKeys),
        url: z
          .string()
          .url()
          .regex(/^https:\/\//)
          .max(1000)
          .optional(),
      }),
    )
    .length(16),
});
export type Question = z.infer<typeof questionSchema>;
export const answerSchema = z.object({
  questionId: z.string().regex(/^q\d{2}$/),
  selected: z
    .array(z.number().int().min(0).max(15))
    .min(1)
    .max(16)
    .refine((a) => new Set(a).size === a.length),
  text: z.string().trim().min(3).max(800),
  language: z.enum(languages),
});
export type Answer = z.infer<typeof answerSchema>;
export const campaignInput = z.object({
  title: z.string().trim().min(5).max(100),
  brief: z.string().trim().min(20).max(2000),
  verifiers: z
    .array(z.string().regex(/^0x[\da-fA-F]{40}$/))
    .min(1)
    .max(10)
    .transform((a) => [...new Set(a.map((s) => s.toLowerCase()))]),
  questions: z
    .array(questionSchema)
    .length(50)
    .refine(
      (a) => new Set(a.map((q) => q.id)).size === 50,
      "Question IDs must be unique.",
    )
    .transform((a) => [...a].sort((x, y) => x.id.localeCompare(y.id))),
});
export type Campaign = {
  id: string;
  title: string;
  brief: string;
  company: string;
  verifiers: string[];
  questions: Question[];
  status: "open" | "closed";
  created_at?: string;
};
export type Submission = {
  id: string;
  campaign_id: string;
  participant: string;
  answers: Answer[];
  signature: string;
  created_at: string;
};
export type Cluster = {
  id: string;
  campaign_id: string;
  question_id: string;
  title: string;
  summary: string;
  language: Language;
  members: string[];
  provider: string;
  model: string;
  content_hash: string;
  created_at: string;
};
export type Review = {
  id: string;
  campaign_id: string;
  cluster_id: string;
  verifier: string;
  decision: "accepted" | "rejected";
  notes: string;
  signature: string;
  created_at: string;
};
export type ReviewedExport = {
  id: string;
  campaignId: string;
  company: string;
  provenanceHash: `0x${string}`;
  contributors: string[];
  verifiers: string[];
  rows: unknown[];
  count: number;
  createdAt: string;
};
export type ContributionState = {
  campaigns: Campaign[];
  submissions: Submission[];
  clusters: Cluster[];
  reviews: Review[];
  exports: ReviewedExport[];
};
export function seedQuestions(): Question[] {
  return Array.from({ length: 50 }, (_, i) => {
    const keys = [...imageKeys];
    let seed = i + 137;
    for (let j = 15; j > 0; j--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const k = seed % (j + 1);
      [keys[j], keys[k]] = [keys[k], keys[j]];
    }
    return {
      id: "q" + String(i + 1).padStart(2, "0"),
      target: groups[i % 4],
      cells: keys.map((key) => ({ key })),
    };
  });
}
export function instruction(q: Question, language: Language) {
  if (q.prompts) return q.prompts[language] || q.prompts.en;
  return `${copy[language].select} ${groupNames[language][q.target]}.`;
}
export function imageGroup(key: ImageKey) {
  return groups[Math.floor(imageKeys.indexOf(key) / 4)];
}
export function scoreSelection(q: Question, selected: number[]) {
  const expected = q.cells.flatMap((c, i) =>
    imageGroup(c.key) === q.target ? [i] : [],
  );
  const correct = Array.from(
    { length: 16 },
    (_, i) => expected.includes(i) === selected.includes(i),
  ).filter(Boolean).length;
  return Math.round((correct / 16) * 100);
}
export function validateAnswers(questions: Question[], answers: Answer[]) {
  const parsed = z.array(answerSchema).length(50).parse(answers);
  const ids = new Set(parsed.map((a) => a.questionId));
  if (ids.size !== 50 || questions.some((q) => !ids.has(q.id)))
    throw new Error("Answer each of the 50 questions exactly once.");
  return parsed
    .map((a) => ({ ...a, selected: [...a.selected].sort((x, y) => x - y) }))
    .sort((a, b) => a.questionId.localeCompare(b.questionId));
}
export async function contentHash(value: unknown): Promise<`0x${string}`> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return ("0x" +
    Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")) as `0x${string}`;
}
export function submissionMessage(campaignId: string, hash: string) {
  return `DataPermit contribution v1\nCampaign: ${campaignId}\nAnswers SHA-256: ${hash}\nConsent: dataset creation and model training; Qwen and assigned expert review; public wallet attribution.`;
}
export function reviewMessage(
  campaignId: string,
  clusterId: string,
  hash: string,
  decision: string,
  notes: string,
) {
  return `DataPermit expert review v1\nCampaign: ${campaignId}\nCluster: ${clusterId}\nContent SHA-256: ${hash}\nDecision: ${decision}\nNotes: ${notes}`;
}
export function validateClusters(
  raw: unknown,
  submissions: Submission[],
  questionId: string,
) {
  const schema = z
    .array(
      z.object({
        title: z.string().min(3).max(160),
        summary: z.string().min(3).max(2000),
        language: z.enum(languages),
        members: z.array(z.string()).min(1).max(20),
      }),
    )
    .min(1)
    .max(20);
  const clusters = schema.parse(raw);
  const expected = new Map(
    submissions
      .filter((s) => s.answers.some((a) => a.questionId === questionId))
      .map((s) => [
        s.id,
        s.answers.find((a) => a.questionId === questionId)!.language,
      ]),
  );
  const seen = new Set<string>();
  for (const c of clusters)
    for (const id of c.members) {
      if (!expected.has(id) || seen.has(id) || expected.get(id) !== c.language)
        throw new Error(
          "Clusters must include each answer exactly once and preserve its language.",
        );
      seen.add(id);
    }
  if (seen.size !== expected.size)
    throw new Error("Clustering omitted answers.");
  return clusters;
}
export async function createReviewedExport(
  campaign: Campaign,
  submissions: Submission[],
  clusters: Cluster[],
  reviews: Review[],
): Promise<ReviewedExport> {
  const rows: unknown[] = [];
  const contributors = new Set<string>(),
    verifiers = new Set<string>();
  for (const cluster of [...clusters].sort(
    (a, b) =>
      a.question_id.localeCompare(b.question_id) || a.id.localeCompare(b.id),
  )) {
    const review = reviews.find((r) => r.cluster_id === cluster.id);
    if (!review || review.decision !== "accepted") continue;
    if (
      !campaign.verifiers.includes(review.verifier) ||
      submissions.some((s) => s.participant === review.verifier) ||
      review.verifier === campaign.company
    )
      throw new Error("Verifier must be assigned and independent.");
    for (const id of [...cluster.members].sort()) {
      const submission = submissions.find((s) => s.id === id);
      const answer = submission?.answers.find(
        (a) => a.questionId === cluster.question_id,
      );
      if (!submission || !answer)
        throw new Error("Cluster references missing answer.");
      rows.push({
        campaignId: campaign.id,
        questionId: cluster.question_id,
        question: campaign.questions.find((q) => q.id === cluster.question_id),
        answer,
        participant: submission.participant,
        submissionId: submission.id,
        submissionSignature: submission.signature,
        clusterId: cluster.id,
        clusterHash: cluster.content_hash,
        verifier: review.verifier,
        reviewId: review.id,
        reviewSignature: review.signature,
        decision: review.decision,
        notes: review.notes,
      });
      contributors.add(submission.participant);
      verifiers.add(review.verifier);
    }
  }
  if (!rows.length)
    throw new Error(
      "An expert must accept at least one cluster before exporting.",
    );
  const contributionAddresses = [...contributors].sort(),
    verifierAddresses = [...verifiers].sort();
  const provenanceHash = await contentHash({
    campaignId: campaign.id,
    company: campaign.company,
    contributors: contributionAddresses,
    verifiers: verifierAddresses,
    rows,
  });
  return {
    id: provenanceHash,
    campaignId: campaign.id,
    company: campaign.company,
    provenanceHash,
    contributors: contributionAddresses,
    verifiers: verifierAddresses,
    rows,
    count: rows.length,
    createdAt: new Date().toISOString(),
  };
}
export const demoCompany = "0x1111111111111111111111111111111111111111",
  demoParticipant = "0x2222222222222222222222222222222222222222",
  demoExpert = "0x3333333333333333333333333333333333333333";
export function freshContributions(): ContributionState {
  return {
    campaigns: [
      {
        id: "demo-image-campaign",
        title: "Everyday objects in your language",
        brief:
          "Select the requested images and explain your choices. Help our team build a multilingual image annotation dataset. These original illustrations are demonstration assets, not a real customer collection.",
        company: demoCompany,
        verifiers: [demoExpert],
        questions: seedQuestions(),
        status: "open",
      },
    ],
    submissions: [],
    clusters: [],
    reviews: [],
    exports: [],
  };
}
