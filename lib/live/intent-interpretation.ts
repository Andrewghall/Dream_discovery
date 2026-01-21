export type LiveIntentType = 'DREAM' | 'IDEA' | 'CONSTRAINT' | 'ASSUMPTION';

export type TemporalIntent = 'CURRENT' | 'FUTURE' | 'LIMIT' | 'METHOD';

export type CognitiveType =
  | 'VISION'
  | 'OUTCOME'
  | 'OPPORTUNITY'
  | 'ENABLER'
  | 'BLOCKER'
  | 'INSIGHT'
  | 'QUESTION';

export type ConfidenceWeight = 'low' | 'mid' | 'high';

export type LiveDomain = 'People' | 'Operations' | 'Customer' | 'Technology' | 'Regulation';

export type LiveInterpretation = {
  temporalIntent: TemporalIntent;
  hemispherePhase: 'REIMAGINE' | 'CONSTRAINTS' | 'DEFINE_APPROACH' | null;
  cognitiveTypes: CognitiveType[];
  domains: LiveDomain[];
  confidenceWeight: ConfidenceWeight;
  confidence: number;

  intentType: LiveIntentType;
  domain: LiveDomain;
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

function unique<T>(arr: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function scoreDomains(t: string): Array<{ d: LiveDomain; score: number }> {
  return [
    {
      d: 'People',
      score: countMatches(t, [
        /\bpeople\b/i,
        /\bteam\b/i,
        /\bstaff\b/i,
        /\bskills?\b/i,
        /\bculture\b/i,
        /\bleadership\b/i,
        /\bcapability\b/i,
        /\bempower(ed|ment)?\b/i,
        /\bescalat(e|ion)\b/i,
        /\bnew\s+starter(s)?\b/i,
        /\bonboarding\b/i,
        /\bexpertise\b/i,
        /\bproductive\b/i,
        /\bshared\b/i,
      ]),
    },
    {
      d: 'Operations',
      score: countMatches(t, [
        /\bops\b/i,
        /\boperation(s)?\b/i,
        /\bprocess(es)?\b/i,
        /\bworkflow\b/i,
        /\bflow(s)?\b/i,
        /\bgovernance\b/i,
        /\bdecision(s)?\b/i,
        /\borganisation\b/i,
        /\borganization\b/i,
        /\bend\s*to\s*end\b/i,
        /\bhandoff(s)?\b/i,
        /\bqueue(s)?\b/i,
        /\bstall(ing)?\b/i,
        /\bownership\b/i,
        /\bexception(s)?\b/i,
        /\bwaste\b/i,
        /\bsymptom(s)?\b/i,
        /\bcause(s)?\b/i,
      ]),
    },
    {
      d: 'Customer',
      score: countMatches(t, [
        /\bcustomer(s)?\b/i,
        /\bclient(s)?\b/i,
        /\buser(s)?\b/i,
        /\bservice\b/i,
        /\bexperience\b/i,
        /\bchannel(s)?\b/i,
        /\bjourney\b/i,
        /\brepeat\s+(myself|yourself|themselves|ourselves)\b/i,
        /\bcommunication\b/i,
        /\bproactive\b/i,
      ]),
    },
    {
      d: 'Technology',
      score: countMatches(t, [
        /\btech\b/i,
        /\btechnology\b/i,
        /\bsystem(s)?\b/i,
        /\bplatform\b/i,
        /\btool(s)?\b/i,
        /\bsoftware\b/i,
        /\bdata\b/i,
        /\bdata\s+quality\b/i,
        /\bversion\s+of\s+the\s+truth\b/i,
        /\breal[- ]time\b/i,
        /\binsight\b/i,
        /\bai\b/i,
        /\bintegration\b/i,
        /\bautomation\b/i,
      ]),
    },
    {
      d: 'Regulation',
      score: countMatches(t, [
        /\bregulation(s)?\b/i,
        /\bregulatory\b/i,
        /\bcompliance\b/i,
        /\blegal\b/i,
        /\bpolicy\b/i,
        /\baudit\b/i,
        /\brisk\b/i,
        /\bcontrol(s)?\b/i,
        /\bevidence\b/i,
        /\bpreventative\b/i,
      ]),
    },
  ];
}

function pickBestDomain(scores: Array<{ d: LiveDomain; score: number }>): LiveDomain {
  let best: LiveDomain = 'Operations';
  let bestS = scores.find((x) => x.d === 'Operations')?.score ?? -1;
  for (const s of scores) {
    if (s.score > bestS) {
      bestS = s.score;
      best = s.d;
    }
  }
  return best;
}

function classifyTemporalIntent(t: string): TemporalIntent {
  const strongYetLimit =
    /\b(not|isn'?t|aren'?t|can'?t|cannot|won'?t)\b[^.?!]{0,40}\byet\b/i.test(t) ||
    /\byet\b[^.?!]{0,20}\b(not|isn'?t|aren'?t|can'?t|cannot|won'?t)\b/i.test(t);
  if (strongYetLimit) return 'LIMIT';

  const negatedConstraintPhrase =
    /\b(no|without|never)\b[^.?!]{0,35}\b(queue|queues|handoff|handoffs|stall|stalls|stalling|manual|firefighting|workaround|duplication)\b/i.test(
      t
    );

  const limit = countMatches(t, [
    /\bblocked\b/i,
    /\bblocker(s)?\b/i,
    /\bconstraint(s)?\b/i,
    /\brisk\b/i,
    /\bcan'?t\b/i,
    /\bcannot\b/i,
    /\bwon'?t\b/i,
    /\blimited\b/i,
    /\bmanual(ly)?\b/i,
    /\bworkaround(s)?\b/i,
    /\bduplication\b/i,
    /\bfirefight(ing)?\b/i,
    /\bqueue(s)?\b/i,
    /\bhandoff(s)?\b/i,
    /\bstall(ing)?\b/i,
    /\bcapacity\b/i,
    /\bnot\b[^.?!]{0,40}\byet\b/i,
    /\bisn'?t\b[^.?!]{0,40}\byet\b/i,
    /\baren'?t\b[^.?!]{0,40}\byet\b/i,
    /\bstill\b[^.?!]{0,40}\bmanual\b/i,
    /\bstill\b[^.?!]{0,40}\bdependent\b/i,
    /\bdepends?\s+on\b/i,
    /\bapproval\b/i,
    /\bsign[- ]off\b/i,
  ]);

  const explicitProblemContext = countMatches(t, [
    /\bone\s+challenge\b/i,
    /\bthe\s+challenge\b/i,
    /\bthe\s+problem\b/i,
    /\bthe\s+issue\b/i,
  ]);

  const explicitLimitSignals = countMatches(t, [
    /\blimited\b/i,
    /\bdependent\b/i,
    /\bmanual(ly)?\b/i,
    /\binconsistent\b/i,
    /\bnot\s+consistent\b/i,
    /\bdata\s+quality\b/i,
  ]);

  const method = countMatches(t, [
    /\bdeliver\b/i,
    /\bimplementation\b/i,
    /\bimplement\b/i,
    /\broll\s*out\b/i,
    /\bdeploy\b/i,
    /\bbuild\b/i,
    /\bpilot\b/i,
    /\broadmap\b/i,
    /\bsprint\b/i,
    /\bphase\b/i,
    /\bchange\s+management\b/i,
    /\btraining\b/i,
  ]);

  const current = countMatches(t, [
    /\btoday\b/i,
    /\bcurrently\b/i,
    /\bright\s+now\b/i,
    /\bat\s+the\s+moment\b/i,
    /\bas\s+is\b/i,
    /\bwe\s+are\b/i,
    /\bwe\s+have\b/i,
    /\bwe're\b/i,
    /\bwe've\b/i,
  ]);

  const future = countMatches(t, [
    /\bwe\s+want\b/i,
    /\bwe\s+need\b/i,
    /\bwe\s+should\b/i,
    /\bshould\s+be\b/i,
    /\bwould\b/i,
    /\bideally\b/i,
    /\bimagine\b/i,
    /\bfuture\b/i,
    /\bnever\b/i,
    /\balways\b/i,
    /\bno\s+longer\b/i,
    /\banymore\b/i,
    /\bwithout\s+stalling\b/i,
    /\bwithout\s+manual\s+effort\b/i,
    /\bend\s*to\s*end\b/i,
    /\bseamless\b/i,
    /\bautomatically\b/i,
    /\bjoined\s+up\b/i,
    /\bjoined-?up\b/i,
    /\bsingle\s+(customer\s+)?view\b/i,
    /\bconsistent\b/i,
    /\bconsisten(cy|t)\b/i,
    /\bintentionally\s+designed\b/i,
    /\bproactive\b/i,
    /\bpreventative\b/i,
    /\bvisible\s+early\b/i,
    /\bexists\s+without\b/i,
    /\bstand\s+out\b/i,
    /\bfix\s+causes\b/i,
    /\bversion\s+of\s+the\s+truth\b/i,
    /\bin\s+the\s+future\s+model\b/i,
    /\bto\s+make\s+this\s+work\b/i,
    /\bunderpin(s|ning)?\b/i,
    /\benable(s|d|ing)?\b/i,
    /\bis\s+critical\b/i,
    /\bvisibility\b/i,
    /\bownership\b/i,
    /\bclarity\b/i,
    /\bif\s+this\s+is\s+working\b/i,
    /\bscales?\b/i,
    /\bwithout\s+linear\b/i,
    /\bfeel(s)?\s+simple\b/i,
    /\bjust\s+works\b/i,
    /\binvisible\b/i,
  ]);

  const futureAdjusted = future + (negatedConstraintPhrase ? 2 : 0);
  const limitAdjusted = negatedConstraintPhrase ? 0 : limit;

  if (
    current > 0 &&
    (explicitProblemContext > 0 || explicitLimitSignals > 0) &&
    limitAdjusted > 0 &&
    futureAdjusted > 0
  ) {
    return 'LIMIT';
  }

  if (limitAdjusted >= 2) return 'LIMIT';
  if (method >= 2 && limitAdjusted === 0) return 'METHOD';
  if (futureAdjusted >= 2 && current === 0) return 'FUTURE';
  if (limitAdjusted > 0 && (explicitProblemContext > 0 || explicitLimitSignals > 0)) return 'LIMIT';
  if (limitAdjusted > 0 && limitAdjusted >= method && futureAdjusted === 0) return 'LIMIT';
  if (method > 0 && method > future && method > limit) return 'METHOD';
  if (futureAdjusted > 0 && futureAdjusted >= current) return 'FUTURE';
  if (current > 0) return 'CURRENT';
  return 'CURRENT';
}

function temporalToPhase(t: TemporalIntent): LiveInterpretation['hemispherePhase'] {
  if (t === 'FUTURE') return 'REIMAGINE';
  if (t === 'LIMIT') return 'CONSTRAINTS';
  if (t === 'METHOD') return 'DEFINE_APPROACH';
  return null;
}

function classifyCognitiveTypes(t: string, temporal: TemporalIntent): CognitiveType[] {
  const out: CognitiveType[] = [];

  const isQuestion = /\?\s*$/.test(t) || /^\s*(why|what|how|when|where|who)\b/i.test(t);
  if (isQuestion) out.push('QUESTION');

  const negatedConstraintContext =
    /\b(no\s+longer|without|never|not)\b[^.?!]{0,40}\b(constraint|constraints|risk|manual|queue|queues|handoff|handoffs|stall|stalls|stalling|workaround|duplication|firefight(ing)?)\b/i.test(
      t
    ) ||
    /\b(constraint|constraints|risk|manual|queue|queues|handoff|handoffs|stall|stalls|stalling|workaround|duplication|firefight(ing)?)\b[^.?!]{0,40}\b(no\s+longer|without|never|not)\b/i.test(
      t
    );

  const blocker = countMatches(t, [
    /\bblocked\b/i,
    /\bblocker(s)?\b/i,
    /\bconstraint(s)?\b/i,
    /\brisk\b/i,
    /\bcan'?t\b/i,
    /\bcannot\b/i,
    /\bwon'?t\b/i,
    /\bdependency\b/i,
    /\bdepends?\s+on\b/i,
  ]);
  if (temporal === 'LIMIT' || (blocker > 0 && !negatedConstraintContext)) out.push('BLOCKER');

  const enabler = countMatches(t, [
    /\benable(s|d|ing)?\b/i,
    /\benabler\b/i,
    /\bcapabilit(y|ies)\b/i,
    /\brequires?\b/i,
    /\bneed(s)?\s+to\b/i,
    /\bdata\b/i,
    /\bintegration\b/i,
    /\bautomation\b/i,
    /\btraining\b/i,
    /\bvisibility\b/i,
    /\bownership\b/i,
    /\baccountability\b/i,
    /\bunderpin(s|ning)?\b/i,
    /\bfoundation(s)?\b/i,
    /\bshared\s+understanding\b/i,
    /\bknowledge\b/i,
    /\bcontext\b/i,
    /\bversion\s+of\s+the\s+truth\b/i,
  ]);
  if (enabler > 0 && temporal !== 'LIMIT') out.push('ENABLER');

  const opportunity = countMatches(t, [
    /\bopportunit(y|ies)\b/i,
    /\bwe\s+could\b/i,
    /\bmaybe\b/i,
    /\bpotential\b/i,
    /\bchance\b/i,
  ]);
  if (opportunity > 0) out.push('OPPORTUNITY');

  const outcome = countMatches(t, [
    /\breduce\b/i,
    /\bincrease\b/i,
    /\bimprove\b/i,
    /\bfaster\b/i,
    /\bslower\b/i,
    /\bless\b/i,
    /\bmore\b/i,
    /\bconsistent\b/i,
    /\bend\s*to\s*end\b/i,
    /\bautomatically\b/i,
    /\bnever\b/i,
  ]);
  if (temporal === 'FUTURE' && outcome > 0) out.push('OUTCOME');

  const vision = countMatches(t, [
    /\btarget\s+operating\s+model\b/i,
    /\bfuture\s+state\b/i,
    /\bjoined\s+up\b/i,
    /\bintentionally\s+designed\b/i,
    /\bseamless\b/i,
    /\bsingle\s+(customer\s+)?view\b/i,
    /\bflows?\s+end\s*to\s*end\b/i,
  ]);
  if (temporal === 'FUTURE' && (vision > 0 || outcome > 0)) out.push('VISION');

  const insight = countMatches(t, [
    /\bi\s+think\b/i,
    /\bit\s+seems\b/i,
    /\bwe\s+learned\b/i,
    /\bthe\s+issue\s+is\b/i,
    /\bthe\s+problem\s+is\b/i,
    /\bin\s+practice\b/i,
  ]);
  if (insight > 0 && temporal !== 'FUTURE') out.push('INSIGHT');

  if (out.length === 0) {
    if (temporal === 'FUTURE') out.push('VISION');
    else if (temporal === 'LIMIT') out.push('BLOCKER');
    else if (temporal === 'METHOD') out.push('OPPORTUNITY');
    else out.push('INSIGHT');
  }

  return unique(out);
}

function confidenceFromSignals(signals: number): { confidence: number; weight: ConfidenceWeight } {
  const c = clamp01(0.25 + 0.75 * clamp01(signals / 6));
  const w: ConfidenceWeight = c >= 0.78 ? 'high' : c >= 0.55 ? 'mid' : 'low';
  return { confidence: c, weight: w };
}

function legacyIntentType(temporal: TemporalIntent, cognitive: CognitiveType[]): LiveIntentType {
  if (temporal === 'LIMIT' || cognitive.includes('BLOCKER')) return 'CONSTRAINT';
  if (temporal === 'METHOD') return 'IDEA';
  if (temporal === 'FUTURE') return 'DREAM';
  return 'ASSUMPTION';
}

export function interpretLiveUtterance(text: string): LiveInterpretation {
  const t = normalize(text);

  const temporalIntent = classifyTemporalIntent(t);
  const hemispherePhase = temporalToPhase(temporalIntent);
  const cognitiveTypes = classifyCognitiveTypes(t, temporalIntent);

  const domainScores = scoreDomains(t);
  const domains = domainScores
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.d);
  const domain = domains[0] ?? pickBestDomain(domainScores);

  const { confidence, weight } = confidenceFromSignals(
    domainScores.reduce((acc, x) => acc + (x.score > 0 ? 1 : 0), 0) +
      cognitiveTypes.length +
      (temporalIntent === 'FUTURE' ? 2 : temporalIntent === 'LIMIT' ? 2 : 1)
  );

  const intentType = legacyIntentType(temporalIntent, cognitiveTypes);

  return {
    temporalIntent,
    hemispherePhase,
    cognitiveTypes,
    domains: domains.length ? domains : [domain],
    confidenceWeight: weight,
    confidence,
    intentType,
    domain,
  };
}
