# Data Protection Impact Assessment (DPIA)

| Field | Value |
|---|---|
| Reference | DPIA-001 |
| Version | 1.0 |
| Date | 2026-04-17 |
| Controller | RAISE operated by Ethenta Ltd |
| Owner | Ethenta Ltd |
| Status | Approved |
| Next Review | 2027-04-17 |

---

## Overview

This DPIA has been prepared in accordance with Article 35 of the UK/EU General Data Protection Regulation (UK GDPR / GDPR) and the ICO's DPIA guidance. It covers the processing activities undertaken by the DREAM Discovery platform - a multi-tenant B2B SaaS tool that facilitates pre-workshop discovery conversations with business participants and synthesises insights using large language models.

Processing is carried out by Ethenta Ltd (trading as RAISE) acting as data controller for participant data collected on behalf of client organisations.

---

## Step 1: Description of Processing

### 1.1 System Overview

DREAM Discovery is a hosted web application (Next.js on Vercel, Supabase Postgres, Railway voice processing) that enables RAISE facilitators to conduct structured AI-facilitated discovery conversations with employees and contractors of client organisations prior to a workshop or strategy engagement. Conversation content is processed by OpenAI GPT-4o to generate synthesised insight reports for workshop facilitators.

### 1.2 Data Collected

| Category | Specific Data Elements | Source |
|---|---|---|
| Identity | Full name, work email address, job role, department | Participant web form (pre-conversation registration) |
| Conversation content | Full transcript of AI-facilitated discovery conversation | AI conversation interface |
| Technical | IP address, browser user agent, session timestamps, login timestamps | Automatic collection via platform |
| Preferences | Attribution preference (whether participant consents to being identified in outputs) | Participant web form |
| Consent evidence | Email, consent timestamp, consent text version, IP address at time of consent, user agent, purpose, collection channel | Consent capture module |

### 1.3 How Data Is Collected

1. Participants receive an invitation link from their employing organisation's administrator.
2. Participants register via a web form providing name, email, role, department, and attribution preference, and give explicit informed consent by accepting the platform's privacy notice.
3. Participants engage in a structured AI-facilitated text conversation via the platform interface.
4. Conversation transcripts are stored in Supabase and processed by OpenAI GPT-4o to generate synthesised workshop outputs.
5. Consent records are stored separately with immutable audit fields.

### 1.4 Sub-Processors and Data Flows

| Processor | Role | Location | Transfer Mechanism |
|---|---|---|---|
| Supabase Inc. | Database hosting, row-level security | EU (AWS eu-west-1) | EEA - no transfer mechanism required |
| Vercel Inc. | Application hosting and CDN | EU (primary region) | Standard Contractual Clauses (SCC) |
| OpenAI Inc. | AI inference (GPT-4o conversation synthesis) | US | SCC + Zero Data Retention (ZDR) policy |
| Railway Inc. | Voice/audio pipeline processing (CaptureAPI) | US | SCC |
| GitHub Inc. | Source code and CI/CD | US | SCC |
| Upstash Inc. | Redis caching layer | EU | EEA - no transfer mechanism required |

### 1.5 Retention Periods

| Data Category | Retention Period | Deletion Mechanism |
|---|---|---|
| Conversation transcripts and workshop data | 12 months from workshop completion | Automated scheduled deletion job |
| Participant identity data | 12 months from workshop completion | Automated scheduled deletion job |
| Consent records | 7 years from date of consent | Manual deletion after legal hold period |
| Audit logs | 7 years | Manual deletion after legal hold period |
| Administrator account data | Duration of engagement + 12 months | Manual deletion on offboarding |
| Analytics events (anonymised) | 24 months | Automated scheduled deletion job |

### 1.6 Data Subjects

Primary data subjects are employees and contractors of client organisations (workshop participants). A secondary class of data subjects are RAISE administrators and client organisation administrators who access the platform.

---

## Step 2: Necessity and Proportionality

### 2.1 Lawful Basis

| Processing Activity | Lawful Basis | Article Reference |
|---|---|---|
| Discovery conversation collection and AI synthesis | Consent | Art. 6(1)(a) UK GDPR |
| Platform operational logging and security monitoring | Legitimate interests (security and operational integrity) | Art. 6(1)(f) UK GDPR |
| Consent record retention | Legal obligation (accountability under Art. 5(2)) | Art. 6(1)(c) UK GDPR |
| Administrator account management | Legitimate interests (contract performance, platform access control) | Art. 6(1)(f) UK GDPR |

Consent is obtained via a clear, unambiguous, and granular consent mechanism prior to any conversation data being collected. Participants may withdraw consent at any time by contacting privacy@raisegtm.com. Withdrawal does not affect lawfulness of prior processing.

Legitimate interests balancing test has been conducted for operational logging. The interest in platform security and incident response outweighs the minimal privacy impact of retaining IP addresses and user agent data, given the limited identifiability risk and the security benefit to all users.

### 2.2 Data Minimisation

The following data minimisation measures are in place:

- Name, email, role, and department are collected solely to attribute insights to appropriate participant cohorts. No additional demographic data (age, gender, nationality) is collected.
- IP addresses are collected for security logging only; they are not used for analytics or profiling.
- Attribution preference gives participants control over whether their name appears in synthesised outputs; selecting anonymous removes name linkage from reports.
- OpenAI Zero Data Retention (ZDR) policy is applied to all inference requests, preventing OpenAI from retaining conversation content for model training.
- Analytics events are designed to contain no PII - only anonymised event types and workshop-level aggregates.

### 2.3 Purpose Limitation

Data collected for discovery conversation processing is used exclusively for:
1. Generating synthesised insight reports for workshop facilitators.
2. Providing participants with attribution control over their contributions.
3. Enabling facilitators to conduct workshops informed by pre-gathered insights.

Data is not used for:
- Marketing or advertising.
- Profiling or automated decision-making with legal or similarly significant effects.
- Sale or transfer to third parties outside the sub-processor list above.
- Training OpenAI models (ZDR policy).

### 2.4 Automated Decision-Making

The platform uses AI synthesis (GPT-4o) to generate insight summaries. This does not constitute automated decision-making within the meaning of Article 22 UK GDPR, as:
- Outputs are reports for human facilitators to review and interpret.
- No decisions with legal or similarly significant effects are made solely on the basis of AI outputs.
- Facilitators retain full editorial control over workshop outputs.

---

## Step 3: Risk Identification

### 3.1 Risk Register

| # | Risk | Likelihood | Impact | Severity | Notes |
|---|---|---|---|---|---|
| R1 | Unauthorised access to conversation data (external breach or insider threat) | Medium | High | **HIGH** | Conversations contain candid employee views that could be damaging if exposed |
| R2 | Data transfer to OpenAI outside EEA (residual exposure during inference) | Medium | Medium | **MEDIUM** | ZDR policy mitigates retention risk; SCC provides legal basis for transfer |
| R3 | Participant re-identification from aggregated/anonymised outputs | Low | Medium | **LOW** | Synthesis prompts aggregate; small cohorts may allow re-identification |
| R4 | AI model inadvertently retaining or surfacing training data | Low | High | **MEDIUM** | ZDR policy applied; OpenAI DPA prohibits training on ZDR requests |
| R5 | Data breach via Supabase misconfiguration or vulnerability | Low | High | **MEDIUM** | RLS enforced at database level; all tables require authenticated access |
| R6 | Consent withdrawal not actioned promptly | Low | Medium | **LOW** | Manual process; no automated withdrawal propagation to sub-processors |
| R7 | Participant data accessed cross-organisation (multi-tenancy isolation failure) | Low | High | **HIGH** | RLS policies enforce organisationId-scoped access on all tables |
| R8 | Data retained beyond agreed schedule (deletion job failure) | Medium | Medium | **MEDIUM** | Automated cron job; no alerting if job silently fails |

---

## Step 4: Mitigation Measures

### R1 - Unauthorised Access to Conversation Data

**Technical controls:**
- All data in transit encrypted via HTTPS/TLS 1.2+.
- All data at rest encrypted via AES-256-GCM (Supabase at-rest encryption).
- Supabase Row Level Security (RLS) policies enforce that only authenticated users within the same organisation can query conversation data.
- Administrator accounts protected by TOTP-based multi-factor authentication.
- Session tokens use bcrypt-hashed credentials; JWTs are short-lived.

**Organisational controls:**
- Access to production database is limited to named engineering personnel.
- Incident response plan documents breach notification within 72 hours to ICO per Art. 33 UK GDPR.
- Security review conducted quarterly.

### R2 - Data Transfer to OpenAI Outside EEA

**Technical controls:**
- Zero Data Retention (ZDR) API policy applied to all OpenAI inference requests, preventing OpenAI from storing conversation content after response is returned.
- Data Processing Addendum (DPA) in place with OpenAI (pending update to confirm ZDR terms).

**Legal controls:**
- International data transfer covered by Standard Contractual Clauses (SCC) - EU Commission decision 2021/914.
- Transfer Impact Assessment (TIA) conducted: OpenAI subject to US CLOUD Act but ZDR ensures no persistent copy exists against which government access could be exercised.

### R3 - Re-identification from Anonymised Outputs

**Technical controls:**
- Synthesis prompts instruct GPT-4o to produce thematic aggregations, not individual attributions (unless participant consented to attribution).
- Facilitators are instructed in platform guidance not to share outputs in forms that could identify small cohort members.

**Organisational controls:**
- Facilitator training materials include re-identification risk awareness.
- Workshop outputs reviewed by facilitator before sharing with client stakeholders.

### R4 - AI Model Retaining Training Data

**Technical controls:**
- ZDR policy applied to all OpenAI API calls at the API key configuration level.
- API key is organisationally scoped to RAISE's ZDR-enabled OpenAI enterprise account.

**Legal controls:**
- OpenAI DPA Art. 3 explicitly prohibits use of ZDR API inputs for model training.
- Annual confirmation of ZDR status is included in sub-processor review.

### R5 - Data Breach via Supabase Misconfiguration

**Technical controls:**
- RLS enabled on all tables; all policies tested and audited.
- No tables are publicly accessible without authentication.
- Supabase service role key is held server-side only; client-facing code uses anon key with restrictive RLS.
- Database schema changes reviewed by two engineers before deployment.

**Organisational controls:**
- Supabase security alerts monitored by engineering lead.
- Supabase DPA in place confirming GDPR compliance and EU data residency.

### R6 - Consent Withdrawal Not Actioned

**Technical controls:**
- Consent records table stores immutable withdrawal requests with timestamps.
- Withdrawal requests generate an immediate task notification to the data controller (privacy@raisegtm.com).

**Organisational controls:**
- SLA of 30 days for acting on withdrawal requests (within legal requirement).
- Withdrawal process documented in privacy notice with direct contact details.
- Quarterly audit of outstanding withdrawal requests.

### R7 - Cross-Organisation Data Access (Multi-Tenancy Failure)

**Technical controls:**
- All database tables include an `organisationId` foreign key.
- Supabase RLS policies on all participant-data tables enforce `organisationId = auth.jwt()->>'organisationId'` predicate.
- RLS policies are tested as part of CI pipeline; any policy regression blocks deployment.
- API routes validate organisation membership server-side in addition to RLS.

**Organisational controls:**
- Multi-tenancy isolation verified in penetration test scope.
- Any reported cross-tenancy data access treated as Critical severity incident.

### R8 - Data Retained Beyond Schedule

**Technical controls:**
- Scheduled deletion job runs on verified cron schedule.
- Deletion job logs outcomes to audit table; absence of expected log entry within 24-hour window triggers alert.

**Organisational controls:**
- Monthly manual spot-check of deletion job execution log.
- Retention schedule documented in ROPA and communicated to engineering team.

---

## Step 5: Residual Risk Assessment

### 5.1 Risk Table - Pre and Post Mitigation

| # | Risk | Pre-Mitigation Severity | Controls Applied | Post-Mitigation Severity |
|---|---|---|---|---|
| R1 | Unauthorised access to conversation data | HIGH | TLS, AES-256, RLS, MFA, incident response | **LOW** |
| R2 | Data transfer to OpenAI outside EEA | MEDIUM | ZDR, SCC, DPA, TIA | **LOW** |
| R3 | Participant re-identification | LOW | Aggregated prompts, facilitator guidance | **LOW** |
| R4 | AI model training on participant data | MEDIUM | ZDR, OpenAI DPA | **LOW** |
| R5 | Breach via Supabase misconfiguration | MEDIUM | RLS, service-role isolation, DPA | **LOW** |
| R6 | Consent withdrawal not actioned | LOW | Withdrawal SLA, quarterly audit | **LOW** |
| R7 | Cross-organisation data access | HIGH | RLS on all tables, server-side validation, CI tests | **LOW** |
| R8 | Data retained beyond schedule | MEDIUM | Automated deletion, log alerting, monthly audit | **LOW** |

### 5.2 Overall Residual Risk

**Overall residual risk: LOW.**

Following implementation of the controls described in Step 4, no individual risk remains above LOW severity. The combination of technical controls (RLS, TLS, AES-256, ZDR, MFA) and organisational controls (incident response, quarterly audits, DPA agreements) reduces the overall risk to an acceptable level.

Processing may proceed.

---

## Step 6: DPO / Supervisory Authority Consultation

### 6.1 Assessment

Ethenta Ltd does not currently employ a designated Data Protection Officer (DPO), as it does not meet the thresholds for mandatory DPO appointment under Art. 37 UK GDPR (it does not carry out large-scale systematic monitoring of individuals and does not process special category data as its core activity).

The processing described in this DPIA does not fall within categories requiring mandatory prior consultation with the ICO under Art. 36 UK GDPR, given that:
- Processing of special category data (Art. 9) is not involved.
- Systematic large-scale profiling of individuals is not involved.
- Residual risk has been assessed as LOW following controls.

### 6.2 Recommendation

It is nonetheless **recommended** that Ethenta Ltd:

1. Notify the ICO of this DPIA and its conclusions as a voluntary transparency measure, particularly given the use of AI/LLM processing of employee conversation data.
2. Appoint a part-time or fractional DPO or data protection adviser to provide ongoing guidance as the platform scales.
3. Review this DPIA following any material expansion of processing (e.g. processing of voice/audio data at scale, expansion to health sector clients, or introduction of automated decision-making).

---

## Step 7: Sign-Off

| Role | Name | Signature | Date |
|---|---|---|---|
| Data Protection Officer / Legal Adviser | [To be completed] | [Signature] | 2026-04-17 |
| CISO / Head of Security | [To be completed] | [Signature] | 2026-04-17 |
| Engineering Lead | [To be completed] | [Signature] | 2026-04-17 |
| Authorising Director, Ethenta Ltd | [To be completed] | [Signature] | 2026-04-17 |

---

## Step 8: Review Schedule

| Trigger | Action |
|---|---|
| Annual review | Full DPIA review by engineering lead and legal adviser - due 2027-04-17 |
| New sub-processor added | Update Step 1.4, re-assess R2 and R5, obtain DPA confirmation |
| Material change to data categories collected | Restart DPIA process from Step 1 |
| Material change to retention periods | Update Step 1.5 and Step 5 |
| Security incident affecting participant data | Immediate review of affected risk entries; re-run Step 5 |
| Expansion to voice/audio processing at scale | Reassess R1, R2, R4; consider Art. 36 consultation |
| Introduction of automated decisions with significant effects | Mandatory re-run; likely Art. 36 consultation required |
| Expansion to processing special category data (health, political, etc.) | Mandatory Art. 36 prior consultation with ICO |

---

*This document is maintained under version control in the DREAM Discovery repository. The authoritative copy is at `docs/compliance/dpia.md`. Printed copies should be verified against the repository version before use in any regulatory proceeding.*
