# Monitoring & Alerts System - Documentation

## Overview
The DREAM Discovery platform includes automated monitoring and alerting for security events, user activities, and system errors.

## Alert Types

### 1. Failed Login Attempts (Security Alert)
**Trigger:** 5+ failed login attempts for the same email within 15 minutes

**Alert Includes:**
- Email address being targeted
- IP address (if tracked)
- Number of failed attempts
- Time window

**Actions Required:**
- Review login attempts in admin dashboard
- Check if legitimate user forgot password
- Consider IP blocking if brute force attack
- Review security logs

**Example:**
```
Subject: 🚨 Security Alert: 5 Failed Login Attempts
Email: user@example.com
Failed Attempts: 5
Time Window: Last 15 minutes
```

### 2. New User Created
**Trigger:** Any time a new user is created in the system

**Alert Includes:**
- User name and email
- Role (PLATFORM_ADMIN or TENANT_ADMIN)
- Organization (for tenant admins)
- Who created the user

**Actions Required:**
- Verify user creation was intentional
- Confirm welcome email was sent

**Example:**
```
Subject: 👤 New User Created: John Doe
Email: john@upstreamworks.com
Role: TENANT_ADMIN
Organization: Upstream Works
Created By: Platform Admin
```

### 3. Workshop Completion
**Trigger:** Workshop status changed to COMPLETED

**Alert Includes:**
- Workshop name
- Organization
- Who completed it
- Workshop ID

**Actions Required:**
- Review workshop results
- Follow up with client if needed

**Example:**
```
Subject: ✅ Workshop Completed: Digital Transformation
Workshop: Digital Transformation Workshop
Organization: Upstream Works
Completed By: admin@upstreamworks.com
```

### 4. System Errors (500 Responses)
**Trigger:** Any 500-level error response from API endpoints

**Alert Includes:**
- API path
- HTTP method
- Status code
- Error message
- User ID (if available)
- Timestamp

**Actions Required:**
- Check server logs for full stack trace
- Verify database connectivity
- Check external APIs (Resend, Supabase, CaptureAPI)
- Review recent deployments

**Example:**
```
Subject: 🔥 System Error: 500 on /api/admin/workshops
Path: /api/admin/workshops/abc123
Method: POST
Status Code: 500
Error: Database connection timeout
```

## Configuration

### Environment Variables
```bash
# .env file
ALERT_EMAIL="ethenta_admin@ethenta.com"  # Where alerts are sent
CRON_SECRET="your-secret-token"           # Auth for cron endpoint
RESEND_API_KEY="your-resend-key"          # Email service
```

### Alert Email Recipient
Alerts are sent to the email specified in `ALERT_EMAIL` environment variable. Default: `ethenta_admin@ethenta.com`

To change the recipient:
1. Update `.env` file: `ALERT_EMAIL="your-email@example.com"`
2. Restart the application

## API Endpoints

### Health Check
```
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-13T10:30:00.000Z",
  "checks": {
    "database": true,
    "env": {
      "databaseUrl": true,
      "resendApiKey": true,
      "nextPublicAppUrl": true
    }
  }
}
```

### Security Check (Cron Job)
```
GET /api/cron/check-security
Headers: Authorization: Bearer YOUR_CRON_SECRET
```

**Purpose:** Checks for failed login patterns and sends alerts

**How to use:**
- Set up external cron service (cron-job.org, EasyCron, etc.)
- Configure to call this endpoint every 15 minutes
- Include Authorization header with CRON_SECRET

**Response:**
```json
{
  "success": true,
  "message": "Security check completed",
  "timestamp": "2026-02-13T10:30:00.000Z"
}
```

## Setup Instructions

### 1. Configure Environment Variables
Add to your `.env` file:
```bash
ALERT_EMAIL="your-email@ethenta.com"
CRON_SECRET="generate-strong-random-string"
```

### 2. Set Up Cron Job (External Service)

#### Option A: cron-job.org (Free)
1. Go to https://cron-job.org
2. Create account
3. Add new cron job:
   - Title: "DREAM Security Check"
   - URL: `https://your-domain.com/api/cron/check-security`
   - Execution: Every 15 minutes
   - HTTP Headers: `Authorization: Bearer YOUR_CRON_SECRET`

#### Option B: Vercel Cron (if deployed on Vercel)
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-security",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

#### Option C: Manual Testing
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3001/api/cron/check-security
```

### 3. Test Alerts

#### Test Failed Login Alert:
1. Go to login page
2. Enter incorrect password 5 times
3. Wait for alert email (sent immediately on 5th failure)

#### Test New User Alert:
1. Go to `/admin/users`
2. Click "Create New User"
3. Fill form and submit
4. Check for alert email

#### Test System Error Alert:
Alerts are sent automatically when 500 errors occur. Monitor logs to verify.

## Monitoring Dashboard

### View Failed Logins
```
/admin/dashboard
```
Shows failed logins in last 24 hours

### View Active Sessions
```
/admin/sessions
```
Shows all active user sessions

### View Audit Logs (Coming Soon)
```
/admin/audit-logs
```
Full audit trail of all events

## Alert Email Templates

All alerts use professional HTML templates with:
- Color-coded headers (red=error, blue=info, green=success)
- Structured details table
- Action items
- Timestamp
- Branding

## Troubleshooting

### Alerts Not Sending

**Check 1: Resend API Key**
```bash
# Verify env variable
echo $RESEND_API_KEY

# Test email endpoint
curl http://localhost:3001/api/test-email
```

**Check 2: Alert Email**
```bash
# Verify env variable
echo $ALERT_EMAIL

# Should be a valid email address
```

**Check 3: Email Logs**
Check server logs for email errors:
```
Failed to send alert: [error message]
```

### Cron Job Not Running

**Check 1: Authorization**
- Verify CRON_SECRET in .env matches header
- Check external cron service configuration

**Check 2: Endpoint Accessible**
```bash
# Test endpoint
curl -H "Authorization: Bearer YOUR_SECRET" \
  https://your-domain.com/api/cron/check-security
```

**Check 3: External Service**
- Verify cron service is active
- Check execution logs in cron service dashboard

## Future Enhancements

- [ ] Slack integration for real-time alerts
- [ ] SMS alerts for critical errors (Twilio)
- [ ] Alert grouping (prevent spam)
- [ ] Alert dashboard with metrics
- [ ] Custom alert thresholds per tenant
- [ ] Weekly summary reports
- [ ] Integration with Sentry/DataDog

## Security Considerations

### Email Security
- Alerts may contain sensitive information (user emails, error details)
- Use secure email service (Resend with TLS)
- Limit alert recipients to trusted admins

### Cron Endpoint Security
- Protected by Authorization header with secret token
- Change CRON_SECRET regularly
- Monitor for unauthorized access attempts

### Data Retention
- Audit logs stored indefinitely (implement retention policy)
- Login attempts logged for security analysis
- Consider GDPR implications for log retention

---

**Status:** ✅ Complete
**Date:** February 13, 2026
**Phase:** Phase 2 - Task #9
