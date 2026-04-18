# Access Review — Q2 2026

**Status**: Completed
**Review date**: 2026-04-17
**Next review due**: 2026-07-17
**Reviewer**: Engineering Lead
**Approver**: CISO

---

## Scope

This access review covers all personnel and service accounts with access to DREAM Discovery production systems as of 2026-04-17. It satisfies ISO 27001:2022 A.9.2.5 (Review of user access rights) and SOC 2 CC6.3 (Access removal for terminated employees).

Review cadence: Quarterly for all production access. Monthly for PLATFORM_ADMIN accounts.

---

## 1. Application User Accounts (DREAM Discovery Admin Panel)

| Name / Identifier | Role | Organisation | Last Login | Access Justified? | Action |
|---|---|---|---|---|---|
| andrew@ethenta.com | PLATFORM_ADMIN | N/A (platform) | Active | Yes — Engineering Lead, platform owner | No change |

**PLATFORM_ADMIN account count**: 1

Review notes:
- PLATFORM_ADMIN count is at minimum (1). Satisfies principle of least privilege.
- Account uses bcrypt-hashed password stored in Vercel environment variable (`ADMIN_PASSWORD`).
- DB-backed session with revocation enabled.
- MFA: enrolled via TOTP (pending activation when `MFA_REQUIRED=true` is set).
- Dormant account policy: no accounts dormant beyond 60 days.

---

## 2. Infrastructure Access

### 2.1 Supabase (Production Project)

| Name | Access Level | Justification | MFA Enabled | Action |
|---|---|---|---|---|
| Andrew Hall | Owner | Primary engineer, database administration | Required (enforce before Q3) | Enforce MFA at next login |

Access review notes:
- Service role key is stored exclusively in Vercel production environment variables.
- Anon key scope reviewed: permits read-only access to public tables only (RLS enforced).
- No stale project members identified.

### 2.2 Vercel (Production Project)

| Name | Role | Justification | MFA Enabled | Action |
|---|---|---|---|---|
| Andrew Hall | Owner | Application deployment | Enforce at next login | Enforce MFA |

Access review notes:
- No team members with unnecessary access.
- Environment variables reviewed: all secrets present, no plaintext credentials in build logs.

### 2.3 Railway (CaptureAPI)

| Name | Role | Justification | MFA Enabled | Action |
|---|---|---|---|---|
| Andrew Hall | Owner | CaptureAPI service management | Enforce at next login | Enforce MFA |

Access review notes:
- Railway service has no public port for direct DB access.
- CAPTUREAPI_URL is internal; not publicly advertised.

### 2.4 GitHub (Dream_discovery repository)

| Name | Role | Justification | Action |
|---|---|---|---|
| Andrewghall | Owner | Code maintenance, deployment | No change |

Access review notes:
- Repository is private.
- No stale collaborators or deploy keys.
- Branch protection rule: `pre-live` and `main` branches require PR review before merge.
- Dependabot enabled for weekly dependency updates.

### 2.5 OpenAI Organisation

| Name | Role | API Keys Active | Action |
|---|---|---|---|
| andrew@ethenta.com | Owner | Production key (OPENAI_API_KEY) | Verify ZDR setting active |

Access review notes:
- API key usage is server-side only (Vercel environment variable).
- Zero data retention (ZDR) status: to be confirmed this quarter.
- Key rotation last performed: not recorded — schedule rotation within 90 days.

---

## 3. Service-to-Service Credentials

| Credential | Purpose | Storage Location | Last Rotated | Next Rotation Due | Action |
|---|---|---|---|---|---|
| `OPENAI_API_KEY` | GPT-4o, Whisper, TTS | Vercel env (server-side) | Unknown | 2026-07-17 | Log rotation date, schedule |
| `DATABASE_URL` | Prisma to Supabase | Vercel env | Unknown | 2026-07-17 | Log rotation date |
| `SESSION_SECRET` | JWT signing | Vercel env | Unknown | 2026-07-17 | Log rotation date |
| `ENCRYPTION_KEY` | AES-256 data at rest | Vercel env | Unknown | 2026-07-17 | Log rotation date |
| `CRON_SECRET` | Cron job authentication | Vercel env | Unknown | 2026-07-17 | Log rotation date |
| `CAPTUREAPI_URL` | Railway service address | Vercel env | N/A (URL, not secret) | N/A | — |
| Supabase service role key | Prisma superuser DB access | Vercel env (server-side) | Unknown | 2026-07-17 | Log rotation date |

---

## 4. Privileged Access Events Since Last Review

| Date | Action | Performed By | Approval | Notes |
|---|---|---|---|---|
| 2026-04-17 | Supabase SQL: add ConsentRecord table | Andrew Hall | Self (Engineering Lead) | Part of GDPR compliance sprint |
| 2026-04-17 | Supabase SQL: add MFA fields to users table | Andrew Hall | Self (Engineering Lead) | Part of GDPR compliance sprint |
| 2026-04-17 | Vercel env: no changes | N/A | N/A | — |

---

## 5. Access Changes Since Last Review

| Change | Date | Who | Justification |
|---|---|---|---|
| No access grants or revocations this quarter | — | — | No personnel changes |

---

## 6. Open Actions

| # | Action | Owner | Due Date | Priority |
|---|---|---|---|---|
| 1 | Enforce MFA on Supabase, Vercel, Railway, GitHub for all accounts | Engineering Lead | 2026-05-17 | High |
| 2 | Document and log rotation dates for all API keys and secrets | Engineering Lead | 2026-05-17 | High |
| 3 | Confirm OpenAI Zero Data Retention (ZDR) is active on production key | Engineering Lead | 2026-05-17 | High |
| 4 | Set `MFA_REQUIRED=true` in Vercel environment after admin TOTP enrolment | Engineering Lead | 2026-06-17 | High |
| 5 | Sign DPA with Railway (currently pending) | Engineering Lead | 2026-05-17 | High |
| 6 | Sign DPA with OpenAI (confirm Enterprise agreement includes DPA) | Engineering Lead | 2026-05-17 | High |
| 7 | Rotate OPENAI_API_KEY, SESSION_SECRET, ENCRYPTION_KEY (log rotation dates) | Engineering Lead | 2026-07-17 | Medium |

---

## 7. Reviewer Sign-Off

Reviewed by: Engineering Lead
Date: 2026-04-17

All access grants have been reviewed. Access is appropriate for current business needs. Open actions have been logged and will be tracked in the risk register.

Next scheduled review: **2026-07-17** (Q3 2026)
