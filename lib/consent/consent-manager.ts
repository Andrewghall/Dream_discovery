/**
 * Consent Management for GDPR Article 6 Compliance
 *
 * Handles participant consent before data processing begins
 */

import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

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

export interface ConsentRecord {
  id: string;
  participantId: string;
  workshopId: string;
  consentVersion: string;
  consentText: string;
  consentGiven: boolean;
  consentTimestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  language: string;
  withdrawnAt?: Date;
  withdrawalReason?: string;
}

/**
 * Record participant consent
 */
export async function recordConsent(params: {
  participantId: string;
  workshopId: string;
  consentGiven: boolean;
  ipAddress?: string;
  userAgent?: string;
  language?: string;
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO participant_consents (
      "id",
      "participantId",
      "workshopId",
      "consentVersion",
      "consentText",
      "consentGiven",
      "consentTimestamp",
      "ipAddress",
      "userAgent",
      "language",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${nanoid()},
      ${params.participantId},
      ${params.workshopId},
      ${CURRENT_CONSENT_VERSION},
      ${CONSENT_TEXT},
      ${params.consentGiven},
      NOW(),
      ${params.ipAddress || null},
      ${params.userAgent || null},
      ${params.language || 'en'},
      NOW(),
      NOW()
    )
  `;
}

/**
 * Check if participant has given consent
 */
export async function hasConsent(participantId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM participant_consents
    WHERE "participantId" = ${participantId}
      AND "consentGiven" = true
      AND "withdrawnAt" IS NULL
  `;

  return Number(result[0]?.count || 0) > 0;
}

/**
 * Get consent record for participant
 */
export async function getConsent(
  participantId: string
): Promise<ConsentRecord | null> {
  const results = await prisma.$queryRaw<any[]>`
    SELECT *
    FROM participant_consents
    WHERE "participantId" = ${participantId}
      AND "withdrawnAt" IS NULL
    ORDER BY "consentTimestamp" DESC
    LIMIT 1
  `;

  return results[0] || null;
}

/**
 * Withdraw consent (GDPR Article 7(3))
 */
export async function withdrawConsent(params: {
  participantId: string;
  reason?: string;
}): Promise<void> {
  await prisma.$executeRaw`
    UPDATE participant_consents
    SET
      "withdrawnAt" = NOW(),
      "withdrawalReason" = ${params.reason || null},
      "updatedAt" = NOW()
    WHERE "participantId" = ${params.participantId}
      AND "withdrawnAt" IS NULL
  `;
}

/**
 * Get all consents for a workshop
 */
export async function getWorkshopConsents(
  workshopId: string
): Promise<ConsentRecord[]> {
  return prisma.$queryRaw<ConsentRecord[]>`
    SELECT *
    FROM participant_consents
    WHERE "workshopId" = ${workshopId}
    ORDER BY "consentTimestamp" DESC
  `;
}

/**
 * Get consent statistics for a workshop
 */
export async function getConsentStats(workshopId: string) {
  const results = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN "consentGiven" = true AND "withdrawnAt" IS NULL THEN 1 END) as consented,
      COUNT(CASE WHEN "consentGiven" = false THEN 1 END) as declined,
      COUNT(CASE WHEN "withdrawnAt" IS NOT NULL THEN 1 END) as withdrawn
    FROM participant_consents
    WHERE "workshopId" = ${workshopId}
  `;

  return {
    total: Number(results[0]?.total || 0),
    consented: Number(results[0]?.consented || 0),
    declined: Number(results[0]?.declined || 0),
    withdrawn: Number(results[0]?.withdrawn || 0),
  };
}
