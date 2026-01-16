import { Resend } from 'resend';
import { generateDiscoveryReportPdf } from '@/lib/pdf/discovery-report';

export async function sendDiscoveryReportEmail(params: {
  to: string;
  participantName: string;
  workshopName: string | null | undefined;
  discoveryUrl: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
  inputQuality?: {
    score: number;
    label: 'high' | 'medium' | 'low';
    rationale: string;
  };
  keyInsights?: Array<{
    title: string;
    insight: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  }>;
  phaseInsights: Array<{
    phase: string;
    currentScore: number | null;
    targetScore: number | null;
    projectedScore: number | null;
  }>;
}) {
  const {
    to,
    participantName,
    workshopName,
    discoveryUrl,
    executiveSummary,
    tone,
    feedback,
    inputQuality,
    keyInsights,
    phaseInsights,
  } = params;

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error('Email is not configured (missing RESEND_API_KEY or FROM_EMAIL)');
  }

  const attachmentContent = await generateDiscoveryReportPdf({
    participantName,
    workshopName,
    discoveryUrl,
    executiveSummary,
    tone,
    feedback,
    inputQuality,
    keyInsights,
    phaseInsights,
  });

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <p>Hi ${participantName},</p>
  <p>Thank you for participating in the DREAM Discovery questionnaire. Attached is your summary report (PDF).</p>
  <p>Kind regards,<br/>Ethenta</p>
</body>
</html>
`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: `Your DREAM Discovery Summary — ${workshopName || 'DREAM Discovery'}`,
    html,
    attachments: [
      {
        filename: 'DREAM-Discovery-Summary-Report.pdf',
        content: attachmentContent,
        contentType: 'application/pdf',
      },
    ],
  });

  const maybeResult: unknown = result;
  if (maybeResult && typeof maybeResult === 'object' && 'error' in maybeResult) {
    const error = (maybeResult as { error?: unknown }).error;
    if (error) {
      const message =
        typeof error === 'string'
          ? error
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message)
            : JSON.stringify(error);
      throw new Error(message);
    }
  }

  return result;
}
