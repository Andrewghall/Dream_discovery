export type LiveIntentType = 'DREAM' | 'IDEA' | 'CONSTRAINT' | 'ASSUMPTION';

export type LiveDomain = 'People' | 'Operations' | 'Customer' | 'Technology' | 'Regulation';

export type LiveInterpretation = {
  intentType: LiveIntentType;
  domain: LiveDomain;
  confidence: number;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function countMatches(text: string, patterns: RegExp[]): number {
  let score = 0;
  for (const p of patterns) {
    if (p.test(text)) score += 1;
  }
  return score;
}

function normalize(text: string): string {
  return String(text || '').trim().toLowerCase();
}

export function interpretLiveUtterance(text: string): LiveInterpretation {
  const t = normalize(text);

  const intentScores: Record<LiveIntentType, number> = {
    DREAM: countMatches(t, [
      /\bdream\b/i,
      /\bhope\b/i,
      /\bwish\b/i,
      /\bwant\b/i,
      /\bwould\s+love\b/i,
      /\bimagine\b/i,
      /\bfuture\b/i,
      /\bshould\s+be\b/i,
    ]),
    IDEA: countMatches(t, [
      /\bidea\b/i,
      /\bwe\s+could\b/i,
      /\blet'?s\b/i,
      /\bmaybe\b/i,
      /\btry\b/i,
      /\bsolution\b/i,
      /\bapproach\b/i,
    ]),
    CONSTRAINT: countMatches(t, [
      /\bconstraint\b/i,
      /\bblocked\b/i,
      /\bcan'?t\b/i,
      /\bcannot\b/i,
      /\bwon'?t\b/i,
      /\blimited\b/i,
      /\bmust\b/i,
      /\bneed\s+to\b/i,
    ]),
    ASSUMPTION: countMatches(t, [
      /\bassume\b/i,
      /\bprobably\b/i,
      /\bI\s+think\b/i,
      /\bit\s+seems\b/i,
      /\bmaybe\b/i,
      /\blikely\b/i,
    ]),
  };

  const domainScores: Record<LiveDomain, number> = {
    People: countMatches(t, [/\bpeople\b/i, /\bteam\b/i, /\bstaff\b/i, /\bskills?\b/i, /\bculture\b/i, /\bleadership\b/i]),
    Operations: countMatches(t, [
      /\bops\b/i,
      /\boperation(s)?\b/i,
      /\bprocess(es)?\b/i,
      /\bworkflow\b/i,
      /\bgovernance\b/i,
      /\bdecision(s)?\b/i,
      /\borganisation\b/i,
      /\borganization\b/i,
    ]),
    Customer: countMatches(t, [/\bcustomer(s)?\b/i, /\bclient(s)?\b/i, /\buser(s)?\b/i, /\bservice\b/i, /\bexperience\b/i]),
    Technology: countMatches(t, [/\btech\b/i, /\btechnology\b/i, /\bsystem(s)?\b/i, /\bplatform\b/i, /\btool(s)?\b/i, /\bsoftware\b/i, /\bdata\b/i, /\bai\b/i]),
    Regulation: countMatches(t, [/\bregulation(s)?\b/i, /\bregulatory\b/i, /\bcompliance\b/i, /\blegal\b/i, /\bpolicy\b/i, /\baudit\b/i, /\brisk\b/i]),
  };

  const pickMax = <T extends string>(obj: Record<T, number>, fallback: T): { k: T; s: number } => {
    let bestK: T = fallback;
    let bestS = -1;
    for (const k of Object.keys(obj) as T[]) {
      const s = obj[k] ?? 0;
      if (s > bestS) {
        bestS = s;
        bestK = k;
      }
    }
    return { k: bestK, s: bestS };
  };

  const intentBest = pickMax(intentScores, 'ASSUMPTION');
  const domainBest = pickMax(domainScores, 'Operations');

  const totalSignal = intentBest.s + domainBest.s;
  const confidence = clamp01(totalSignal <= 0 ? 0.35 : 0.35 + 0.65 * (totalSignal / 6));

  return {
    intentType: intentBest.k,
    domain: domainBest.k,
    confidence,
  };
}
