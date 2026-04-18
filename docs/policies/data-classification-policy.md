# Data Classification Policy

| Field | Value |
|---|---|
| Status | Active |
| Version | 1.0 |
| Effective Date | 2026-04-17 |
| Owner | CISO / Engineering Lead |
| Review Date | 2027-04-17 |

---

## 1. Purpose

This policy establishes a classification framework for all data processed by DREAM Discovery. DREAM Discovery handles a heterogeneous range of data types: from publicly available product descriptions to sensitive voice recordings containing identifiable participant voices and commercially confidential business strategy discussions. Consistent classification ensures that appropriate technical and organisational controls are applied to each data type, proportionate to its sensitivity and the harm that could result from its disclosure or loss.

---

## 2. Scope

This policy applies to all data created, collected, processed, stored, or transmitted in connection with the operation of DREAM Discovery, including data stored in Supabase (PostgreSQL), data processed in transit by the Next.js application on Vercel, voice data processed by Railway CaptureAPI, data sent to OpenAI for AI synthesis, and data held in local development environments.

---

## 3. Classification Levels

### 3.1 Public

Data that is intentionally made available to the general public and whose disclosure causes no harm to RAISE or to data subjects.

Examples: RAISE marketing materials, published product documentation, example workshop outputs marked as `isExample=true`.

Controls required: None beyond standard integrity controls.

### 3.2 Internal

Data intended for use within RAISE and authorised tenant organisations, but not for public disclosure. Disclosure would cause reputational or operational inconvenience but not material harm.

Examples: Aggregated anonymised analytics, internal process documentation, non-sensitive system configuration metadata.

Controls required: Access limited to authenticated users. TLS in transit. Standard Supabase at-rest encryption.

### 3.3 Confidential

Data that is sensitive by nature and whose disclosure could cause significant harm to RAISE, a tenant organisation, or individual data subjects. This includes personal data under GDPR.

Examples: Workshop participant names and email addresses, facilitator-authored workshop notes, AI-generated synthesis outputs tied to a specific organisation, business context data submitted by tenant organisations, session tokens, API keys.

Controls required: Access restricted by role and organisation scope (Prisma ORM `organizationId` filtering + Supabase RLS). TLS in transit. AES-256 encryption at rest. Audit logging of all access. Formal retention schedule. DPA in place with all sub-processors who handle this data.

### 3.4 Restricted

The most sensitive category. Data whose disclosure could cause serious harm including identity fraud, significant commercial damage, regulatory penalties, or irreversible privacy violation. This classification includes special category personal data under GDPR Article 9, voice biometric data, and cryptographic credentials.

Examples: Voice recordings (contain identifiable voice biometrics), full transcript text linked to named participants, encryption keys and database credentials, Supabase service role keys, OpenAI API keys, personally identifiable data combined with commercially sensitive business strategy.

Controls required: All Confidential controls plus: column-level encryption where technically feasible, access to raw data limited to named individuals with documented justification, prohibition on inclusion in OpenAI prompts beyond the minimum required for synthesis, immediate deletion after retention period expires, annual review of all access grants.

---

## 4. Data Type Register

| Data Type | Classification | Storage Location | Encryption at Rest | Legal Basis (GDPR Art.6) | Retention |
|---|---|---|---|---|---|
| Participant names and emails | Confidential | Supabase PostgreSQL | AES-256 (Supabase) | Art.6(1)(b) performance of contract | Duration of account + 12 months |
| Workshop session data | Confidential | Supabase PostgreSQL | AES-256 (Supabase) | Art.6(1)(b) / Art.6(1)(f) | 36 months from session date |
| Voice recordings (raw audio) | Restricted | Railway CaptureAPI (transient) | Required | Art.6(1)(b) with explicit consent | Deleted after transcript generation, max 7 days |
| Transcript text (full, named) | Restricted | Supabase PostgreSQL | AES-256 (Supabase) | Art.6(1)(b) with explicit consent | 36 months from session date |
| AI-generated synthesis outputs | Confidential | Supabase PostgreSQL (JSONB columns) | AES-256 (Supabase) | Art.6(1)(b) / Art.6(1)(f) | 36 months from session date |
| Scratchpad outputs | Confidential | Supabase PostgreSQL | AES-256 (Supabase) | Art.6(1)(b) | 36 months from session date |
| Evidence documents | Confidential | Supabase PostgreSQL | AES-256 (Supabase) | Art.6(1)(b) | 36 months from session date |
| Session tokens (JWT) | Restricted | Client browser (httpOnly cookie) / Supabase | TLS in transit | N/A (technical credential) | Max 1 hour (standard), 15 min (admin) |
| Audit logs / analytics events | Internal | Supabase PostgreSQL (`analytics_events`) | AES-256 (Supabase) | Art.6(1)(f) (legitimate interest) | 24 months |
| Encryption keys and API credentials | Restricted | Vercel environment vars / Railway env | Vercel secrets management | N/A (technical credential) | Rotate every 90 days or on compromise |
| Tenant organisation metadata | Internal | Supabase PostgreSQL | AES-256 (Supabase) | Art.6(1)(b) | Duration of contract + 12 months |
| Export HTML packages | Confidential | Transient (generated on demand, not stored) | TLS in transit | Art.6(1)(b) | Not retained on server |

---

## 5. Policy Statement

### 5.1 Classification Responsibilities

5.1.1 The Engineering Lead is responsible for classifying new data types when they are introduced to DREAM Discovery and for ensuring this register is updated.

5.1.2 Developers introducing new database columns, new API endpoints, or new AI pipeline inputs must identify the classification of the data involved before writing the implementation.

5.1.3 Data classification must be documented at the point of design, not retrospectively.

### 5.2 Handling Rules by Classification

5.2.1 Restricted data must never be:
- Logged in application logs, Vercel function logs, or Railway service logs.
- Included in error messages returned to clients.
- Transmitted to OpenAI without a specific, documented justification and confirmation that the OpenAI DPA is in effect.
- Shared with any third party not listed as an approved sub-processor.

5.2.2 Confidential data must never be:
- Accessible via unauthenticated API endpoints.
- Returned in API responses without validating that the requesting session belongs to the same organisation.
- Exported or extracted in bulk without Engineering Lead approval.

5.2.3 When data from different classification levels is combined (e.g., a workshop transcript that names participants and includes commercially sensitive strategy), the resulting combined record inherits the highest classification level of any constituent element.

### 5.3 Data Transmitted to OpenAI

5.3.1 OpenAI is a sub-processor for AI synthesis, facilitation guidance generation, and output intelligence. Data sent to OpenAI must be limited to the minimum necessary for the function being performed.

5.3.2 Before transmitting any Confidential or Restricted data to OpenAI, the Engineering Lead must confirm that OpenAI's zero data retention option is configured for the API keys used by DREAM Discovery, or that a Data Processing Agreement (DPA) with appropriate terms is in place.

5.3.3 Raw voice recordings must never be sent to OpenAI. Only transcribed text may be used in AI synthesis prompts, and then only after any unnecessary direct identifiers have been removed where technically feasible.

### 5.4 Downgrading and Declassification

5.4.1 Data may only be declassified (moved to a lower classification level) when it is demonstrably anonymised to a standard where re-identification is not reasonably possible.

5.4.2 Aggregated, anonymised analytics outputs derived from participant data may be classified as Internal provided the aggregation meets the k-anonymity threshold of k=5 (no group smaller than 5 individuals).

---

## 6. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Engineering Lead | Classifying new data types, maintaining this register, approving downgrade/declassification decisions |
| CISO | Auditing adherence to handling rules, reviewing classification decisions, escalating misclassification |
| Developers | Applying correct controls during implementation, never logging Restricted data, flagging uncertainty about classification to Engineering Lead |
| All Staff | Handling data in accordance with its classification level, reporting suspected misclassification |

---

## 7. Compliance and Enforcement

Mishandling of Confidential or Restricted data, including inadvertent logging, exposure via API responses, or transmission to unapproved sub-processors, constitutes a potential GDPR personal data breach and must be reported under the Incident Response Policy within 72 hours of discovery.

---

## 8. Review Cycle

This policy and the data type register must be reviewed annually, no later than 2027-04-17, and whenever a new data type is introduced to DREAM Discovery.
