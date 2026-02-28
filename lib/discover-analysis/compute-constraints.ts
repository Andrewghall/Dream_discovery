/**
 * Compute Constraint Map (base data)
 *
 * Extracts constraints from ConversationInsight (type=CONSTRAINT) and
 * WorkshopIntelligence pain points. Computes weights.
 *
 * Dependency relationships are identified by the GPT agent in Step 3,
 * so this function produces the base constraint nodes without deps.
 */

import { prisma } from '@/lib/prisma';
import type { ConstraintNode, ConstraintMapData } from '@/lib/types/discover-analysis';

interface InsightRow {
  id: string;
  text: string;
  severity: number | null;
  category: string | null;
}

interface PainPoint {
  description: string;
  domain?: string;
  frequency?: number;
  severity?: 'critical' | 'significant' | 'moderate';
}

interface IntelligencePayload {
  painPoints?: PainPoint[];
}

const SEVERITY_MULTIPLIER: Record<string, number> = {
  critical: 3,
  significant: 2,
  moderate: 1,
};

/**
 * Compute base constraint nodes for a workshop.
 *
 * Returns nodes without dependency relationships (those come from GPT agent).
 */
export async function computeConstraints(workshopId: string): Promise<ConstraintMapData> {
  // 1. Fetch CONSTRAINT insights
  const constraintInsights = await prisma.conversationInsight.findMany({
    where: {
      workshopId,
      insightType: 'CONSTRAINT',
    },
    select: {
      id: true,
      text: true,
      severity: true,
      category: true,
    },
  }) as InsightRow[];

  // 2. Fetch WorkshopIntelligence (discoveryBriefing) for pain points
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { discoveryBriefing: true },
  });

  const intelligence = workshop?.discoveryBriefing as IntelligencePayload | null;
  const painPoints = intelligence?.painPoints || [];

  // 3. Merge and deduplicate constraints
  const constraintMap = new Map<string, {
    description: string;
    domain: string;
    frequency: number;
    severityLabel: 'critical' | 'significant' | 'moderate';
  }>();

  // From ConversationInsight
  for (const insight of constraintInsights) {
    const key = normaliseConstraintKey(insight.text);
    const existing = constraintMap.get(key);

    if (existing) {
      existing.frequency++;
      // Upgrade severity if this mention is more severe
      const sev = severityFromNumber(insight.severity);
      if (SEVERITY_MULTIPLIER[sev] > SEVERITY_MULTIPLIER[existing.severityLabel]) {
        existing.severityLabel = sev;
      }
    } else {
      constraintMap.set(key, {
        description: insight.text,
        domain: categoryToDomain(insight.category),
        frequency: 1,
        severityLabel: severityFromNumber(insight.severity),
      });
    }
  }

  // From pain points
  for (const pp of painPoints) {
    if (!pp.description) continue;
    const key = normaliseConstraintKey(pp.description);
    const existing = constraintMap.get(key);

    if (existing) {
      existing.frequency += pp.frequency || 1;
      const sev = pp.severity || 'moderate';
      if (SEVERITY_MULTIPLIER[sev] > SEVERITY_MULTIPLIER[existing.severityLabel]) {
        existing.severityLabel = sev;
      }
    } else {
      constraintMap.set(key, {
        description: pp.description,
        domain: pp.domain || 'General',
        frequency: pp.frequency || 1,
        severityLabel: pp.severity || 'moderate',
      });
    }
  }

  // 4. Build nodes with computed weights
  let nodeId = 0;
  const constraints: ConstraintNode[] = [...constraintMap.values()]
    .map((c) => ({
      id: `constraint-${++nodeId}`,
      description: c.description,
      domain: c.domain,
      frequency: c.frequency,
      severity: c.severityLabel,
      weight: c.frequency * (SEVERITY_MULTIPLIER[c.severityLabel] || 1),
      dependsOn: [],  // Filled by GPT agent
      blocks: [],     // Filled by GPT agent
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15); // Cap at 15 constraints for readability

  return {
    constraints,
    relationships: [], // Filled by GPT agent
  };
}

// ── Helpers ──────────────────────────────────────────────────

function normaliseConstraintKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function severityFromNumber(sev: number | null): 'critical' | 'significant' | 'moderate' {
  if (!sev) return 'moderate';
  if (sev >= 8) return 'critical';
  if (sev >= 5) return 'significant';
  return 'moderate';
}

function categoryToDomain(category: string | null): string {
  if (!category) return 'General';
  const map: Record<string, string> = {
    BUSINESS: 'Organisation',
    TECHNOLOGY: 'Technology',
    PEOPLE: 'People',
    CUSTOMER: 'Customer',
    REGULATION: 'Regulation',
  };
  return map[category] || category;
}
