# Data Classification and Asset Inventory

| Field | Value |
|---|---|
| **Status** | Active |
| **Version** | 1.0 |
| **Effective Date** | 2026-04-17 |
| **Organisation** | RAISE |
| **Platform** | DREAM Discovery |
| **Owner** | Engineering Lead |
| **Approved By** | CISO |
| **Next Review** | 2027-04-17 |

---

## Classification Scheme

| Classification | Definition | Examples |
|---|---|---|
| **Public** | Information approved for unrestricted public disclosure | Marketing materials, public documentation, published privacy notice |
| **Internal** | Information for RAISE staff and contractors only; not for external parties | Internal runbooks, deployment procedures, CLAUDE.md, this document |
| **Confidential** | Tenant and participant data; commercially sensitive information; must not leave the RAISE/tenant boundary without explicit authorisation | Workshop outputs, participant responses, synthesis reports, tenant configuration |
| **Restricted** | Highest sensitivity; access strictly limited to named individuals; exposure would cause severe harm | Cryptographic keys, service role credentials, PLATFORM_ADMIN credentials, production database connection strings |

---

## 1. Information Assets

| Asset Name | Classification | Storage Location | Owner | Retention Period | Encryption Required |
|---|---|---|---|---|---|
| Participant PII (name, email, role, organisation) | Confidential | Supabase PostgreSQL (`participants` table, `users` table) | Engineering Lead | 36 months post-contract | Yes -- AES-256 at rest (Supabase managed) |
| Workshop data (questions, responses, node graph) | Confidential | Supabase PostgreSQL (`workshops`, `hemisphere_data`, related tables) | Engineering Lead | 36 months post-contract | Yes -- AES-256 at rest |
| AI synthesis outputs (scratchpad JSONB, evidence synthesis, behavioural interventions) | Confidential | Supabase PostgreSQL (`workshop_scratchpads.v2_output`, `workshops.evidence_synthesis`, `workshops.behavioural_interventions`) | Engineering Lead | 36 months post-contract | Yes -- AES-256 at rest |
| Voice recordings (raw audio from CaptureAPI) | Confidential | Supabase Storage (temporary) / Railway ephemeral storage | Engineering Lead | Maximum 7 days; auto-deleted by retention cron | Yes -- TLS in transit; AES-256 at rest |
| Transcript chunks and timecodes | Confidential | Supabase PostgreSQL (`transcript_chunks` table) | Engineering Lead | 36 months post-contract | Yes -- AES-256 at rest |
| Evidence document uploads | Confidential | Supabase Storage (`evidence_documents` bucket) | Engineering Lead | 36 months post-contract | Yes -- AES-256 at rest |
| Audit logs (admin actions, authentication events, cron execution) | Internal | Supabase PostgreSQL (`analytics_events` table, Supabase Auth logs) | CISO | 2 years | Yes -- AES-256 at rest |
| Analytics events (platform telemetry) | Internal | Supabase PostgreSQL (`analytics_events` table) | Engineering Lead | 2 years | Yes -- AES-256 at rest |
| Session tokens | Restricted | Supabase Auth / Upstash Redis | Engineering Lead | Duration of session; max 24 hours | Yes -- TLS in transit; encrypted at rest by provider |
| Password hashes | Restricted | Supabase Auth (managed) | Engineering Lead | Duration of account; deleted within 30 days of account termination | Yes -- bcrypt (managed by Supabase Auth) |
| Password reset tokens | Restricted | Supabase Auth | Engineering Lead | 7 days or first use | Yes -- hashed at rest |
| Production environment variables (API keys, secrets) | Restricted | Vercel Secret Store / Railway Secret Store | Engineering Lead | Rotate annually; immediate rotation on compromise | Yes -- encrypted at rest by provider |
| Supabase service role key | Restricted | Vercel production environment variables (server-side only) | Engineering Lead | Rotate annually | Yes -- encrypted at rest; never exposed to client |
| OpenAI API key | Restricted | Vercel production environment variables (server-side only) | Engineering Lead | Rotate annually | Yes -- encrypted at rest |
| JWT signing secret (Supabase Auth) | Restricted | Managed by Supabase; referenced in Vercel environment variables | Engineering Lead | Rotate on compromise; Supabase managed | Yes -- Supabase managed |
| CRON_SECRET (retention cron authentication) | Restricted | Vercel environment variables | Engineering Lead | Rotate annually | Yes -- encrypted at rest |
| Tenant organisation data (name, configuration, subscription status) | Confidential | Supabase PostgreSQL (`organizations` table) | Engineering Lead | Duration of subscription plus 36 months | Yes -- AES-256 at rest |
| GDPR Subject Access Request records | Internal | CISO-maintained tracker (out of platform) | CISO | 3 years from completion | Yes -- encrypted at rest |
| Source code | Internal | GitHub repository (`Andrewghall/Dream_discovery`) | Engineering Lead | Indefinite (version controlled) | Yes -- HTTPS access; GitHub encryption at rest |
| Platform documentation and policies | Internal | GitHub repository (`docs/` directory) | CISO | Indefinite (version controlled) | Yes -- GitHub encryption at rest |
| Public privacy notice and terms of service | Public | DREAM Discovery platform (publicly accessible) | CISO | Current version maintained; previous versions archived | No (public) |

---

## 2. Software Assets

| System | Version / Type | Vendor | Data It Processes | Last Security Review |
|---|---|---|---|---|
| Next.js (application framework) | 15.x (App Router) | Vercel / open source | All application data including PII, session tokens, API keys | 2026-04-17 (Dependabot weekly; CodeQL every PR) |
| Supabase (PostgreSQL + Auth + Storage + Realtime) | Managed service (PostgreSQL 15+) | Supabase Inc. | All platform data: PII, workshop content, audit logs, session tokens, file uploads | 2026-04-17 (provider SOC 2 Type II; RAISE RLS review each migration) |
| Prisma ORM | 5.x | Prisma Data Inc. / open source | All database queries involving tenant and participant data | 2026-04-17 (Dependabot; CodeQL) |
| Upstash Redis | Managed serverless Redis | Upstash Inc. | Session state, rate-limiting counters (pseudonymised IP hashes) | 2026-04-17 (provider review; no PII stored directly) |
| Vercel (hosting, edge functions, CDN) | Managed platform | Vercel Inc. | Application code, edge function execution, environment variables (secrets) | 2026-04-17 (provider SOC 2 Type II; RAISE env var audit) |
| Railway (container hosting for CaptureAPI) | Managed container platform | Railway Corp. | Voice recording ingestion, transcription intermediary processing | 2026-04-17 (provider review; 7-day voice retention enforced) |
| GitHub (source code, CI/CD) | Cloud-hosted (github.com) | GitHub Inc. (Microsoft) | Source code, CI/CD pipeline secrets, pull request history | 2026-04-17 (GitHub secret scanning enabled; Dependabot; CodeQL) |
| GitHub Actions (CI/CD pipeline) | Cloud-hosted runners | GitHub Inc. (Microsoft) | Build artefacts, test results, npm dependencies during build | 2026-04-17 (workflow pinning; no production secrets in CI) |
| OpenAI GPT-4o API | API (gpt-4o model) | OpenAI LLC | Workshop prompt data (role descriptions, synthesised signals -- no direct PII in prompts) | 2026-04-17 (DPA signed; zero-training-use confirmed under API terms) |
| Resend (transactional email) | Managed email API | Resend Inc. | Participant email addresses (for invite and notification emails) | 2026-04-17 (DPA under review; TLS in transit) |
| Zod (input validation) | 3.x | open source | Validates and sanitises all inbound API request payloads | 2026-04-17 (Dependabot; CodeQL coverage) |
| TypeScript | 5.7+ | Microsoft / open source | Static analysis of all platform TypeScript source | 2026-04-17 (strict mode enforced in CI) |
| ESLint (linting) | 9.x | open source | Static code quality analysis | 2026-04-17 (zero-error gate in CI) |
| CodeQL (SAST) | GitHub-managed | GitHub Inc. (Microsoft) | Static analysis of TypeScript source for security vulnerabilities | 2026-04-17 (security-extended queries; runs every PR) |
| Dependabot (dependency scanning) | GitHub-managed | GitHub Inc. (Microsoft) | npm dependency vulnerability scanning | 2026-04-17 (weekly scans; automated PR generation) |

---

## 3. Sub-Processor Register (GDPR Article 28)

| Processor Name | Purpose | Data Transferred | Legal Basis | DPA Status | DPA / Privacy Link | Data Location |
|---|---|---|---|---|---|---|
| Supabase Inc. | Primary database, authentication, file storage, and realtime infrastructure | All personal data: participant PII, workshop content, session tokens, audit logs, voice recordings, evidence documents | Article 6(1)(b) contract performance; Article 6(1)(f) legitimate interests | Signed | https://supabase.com/privacy | EU (AWS eu-west-2 for RAISE deployment) |
| Vercel Inc. | Application hosting, edge function execution, CDN, log drain, deployment pipeline | Application request data including session tokens and IP addresses (edge functions); environment variables (secrets) | Article 6(1)(b) contract performance | Signed | https://vercel.com/legal/privacy-policy | Global CDN (data residency configured for EU primary) |
| Railway Corp. | Container hosting for CaptureAPI transcription service | Voice recording audio data during ingestion; transcription processing intermediary | Article 6(1)(b) contract performance | Signed | https://railway.app/legal/privacy | EU region (configurable) |
| OpenAI LLC | AI synthesis of workshop outputs via GPT-4o API | Workshop signal data and role descriptions submitted in prompts (designed to exclude direct PII) | Article 6(1)(b) contract performance; Article 6(1)(f) legitimate interests | Signed | https://openai.com/policies/privacy-policy | US (Standard Contractual Clauses applied for UK/EU transfer) |
| GitHub Inc. (Microsoft) | Source code version control, CI/CD pipeline, secret scanning, Dependabot, CodeQL | Source code, CI logs, build artefacts, encrypted repository secrets | Article 6(1)(f) legitimate interests (software development) | Signed (Microsoft DPA via GitHub Enterprise) | https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement | US (SCCs applied; data residency limited to code and CI artefacts -- no production personal data) |
| Resend Inc. | Transactional email delivery (workshop invitations, password resets, notifications) | Participant and user email addresses; email content (invitation text) | Article 6(1)(b) contract performance | Required -- in progress | https://resend.com/privacy | US (SCCs required; DPA to be signed before production use with EU data subjects) |
| Upstash Inc. | Serverless Redis for rate limiting and session state | Pseudonymised rate-limiting keys (hashed IP/user identifier); no direct PII stored in Redis | Article 6(1)(f) legitimate interests (platform security) | Signed | https://upstash.com/trust/privacy.pdf | EU region (configurable) |

**Note on Resend:** DPA is currently required and in progress. Resend must not be used to send emails to EU data subjects until the DPA is signed and SCCs are in place. This is tracked as a compliance action item with a target completion date of 2026-05-17.

---

## 4. Cryptographic Assets

| Key Name | Algorithm | Key Length | Purpose | Rotation Period | Storage Location | Custodian |
|---|---|---|---|---|---|---|
| Supabase JWT secret | HMAC-SHA256 (HS256) | 256-bit | Signs and verifies Supabase Auth JWT tokens for user session authentication | On compromise; managed by Supabase; RAISE may trigger rotation via Supabase dashboard | Supabase managed secret store; referenced as `SUPABASE_JWT_SECRET` in Vercel environment | Engineering Lead |
| Supabase service role key | API bearer token (JWT signed by Supabase) | 256-bit effective | Provides server-side administrative access to Supabase bypassing RLS; used only in server-side Next.js API routes | Annually; immediately on suspected compromise | Vercel production environment variables (server-side only; `SUPABASE_SERVICE_ROLE_KEY`) | Engineering Lead |
| Supabase anon key | API bearer token (JWT signed by Supabase) | 256-bit effective | Provides client-side read access subject to RLS policies | Annually; rotation requires client-side redeploy | Vercel environment variables (safe for client-side exposure; `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Engineering Lead |
| OpenAI API key | HMAC-based API bearer token | 256-bit effective | Authenticates requests to the OpenAI GPT-4o API for workshop synthesis | Annually; immediately on suspected compromise | Vercel production environment variables (server-side only; `OPENAI_API_KEY`) | Engineering Lead |
| Vercel deployment token | API bearer token | 256-bit effective | Authenticates GitHub Actions deployment pipeline to Vercel | Annually; immediately on team member departure | GitHub Actions repository secrets | Engineering Lead |
| CRON_SECRET | Random hex string (HMAC-verified) | 256-bit effective | Authenticates inbound Vercel Cron calls to `/api/cron/retention` to prevent unauthorised invocation | Annually | Vercel production environment variables (server-side only; `CRON_SECRET`) | Engineering Lead |
| Railway deployment token | API bearer token | 256-bit effective | Authenticates CI/CD deployments to Railway for the CaptureAPI service | Annually; immediately on team member departure | GitHub Actions repository secrets | Engineering Lead |
| TLS certificates (Vercel-managed) | RSA-2048 / ECDSA P-256 | 2048-bit / 256-bit | Encrypts all HTTPS traffic to the DREAM Discovery platform | Auto-renewed by Vercel via Let's Encrypt (90-day certificates; automated renewal) | Vercel managed; no RAISE-held private key | Vercel (RAISE monitors expiry) |
| TLS certificates (Supabase-managed) | RSA-2048 / ECDSA P-256 | 2048-bit / 256-bit | Encrypts all connections to the Supabase PostgreSQL database and API | Auto-renewed by Supabase | Supabase managed | Supabase (RAISE monitors via Supabase dashboard) |
| Database encryption key (Supabase at-rest) | AES-256 | 256-bit | Encrypts all data stored in the Supabase PostgreSQL database and Storage at rest | Managed by Supabase / AWS KMS; not directly accessible by RAISE | AWS KMS (managed by Supabase) | Supabase |
| Upstash Redis access token | API bearer token | 256-bit effective | Authenticates Next.js API routes to the Upstash Redis rate-limiting instance | Annually | Vercel production environment variables (server-side only; `UPSTASH_REDIS_REST_TOKEN`) | Engineering Lead |

---

## Version History

| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 1.0 | 2026-04-17 | Engineering Lead | Initial release |
