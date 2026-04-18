import type { DomainDefinition, LensPack } from './types';

const PEOPLE_DOMAIN: DomainDefinition = {
  id: 'people',
  name: 'People',
  synonyms: ['staff', 'team', 'workforce', 'employees', 'headcount', 'talent', 'resource', 'personnel'],
  ontology_terms: [
    'hire', 'hiring', 'recruit', 'recruitment', 'onboard', 'onboarding', 'retain', 'retention',
    'turnover', 'attrition', 'skill', 'skills', 'capability', 'training', 'development',
    'performance', 'culture', 'engagement', 'burnout', 'capacity', 'bandwidth', 'understaffed',
    'overstaffed', 'reskill', 'upskill', 'headcount', 'role', 'responsibility', 'accountability',
    'manager', 'leadership', 'morale', 'wellbeing', 'workload', 'productivity', 'incentive',
    'compensation', 'salary', 'bonus', 'promotion', 'career', 'succession', 'team dynamics',
  ],
  causal_markers: [
    'because we lack', 'due to staffing', 'shortage of', 'not enough people', 'no one owns',
    'no ownership', 'team is stretched', 'people are leaving', 'hard to hire', 'skills gap',
    'capability gap', 'no expertise', 'resource constraint', 'bandwidth issue',
  ],
  action_targets: [
    'hire', 'train', 'restructure', 'reassign', 'promote', 'recruit', 'develop', 'coach',
    'incentivise', 'retain', 'backfill', 'redeploy', 'upskill', 'reskill',
  ],
  business_objects: [
    'team', 'squad', 'department', 'function', 'role', 'headcount', 'workforce', 'talent pool',
    'org chart', 'succession plan', 'performance review', 'job description',
  ],
  impact_surfaces: [
    'morale', 'productivity', 'retention', 'culture', 'performance', 'capability', 'velocity',
  ],
};

const PROCESS_DOMAIN: DomainDefinition = {
  id: 'process',
  name: 'Process',
  synonyms: ['workflow', 'procedure', 'operations', 'ops', 'process', 'method', 'approach'],
  ontology_terms: [
    'bottleneck', 'handoff', 'handover', 'step', 'stage', 'gate', 'approval', 'sign-off',
    'sign off', 'escalation', 'exception', 'manual', 'automated', 'standardise', 'standardize',
    'optimise', 'optimize', 'streamline', 'inefficiency', 'waste', 'rework', 'duplication',
    'friction', 'delay', 'turnaround', 'SLA', 'throughput', 'queue', 'backlog', 'pipeline',
    'workflow', 'checklist', 'runbook', 'playbook', 'SOC', 'audit', 'compliance check',
    'review cycle', 'cadence', 'routine', 'exception handling', 'escalation path',
  ],
  causal_markers: [
    'process is broken', 'no process', 'unclear process', 'inconsistent process',
    'takes too long', 'too many steps', 'too many approvals', 'manual process',
    'falls through the cracks', 'no handoff', 'unclear ownership', 'repeated rework',
    'we keep doing', 'every time we', 'whenever we',
  ],
  action_targets: [
    'streamline', 'automate', 'redesign', 'eliminate', 'simplify', 'standardise', 'document',
    'audit', 'review', 'optimise', 'reduce steps', 'remove friction', 'consolidate',
  ],
  business_objects: [
    'process', 'workflow', 'procedure', 'policy', 'SOP', 'runbook', 'playbook',
    'checklist', 'approval chain', 'review cycle', 'escalation path', 'handoff',
  ],
  impact_surfaces: [
    'speed', 'quality', 'consistency', 'cost', 'compliance', 'customer experience', 'reliability',
  ],
};

const TECHNOLOGY_DOMAIN: DomainDefinition = {
  id: 'technology',
  name: 'Technology',
  synonyms: ['tech', 'system', 'platform', 'software', 'tool', 'infrastructure', 'IT', 'digital'],
  ontology_terms: [
    'system', 'platform', 'software', 'application', 'app', 'tool', 'database', 'API',
    'integration', 'infrastructure', 'cloud', 'legacy', 'migration', 'upgrade', 'deploy',
    'deployment', 'release', 'bug', 'error', 'crash', 'outage', 'downtime', 'latency',
    'performance', 'scalability', 'security', 'data', 'analytics', 'dashboard', 'report',
    'automation', 'machine learning', 'AI', 'algorithm', 'architecture', 'microservice',
    'monolith', 'technical debt', 'refactor', 'rewrite', 'vendor', 'licence', 'license',
    'SaaS', 'PaaS', 'IaaS', 'ERP', 'CRM', 'CMS', 'stack', 'framework', 'library', 'module',
  ],
  causal_markers: [
    'system does not', 'system cannot', 'platform lacks', 'no integration', 'cannot integrate',
    'technical limitation', 'legacy system', 'outdated technology', 'not scalable',
    'data is siloed', 'no single source of truth', 'manual workaround', 'workaround',
    'system is too slow', 'crashes when', 'fails when',
  ],
  action_targets: [
    'build', 'deploy', 'migrate', 'upgrade', 'replace', 'integrate', 'automate', 'optimise',
    'refactor', 'rewrite', 'consolidate', 'configure', 'implement', 'roll out',
  ],
  business_objects: [
    'system', 'platform', 'application', 'database', 'API', 'integration', 'infrastructure',
    'data pipeline', 'dashboard', 'report', 'tool', 'service', 'module', 'feature',
  ],
  impact_surfaces: [
    'reliability', 'performance', 'scalability', 'security', 'cost', 'speed', 'data quality',
    'user experience', 'maintainability', 'compliance',
  ],
};

const ORGANISATION_DOMAIN: DomainDefinition = {
  id: 'organisation',
  name: 'Organisation',
  synonyms: ['org', 'structure', 'governance', 'strategy', 'leadership', 'management', 'executive'],
  ontology_terms: [
    'strategy', 'strategic', 'governance', 'structure', 'hierarchy', 'reporting line',
    'decision making', 'decision-making', 'accountability', 'ownership', 'mandate',
    'budget', 'investment', 'priority', 'prioritisation', 'alignment', 'misalignment',
    'change management', 'transformation', 'initiative', 'programme', 'project portfolio',
    'steering committee', 'board', 'executive', 'C-suite', 'stakeholder', 'sponsor',
    'business case', 'ROI', 'OKR', 'KPI', 'target', 'objective', 'goal', 'vision', 'mission',
    'culture', 'values', 'operating model', 'silos', 'cross-functional', 'matrix',
  ],
  causal_markers: [
    'no clear ownership', 'unclear mandate', 'no decision maker', 'conflicting priorities',
    'not aligned', 'no buy-in', 'leadership does not', 'no executive sponsor',
    'org is structured', 'siloed', 'not joined up', 'competing agendas',
    'no clear strategy', 'strategy is unclear',
  ],
  action_targets: [
    'restructure', 'reorganise', 'align', 'prioritise', 'invest', 'sponsor', 'approve',
    'mandate', 'set direction', 'define', 'communicate', 'escalate', 'govern',
  ],
  business_objects: [
    'organisation', 'structure', 'governance model', 'operating model', 'business unit',
    'division', 'department', 'function', 'team', 'steering committee', 'board', 'strategy',
    'roadmap', 'portfolio', 'programme', 'initiative',
  ],
  impact_surfaces: [
    'alignment', 'accountability', 'agility', 'execution', 'culture', 'performance',
    'risk', 'compliance', 'stakeholder confidence',
  ],
};

const CUSTOMER_DOMAIN: DomainDefinition = {
  id: 'customer',
  name: 'Customer',
  synonyms: ['client', 'user', 'buyer', 'consumer', 'end user', 'customer base', 'account'],
  ontology_terms: [
    'customer', 'client', 'user', 'buyer', 'consumer', 'prospect', 'lead', 'churn',
    'retention', 'acquisition', 'onboarding', 'journey', 'experience', 'satisfaction',
    'NPS', 'CSAT', 'feedback', 'complaint', 'support', 'service', 'need', 'pain point',
    'expectation', 'demand', 'preference', 'behaviour', 'behavior', 'segment', 'persona',
    'loyalty', 'advocacy', 'referral', 'engagement', 'touchpoint', 'channel', 'interaction',
    'purchase', 'conversion', 'funnel', 'lifetime value', 'LTV', 'ARR', 'MRR',
  ],
  causal_markers: [
    'customers are leaving', 'clients are unhappy', 'poor customer experience',
    'customers cannot', 'users struggle to', 'customers expect', 'we are losing customers',
    'customer complaint', 'high churn', 'low NPS', 'customers do not understand',
    'hard for customers', 'friction for the customer',
  ],
  action_targets: [
    'improve experience', 'reduce churn', 'increase satisfaction', 'onboard better',
    'support', 'engage', 'retain', 'acquire', 'upsell', 'cross-sell', 'resolve complaints',
    'personalise', 'simplify', 'communicate better',
  ],
  business_objects: [
    'customer', 'client', 'account', 'segment', 'persona', 'journey map', 'touchpoint',
    'support ticket', 'complaint', 'feedback', 'NPS score', 'churn rate', 'LTV',
  ],
  impact_surfaces: [
    'satisfaction', 'retention', 'revenue', 'loyalty', 'NPS', 'churn', 'advocacy', 'growth',
  ],
};

const COMMERCIAL_DOMAIN: DomainDefinition = {
  id: 'commercial',
  name: 'Commercial',
  synonyms: ['financial', 'revenue', 'commercial', 'sales', 'profit', 'cost', 'margin', 'pricing'],
  ontology_terms: [
    'revenue', 'profit', 'margin', 'cost', 'price', 'pricing', 'discount', 'contract',
    'commercial', 'financial', 'budget', 'forecast', 'target', 'quota', 'pipeline',
    'deal', 'opportunity', 'bid', 'tender', 'proposal', 'negotiation', 'partnership',
    'supplier', 'vendor', 'procurement', 'spend', 'savings', 'efficiency', 'payback',
    'break-even', 'investment', 'ROI', 'ARR', 'MRR', 'GMV', 'EBITDA', 'P&L',
    'cash flow', 'working capital', 'credit', 'payment', 'invoice', 'billing',
  ],
  causal_markers: [
    'not profitable', 'losing money', 'costs are too high', 'margin is shrinking',
    'revenue is declining', 'missing targets', 'not hitting quota', 'price pressure',
    'commercial risk', 'financial constraint', 'budget is cut', 'no budget',
    'cannot afford', 'ROI is unclear', 'cost to serve',
  ],
  action_targets: [
    'reduce costs', 'increase revenue', 'improve margins', 'renegotiate', 'price correctly',
    'close deals', 'win contracts', 'cut spend', 'invest', 'monetise', 'commercialise',
  ],
  business_objects: [
    'contract', 'deal', 'proposal', 'budget', 'forecast', 'P&L', 'revenue target',
    'cost centre', 'pricing model', 'discount policy', 'commercial terms', 'SLA',
  ],
  impact_surfaces: [
    'revenue', 'margin', 'profitability', 'cost', 'cash flow', 'growth', 'competitiveness',
  ],
};

const COMPLIANCE_DOMAIN: DomainDefinition = {
  id: 'compliance',
  name: 'Compliance',
  synonyms: ['regulatory', 'legal', 'risk', 'governance', 'audit', 'compliance', 'policy'],
  ontology_terms: [
    'compliance', 'regulation', 'regulatory', 'legal', 'law', 'legislation', 'policy',
    'standard', 'framework', 'audit', 'risk', 'control', 'GDPR', 'HIPAA', 'SOX', 'ISO',
    'accreditation', 'certification', 'licence', 'license', 'permit', 'approval',
    'breach', 'violation', 'penalty', 'fine', 'liability', 'indemnity', 'contract',
    'obligation', 'requirement', 'mandate', 'rule', 'restriction', 'constraint',
    'data protection', 'privacy', 'security', 'confidentiality', 'disclosure',
  ],
  causal_markers: [
    'not compliant', 'regulatory requirement', 'legal obligation', 'we must by law',
    'required to', 'at risk of', 'exposed to', 'audit found', 'breach of',
    'non-compliance', 'regulatory pressure', 'compliance risk', 'legal risk',
    'fails to meet', 'does not meet the standard',
  ],
  action_targets: [
    'comply', 'certify', 'audit', 'remediate', 'mitigate', 'document', 'report',
    'disclose', 'restrict', 'enforce', 'monitor', 'review', 'update policy',
  ],
  business_objects: [
    'policy', 'control', 'audit', 'risk register', 'compliance framework', 'regulation',
    'standard', 'certification', 'accreditation', 'data protection policy', 'contract',
  ],
  impact_surfaces: [
    'risk', 'liability', 'reputation', 'licence to operate', 'financial penalty', 'trust',
  ],
};

export const DEFAULT_LENS_PACK: LensPack = {
  id: 'default',
  name: 'Default Business Lens',
  context: 'General business and organisational discovery',
  domains: [
    PEOPLE_DOMAIN,
    PROCESS_DOMAIN,
    TECHNOLOGY_DOMAIN,
    ORGANISATION_DOMAIN,
    CUSTOMER_DOMAIN,
    COMMERCIAL_DOMAIN,
    COMPLIANCE_DOMAIN,
  ],
};

// ── Workshop-specific lens pack builder ─────────────────────────────────────
//
// Maps IndustryDimension[] from prepResearch into the full DomainDefinition
// shape required by the domain scorer. The research agent provides flat keywords;
// this function derives the richer fields (causal_markers, action_targets,
// business_objects, impact_surfaces) via linguistic heuristics so the scorer
// gets the causal ownership signals it needs.
//
// IndustryDimension shape (from lib/cognition/agents/agent-types.ts):
//   { name: string; description: string; keywords: string[]; color: string }

export type PrepIndustryDimension = {
  name: string;
  description: string;
  keywords: string[];
  color?: string;
};

// Known action verbs — keywords matching these are classified as action_targets
const ACTION_VERB_PATTERNS = [
  /^(hire|fire|recruit|train|develop|coach|promote|retain|onboard|reskill|upskill|restructure|reorganise|reorganize|realign|reassign|redeploy)$/i,
  /^(build|deploy|implement|migrate|integrate|automate|configure|rollout|roll out|refactor|rewrite|upgrade|replace|consolidate|modernise|modernize)$/i,
  /^(fix|resolve|remediate|address|escalate|investigate|audit|review|assess|monitor|measure|report|track|document|standardise|standardize)$/i,
  /^(reduce|increase|improve|optimise|optimize|streamline|simplify|eliminate|remove|add|expand|scale|accelerate|transform|redesign)$/i,
  /^(define|create|design|plan|prioritise|prioritize|align|approve|mandate|govern|set|establish|clarify|communicate|enforce)$/i,
  /(ise|ize|ate|ify)$/i,  // verb endings
];

function isActionVerb(word: string): boolean {
  const clean = word.trim().split(/\s+/)[0]; // first word only for multi-word phrases
  return ACTION_VERB_PATTERNS.some(p => p.test(clean));
}

// Noun/object heuristic — multi-word terms and non-verb nouns
function isBusinessObject(term: string): boolean {
  if (term.includes(' ')) return true; // multi-word = likely noun phrase
  if (isActionVerb(term)) return false;
  return term.length >= 4; // single nouns
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function extractSynonyms(name: string, description: string): string[] {
  const syns: string[] = [name.toLowerCase()];
  // Pull short (1-2 word) phrases from description as synonyms
  const words = description.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].replace(/[^a-z]/gi, '').toLowerCase();
    const w2 = words[i + 1].replace(/[^a-z]/gi, '').toLowerCase();
    if (w1.length >= 4 && w2.length >= 4 && !['that', 'this', 'with', 'from', 'into', 'their', 'have', 'been', 'will', 'when', 'what'].includes(w1)) {
      const phrase = `${w1} ${w2}`;
      if (!syns.includes(phrase)) syns.push(phrase);
    }
  }
  return syns.slice(0, 8);
}

function buildCausalMarkers(name: string, slug: string, keywords: string[]): string[] {
  const nameL = name.toLowerCase();
  const markers = [
    `because of ${nameL}`,
    `due to ${nameL}`,
    `${nameL} issue`,
    `${nameL} problem`,
    `caused by ${nameL}`,
    `root cause is ${slug.replace(/_/g, ' ')}`,
    `${nameL} constraint`,
    `${nameL} gap`,
  ];
  // Add keyword-derived causal phrases for the strongest signals
  const causalKeywords = keywords.filter(k =>
    /\b(lack|missing|absent|broken|failed|poor|inadequate|insufficient|no |without )\b/i.test(k)
  );
  for (const kw of causalKeywords.slice(0, 4)) {
    markers.push(`because ${kw.toLowerCase()}`);
  }
  return markers;
}

function buildImpactSurfaces(description: string, keywords: string[]): string[] {
  const surfaces: string[] = [];
  // Common impact surface terms that appear in descriptions
  const IMPACT_PATTERNS = /\b(satisfaction|revenue|retention|productivity|performance|quality|efficiency|cost|risk|trust|reputation|compliance|reliability|experience|engagement|morale)\b/gi;
  let m: RegExpExecArray | null;
  const re = new RegExp(IMPACT_PATTERNS.source, 'gi');
  while ((m = re.exec(description)) !== null) {
    const s = m[1].toLowerCase();
    if (!surfaces.includes(s)) surfaces.push(s);
  }
  // Also scan keywords for impact-like terms
  for (const kw of keywords) {
    const kwL = kw.toLowerCase();
    if (/\b(satisfaction|experience|performance|quality|retention|compliance)\b/.test(kwL) && !surfaces.includes(kwL)) {
      surfaces.push(kwL);
    }
  }
  return surfaces.slice(0, 8);
}

export function buildLensPackFromPrepResearch(
  workshopId: string,
  workshopName: string,
  dimensions: PrepIndustryDimension[],
): LensPack {
  if (!dimensions.length) {
    throw new Error(`[LensPack] No dimensions provided for workshop ${workshopId}`);
  }

  const builtDomains: DomainDefinition[] = dimensions.map((dim) => {
    const slug = toSlug(dim.name);
    const keywords = dim.keywords.filter(Boolean).map(k => k.trim());

    const action_targets = keywords.filter(isActionVerb);
    const business_objects = keywords.filter(k => !isActionVerb(k) && isBusinessObject(k));
    const ontology_terms = keywords; // full vocabulary always in ontology_terms

    return {
      id: slug,
      name: dim.name,
      synonyms: extractSynonyms(dim.name, dim.description),
      ontology_terms,
      causal_markers: buildCausalMarkers(dim.name, slug, keywords),
      action_targets,
      business_objects,
      impact_surfaces: buildImpactSurfaces(dim.description, keywords),
    };
  });

  return {
    id: `workshop:${workshopId}`,
    name: `${workshopName} Lens Pack`,
    context: `Workshop-specific lens pack derived from prep research for ${workshopName}`,
    domains: builtDomains,
  };
}

export function getLensPackForWorkshop(_workshopType?: string): LensPack {
  // This stub is superseded by the /api/workshops/[id]/lens-pack endpoint.
  // It remains for server-side callers that don't have async context.
  return DEFAULT_LENS_PACK;
}
