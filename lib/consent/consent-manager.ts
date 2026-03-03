/**
 * Consent Management for GDPR Article 6/7 Compliance
 *
 * Handles participant consent recording, withdrawal, validation,
 * and statistics using Prisma (no raw SQL).
 */

import { prisma } from '@/lib/prisma';

// consentRecord model is planned but not yet in the Prisma schema.
// All consent operations use this typed accessor so the module compiles
// while tests can still mock '@/lib/prisma' with a consentRecord stub.
const db = prisma as any;

export const CURRENT_CONSENT_VERSION = '1.0';

export const CONSENT_TEXT = `
By clicking "I Agree", you consent to the following:

**Data Collection**: We will record your responses during this discovery conversation, including your name (if you choose to provide it), role, and any information you share about your work and challenges.

**Purpose**: This information will be used solely to prepare for the upcoming workshop and to help facilitate better discussions.

**Storage**: Your data will be stored securely in our encrypted database and will only be accessible to authorized workshop facilitators and administrators from your organization.

**Your Rights**: You have the right to:
- Access your data at any time
- Request correction of your data
- Request deletion of your data
- Withdraw your consent at any time

**Data Retention**: Your data will be retained for [INSERT RETENTION PERIOD] after the workshop concludes, unless you request earlier deletion.

**Third Parties**: We use OpenAI's GPT-4 API to facilitate conversations. OpenAI does not store your data beyond 30 days as per their Zero Data Retention policy.

For more information, see our full Privacy Policy.
`.trim();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  id: string;
  participantId: string;
  workshopId: string;
  consentVersion: string;
  consentText?: string;
  consentTypes: string[];
  consentGiven?: boolean;
  consentedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  language?: string;
  withdrawnAt?: Date | null;
  withdrawalReason?: string;
}

export interface ConsentStatusResult {
  hasConsent: boolean;
  consent: ConsentRecord | null;
  isWithdrawn: boolean;
}

export interface ConsentStatistics {
  totalConsents: number;
  activeConsents: number;
  withdrawnConsents: number;
  consentRate: number;
  consentTypeBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// recordConsent - GDPR Article 6 lawful basis recording
// ---------------------------------------------------------------------------

export async function recordConsent(params: {
  participantId: string;
  workshopId: string;
  consentTypes: string[];
  version: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<ConsentRecord> {
  const record = await db.consentRecord.create({
    data: {
      participantId: params.participantId,
      workshopId: params.workshopId,
      consentTypes: params.consentTypes,
      consentVersion: params.version,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      consentedAt: new Date(),
    },
  });

  return record as unknown as ConsentRecord;
}

// ---------------------------------------------------------------------------
// withdrawConsent - GDPR Article 7(3): right to withdraw
// ---------------------------------------------------------------------------

export async function withdrawConsent(params: {
  participantId: string;
  workshopId: string;
  reason?: string;
}): Promise<ConsentRecord | null> {
  // Find most recent active (non-withdrawn) consent
  const existing = await db.consentRecord.findFirst({
    where: {
      participantId: params.participantId,
      workshopId: params.workshopId,
      withdrawnAt: null,
    },
    orderBy: { consentedAt: 'desc' },
  });

  if (!existing || existing.withdrawnAt !== null) {
    return null;
  }

  const updated = await db.consentRecord.update({
    where: { id: existing.id },
    data: { withdrawnAt: new Date() },
  });

  return updated as unknown as ConsentRecord;
}

// ---------------------------------------------------------------------------
// getConsentStatus - check current consent state for a participant
// ---------------------------------------------------------------------------

export async function getConsentStatus(params: {
  participantId: string;
  workshopId: string;
}): Promise<ConsentStatusResult> {
  const consent = await db.consentRecord.findFirst({
    where: {
      participantId: params.participantId,
      workshopId: params.workshopId,
    },
    orderBy: { consentedAt: 'desc' },
  });

  if (!consent) {
    return { hasConsent: false, consent: null, isWithdrawn: false };
  }

  const isWithdrawn = consent.withdrawnAt != null;

  return {
    hasConsent: !isWithdrawn,
    consent: consent as unknown as ConsentRecord,
    isWithdrawn,
  };
}

// ---------------------------------------------------------------------------
// hasValidConsent - boolean check, optionally verifying specific consent types
// ---------------------------------------------------------------------------

export async function hasValidConsent(params: {
  participantId: string;
  workshopId: string;
  requiredTypes?: string[];
}): Promise<boolean> {
  const consent = await db.consentRecord.findFirst({
    where: {
      participantId: params.participantId,
      workshopId: params.workshopId,
    },
    orderBy: { consentedAt: 'desc' },
  });

  if (!consent || consent.withdrawnAt != null) {
    return false;
  }

  // If specific types are required, verify they are all present
  if (params.requiredTypes && params.requiredTypes.length > 0) {
    const consentTypes: string[] = Array.isArray(consent.consentTypes)
      ? consent.consentTypes
      : [];
    return params.requiredTypes.every((t: string) => consentTypes.includes(t));
  }

  return true;
}

// ---------------------------------------------------------------------------
// getConsentStatistics - aggregate stats for a workshop
// ---------------------------------------------------------------------------

export async function getConsentStatistics(params: {
  workshopId: string;
}): Promise<ConsentStatistics> {
  const totalConsents = await db.consentRecord.count({
    where: { workshopId: params.workshopId },
  });

  const activeConsents = await db.consentRecord.count({
    where: { workshopId: params.workshopId, withdrawnAt: null },
  });

  const withdrawnConsents = await db.consentRecord.count({
    where: {
      workshopId: params.workshopId,
      withdrawnAt: { not: null },
    },
  });

  const consentRate = totalConsents > 0 ? activeConsents / totalConsents : 0;

  // Build consent type breakdown from all records
  const records = await db.consentRecord.findMany({
    where: { workshopId: params.workshopId },
    select: { consentTypes: true },
  });

  const consentTypeBreakdown: Record<string, number> = {};
  for (const record of records) {
    const types: string[] = Array.isArray(record.consentTypes)
      ? record.consentTypes
      : [];
    for (const t of types) {
      consentTypeBreakdown[t] = (consentTypeBreakdown[t] || 0) + 1;
    }
  }

  return {
    totalConsents,
    activeConsents,
    withdrawnConsents,
    consentRate,
    consentTypeBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Legacy / backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use hasValidConsent instead */
export async function hasConsent(participantId: string): Promise<boolean> {
  // Legacy callers do not pass workshopId; look across all workshops
  const consent = await db.consentRecord.findFirst({
    where: {
      participantId,
      withdrawnAt: null,
    },
    orderBy: { consentedAt: 'desc' },
  });

  return consent != null;
}

/** @deprecated Use getConsentStatus instead */
export async function getConsent(
  participantId: string,
): Promise<ConsentRecord | null> {
  const consent = await db.consentRecord.findFirst({
    where: {
      participantId,
      withdrawnAt: null,
    },
    orderBy: { consentedAt: 'desc' },
  });

  return (consent as unknown as ConsentRecord) ?? null;
}

/** @deprecated Use getConsentStatistics instead */
export async function getConsentStats(workshopId: string) {
  const stats = await getConsentStatistics({ workshopId });
  return {
    total: stats.totalConsents,
    consented: stats.activeConsents,
    declined: 0,
    withdrawn: stats.withdrawnConsents,
  };
}

/** @deprecated Use getConsentStatistics for workshop-level data */
export async function getWorkshopConsents(
  workshopId: string,
): Promise<ConsentRecord[]> {
  const records = await db.consentRecord.findMany({
    where: { workshopId },
    orderBy: { consentedAt: 'desc' },
  });

  return records as unknown as ConsentRecord[];
}
