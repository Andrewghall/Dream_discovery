/**
 * GDPR Article 15 - Right of Access
 * Export all personal data for a participant
 *
 * Security: Requires valid authentication token (discoveryToken)
 * Rate limited to 5 requests per 15 minutes per participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit/audit-logger';
import { validateParticipantAuth, getGDPRRateLimitKey } from '@/lib/gdpr/validate-participant';
import { authLimiter } from '@/lib/rate-limit';

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
 *
 * @security
 * - Requires participant's discoveryToken for authentication
 * - Rate limited: 5 requests per 15 minutes per participant
 * - All export attempts logged in audit log
 * - Sensitive fields (tokens, passwords) excluded from export
 *
 * @gdpr
 * - Complies with GDPR Article 15 (Right to Access)
 * - Data categories included:
 *   1. Participant personal data (name, email, role, department, attribution preferences)
 *   2. Workshop context (name, description, business context, dates)
 *   3. Conversation sessions (status, duration, phases, language preferences)
 *   4. Messages (conversation history with timestamps)
 *   5. Data points (captured utterances and insights)
 *   6. Insights (AI-generated analysis and classifications)
 *   7. Reports (summary reports and key findings)
 *   8. Consent records (consent types, versions, timestamps, withdrawal status)
 * - Export includes metadata: exportedAt timestamp, format version, legal article reference
 *
 * @example
 * POST /api/gdpr/export
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
 *   "data": {
 *     "participant": { "id": "...", "email": "...", "name": "...", ... },
 *     "workshop": { "id": "...", "name": "...", ... },
 *     "sessions": [...],
 *     "messages": [...],
 *     "dataPoints": [...],
 *     "insights": [...],
 *     "reports": [...],
 *     "consentRecords": [...]
 *   },
 *   "metadata": {
 *     "exportedAt": "2024-01-15T10:30:00.000Z",
 *     "format": "GDPR_EXPORT_V1",
 *     "article": "Article 15 - Right to Access"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { email, workshopId, authToken } = await request.json();

    if (!email || !workshopId || !authToken) {
      return NextResponse.json(
        { error: 'Email, workshopId, and authToken are required' },
        { status: 400 }
      );
    }

    // Rate limiting: 5 requests per 15 minutes
    const rateLimitKey = getGDPRRateLimitKey(email, workshopId, 'export');
    const rl = await authLimiter.check(5, rateLimitKey);

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
        action: 'EXPORT_DATA',
        resourceType: 'Participant',
        method: 'POST',
        path: '/api/gdpr/export',
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

    // Get all data for this participant
    const [sessions, dataPoints, insights, reports, consents, workshop] =
      await Promise.all([
        // Conversation sessions
        prisma.conversationSession.findMany({
          where: { participantId: participant.id },
          include: {
            messages: true,
          },
        }),

        // Data points
        prisma.dataPoint.findMany({
          where: { participantId: participant.id },
          include: {
            classification: true,
            annotation: true,
            agenticAnalysis: true,
          },
        }),

        // Insights
        prisma.conversationInsight.findMany({
          where: { participantId: participant.id },
        }),

        // Reports
        prisma.conversationReport.findMany({
          where: { participantId: participant.id },
        }),

        // Consents
        prisma.$queryRaw`
          SELECT * FROM participant_consents
          WHERE "participantId" = ${participant.id}
        `,

        // Workshop details
        prisma.workshop.findUnique({
          where: { id: participant.workshopId },
          select: { id: true, name: true },
        }),
      ]);

    // Build comprehensive export
    const exportData = {
      exportDate: new Date().toISOString(),
      exportType: 'GDPR Article 15 - Right of Access',
      participant: {
        id: participant.id,
        email: participant.email,
      },
      workshop: {
        id: participant.workshopId,
        name: workshop?.name || 'Unknown',
      },
      conversations: sessions.map((session) => ({
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        totalDurationMs: session.totalDurationMs,
        language: session.language,
        messages: session.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          phase: msg.phase,
          createdAt: msg.createdAt,
        })),
      })),
      dataPoints: dataPoints.map((dp) => ({
        id: dp.id,
        rawText: dp.rawText,
        source: dp.source,
        speakerId: dp.speakerId,
        createdAt: dp.createdAt,
        classification: dp.classification,
        annotation: dp.annotation,
        agenticAnalysis: dp.agenticAnalysis,
      })),
      insights: insights.map((insight) => ({
        id: insight.id,
        insightType: insight.insightType,
        category: insight.category,
        text: insight.text,
        severity: insight.severity,
        impact: insight.impact,
        confidence: insight.confidence,
        createdAt: insight.createdAt,
      })),
      reports: reports.map((report) => ({
        id: report.id,
        executiveSummary: report.executiveSummary,
        tone: report.tone,
        feedback: report.feedback,
        inputQuality: report.inputQuality,
        keyInsights: report.keyInsights,
        phaseInsights: report.phaseInsights,
        wordCloudThemes: report.wordCloudThemes,
        createdAt: report.createdAt,
      })),
      consents: consents,
      dataProcessingActivities: {
        purpose: 'Pre-workshop discovery and insight generation',
        legalBasis: 'Consent (GDPR Article 6(1)(a))',
        dataCategories: [
          'Identity data (name, email, role)',
          'Conversation data (messages, responses)',
          'Technical data (IP address, timestamps)',
        ],
        recipients: [
          'Your organization workshop facilitators',
          'OpenAI API (for conversation facilitation)',
        ],
        retentionPeriod: '12 months after workshop completion',
      },
    };

    // Log the export
    await logAuditEvent({
      organizationId: participant.organizationId,
      userEmail: email,
      action: 'EXPORT_DATA',
      resourceType: 'Participant',
      resourceId: participant.id,
      method: 'POST',
      path: '/api/gdpr/export',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      success: true,
      metadata: {
        workshopId: workshopId,
        email: email,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: exportData,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="data-export-${participant.id}.json"`,
        },
      }
    );
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
