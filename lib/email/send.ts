import { Resend } from 'resend';
import {
  workshopInvitationTemplate,
  workshopInvitationText,
  passwordResetTemplate,
  passwordResetText,
  welcomeEmailTemplate,
  welcomeEmailText,
  tenantOnboardingTemplate,
  tenantOnboardingText,
} from './templates';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// Single consistent from-address for all emails.
// One sender identity builds reputation faster than per-org addresses.
const fromEmail = process.env.FROM_EMAIL || 'DREAM Discovery <dream@dream.ethenta.com>';

/**
 * Generic email sender used by monitoring/alerts and other internal systems.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const { data, error } = await getResend().emails.send({
    from: fromEmail,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    console.error('Failed to send email:', error);
    throw new Error(error.message);
  }
  return { success: true, emailId: data?.id };
}

/**
 * Derive a branded from-address for an organisation.
 * e.g. "DREAM" → "DREAM <DREAM@dream.ethenta.com>"
 * Falls back to the default FROM_EMAIL if no orgName supplied.
 */
export function orgFromEmail(orgName?: string): string {
  if (!orgName) return fromEmail;
  // Sanitise to a safe local-part: lowercase, letters/numbers/hyphens only
  const slug = orgName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const domain = process.env.EMAIL_DOMAIN || 'dream.ethenta.com';
  return `${orgName} <${slug}@${domain}>`;
}

export async function sendWorkshopInvitation(params: {
  to: string;
  participantName: string;
  workshopName: string;
  organizationName: string;
  discoveryUrl: string;
  deadline?: string;
}) {
  const templateData = {
    participantName: params.participantName,
    workshopName: params.workshopName,
    organizationName: params.organizationName,
    discoveryUrl: params.discoveryUrl,
    deadline: params.deadline,
  };
  const html = workshopInvitationTemplate(templateData);
  const text = workshopInvitationText(templateData);

  try {
    const { data, error } = await getResend().emails.send({
      from: fromEmail,
      to: [params.to],
      subject: `${params.workshopName} — Discovery Invitation`,
      html,
      text,
    });

    if (error) {
      console.error('Failed to send workshop invitation:', error);
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error: any) {
    console.error('Email send error:', error);
    throw error;
  }
}

export async function sendPasswordReset(params: {
  to: string;
  userName: string;
  resetUrl: string;
  expiresIn?: string;
}) {
  const templateData = {
    userName: params.userName,
    resetUrl: params.resetUrl,
    expiresIn: params.expiresIn || '1 hour',
  };
  const html = passwordResetTemplate(templateData);
  const text = passwordResetText(templateData);

  try {
    const { data, error } = await getResend().emails.send({
      from: fromEmail,
      to: [params.to],
      subject: 'Reset your DREAM Discovery password',
      html,
      text,
    });

    if (error) {
      console.error('Failed to send password reset:', error);
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error: any) {
    console.error('Email send error:', error);
    throw error;
  }
}

export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
  userEmail: string;
  temporaryPassword?: string;
  loginUrl: string;
  setPasswordUrl?: string;
  role: string;
  organizationName?: string;
  maxSeats?: number;
  from?: string; // override sender - defaults to org-derived address
}) {
  const templateData = {
    userName: params.userName,
    userEmail: params.userEmail,
    temporaryPassword: params.temporaryPassword || 'Use the Set Password link below',
    loginUrl: params.loginUrl,
    setPasswordUrl: params.setPasswordUrl,
    role: params.role,
    organizationName: params.organizationName,
    maxSeats: params.maxSeats,
  };
  const html = welcomeEmailTemplate(templateData);
  const text = welcomeEmailText(templateData);

  try {
    const { data, error } = await getResend().emails.send({
      from: params.from ?? fromEmail,
      to: [params.to],
      subject: 'Your DREAM Discovery account is ready',
      html,
      text,
    });

    if (error) {
      console.error('Failed to send welcome email:', error);
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error: any) {
    console.error('Email send error:', error);
    throw error;
  }
}

export async function sendTenantOnboarding(params: {
  billingEmail: string;
  organizationName: string;
  adminName: string | null;
  maxSeats: number;
  loginUrl: string;
}) {
  const templateData = {
    organizationName: params.organizationName,
    billingEmail: params.billingEmail,
    adminName: params.adminName,
    maxSeats: params.maxSeats,
    loginUrl: params.loginUrl,
  };
  const html = tenantOnboardingTemplate(templateData);
  const text = tenantOnboardingText(templateData);

  try {
    const { data, error } = await getResend().emails.send({
      from: fromEmail,
      to: [params.billingEmail],
      subject: `${params.organizationName} — your DREAM Discovery workspace is ready`,
      html,
      text,
    });

    if (error) {
      console.error('Failed to send tenant onboarding email:', error);
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error: any) {
    console.error('Tenant onboarding email error:', error);
    throw error;
  }
}
