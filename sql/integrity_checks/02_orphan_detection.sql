-- Phase 3: Orphan detection across all child tables
-- Run in Supabase SQL editor (read-only)
-- Expected: all orphan_count = 0
SELECT 'workshop_participants' AS table_name, COUNT(*) AS orphan_count
FROM workshop_participants WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = workshop_participants."workshopId")
UNION ALL
SELECT 'conversation_sessions', COUNT(*) FROM conversation_sessions
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = conversation_sessions."workshopId")
UNION ALL
SELECT 'conversation_messages', COUNT(*) FROM conversation_messages
WHERE NOT EXISTS (SELECT 1 FROM conversation_sessions WHERE id = conversation_messages."sessionId")
UNION ALL
SELECT 'conversation_insights', COUNT(*) FROM conversation_insights
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = conversation_insights."workshopId")
UNION ALL
SELECT 'conversation_reports', COUNT(*) FROM conversation_reports
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = conversation_reports."workshopId")
UNION ALL
SELECT 'data_points', COUNT(*) FROM data_points
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = data_points."workshopId")
UNION ALL
SELECT 'data_point_annotations', COUNT(*) FROM data_point_annotations
WHERE NOT EXISTS (SELECT 1 FROM data_points WHERE id = data_point_annotations."dataPointId")
UNION ALL
SELECT 'data_point_classifications', COUNT(*) FROM data_point_classifications
WHERE NOT EXISTS (SELECT 1 FROM data_points WHERE id = data_point_classifications."dataPointId")
UNION ALL
SELECT 'agentic_analyses', COUNT(*) FROM agentic_analyses
WHERE NOT EXISTS (SELECT 1 FROM data_points WHERE id = agentic_analyses."dataPointId")
UNION ALL
SELECT 'live_workshop_snapshots', COUNT(*) FROM live_workshop_snapshots
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = live_workshop_snapshots."workshopId")
UNION ALL
SELECT 'transcript_chunks', COUNT(*) FROM transcript_chunks
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = transcript_chunks."workshopId")
UNION ALL
SELECT 'workshop_event_outbox', COUNT(*) FROM workshop_event_outbox
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = workshop_event_outbox."workshopId")
UNION ALL
SELECT 'workshop_scratchpads', COUNT(*) FROM workshop_scratchpads
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = workshop_scratchpads."workshopId")
UNION ALL
SELECT 'workshop_shares', COUNT(*) FROM workshop_shares
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = workshop_shares."workshopId")
UNION ALL
SELECT 'capture_sessions', COUNT(*) FROM capture_sessions
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = capture_sessions."workshopId")
UNION ALL
SELECT 'capture_segments', COUNT(*) FROM capture_segments
WHERE NOT EXISTS (SELECT 1 FROM capture_sessions WHERE id = capture_segments."captureSessionId")
UNION ALL
SELECT 'findings', COUNT(*) FROM findings
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = findings."workshopId")
UNION ALL
SELECT 'diagnostic_syntheses', COUNT(*) FROM diagnostic_syntheses
WHERE NOT EXISTS (SELECT 1 FROM workshops WHERE id = diagnostic_syntheses."workshopId")
ORDER BY table_name;
-- Baseline result: all 18 child tables = 0 orphans (confirmed 2026-03-11)
