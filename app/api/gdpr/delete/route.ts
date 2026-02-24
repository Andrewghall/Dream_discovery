/**
 * GDPR Article 17 - Right to Erasure ("Right to be Forgotten")
 * Delete all personal data for a participant
 *
 * Security: Requires valid authentication token (discoveryToken)
 * Rate limited to 3 requests per 15 minutes per participant
 * Requires confirmation token for safety
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { validateParticipantAuth, getGDPRRateLimitKey } from '@/lib/gdpr/validate-participant';
import { authLimiter } from '@/lib/rate-limit';
import crypto from 'crypto';

/**
 * POST /api/gdpr/delete
 *
 * Permanently deletes all personal data for a workshop participant in compliance with GDPR Article 17
 * (Right to Erasure / "Right to be Forgotten"). Implements two-step confirmation process for safety.
 *
 * **Step 1: Request Deletion** (without confirmationToken)
 * - Generates and returns a confirmation token
 * - Confirmation token valid for 30 minutes
 *
 * **Step 2: Confirm Deletion** (with confirmationToken)
 * - Validates confirmation token
 * - Performs cascade deletion of all participant data
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
 *   - 200: { success: true, message: string, confirmationToken: string } - Confirmation token generated
 *   **Step 2 (with confirmationToken):**
 *   - 200: { success: true, message: string, deletedRecords: {...} } - Data permanently deleted
 *   **Errors:**
 *   - 400: { error: string } - Missing required fields or no deletion request found
 *   - 401: { error: string } - Invalid authentication/confirmation token, or token expired (30min)
 *   - 429: { error: string, retryAfter: number } - Rate limit exceeded (3 req/15min)
 *   - 500: { error: string } - Internal server error
 *
 * @security
 * - Requires participant's discoveryToken for authentication
 * - Rate limited: 3 requests per 15 minutes per participant (stricter than export)
 * - Two-step confirmation process prevents accidental deletion
 * - Confirmation token expires after 30 minutes
 * - All deletion attempts logged in audit log (audit logs preserved after deletion)
 * - Cannot delete twice (idempotent)
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
 *
 * @example Step 1 - Request Deletion
 * POST /api/gdpr/delete
 * Content-Type: application/json
 *
 * {
 *   "email": "participant@example.com",
 *   "workshopId": "workshop-123",
 *   "authToken": "abc123discovery-token"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Deletion request received. Use the confirmation token to complete deletion within 30 minutes.",
 *   "confirmationToken": "xyz789confirmation-token"
 * }
 *
 * @example Step 2 - Confirm Deletion
 * POST /api/gdpr/delete
 * Content-Type: application/json
 *
 * {
 *   "email": "participant@example.com",
 *   "workshopId": "workshop-123",
 *   "authToken": "abc123discovery-token",
 *   "confirmationToken": "xyz789confirmation-token"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "All personal data has been permanently deleted.",
 *   "deletedRecords": {
 *     "messages": 45,
 *     "insights": 12,
 *     "reports": 1,
 *     "dataPoints": 67,
 *     "classifications": 50,
 *     "annotations": 23,
 *     "sessions": 1,
 *     "consentRecords": 1,
 *     "participant": 1
 *   }
 * }
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
    const rl = await authLimiter.check(3, rateLimitKey);

    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rl.reset - Date.now()) / 1000)
        },
        { status: 429 }
      );
    }

    // Authenticate participant
    const authResult = await validateParticipantAuth(email, workshopId, authToken, request);

    if (!authResult.valid) {
      await logAuditEvent({
        organizationId: 'unknown',
        userEmail: email,
        action: 'DELETE_DATA',
        resourceType: 'Participant',
        method: 'POST',
        path: '/api/gdpr/delete',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
        success: false,
        errorMessage: authResult.error,
        metadata: { workshopId, email },
      });

      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const participant = authResult.participant!;

    const hmacSecret = process.env.SESSION_SECRET || '';

    // If no confirmation token provided, generate HMAC-signed token (two-step deletion)
    if (!confirmationToken) {
      const tokenData = `${participant.email}:${participant.id}:DELETE:${Date.now()}`;
      const hmac = crypto.createHmac('sha256', hmacSecret).update(tokenData).digest('hex');
      const signedToken = Buffer.from(`${tokenData}:${hmac}`).toString('base64');

      return NextResponse.json({
        success: false,
        requiresConfirmation: true,
        confirmationToken: signedToken,
        message:
          'Please confirm deletion by including the confirmationToken in your request. This action is irreversible.',
      });
    }

    // Verify HMAC-signed confirmation token
    let decoded: string;
    try {
      decoded = Buffer.from(confirmationToken, 'base64').toString();
    } catch {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 403 }
      );
    }
    const parts = decoded.split(':');
    if (parts.length < 5) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 403 }
      );
    }
    const receivedHmac = parts.pop()!;
    const dataToVerify = parts.join(':');
    const expectedHmac = crypto.createHmac('sha256', hmacSecret).update(dataToVerify).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 403 }
      );
    }
    // Check token is not older than 30 minutes
    const tokenTimestamp = parseInt(parts[3], 10);
    if (isNaN(tokenTimestamp) || Date.now() - tokenTimestamp > 30 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Confirmation token has expired. Please request a new one.' },
        { status: 403 }
      );
    }
    // Verify token belongs to this participant
    if (parts[0] !== participant.email || parts[1] !== participant.id || parts[2] !== 'DELETE') {
      return NextResponse.json(
        { error: 'Invalid confirmation token' },
        { status: 403 }
      );
    }

    // Log the deletion BEFORE it happens (for audit trail)
    await logAuditEvent({
      organizationId: participant.organizationId,
      userEmail: email,
      action: 'DELETE_DATA',
      resourceType: 'Participant',
      resourceId: participant.id,
      method: 'POST',
      path: '/api/gdpr/delete',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      success: true,
      metadata: {
        workshopId: workshopId,
        email: email,
        participantId: participant.id,
        dataCategories: [
          'conversations',
          'messages',
          'data_points',
          'insights',
          'reports',
        ],
      },
    });

    // Get counts before deletion (for reporting)
    const [
      sessionCount,
      messageCount,
      dataPointCount,
      insightCount,
      reportCount,
    ] = await Promise.all([
      prisma.conversationSession.count({
        where: { participantId: participant.id },
      }),
      prisma.conversationMessage.count({
        where: {
          session: { participantId: participant.id },
        },
      }),
      prisma.dataPoint.count({ where: { participantId: participant.id } }),
      prisma.conversationInsight.count({
        where: { participantId: participant.id },
      }),
      prisma.conversationReport.count({
        where: { participantId: participant.id },
      }),
    ]);

    // Delete all related data
    // Cascade deletes will handle child records
    await prisma.workshopParticipant.delete({
      where: { id: participant.id },
    });

    // Also delete consent records (separate table not in Prisma schema yet)
    await prisma.$executeRaw`
      DELETE FROM participant_consents
      WHERE "participantId" = ${participant.id}
    `;

    return NextResponse.json({
      success: true,
      message: 'All personal data has been permanently deleted',
      deletedRecords: {
        participant: 1,
        sessions: sessionCount,
        messages: messageCount,
        dataPoints: dataPointCount,
        insights: insightCount,
        reports: reportCount,
      },
      deletionDate: new Date().toISOString(),
      gdprCompliance: {
        article: 'GDPR Article 17 - Right to Erasure',
        auditTrailPreserved: true,
        auditTrailRetentionPeriod: '7 years (legal requirement)',
      },
    });
  } catch (error) {
    console.error('Data deletion error:', error);

    // Log failed deletion attempt
    try {
      await logAuditEvent({
        organizationId: 'unknown',
        userEmail: 'unknown',
        action: 'DELETE_DATA',
        method: 'POST',
        path: '/api/gdpr/delete',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (logError) {
      console.error('Failed to log deletion error:', logError);
    }

    return NextResponse.json(
      { error: 'Failed to delete data' },
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
  const rl = await authLimiter.check(10, rateLimitKey);

  if (!rl.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rl.reset / 1000),
      },
      { status: 429 }
    );
  }

  // Authenticate participant
  const authResult = await validateParticipantAuth(email, workshopId, authToken, request);

  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    );
  }

  return NextResponse.json({
    exists: true,
    participantId: authResult.participant?.id,
    message: 'Data exists and can be deleted',
  });
}
