import type { WorkshopPrepResearch } from '@/lib/cognition/agents/agent-types';
import type { WorkshopBlueprint } from '@/lib/workshop/blueprint';
import { decryptWorkshopData } from '@/lib/workshop-encryption';

export class WorkshopContextIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkshopContextIntegrityError';
  }
}

const ENCRYPTED_VALUE_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+:[0-9a-f]{32}$/i;

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function isUnreadablePlainText(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (ENCRYPTED_VALUE_PATTERN.test(text)) return true;
  return false;
}

function extractBlueprintActorLabels(blueprint: WorkshopBlueprint | null | undefined): string[] {
  return Array.isArray(blueprint?.actorTaxonomy)
    ? blueprint!.actorTaxonomy.map((actor) => actor.label).filter(Boolean)
    : [];
}

function extractResearchActorRoles(research: WorkshopPrepResearch | null | undefined): string[] {
  return Array.isArray(research?.actorTaxonomy)
    ? research!.actorTaxonomy.map((actor) => actor.role).filter(Boolean)
    : [];
}

export function decryptWorkshopContext<T extends Record<string, unknown>>(workshop: T): T {
  return decryptWorkshopData(workshop as any) as T;
}

export function assertReadableDesiredOutcomes(desiredOutcomes: string | null | undefined): void {
  if (isUnreadablePlainText(desiredOutcomes)) {
    throw new WorkshopContextIntegrityError(
      'Desired outcomes are not readable plain text. Workshop context is corrupted or unresolved.',
    );
  }
}

export function assertWorkshopContextIntegrity(params: {
  clientName: string | null | undefined;
  industry: string | null | undefined;
  desiredOutcomes: string | null | undefined;
  prepResearch?: WorkshopPrepResearch | null;
  blueprint?: WorkshopBlueprint | null;
}): void {
  assertReadableDesiredOutcomes(params.desiredOutcomes);

  const clientName = normalizeText(params.clientName);
  const companyOverview = normalizeText(params.prepResearch?.companyOverview ?? '');
  if (clientName && companyOverview && !companyOverview.includes(clientName)) {
    throw new WorkshopContextIntegrityError(
      `Stored research context does not match the current client "${params.clientName}". Re-run research before continuing.`,
    );
  }

  const industry = normalizeText(params.industry);
  const blueprintActors = extractBlueprintActorLabels(params.blueprint);
  const airlineTerms = /\b(airport|cabin crew|traveller|traveler|frequent flyer|boarding|flight|airline|ota)\b/i;
  if (industry.includes('bpo') && blueprintActors.some((label) => airlineTerms.test(label))) {
    throw new WorkshopContextIntegrityError(
      'Blueprint actor taxonomy contains airline-specific roles that do not match the current BPO workshop context. Re-run research to regenerate prep artifacts.',
    );
  }

  const researchActors = extractResearchActorRoles(params.prepResearch);
  if (researchActors.length > 0 && blueprintActors.length === 0) {
    throw new WorkshopContextIntegrityError(
      'Blueprint actor taxonomy is missing even though research actor taxonomy exists. Re-run research to regenerate prep artifacts.',
    );
  }
}

export function workshopContractChanged(
  current: {
    clientName?: string | null;
    industry?: string | null;
    dreamTrack?: string | null;
    targetDomain?: string | null;
    workshopType?: string | null;
    engagementType?: string | null;
    domainPack?: string | null;
  },
  next: {
    clientName?: string | null;
    industry?: string | null;
    dreamTrack?: string | null;
    targetDomain?: string | null;
    workshopType?: string | null;
    engagementType?: string | null;
    domainPack?: string | null;
  },
): boolean {
  return (
    normalizeText(current.clientName) !== normalizeText(next.clientName) ||
    normalizeText(current.industry) !== normalizeText(next.industry) ||
    normalizeText(current.dreamTrack) !== normalizeText(next.dreamTrack) ||
    normalizeText(current.targetDomain) !== normalizeText(next.targetDomain) ||
    normalizeText(current.workshopType) !== normalizeText(next.workshopType) ||
    normalizeText(current.engagementType) !== normalizeText(next.engagementType) ||
    normalizeText(current.domainPack) !== normalizeText(next.domainPack)
  );
}
