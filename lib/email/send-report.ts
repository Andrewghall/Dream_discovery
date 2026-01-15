import { Resend } from 'resend';

export async function sendDiscoveryReportEmail(params: {
  to: string;
  participantName: string;
  workshopName: string | null | undefined;
  discoveryUrl: string;
  executiveSummary: string;
  tone: string | null;
  feedback: string;
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
    phaseInsights,
  } = params;

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error('Email is not configured (missing RESEND_API_KEY or FROM_EMAIL)');
  }

  const safeWorkshopName = workshopName || 'DREAM Discovery';

  const scoreLine = (label: string, n: number | null) => {
    const v = typeof n === 'number' ? `${n}/10` : '—';
    return `${label}: ${v}`;
  };

  const domainHtml = phaseInsights
    .map((p) => {
      const title = p.phase.charAt(0).toUpperCase() + p.phase.slice(1);
      return `
        <div style="margin-top: 16px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 6px;">${title}</div>
          <div style="color: #374151; font-size: 14px;">
            ${scoreLine('Current', p.currentScore)}<br/>
            ${scoreLine('Target', p.targetScore)}<br/>
            ${scoreLine('Projected', p.projectedScore)}
          </div>
        </div>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 18px;">
    <div style="background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="padding: 18px 18px 0 18px;">
        <h1 style="margin: 0; font-size: 18px; color: #111827;">Your DREAM Discovery Summary</h1>
        <div style="margin-top: 6px; color: #6b7280; font-size: 14px;">${safeWorkshopName}</div>
      </div>

      <div style="padding: 18px;">
        <p style="margin: 0 0 12px 0; color: #111827;">Hi ${participantName},</p>
        <p style="margin: 0 0 12px 0; color: #374151;">
          Thank you for completing the DREAM Discovery questionnaire. Your summary report is now ready.
        </p>

        <div style="margin: 16px 0; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Executive Summary</div>
          ${tone ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">Tone: <strong style="color:#111827;">${tone}</strong></div>` : ''}
          <div style="white-space: pre-wrap; color: #374151; font-size: 14px; line-height: 1.4;">${(executiveSummary || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>

        <div style="margin-top: 14px;">
          <div style="font-weight: 600; color: #111827;">Scores by domain</div>
          ${domainHtml}
        </div>

        <div style="margin: 16px 0; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Feedback</div>
          <div style="white-space: pre-wrap; color: #374151; font-size: 14px; line-height: 1.4;">${(feedback || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>

        <div style="text-align: center; margin-top: 18px;">
          <a href="${discoveryUrl}" style="display: inline-block; background: #4a90a4; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View report in browser
          </a>
        </div>

        <p style="margin-top: 18px; font-size: 12px; color: #6b7280;">
          This link is unique to you. Please don't share it with others.
        </p>
      </div>
    </div>

    <div style="text-align:center; color:#9ca3af; font-size:12px; margin-top: 12px;">© Ethenta Ltd</div>
  </div>
</body>
</html>
`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL as string,
    to,
    subject: `Your DREAM Discovery Summary — ${safeWorkshopName}`,
    html,
  });

  const maybeResult = result as any;
  if (maybeResult?.error) {
    const message =
      typeof maybeResult.error === 'string'
        ? maybeResult.error
        : maybeResult.error?.message || JSON.stringify(maybeResult.error);
    throw new Error(message);
  }

  return result;
}
