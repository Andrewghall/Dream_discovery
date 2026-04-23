import { inferKeywordLenses, LENS_TO_DOMAIN } from '@/lib/cognitive-guidance/pipeline';
import { interpretLiveUtterance } from '@/lib/live/intent-interpretation';
import { findClosestGtmGoldExample } from '@/lib/gold-data/gtm-icp-reference';
import { inferCanonicalWorkshopType } from '@/lib/workshop/workshop-definition';

export type DomainEntry = {
  domain: string;
  relevance: number;
  reasoning: string;
};

export type DomainFeedbackExample = {
  text: string;
  correctedDomains: DomainEntry[];
};

export type DomainOverrideState = {
  primaryDomain?: string | null;
  removedDomains?: string[];
};

export const CANONICAL_RENDER_DOMAINS = [
  'People',
  'Operations',
  'Technology',
  'Customer',
  'Commercial',
  'Finance',
  'Risk/Compliance',
  'Partners',
] as const;

export function normalizeRenderDomain(domain: string | null | undefined): string {
  const normalized = String(domain ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'customer':
      return 'Customer';
    case 'people':
      return 'People';
    case 'operations':
      return 'Operations';
    case 'technology':
      return 'Technology';
    case 'commercial':
      return 'Commercial';
    case 'finance':
    case 'financial':
      return 'Finance';
    case 'partners':
      return 'Partners';
    case 'risk/compliance':
    case 'risk':
    case 'compliance':
      return 'Risk/Compliance';
    default:
      return String(domain ?? '').trim();
  }
}

export function getUnitDomainCueBoost(unitText: string, domain: string): number {
  const normalized = normalizeRenderDomain(domain);

  switch (normalized) {
    case 'People':
      return [
        /\bagent(s)?\b/i,
        /\bteam leader(s)?\b/i,
        /\bleader(s|ship)?\b/i,
        /\bguidance\b/i,
        /\bsupport\b/i,
        /\bskill(s)?\b/i,
        /\btraining\b/i,
        /\bcapabilit(y|ies)\b/i,
        /\bequipp(ed|ing)?\b/i,
        /\btrust from agents\b/i,
        /\bold habits\b/i,
        /\baccountability\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.12 : 0), 0);
    case 'Operations':
      return [
        /\boperation(s)?\b/i,
        /\bprocess(es)?\b/i,
        /\bworkflow(s)?\b/i,
        /\bescalat(e|es|ed|ion)\b/i,
        /\broute(s|d|ing)?\b/i,
        /\bqueue(s|d)?\b/i,
        /\bhandle(d|s|ing)?\b/i,
        /\binconsistent\b/i,
        /\bdifferently\b/i,
        /\bscaled\b/i,
        /\bscale(d|ability|ing)?\b/i,
        /\bthe operation\b/i,
        /\bhasn['’]t scaled\b/i,
        /\bservice quality\b/i,
        /\bdelivery\b/i,
        /\breporting lines\b/i,
        /\bmisaligned\b/i,
        /\bend-to-end\b/i,
        /\bowner(ship)?\b/i,
        /\bpassed between\b/i,
        /\bno one owns\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.12 : 0), 0);
    case 'Customer':
      return [
        /\bcustomer(s)?\b/i,
        /\bclient(s)?\b/i,
        /\bjourney\b/i,
        /\bexpectation(s)?\b/i,
        /\bconversation(s)?\b/i,
        /\bcontact cent(?:er|re)\b/i,
        /\brepeat contact\b/i,
        /\bunresolved issues\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.1 : 0), 0);
    case 'Technology':
      return [
        /\bimplemented\b/i,
        /\bnew systems\b/i,
        /\btool(s)?\b/i,
        /\bsystem(s)?\b/i,
        /\bplatform(s)?\b/i,
        /\bintegration\b/i,
        /\balign with how decisions are actually made\b/i,
        /\bdecision[- ]making\b/i,
        /\bused in practice\b/i,
        /\butili[sz](e|ed|ing)\b/i,
        /\bintroduced\b/i,
        /\bautomation\b/i,
        /\bai\b/i,
        /\bdata\b/i,
        /\bfragmented across systems\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.1 : 0), 0);
    case 'Commercial':
      return [
        /\bcommercial\b/i,
        /\brevenue\b/i,
        /\bprofit(s)?\b/i,
        /\bcost\b/i,
        /\bgrowth\b/i,
        /\bvolume\b/i,
        /\btheir incentives\b/i,
        /\bincentives are\b/i,
        /\bincentive(s)?\b/i,
        /\bincentivi[sz]ed\b/i,
        /\btarget(s)?\b/i,
        /\bquality\b/i,
        /\bperformance looks good on paper\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.14 : 0), 0);
    case 'Partners':
      return [
        /\bpartner(s)?\b/i,
        /\bpartners are incentivised\b/i,
        /\bkey partners\b/i,
        /\bpartners are critical to delivery\b/i,
        /\bcritical to delivery\b/i,
        /\bexternal partner(s)?\b/i,
        /\bthird part(y|ies)\b/i,
        /\becosystem\b/i,
        /\bour network\b/i,
        /\bwork alongside us\b/i,
        /\bcommercial models with our partners\b/i,
        /\bpartner incentives?\b/i,
        /\bpartner model(s)?\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.16 : 0), 0);
    case 'Risk/Compliance':
      return [
        /\bcompliance\b/i,
        /\bregulatory\b/i,
        /\brisk\b/i,
        /\bcontrol(s)?\b/i,
        /\bcontrol framework\b/i,
        /\bcompliance governance\b/i,
        /\bregulatory accountability\b/i,
        /\bregulatory expectations\b/i,
        /\bfrom a compliance perspective\b/i,
      ].reduce((score, pattern) => score + (pattern.test(unitText) ? 0.16 : 0), 0);
    default:
      return 0;
  }
}

export function normalizeDomainDistribution<T extends { relevance: number }>(domains: T[]): T[] {
  const total = domains.reduce((sum, domain) => sum + Math.max(0, domain.relevance), 0);
  if (total <= 0) return domains;
  return domains.map((domain) => ({
    ...domain,
    relevance: domain.relevance / total,
  }));
}

export function normalizeFeedbackText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function promotePrimaryDomain(
  domains: DomainEntry[],
  prioritizedDomain: string
): DomainEntry[] {
  if (domains.length === 0) return domains;

  const normalizedTarget = normalizeRenderDomain(prioritizedDomain);
  const normalizedDomains = domains.map((domain) => ({
    ...domain,
    domain: normalizeRenderDomain(domain.domain),
  }));
  const existingTarget = normalizedDomains.find((domain) => domain.domain === normalizedTarget);
  const withTarget = existingTarget
    ? normalizedDomains
    : [
        {
          domain: normalizedTarget,
          relevance: Math.max(
            0.58,
            (normalizedDomains[0]?.relevance ?? 0.35) + 0.08
          ),
          reasoning: 'Session-local primary domain override.',
        },
        ...normalizedDomains,
      ];
  const reordered = [
    ...withTarget.filter((domain) => domain.domain === normalizedTarget),
    ...withTarget.filter((domain) => domain.domain !== normalizedTarget),
  ];
  if (reordered[0]?.domain !== normalizedTarget) {
    return normalizedDomains;
  }

  const rankMultipliers = [1.6, 1.0, 0.72, 0.5];
  const reweighted = reordered.map((domain, index) => ({
    ...domain,
    relevance: domain.relevance * (rankMultipliers[index] ?? 0.4),
  }));
  const normalized = normalizeDomainDistribution(
    normalizeDomainDistribution(reweighted)
      .filter((domain) => domain.relevance >= 0.08)
  ).sort((a, b) => b.relevance - a.relevance);

  return normalized;
}

export function applyDomainOverride(
  domains: DomainEntry[],
  override: DomainOverrideState | null | undefined
): DomainEntry[] {
  if (!override) return domains;

  const removed = new Set(
    (override.removedDomains ?? []).map((domain) => normalizeRenderDomain(domain))
  );
  const filtered = domains.filter((domain) => !removed.has(normalizeRenderDomain(domain.domain)));
  if (filtered.length === 0) return filtered;
  if (!override.primaryDomain) return filtered;
  if (removed.has(normalizeRenderDomain(override.primaryDomain))) return filtered;

  return promotePrimaryDomain(filtered, override.primaryDomain);
}

export function removeDomain(domains: DomainEntry[], domainToRemove: string): DomainEntry[] {
  const normalizedTarget = normalizeRenderDomain(domainToRemove);
  const filtered = domains.filter((domain) => normalizeRenderDomain(domain.domain) !== normalizedTarget);
  if (filtered.length === 0) return [];
  return normalizeDomainDistribution(filtered).sort((a, b) => b.relevance - a.relevance);
}

export function setDomainPercentage(
  domains: DomainEntry[],
  targetDomain: string,
  targetPercent: number
): DomainEntry[] {
  const normalizedTarget = normalizeRenderDomain(targetDomain);
  const clampedPercent = Math.max(0, Math.min(100, Number.isFinite(targetPercent) ? targetPercent : 0));
  const targetRelevance = clampedPercent / 100;
  const normalizedDomains = domains.map((domain) => ({
    ...domain,
    domain: normalizeRenderDomain(domain.domain),
  }));
  const existingTarget = normalizedDomains.find((domain) => domain.domain === normalizedTarget);
  const targetEntry: DomainEntry = existingTarget ?? {
    domain: normalizedTarget,
    relevance: 0,
    reasoning: 'Session-local domain percentage override.',
  };
  const otherDomains = normalizedDomains.filter((domain) => domain.domain !== normalizedTarget);

  if (targetRelevance <= 0) {
    return otherDomains.length > 0 ? normalizeDomainDistribution(otherDomains).sort((a, b) => b.relevance - a.relevance) : [];
  }
  if (otherDomains.length === 0) {
    return [{ ...targetEntry, relevance: 1 }];
  }

  const remainingRelevance = 1 - targetRelevance;
  const otherTotal = otherDomains.reduce((sum, domain) => sum + Math.max(0, domain.relevance), 0);
  const redistributedOthers = otherTotal > 0
    ? otherDomains.map((domain) => ({
        ...domain,
        relevance: remainingRelevance * (Math.max(0, domain.relevance) / otherTotal),
      }))
    : otherDomains.map((domain) => ({
        ...domain,
        relevance: remainingRelevance / otherDomains.length,
      }));

  return normalizeDomainDistribution([
    { ...targetEntry, relevance: targetRelevance },
    ...redistributedOthers,
  ]).sort((a, b) => b.relevance - a.relevance);
}

export function applyMatchingDomainFeedback(
  unitText: string,
  domains: DomainEntry[],
  feedbackExamples?: DomainFeedbackExample[] | null
): DomainEntry[] {
  if (!feedbackExamples?.length) return domains;
  const normalizedText = normalizeFeedbackText(unitText);
  if (!normalizedText) return domains;

  const matched = feedbackExamples.find((example) => normalizeFeedbackText(example.text) === normalizedText);
  if (!matched) return domains;

  return normalizeDomainDistribution(
    matched.correctedDomains.map((domain) => ({
      ...domain,
      domain: normalizeRenderDomain(domain.domain),
      relevance: Math.max(0, domain.relevance),
      reasoning: domain.reasoning || 'Saved domain feedback match.',
    }))
  ).sort((a, b) => b.relevance - a.relevance);
}

export function projectSemanticUnitDomains(params: {
  unitText: string;
  inheritedDomains: DomainEntry[];
  customKeywordMap?: [string, RegExp][] | null;
  lensToDomain?: Record<string, string> | null;
  workshopType?: string | null;
}): DomainEntry[] {
  const { unitText, inheritedDomains, customKeywordMap, lensToDomain, workshopType } = params;
  const isGtm = inferCanonicalWorkshopType({ workshopType }) === 'GO_TO_MARKET';
  const kwLensResults = unitText.length >= 3 ? inferKeywordLenses(unitText, customKeywordMap) : [];
  const kwDomains = kwLensResults.map((kw) => ({
    domain: normalizeRenderDomain((lensToDomain ?? LENS_TO_DOMAIN)[kw.lens] ?? kw.lens),
    relevance: Math.min(0.95, kw.relevance + 0.4),
    reasoning: kw.evidence,
  })).filter((d) => !!d.domain);

  const mergedDomainMap = new Map<string, DomainEntry>();
  const interpretedDomain = normalizeRenderDomain(interpretLiveUtterance(unitText).domain);

  for (const domain of inheritedDomains.map((d) => ({ ...d, domain: normalizeRenderDomain(d.domain) }))) {
    const key = domain.domain.toLowerCase();
    const cueBoost = getUnitDomainCueBoost(unitText, domain.domain);
    const interpretedBoost = interpretedDomain === domain.domain ? 0.18 : 0;
    const supported = cueBoost > 0 || interpretedBoost > 0;
    mergedDomainMap.set(key, {
      ...domain,
      domain: normalizeRenderDomain(domain.domain),
      relevance: Math.max(
        0.18,
        Math.min(
          0.95,
          domain.relevance * (supported ? 0.82 : 0.22) + cueBoost + interpretedBoost
        )
      ),
    });
  }

  for (const domain of kwDomains) {
    const key = domain.domain.toLowerCase();
    const existing = mergedDomainMap.get(key);
    const cueBoost = getUnitDomainCueBoost(unitText, domain.domain);
    const interpretedBoost = interpretedDomain === domain.domain ? 0.18 : 0;
    const supportedRelevance = Math.max(domain.relevance, cueBoost + interpretedBoost);
    const inheritedCoreFull = !existing && mergedDomainMap.size >= 3;
    if (inheritedCoreFull && (interpretedBoost === 0 || supportedRelevance < 0.72)) {
      continue;
    }
    if (!existing && supportedRelevance < 0.56) {
      continue;
    }
    mergedDomainMap.set(
      key,
      existing
        ? {
            ...existing,
            relevance: Math.max(existing.relevance, supportedRelevance),
            reasoning: existing.reasoning || domain.reasoning,
          }
        : {
            ...domain,
            relevance: supportedRelevance,
          }
    );
  }

  if (isGtm) {
    const goldMatch = findClosestGtmGoldExample(unitText);
    if (goldMatch && goldMatch.score >= 0.28) {
      const mappedDomain = normalizeRenderDomain(goldMatch.lens);
      const key = mappedDomain.toLowerCase();
      const existing = mergedDomainMap.get(key);
      const currentTop = Math.max(0, ...Array.from(mergedDomainMap.values()).map((domain) => domain.relevance));
      const goldBoost = Math.min(0.96, Math.max(0.58 + goldMatch.score * 0.28, currentTop + 0.08));
      mergedDomainMap.set(key, existing
        ? {
            ...existing,
            relevance: Math.max(existing.relevance, goldBoost),
            reasoning: existing.reasoning || `Matched GTM gold example: ${goldMatch.example}`,
          }
        : {
            domain: mappedDomain,
            relevance: goldBoost,
            reasoning: `Matched GTM gold example: ${goldMatch.example}`,
          });
    }
  }

  return normalizeDomainDistribution(
    Array.from(mergedDomainMap.values())
      .filter((domain) => domain.relevance >= 0.12)
      .sort((a, b) => b.relevance - a.relevance)
  ).sort((a, b) => b.relevance - a.relevance);
}
