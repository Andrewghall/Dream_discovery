// Email templates for DREAM Discovery Platform

interface WorkshopInvitationData {
  participantName: string;
  workshopName: string;
  organizationName: string;
  discoveryUrl: string;
  deadline?: string;
}

export function workshopInvitationTemplate(data: WorkshopInvitationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workshop Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #4F46E5; margin: 0 0 10px 0; font-size: 28px;">DREAM Discovery</h1>
      <p style="color: #6B7280; margin: 0; font-size: 14px;">Powered by ${data.organizationName}</p>
    </div>

    <!-- Main Content -->
    <div style="background: #F9FAFB; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
      <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px;">Hi ${data.participantName},</h2>

      <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
        You've been invited to participate in a discovery workshop: <strong>${data.workshopName}</strong>
      </p>

      <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
        This is your opportunity to share your insights, challenges, and vision. The conversation typically takes 15-20 minutes.
      </p>

      ${data.deadline ? `
      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="color: #92400E; margin: 0; font-size: 14px;">
          <strong>⏰ Please complete by:</strong> ${data.deadline}
        </p>
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.discoveryUrl}" style="display: inline-block; background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Start Discovery Session
        </a>
      </div>

      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
        Your responses are confidential and will help shape the future of your organization.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB;">
      <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 10px 0;">
        If you have any questions, please reach out to your workshop facilitator.
      </p>
      <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} ${data.organizationName} · Powered by DREAM Discovery
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

interface PasswordResetData {
  userName: string;
  resetUrl: string;
  expiresIn: string;
}

export function passwordResetTemplate(data: PasswordResetData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #4F46E5; margin: 0 0 10px 0; font-size: 28px;">DREAM Discovery</h1>
      <p style="color: #6B7280; margin: 0; font-size: 14px;">Platform Admin</p>
    </div>

    <!-- Main Content -->
    <div style="background: #F9FAFB; border-radius: 12px; padding: 30px; margin-bottom: 30px;">
      <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px;">Password Reset Request</h2>

      <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
        Hi ${data.userName},
      </p>

      <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
        We received a request to reset your password. Click the button below to create a new password:
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.resetUrl}" style="display: inline-block; background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
      </div>

      <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="color: #991B1B; margin: 0; font-size: 14px;">
          <strong>⏰ This link expires in ${data.expiresIn}</strong>
        </p>
      </div>

      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB;">
      <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 10px 0;">
        For security reasons, never share this link with anyone.
      </p>
      <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} DREAM Discovery Platform
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  role: string;
  organizationName?: string;
  maxSeats?: number;
}

export function welcomeEmailTemplate(data: WelcomeEmailData): string {
  const isTenantAdmin = data.role === 'TENANT_ADMIN';
  const isTenantUser = data.role === 'TENANT_USER';

  const bodyText = isTenantAdmin
    ? `You have been selected to manage the <strong>${data.organizationName || 'DREAM'}</strong> DREAM platform on behalf of your business. Please access from the link below to set up your password and access your domain and users.`
    : isTenantUser
    ? `You have been given access to the <strong>${data.organizationName || 'DREAM'}</strong> DREAM Discovery platform. Please use the link below to set up your password and get started.`
    : `Your platform administrator account has been created. Please use the link below to set up your password and access the platform.`;

  const seatsNotice = isTenantAdmin && data.maxSeats
    ? `<div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
        <p style="color: #1E40AF; margin: 0; font-size: 14px; line-height: 1.6;">
          You have up to <strong>${data.maxSeats} user${data.maxSeats === 1 ? '' : 's'}</strong> under your licence. If you require additional seats, please contact
          <a href="mailto:admin@ethenta.com" style="color: #1D4ED8;">admin@ethenta.com</a>.
        </p>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DREAM Discovery</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #1E3A5F; margin: 0 0 6px 0; font-size: 30px; font-weight: 700; letter-spacing: -0.5px;">DREAM Discovery</h1>
      <p style="color: #6B7280; margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Account Access</p>
    </div>

    <!-- Card -->
    <div style="background: #FFFFFF; border-radius: 16px; padding: 36px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Welcome ${data.userName},</h2>

      <p style="color: #374151; line-height: 1.7; margin: 0 0 20px 0; font-size: 16px;">
        ${bodyText}
      </p>

      ${seatsNotice}

      <!-- Login Credentials -->
      <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 20px; margin: 24px 0;">
        <p style="color: #6B7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 12px 0;">Your Login Details</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6B7280; font-size: 14px; padding: 5px 0; width: 120px; vertical-align: top;">Email</td>
            <td style="color: #111827; font-size: 14px; font-family: 'Courier New', monospace; padding: 5px 0;">${data.userEmail}</td>
          </tr>
          <tr>
            <td style="color: #6B7280; font-size: 14px; padding: 5px 0; vertical-align: top;">Temp. Password</td>
            <td style="color: #111827; font-size: 14px; font-family: 'Courier New', monospace; padding: 5px 0;">${data.temporaryPassword}</td>
          </tr>
        </table>
      </div>

      <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 16px; margin: 0 0 28px 0; border-radius: 4px;">
        <p style="color: #92400E; margin: 0; font-size: 13px; line-height: 1.5;">
          <strong>Security notice:</strong> You will be prompted to set a new password on first login. Do not share these credentials.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 0 0 12px 0;">
        <a href="${data.loginUrl}" style="display: inline-block; background: #1E3A5F; color: #FFFFFF; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Set Up My Account
        </a>
      </div>
      <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin: 0;">
        Or copy this link: <a href="${data.loginUrl}" style="color: #3B82F6; word-break: break-all;">${data.loginUrl}</a>
      </p>

    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 4px;">
      <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 4px 0;">
        Need help? Contact <a href="mailto:admin@ethenta.com" style="color: #6B7280;">admin@ethenta.com</a>
      </p>
      <p style="color: #D1D5DB; font-size: 11px; margin: 0;">
        &copy; ${new Date().getFullYear()} Ethenta &middot; DREAM Discovery Platform
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

// ─── Tenant Onboarding Email ───────────────────────────────────────────────

interface TenantOnboardingData {
  organizationName: string;
  billingEmail: string;
  adminName: string | null;
  maxSeats: number;
  loginUrl: string;
}

export function tenantOnboardingTemplate(data: TenantOnboardingData): string {
  const greeting = data.adminName ? data.adminName.split(' ')[0] : data.organizationName;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DREAM Discovery</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #4F46E5; margin: 0 0 8px 0; font-size: 30px; font-weight: 700;">DREAM Discovery</h1>
      <p style="color: #6B7280; margin: 0; font-size: 14px;">Powered by Ethenta</p>
    </div>

    <!-- Main Card -->
    <div style="background: #ffffff; border-radius: 12px; padding: 36px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 22px; font-weight: 600;">
        Welcome, ${greeting}!
      </h2>
      <p style="color: #6B7280; font-size: 15px; margin: 0 0 28px 0;">
        Your DREAM Discovery tenancy for <strong>${data.organizationName}</strong> has been created and is ready to use.
      </p>

      <!-- Details -->
      <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6B7280; font-size: 13px; padding: 6px 0; width: 140px;">Organisation</td>
            <td style="color: #111827; font-size: 13px; font-weight: 600; padding: 6px 0;">${data.organizationName}</td>
          </tr>
          <tr>
            <td style="color: #6B7280; font-size: 13px; padding: 6px 0;">Billing Email</td>
            <td style="color: #111827; font-size: 13px; font-weight: 600; padding: 6px 0;">${data.billingEmail}</td>
          </tr>
          <tr>
            <td style="color: #6B7280; font-size: 13px; padding: 6px 0;">Seat Licence</td>
            <td style="color: #111827; font-size: 13px; font-weight: 600; padding: 6px 0;">${data.maxSeats} users</td>
          </tr>
        </table>
      </div>

      <!-- What happens next -->
      <div style="background: #EEF2FF; border-left: 4px solid #4F46E5; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="color: #3730A3; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">What happens next?</p>
        <p style="color: #4338CA; font-size: 14px; line-height: 1.6; margin: 0;">
          We will set up your account and send you a separate email with your login credentials and temporary password. You'll be able to log in and get started straight away.
        </p>
      </div>

      <p style="color: #6B7280; font-size: 13px; line-height: 1.6; margin: 0;">
        If you have any questions in the meantime, contact us at <a href="mailto:admin@ethenta.com" style="color: #4F46E5;">admin@ethenta.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center;">
      <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 4px 0;">
        Questions? Contact <a href="mailto:admin@ethenta.com" style="color: #6B7280;">admin@ethenta.com</a>
      </p>
      <p style="color: #D1D5DB; font-size: 11px; margin: 0;">
        &copy; ${new Date().getFullYear()} Ethenta &middot; DREAM Discovery Platform
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}
