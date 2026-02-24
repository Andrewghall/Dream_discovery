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
  const orgName = data.organizationName || 'your organisation';

  const roleLabel = isTenantAdmin ? 'Administrator' : isTenantUser ? 'User' : 'Platform Administrator';

  const bodyText = isTenantAdmin
    ? `You have been set up as the <strong>${orgName}</strong> administrator on the DREAM Discovery platform. Use the credentials below to sign in, set your password, and begin managing your workshops and users.`
    : isTenantUser
    ? `You have been given access to the <strong>${orgName}</strong> DREAM Discovery platform. Use the credentials below to sign in and get started.`
    : `Your platform administrator account has been created. Use the credentials below to sign in and access the platform.`;

  const seatsNotice = isTenantAdmin && data.maxSeats
    ? `<tr><td style="padding: 0 0 24px 0;">
        <div style="background: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 14px 18px;">
          <p style="color: #1E40AF; margin: 0; font-size: 14px; line-height: 1.6;">
            Your licence includes up to <strong>${data.maxSeats} seat${data.maxSeats === 1 ? '' : 's'}</strong>. Need more? Contact
            <a href="mailto:admin@ethenta.com" style="color: #1D4ED8; text-decoration: underline;">admin@ethenta.com</a>.
          </p>
        </div>
      </td></tr>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DREAM Discovery</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6;">
    <tr><td align="center" style="padding: 40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

        <!-- Header -->
        <tr><td style="text-align: center; padding-bottom: 32px;">
          <h1 style="color: #1E3A5F; margin: 0 0 4px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">DREAM Discovery</h1>
          <p style="color: #9CA3AF; margin: 0; font-size: 13px; letter-spacing: 0.5px;">${orgName !== 'your organisation' ? orgName : ''}</p>
        </td></tr>

        <!-- Card -->
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);">
            <tr><td style="padding: 36px 36px 0 36px;">

              <!-- Role badge -->
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; background: #EEF2FF; color: #4338CA; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.3px;">${roleLabel}</span>
              </div>

              <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 22px; font-weight: 600;">Welcome, ${data.userName}</h2>

              <p style="color: #4B5563; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                ${bodyText}
              </p>

            </td></tr>

            ${seatsNotice ? `<tr><td style="padding: 0 36px;">${seatsNotice}</td></tr>` : ''}

            <!-- Login Credentials -->
            <tr><td style="padding: 0 36px;">
              <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 22px; margin-bottom: 20px;">
                <p style="color: #9CA3AF; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px 0;">Sign-in credentials</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color: #6B7280; font-size: 13px; padding: 6px 0; width: 90px; vertical-align: top;">Email</td>
                    <td style="color: #111827; font-size: 14px; font-weight: 500; padding: 6px 0;">${data.userEmail}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 4px 0;"><div style="border-top: 1px solid #E5E7EB;"></div></td>
                  </tr>
                  <tr>
                    <td style="color: #6B7280; font-size: 13px; padding: 6px 0; vertical-align: top;">Password</td>
                    <td style="color: #111827; font-size: 14px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; font-weight: 500; padding: 6px 0; letter-spacing: 0.3px;">${data.temporaryPassword}</td>
                  </tr>
                </table>
              </div>
            </td></tr>

            <!-- Security notice -->
            <tr><td style="padding: 0 36px;">
              <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin-bottom: 28px;">
                <p style="color: #92400E; margin: 0; font-size: 13px; line-height: 1.5;">
                  You will be asked to create a new password on first sign-in. Please do not share these credentials.
                </p>
              </div>
            </td></tr>

            <!-- CTA Button -->
            <tr><td style="padding: 0 36px 12px 36px; text-align: center;">
              <a href="${data.loginUrl}" style="display: inline-block; background: #1E3A5F; color: #FFFFFF; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
                Sign In &amp; Set Password
              </a>
            </td></tr>
            <tr><td style="padding: 0 36px 36px 36px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
                Or visit: <a href="${data.loginUrl}" style="color: #6B7280; word-break: break-all;">${data.loginUrl}</a>
              </p>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="text-align: center; padding: 24px 0 0 0;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 4px 0;">
            Need help? <a href="mailto:admin@ethenta.com" style="color: #6B7280; text-decoration: underline;">admin@ethenta.com</a>
          </p>
          <p style="color: #D1D5DB; font-size: 11px; margin: 0;">
            &copy; ${new Date().getFullYear()} Ethenta &middot; DREAM Discovery Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
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
