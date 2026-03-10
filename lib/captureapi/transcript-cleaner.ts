/**
 * Deterministic, non-hallucinating transcript cleaner.
 *
 * TypeScript port of /Captureapi/offline/js/transcript-cleaner.js which is itself
 * a port of src/intelligence/transcript_cleaner.py.
 *
 * Cleans raw ASR output (Web Speech API) by removing stutters, fillers, and
 * duplicate words while fixing punctuation and casing.
 *
 * Critical guarantee: the output is a subsequence of the input tokens.
 * No new content words are ever invented.
 *
 * Used by desktop-capture-controls.tsx for offline (isLocalSession) speech recording.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CleanerConfig {
  removeFillers: boolean;
  fillerList: string[];
  fillerPhrases: string[];
  maxRepeatWord: number;
  maxRepeatBigram: number;
  preserveEmphasisRepeats: boolean;
  emphasisWords: Set<string>;
  fixPunctuation: boolean;
  fixCapitalization: boolean;
}

export interface CleanResult {
  cleanText: string;
  entities: unknown[];
  emotionalTone: string;
  confidence: number;
}

type ConfigOverrides = Partial<Omit<CleanerConfig, 'emphasisWords'>> & {
  emphasisWords?: string[] | Set<string>;
};

export function createDefaultConfig(overrides?: ConfigOverrides): CleanerConfig {
  const defaults: CleanerConfig = {
    removeFillers: true,
    fillerList: ['um', 'uh', 'erm', 'er', 'ah', 'hmm'],
    fillerPhrases: ['you know', 'i mean', 'basically', 'sort of', 'kind of'],
    maxRepeatWord: 1,
    maxRepeatBigram: 1,
    preserveEmphasisRepeats: true,
    emphasisWords: new Set([
      'very', 'really', 'so', 'much', 'never', 'always',
      'absolutely', 'totally', 'completely', 'extremely', 'super',
      'quite', 'far', 'way',
    ]),
    fixPunctuation: true,
    fixCapitalization: true,
  };
  if (!overrides) return defaults;

  const { emphasisWords, ...rest } = overrides;
  const config: CleanerConfig = { ...defaults, ...rest };

  // Ensure emphasisWords is a Set
  if (emphasisWords !== undefined) {
    config.emphasisWords = emphasisWords instanceof Set
      ? emphasisWords
      : new Set(emphasisWords);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Stopwords (allowed in output even if not counted in input)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'she',
  'it', 'its', 'they', 'them', 'their', 'who', 'what', 'which',
  'this', 'that', 'these', 'those',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'and', 'or', 'but', 'not', 'no', 'nor', 'so', 'if', 'as',
]);

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripTrailingPunct(word: string): string {
  return word.replace(/[.,!?;:]+$/, '');
}

// ---------------------------------------------------------------------------
// Stage 1 – whitespace normalisation
// ---------------------------------------------------------------------------

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Stage 2 – filler-phrase removal (before tokenisation)
// ---------------------------------------------------------------------------

function removeFillerPhrases(text: string, config: CleanerConfig): string {
  if (!config.removeFillers) return text;
  for (const phrase of config.fillerPhrases) {
    const pattern = new RegExp(
      '\\b' + escapeRegex(phrase) + '\\b[\\s,]*',
      'gi'
    );
    text = text.replace(pattern, ' ');
  }
  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Stage 3 – repeated-word collapse
// ---------------------------------------------------------------------------

function removeRepeatedWords(tokens: string[], config: CleanerConfig): string[] {
  if (!tokens.length) return tokens;

  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const wordLower = stripTrailingPunct(tokens[i].toLowerCase());

    // count consecutive identical words
    const runStart = i;
    while (
      i + 1 < tokens.length &&
      stripTrailingPunct(tokens[i + 1].toLowerCase()) === wordLower
    ) {
      i++;
    }
    const runLength = i - runStart + 1;

    let keep: number;
    if (config.preserveEmphasisRepeats && config.emphasisWords.has(wordLower)) {
      keep = Math.min(runLength, 2);
    } else {
      keep = Math.min(runLength, config.maxRepeatWord);
    }

    for (let j = runStart; j < runStart + keep; j++) {
      result.push(tokens[j]);
    }

    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stage 4 – repeated-bigram collapse
// ---------------------------------------------------------------------------

function removeRepeatedBigrams(tokens: string[], config: CleanerConfig): string[] {
  if (tokens.length < 4) return tokens.slice();

  const result: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (i + 3 < tokens.length) {
      const a0 = stripTrailingPunct(tokens[i].toLowerCase());
      const a1 = stripTrailingPunct(tokens[i + 1].toLowerCase());
      const b0 = stripTrailingPunct(tokens[i + 2].toLowerCase());
      const b1 = stripTrailingPunct(tokens[i + 3].toLowerCase());

      if (a0 === b0 && a1 === b1) {
        // count how many consecutive copies of this bigram
        let count = 1;
        let j = i + 2;
        while (
          j + 1 < tokens.length &&
          stripTrailingPunct(tokens[j].toLowerCase()) === a0 &&
          stripTrailingPunct(tokens[j + 1].toLowerCase()) === a1
        ) {
          count++;
          j += 2;
        }

        const keep = Math.min(count, config.maxRepeatBigram);
        for (let k = 0; k < keep; k++) {
          result.push(tokens[i + k * 2]);
          result.push(tokens[i + k * 2 + 1]);
        }

        i = j;
        continue;
      }
    }

    result.push(tokens[i]);
    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stage 5 – single-word filler removal (context-aware "like")
// ---------------------------------------------------------------------------

const SUBJECT_PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'we', 'they', 'who',
]);

const VERB_MODIFIERS = new Set([
  'would', 'could', 'should', 'might', 'will', 'do', "don't",
  "doesn't", "didn't", 'really', 'actually', 'also', 'always',
  'never', 'to', 'not',
]);

const COMPARISON_VERBS = new Set([
  'look', 'looks', 'looked', 'looking',
  'seem', 'seems', 'seemed', 'seeming',
  'feel', 'feels', 'felt', 'feeling',
  'sound', 'sounds', 'sounded', 'sounding',
  'something', 'anything', 'nothing', 'more',
]);

const BE_VERBS = new Set([
  'is', 'was', 'were', 'are', 'been', 'being', "it's", "that's",
]);

function isFillerLike(tokens: string[], idx: number): boolean {
  const prevRaw = idx > 0 ? tokens[idx - 1] : null;
  const prev = prevRaw ? stripTrailingPunct(prevRaw.toLowerCase()) : null;

  // Comma before "like" is the strongest filler signal
  if (prevRaw && prevRaw.endsWith(',')) return true;
  // sentence start
  if (idx === 0) return true;

  // Word-identity checks for verb / preposition patterns → keep "like"
  if (prev && SUBJECT_PRONOUNS.has(prev)) return false;
  if (prev && VERB_MODIFIERS.has(prev)) return false;
  if (prev && COMPARISON_VERBS.has(prev)) return false;
  if (prev && BE_VERBS.has(prev)) return false;

  // default: standalone "like" between content words is usually filler
  return true;
}

function removeSingleFillers(tokens: string[], config: CleanerConfig): string[] {
  if (!config.removeFillers) return tokens;

  const simpleFillers = new Set(config.fillerList.map((f) => f.toLowerCase()));
  const result: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const wordLower = stripTrailingPunct(tokens[i].toLowerCase());

    if (simpleFillers.has(wordLower)) continue;
    if (wordLower === 'like' && isFillerLike(tokens, i)) continue;

    result.push(tokens[i]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stage 6 – punctuation / capitalisation repair
// ---------------------------------------------------------------------------

function fixPunctuation(text: string, config: CleanerConfig): string {
  if (!text) return text;

  if (config.fixPunctuation) {
    // space before punctuation
    text = text.replace(/\s+([.,!?;:])/g, '$1');
    // double punctuation (but keep ellipsis)
    text = text.replace(/([.!?])\1(?!\1)/g, '$1');
    // missing space after comma
    text = text.replace(/,(?=\w)/g, ', ');
    // space after sentence-ending punctuation
    text = text.replace(/([.!?])\s*(\w)/g, (_match, p1: string, p2: string) => {
      return p1 + ' ' + p2;
    });
    // leading punctuation artefacts from filler removal
    text = text.replace(/^[\s,;]+/, '');
    // trailing comma
    text = text.replace(/,\s*$/, '');
    // ensure terminal punctuation
    text = text.trimEnd();
    if (text && !'.!?'.includes(text[text.length - 1])) {
      text += '.';
    }
  }

  if (config.fixCapitalization) {
    if (text) {
      text = text[0].toUpperCase() + text.slice(1);
    }
    // after sentence-ending punctuation
    text = text.replace(/([.!?]\s+)(\w)/g, (_match, p1: string, p2: string) => {
      return p1 + p2.toUpperCase();
    });
    // standalone "i"
    text = text.replace(/\bi\b/g, 'I');
  }

  return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

function cleanPipeline(text: string, config: CleanerConfig): string {
  text = normalizeWhitespace(text);
  if (!text) return '';

  text = removeFillerPhrases(text, config);
  if (!text) return '';

  let tokens = text.split(' ');
  tokens = removeRepeatedWords(tokens, config);
  tokens = removeRepeatedBigrams(tokens, config);
  tokens = removeSingleFillers(tokens, config);

  text = tokens.join(' ');
  if (!text.trim()) return '';

  text = fixPunctuation(text, config);
  return text;
}

// ---------------------------------------------------------------------------
// Validation – subsequence check
// ---------------------------------------------------------------------------

function tokenizeForValidation(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((tok) => tok.replace(/^[.,!?;:'"()\-]+|[.,!?;:'"()\-]+$/g, ''))
    .filter((t) => t.length > 0);
}

function validateSubsequence(inputText: string, outputText: string): boolean {
  if (!outputText.trim()) return true;

  const inTokens = tokenizeForValidation(inputText);
  const outTokens = tokenizeForValidation(outputText);

  const inCounts: Record<string, number> = {};
  for (const t of inTokens) {
    inCounts[t] = (inCounts[t] || 0) + 1;
  }

  const outCounts: Record<string, number> = {};
  for (const t of outTokens) {
    outCounts[t] = (outCounts[t] || 0) + 1;
  }

  for (const [token, count] of Object.entries(outCounts)) {
    if (STOPWORDS.has(token)) continue;
    if (count > (inCounts[token] || 0)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Rules-only fallback (ultra-safe)
// ---------------------------------------------------------------------------

function rulesOnlyClean(text: string): string {
  text = text.replace(/\s+/g, ' ').trim();
  if (text) {
    text = text[0].toUpperCase() + text.slice(1);
    text = text.replace(/\bi\b/g, 'I');
  }
  return text;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function cleanTranscript(text: string, config?: CleanerConfig): string {
  if (!config) config = createDefaultConfig();

  if (!text || !text.trim()) return text || '';

  const cleaned = cleanPipeline(text, config);

  if (validateSubsequence(text, cleaned)) return cleaned;

  // validation failed — fall back to ultra-safe cleaning
  return rulesOnlyClean(text);
}

export function cleanTranscriptStream(chunks: string[], config?: CleanerConfig): string[] {
  if (!config) config = createDefaultConfig();
  const results: string[] = [];
  for (const chunk of chunks) {
    if (chunk && chunk.trim()) {
      results.push(cleanTranscript(chunk, config));
    }
  }
  return results;
}

export function cleanAndWrap(text: string, config?: CleanerConfig): CleanResult {
  const cleaned = cleanTranscript(text, config);
  return {
    cleanText: cleaned,
    entities: [],
    emotionalTone: 'neutral',
    confidence: 0.85,
  };
}
