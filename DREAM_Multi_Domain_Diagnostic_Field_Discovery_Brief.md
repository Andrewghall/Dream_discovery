# CLAUDE BUILD BRIEF

# DREAM Multi-Domain Diagnostic + Field Discovery Extension

## (No Changes to Existing Platform Logic)

------------------------------------------------------------------------

# 1. Objective

Extend DREAM to support:

-   Multi-domain workshop configuration\
-   Structured Diagnostic Mode\
-   Remote discovery (existing)\
-   Field discovery (new)\
-   Mobile + desktop capture\
-   Continuous synthesis\
-   Cross-stream comparison

WITHOUT modifying or breaking:

-   Existing DREAM workflows\
-   Existing AI Vision mode\
-   Existing agentic pipelines\
-   Existing Capture API logic\
-   Existing synthesis engine\
-   Existing output rendering logic

This is an additive extension only.

------------------------------------------------------------------------

# 2. What Must NOT Change

The following remain untouched:

-   Existing workshop logic\
-   Existing DREAM AI Vision question flow\
-   Existing agentic orchestration\
-   Existing Capture API PCM streaming model\
-   Existing synthesis engine\
-   Existing output architecture

We are only adding:

-   Domain Packs\
-   Diagnostic configuration\
-   Field Discovery module\
-   Capture Session model\
-   Cross-stream comparison

------------------------------------------------------------------------

# 3. Workshop Configuration Layer (New)

## 3.1 Add to Workshop Creation

### Engagement Type

Dropdown: - Diagnostic Baseline\
- Operational Deep Dive\
- AI Enablement\
- Transformation Sprint\
- Cultural Alignment

### Domain Pack

Dropdown: - Contact Centre (Operational)\
- Customer Engagement (Strategic)\
- HR / People\
- Sales\
- Compliance\
- Enterprise

Domain Packs are configuration objects that load: - Lenses\
- Actor taxonomy\
- Metric references\
- Question templates\
- Diagnostic output structure

Existing AI Vision mode remains unchanged.

------------------------------------------------------------------------

# 4. Discovery Streams

Formalise two streams:

## Discovery_Stream_A

Remote / AI-led discovery (existing functionality)

## Discovery_Stream_B

Field capture (new functionality)

Both stored separately but synthesised together.

------------------------------------------------------------------------

# 5. Field Discovery Module (New)

Navigation: Discovery → Field Discovery

This is a sub-module. It does not replace any existing functionality.

------------------------------------------------------------------------

# 6. Capture Session Model

## CaptureSession

-   workshop_id\
-   domain_pack\
-   engagement_type\
-   capture_type:
    -   walkaround\
    -   executive_interview\
    -   manager_interview\
    -   operational_interview\
-   actor_role\
-   area / department\
-   optional name\
-   consent_flag\
-   status:
    -   open\
    -   recording\
    -   paused\
    -   uploaded\
    -   transcribed\
    -   analysed\
-   created_at\
-   updated_at

### Segment (child of CaptureSession)

-   segment_id\
-   start_time\
-   end_time\
-   audio_reference\
-   transcript_reference

Multiple segments allowed per session.

------------------------------------------------------------------------

# 7. Capture API Integration (Unchanged Core)

Use existing Capture API exactly as-is.

Audio flow:

Device mic\
→ PCM stream\
→ Capture API\
→ Transcription engine\
→ Transcript stored

No new audio engine.\
No chunk processing.\
No duplicated ingestion logic.

------------------------------------------------------------------------

# 8. Desktop Capture (Inside DREAM)

Add button:

**Start Interview Session**

Controls:

-   Start\
-   Pause\
-   Resume\
-   Stop Segment\
-   Finish Session\
-   Discard Last Segment

On Finish: - Upload / queue\
- Trigger existing agentic extraction pipeline

Uses browser mic → PCM → Capture API.

------------------------------------------------------------------------

# 9. Mobile Capture (Thin PWA)

Lightweight Progressive Web App.

## Requirements

### Offline Mode

-   Record PCM locally\
-   Store session metadata locally\
-   Queue upload

### Online Mode

-   Stream PCM to Capture API\
-   Preserve segments\
-   Auto-sync queued sessions

No analysis on device.\
All processing runs in DREAM backend.

------------------------------------------------------------------------

# 10. Processing Pipeline (Reuse Existing Agents)

When session is finished:

1.  Transcript stored\
2.  Existing tagging pipeline runs:
    -   Lens classification\
    -   Constraint detection\
    -   Opportunity detection\
    -   Risk detection\
    -   Contradiction detection\
3.  Findings created

No new categorisation agents required.

------------------------------------------------------------------------

# 11. Findings Model

Each Finding:

-   workshop_id\
-   source_stream (A or B)\
-   lens\
-   type:
    -   constraint\
    -   opportunity\
    -   risk\
    -   contradiction\
-   severity_score\
-   frequency_count\
-   role_coverage\
-   supporting_sessions\[\]\
-   supporting_quotes\[\]\
-   confidence_score

Synthesis operates on Findings only.

------------------------------------------------------------------------

# 12. Continuous Synthesis

As new Findings are added:

-   Update lens summaries\
-   Update severity rankings\
-   Update frequency metrics\
-   Update contradiction scoring\
-   Update role distribution

Incremental updates only.

------------------------------------------------------------------------

# 13. Cross-Stream Comparison

Compare Stream A vs Stream B per lens:

-   Declared perception score\
-   Observed reality score\
-   Alignment gap index

Surface: - Perception vs operational gaps\
- Leadership vs frontline inconsistencies\
- Repeated friction clusters

------------------------------------------------------------------------

# 14. UI Additions

Inside Discovery:

## Field Discovery Tile

### Capture Inbox

-   Session list\
-   Filters by role/lens/day\
-   Status tracking\
-   Resume session option

### Synthesis Progress

-   Sessions processed\
-   Role coverage map\
-   Emerging theme preview

No changes to existing Workshop Questions area.

------------------------------------------------------------------------

# 15. Security

-   GDPR compliant\
-   Consent flag\
-   Transcript redaction support\
-   Encrypted local storage (mobile)\
-   Encrypted upload

------------------------------------------------------------------------

# 16. Diagnostic Output (Diagnostic Mode Only)

Per Lens: - Core Themes\
- Evidence density\
- Severity\
- Role distribution\
- Quick win candidates

Cross-Lens: - Structural weaknesses\
- Systemic risks\
- Contradictions\
- 30 / 90 day actions

AI Vision mode output remains untouched.

------------------------------------------------------------------------

# 17. Success Criteria

After:

-   2 days on-site\
-   50+ interviews\
-   Remote discovery completed

System automatically produces:

-   Structured diagnostic\
-   Alignment gap analysis\
-   Ranked quick wins\
-   Evidence-backed executive narrative

Without manual stitching.
