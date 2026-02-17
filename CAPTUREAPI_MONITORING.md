# CaptureAPI Monitoring - Setup Guide

## Overview
This document describes how to monitor the CaptureAPI service deployed on Railway to ensure reliable transcription and workshop processing.

## Health Check Endpoint

**URL:** `https://captureapi-production.up.railway.app/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "app_name": "CSI Capture API",
  "version": "1.0.0",
  "environment": "development"
}
```

## Monitoring Strategy

### 1. Uptime Monitoring (External)

**Recommended Services:**
- UptimeRobot (Free tier: 50 monitors, 5-min checks)
- Pingdom
- Better Uptime
- StatusCake

**Setup with UptimeRobot:**
1. Go to https://uptimerobot.com
2. Create account
3. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: "CaptureAPI Health"
   - URL: `https://captureapi-production.up.railway.app/health`
   - Monitoring Interval: 5 minutes
   - Alert Contacts: your-email@ethenta.com

4. Set up alerts:
   - Email notification on down
   - Email notification on up (recovery)

### 2. Railway Native Monitoring

**Access Railway Dashboard:**
1. Go to https://railway.app
2. Navigate to CaptureAPI project
3. Click "Observability" tab

**Available Metrics:**
- CPU Usage
- Memory Usage
- Network Traffic
- Request Count
- Response Times
- Error Rates

**Set Up Alerts:**
1. Click "Settings" > "Notifications"
2. Add email for deployment failures
3. Add email for crash notifications

### 3. Health Check from DREAM Platform

**Integration Point:**
Add health check to DREAM admin dashboard.

**Implementation:**
```typescript
// In /app/api/captureapi/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CAPTUREAPI_URL}/health`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      status: 'ok',
      captureapi: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

**Display on Dashboard:**
```typescript
// Add to /app/admin/dashboard/page.tsx
const captureApiStatus = await fetch('/api/captureapi/health');
const captureApiHealth = await captureApiStatus.json();

// Show status indicator
<div className="health-indicator">
  <span className={captureApiHealth.status === 'ok' ? 'text-green-600' : 'text-red-600'}>
    CaptureAPI: {captureApiHealth.status === 'ok' ? '✓ Healthy' : '✗ Unhealthy'}
  </span>
</div>
```

## Common Issues & Troubleshooting

### Issue 1: 502 Bad Gateway

**Symptoms:**
- Health endpoint returns 502
- Transcription fails

**Diagnosis:**
```bash
# Check Railway logs
railway logs --project captureapi-production

# Check health endpoint
curl https://captureapi-production.up.railway.app/health
```

**Common Causes:**
1. Application crashed on startup
2. Missing dependencies
3. Database connection failure
4. Port binding issue

**Resolution:**
- Check Railway logs for errors
- Verify all dependencies in requirements.txt
- Restart deployment in Railway dashboard
- Check DATABASE_URL and REDIS_URL are set

### Issue 2: Slow Response Times

**Symptoms:**
- Health check takes >5 seconds
- Transcription processing slow

**Diagnosis:**
- Check Railway metrics for CPU/Memory usage
- Review Railway logs for performance warnings

**Resolution:**
- Upgrade Railway plan if resource-constrained
- Optimize heavy dependencies
- Check for database query performance issues

### Issue 3: Missing Dependencies

**Symptoms:**
- ModuleNotFoundError in logs
- ImportError on startup

**Resolution:**
See RAILWAY_FIX_SUMMARY.md in CaptureAPI project

Key dependencies verified:
- numpy==1.26.3
- scikit-learn==1.4.0
- scipy==1.11.4
- soundfile==0.12.1

### Issue 4: Deepgram API Failures

**Symptoms:**
- Transcription returns errors
- "Invalid API key" messages

**Diagnosis:**
```bash
# Check Deepgram API key is set
railway variables --project captureapi-production | grep DEEPGRAM
```

**Resolution:**
- Verify DEEPGRAM_API_KEY is set correctly
- Check Deepgram account balance/quota
- Test with sample audio

## Performance Metrics

### Target Metrics
- **Uptime:** 99.5% (allows ~3.6 hours downtime/month)
- **Response Time:** <500ms for health check
- **Transcription Speed:** Real-time (1x audio length)
- **Error Rate:** <1%

### Monitor These KPIs
1. **Availability:** % uptime over 30 days
2. **Latency:** Average response time
3. **Throughput:** Requests per minute
4. **Error Rate:** Failed requests / total requests

## Alerting Rules

### Critical Alerts (Immediate Action)
- ❗ Service down for >5 minutes
- ❗ Error rate >10%
- ❗ Deployment failure

**Action:** Check Railway logs, restart if needed

### Warning Alerts (Monitor)
- ⚠️ Response time >2 seconds
- ⚠️ Memory usage >80%
- ⚠️ Error rate >1%

**Action:** Review logs, consider scaling

### Info Alerts
- ℹ️ Successful deployment
- ℹ️ Service recovered from downtime

## Logging

### Access Railway Logs

**Via Dashboard:**
1. Go to Railway project
2. Click on CaptureAPI service
3. Click "Logs" tab
4. Filter by level (info, error, warning)

**Via CLI:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs

# Follow logs in real-time
railway logs --follow

# Filter by level
railway logs --level error
```

### Important Log Patterns to Monitor

**Startup Success:**
```
application_ready
database_initialized
redis_initialized
```

**Errors to Alert On:**
```
unhandled_exception
database_connection_failed
deepgram_api_error
```

## Backup Monitoring

### CaptureAPI Database
- Same Supabase instance as DREAM
- Covered by main backup strategy
- Point-in-time recovery available

### Critical Data
- Transcription results stored in database
- Session metadata retained
- Audio files NOT stored (streaming only)

## Testing Checklist

### Weekly Health Check
- [ ] Visit health endpoint
- [ ] Verify status is "healthy"
- [ ] Check Railway deployment status
- [ ] Review error logs
- [ ] Verify uptime percentage

### Monthly Full Test
- [ ] Test transcription with sample audio
- [ ] Test speaker diarization
- [ ] Check WebSocket connectivity
- [ ] Review performance metrics
- [ ] Test failover scenarios

## Integration with DREAM Platform

### Workshop Processing Flow
1. User starts workshop session
2. DREAM calls CaptureAPI transcription endpoint
3. CaptureAPI processes audio with Deepgram
4. Transcription returned to DREAM
5. SLM processes transcription
6. Results saved to scratchpad

### Failure Handling in DREAM
- CaptureAPI unavailable → Show user-friendly error
- Transcription fails → Retry mechanism (3 attempts)
- Timeout → Graceful degradation

## Status Page (Future Enhancement)

### Create Public Status Page
Use https://statuspage.io or https://instatus.com

**Components to Monitor:**
- DREAM Discovery Platform
- CaptureAPI Service
- Database (Supabase)
- Email Service (Resend)

**Incidents to Report:**
- Planned maintenance
- Service degradation
- Outages
- Performance issues

---

**Last Updated:** February 13, 2026
**Owner:** Platform Admin Team
**Review Schedule:** Monthly
