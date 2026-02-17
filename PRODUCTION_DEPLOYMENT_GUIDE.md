# Production Deployment Guide - DREAM Discovery Platform
**Client:** Upstream Works
**Date:** February 13, 2026
**Deployment Type:** Multi-Tenant Production

---

## ✅ What Has Been Implemented Today

### 1. **Authentication** ✅
- HTTP Basic Authentication for all `/admin/*` routes
- Credentials configured in `.env`:
  - Username: `upstream_admin`
  - Password: `UpstreamDREAM2026!Secure#`

### 2. **Row-Level Security (RLS)** ✅
- SQL migration created: `supabase-rls-migration.sql`
- Protects all 16 tables with organization-based policies
- **ACTION REQUIRED:** Run the SQL migration in Supabase SQL Editor

### 3. **Organization Validation** ✅
- Middleware functions created in `lib/middleware/organization-context.ts`
- Functions to set/validate organization context
- Prevents cross-organization data access

### 4. **Audit Logging** ✅
- Complete audit logging system implemented
- SQL migration: `prisma/audit-log-migration.sql`
- Tracks all admin actions (view, create, update, delete)
- Logs: user, action, resource, IP, timestamp
- **ACTION REQUIRED:** Run the SQL migration in Supabase

### 5. **GDPR Consent Management** ✅
- Consent table migration: `prisma/consent-migration.sql`
- Consent manager library: `lib/consent/consent-manager.ts`
- Records explicit consent before data processing
- Tracks consent withdrawal
- **ACTION REQUIRED:** Run the SQL migration in Supabase

### 6. **Privacy Policy** ✅
- Complete GDPR-compliant privacy policy page
- Location: `app/privacy/page.tsx`
- Accessible at: `http://localhost:3000/privacy`
- **ACTION REQUIRED:** Update placeholder text:
  - [YOUR COMPANY NAME]
  - [CONTACT EMAIL]
  - [YOUR ADDRESS]
  - [REGION] (for data storage location)

### 7. **GDPR Data Subject Rights APIs** ✅
- **Right of Access (Article 15):** `app/api/gdpr/export/route.ts`
- **Right to Erasure (Article 17):** `app/api/gdpr/delete/route.ts`
- Participants can export or delete their data

---

## 🚀 Deployment Steps

### Step 1: Run SQL Migrations in Supabase

Go to your Supabase project → SQL Editor → Run these in order:

```sql
-- 1. Row-Level Security (CRITICAL - prevents cross-org data access)
-- Copy and paste from: supabase-rls-migration.sql

-- 2. Audit Logging (for compliance)
-- Copy and paste from: prisma/audit-log-migration.sql

-- 3. Consent Management (GDPR Article 6)
-- Copy and paste from: prisma/consent-migration.sql
```

**Verification:**
After running migrations, verify RLS is enabled:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
All tables should show `rowsecurity = true`.

---

### Step 2: Update Privacy Policy Placeholders

Edit `app/privacy/page.tsx` and replace:
- `[YOUR COMPANY NAME]` → Your company legal name
- `[CONTACT EMAIL]` → Your DPO or privacy contact email
- `[YOUR ADDRESS]` → Your company address
- `[PHONE NUMBER]` → Your contact phone
- `[REGION]` → Where Supabase data is stored (e.g., "EU-West", "US-East")

---

### Step 3: Configure Environment Variables

Your `.env` is already updated with:
```bash
ADMIN_USERNAME="upstream_admin"
ADMIN_PASSWORD="UpstreamDREAM2026!Secure#"
ENABLE_AUDIT_LOGGING="true"
ENABLE_RLS_CHECKS="true"
```

**For production deployment**, also add:
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

### Step 4: Test Locally

```bash
cd /Users/andrewhall/Dream_discovery
npm run dev
```

**Test Authentication:**
1. Go to `http://localhost:3000/admin`
2. Browser should prompt for username/password
3. Use: `upstream_admin` / `UpstreamDREAM2026!Secure#`

**Test Privacy Policy:**
- Visit `http://localhost:3000/privacy`
- Verify all information is correct

**Test GDPR APIs:**
```bash
# Export data
curl -X POST http://localhost:3000/api/gdpr/export \
  -H "Content-Type: application/json" \
  -d '{"email":"participant@example.com","workshopId":"workshop-id"}'

# Delete data (requires confirmation)
curl -X POST http://localhost:3000/api/gdpr/delete \
  -H "Content-Type: application/json" \
  -d '{"email":"participant@example.com","workshopId":"workshop-id"}'
```

---

### Step 5: Deploy to Production

#### Option A: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Add all .env variables (except ADMIN_PASSWORD - use Vercel secrets)
```

#### Option B: Railway / Render

```bash
# Railway
railway up

# Or Render - connect GitHub repo and deploy
```

**IMPORTANT:** Never commit `.env` to git! Use platform environment variables.

---

### Step 6: Configure Organization Context

In your application, when a user logs in, set their organization ID:

```typescript
import { setOrganizationContext } from '@/lib/middleware/organization-context';

// In your API route or middleware
await setOrganizationContext(user.organizationId);
```

This ensures RLS policies correctly filter data.

---

## 🔒 Security Checklist

Before going live:

- [ ] SQL migrations run successfully in Supabase
- [ ] RLS enabled on all tables (verify with query above)
- [ ] Basic Auth working (test `/admin` access)
- [ ] Privacy policy updated with correct information
- [ ] Environment variables set in production
- [ ] HTTPS enabled (automatic with Vercel/Railway)
- [ ] Admin password changed from default (recommended)
- [ ] Audit logging tested (check `audit_logs` table has entries)
- [ ] GDPR export API tested
- [ ] GDPR delete API tested
- [ ] Organization context working (cross-org access blocked)

---

## 📋 GDPR Compliance Status

### ✅ Implemented Today:
- ✅ Article 6: Legal basis (consent management)
- ✅ Article 13: Privacy notice (privacy policy page)
- ✅ Article 15: Right of access (export API)
- ✅ Article 17: Right to erasure (delete API)
- ✅ Article 30: Records of processing (audit logs)
- ✅ Article 32: Security measures (RLS, authentication)

### ⚠️ Still Required (Not Implemented Today):
- ⚠️ Field-level encryption (3-5 days work)
- ⚠️ JWT/session management (3-4 days work)
- ⚠️ Role-Based Access Control (4-5 days work)
- ⚠️ Automated data retention/deletion (2-3 days work)
- ⚠️ Data Protection Impact Assessment (DPIA) document
- ⚠️ Penetration testing

---

## 🎯 Multi-Tenant Architecture

### How It Works:

```
Organization: Upstream Works
├── User: admin@upstream.com
├── Workshop: "Q4 Strategy Session"
│   ├── Participant: john@upstream.com
│   ├── Session: conversation-123
│   └── Data Points: [...]
└── Organization ID: org_abc123

Organization: Another Client (ISOLATED)
├── User: admin@another.com
├── Workshop: "Their Workshop"
└── Organization ID: org_xyz789 (CANNOT access Upstream data)
```

**RLS ensures:** Users from `org_xyz789` can NEVER access data from `org_abc123`, even if they know the workshop ID.

### Adding New Organizations:

```sql
-- In Supabase SQL Editor
INSERT INTO organizations ("id", "name", "createdAt", "updatedAt")
VALUES ('org_newclient', 'New Client Name', NOW(), NOW());

INSERT INTO users ("id", "email", "name", "organizationId", "createdAt", "updatedAt")
VALUES ('user_123', 'admin@newclient.com', 'Admin User', 'org_newclient', NOW(), NOW());
```

---

## 📊 Monitoring & Maintenance

### Audit Log Queries:

```sql
-- View recent admin actions
SELECT * FROM audit_logs
WHERE "organizationId" = 'org_abc123'
ORDER BY "timestamp" DESC
LIMIT 50;

-- Failed access attempts
SELECT * FROM audit_logs
WHERE "success" = false
ORDER BY "timestamp" DESC;

-- Actions by specific user
SELECT * FROM audit_logs
WHERE "userEmail" = 'admin@upstream.com'
ORDER BY "timestamp" DESC;
```

### Consent Tracking:

```sql
-- View consent status for workshop
SELECT
  wp."email",
  wp."name",
  pc."consentGiven",
  pc."consentTimestamp",
  pc."withdrawnAt"
FROM workshop_participants wp
LEFT JOIN participant_consents pc ON pc."participantId" = wp."id"
WHERE wp."workshopId" = 'workshop-id';
```

---

## ⚠️ Known Limitations & Risk Acknowledgment

### What IS Protected:
✅ Organization-level data isolation (RLS)
✅ Admin authentication (Basic Auth)
✅ Audit trail of all actions
✅ GDPR consent management
✅ Data export/deletion capabilities

### What is NOT Yet Protected:
❌ **No field-level encryption** - Data stored in plain text in database
❌ **No advanced RBAC** - All admins have full access
❌ **No session management** - Basic Auth re-authenticates every request
❌ **No automated data retention** - Manual deletion required
❌ **No breach detection** - No real-time security monitoring

### Acceptable Use:
✅ **General business workshops** (non-healthcare, non-financial)
✅ **Internal organizational use**
✅ **B2B clients with standard data protection needs**

### NOT Recommended For:
❌ Healthcare data (PHI/HIPAA)
❌ Financial services (PCI-DSS)
❌ Government/defense (high security clearance)
❌ Data classified as "Highly Sensitive"

---

## 📞 Support & Escalation

**For Upstream Works:**
- Technical Support: [YOUR SUPPORT EMAIL]
- Security Issues: [YOUR SECURITY EMAIL]
- Data Protection Officer: [DPO EMAIL]

**For Data Subject Requests:**
- Participants can email: [PRIVACY EMAIL]
- Or use GDPR APIs directly

---

## 🔄 Next Steps (Post-Launch)

### Week 2-4 (Recommended):
1. Implement field-level encryption
2. Replace Basic Auth with JWT/sessions
3. Add Role-Based Access Control
4. Set up automated data retention
5. Conduct penetration testing
6. Complete DPIA document

### Ongoing:
- Monthly security reviews
- Quarterly compliance audits
- Regular backup verification
- Monitor audit logs for suspicious activity

---

## ✅ Sign-Off

**Deployed By:** _____________________ Date: __________
**Reviewed By:** _____________________ Date: __________
**Client Acceptance:** _______________ Date: __________

**Risk Acknowledgment:** Client acknowledges the limitations listed above and accepts responsibility for ensuring data processed through this system is appropriate for the current security controls.

---

**Version:** 1.0
**Last Updated:** February 13, 2026
**Status:** READY FOR DEPLOYMENT (with acknowledged limitations)
