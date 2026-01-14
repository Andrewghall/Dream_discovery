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

  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY environment variable');
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding: 20px; }
    .deadline { background: #fef3c7; padding: 12px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">DREAM Discovery</h1>
    </div>
    <div class="content">
      <h2>Hi ${participantName}!</h2>
      <p>
        You've been invited to participate in the discovery phase for <strong>${workshopName}</strong>.
      </p>
      ${workshopDescription ? `<p style="color: #6b7280;">${workshopDescription}</p>` : ''}
      <p>
        This is a brief 15-minute AI-facilitated conversation designed to gather your unique insights and perspectives before our workshop. Your input will help shape our discussion and ensure we address what matters most to you.
      </p>
      <p><strong>What to expect:</strong></p>
      <ul>
        <li>A conversational dialogue with an AI facilitator</li>
        <li>Questions about challenges, constraints, and your vision</li>
        <li>Approximately 15 minutes of your time</li>
        <li>Your responses will be kept confidential (you can choose to be anonymous)</li>
      </ul>
      ${responseDeadline ? `
      <div class="deadline">
        <strong>Please complete by:</strong> ${responseDeadline.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </div>
      ` : ''}
      <div style="text-align: center;">
        <a href="${discoveryUrl}" class="button">
          Start Discovery Conversation
        </a>
      </div>
      <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
        This link is unique to you. Please don't share it with others.
      </p>
    </div>
    <div class="footer">
      <p>DREAM Discovery Platform</p>
      <p>Facilitating meaningful conversations for better workshops</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'DREAM Discovery <onboarding@resend.dev>',
      to,
      subject: `You're invited: ${workshopName} - Discovery Phase`,
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

    console.log('✅ Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}
