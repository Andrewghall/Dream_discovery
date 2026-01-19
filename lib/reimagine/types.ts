export type ReimagineDomain = 'PEOPLE' | 'ORGANISATION' | 'CUSTOMER' | 'TECHNOLOGY' | 'REGULATION';

export type ReimagineLabel = 'ASPIRATION' | 'DREAM' | 'CONSTRAINT' | 'FRICTION' | 'IDEA' | 'ASSUMPTION';

export type ReimagineOrientation = 'CURRENT' | 'FUTURE' | 'TRANSITION' | 'ENABLING_REQUIREMENT';

export type ReimaginePressureType = 'DEPENDS_ON' | 'CONSTRAINS' | 'BLOCKS';

export type ReimaginePressureEdge = {
  fromDomain: ReimagineDomain;
  toDomain: ReimagineDomain;
  pressureType: ReimaginePressureType;
  confidence: number;
  evidence: string;
};

export type ReimagineEnrichment = {
  intentSentence: string;
  labels: Array<{ label: ReimagineLabel; confidence: number }>;
  domains: Array<{ domain: ReimagineDomain; confidence: number }>;
  orientation: { value: ReimagineOrientation; confidence: number };
  pressureEdges: ReimaginePressureEdge[];
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function safeDomain(v: unknown): ReimagineDomain | null {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'PEOPLE') return 'PEOPLE';
  if (s === 'ORGANISATION' || s === 'ORGANIZATION') return 'ORGANISATION';
  if (s === 'CUSTOMER') return 'CUSTOMER';
  if (s === 'TECHNOLOGY') return 'TECHNOLOGY';
  if (s === 'REGULATION') return 'REGULATION';
  return null;
}

export function safeLabel(v: unknown): ReimagineLabel | null {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'ASPIRATION') return 'ASPIRATION';
  if (s === 'DREAM') return 'DREAM';
  if (s === 'CONSTRAINT') return 'CONSTRAINT';
  if (s === 'FRICTION') return 'FRICTION';
  if (s === 'IDEA') return 'IDEA';
  if (s === 'ASSUMPTION') return 'ASSUMPTION';
  return null;
}

export function safeOrientation(v: unknown): ReimagineOrientation | null {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'CURRENT' || s === 'CURRENT_STATE') return 'CURRENT';
  if (s === 'FUTURE' || s === 'FUTURE_DESIRED_STATE') return 'FUTURE';
  if (s === 'TRANSITION' || s === 'TRANSITION_CONCERN') return 'TRANSITION';
  if (s === 'ENABLING_REQUIREMENT') return 'ENABLING_REQUIREMENT';
  return null;
}

export function safePressureType(v: unknown): ReimaginePressureType | null {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'DEPENDS_ON') return 'DEPENDS_ON';
  if (s === 'CONSTRAINS') return 'CONSTRAINS';
  if (s === 'BLOCKS') return 'BLOCKS';
  return null;
}
