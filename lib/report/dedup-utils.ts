/**
 * lib/report/dedup-utils.ts
 *
 * Pure-TS deduplication helpers for report renderers.
 * No external deps, no side effects.
 *
 * Strategy: Jaccard word-overlap similarity on "significant" words (length > 3)
 * to avoid false matches on short function words ("the", "and", "with", etc.)
 *
 * Default threshold: 0.72  — tighter than the initially considered 0.65 to
 * avoid over-merging genuinely distinct findings that share domain vocabulary
 * (e.g. two separate "system fragmentation" issues with different root causes).
 *
 * Debug logging is gated on DEDUP_DEBUG=1 so it doesn't pollute production
 * output but can be enabled locally:
 *   DEDUP_DEBUG=1 yarn dev
 */

const DEBUG = process.env.DEDUP_DEBUG === '1';

/** Lowercase, strip punctuation, collapse whitespace */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Significant words only (length > 3 chars) */
function sigWords(s: string): Set<string> {
  return new Set(normalise(s).split(' ').filter(w => w.length > 3));
}

/**
 * Jaccard similarity between two strings using significant-word sets.
 * Returns 0–1.
 */
export function similarity(a: string, b: string): number {
  const sa = sigWords(a);
  const sb = sigWords(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const w of sa) { if (sb.has(w)) intersection++; }
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate a string array.
 * Keeps the first representative of each similarity cluster.
 * Items later in the array that are ≥ threshold similar to a kept item are dropped.
 *
 * @param strings   Input strings (order preserved for kept items)
 * @param threshold Jaccard threshold — default 0.72
 */
export function dedupeStrings(strings: string[], threshold = 0.72): string[] {
  const kept: string[] = [];
  for (const s of strings) {
    const isDupe = kept.some(k => {
      const sim = similarity(k, s);
      if (DEBUG && sim >= threshold) {
        console.log(`[dedup] DROP string (sim=${sim.toFixed(2)}):\n  kept: "${k}"\n  drop: "${s}"`);
      }
      return sim >= threshold;
    });
    if (!isDupe) kept.push(s);
  }
  if (DEBUG && kept.length < strings.length) {
    console.log(`[dedup] dedupeStrings: ${strings.length} → ${kept.length} (removed ${strings.length - kept.length})`);
  }
  return kept;
}

/**
 * Deduplicate an object array by a text field.
 * Keeps the first representative of each similarity cluster.
 *
 * @param items     Input objects
 * @param getText   Extracts the comparison text from each item
 * @param threshold Jaccard threshold — default 0.72
 */
export function dedupeBy<T>(items: T[], getText: (item: T) => string, threshold = 0.72): T[] {
  const kept: T[] = [];
  const keptTexts: string[] = [];
  for (const item of items) {
    const text = getText(item);
    const isDupe = keptTexts.some(kt => {
      const sim = similarity(kt, text);
      if (DEBUG && sim >= threshold) {
        console.log(`[dedup] DROP item (sim=${sim.toFixed(2)}):\n  kept: "${kt}"\n  drop: "${text}"`);
      }
      return sim >= threshold;
    });
    if (!isDupe) {
      kept.push(item);
      keptTexts.push(text);
    }
  }
  if (DEBUG && kept.length < items.length) {
    console.log(`[dedup] dedupeBy: ${items.length} → ${kept.length} (removed ${items.length - kept.length})`);
  }
  return kept;
}
