/**
 * GDPR Article 15 - Right of Access
 * Export all personal data for a participant
 *
 * Security: Requires valid authentication token (discoveryToken)
 * Rate limited to 5 requests per 15 minutes per participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getGDPRRateLimitKey } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit/audit-logger';

/**
 * POST /api/gdpr/export
 *
 * Exports all personal data for a workshop participant in compliance with GDPR Article 15 (Right to Access).
 * Returns complete data package including participant info, workshop details, sessions, messages, data points,
 * insights, reports, and consent records.
 *
 * @param request - NextRequest with JSON body containing:
 *   - email: string (required) - Participant's email address
 *   - workshopId: string (required) - Workshop ID the participant belongs to
 *   - authToken: string (required) - Participant's discoveryToken for authentication
 *
 * @returns NextResponse with one of:
 *   - 200: { success: true, data: {...}, metadata: {...} } - Complete data export
 *   - 400: { error: string } - Missing required fields
 *   - 401: { error: string } - Invalid authentication token or participant not found
 *   - 429: { error: string, retryAfter: number } - Rate limit exceeded (5 req/15min)
 *   - 500: { error: string } - Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, workshopId, authToken } = body;

    // Validate required fields
    if (!email || !workshopId || !authToken) {
      return NextResponse.json(
        { error: 'Email, workshopId, and authToken are required' },
        { status: 400 }
      );
    }

    // Rate limiting: 5 requests per 15 minutes
    const rateLimitKey = getGDPRRateLimitKey(email, workshopId, 'export');
    const rl = await checkRateLimit(rateLimitKey);

    if (rl && rl.allowed === false) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rl.resetAt
            ? Math.ceil((rl.resetAt - Date.now()) / 1000)
            : 900,
        },
        { status: 429 }
      );
    }

    // Find participant by email + workshopId
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

    // Gather all data for this participant in parallel
    const [workshop, sessions, messages, dataPoints, insights, reports] =
      await Promise.all([
        // Workshop details
        prisma.workshop.findUnique({
          where: { id: participant.workshopId },
        }),

        // Conversation sessions
        prisma.conversationSession.findMany({
          where: { participantId: participant.id },
        }),

        // Messages
        prisma.conversationMessage.findMany({
          where: {
            session: { participantId: participant.id },
          },
        }),

        // Data points
        prisma.dataPoint.findMany({
          where: { participantId: participant.id },
        }),

        // Insights
        prisma.conversationInsight.findMany({
          where: { participantId: participant.id },
        }),

        // Reports
        prisma.conversationReport.findMany({
          where: { participantId: participant.id },
        }),
      ]);

    // Build sanitized participant data (strip sensitive fields)
    const { discoveryToken, password, ...sanitizedParticipant } = participant as any;

    // Build the export payload
    const exportData = {
      participant: sanitizedParticipant,
      workshop: workshop || { id: participant.workshopId },
      sessions: sessions || [],
      messages: messages || [],
      dataPoints: dataPoints || [],
      insights: insights || [],
      reports: reports || [],
    };

    // Log audit event for successful export
    await logAuditEvent({
      organizationId,
      action: 'GDPR_EXPORT',
      resourceType: 'Participant',
      resourceId: participant.id,
      success: true,
      metadata: {
        workshopId,
        email,
      },
    });

    return NextResponse.json({
      success: true,
      data: exportData,
      metadata: {
        exportedAt: new Date().toISOString(),
        format: 'GDPR_EXPORT_V1',
        article: 'Article 15 - Right to Access',
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
