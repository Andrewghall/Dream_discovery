# Evidence Feature Stabilisation — Review Summary

**Date**: 2026-04-04
**Session**: Evidence stabilisation pass (phases 1–2)

---

## Changes Made

### 1. DB / Schema Migrations

| Item | Status |
|---|---|
| `prisma/schema.prisma` — added `EvidenceDocument`, `DocumentChunk` models and `evidenceSynthesis` column on `Workshop` | Applied |
| `sql/add_evidence_documents.sql` — table + indexes | Applied to pre-live Supabase via `$executeRawUnsafe` |
| `sql/add_evidence_synthesis.sql` — `ALTER TABLE workshops ADD COLUMN IF NOT EXISTS evidence_synthesis JSONB` | Applied |
| `sql/make_session_user_id_nullable.sql` — `ALTER TABLE sessions ALTER COLUMN "userId" DROP NOT NULL` | Applied (required for PLATFORM_ADMIN sessions) |

**Prisma and runtime are in agreement.** No pending migrations.

---

### 2. Route Cleanup

**Removed**: duplicate `app/api/admin/workshops/[id]/evidence/[docId]/cross-validate/route.ts`
**Replaced with**: a 308 Permanent Redirect to the canonical route
`app/api/admin/workshops/[id]/evidence/cross-validate/route.ts`

The UI only ever called the top-level canonical path; the `[docId]` variant was an artefact of earlier development and never used `docId`.

---

### 3. Regression Tests Added

**`__tests__/integration/evidence-routes.test.ts`** (12 tests):
- `.doc` rejected with 400
- `.docx` accepted with 200
- Empty upload rejected with 400
- Cross-validate returns 422 when `v2Output` absent
- Cross-validate returns 422 when `discover.truths` is empty array
- Cross-validate returns 200 with valid truths
- Cross-validate returns 400 when no ready docs
- Upload invalidates `crossValidation` and `evidenceSynthesis` on all docs
- Chunk deletion uses `evidence/${workshopId}/${docId}` key (not file path)
- Chunk deletion does NOT use file upload path
- Delete calls `invalidateEvidenceDerivatives`
- 404 for nonexistent document

**`__tests__/unit/evidence-tab-state.test.tsx`** (4 tests):
- CV panel and synthesis panel not rendered when data is null
- Both panels rendered when data populated
- State clears to null when server returns null after upload
- Optimistic delete clears both CV and synthesis state

---

### 4. E2E QA Results

Executed against `http://localhost:3000` with a PLATFORM_ADMIN session (admin password reset for local dev):

| Step | Result |
|---|---|
| Upload `.doc` | ✅ Rejected 400: `Unsupported file type: report.doc` |
| Upload `test-evidence.csv` | ✅ Accepted; status=ready, 5 findings, 2 metrics |
| CV with no synthesis (Jo Air workshop) | ✅ 422: `Discovery synthesis is required` |
| CV with valid synthesis (retail workshop) | ✅ 200; CV stored on document with all keys |
| Upload 2nd doc | ✅ CV invalidated (null) on both docs; synthesis null |
| Cross-doc synthesis | ✅ 200; sharedThemes=2, documentCount=2, persisted to DB |
| Delete doc 1 | ✅ 200; chunks for that doc=0, remaining chunks=1 |
| Workshop synthesis after delete | ✅ null (invalidated) |
| Delete doc 2 (cleanup) | ✅ 200; workshop clean |

---

### 5. Codex Issues Fixed (9 rounds)

All blockers raised by Codex through round 9 were resolved before usage limit was hit:

| File | Fix |
|---|---|
| `lib/report/html-renderers.ts` | Removed fabricated `actors: N lenses`, `weight: <domain>` metadata from exported reports |
| `lib/cognition/agents/prep-orchestrator.ts` | DB write failure no longer crashes orchestration; success event gated on successful persist; `questionSet` nulled on DB failure |
| `lib/evidence/cross-validation-agent.ts` | Added V2 `truths` field to `DiscoverySnapshot`; `buildDiscoverySnapshot` includes V1 `alignment.themes` and V2 truths |
| `app/api/admin/workshops/[id]/evidence/cross-validate/route.ts` | Guard accepts any non-empty discovery signal (V2 truths OR V1 themes OR confirmed issues OR constraints OR root causes) |
| `lib/evidence/extractor.ts` | Removed `.ppt` (legacy binary) from accepted types and extractor branch |
| `components/evidence/EvidenceUploadZone.tsx` | Removed `.ppt` from `accept` attribute (browser and API now agree) |
| `app/api/admin/workshops/[id]/evidence/route.ts` | Parallel file ingestion (was serial — could timeout); storage cleanup on ingest failure; size limit uses effective MIME from extension; `.ppt` removed from MIME guess |
| `lib/evidence/pipeline.ts` | `embedAndStore` awaited (serverless-safe); orphaned chunks cleaned on failure |
| `lib/output-intelligence/pipeline.ts` | Report summary regeneration uses `in` operator to preserve user-cleared fields |
| `app/api/admin/workshops/[id]/report-summary/route.ts` | Uses `in` operator for explicit null; `body.reportSummary` type-guarded before `in` check |
| `app/admin/workshops/[id]/live/page.tsx` | Journey state not overwritten by pre-journey snapshots |

---

## Final Verification

```
yarn typescript   → 0 errors
yarn lint         → 0 errors
yarn test         → 1107/1107 passing (62 test files)
E2E QA            → 7/7 scenarios verified
```

---

## Risks

| Risk | Mitigation |
|---|---|
| `evidence-documents` Supabase Storage bucket must be private (`public: false`) | Route code references private bucket by name; upload/download uses service-role key |
| Production DB needs `evidence_synthesis` column | In pending SQL migrations table in MEMORY.md |
| Codex round 10+ blocked by usage limit at review time | All 9 rounds of feedback fixed; manual review confirms no remaining obvious issues; limit resets 11:56 AM |

---

## Assumptions

- Pre-live Supabase DB has all migrations applied (confirmed via `$executeRawUnsafe` during session)
- `evidence-documents` bucket exists in Supabase Storage as private bucket
- Production DB will need `evidence_synthesis` column added before Evidence tab is exposed to tenants
