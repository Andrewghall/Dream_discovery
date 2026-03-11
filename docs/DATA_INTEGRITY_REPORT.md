# Data Integrity Report — Phase 3

**Date:** 2026-03-11
**Supabase Project:** `sgftpkzycfbkgidmhbis` (pre-live)

---

## Summary

Phase 3 complete. All FK constraints verified, cascade behavior validated, zero orphans found.

| Check | Result |
|-------|--------|
| FK constraints on all 19 tables | ✅ All present |
| Cascade delete coverage | ✅ Complete |
| Orphan records (18 child tables) | ✅ Zero |
| SET NULL behavior (2 optional refs) | ✅ Intentional and correct |
| Delete lifecycle safety | ✅ Validated |

---

## 1. Foreign Key Structure

All 19 Dream tables have FK constraints. No table is free-floating.

### Cascade Chain (workshop → all descendants)

```
workshops
├── workshop_participants (CASCADE)
│   ├── conversation_sessions (CASCADE → participant)
│   │   ├── conversation_messages (CASCADE)
│   │   ├── conversation_insights (CASCADE)
│   │   ├── conversation_reports (CASCADE)
│   │   └── data_points (CASCADE)
│   │       ├── data_point_annotations (CASCADE)
│   │       ├── data_point_classifications (CASCADE)
│   │       └── agentic_analyses (CASCADE via data_points)
├── conversation_sessions (CASCADE → workshop)
├── conversation_insights (CASCADE → workshop)
├── conversation_reports (CASCADE → workshop)
├── data_points (CASCADE → workshop)
├── live_workshop_snapshots (CASCADE)
├── transcript_chunks (CASCADE)
│   └── data_points.transcriptChunkId (SET NULL — optional ref)
├── workshop_event_outbox (CASCADE)
├── workshop_scratchpads (CASCADE)
├── workshop_shares (CASCADE)
├── capture_sessions (CASCADE)
│   └── capture_segments (CASCADE)
│       └── findings.captureSessionId (SET NULL — optional ref)
├── findings (CASCADE → workshop)
└── diagnostic_syntheses (CASCADE)
```

Deleting a workshop removes all descendants in a single transaction via PostgreSQL cascade. No manual cleanup required.

### SET NULL References (Intentional)

| Column | Behaviour | Rationale |
|--------|-----------|-----------|
| `data_points.transcriptChunkId` | SET NULL on chunk delete | Data points can exist without transcript reference |
| `findings.captureSessionId` | SET NULL on capture session delete | Findings can be promoted independently of capture session |

### RESTRICT References (Intentional)

| Column | Behaviour | Rationale |
|--------|-----------|-----------|
| `workshops.createdById → users` | RESTRICT | Cannot delete a user with active workshops |
| `workshops.organizationId → organizations` | RESTRICT | Cannot delete an org with active workshops |

---

## 2. Orphan Detection Results

Query: `sql/integrity_checks/02_orphan_detection.sql`

| Table | Orphan Count |
|-------|-------------|
| agentic_analyses | 0 |
| capture_segments | 0 |
| capture_sessions | 0 |
| conversation_insights | 0 |
| conversation_messages | 0 |
| conversation_reports | 0 |
| conversation_sessions | 0 |
| data_point_annotations | 0 |
| data_point_classifications | 0 |
| data_points | 0 |
| diagnostic_syntheses | 0 |
| findings | 0 |
| live_workshop_snapshots | 0 |
| transcript_chunks | 0 |
| workshop_event_outbox | 0 |
| workshop_participants | 0 |
| workshop_scratchpads | 0 |
| workshop_shares | 0 |

**Zero orphans across all 18 child tables.** Data is fully consistent.

---

## 3. Phase 3 Exit Criteria

| Criteria | Status |
|---------|--------|
| No critical orphan patterns remaining | ✅ |
| Delete lifecycle validated end-to-end | ✅ (cascade chain verified) |

---

## Residual Risks

| Risk | Classification | Notes |
|------|---------------|-------|
| `agentic_analyses` has no direct `workshopId` FK | LOW | Connected via two-step cascade through `data_points`. Works correctly. |
| Phase 2 policy gap: zero explicit policies | MEDIUM | RLS on + zero policies = deny-all by default. Explicit policies pending Phase 2 completion. |
