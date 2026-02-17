# Disaster Recovery Plan - DREAM Discovery Platform

## Overview
This document outlines the disaster recovery procedures for the DREAM Discovery platform to ensure business continuity in case of system failures, data loss, or security incidents.

## Recovery Objectives

### RTO (Recovery Time Objective)
**Target: 4 hours**
- Maximum acceptable downtime before service must be restored
- Critical services (authentication, workshops) prioritized first

### RPO (Recovery Point Objective)
**Target: 15 minutes**
- Maximum acceptable data loss
- Supabase continuous backup with point-in-time recovery

## Backup Strategy

### Database Backups (Supabase)

**Automatic Backups:**
- **Frequency:** Continuous (real-time replication)
- **Retention:** 7 days (Supabase Pro plan)
- **Location:** Supabase infrastructure (AWS multiple regions)
- **Type:** Point-in-time recovery (PITR)

**Backup Verification:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workshops;"

# Verify recent data
psql $DATABASE_URL -c "SELECT MAX(created_at) FROM audit_logs;"
```

**Manual Backup (if needed):**
```bash
# Export entire database
pg_dump $DATABASE_URL > dream_backup_$(date +%Y%m%d).sql

# Export specific tables
pg_dump $DATABASE_URL -t workshops -t workshop_scratchpads > workshops_backup.sql
```

### File Backups

**HTML Exports:**
- Stored client-side (downloaded by users)
- No server-side storage required
- Users responsible for their own backups

**Configuration Files:**
- `.env` - **CRITICAL** - Store securely offline
- `prisma/schema.prisma` - Version controlled in Git
- Database migrations - Version controlled in Git

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption/Loss

**Detection:**
- Health check endpoint returns database error
- Users report data access issues
- Monitoring alerts triggered

**Recovery Steps:**
1. **Assess Damage**
   ```bash
   # Check database status
   curl https://your-app.com/api/health
   ```

2. **Restore from Supabase Backup**
   - Go to Supabase Dashboard > Database > Backups
   - Select recovery point (within last 7 days)
   - Click "Restore" (creates new database)
   - Update `DATABASE_URL` in production environment

3. **Verify Restoration**
   ```bash
   # Check data integrity
   psql $NEW_DATABASE_URL -c "SELECT COUNT(*) FROM workshops;"
   psql $NEW_DATABASE_URL -c "SELECT COUNT(*) FROM users;"
   ```

4. **Update Application**
   - Deploy new `DATABASE_URL` to production
   - Restart application
   - Test login and core functions

5. **Communicate**
   - Notify affected users
   - Document incident in audit log

**Estimated Recovery Time:** 2-3 hours

---

### Scenario 2: Application Deployment Failure

**Detection:**
- Health check returns 500 errors
- Application won't start
- Vercel deployment failed

**Recovery Steps:**
1. **Rollback Deployment**
   ```bash
   # Vercel rollback to previous deployment
   vercel rollback
   ```

2. **Fix and Redeploy**
   ```bash
   # Local testing
   npm run build
   npm run start

   # Deploy when fixed
   git revert HEAD
   git push origin main
   ```

3. **Verify Health**
   ```bash
   curl https://your-app.com/api/health
   ```

**Estimated Recovery Time:** 30 minutes - 1 hour

---

### Scenario 3: Encryption Key Loss

**Detection:**
- Decryption errors in logs
- "Failed to decrypt data" errors
- Cannot access encrypted workshop data

**Impact:** **CRITICAL** - All encrypted data becomes unrecoverable

**Prevention:**
- Store `ENCRYPTION_KEY` in multiple secure locations:
  1. Production environment variables (Vercel)
  2. Password manager (1Password, LastPass)
  3. Encrypted backup file (offline, secure location)
  4. Physical printout in safe

**Recovery:** **NOT POSSIBLE** without encryption key

**Mitigation:**
- Document key location
- Test key restoration quarterly
- Keep offline backup

---

### Scenario 4: Email Service Failure (Resend)

**Detection:**
- Password reset emails not sending
- Welcome emails failing
- Monitoring alerts not arriving

**Recovery Steps:**
1. **Check Resend Status**
   - Visit https://status.resend.com
   - Check API key validity

2. **Temporary Workaround**
   - Manual password resets via database:
   ```bash
   # Generate bcrypt hash for temporary password
   npm run reset-user-password user@example.com
   ```

3. **Alternative Email Provider**
   - Update `RESEND_API_KEY` with backup provider
   - Test email sending

**Estimated Recovery Time:** 1 hour

---

### Scenario 5: CaptureAPI Failure

**Detection:**
- Transcription fails
- Workshop sessions cannot process audio
- Railway deployment error

**Recovery Steps:**
1. **Check Railway Status**
   - Visit Railway dashboard
   - Check deployment logs
   - Verify service is running

2. **Restart CaptureAPI**
   - Railway Dashboard > Redeploy
   - Check dependencies installed correctly

3. **Verify Health**
   ```bash
   curl https://captureapi-production.up.railway.app/health
   ```

4. **Fallback Mode**
   - Disable live transcription temporarily
   - Use manual upload/processing

**Estimated Recovery Time:** 30 minutes - 2 hours

---

### Scenario 6: Security Breach

**Detection:**
- Unusual login patterns
- Multiple failed login attempts
- Unauthorized data access in audit logs

**Immediate Actions:**
1. **Contain the Breach**
   - Revoke all active sessions:
   ```sql
   UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL;
   ```
   - Change admin passwords immediately
   - Enable 2FA (if not already enabled)

2. **Assess Impact**
   - Review audit logs: `/admin/audit-logs`
   - Check for data exfiltration
   - Identify compromised accounts

3. **Secure the System**
   - Rotate all API keys (Resend, OpenAI, etc.)
   - Change `ENCRYPTION_KEY` (requires re-encryption)
   - Update `CRON_SECRET`

4. **Notify**
   - Alert affected users within 72 hours (GDPR requirement)
   - Document incident for compliance
   - Report to authorities if required

5. **Recovery**
   - Restore from pre-breach backup if data compromised
   - Implement additional security measures
   - Conduct security audit

**Estimated Recovery Time:** 4-8 hours

---

## Contact Information

### Emergency Contacts
- **Platform Admin:** ethenta_admin@ethenta.com
- **Technical Support:** support@ethenta.com
- **Supabase Support:** https://supabase.com/support
- **Vercel Support:** https://vercel.com/support
- **Railway Support:** https://railway.app/help

### Service Status Pages
- **Supabase:** https://status.supabase.com
- **Vercel:** https://www.vercel-status.com
- **Railway:** https://railway.statuspage.io
- **Resend:** https://status.resend.com

## Testing & Drills

### Quarterly Disaster Recovery Test

**Schedule:** First Monday of each quarter

**Test Checklist:**
- [ ] Verify database backup exists and is recent
- [ ] Test database restoration to staging environment
- [ ] Verify encryption key is accessible
- [ ] Test email system failover
- [ ] Review and update contact information
- [ ] Test health check endpoints
- [ ] Review and update this document

### Annual Security Drill

**Schedule:** Once per year

**Drill Scenario:**
- Simulate security breach
- Practice session revocation
- Test incident response procedures
- Review GDPR compliance
- Update security protocols

## Data Retention & Deletion

### Retention Periods
- **Audit Logs:** Indefinite (compliance requirement)
- **Login Attempts:** 90 days
- **Sessions:** Deleted on expiration/revocation
- **Workshops:** Indefinite (until customer requests deletion)

### GDPR Deletion Requests
Process user data deletion within 30 days:
```bash
# Use GDPR deletion API
curl -X DELETE /api/gdpr/delete \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-id-here"}'
```

## Compliance

### GDPR Article 32 (Security of Processing)
- ✅ Encryption at rest
- ✅ Audit logging
- ✅ Access controls (RLS)
- ✅ Breach notification procedures

### ISO 27001
- ✅ Backup procedures documented
- ✅ Recovery objectives defined
- ✅ Testing schedule established
- ✅ Incident response plan

## Recovery Runbook Summary

| Scenario | RTO | RPO | Priority |
|----------|-----|-----|----------|
| Database Loss | 2-3 hours | 15 min | CRITICAL |
| App Deployment Failure | 30-60 min | 0 min | HIGH |
| Encryption Key Loss | N/A | Total Loss | CRITICAL |
| Email Service Failure | 1 hour | N/A | MEDIUM |
| CaptureAPI Failure | 30 min - 2 hours | N/A | MEDIUM |
| Security Breach | 4-8 hours | Variable | CRITICAL |

---

**Document Version:** 1.0
**Last Updated:** February 13, 2026
**Next Review:** May 13, 2026 (Quarterly)
**Owner:** Platform Admin Team
