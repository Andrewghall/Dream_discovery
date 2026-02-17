# ✅ DREAM Discovery - Production Deployment Checklist
**Client:** Upstream Works | **Date:** February 13, 2026

---

## 🚀 30-Minute Deployment Checklist

### ⚡ CRITICAL - Do These First (15 mins)

#### 1. Run SQL Migrations in Supabase ⚠️ REQUIRED
```
Go to: Supabase Dashboard → SQL Editor

Run in this order:
1. supabase-rls-migration.sql (Row-Level Security)
2. prisma/audit-log-migration.sql (Audit Logging)
3. prisma/consent-migration.sql (Consent Management)
```

**Verify RLS is enabled:**
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public';
```
All should show `rowsecurity = true`

✅ Done? ____

---

#### 2. Update Privacy Policy (5 mins)
```
Edit: app/privacy/page.tsx

Replace these placeholders:
- [YOUR COMPANY NAME] → Your legal company name
- [CONTACT EMAIL] → privacy@yourcompany.com
- [YOUR ADDRESS] → Your business address
- [PHONE NUMBER] → Support phone
- [REGION] → "EU-West" or "US-East" (where Supabase runs)
```

✅ Done? ____

---

#### 3. Test Authentication (2 mins)
```bash
# Start dev server
npm run dev

# Open browser to:
http://localhost:3000/admin

# Should prompt for login:
Username: upstream_admin
Password: UpstreamDREAM2026!Secure#
```

✅ Works? ____

---

### 🔧 CONFIGURATION (10 mins)

#### 4. Environment Variables
Your `.env` is already configured with:
```bash
ADMIN_USERNAME="upstream_admin"
ADMIN_PASSWORD="UpstreamDREAM2026!Secure#"
DATABASE_URL="postgresql://postgres:..."
OPENAI_API_KEY="sk-proj-..."
NEXT_PUBLIC_CAPTUREAPI_URL="https://captureapi-production.up.railway.app"
ENABLE_AUDIT_LOGGING="true"
ENABLE_RLS_CHECKS="true"
```

**For production, add:**
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

✅ Done? ____

---

#### 5. Change Admin Password (RECOMMENDED)
```bash
# In .env, change:
ADMIN_PASSWORD="YourNewSecurePassword123!"
```

✅ Done? ____

---

### 🧪 TESTING (5 mins)

#### 6. Test Privacy Policy
```
Visit: http://localhost:3000/privacy
```
✅ Loads correctly? ____
✅ No [PLACEHOLDERS] visible? ____

---

#### 7. Test GDPR APIs
```bash
# Test export (should return 404 if no data)
curl -X POST http://localhost:3000/api/gdpr/export \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","workshopId":"test-id"}'

# Test delete (should return 404 if no data)
curl -X POST http://localhost:3000/api/gdpr/delete \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","workshopId":"test-id"}'
```

✅ APIs respond (even with 404)? ____

---

### 🚢 DEPLOYMENT

#### 8. Deploy to Vercel (5 mins)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard:
# - Copy all from .env
# - NEVER commit .env to git!
```

✅ Deployed? ____
✅ URL: _________________________

---

#### 9. Test Production
```
Visit: https://your-app.vercel.app/admin
```
✅ Authentication works? ____
✅ Privacy policy loads? ____

---

### 📋 FINAL CHECKS

#### 10. Security Verification
- [ ] RLS enabled in Supabase (run verification query)
- [ ] Audit logs table exists (`SELECT * FROM audit_logs LIMIT 1`)
- [ ] Consent table exists (`SELECT * FROM participant_consents LIMIT 1`)
- [ ] Admin auth working (browser prompt shows)
- [ ] HTTPS enabled (Vercel does this automatically)
- [ ] Environment vars in Vercel (not in code!)

---

#### 11. Documentation Review
- [ ] Read: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- [ ] Read: `RISK_ACKNOWLEDGMENT_UPSTREAM_WORKS.md`
- [ ] Read: `GDPR_ISO27001_MULTI_TENANT_ANALYSIS.md`
- [ ] Privacy policy customized
- [ ] Admin password changed from default

---

#### 12. Client Handoff
- [ ] Share production URL with Upstream Works
- [ ] Share admin credentials (secure channel)
- [ ] Share RISK_ACKNOWLEDGMENT document for signature
- [ ] Schedule follow-up for Week 2 enhancements

---

## 🎯 YOU'RE LIVE!

**Production URL:** _________________________
**Admin Username:** upstream_admin
**Admin Password:** _________________________

---

## 📞 Support Contacts

**Technical Issues:** _________________________
**Security Concerns:** _________________________
**GDPR Questions:** _________________________

---

## ⚠️ REMEMBER

### ✅ What's Protected:
- Organization data isolation (RLS)
- Admin authentication
- Audit trail
- GDPR rights (export/delete)
- Consent management

### ⚠️ What's Not Yet Done:
- Field-level encryption (3-5 days)
- JWT sessions (3-4 days)
- RBAC (4-5 days)
- Automated retention (2-3 days)

### 📅 Next Steps:
Week 2-4: Implement remaining security controls
Week 5-8: Complete GDPR compliance
Week 9-12: Penetration testing & certification

---

## 🔥 Emergency Rollback

If something goes wrong:

1. **Disable RLS temporarily:**
```sql
-- In Supabase
ALTER TABLE workshops DISABLE ROW LEVEL SECURITY;
-- (repeat for other tables)
```

2. **Revert .env changes:**
```bash
git checkout .env
```

3. **Contact support immediately**

---

**Version:** 1.0
**Last Updated:** February 13, 2026
**Status:** ✅ READY FOR PRODUCTION

---

## ✍️ Completion Sign-Off

**Deployed By:** _______________________ Date: __________
**Tested By:** _________________________ Date: __________
**Approved By:** _______________________ Date: __________

**All checkboxes above marked?** YES / NO

**Ready for client use?** YES / NO

---

**CONGRATULATIONS! 🎉**
Your multi-tenant DREAM Discovery platform is now live!
