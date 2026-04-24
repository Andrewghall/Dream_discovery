import { Resend } from 'resend';

interface SendInvitationParams {
  to: string;
  participantName: string;
  workshopName: string;
  workshopDescription?: string;
  discoveryUrl: string;
  responseDeadline?: Date;
}

export async function sendDiscoveryInvitation(params: SendInvitationParams) {
  const { to, participantName, workshopName, workshopDescription, discoveryUrl, responseDeadline } = params;

  console.log('📧 Attempting to send email to:', to);
  console.log('📧 From email:', process.env.FROM_EMAIL);
  console.log('📧 Resend API Key exists:', !!process.env.RESEND_API_KEY);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discovery Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

        <!-- Header -->
        <tr>
          <td bgcolor="#1E3A5F" style="background-color: #1E3A5F; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">DREAM Discovery</h1>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="background: #FFFFFF; padding: 32px 32px 28px 32px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${participantName}!</h2>
            <p style="color: #374151; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">
              You've been invited to participate in the discovery phase for <strong>${workshopName}</strong>.
            </p>
            ${workshopDescription ? `<p style="color: #6B7280; line-height: 1.6; margin: 0 0 16px 0; font-size: 14px;">${workshopDescription}</p>` : ''}
            <p style="color: #374151; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">
              This is a brief 15-minute AI-facilitated conversation designed to gather your unique insights and perspectives before our workshop. Your input will help shape our discussion and ensure we address what matters most to you.
            </p>
            <p style="color: #374151; font-size: 15px; font-weight: 600; margin: 0 0 10px 0;">What to expect:</p>
            <ul style="color: #374151; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;">
              <li>A conversational dialogue with an AI facilitator</li>
              <li>Questions about challenges, constraints, and your vision</li>
              <li>Approximately 15 minutes of your time</li>
              <li>Your responses will be kept confidential (you can choose to be anonymous)</li>
            </ul>
            ${responseDeadline ? `
            <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px 0;">
              <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                <strong>Please complete by:</strong> ${responseDeadline.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            ` : ''}

            <!-- CTA Button — inline styles only; span locks the text colour against email-client link overrides -->
            <div style="text-align: center; margin: 28px 0 24px 0;">
              <a href="${discoveryUrl}" style="display: inline-block; background-color: #1E3A5F; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
                <span style="color: #FFFFFF; text-decoration: none;">Start Discovery Conversation</span>
              </a>
            </div>

            <p style="font-size: 13px; color: #9CA3AF; margin: 0; text-align: center;">
              This link is unique to you. Please don't share it with others.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="text-align: center; padding: 24px 0 0 0;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 4px 0;">DREAM Discovery Platform</p>
            <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Facilitating meaningful conversations for better workshops</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL as string,
    to,
    subject: `You're invited: ${workshopName} - Discovery Phase`,
    html,
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

  console.log('✅ Email sent successfully:', result);
  return result;
}
