/**
 * Monitoring and alerting system for security events
 */

import { sendEmail } from '@/lib/email/send';

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'ethenta_admin@ethenta.com';

interface FailedLoginAlert {
  email: string;
  ip: string;
  attempts: number;
  timeWindow: string;
}

interface NewUserAlert {
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
  createdBy: string;
}

interface WorkshopCompletionAlert {
  workshopId: string;
  workshopName: string;
  organizationName: string;
  completedBy: string;
}

interface SystemErrorAlert {
  path: string;
  method: string;
  statusCode: number;
  error: string;
  userId?: string;
  timestamp: Date;
}

/**
 * Send alert for multiple failed login attempts
 */
export async function sendFailedLoginAlert(data: FailedLoginAlert) {
  const subject = `🚨 Security Alert: ${data.attempts} Failed Login Attempts`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert-box { background: #fee; border-left: 4px solid #c00; padding: 15px; margin: 20px 0; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { margin: 8px 0; }
          .label { font-weight: bold; color: #666; }
          .value { color: #000; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="color: #c00;">Security Alert</h1>

          <div class="alert-box">
            <strong>Multiple failed login attempts detected!</strong>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="label">Email:</span>
              <span class="value">${data.email}</span>
            </div>
            <div class="detail-row">
              <span class="label">IP Address:</span>
              <span class="value">${data.ip}</span>
            </div>
            <div class="detail-row">
              <span class="label">Failed Attempts:</span>
              <span class="value">${data.attempts}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time Window:</span>
              <span class="value">${data.timeWindow}</span>
            </div>
          </div>

          <p><strong>Action Required:</strong></p>
          <ul>
            <li>Review login attempts in the admin dashboard</li>
            <li>Check if this is a legitimate user who forgot their password</li>
            <li>Consider blocking this IP if it's a brute force attack</li>
            <li>Review security logs for additional suspicious activity</li>
          </ul>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated security alert from DREAM Discovery Platform.<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: ALERT_EMAIL,
    subject,
    html,
  });
}

/**
 * Send alert for new user registration
 */
export async function sendNewUserAlert(data: NewUserAlert) {
  const subject = `👤 New User Created: ${data.name}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { margin: 8px 0; }
          .label { font-weight: bold; color: #666; }
          .value { color: #000; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="color: #2196F3;">New User Created</h1>

          <div class="info-box">
            <strong>A new user has been added to the platform.</strong>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="label">Name:</span>
              <span class="value">${data.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Email:</span>
              <span class="value">${data.email}</span>
            </div>
            <div class="detail-row">
              <span class="label">Role:</span>
              <span class="value">${data.role}</span>
            </div>
            <div class="detail-row">
              <span class="label">Organization:</span>
              <span class="value">${data.organizationId || 'Platform Admin (No Organization)'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Created By:</span>
              <span class="value">${data.createdBy}</span>
            </div>
          </div>

          <p>The user has been sent a welcome email with their temporary password.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated notification from DREAM Discovery Platform.<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: ALERT_EMAIL,
    subject,
    html,
  });
}

/**
 * Send alert for workshop completion
 */
export async function sendWorkshopCompletionAlert(data: WorkshopCompletionAlert) {
  const subject = `✅ Workshop Completed: ${data.workshopName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .success-box { background: #e8f5e9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { margin: 8px 0; }
          .label { font-weight: bold; color: #666; }
          .value { color: #000; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="color: #4CAF50;">Workshop Completed</h1>

          <div class="success-box">
            <strong>A workshop has been marked as completed!</strong>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="label">Workshop:</span>
              <span class="value">${data.workshopName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Organization:</span>
              <span class="value">${data.organizationName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Completed By:</span>
              <span class="value">${data.completedBy}</span>
            </div>
            <div class="detail-row">
              <span class="label">Workshop ID:</span>
              <span class="value">${data.workshopId}</span>
            </div>
          </div>

          <p>You can view the workshop results and scratchpad in the admin dashboard.</p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated notification from DREAM Discovery Platform.<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: ALERT_EMAIL,
    subject,
    html,
  });
}

/**
 * Send alert for system errors (500 responses)
 */
export async function sendSystemErrorAlert(data: SystemErrorAlert) {
  const subject = `🔥 System Error: ${data.statusCode} on ${data.path}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .error-box { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .detail-row { margin: 8px 0; }
          .label { font-weight: bold; color: #666; }
          .value { color: #000; }
          .error-message { background: #fff; border: 1px solid #ddd; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="color: #f44336;">System Error</h1>

          <div class="error-box">
            <strong>A system error occurred that requires attention!</strong>
          </div>

          <div class="details">
            <div class="detail-row">
              <span class="label">Path:</span>
              <span class="value">${data.path}</span>
            </div>
            <div class="detail-row">
              <span class="label">Method:</span>
              <span class="value">${data.method}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status Code:</span>
              <span class="value">${data.statusCode}</span>
            </div>
            ${data.userId ? `
            <div class="detail-row">
              <span class="label">User ID:</span>
              <span class="value">${data.userId}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Timestamp:</span>
              <span class="value">${data.timestamp.toISOString()}</span>
            </div>
          </div>

          <p><strong>Error Details:</strong></p>
          <div class="error-message">
            ${data.error}
          </div>

          <p><strong>Action Required:</strong></p>
          <ul>
            <li>Check server logs for full stack trace</li>
            <li>Verify database connectivity</li>
            <li>Check external API status (Resend, Supabase)</li>
            <li>Review recent code deployments</li>
          </ul>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated error alert from DREAM Discovery Platform.
          </p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: ALERT_EMAIL,
    subject,
    html,
  });
}

/**
 * Check for suspicious failed login patterns and send alerts
 */
export async function checkFailedLoginPatterns() {
  const { prisma } = await import('@/lib/prisma');

  // Check last 15 minutes for failed logins
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const failedLogins = await prisma.loginAttempt.groupBy({
    by: ['email'],
    where: {
      success: false,
      createdAt: {
        gte: fifteenMinutesAgo,
      },
    },
    _count: true,
  });

  // Alert if 5 or more failed attempts for same email
  for (const login of failedLogins) {
    if (login._count >= 5) {
      await sendFailedLoginAlert({
        email: login.email,
        ip: 'Multiple IPs', // Could track this in login_attempts if needed
        attempts: login._count,
        timeWindow: 'Last 15 minutes',
      });
    }
  }
}
