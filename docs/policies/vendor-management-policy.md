# Vendor Management Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy governs the selection, onboarding, ongoing management, and offboarding of vendors and sub-processors used in the operation of DREAM Discovery. RAISE relies on a small number of critical infrastructure and AI vendors. Each vendor that processes personal data on behalf of RAISE is a GDPR data processor or sub-processor. Inadequate vendor security poses direct risk to participant data, tenant confidence, and RAISE's regulatory standing. This policy ensures that all vendors meet RAISE's security and privacy standards before and throughout the relationship.

---

## 2. Scope

This policy applies to all vendors, sub-processors, and third-party service providers that:

- Process personal data on behalf of RAISE (GDPR processors and sub-processors).
- Provide infrastructure or platform services on which DREAM Discovery operates.
- Provide software components, libraries, or APIs integrated into DREAM Discovery.

Current critical vendors in scope: Vercel (hosting and edge network), Supabase (PostgreSQL database, authentication, storage), Railway (CaptureAPI voice ingestion service), OpenAI (AI synthesis, facilitation, and output intelligence generation), GitHub (source code repository).

---

## 3. Vendor Classification

| Tier | Description | Examples |
|---|---|---|
| Tier 1 -- Critical | Sub-processors or infrastructure providers who directly process Restricted or Confidential personal data; whose unavailability would cause complete service outage | Vercel, Supabase, Railway, OpenAI |
| Tier 2 -- Important | Providers of development tooling, CI/CD, or security scanning; access to source code but not production personal data | GitHub, Dependabot, code quality tools |
| Tier 3 -- Standard | Low-risk SaaS tools used for internal operations with no access to DREAM Discovery personal data | Office productivity tools, internal communication platforms |

---

## 4. Policy Statement

### 4.1 Vendor Selection

4.1.1 Before engaging any new Tier 1 or Tier 2 vendor, the Engineering Lead must conduct a vendor security assessment covering: security certifications held (SOC 2, ISO 27001), data residency and transfer mechanisms, breach notification commitments, DPA availability and terms, right to audit or review of sub-processors, and history of security incidents.

4.1.2 For Tier 1 vendors, the assessment must be completed and approved by the CISO before any personal data is transmitted to the new vendor.

4.1.3 The use of a new Tier 1 vendor must be approved by the CISO in writing before integration development begins, as it constitutes a Major Change under the Change Management Policy.

4.1.4 RAISE must perform due diligence on any vendor's data processing infrastructure being located outside the UK or EEA, and must implement appropriate transfer mechanisms (Standard Contractual Clauses or equivalent) where required.

### 4.2 Data Processing Agreements

4.2.1 A signed Data Processing Agreement (DPA) must be in place with every Tier 1 vendor before any personal data is processed. The DPA must cover: subject matter and duration of processing, nature and purpose of processing, type of personal data and categories of data subjects, obligations and rights of the data controller (RAISE), security measures required, sub-processor restrictions, and breach notification timelines.

4.2.2 Current DPA status for active Tier 1 vendors must be maintained in the vendor register (Section 4.8).

4.2.3 OpenAI DPA terms must specifically address: whether data is used for model training (RAISE must opt out), data retention by OpenAI, and the categories of data RAISE is permitted to transmit (voice recording content must not be sent directly; only transcribed text and with PII minimised where possible).

4.2.4 DPAs must be reviewed annually or when the vendor updates their standard terms.

### 4.3 Ongoing Vendor Monitoring

4.3.1 Tier 1 vendors must be reviewed annually. The review must include:
- Obtaining the vendor's latest SOC 2 Type II report or ISO 27001 certificate.
- Reviewing any reported security incidents during the year.
- Confirming that DPA terms remain current and appropriate.
- Confirming that data residency commitments have not changed.
- Reviewing the vendor's sub-processor list for any changes.

4.3.2 The Engineering Lead must subscribe to security advisories and status pages for all Tier 1 vendors. Vendor incidents that affect the availability or security of DREAM Discovery must be assessed under the Incident Response Policy.

4.3.3 If a Tier 1 vendor experiences a confirmed security breach that affects RAISE's data, RAISE must treat this as a potential personal data breach under the Incident Response Policy and assess GDPR notification obligations within 72 hours of becoming aware.

### 4.4 Specific Vendor Controls

#### 4.4.1 Vercel

- Vercel Edge Network provides HTTPS enforcement, DDoS protection, and global CDN for DREAM Discovery.
- Vercel environment variables must be used for all secrets. RAISE must audit the list of environment variables in the Vercel dashboard at least quarterly to ensure no orphaned or stale secrets remain.
- Vercel deployment logs may contain request metadata but must not contain personal data or credentials. Application code must not log sensitive data to Vercel function logs.
- Vercel team membership must be reviewed quarterly in line with the Access Control Policy.

#### 4.4.2 Supabase

- Supabase hosts the production PostgreSQL database containing the majority of DREAM Discovery personal data.
- Supabase RLS policies are a critical security control. Changes to RLS policies require code review and follow the Change Management Policy.
- Supabase `service_role` key access must be restricted to server-side Vercel environment variables only. The service role key must never appear in client-side code.
- Supabase Auth handles all user authentication. RAISE must review Supabase Auth configuration (password policy, MFA enforcement, JWT expiry) at least annually.
- Supabase database backups must be verified monthly per the Backup and Recovery Policy.
- Supabase is used for two separate projects (production and pre-live). Access management and security configuration must be maintained on both projects.

#### 4.4.3 Railway

- Railway hosts the CaptureAPI service responsible for receiving and initially processing voice recordings.
- Voice recordings are Restricted data. Railway must not retain voice recordings beyond the minimum period required for transcript generation (maximum 7 days per the Data Retention and Deletion Policy).
- Railway service environment variables containing API tokens and connection strings must be reviewed at least quarterly.
- Railway service access must be limited to named RAISE engineers per the Access Control Policy.

#### 4.4.4 OpenAI

- OpenAI processes workshop data (transcript text, facilitation questions, synthesis prompts) to generate AI outputs.
- RAISE must use OpenAI's zero data retention (ZDR) configuration where available, to ensure that data submitted via the API is not retained by OpenAI for model training or stored beyond the API call lifecycle.
- The OpenAI API key used by DREAM Discovery must be a project-scoped key with the minimum permissions required. It must be rotated at least every 90 days.
- Changes to AI model selection (e.g., moving from GPT-4o to a newer model) must follow the Normal Change process including a review of any changes in OpenAI's data processing terms for the new model.
- Prompt templates that transmit participant data must be reviewed by the Engineering Lead before deployment to ensure PII inclusion is limited to what is strictly necessary for the synthesis function.

#### 4.4.5 GitHub

- GitHub stores the DREAM Discovery source code. Source code may contain architectural information that could assist an attacker.
- The repository must remain private. Repository visibility settings must be audited quarterly.
- Branch protection rules must be enforced on `main` and `pre-live` branches (require pull request reviews, no force push, no deletion).
- GitHub Actions workflows (if used) must be reviewed for secrets exposure and supply chain risk.

### 4.5 Vendor Offboarding

4.5.1 When a vendor relationship is terminated, RAISE must:
- Revoke all credentials and access tokens associated with the vendor.
- Obtain written confirmation from the vendor of data deletion per DPA obligations.
- Remove any integration code or references to the vendor from the DREAM Discovery codebase.
- Update the vendor register to reflect the terminated relationship.

4.5.2 If a critical Tier 1 vendor is being replaced, a migration plan must be developed and approved before offboarding begins, to ensure service continuity and data migration integrity.

### 4.6 Vendor Incident Notification

4.6.1 All Tier 1 vendors must contractually commit to notifying RAISE of any security incident affecting RAISE's data within 24 hours of the vendor becoming aware.

4.6.2 RAISE must provide Tier 1 vendors with a security notification contact (the Engineering Lead email address) and must ensure this contact is kept current.

### 4.7 Prohibited Vendors

4.7.1 Vendors that are subject to sanctions by the UK Government, EU, or US Treasury (OFAC) must not be engaged.

4.7.2 Vendors that do not offer a DPA for personal data processing must not be used for any processing involving personal data, regardless of tier classification.

### 4.8 Vendor Register

| Vendor | Tier | Data Processed | DPA in Place | Last Review | Certifications | Notes |
|---|---|---|---|---|---|---|
| Vercel | 1 | Request metadata, application logs | Yes (Vercel DPA) | 2026-04-17 | SOC 2 Type II | Edge network + deployment |
| Supabase | 1 | All personal data (PII, transcripts, AI outputs) | Yes (Supabase DPA) | 2026-04-17 | SOC 2 Type II | Production + pre-live separate projects |
| Railway | 1 | Voice recordings (transient), CaptureAPI processing | Required -- confirm | 2026-04-17 | Review required | Max 7-day retention for recordings |
| OpenAI | 1 | Transcript text, synthesis prompts, AI context | Required -- confirm ZDR | 2026-04-17 | Various | ZDR must be confirmed active |
| GitHub | 2 | Source code only | GitHub MSA / DPA | 2026-04-17 | SOC 2 Type II | No personal data stored |

---

## 5. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| CISO | Approving new Tier 1 vendor engagements, reviewing annual vendor assessments, maintaining vendor register |
| Engineering Lead | Conducting vendor assessments, managing DPA execution, monitoring vendor security advisories, quarterly credential audits |
| Legal / DPO | Reviewing and approving DPA terms, advising on international data transfer mechanisms |

---

## 6. Compliance and Enforcement

Engaging a new vendor that processes personal data without a DPA in place is a GDPR violation (Article 28). Failure to conduct annual vendor reviews may result in undetected security regressions in the supply chain. All vendor management activities must be evidenced and available for audit.

---

## 7. Review Cycle

This policy must be reviewed annually, no later than 2027-04-17, or whenever a new Tier 1 vendor is added or an existing Tier 1 vendor is removed.
