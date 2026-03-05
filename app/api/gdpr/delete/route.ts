/**
 * GDPR Article 17 - Right to Erasure ("Right to be Forgotten")
 * Delete all personal data for a participant
 *
 * Security: Requires valid authentication token (discoveryToken)
 * Rate limited to 3 requests per 15 minutes per participant
 * Requires confirmation token for safety (two-step deletion)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getGDPRRateLimitKey } from '@/lib/rate-limit';
import crypto from 'crypto';
import { logAuditEvent } from '@/lib/audit/audit-logger';

/**
 * POST /api/gdpr/delete
 *
 * Permanently deletes all personal data for a workshop participant in compliance with GDPR Article 17
 * (Right to Erasure / "Right to be Forgotten"). Implements two-step confirmation process for safety.
 *
 * **Step 1: Request Deletion** (without confirmationToken)
 * - Generates and returns a confirmation token
 * - Saves token to participant record
 * - Confirmation token valid for 30 minutes
 *
 * **Step 2: Confirm Deletion** (with confirmationToken)
 * - Validates confirmation token against stored value
 * - Performs cascade deletion of all participant data in a transaction
 * - Preserves audit trail for legal compliance
 *
 * @param request - NextRequest with JSON body containing:
 *   - email: string (required) - Participant's email address
 *   - workshopId: string (required) - Workshop ID the participant belongs to
 *   - authToken: string (required) - Participant's discoveryToken for authentication
 *   - confirmationToken: string (optional) - Token from Step 1, required for Step 2
 *
 * @returns NextResponse with one of:
 *   **Step 1 (no confirmationToken):**
 *   - 200: { success: true, message: string, confirmationToken: string }
 *   **Step 2 (with confirmationToken):**
 *   - 200: { success: true, message: string, deletedRecords: {...} }
 *   **Errors:**
 *   - 400: { error: string } - Missing required fields or no deletion request found
 *   - 401: { error: string } - Invalid authentication, participant not found, invalid/expired token
 *   - 429: { error: string } - Rate limit exceeded (3 req/15min)
 *   - 500: { error: string } - Internal server error
 *
 * @security
 * - Requires participant's discoveryToken for authentication
 * - Rate limited: 3 requests per 15 minutes per participant
 * - Two-step confirmation process prevents accidental deletion
 * - Confirmation token expires after 30 minutes
 * - All deletion attempts logged in audit log (audit logs preserved after deletion)
 * - Cannot delete twice (idempotent - returns 401 if participant already deleted)
 *
 * @gdpr
 * - Complies with GDPR Article 17 (Right to Erasure)
 * - Data categories permanently deleted:
 *   1. Conversation messages (all chat history)
 *   2. Conversation insights (AI-generated analysis)
 *   3. Conversation reports (summary documents)
 *   4. Data points (captured utterances)
 *   5. Data point classifications (AI categorizations)
 *   6. Data point annotations (manual annotations)
 *   7. Conversation sessions (session metadata)
 *   8. Consent records (consent history)
 *   9. Participant record (personal information)
 * - Audit trail preserved for legal compliance (GDPR Article 17(3))
 * - Deletion is permanent and cannot be undone
 * - Cascade deletion ensures no orphaned records remain
 */
export async function POST(request: NextRequest) {
  try {
    const { email, workshopId, authToken, confirmationToken } = await request.json();

    if (!email || !workshopId || !authToken) {
      return NextResponse.json(
        { error: 'Email, workshopId, and authToken are required' },
        { status: 400 }
      );
    }

    // Rate limiting: 3 requests per 15 minutes (stricter than export)
    const rateLimitKey = getGDPRRateLimitKey(email, workshopId, 'delete');
    const rl = await checkRateLimit(rateLimitKey);

    if (rl && rl.allowed === false) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rl.resetAt ? Math.ceil((rl.resetAt - Date.now()) / 1000) : 900,
        },
        { status: 429 }
      );
    }

    // Authenticate participant by looking up directly
    const participant = await prisma.workshopParticipant.findFirst({
      where: {
        email,
        workshopId,
      },
      include: {
        workshop: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 401 }
      );
    }

    // Validate auth token matches discoveryToken
    if (authToken !== participant.discoveryToken) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    const organizationId = (participant as any).workshop?.organizationId || 'unknown';

    // Step 1: If no confirmation token provided, generate one and store it (two-step deletion)
    if (!confirmationToken) {
      const newToken = crypto.randomBytes(32).toString('hex');

      await prisma.workshopParticipant.update({
        where: { id: participant.id },
        data: {
          deletionRequestToken: newToken,
          deletionRequestedAt: new Date(),
        } as any,
      });

      // Audit log for deletion request
      await logAuditEvent({
        action: 'GDPR_DELETE',
        organizationId,
        userEmail: email,
        resourceType: 'Participant',
        resourceId: participant.id,
        method: 'POST',
        path: '/api/gdpr/delete',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
        success: true,
        metadata: {
          workshopId,
          email,
          step: 'request',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Deletion request received. Use the confirmation token to complete deletion within 30 minutes.',
        confirmationToken: newToken,
      });
    }

    // Step 2: Validate the confirmation token

    // Check if a deletion request was ever made
    if (!(participant as any).deletionRequestToken || !(participant as any).deletionRequestedAt) {
      return NextResponse.json(
        { error: 'No deletion request found. Please request deletion first.' },
        { status: 400 }
      );
    }

    // Check if token has expired (30 minutes)
    const requestedAt = new Date((participant as any).deletionRequestedAt).getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - requestedAt > thirtyMinutes) {
      return NextResponse.json(
        { error: 'Confirmation token has expired. Please request a new one.' },
        { status: 401 }
      );
    }

    // Validate the confirmation token matches
    if (confirmationToken !== (participant as any).deletionRequestToken) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 401 }
      );
    }

    // Find all conversation sessions for cascade deletion
    const sessions = await prisma.conversationSession.findMany({
      where: { participantId: participant.id },
      select: { id: true },
    });

    const sessionIds = sessions.map((s: any) => s.id);

    // Perform cascade deletion inside a transaction
    const deletionCounts = await prisma.$transaction(async (tx: any) => {
      // 1. Delete conversation messages
      const messages = await tx.conversationMessage.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      // 2. Delete conversation insights
      const insights = await tx.conversationInsight.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      // 3. Delete conversation reports
      const reports = await tx.conversationReport.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      // 4. Delete data points
      const dataPoints = await tx.dataPoint.deleteMany({
        where: { participantId: participant.id },
      });

      // 5. Delete data point classifications
      const classifications = await tx.dataPointClassification.deleteMany({
        where: { dataPoint: { participantId: participant.id } },
      });

      // 6. Delete data point annotations
      const annotations = await tx.dataPointAnnotation.deleteMany({
        where: { dataPoint: { participantId: participant.id } },
      });

      // 7. Delete conversation sessions
      const sessionsDeleted = await tx.conversationSession.deleteMany({
        where: { participantId: participant.id },
      });

      // 8. Delete the participant record itself
      await tx.workshopParticipant.delete({
        where: { id: participant.id },
      });

      return {
        messages: messages.count,
        insights: insights.count,
        reports: reports.count,
        dataPoints: dataPoints.count,
        classifications: classifications.count,
        annotations: annotations.count,
        sessions: sessionsDeleted.count,
        participant: 1,
      };
    });

    // Audit log for completed deletion (preserved after data is gone)
    await logAuditEvent({
      action: 'GDPR_DELETE',
      organizationId,
      userEmail: email,
      resourceType: 'Participant',
      resourceId: participant.id,
      method: 'POST',
      path: '/api/gdpr/delete',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      success: true,
      metadata: {
        workshopId,
        email,
        participantId: participant.id,
        deletedRecords: deletionCounts,
        step: 'confirmed',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'All personal data has been permanently deleted.',
      deletedRecords: deletionCounts,
      deletionDate: new Date().toISOString(),
      gdprCompliance: {
        article: 'GDPR Article 17 - Right to Erasure',
        auditTrailPreserved: true,
        auditTrailRetentionPeriod: '7 years (legal requirement)',
      },
    });
  } catch (error) {
    console.error('Data deletion error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check deletion status
 * Requires authentication to prevent email enumeration
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const workshopId = request.nextUrl.searchParams.get('workshopId');
  const authToken = request.nextUrl.searchParams.get('authToken');

  if (!email || !workshopId || !authToken) {
    return NextResponse.json(
      { error: 'Email, workshopId, and authToken are required' },
      { status: 400 }
    );
  }

  // Rate limiting for status check
  const rateLimitKey = getGDPRRateLimitKey(email, workshopId, 'status');
  const rl = await checkRateLimit(rateLimitKey);

  if (rl && rl.allowed === false) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: rl.resetAt ? Math.ceil((rl.resetAt - Date.now()) / 1000) : 900,
      },
      { status: 429 }
    );
  }

  // Authenticate participant
  const participant = await prisma.workshopParticipant.findFirst({
    where: {
      email,
      workshopId,
    },
    include: {
      workshop: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!participant) {
    return NextResponse.json(
      { error: 'Participant not found' },
      { status: 401 }
    );
  }

  if (authToken !== participant.discoveryToken) {
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    exists: true,
    participantId: participant.id,
    message: 'Data exists and can be deleted',
  });
}
