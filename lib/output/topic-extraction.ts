/**
 * DREAM Canonical Topic Extraction
 *
 * Derives short, normalised topic labels from raw workshop signal text.
 * Replaces the coarse lens_primaryType fallback (e.g. "PEOPLE_CHALLENGE")
 * with meaningful 1–3 word labels (e.g. "approval_delays", "system_fragmentation").
 *
 * Two-phase approach:
 * 1. Deterministic extraction — corpus-frequency scoring with domain-vocabulary
 *    boosting across the full signal corpus, producing consistent topic labels per signal.
 * 2. Optional LLM consolidation — one cheap GPT-4o-mini call merges
 *    near-synonym cluster labels into canonical forms.
 *    Never invents new topics — only consolidates existing ones.
 *
 * Integration: called from build-workshop-graph.ts before buildEvidenceClusters.
 * Signals that already have themeLabels (from agenticAnalysis.themes) are
 * left unchanged; only signals with empty themeLabels are enriched.
 */

import OpenAI from 'openai';
import { env } from '@/lib/env';
import { openAiBreaker } from '@/lib/circuit-breaker';
import type { RawSignal } from './evidence-clustering';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

// ── Stop words ────────────────────────────────────────────────────────────────
// Comprehensive English stop-word list biased toward workshop language.
// Words here are excluded from topic candidates even if they score well.

const STOPWORDS = new Set<string>([
  // Articles / determiners
  'a','an','the','this','that','these','those','some','any','all','each',
  'every','both','either','neither','another','other','such','same',
  // Conjunctions
  'and','but','or','nor','for','yet','so','if','as','than','though',
  'although','because','since','unless','until','while','when','where',
  'how','why','which','who','whom','whose',
  // Prepositions
  'in','on','at','to','of','with','by','from','into','out','about',
  'above','across','after','against','along','among','around','before',
  'behind','below','between','during','except','inside','near','off',
  'outside','over','past','through','under','upon','within','without',
  // Pronouns
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','mine','yours','ours','theirs',
  // Auxiliaries
  'is','are','was','were','be','been','being',
  'have','has','had','do','does','did',
  'will','would','could','should','may','might','must','shall','can',
  // Common low-signal verbs
  'want','need','like','think','feel','make','get','see','know','go',
  'come','take','give','tell','ask','try','seem','become','help','keep',
  'let','run','put','set','turn','show','move','find','say','said',
  // Adverbs / modifiers with low signal
  'not','no','very','too','also','just','only','even','still','yet',
  'now','then','here','there','really','quite','rather','much','more',
  'less','most','least','always','often','never','sometimes','usually',
  // Common workshop filler
  'able','use','using','used','work','working','works',
  'thing','things','way','ways','time','times',
  'bit','lot','part','kind','sort','type',
  // Short tokens caught by stopwords but not length filter
  'new','old','big','good','bad','right','wrong','real',
]);

// ── Domain boost ──────────────────────────────────────────────────────────────
// Words that carry strong topic signal in workshop / organisational context.
// Higher multiplier = preferred as topic anchor when scoring.

const DOMAIN_BOOST = new Map<string, number>([
  // ── Process friction
  ['approval',    4], ['escalation',  4], ['handoff',     3], ['handover',    3],
  ['bottleneck',  4], ['delay',       4], ['wait',        3], ['backlog',     3],
  ['queue',       3], ['manual',      3], ['workaround',  4], ['rework',      3],
  ['duplication', 3], ['repetitive',  3], ['overhead',    3],
  // ── Technology
  ['system',      4], ['integration', 4], ['platform',    3], ['database',    3],
  ['crm',         4], ['portal',      4], ['api',         3], ['tool',        2],
  ['automation',  4], ['chatbot',     4], ['bot',         3], ['digital',     3],
  ['data',        3], ['reporting',   3], ['analytics',   4], ['dashboard',   3],
  ['interface',   3], ['legacy',      4], ['fragmentation',4],
  // ── People & skills
  ['training',    4], ['knowledge',   4], ['skill',       4], ['capability',  4],
  ['expertise',   3], ['onboarding',  4], ['induction',   3], ['competency',  3],
  ['development', 2], ['coaching',    3], ['mentoring',   3],
  ['agent',       3], ['staff',       2], ['workforce',   3], ['employee',    2],
  // ── Customer
  ['customer',    4], ['journey',     4], ['experience',  3], ['satisfaction', 3],
  ['complaint',   4], ['feedback',    3], ['channel',     3], ['contact',     2],
  ['resolution',  3], ['service',     2], ['selfservice',  4], ['self-service', 4],
  // ── Governance / leadership
  ['decision',    3], ['governance',  4], ['policy',      3], ['compliance',  3],
  ['regulation',  3], ['authority',   3], ['visibility',  4], ['transparency',3],
  ['accountability',3], ['leadership', 3], ['strategy',   3], ['ownership',   3],
  // ── AI / future
  ['intelligence',3], ['insight',     3], ['prediction',  3], ['recommendation',3],
  ['personalisation',3], ['personaliz',3],
]);

// ── Lemma overrides ───────────────────────────────────────────────────────────
// Direct normalisation of common workshop vocabulary irregular forms.
// Applied BEFORE generic suffix rules.

const LEMMA_OVERRIDES = new Map<string, string>([
  // Plurals with irregular forms
  ['analyses',         'analysis'],
  ['criteria',         'criterion'],
  ['data',             'data'],        // keep as-is (already canonical)
  ['journeys',         'journey'],
  ['queries',          'query'],
  ['enquiries',        'enquiry'],
  ['capabilities',     'capability'],
  ['opportunities',    'opportunity'],
  ['technologies',     'technology'],
  ['strategies',       'strategy'],
  ['authorities',      'authority'],
  ['complexities',     'complexity'],
  ['inefficiencies',   'inefficiency'],
  ['inconsistencies',  'inconsistency'],
  ['dependencies',     'dependency'],
  ['priorities',       'priority'],
  ['deliveries',       'delivery'],
  ['escalations',      'escalation'],
  ['integrations',     'integration'],
  ['approvals',        'approval'],
  ['complaints',       'complaint'],
  ['channels',         'channel'],
  ['systems',          'system'],
  ['agents',           'agent'],
  ['customers',        'customer'],
  ['skills',           'skill'],
  ['platforms',        'platform'],
  ['tools',            'tool'],
  ['insights',         'insight'],
  ['teams',            'team'],
  ['processes',        'process'],
  ['issues',           'issue'],
  ['decisions',        'decision'],
  ['experiences',      'experience'],
  ['improvements',     'improvement'],
  ['requirements',     'requirement'],
  ['solutions',        'solution'],
  ['challenges',       'challenge'],
  ['bottlenecks',      'bottleneck'],
  ['delays',           'delay'],
  ['behaviours',       'behaviour'],
  ['behaviors',        'behavior'],
  ['workarounds',      'workaround'],
  ['handoffs',         'handoff'],
  ['handovers',        'handover'],
  ['portals',          'portal'],
  ['databases',        'database'],
  ['dashboards',       'dashboard'],
  ['interactions',     'interaction'],
  ['transactions',     'transaction'],
  ['journeys',         'journey'],
  ['supervisors',      'supervisor'],
  ['managers',         'manager'],
  ['employees',        'employee'],
  ['customers',        'customer'],
  ['complaints',       'complaint'],
  // Common contractions that sneak through
  ['cant',    'cannot'],
  ['wont',    'will_not'],
  ['dont',    'do_not'],
  ['isnt',    'is_not'],
  ['wasnt',   'was_not'],
  ['doesnt',  'does_not'],
  ['havent',  'have_not'],
  ['hasnt',   'has_not'],
]);

// ── Tokenisation + lemmatisation ──────────────────────────────────────────────

function tokenizeAndLemmatize(text: string): string[] {
  return text
    .toLowerCase()
    // Normalise contractions before stripping apostrophes
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will_not')
    .replace(/\bdon't\b/g, 'do_not')
    .replace(/\bisn't\b/g, 'is_not')
    .replace(/\bdoesn't\b/g, 'does_not')
    .replace(/\bhasn't\b/g, 'has_not')
    .replace(/\bhaven't\b/g, 'have_not')
    .replace(/\baren't\b/g, 'are_not')
    // Keep hyphens within words (self-service → self-service)
    .replace(/['''`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^-+|-+$/g, ''))      // strip leading/trailing hyphens
    .filter(w => w.length >= 3 && !STOPWORDS.has(w))
    .map(lemmatize);
}

function lemmatize(word: string): string {
  // Direct override first (handles most common workshop vocabulary)
  const override = LEMMA_OVERRIDES.get(word);
  if (override) return override;

  // If the word is already a canonical domain keyword, keep it as-is.
  // This prevents "training" → "train", "approval" → "approv", etc.
  if (DOMAIN_BOOST.has(word)) return word;

  // Generic suffix stripping — conservative to avoid over-stemming
  // Only strip when the result would be ≥ 4 chars
  if (word.endsWith('nesses') && word.length >= 9) return word.slice(0, -6);
  if (word.endsWith('ness')   && word.length >= 7) return word.slice(0, -4);
  if (word.endsWith('ments')  && word.length >= 8) return word.slice(0, -5);
  if (word.endsWith('ment')   && word.length >= 7) return word.slice(0, -4);
  if (word.endsWith('ings')   && word.length >= 7) return word.slice(0, -4);
  if (word.endsWith('ing')    && word.length >= 6) return word.slice(0, -3);
  if (word.endsWith('ated')   && word.length >= 7) return word.slice(0, -2);  // automated → automat(e) — keep 'ated'
  if (word.endsWith('ised')   && word.length >= 7) return word.slice(0, -1);  // organised → organise
  if (word.endsWith('ized')   && word.length >= 7) return word.slice(0, -1);  // organized → organize
  if (word.endsWith('ed')     && word.length >= 5) return word.slice(0, -2);
  // Strip trailing 's' only when clearly plural (not when word ends in -ss, -us, -is, -os, -as)
  if (word.endsWith('s')      && word.length >= 5 &&
      !word.endsWith('ss')    && !word.endsWith('us') &&
      !word.endsWith('is')    && !word.endsWith('os') &&
      !word.endsWith('as')    && !word.endsWith('xs')) {
    return word.slice(0, -1);
  }

  return word;
}

// ── Document-frequency computation ───────────────────────────────────────────

/**
 * Compute per-token document frequency (df): how many documents contain each token.
 * Returns the raw df map — callers divide by N for normalised frequency.
 */
function computeDocFreq(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return df;
}

// ── Per-signal label extraction ───────────────────────────────────────────────

/**
 * Extract the best 1–2 word topic label from a tokenised signal.
 *
 * Scoring: corpus-frequency × domain boost.
 *   score(token) = sqrt(df(token) / N) × domainBoost(token)
 *
 * Rewards tokens that appear across many signals (they ARE the topic anchor),
 * unlike TF-IDF which would penalise them for being common across the corpus.
 *
 * Bigrams are only formed when BOTH tokens are domain-boosted (boost > 1),
 * preventing generic bigrams like "approval_manager".
 */
function pickBestLabel(
  tokens: string[],
  df: Map<string, number>,
  N: number,
): string | null {
  if (tokens.length === 0) return null;

  // Score each unique token by corpus-frequency × domain-boost
  const tokenScores = new Map<string, number>();
  for (const t of new Set(tokens)) {
    const boost = DOMAIN_BOOST.get(t) ?? 1;
    const freq = (df.get(t) ?? 0) / Math.max(N, 1);
    tokenScores.set(t, Math.sqrt(freq) * boost);
  }

  // Find the maximum score across all tokens
  let maxScore = 0;
  for (const s of tokenScores.values()) if (s > maxScore) maxScore = s;
  if (maxScore === 0) return null;

  // Pick the FIRST token (in original text order) that scores within 20% of the max.
  // This ensures the topic anchor is the earliest-occurring high-signal word —
  // workshop signals typically name the topic first, followed by context.
  // Without this, cross-corpus vocabulary contamination can shift the anchor
  // to a later-appearing word that happens to be common across other groups.
  const PROXIMITY_RATIO = 0.80;  // within 20% of max score
  let best: string | null = null;
  for (const t of tokens) {                         // iterate in TEXT ORDER
    if ((tokenScores.get(t) ?? 0) >= maxScore * PROXIMITY_RATIO) {
      best = t;
      break;
    }
  }
  if (!best) return null;

  const bestScore = tokenScores.get(best) ?? 0;

  // Scan adjacent pairs in the original token sequence for a stronger bigram.
  // Both tokens must be domain-boosted (boost > 1) to qualify as a bigram anchor.
  // Threshold 2.0× ensures bigrams only win when they are substantially better
  // than the best unigram — prevents incidental adjacent-word bigrams from
  // overriding the canonical topic anchor.
  let bestBigram: string | null = null;
  let bestBigramScore = bestScore;

  for (let i = 0; i < tokens.length - 1; i++) {
    const t1 = tokens[i];
    const t2 = tokens[i + 1];
    if (t1 === t2) continue;

    // Require both tokens to be domain-specific (not generic)
    if ((DOMAIN_BOOST.get(t1) ?? 1) <= 1 || (DOMAIN_BOOST.get(t2) ?? 1) <= 1) continue;

    const s1 = tokenScores.get(t1) ?? 0;
    const s2 = tokenScores.get(t2) ?? 0;

    const bigramScore = s1 + s2;
    if (bigramScore > bestBigramScore * 2.0) {
      // Sort alphabetically for canonical key (consistent across variations)
      bestBigram = [t1, t2].sort().join('_');
      bestBigramScore = bigramScore;
    }
  }

  // Return bigram when it scores notably better, else best unigram
  const label = bestBigram ?? best;
  return normaliseLabel(label);
}

function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);   // cap label length
}

// ── Near-duplicate cluster merging ────────────────────────────────────────────

/**
 * Merge near-duplicate labels using Jaccard similarity on word tokens.
 * Labels with Jaccard ≥ 0.4 are merged into the most-specific canonical form.
 *
 * Returns a Map from every input label → canonical label.
 * Labels already canonical map to themselves.
 */
export function buildMergeMap(
  labels: string[],
  /** Frequency of each label across signals — used to pick canonical form */
  frequency?: Map<string, number>,
): Map<string, string> {
  if (labels.length === 0) return new Map();

  // Token sets for each label
  const tokenSets = new Map<string, Set<string>>();
  for (const label of labels) {
    tokenSets.set(label, new Set(label.split(/[_-]/)));
  }

  // Union-Find
  const parent = new Map<string, string>(labels.map(l => [l, l]));
  const findRoot = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) return x;
    const root = findRoot(p);
    parent.set(x, root);
    return root;
  };
  const unite = (x: string, y: string): void => {
    const rx = findRoot(x), ry = findRoot(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  // Merge labels with Jaccard ≥ THRESHOLD
  const THRESHOLD = 0.40;
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = tokenSets.get(labels[i])!;
      const b = tokenSets.get(labels[j])!;
      const intersection = [...a].filter(t => b.has(t)).length;
      const union = new Set([...a, ...b]).size;
      if (union > 0 && intersection / union >= THRESHOLD) {
        unite(labels[i], labels[j]);
      }
    }
  }

  // Collect groups
  const groups = new Map<string, string[]>();
  for (const label of labels) {
    const root = findRoot(label);
    const g = groups.get(root) ?? [];
    g.push(label);
    groups.set(root, g);
  }

  // Pick canonical: prefer highest frequency, then longest (most specific)
  const mergeMap = new Map<string, string>();
  for (const group of groups.values()) {
    const canonical = group.sort((a, b) => {
      const fa = frequency?.get(b) ?? 0;
      const fb = frequency?.get(a) ?? 0;
      if (fa !== fb) return fa - fb;          // higher frequency first
      return b.length - a.length;             // longer label (more specific) first
    })[0];
    for (const label of group) mergeMap.set(label, canonical);
  }

  return mergeMap;
}

// ── Phase 1: Deterministic enrichment ────────────────────────────────────────

/**
 * Enrich signals that have no themeLabels with deterministically extracted
 * canonical topic labels.
 *
 * Signals that already have themeLabels (from agenticAnalysis.themes on
 * hemisphere-processed nodes) are left unchanged.
 */
export function enrichSignalsWithTopics(signals: RawSignal[]): RawSignal[] {
  // Only process signals that need enrichment
  const needEnrich = signals.filter(s =>
    s.themeLabels.length === 0 && s.rawText.trim().length > 5,
  );
  if (needEnrich.length === 0) return signals;

  // Build corpus — tokenise all signals for document-frequency computation
  const corpus = needEnrich.map(s => tokenizeAndLemmatize(s.rawText));
  const N = corpus.length;
  const df = computeDocFreq(corpus);

  // Extract per-signal labels
  const rawLabel = new Map<string, string>();   // signalId → extracted label
  for (let i = 0; i < needEnrich.length; i++) {
    const label = pickBestLabel(corpus[i], df, N);
    if (label) rawLabel.set(needEnrich[i].id, label);
  }

  // Compute label frequencies across signals
  const labelFreq = new Map<string, number>();
  for (const label of rawLabel.values()) {
    labelFreq.set(label, (labelFreq.get(label) ?? 0) + 1);
  }

  // Merge near-duplicate labels into canonical forms
  const allLabels = [...new Set(rawLabel.values())];
  const mergeMap = buildMergeMap(allLabels, labelFreq);

  // Apply to signals
  return signals.map(s => {
    if (s.themeLabels.length > 0) return s;      // already labelled — keep
    const raw = rawLabel.get(s.id);
    if (!raw) return s;                           // extraction failed — keep empty
    const canonical = mergeMap.get(raw) ?? raw;
    return { ...s, themeLabels: [canonical] };
  });
}

// ── Phase 2: Optional LLM consolidation ──────────────────────────────────────

export interface LLMRefinementContext {
  clientName?: string;
  industry?: string;
}

/**
 * Use a single GPT-4o-mini call to consolidate near-synonym cluster labels
 * that deterministic Jaccard merging missed (e.g. "system" vs "fragmentation").
 *
 * Returns a merge map: old_label → canonical_label.
 * Returns an empty Map when LLM is unavailable, input is too small, or call fails.
 *
 * NEVER invents new topics — only re-maps existing labels to other existing
 * (or renamed) labels present in the input.
 */
export async function refineTopicsWithLLM(
  signals: RawSignal[],
  context: LLMRefinementContext = {},
): Promise<Map<string, string>> {
  if (!openai) return new Map();

  // Collect unique cluster labels + a representative example signal for each
  const clusterSamples = new Map<string, string>();
  for (const s of signals) {
    for (const label of s.themeLabels) {
      if (!clusterSamples.has(label)) {
        clusterSamples.set(label, s.rawText.slice(0, 120).replace(/\s+/g, ' '));
      }
    }
  }

  // Only worth calling LLM when there are enough clusters to consolidate
  if (clusterSamples.size < 6) return new Map();
  // Cap at 60 clusters per call (keep prompt manageable)
  const clusterList = [...clusterSamples.entries()].slice(0, 60);

  const clientCtx = [context.clientName, context.industry].filter(Boolean).join(' — ');
  const clusterBlock = clusterList
    .map(([label, sample]) => `"${label}": "${sample}"`)
    .join('\n');

  const prompt = `You are consolidating workshop evidence cluster labels for: ${clientCtx || 'a transformation workshop'}.

These labels were automatically extracted from participant signals. Many may be near-synonyms or refer to the same underlying topic.

CLUSTERS (label: example signal):
${clusterBlock}

YOUR JOB: Merge near-synonyms into clear, specific 2–3 word snake_case labels.

RULES:
1. Only merge clusters that clearly mean the same thing
2. Final canonical labels must be 1–3 words in snake_case, descriptive (e.g. "approval_delays", "system_fragmentation", "training_gaps", "customer_self_service")
3. Do NOT merge clusters about different topics — "training" and "system" are different
4. Do NOT invent topics not present in the input — only consolidate existing ones
5. Omit entries where the canonical equals the original label
6. Short single-word labels that are already clear (e.g. "approval") may be kept or renamed to add specificity

EXAMPLES of good consolidation:
- "approval", "approval_wait", "wait_approval" → "approval_delays"
- "system", "system_fragment", "fragment_system" → "system_fragmentation"
- "training", "knowledge_gap", "training_gap" → "training_gaps"
- "self-service", "selfservice", "portal_customer" → "customer_self_service"

Return JSON only — an object with key "merges": { "old_label": "canonical_label" }`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);
    const response = await openAiBreaker.execute(() =>
      openai!.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return valid JSON only with key "merges".' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 1200,
        },
        { signal: controller.signal },
      ),
    );
    clearTimeout(timeoutId);

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { merges?: Record<string, string> };
    const merges = parsed.merges ?? {};

    // Validate: only accept entries where the value is a non-empty string
    const mergeMap = new Map<string, string>();
    for (const [oldLabel, canonical] of Object.entries(merges)) {
      if (typeof canonical === 'string' && canonical.trim().length > 0) {
        mergeMap.set(oldLabel, normaliseLabel(canonical));
      }
    }
    return mergeMap;
  } catch {
    return new Map();
  }
}

/**
 * Apply a merge map to signals — remap themeLabels through the map.
 * Labels not in the map are kept as-is.
 */
export function applyLabelMergeMap(
  signals: RawSignal[],
  mergeMap: Map<string, string>,
): RawSignal[] {
  if (mergeMap.size === 0) return signals;
  return signals.map(s => {
    const remapped = s.themeLabels.map(l => mergeMap.get(l) ?? l);
    if (remapped.every((l, i) => l === s.themeLabels[i])) return s;
    return { ...s, themeLabels: remapped };
  });
}
