// relax-text.ts
// Converts formal written English to natural spoken contractions.
// Applied to all TTS text so the voice sounds conversational regardless
// of whether the LLM wrote formally or not.

const CONTRACTIONS: [RegExp, string][] = [
  // Pronoun + verb
  [/\bI am\b/gi,        "I'm"],
  [/\bI will\b/gi,      "I'll"],
  [/\bI have\b/gi,      "I've"],
  [/\bI would\b/gi,     "I'd"],
  [/\bI had\b/gi,       "I'd"],
  [/\byou are\b/gi,     "you're"],
  [/\byou will\b/gi,    "you'll"],
  [/\byou have\b/gi,    "you've"],
  [/\byou would\b/gi,   "you'd"],
  [/\byou had\b/gi,     "you'd"],
  [/\bwe are\b/gi,      "we're"],
  [/\bwe will\b/gi,     "we'll"],
  [/\bwe have\b/gi,     "we've"],
  [/\bwe would\b/gi,    "we'd"],
  [/\bthey are\b/gi,    "they're"],
  [/\bthey will\b/gi,   "they'll"],
  [/\bthey have\b/gi,   "they've"],
  [/\bthey would\b/gi,  "they'd"],
  [/\bhe is\b/gi,       "he's"],
  [/\bhe has\b/gi,      "he's"],
  [/\bhe will\b/gi,     "he'll"],
  [/\bhe would\b/gi,    "he'd"],
  [/\bshe is\b/gi,      "she's"],
  [/\bshe has\b/gi,     "she's"],
  [/\bshe will\b/gi,    "she'll"],
  [/\bshe would\b/gi,   "she'd"],

  // it / that / there / what / who
  [/\bit is\b/gi,        "it's"],
  [/\bit has\b/gi,       "it's"],
  [/\bit will\b/gi,      "it'll"],
  [/\bit would\b/gi,     "it'd"],
  [/\bthat is\b/gi,      "that's"],
  [/\bthat has\b/gi,     "that's"],
  [/\bthat will\b/gi,    "that'll"],
  [/\bthat would\b/gi,   "that'd"],
  [/\bthere is\b/gi,     "there's"],
  [/\bthere has\b/gi,    "there's"],
  [/\bthere will\b/gi,   "there'll"],
  [/\bwhat is\b/gi,      "what's"],
  [/\bwhat has\b/gi,     "what's"],
  [/\bwhat will\b/gi,    "what'll"],
  [/\bwho is\b/gi,       "who's"],
  [/\bwho has\b/gi,      "who's"],
  [/\bwho will\b/gi,     "who'll"],
  [/\bhow is\b/gi,       "how's"],
  [/\bwhere is\b/gi,     "where's"],

  // Negations
  [/\bcannot\b/gi,       "can't"],
  [/\bdo not\b/gi,       "don't"],
  [/\bdoes not\b/gi,     "doesn't"],
  [/\bdid not\b/gi,      "didn't"],
  [/\bis not\b/gi,       "isn't"],
  [/\bare not\b/gi,      "aren't"],
  [/\bwas not\b/gi,      "wasn't"],
  [/\bwere not\b/gi,     "weren't"],
  [/\bhave not\b/gi,     "haven't"],
  [/\bhas not\b/gi,      "hasn't"],
  [/\bhad not\b/gi,      "hadn't"],
  [/\bwill not\b/gi,     "won't"],
  [/\bwould not\b/gi,    "wouldn't"],
  [/\bcould not\b/gi,    "couldn't"],
  [/\bshould not\b/gi,   "shouldn't"],
  [/\bmight not\b/gi,    "mightn't"],
  [/\bmust not\b/gi,     "mustn't"],
  [/\bneed not\b/gi,     "needn't"],

  // Let us
  [/\blet us\b/gi,       "let's"],
];

// Small integers (0–20) and common round numbers that TTS may misread as
// individual digit names or with awkward pacing.
const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
  '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
  '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
};

/**
 * Strip em dashes and en dashes — they cause unnatural pauses or mispronunciation
 * in TTS. Replace with a comma+space (keeps the rhythm) or just a space.
 */
function stripDashes(text: string): string {
  // Em dash (—) and en dash (–): replace with comma+space for a natural pause
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ');
}

/**
 * Expand small standalone integers to spoken words so ElevenLabs reads them
 * naturally. Only expands numbers that appear as isolated tokens (not inside
 * longer numbers or decimals).
 */
function expandNumbers(text: string): string {
  // Match standalone integers (word boundary, not preceded/followed by digit or decimal point)
  return text.replace(/\b(\d{1,2})\b(?!\s*%|\s*st\b|\s*nd\b|\s*rd\b|\s*th\b)/g, (match) => {
    return NUMBER_WORDS[match] ?? match;
  });
}

// Consulting-speak clichés to strip from spoken output.
// Each entry is [pattern, replacement]. Patterns are case-insensitive.
// These phrases sound robotic or formulaic when spoken aloud.
const CLICHE_STRIPS: [RegExp, string][] = [
  [/\blet'?s drill (?:down|into|deeper)(?: on| into)?\b,?\s*/gi, ''],
  [/\blet'?s dive (?:in|into|deeper)(?: on| into)?\b,?\s*/gi, ''],
  [/\blet'?s dig (?:into|deeper|in|down)(?: on| into| further)?\b,?\s*/gi, ''],
  [/\blet'?s explore(?: that| this| further)?\b,?\s*/gi, ''],
  [/\blet'?s unpack(?: that| this)?\b,?\s*/gi, ''],
  [/\blet me (?:push|dig|drill|probe)(?: on| into| further| deeper| down)?\b,?\s*/gi, ''],
  [/\bbuilding on that,?\s*/gi, ''],
  [/\bthat'?s (?:interesting|fascinating|insightful),?\s*/gi, ''],
  [/\bgoing deeper(?: on| into)?\b,?\s*/gi, ''],
  [/\bdrilling (?:into|down on|deeper into)\b,?\s*/gi, ''],
  [/\bdiving (?:into|deeper into)\b,?\s*/gi, ''],
];

/**
 * Strip consulting clichés that sound robotic when spoken.
 * Applied after contractions so we catch "let's" after expansion.
 */
function stripCliches(text: string): string {
  let out = text;
  for (const [pattern, replacement] of CLICHE_STRIPS) {
    out = out.replace(pattern, replacement);
  }
  // Capitalise after stripping if the result starts lowercase
  return out.replace(/^([a-z])/, (c) => c.toUpperCase()).replace(/\s{2,}/g, ' ').trim();
}

/**
 * Apply natural spoken contractions to text before it goes to TTS.
 * Preserves original casing on the first word of each contraction.
 */
export function relaxText(text: string): string {
  let out = text;
  // Strip dashes first — must happen before number/contraction passes
  out = stripDashes(out);
  // Expand small numbers first so they read naturally before contraction pass
  out = expandNumbers(out);
  for (const [pattern, replacement] of CONTRACTIONS) {
    out = out.replace(pattern, (match) => {
      // Preserve sentence-start capitalisation
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  // Strip consulting clichés last — after contractions so "let us" → "let's" is already done
  out = stripCliches(out);
  return out;
}
