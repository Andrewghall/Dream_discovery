export type CanonicalLensName =
  | 'People'
  | 'Operations'
  | 'Technology'
  | 'Commercial'
  | 'Risk/Compliance'
  | 'Partners';

export type CanonicalConversationPhase =
  | 'people'
  | 'operations'
  | 'technology'
  | 'commercial'
  | 'risk_compliance'
  | 'partners';

export type CanonicalLensDefinition = {
  name: CanonicalLensName;
  phase: CanonicalConversationPhase;
  description: string;
  keywords: string[];
  color: string;
};

export const CANONICAL_LENSES: readonly CanonicalLensDefinition[] = [
  {
    name: 'People',
    phase: 'people',
    description: 'Human capability, culture, leadership, skills, and ways of working',
    keywords: [
      'people', 'person', 'human', 'culture', 'skill', 'training', 'talent',
      'recruit', 'wellbeing', 'engagement', 'stakeholder', 'leader', 'stress',
      'burnout', 'morale', 'empower', 'collaborat', 'mentor', 'divers', 'inclusi',
    ],
    color: '#bfdbfe',
  },
  {
    name: 'Operations',
    phase: 'operations',
    description: 'Processes, operating model, governance, delivery flow, and execution discipline',
    keywords: [
      'operat', 'organi', 'organization', 'organisation', 'process', 'workflow',
      'governance', 'decision', 'handoff', 'queue', 'delivery', 'service',
      'management', 'staff', 'resource', 'efficien', 'productiv', 'strategy',
      'resilien', 'agil', 'owner', 'ownership',
    ],
    color: '#a7f3d0',
  },
  {
    name: 'Technology',
    phase: 'technology',
    description: 'Systems, data, platforms, tooling, automation, and technical enablement',
    keywords: [
      'technolog', 'AI', 'machine learning', 'system', 'platform', 'software',
      'digital', 'automat', 'data', 'cloud', 'infra', 'algorithm', 'API',
      'integrat', 'cyber', 'server', 'database', 'scal', 'architect', 'deploy',
      'devops', 'pipeline',
    ],
    color: '#fed7aa',
  },
  {
    name: 'Commercial',
    phase: 'commercial',
    description: 'Demand, proposition, revenue logic, growth, customer value, and market performance',
    keywords: [
      'commercial', 'customer', 'client', 'consumer', 'buyer', 'market', 'sales',
      'revenue', 'pricing', 'profit', 'margin', 'growth', 'retention', 'churn',
      'proposition', 'competitive', 'contract', 'monetis', 'roi', 'nps',
      'experience', 'journey', 'value',
    ],
    color: '#fef9c3',
  },
  {
    name: 'Risk/Compliance',
    phase: 'risk_compliance',
    description: 'Risk posture, compliance obligations, controls, legal exposure, and assurance',
    keywords: [
      'regulat', 'complian', 'legal', 'GDPR', 'FCA', 'licen', 'governance',
      'audit', 'polic', 'legislat', 'mandate', 'standard', 'accredit',
      'certif', 'oversight', 'enforce', 'statute', 'jurisdict', 'scrutin',
      'risk', 'control',
    ],
    color: '#fecaca',
  },
  {
    name: 'Partners',
    phase: 'partners',
    description: 'External partners, vendors, suppliers, integrators, and ecosystem dependencies',
    keywords: [
      'partner', 'supplier', 'vendor', 'third party', 'ecosystem', 'alliance',
      'outsourc', 'contractor', 'integrat', 'channel', 'reseller', 'distribut',
      'joint venture', 'collaborat', 'supply chain',
    ],
    color: '#e0e7ff',
  },
] as const;

export const CANONICAL_LENS_NAMES = CANONICAL_LENSES.map((lens) => lens.name);

export const CANONICAL_CONVERSATION_PHASES = CANONICAL_LENSES.map((lens) => lens.phase);

const LEGACY_LENS_ALIASES: Record<string, CanonicalLensName> = {
  people: 'People',
  operations: 'Operations',
  operation: 'Operations',
  organisation: 'Operations',
  organization: 'Operations',
  organisational: 'Operations',
  organizational: 'Operations',
  corporate: 'Operations',
  process: 'Operations',
  processes: 'Operations',
  technology: 'Technology',
  tech: 'Technology',
  commercial: 'Commercial',
  customer: 'Commercial',
  'customer experience': 'Commercial',
  'customer journey': 'Commercial',
  'customer impact': 'Commercial',
  'risk/compliance': 'Risk/Compliance',
  'risk / compliance': 'Risk/Compliance',
  risk: 'Risk/Compliance',
  compliance: 'Risk/Compliance',
  regulation: 'Risk/Compliance',
  regulatory: 'Risk/Compliance',
  partners: 'Partners',
  partner: 'Partners',
};

const PHASE_TO_LENS: Record<CanonicalConversationPhase, CanonicalLensName> = {
  people: 'People',
  operations: 'Operations',
  technology: 'Technology',
  commercial: 'Commercial',
  risk_compliance: 'Risk/Compliance',
  partners: 'Partners',
};

const LEGACY_PHASE_ALIASES: Record<string, CanonicalConversationPhase> = {
  people: 'people',
  corporate: 'operations',
  organisation: 'operations',
  organization: 'operations',
  operations: 'operations',
  technology: 'technology',
  customer: 'commercial',
  commercial: 'commercial',
  regulation: 'risk_compliance',
  'risk/compliance': 'risk_compliance',
  'risk / compliance': 'risk_compliance',
  risk: 'risk_compliance',
  compliance: 'risk_compliance',
  risk_compliance: 'risk_compliance',
  partners: 'partners',
};

export function canonicalizeLensName(name: string | null | undefined): CanonicalLensName | null {
  const normalized = String(name ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return LEGACY_LENS_ALIASES[normalized] ?? null;
}

export function canonicalizeConversationPhase(
  phase: string | null | undefined,
): CanonicalConversationPhase | null {
  const normalized = String(phase ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return LEGACY_PHASE_ALIASES[normalized] ?? null;
}

export function getConversationPhaseAliases(
  phase: string | null | undefined,
): string[] {
  const canonical = canonicalizeConversationPhase(phase);
  if (!canonical) return [];

  const aliases = new Set<string>([canonical]);
  for (const [alias, value] of Object.entries(LEGACY_PHASE_ALIASES)) {
    if (value === canonical) {
      aliases.add(alias);
    }
  }

  return [...aliases];
}

export function lensNameFromConversationPhase(
  phase: CanonicalConversationPhase,
): CanonicalLensName {
  return PHASE_TO_LENS[phase];
}

export function getCanonicalLensDefinition(
  name: CanonicalLensName,
): CanonicalLensDefinition {
  const match = CANONICAL_LENSES.find((lens) => lens.name === name);
  if (!match) {
    throw new Error(`[canonical-lenses] Missing definition for lens "${name}"`);
  }
  return match;
}

export function isCanonicalLensName(name: string | null | undefined): name is CanonicalLensName {
  return canonicalizeLensName(name) !== null;
}

export function validateCanonicalLensSet(names: string[]): {
  ok: boolean;
  unknown: string[];
  missing: CanonicalLensName[];
  extras: string[];
} {
  const canonicalized = names
    .map((name) => ({ raw: name, canonical: canonicalizeLensName(name) }))
    .filter((entry) => entry.raw.trim().length > 0);

  const unknown = canonicalized
    .filter((entry) => entry.canonical === null)
    .map((entry) => entry.raw);

  const normalizedSet = new Set(
    canonicalized
      .map((entry) => entry.canonical)
      .filter((entry): entry is CanonicalLensName => entry !== null),
  );

  const missing = CANONICAL_LENS_NAMES.filter((name) => !normalizedSet.has(name));
  const extras = names.filter((name) => {
    const canonical = canonicalizeLensName(name);
    return canonical === null || !CANONICAL_LENS_NAMES.includes(canonical);
  });

  return {
    ok: unknown.length === 0 && missing.length === 0 && normalizedSet.size === CANONICAL_LENS_NAMES.length,
    unknown,
    missing,
    extras,
  };
}
