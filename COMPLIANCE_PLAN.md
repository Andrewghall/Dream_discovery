# DREAM Platform — Full Compliance Remediation Plan
**Frameworks**: ISO 27001:2022 · SOC 2 Type II · GDPR (UK & EU)
**Current overall score**: 34–42% (two independent audits, consolidated below)
**Target**: Audit-ready across all three frameworks
**Owner**: Assign before Phase 0 begins

---

## CONSOLIDATED CONTROL MATRIX

| # | Control Domain | Framework | Status | Blocker |
|---|---|---|---|---|
| 1 | ISMS / Security Governance | ISO 27001 Cl.4–10, SOC 2 CC1/CC2 | ❌ FAIL | No policy set, SoA, owners, or review cadence |
| 2 | Risk Management | ISO 27001 6.1, SOC 2 CC3, GDPR Art.35 | ⚠️ PARTIAL | No register, treatment plan, or DPIA |
| 3 | Authentication & Session Security | ISO 27001 A.5/A.8, SOC 2 CC6 | ✅ PASS | — |
| 4 | MFA / Privileged Access / Access Reviews | ISO 27001 A.5.15–18, SOC 2 CC6 | ⚠️ PARTIAL | No MFA; access-review.ts not running |
| 5 | Tenant Isolation | ISO 27001 A.5.15, SOC 2 CC6, GDPR Art.32 | ⚠️ PARTIAL | RLS bypass in org-context; no deployed evidence |
| 6 | Encryption at Rest / Key Management | ISO 27001 A.8.24, SOC 2 CC6/CC7, GDPR Art.32 | ⚠️ PARTIAL | Helpers exist; wired into zero routes |
| 7 | Audit Logging & Security Monitoring | ISO 27001 A.8.15–16, SOC 2 CC7 | ⚠️ PARTIAL | No SIEM; ~50% route coverage; logs deletable |
| 8 | Incident Response / Breach Handling | ISO 27001 A.5.24–28, SOC 2 CC7, GDPR Art.33–34 | ⚠️ PARTIAL | DISASTER_RECOVERY.md exists; no tested plan |
| 9 | Backup / BC/DR | ISO 27001 A.5.29–30, SOC 2 CC7/CC9 | ⚠️ PARTIAL | Docs exist; no restore test evidence |
| 10 | Secure SDLC / Change Management | ISO 27001 A.8.25–29, SOC 2 CC8 | ❌ FAIL | No SAST/DAST; no approval workflow evidence |
| 11 | Asset / Data Inventory / ROPA | ISO 27001 A.5.9, GDPR Art.30 | ❌ FAIL | No asset register; no ROPA |
| 12 | GDPR Transparency / Lawful Basis / Consent | GDPR Art.5, 6, 7, 13, 14 | ❌ FAIL | Privacy page has placeholders; ConsentRecord not in DB |
| 13 | GDPR Data Subject Rights | GDPR Art.15, 17, 20 | ✅ PASS | Endpoints exist and tested |
| 14 | Data Retention / Minimisation | GDPR Art.5(1)(c)(e), ISO 27001 A.5.33 | ⚠️ PARTIAL | Retention code not scheduled; placeholder in consent text |
| 15 | Vendor / Subprocessor / DPA / Transfers | GDPR Art.28, 44–49, SOC 2 CC9 | ❌ FAIL | No signed DPAs; no subprocessor register |
| 16 | DPIA / Privacy by Design | GDPR Art.25, 35 | ❌ FAIL | Explicitly marked incomplete in multiple docs |
| 17 | Hardcoded JWT fallback secret | SOC 2 CC6, ISO 27001 A.8.24 | ❌ CRITICAL | `capture-fallback-secret` in source |
| 18 | Unauthenticated `/api/speak` | SOC 2 CC6, ISO 27001 A.8 | ❌ CRITICAL | Zero auth on public endpoint |
| 19 | Input Validation (~90 admin routes) | ISO 27001 A.8.26, SOC 2 CC6 | ❌ FAIL | No Zod/Joi schemas |
| 20 | Password Complexity / History | ISO 27001 A.5.17, SOC 2 CC6 | ⚠️ PARTIAL | 8-char minimum only |

---

## PHASED REMEDIATION ROADMAP

---

### PHASE 0 — STOP THE BLEEDING (Week 1, before any audit engagement)

These must be fixed before any compliance claim. An auditor finding these live = immediate programme termination.

#### 0.1 Remove hardcoded JWT fallback secret

**File**: `app/api/capture-tokens/route.ts:16` and `app/api/capture-tokens/[token]/route.ts:15`

```typescript
// REMOVE THIS:
const secret = process.env.SESSION_SECRET ?? process.env.AUTH_SECRET ?? 'capture-fallback-secret';

// REPLACE WITH (fail-closed):
const secret = process.env.SESSION_SECRET ?? process.env.AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('SESSION_SECRET is required and must be at least 32 characters');
}
```

**Probe test**: Auditor will grep the repo for string literals used as crypto keys. This must return zero results.

---

#### 0.2 Authenticate `/api/speak`

**File**: `app/api/speak/route.ts`

Add at the top of the handler:

```typescript
const auth = await requireAuth(request);
if (!auth.ok) return auth.response;
```

Or if it is called from participant flows, validate the discoveryToken. Either way — zero unauthenticated access.

**Probe test**: `curl -X POST https://[domain]/api/speak -d '{"text":"test"}'` must return 401.

---

#### 0.3 Remove audit log DELETE endpoint

**File**: `app/api/admin/audit-logs/route.ts:79-90`

Delete the `DELETE` handler entirely. Audit logs must be append-only. If pruning is operationally required, it must require dual approval via a separate out-of-band process, never an API endpoint.

**Probe test**: `DELETE /api/admin/audit-logs` must return 405 Method Not Allowed.

---

#### 0.4 Strip discoveryToken from admin responses

**File**: `app/api/admin/workshops/[id]/route.ts:297`

Remove `discoveryToken` from the serialised workshop response. This is a GDPR auth credential for participants — exposing it to admins violates data minimisation.

```typescript
const { discoveryToken: _omit, ...safeWorkshop } = workshop;
return NextResponse.json(safeWorkshop);
```

---

#### 0.5 Fix RLS bypass in organisation context

**File**: `lib/middleware/organization-context.ts` (or equivalent)

The file explicitly notes Prisma bypasses RLS. Add a comment block confirming the application-layer enforcement is the intentional substitute, OR switch to using the Supabase `anon` / `authenticated` role so RLS applies. Document the architectural decision in `docs/architecture/rls-strategy.md`.

**Probe test**: Auditor will ask to see a DB query from a tenant session and verify it cannot return another tenant's rows, with a DB execution plan or Supabase log as evidence.

---

### PHASE 1 — GOVERNANCE FOUNDATION (Weeks 2–6)

No technical framework passes without documented governance. These are non-negotiable for ISO 27001 and SOC 2.

#### 1.1 Information Security Policy Set

Create `docs/policies/` with the following documents. Each must be dated, versioned, approved by a named owner, and reviewed annually.

| Policy | Key content |
|---|---|
| `information-security-policy.md` | Scope, objectives, management commitment, review cadence |
| `access-control-policy.md` | Least privilege, RBAC roles, MFA requirement, access review schedule |
| `acceptable-use-policy.md` | Permitted use of systems, data handling rules |
| `password-policy.md` | Min length 12, complexity, history (5 previous), max age 90 days |
| `data-classification-policy.md` | Classes: Public / Internal / Confidential / Restricted. PII = Restricted. |
| `encryption-policy.md` | AES-256 at rest for Restricted data; TLS 1.2+ in transit; key rotation schedule |
| `vulnerability-management-policy.md` | Scan cadence, CVSS severity SLAs (Critical: 24h, High: 7d, Medium: 30d) |
| `incident-response-policy.md` | Severity matrix, response SLAs, breach notification (72h GDPR) |
| `change-management-policy.md` | PR review requirements, staging, rollback procedure |
| `supplier-security-policy.md` | Vendor risk tiers, DPA requirement, annual review |

**Probe test**: Auditor will ask to see any policy, its version history, approval signature, and evidence of annual review.

---

#### 1.2 Statement of Applicability (SoA)

Create `docs/compliance/statement-of-applicability.md` mapping every ISO 27001:2022 Annex A control (93 controls) to:
- Included or excluded (with justification)
- Implementation status
- Owner
- Evidence artifact

**Template row**:
```
| A.5.1 | Policies for information security | Included | PASS | CISO | docs/policies/information-security-policy.md |
```

**Probe test**: ISO 27001 certification is impossible without a completed, approved SoA. Auditor will sample 10–15 controls at random and ask for evidence of each.

---

#### 1.3 Risk Register

Create `docs/compliance/risk-register.md` with:

```
| Risk ID | Description | Likelihood (1-5) | Impact (1-5) | Score | Treatment | Owner | Residual Risk | Accepted By | Review Date |
```

Minimum risks to document immediately:
- R001: Multi-tenant data breach (cross-tenant query)
- R002: Privilege escalation via impersonation endpoint
- R003: PII exposure through unencrypted DB storage
- R004: OpenAI/third-party API key compromise
- R005: Supabase misconfiguration disabling RLS
- R006: GDPR breach — consent not recorded before processing
- R007: Session token compromise
- R008: Supply chain attack via vulnerable npm dependency
- R009: Insider threat — platform admin data exfiltration
- R010: Supabase regional outage

Treatment options: Accept / Mitigate / Transfer / Avoid. Every risk requires a named owner and review date.

**Probe test**: Auditor will pick 3 risks and ask: what is the treatment? What evidence shows the mitigation is working? Who approved accepting residual risk?

---

#### 1.4 Asset Inventory and Data Classification Register

Create `docs/compliance/asset-inventory.md`:

```
| Asset ID | Asset | Type | Owner | Classification | Location | Retention | Disposal |
|---|---|---|---|---|---|---|---|
| A001 | Supabase PostgreSQL DB | Data | CTO | Restricted | EU-West (Supabase) | 7 years | Secure wipe via Supabase delete |
| A002 | Vercel deployment | Service | CTO | Internal | EU | N/A | Env var rotation + redeploy |
| A003 | OpenAI API integration | Third party | CTO | Confidential | US (OpenAI) | Session only | N/A |
| A004 | Railway CaptureAPI | Service | CTO | Confidential | EU | N/A | N/A |
| A005 | Workshop transcript data | Data | DPO | Restricted (PII) | Supabase EU | Per retention policy | Anonymisation |
| A006 | Participant email/name | Data | DPO | Restricted (PII) | Supabase EU | Per retention policy | Erasure API |
| A007 | GitHub repository | Code | CTO | Confidential | GitHub (US) | Indefinite | Branch deletion |
| A008 | Vercel environment vars | Secrets | CTO | Restricted | Vercel EU | Rotate 90 days | Env deletion |
```

**Probe test**: Auditor will ask what data is stored, where, and how it is classified. Without this document the answer cannot be given consistently.

---

### PHASE 2 — TECHNICAL REMEDIATION (Weeks 3–10)

#### 2.1 Wire Encryption at Rest

The `lib/workshop-encryption.ts` and `lib/encryption.ts` files are implemented but called nowhere. This is the most damaging technical gap for GDPR Art.32 and SOC 2 CC6.7.

**Files to modify**:

```
app/api/admin/workshops/route.ts          → encrypt on create (POST)
app/api/admin/workshops/[id]/route.ts     → decrypt on read (GET), encrypt on update (PATCH)
app/api/admin/participants/route.ts       → encrypt name/email on create
app/api/admin/participants/[id]/route.ts  → decrypt on read
app/api/admin/workshops/[id]/scratchpad/route.ts → encrypt v2_output on write
```

**Pattern**:
```typescript
import { encryptWorkshopData, decryptWorkshopData } from '@/lib/workshop-encryption';

// On write:
const encrypted = encryptWorkshopData(workshopData);
await prisma.workshop.create({ data: { ...encrypted } });

// On read:
const raw = await prisma.workshop.findUnique(...);
const decrypted = decryptWorkshopData(raw);
```

**Probe test**: Auditor will ask to see a raw DB record for a workshop. The `context`, `transcripts`, and any PII fields must be ciphertext (base64/hex string), not plaintext.

---

#### 2.2 Add ConsentRecord to Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
model ConsentRecord {
  id                String    @id @default(cuid())
  participantId     String
  workshopId        String
  consentVersion    String    // e.g. "v1.2"
  consentGiven      Boolean
  consentText       String    // Full text shown at time of consent
  ipAddress         String?
  userAgent         String?
  givenAt           DateTime  @default(now())
  withdrawnAt       DateTime?

  participant       Participant @relation(fields: [participantId], references: [id])
  workshop          Workshop    @relation(fields: [workshopId], references: [id])

  @@index([participantId])
  @@index([workshopId])
}
```

Wire `lib/consent/consent-manager.ts` to write this record before any data processing begins. Consent must be captured before the participant session starts.

**Probe test**: Auditor will ask: "Show me the consent record for participant X in workshop Y." Must be retrievable from DB.

---

#### 2.3 Implement MFA (TOTP minimum)

Minimum: TOTP (RFC 6238) for all PLATFORM_ADMIN and TENANT_ADMIN accounts.

**New files required**:
```
lib/auth/mfa.ts                    — TOTP generation/verification (use `otpauth` or `speakeasy`)
app/api/auth/mfa/enroll/route.ts   — Generate secret, return QR code
app/api/auth/mfa/verify/route.ts   — Verify TOTP code, issue MFA-verified session flag
app/api/auth/mfa/disable/route.ts  — Require re-auth + admin override
prisma/schema.prisma               — Add `mfaSecret`, `mfaEnabled`, `mfaBackupCodes` to User model
```

**Enforcement**: `middleware.ts` must check `session.mfaVerified === true` for any PLATFORM_ADMIN or TENANT_ADMIN request. Non-MFA sessions must be redirected to `/auth/mfa-challenge`.

**Probe test**: Auditor will attempt to access `/admin/platform` with a valid password but without completing MFA. Must be blocked.

---

#### 2.4 Add Input Validation (Zod) to All Admin Routes

Create `lib/validation/schemas.ts` with Zod schemas for all request bodies. Apply to every POST/PATCH/PUT in `app/api/admin/`.

Priority routes first:
```
app/api/admin/workshops/route.ts        — CreateWorkshopSchema
app/api/admin/users/create/route.ts     — CreateUserSchema (already partially validated)
app/api/admin/organizations/route.ts    — CreateOrgSchema
app/api/admin/participants/route.ts     — CreateParticipantSchema
app/api/admin/workshops/[id]/route.ts   — UpdateWorkshopSchema
```

Pattern:
```typescript
const body = CreateWorkshopSchema.safeParse(await request.json());
if (!body.success) {
  return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
}
```

**Probe test**: POST to any admin route with `{"__proto__":{"admin":true}}` must return 400, not 500 or 200.

---

#### 2.5 Add HSTS and CSP Headers

**File**: `next.config.ts`

```typescript
const securityHeaders = [
  // existing headers...
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",  // tighten after audit
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];
```

**Probe test**: `curl -I https://[domain]/` — auditor will check response headers. HSTS and CSP must be present.

---

#### 2.6 Schedule Data Retention Enforcement

**File**: `app/api/cron/retention/route.ts` (new)

```typescript
import { enforceRetention } from '@/lib/compliance/data-retention';

export async function GET(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });

  const result = await enforceRetention();
  await logAuditEvent({ action: 'DATA_RETENTION_RUN', metadata: result });
  return NextResponse.json(result);
}
```

Configure in Vercel cron: run daily at 02:00 UTC.

Fill in the `[INSERT RETENTION PERIOD]` placeholder in `lib/consent/consent-manager.ts`:
- Workshop data: 7 years from workshop date (or on erasure request)
- Participant personal data: 2 years after last session (or on erasure request)
- Audit logs: 7 years (legal requirement)
- Session tokens: 24 hours (already enforced)

**Probe test**: Auditor will ask: what happens to data older than your retention period? The answer must include a running cron, a log of its execution, and a sample of records that were purged.

---

#### 2.7 Implement Password Complexity and History

**File**: `app/api/auth/reset-password/route.ts` and new `lib/auth/password-policy.ts`

```typescript
export const passwordPolicySchema = z.string()
  .min(12, 'Minimum 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');
```

Add `PasswordHistory` model to schema:
```prisma
model PasswordHistory {
  id         String   @id @default(cuid())
  userId     String
  hash       String
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  @@index([userId])
}
```

Check last 5 password hashes on reset; reject reuse.

**Probe test**: Attempt to reset password to previous password. Must be rejected with a specific error.

---

#### 2.8 Add CORS Policy

**File**: `next.config.ts` — add explicit CORS headers to API routes:

```typescript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL ?? '' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
    },
  ];
}
```

**Probe test**: OPTIONS request to `/api/admin/workshops` from a foreign origin must be rejected.

---

#### 2.9 Add Rate Limiting to All Admin Routes

Create `lib/middleware/with-rate-limit.ts`:

```typescript
export function withAdminRateLimit(handler: NextRouteHandler): NextRouteHandler {
  return async (request, context) => {
    const limiter = await adminLimiter(request);
    if (!limiter.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    return handler(request, context);
  };
}
```

Apply to all admin routes via a wrapper or middleware.

**Probe test**: 100 rapid requests to any admin endpoint from the same IP must result in 429 responses after the limit is hit.

---

#### 2.10 Add SAST and Dependency Scanning to CI

**File**: `.github/workflows/security.yml` (new)

```yaml
name: Security Scanning
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: yarn install --frozen-lockfile
      - run: yarn audit --level high
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with: { languages: javascript }
      - name: Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/javascript
            p/typescript
            p/nextjs
            p/jwt
            p/secrets
```

Also enable Dependabot: create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 10
```

**Probe test**: Auditor will ask for the last CI run showing security scan results and the process for addressing findings.

---

### PHASE 3 — GDPR COMPLIANCE PACK (Weeks 4–8)

#### 3.1 Complete the Privacy Notice

**File**: `app/privacy/page.tsx`

Replace all `[PLACEHOLDER]` fields with actual values. The privacy notice must include per GDPR Art.13/14:

- Identity and contact details of the controller (RAISE)
- DPO contact details (or reason for exemption)
- Purposes and legal basis for each processing activity
- Legitimate interests (if relied upon) — explicitly listed
- Recipients / categories of recipients
- International transfers and safeguards (SCCs for OpenAI US)
- Retention periods — specific durations, not placeholders
- All eight data subject rights with how to exercise them
- Right to withdraw consent
- Right to lodge a complaint (ICO for UK, SA for EU)
- Whether provision of data is statutory/contractual

**Probe test**: Auditor will compare the privacy notice against Art.13 requirements line by line. Every field must be populated. Placeholders = immediate GDPR failure.

---

#### 3.2 Records of Processing Activities (ROPA)

Create `docs/compliance/ropa.md` — required under GDPR Art.30 for controllers.

```
| Processing Activity | Purpose | Legal Basis | Data Subjects | Data Categories | Recipients | Retention | Transfer? | Safeguard |
|---|---|---|---|---|---|---|---|---|
| Workshop participant discovery sessions | Service delivery | Contract (Art.6.1.b) | Employees of client org | Name, email, role, spoken/written responses | Client org admin, RAISE support | 2 years | No | — |
| Platform admin authentication | Security / access control | Legitimate interest (Art.6.1.f) | Platform users | Email, hashed password, IP, session tokens | None | Session: 24h; Login attempts: 90d | No | — |
| OpenAI transcript processing | Service delivery | Contract (Art.6.1.b) | Participants | Transcript text (may contain PII) | OpenAI (processor) | Processing only; not retained by OpenAI | Yes (US) | SCC |
| Audit logging | Legal obligation + legitimate interest | Art.6.1.c + 6.1.f | All users | Email, IP, action, timestamp | None | 7 years | No | — |
| Email notifications (password reset, etc.) | Service delivery | Contract (Art.6.1.b) | Users | Email address | Email provider (processor) | Not retained | Possibly | DPA |
```

**Probe test**: Auditor will ask for the ROPA. It must exist as a maintained document with a review date.

---

#### 3.3 Data Processing Agreements (DPAs)

For each sub-processor, obtain or sign a DPA. Minimum required:

| Sub-processor | Role | DPA status | Transfer mechanism |
|---|---|---|---|
| Supabase | Database processor | ✅ Available at supabase.com/dpa — sign and retain | EU hosting available — verify region |
| Vercel | Hosting processor | ✅ Available at vercel.com/legal/dpa — sign and retain | EU region — verify |
| OpenAI | AI processor | ✅ Enterprise API DPA available — must be signed | SCC required (US transfer) |
| Railway | CaptureAPI hosting | Check if DPA available; if not, cannot be used for EU data | Assess |
| GitHub | Code hosting | ✅ Microsoft DPA covers GitHub | EU region available |
| Email provider | Notification | Obtain DPA | Assess |

Store signed DPAs in `docs/compliance/dpas/[vendor]-dpa-signed.pdf`.

**Probe test**: Auditor will ask: "Who are your sub-processors and do you have signed DPAs?" Must produce signed documents.

---

#### 3.4 DPIA

Create `docs/compliance/dpia.md`. A DPIA is mandatory under GDPR Art.35 for:
- Systematic processing of sensitive data at scale
- AI-assisted processing of personal data (this platform qualifies)

DPIA must cover:
1. Description of the processing (what, why, how, who)
2. Necessity and proportionality assessment
3. Risks to rights and freedoms (with likelihood and severity ratings)
4. Measures to address risks
5. Residual risk assessment
6. Consultation with DPO (if applicable)
7. Sign-off by the controller (RAISE)

Minimum risks to assess in the DPIA:
- AI processing of employee speech/text data
- Multi-tenant architecture and cross-tenant data leak risk
- International transfer of transcript data to OpenAI
- Re-identification risk from anonymised workshop data

**Probe test**: Auditor will ask whether a DPIA was conducted. Multiple internal documents explicitly say it is not completed — this must be closed before any GDPR compliance claim.

---

#### 3.5 Subprocessor Notice

Add to the privacy policy a maintained list of sub-processors with:
- Name
- Country
- Purpose
- Link to their privacy/security page

Update this list whenever a new sub-processor is added. Changes require 30 days advance notice to clients (or as specified in client contracts).

---

#### 3.6 Consent Enforcement in Participant Flow

Enforce the following sequence before any participant data is processed:

1. Display the full consent notice (from `lib/consent/consent-manager.ts` — fill in placeholders first)
2. Require explicit affirmative action (checkbox, not pre-ticked)
3. Write `ConsentRecord` to DB (Phase 2.2 above)
4. Only then allow the discovery session to begin

Withdrawal: provide a one-click withdrawal link in the participant journey. On withdrawal, create a `withdrawnAt` timestamp on the `ConsentRecord` and cease processing.

**Probe test**: Auditor will walk through the participant journey. If they can reach the discovery session without seeing and accepting a consent notice, this is an immediate GDPR Art.7 failure.

---

### PHASE 4 — OPERATIONAL EVIDENCE (Weeks 6–12)

This phase creates the operating evidence that distinguishes a compliance programme from compliance theatre.

#### 4.1 Access Review Process

Run the first access review now, then quarterly.

**File**: Create `docs/compliance/access-reviews/YYYY-QN-access-review.md`

Template:
```
Date: YYYY-MM-DD
Reviewer: [Name, Title]
Scope: All PLATFORM_ADMIN and TENANT_ADMIN accounts

| User | Role | Last login | MFA enabled | Access justified | Action |
|---|---|---|---|---|---|
| user@domain.com | PLATFORM_ADMIN | 2026-04-01 | Yes | Yes — active dev | Retain |
| old-user@domain.com | TENANT_ADMIN | 2025-10-01 | No | No — departed | Revoke |
```

Wire `lib/compliance/access-review.ts` to actually run and produce this output. Store results in the repo.

**Probe test**: Auditor will ask: "When did you last review who has access to the platform? Show me the record." Must produce a dated, signed document.

---

#### 4.2 Penetration Test / Tenant Isolation Test

Commission or conduct a tenant isolation test. Minimum scope:

1. Authenticate as Tenant A admin
2. Attempt to access Tenant B's workshops via direct ID manipulation
3. Attempt to access Tenant B's participants
4. Attempt to enumerate other tenants via API
5. Attempt privilege escalation from TENANT_USER to TENANT_ADMIN
6. Attempt to access PLATFORM_ADMIN routes as TENANT_ADMIN

Document results in `docs/compliance/pentest/tenant-isolation-YYYY-MM.md`.

**Probe test**: Auditor will ask: "How do you know tenants cannot access each other's data?" The answer must be a test report, not "because the code checks the org ID."

---

#### 4.3 Backup Verification Evidence

Create a monthly restore test record in `docs/compliance/backup-tests/YYYY-MM-restore-test.md`:

```
Date: YYYY-MM-DD
Performed by: [Name]
Backup source: Supabase daily backup, date YYYY-MM-DD
Restore target: Staging environment
Tables verified: workshops (N rows), participants (N rows), sessions (N rows)
Data integrity check: SELECT COUNT(*) matches source
Time to restore: X minutes
Result: PASS / FAIL
Notes:
```

**Probe test**: Auditor will ask: "When did you last test restoring from backup? Show me the record." Without this, BCDR claims cannot be made.

---

#### 4.4 Incident Response Drill

Conduct and document a tabletop exercise. Minimum scenario: "A bug is found that may have exposed Workshop A's transcript data to users of a different tenant."

Document in `docs/compliance/ir-drills/YYYY-MM-tabletop.md`:
- Scenario
- Participants
- Timeline walkthrough
- GDPR 72-hour notification assessment
- Actions identified
- Lessons learned

**Probe test**: Auditor will ask: "Has your incident response plan been tested? Show me the record."

---

#### 4.5 Monitoring Dashboard and Alert Evidence

Connect audit events to an alerting system. Minimum:

1. Forward audit logs to a SIEM or log aggregator (Datadog, Grafana Cloud, Axiom, or similar)
2. Configure alerts for:
   - 5+ failed logins from same IP in 5 minutes
   - PLATFORM_ADMIN login from new IP
   - Bulk data export (>50 participants)
   - Any DELETE on workshop data
   - Audit log access
3. Review alerts weekly. Record reviews in `docs/compliance/monitoring/alert-reviews/YYYY-WNN.md`

**Probe test**: Auditor will ask: "Show me the last 30 days of security alerts and your response to each." Without this, SOC 2 CC7 cannot pass.

---

#### 4.6 Vulnerability Remediation Evidence

After enabling Dependabot and CodeQL (Phase 2.10):

1. Triage all open vulnerability findings
2. Record in `docs/compliance/vulnerability-log.md`
3. Assign CVSS score and remediation SLA per the vulnerability management policy
4. Close or accept-with-justification each finding

| CVE | Package | CVSS | SLA | Status | Closed date | Notes |
|---|---|---|---|---|---|---|
| CVE-XXXX-XXXX | xlsx 0.18.5 | 7.5 HIGH | 7 days | Open | — | Replace with exceljs |

**Probe test**: Auditor will run `npm audit` during the audit. Every HIGH and CRITICAL vulnerability must have a documented remediation or accepted risk with justification.

---

### PHASE 5 — AUDIT READINESS (Weeks 10–16)

#### 5.1 Evidence Pack Assembly

Collect all evidence into `docs/compliance/evidence-pack/`:

```
evidence-pack/
  policies/                    ← All 10 policy documents, dated and signed
  soa.md                       ← Statement of Applicability
  risk-register.md             ← Current, reviewed
  asset-inventory.md           ← Current
  ropa.md                      ← Records of Processing Activities
  dpia.md                      ← Completed and signed
  dpas/                        ← Signed DPA PDFs for all sub-processors
  privacy-notice-v[N].md       ← Versioned privacy notices
  access-reviews/              ← Last 4 quarters
  backup-tests/                ← Last 6 months
  pentest/                     ← Tenant isolation test report
  ir-drills/                   ← Tabletop exercise records
  vulnerability-log.md         ← All findings and dispositions
  monitoring/alert-reviews/    ← Last 30 days
  ci-security-scans/           ← Last 5 CI run outputs
  consent-records/             ← Sample (anonymised) ConsentRecord exports
```

#### 5.2 Pre-Audit Internal Review

Run through this checklist 4 weeks before any external audit engagement:

- [ ] All Phase 0 fixes deployed and verified in production
- [ ] MFA enforced for all admin accounts in production
- [ ] Encryption at rest verified via raw DB record inspection
- [ ] ConsentRecord populated for all recent participants
- [ ] Privacy notice live with no placeholders
- [ ] ROPA completed and reviewed
- [ ] DPIA completed and signed
- [ ] All DPAs signed and filed
- [ ] Risk register reviewed within 90 days
- [ ] Access review completed within 90 days
- [ ] Restore test completed within 30 days
- [ ] IR drill completed within 6 months
- [ ] Vulnerability log has no open CRITICAL or HIGH findings older than SLA
- [ ] SAST passing in CI on all recent PRs
- [ ] Security headers verified via securityheaders.com (score A or above)
- [ ] `npm audit` returns zero HIGH/CRITICAL

---

## QUICK-REFERENCE: PROBE QUESTIONS AND ANSWERS

This table summarises what an auditor will ask and what evidence you must produce.

| Probe question | Evidence required |
|---|---|
| "Show me your security policy." | `docs/policies/information-security-policy.md` — dated, versioned, signed |
| "Show me your risk register." | `docs/compliance/risk-register.md` — reviewed within 90 days |
| "Who has admin access to the platform?" | Last access review doc — within 90 days |
| "How do you know tenants can't see each other's data?" | Tenant isolation test report |
| "Is data encrypted in the database?" | Raw DB record screenshot showing ciphertext |
| "Show me a consent record." | ConsentRecord in DB for a recent participant |
| "What is your privacy notice?" | `app/privacy/page.tsx` — no placeholders |
| "Who are your sub-processors?" | `docs/compliance/dpas/` with signed DPAs |
| "Has your incident plan been tested?" | IR drill tabletop record |
| "When did you last restore from backup?" | `docs/compliance/backup-tests/` — within 30 days |
| "Show me your DPIA." | `docs/compliance/dpia.md` — completed and signed |
| "Show me security scan results from CI." | GitHub Actions run with CodeQL/Semgrep output |
| "How do you handle a data breach?" | IR policy + 72h GDPR notification workflow |
| "Show me your audit log for user X." | Audit log query returning events — prove it cannot be deleted |
| "What is your data retention period?" | Privacy notice + cron execution log |
| "What happens when MFA is bypassed?" | Middleware test + production attempt returning 403 |

---

## REVISED READINESS TARGETS

After all phases complete:

| Framework | Current | Target (Phase 2) | Target (Full) |
|---|---|---|---|
| ISO 27001 | 38% | 65% | 85%+ |
| SOC 2 Type II | 42% | 70% | 85%+ |
| GDPR | 55% | 75% | 90%+ |

Note: ISO 27001 certification and SOC 2 Type II report require a minimum 6-month observation period for operating evidence. The fastest path to a Type II report is to start the evidence clock immediately — every access review, alert review, and backup test run from today counts toward the observation period.

---

## OWNER ASSIGNMENTS (fill before Phase 0)

| Role | Responsibilities |
|---|---|
| Security Lead / CISO | Policy ownership, risk register, SoA, access reviews |
| DPO (or nominated owner) | ROPA, DPIA, DPAs, consent, data subject rights |
| CTO | Technical remediation (Phases 0–2), encryption, MFA, SAST |
| Engineering Lead | Input validation, rate limiting, CI security pipeline |
| External counsel | DPA review, SCC assessment, DPIA sign-off advice |

---

*Document version: 1.0 | Created: 2026-04-17 | Review due: 2026-07-17*
*This document is CONFIDENTIAL — Restricted. Do not share outside the organisation.*
