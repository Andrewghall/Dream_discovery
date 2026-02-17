# GDPR & ISO 27001 Multi-Tenant Analysis - Dream Discovery Platform

**Date:** February 13, 2026
**Version:** 1.0
**Client:** Upstream Works
**Assessment Status:** ⚠️ REQUIRES IMMEDIATE ATTENTION

---

## Executive Summary

### Current Authentication Status
✅ **YES - Basic HTTP Authentication is implemented**
- Location: `/middleware.ts`
- Protects all `/admin/*` and `/api/admin/*` routes
- Uses HTTP Basic Auth with credentials from environment variables
- **Configuration Required:** Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`

### Multi-Tenant Architecture Status
✅ **Already Built for Multi-Tenant**
- Organization model exists with proper isolation
- All workshops, users, participants are scoped to `organizationId`
- Database schema supports multi-tenancy

### GDPR/ISO 27001 Compliance Status
🔴 **CRITICAL GAPS IDENTIFIED** - Not production-ready for regulated clients

---

## 1. Login Access Implementation ✅

### What We Built (Already Implemented)

**File:** `/Users/andrewhall/Dream_discovery/middleware.ts`

```typescript
// Protects ALL admin routes with Basic HTTP Authentication
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');

  // Check credentials from environment variables
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  // Validates Basic Auth header
  // Returns 401 Unauthorized if invalid
}
```

### Current Configuration (.env)
❌ **NOT CONFIGURED** - Missing from your `.env` file:
```bash
# ADD THESE:
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
```

### How to Enable
1. Add to `.env`:
   ```bash
   ADMIN_USERNAME=upstream_admin
   ADMIN_PASSWORD=<generate-strong-password-here>
   ```
2. Restart Next.js server
3. Browser will prompt for credentials when accessing `/admin/*`

### Security Level
- ⚠️ **Basic Auth (Moderate Security)**
- Suitable for: Internal tools, non-production
- NOT suitable for: Production with sensitive data (see recommendations below)

---

## 2. Multi-Tenant Architecture Analysis

### Database Schema Review ✅

**Multi-tenancy is PROPERLY implemented:**

```prisma
model Organization {
  id        String     @id @default(cuid())
  name      String
  users     User[]
  workshops Workshop[]
}

model User {
  organizationId   String
  organization     Organization @relation(...)
}

model Workshop {
  organizationId    String
  organization      Organization @relation(...)
  // All child tables reference workshopId
}
```

**Data Isolation:**
- ✅ Every workshop belongs to an organization
- ✅ Users are scoped to organizations
- ✅ Participants, sessions, insights all cascade from workshop
- ✅ 20 cascade delete relationships ensure data integrity

### Multi-Tenant Suitability: ✅ YES

**You CAN run this as multi-tenant**, but you MUST implement additional controls (see Section 4).

---

## 3. GDPR Compliance Analysis 🔴

### GDPR Requirements vs. Current Implementation

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Art. 5: Lawful Processing** | 🔴 Missing | No consent mechanism |
| **Art. 6: Legal Basis** | ⚠️ Partial | Need explicit consent tracking |
| **Art. 13-14: Transparency** | 🔴 Missing | No privacy notices |
| **Art. 15: Right of Access** | 🔴 Missing | No data export API |
| **Art. 16: Right to Rectification** | 🟡 Partial | Can edit but no tracking |
| **Art. 17: Right to Erasure** | ⚠️ Partial | Delete exists but no audit trail |
| **Art. 20: Data Portability** | 🔴 Missing | No export in structured format |
| **Art. 25: Privacy by Design** | 🟡 Partial | Some anonymization exists |
| **Art. 30: Records of Processing** | 🔴 Missing | No processing activity records |
| **Art. 32: Security Measures** | 🔴 Critical | No encryption at rest |
| **Art. 33-34: Breach Notification** | 🔴 Missing | No breach detection |

### Critical GDPR Gaps

#### 1. **No Consent Management** 🔴
**Issue:** Participants don't explicitly consent to data processing.

**Current:**
```typescript
// Participant can choose attribution
attributionPreference: 'NAMED' | 'ANONYMOUS'
```

**Required:**
- Explicit consent checkbox before conversation starts
- Record consent timestamp and IP address
- Allow withdrawal of consent
- Document legal basis for processing

#### 2. **No Data Encryption at Rest** 🔴
**Issue:** Sensitive data stored in plain text in Supabase PostgreSQL.

**Current:**
```prisma
model ConversationMessage {
  content   String  // Plain text!
}

model DataPoint {
  rawText   String  // Plain text!
}
```

**Risk:** If database is compromised, all conversation data is exposed.

**Required (ISO 27001 A.10.1.1):**
- Field-level encryption for sensitive data
- Encrypt: conversation content, participant emails, names
- Use AES-256-GCM encryption
- Store encryption keys in secure key management system (not in code)

#### 3. **No Audit Logging** 🔴
**Issue:** No record of who accessed what data when.

**Required (ISO 27001 A.12.4.1, GDPR Art. 30):**
```typescript
// Need an AuditLog table
model AuditLog {
  id         String   @id
  userId     String
  action     String   // "VIEW_WORKSHOP", "DELETE_PARTICIPANT", etc.
  resourceType String // "Workshop", "Participant", etc.
  resourceId String
  ipAddress  String
  userAgent  String
  timestamp  DateTime
  organizationId String
}
```

#### 4. **No Data Retention Policies** 🔴
**Issue:** Data stored indefinitely.

**Required (GDPR Art. 5(1)(e)):**
- Define retention periods by data type
- Automatic deletion after retention period
- Allow manual deletion requests
- Log all deletions

#### 5. **Cross-Organization Data Leakage Risk** 🔴
**Issue:** No application-level checks preventing data access across organizations.

**Current Risk:**
```typescript
// API endpoint could theoretically access any workshop
GET /api/admin/workshops/[id]
// No check if workshop.organizationId matches user's organizationId!
```

**Required:**
- Middleware to validate organization context
- Row-Level Security (RLS) in Supabase
- Never trust client-provided IDs

---

## 4. ISO 27001 Compliance Analysis 🔴

### ISO 27001 Controls Assessment

| Control | Requirement | Status | Gap |
|---------|-------------|--------|-----|
| **A.9.2.1** | User Registration | 🟡 Partial | No formal registration process |
| **A.9.2.2** | User Access Provisioning | 🔴 Missing | No access control system |
| **A.9.2.3** | Privileged Access Rights | 🔴 Missing | All admins have full access |
| **A.9.2.4** | User Secret Information | ⚠️ Weak | Basic Auth only |
| **A.9.4.1** | Information Access Restriction | 🔴 Missing | No RLS or access controls |
| **A.10.1.1** | Encryption at Rest | 🔴 Missing | Plain text in database |
| **A.10.1.2** | Encryption in Transit | ✅ Yes | HTTPS enforced |
| **A.12.3.1** | Information Backup | 🟡 Partial | Supabase handles, but no verification |
| **A.12.4.1** | Event Logging | 🔴 Missing | No audit logs |
| **A.12.4.3** | Administrator Logs | 🔴 Missing | No admin activity tracking |
| **A.14.2.1** | Secure Development | 🟡 Partial | No SSDLC process |
| **A.18.1.4** | Privacy & PII Protection | 🔴 Critical | Multiple gaps |

### Critical ISO 27001 Gaps

#### 1. **No Role-Based Access Control (A.9.2.2)** 🔴
**Current:** Single admin credentials for ALL users.

**Required:**
```typescript
enum UserRole {
  SUPER_ADMIN      // Can manage all organizations
  ORG_ADMIN        // Can manage their organization
  FACILITATOR      // Can manage workshops
  ANALYST          // Read-only access
}

model User {
  role UserRole
  organizationId String
  permissions Json // Granular permissions
}
```

#### 2. **No Session Management (A.9.2.4)** 🔴
**Current:** Basic Auth re-authenticates every request.

**Required:**
- JWT tokens with expiry
- Session timeout (15-30 minutes)
- Logout functionality
- Token refresh mechanism

#### 3. **No Incident Response (A.16.1.1)** 🔴
**Required:**
- Breach detection monitoring
- Automated alerts for suspicious activity
- Incident response plan document
- Contact information for security team

---

## 5. Multi-Tenant Security Requirements

### Mandatory Controls for Production Multi-Tenant

#### A. Organization Isolation (CRITICAL) 🔴

**Implement Supabase Row-Level Security (RLS):**

```sql
-- Enable RLS on all tables
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
-- ... etc for all tables

-- Policy: Users can only access their organization's data
CREATE POLICY "Users access own org workshops" ON workshops
  FOR ALL
  USING (organization_id = auth.user_org_id());

-- Function to get user's org ID from JWT
CREATE FUNCTION auth.user_org_id()
RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'organizationId'
$$ LANGUAGE SQL STABLE;
```

**Application-Level Checks:**
```typescript
// middleware/organization-check.ts
export async function validateOrganizationAccess(
  userId: string,
  resourceId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const resource = await prisma.workshop.findUnique({ where: { id: resourceId } });

  if (user.organizationId !== resource.organizationId) {
    throw new Error('FORBIDDEN: Cross-organization access attempt');
    // Log security incident
  }
}
```

#### B. Data Encryption (CRITICAL) 🔴

**Field-Level Encryption:**
```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.ENCRYPTION_KEY; // 32 bytes, stored in KMS

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  // ... return encrypted + IV + auth tag
}

export function decrypt(encrypted: string): string {
  // ... decrypt with key
}

// Use in Prisma middleware
prisma.$use(async (params, next) => {
  if (params.model === 'ConversationMessage') {
    if (params.action === 'create') {
      params.args.data.content = encrypt(params.args.data.content);
    }
    if (params.action === 'findMany' || params.action === 'findUnique') {
      const result = await next(params);
      if (result.content) {
        result.content = decrypt(result.content);
      }
      return result;
    }
  }
  return next(params);
});
```

#### C. Audit Logging (REQUIRED) 🔴

**Implement comprehensive audit trail:**
```typescript
// Create audit log table
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String?
  action         String   // "CREATE_WORKSHOP", "VIEW_PARTICIPANT", etc.
  resourceType   String   // "Workshop", "Participant"
  resourceId     String?
  ipAddress      String
  userAgent      String?
  metadata       Json?    // Additional context
  timestamp      DateTime @default(now())

  @@index([organizationId, timestamp])
  @@index([userId, timestamp])
}

// Middleware to log all admin actions
export async function auditMiddleware(request: NextRequest) {
  const logEntry = {
    organizationId: request.headers.get('x-org-id'),
    userId: request.headers.get('x-user-id'),
    action: `${request.method} ${request.nextUrl.pathname}`,
    ipAddress: request.headers.get('x-forwarded-for') || request.ip,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date(),
  };

  await prisma.auditLog.create({ data: logEntry });
}
```

#### D. Consent Management (GDPR Art. 6) 🔴

```typescript
model ParticipantConsent {
  id               String   @id @default(cuid())
  participantId    String
  consentVersion   String   // Version of privacy policy
  consentText      String   // Full text shown to user
  consentGiven     Boolean
  consentTimestamp DateTime
  ipAddress        String
  userAgent        String?
  withdrawnAt      DateTime?

  participant WorkshopParticipant @relation(...)
}

// Before starting conversation, require:
// 1. Show privacy notice
// 2. Get explicit consent checkbox
// 3. Record consent with timestamp + IP
// 4. Allow withdrawal anytime
```

---

## 6. Recommendations by Priority

### 🔴 CRITICAL - Must Fix Before Production

1. **Implement Row-Level Security (RLS) in Supabase**
   - Risk: Data leakage between organizations
   - Effort: 2-3 days
   - Impact: HIGH

2. **Add Field-Level Encryption**
   - Risk: GDPR breach, regulatory fines
   - Effort: 3-5 days
   - Impact: HIGH

3. **Implement Audit Logging**
   - Risk: No forensics if breach occurs
   - Effort: 2 days
   - Impact: HIGH

4. **Add Consent Management**
   - Risk: GDPR non-compliance (Art. 6)
   - Effort: 1-2 days
   - Impact: HIGH

### ⚠️ HIGH PRIORITY - Required for Compliance

5. **Replace Basic Auth with JWT + Sessions**
   - Risk: Weak authentication
   - Effort: 3-4 days
   - Impact: MEDIUM

6. **Implement Role-Based Access Control (RBAC)**
   - Risk: Over-privileged users
   - Effort: 4-5 days
   - Impact: MEDIUM

7. **Add Data Retention Policies**
   - Risk: GDPR Art. 5(1)(e) violation
   - Effort: 2-3 days
   - Impact: MEDIUM

8. **Data Subject Rights APIs**
   - Export data (Art. 15)
   - Delete data (Art. 17)
   - Effort: 3-4 days
   - Impact: MEDIUM

### 🟡 IMPORTANT - Compliance Recommended

9. **Security Monitoring & Alerting**
   - Detect unusual access patterns
   - Alert on cross-org access attempts
   - Effort: 2-3 days
   - Impact: LOW

10. **Privacy Impact Assessment (PIA)**
    - Document data flows
    - Identify privacy risks
    - Effort: 3-5 days
    - Impact: LOW

11. **Penetration Testing**
    - Third-party security audit
    - Effort: 1 week (external)
    - Impact: LOW

---

## 7. Multi-Tenant Deployment Strategy

### Option A: Single Supabase Instance (Recommended)

**Architecture:**
```
Supabase PostgreSQL (Single Database)
├── Organization: Upstream Works
│   ├── Workshop 1
│   ├── Workshop 2
│   └── Users (3)
├── Organization: Client B
│   ├── Workshop 1
│   └── Users (2)
└── Organization: Client C
    ├── Workshop 1
    ├── Workshop 2
    └── Users (5)
```

**Pros:**
- ✅ Cost-effective (single database)
- ✅ Easier maintenance
- ✅ Already built this way

**Cons:**
- ⚠️ Requires strict RLS implementation
- ⚠️ Higher risk if RLS misconfigured

**Suitable for:**
- Upstream Works and similar B2B clients
- Non-healthcare data
- General business workshops

### Option B: Separate Supabase Instances (High Security)

**Architecture:**
```
Supabase Project: Upstream Works
└── DATABASE_URL_UPSTREAM

Supabase Project: NHS Client
└── DATABASE_URL_NHS (separate, isolated)

Supabase Project: Finance Client
└── DATABASE_URL_FINANCE (separate, isolated)
```

**Pros:**
- ✅ Complete isolation (no shared database)
- ✅ Meets highest security requirements
- ✅ Suitable for healthcare (HIPAA-like)
- ✅ Suitable for financial services

**Cons:**
- ❌ Higher costs (multiple databases)
- ❌ More complex deployments
- ❌ Separate backups/monitoring

**Required for:**
- Healthcare data (PHI)
- Financial services (PCI-DSS)
- Government clients (GovCloud)

### Recommendation for Upstream Works

✅ **Use Option A (Single Instance) IF:**
1. You implement ALL critical security controls
2. You enable Row-Level Security
3. You encrypt sensitive data
4. Data is general business (not healthcare/finance)

⚠️ **Use Option B (Separate Instances) IF:**
- Client handles healthcare data
- Client is regulated financial institution
- Client explicitly requires data isolation
- Contract mandates separate infrastructure

---

## 8. Current .env Required Changes

### Add These Immediately:

```bash
# Authentication (REQUIRED)
ADMIN_USERNAME=upstream_admin
ADMIN_PASSWORD=<generate-strong-password>

# Encryption (REQUIRED for production)
ENCRYPTION_KEY=<32-byte-hex-string>  # Generate with: openssl rand -hex 32
ENCRYPTION_ENABLED=true

# Session Management
JWT_SECRET=<your-jwt-secret>
SESSION_TIMEOUT_MINUTES=30

# Security
ENABLE_AUDIT_LOGGING=true
ENABLE_RLS_CHECKS=true

# Organization (for multi-tenant)
DEFAULT_ORG_ID=<upstream-works-org-id>
```

---

## 9. Compliance Checklist for Production

### Before Going Live with Upstream Works:

- [ ] **Security**
  - [ ] Enable Row-Level Security on all tables
  - [ ] Implement field-level encryption
  - [ ] Add organization access validation middleware
  - [ ] Replace Basic Auth with JWT tokens
  - [ ] Implement session management
  - [ ] Enable HTTPS only (disable HTTP)

- [ ] **GDPR Compliance**
  - [ ] Add consent management for participants
  - [ ] Implement data export API (Art. 15)
  - [ ] Implement data deletion API (Art. 17)
  - [ ] Create privacy policy page
  - [ ] Add cookie consent (if using analytics)
  - [ ] Document data processing activities

- [ ] **Audit & Monitoring**
  - [ ] Implement comprehensive audit logging
  - [ ] Set up security monitoring alerts
  - [ ] Configure backup verification
  - [ ] Test incident response plan

- [ ] **Access Control**
  - [ ] Implement RBAC (roles: super-admin, org-admin, facilitator)
  - [ ] Add user invitation system
  - [ ] Add user deactivation/removal
  - [ ] Document access control policies

- [ ] **Data Management**
  - [ ] Define data retention periods
  - [ ] Implement automatic deletion after retention
  - [ ] Test data portability export
  - [ ] Verify cascade deletes work correctly

- [ ] **Documentation**
  - [ ] Create security documentation
  - [ ] Document API authentication
  - [ ] Create incident response plan
  - [ ] Write privacy impact assessment

- [ ] **Testing**
  - [ ] Penetration testing
  - [ ] Load testing (concurrent organizations)
  - [ ] RLS policy testing (cross-org access attempts)
  - [ ] Data encryption/decryption testing

---

## 10. Risk Assessment

### Risk Level: 🔴 HIGH

**Current State:**
- Multi-tenant architecture ✅ Built correctly
- Basic authentication ✅ Implemented
- GDPR compliance 🔴 **NOT READY**
- ISO 27001 compliance 🔴 **NOT READY**
- Data protection 🔴 **CRITICAL GAPS**

### Can You Go Multi-Tenant?

**Answer: ⚠️ YES, BUT...**

You CAN use multi-tenant for Upstream Works, BUT you MUST:

1. ✅ **Implement RLS immediately** (2-3 days)
2. ✅ **Add encryption** (3-5 days)
3. ✅ **Implement audit logging** (2 days)
4. ✅ **Add consent management** (1-2 days)
5. ⚠️ **Document data processing** (2 days)

**Total Effort: 10-14 days to production-ready**

### Risk if you don't fix these:

- 🔴 **GDPR fines:** Up to €20M or 4% of global revenue
- 🔴 **Data breach:** Reputational damage + legal liability
- 🔴 **Client trust:** Loss of enterprise clients
- 🔴 **Insurance:** May void cyber insurance coverage

---

## 11. Immediate Action Plan

### Week 1: Critical Security (Must Do)
1. **Day 1-2:** Implement Row-Level Security in Supabase
2. **Day 3-4:** Add field-level encryption for sensitive data
3. **Day 5:** Implement audit logging infrastructure

### Week 2: GDPR Compliance
4. **Day 6-7:** Add consent management system
5. **Day 8-9:** Implement data subject rights APIs (export, delete)
6. **Day 10:** Create privacy policy and notices

### Week 3: Authentication & Access
7. **Day 11-13:** Replace Basic Auth with JWT + sessions
8. **Day 14-15:** Implement RBAC system

### Week 4: Testing & Documentation
9. **Day 16-18:** Security testing and RLS verification
10. **Day 19-20:** Documentation and compliance review

**Total Timeline: 4 weeks to production-ready**

---

## 12. Cost Estimate

### Implementation Costs:
- Security engineer: 4 weeks × $150/hr × 40hrs = **$24,000**
- Penetration testing: **$5,000-8,000**
- Legal review (privacy policy): **$2,000-3,000**
- **Total: $31,000-35,000**

### Ongoing Costs:
- Supabase (multi-tenant): **$25-99/month**
- Security monitoring: **$50-200/month**
- Compliance audits: **$5,000-10,000/year**

---

## 13. Conclusion

### Current Status:
✅ **Architecture:** Multi-tenant ready
✅ **Authentication:** Basic implementation exists
🔴 **Security:** Critical gaps
🔴 **GDPR:** Not compliant
🔴 **ISO 27001:** Not compliant

### Can you use multi-tenant?

**YES, with 4 weeks of security work.**

### Recommendation:

1. **For Upstream Works (non-healthcare):**
   - ✅ Use single Supabase instance
   - ✅ Implement critical security controls (RLS, encryption, audit logs)
   - ✅ Add GDPR compliance features
   - Timeline: 4 weeks

2. **For healthcare/finance clients:**
   - ⚠️ Consider separate Supabase instances
   - ⚠️ Require full ISO 27001 audit
   - ⚠️ Additional compliance (HIPAA/PCI-DSS)

### Next Steps:

1. **Immediate:** Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` to `.env`
2. **Week 1:** Start implementing Row-Level Security
3. **Week 2:** Add encryption and audit logging
4. **Week 3:** Implement GDPR features
5. **Week 4:** Testing and go-live

---

**Assessment by:** Claude Code
**Review Required by:** Security Officer, Data Protection Officer
**Next Review:** After implementation of critical controls
