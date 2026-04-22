import goldDataset from './gtm-icp-discovery-gold.json';
import { semanticSignature } from '@/lib/cognition/cognitive-state';
import { canonicalizeLensName, type CanonicalLensName } from '@/lib/workshop/canonical-lenses';

type GoldLens = {
  name: string;
  questions: string[];
  scale_1_5: Record<string, string>;
};

type GoldDataset = {
  lens_pack: string;
  purpose: string;
  rules: {
    core_principle: string;
    must_do: string[];
    must_not_do: string[];
    anchor: string;
  };
  lenses: GoldLens[];
};

type GoldIntentProfile = {
  comparison: number;
  examples: number;
  alignment: number;
  value: number;
  internalEfficiency: number;
};

export type GoldExampleMatch = {
  lens: string;
  example: string;
  score: number;
  dominantIntent: keyof GoldIntentProfile;
};

export type GtmGoldLens = {
  name: CanonicalLensName;
  questions: string[];
  scale_1_5: Record<string, string>;
};

const GOLD = goldDataset as GoldDataset;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does', 'for', 'from', 'have', 'how', 'in', 'is', 'it',
  'its', 'of', 'on', 'or', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'what', 'where', 'who', 'with', 'you',
  'your', 'most', 'actually', 'today',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentTokens(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length > 2)
    .filter((token) => !STOPWORDS.has(token));
}

function jaccard(a: string[], b: string[]): number {
  const as = new Set(a);
  const bs = new Set(b);
  let intersection = 0;
  for (const token of as) {
    if (bs.has(token)) intersection += 1;
  }
  const union = new Set([...as, ...bs]).size;
  return union > 0 ? intersection / union : 0;
}

function maxOverlap(source: string[], target: string[]): number {
  if (source.length === 0 || target.length === 0) return 0;
  const sourceSet = new Set(source);
  let overlap = 0;
  for (const token of target) {
    if (sourceSet.has(token)) overlap += 1;
  }
  return overlap / target.length;
}

function buildIntentProfile(text: string): GoldIntentProfile {
  const normalized = normalizeText(text);
  const patterns: Record<keyof GoldIntentProfile, RegExp[]> = {
    comparison: [
      /\bwin(s|ning)?\b/, /\blose(s|ing|loss|losses)?\b/, /\bstrong(est)?\b/, /\brest\b/, /\bbetter\b/, /\bworse\b/, /\bcompared\b/,
    ],
    examples: [
      /\brecent\b/, /\bpattern(s)?\b/, /\bconsistently\b/, /\btypes? of work\b/, /\blive deals?\b/, /\bexamples?\b/,
    ],
    alignment: [
      /\bmisalignment\b/, /\bgap\b/, /\bsold\b/, /\bdelivered?\b/, /\bdelivery\b/, /\bproposition\b/, /\boverstated\b/, /\bdistort\b/,
    ],
    value: [
      /\bvalue\b/, /\bdeal(s)?\b/, /\bbuy(ing|ers?)\b/, /\bclient(s)?\b/, /\brevenue\b/, /\bclose deals?\b/, /\bicp\b/, /\bsegment(s)?\b/,
    ],
    internalEfficiency: [
      /\befficien(cy|t)\b/, /\bmaturity\b/, /\bprocess quality\b/, /\bcapability\b/, /\bworkflow\b/, /\binternal\b/,
    ],
  };

  return Object.fromEntries(
    Object.entries(patterns).map(([key, regs]) => [
      key,
      regs.reduce((sum, regex) => sum + (regex.test(normalized) ? 1 : 0), 0),
    ]),
  ) as GoldIntentProfile;
}

function dominantIntent(profile: GoldIntentProfile): keyof GoldIntentProfile {
  const entries = Object.entries(profile) as Array<[keyof GoldIntentProfile, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? 'examples';
}

const MATCH_INDEX = GOLD.lenses.flatMap((lens) =>
  lens.questions.map((question) => {
    const signature = semanticSignature(question);
    const tokens = contentTokens(question);
    const intent = buildIntentProfile(question);
    return {
      lens: canonicalizeLensName(lens.name) ?? lens.name,
      example: question,
      signatureTokens: signature.split(' ').filter(Boolean),
      tokens,
      intent,
      dominantIntent: dominantIntent(intent),
    };
  }),
);

export function getGtmIcpGoldDataset(): GoldDataset {
  return GOLD;
}

export function getGtmGoldLens(lens: string): GtmGoldLens | null {
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens) return null;
  const entry = GOLD.lenses.find((candidate) => (canonicalizeLensName(candidate.name) ?? candidate.name) === canonicalLens);
  if (!entry) return null;
  return {
    name: canonicalLens,
    questions: entry.questions,
    scale_1_5: entry.scale_1_5,
  };
}

export function isExactGtmGoldQuestionForLens(text: string, lens: string): boolean {
  const normalizedText = normalizeText(text);
  const canonicalLens = canonicalizeLensName(lens);
  if (!canonicalLens || !normalizedText) return false;
  const entry = GOLD.lenses.find((candidate) => (canonicalizeLensName(candidate.name) ?? candidate.name) === canonicalLens);
  if (!entry) return false;
  return entry.questions.some((question) => normalizeText(question) === normalizedText);
}

export function buildGtmIcpGoldReferenceBlock(): string {
  const lensBlocks = GOLD.lenses.map((lens) => {
    const sampleQuestions = lens.questions.map((question) => `  - ${question}`).join('\n');
    const scaleLines = Object.entries(lens.scale_1_5)
      .map(([level, value]) => `  - ${level}: ${value}`)
      .join('\n');
    return `${lens.name}:\n${sampleQuestions}\n  Scale anchors:\n${scaleLines}`;
  }).join('\n\n');

  return [
    `GOLD REFERENCE DATASET: ${GOLD.lens_pack}`,
    `Purpose: ${GOLD.purpose}`,
    `Core principle: ${GOLD.rules.core_principle}`,
    `Anchor: ${GOLD.rules.anchor}`,
    'Use these as behavioural calibration examples only.',
    'Do not copy the wording verbatim into the final workshop output.',
    'Must do:',
    ...GOLD.rules.must_do.map((rule) => `- ${rule}`),
    'Must not do:',
    ...GOLD.rules.must_not_do.map((rule) => `- ${rule}`),
    'Authoritative lens examples:',
    lensBlocks,
  ].join('\n');
}

export function findClosestGtmGoldExample(text: string): GoldExampleMatch | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const signatureTokens = semanticSignature(text).split(' ').filter(Boolean);
  const tokens = contentTokens(text);
  const intent = buildIntentProfile(text);
  const currentDominantIntent = dominantIntent(intent);

  const scored = MATCH_INDEX.map((entry) => {
    const signatureScore = jaccard(signatureTokens, entry.signatureTokens);
    const tokenScore = jaccard(tokens, entry.tokens);
    const intentScore = maxOverlap(
      Object.entries(intent).flatMap(([key, value]) => Array.from({ length: value }, () => key)),
      Object.entries(entry.intent).flatMap(([key, value]) => Array.from({ length: value }, () => key)),
    );
    const dominantIntentBoost = currentDominantIntent === entry.dominantIntent ? 0.12 : 0;
    const internalEfficiencyPenalty = intent.internalEfficiency > 0 ? 0.18 : 0;
    const score = Math.max(
      0,
      signatureScore * 0.45 + tokenScore * 0.25 + intentScore * 0.30 + dominantIntentBoost - internalEfficiencyPenalty,
    );
    return {
      lens: entry.lens,
      example: entry.example,
      score,
      dominantIntent: entry.dominantIntent,
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0] ?? null;
}

export function findClosestGtmGoldExampleForLens(text: string, lens: string): GoldExampleMatch | null {
  const canonicalLens = canonicalizeLensName(lens) ?? lens;
  const matches = MATCH_INDEX
    .filter((entry) => entry.lens === canonicalLens)
    .map((entry) => {
      const overall = findClosestGtmGoldExample(text);
      if (!overall) return null;
      const signatureTokens = semanticSignature(text).split(' ').filter(Boolean);
      const tokens = contentTokens(text);
      const intent = buildIntentProfile(text);
      const signatureScore = jaccard(signatureTokens, entry.signatureTokens);
      const tokenScore = jaccard(tokens, entry.tokens);
      const intentScore = maxOverlap(
        Object.entries(intent).flatMap(([key, value]) => Array.from({ length: value }, () => key)),
        Object.entries(entry.intent).flatMap(([key, value]) => Array.from({ length: value }, () => key)),
      );
      const score = Math.max(0, signatureScore * 0.45 + tokenScore * 0.25 + intentScore * 0.30);
      return {
        lens: entry.lens,
        example: entry.example,
        score,
        dominantIntent: entry.dominantIntent,
      };
    })
    .filter(Boolean) as GoldExampleMatch[];

  matches.sort((a, b) => b.score - a.score);
  return matches[0] ?? null;
}

export function getGtmGoldScaleAnchors(lens: string): string[] {
  const canonicalLens = canonicalizeLensName(lens) ?? lens;
  const entry = GOLD.lenses.find((candidate) => (canonicalizeLensName(candidate.name) ?? candidate.name) === canonicalLens);
  if (!entry) return [];
  return ['1', '3', '5']
    .map((level) => entry.scale_1_5[level])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}
