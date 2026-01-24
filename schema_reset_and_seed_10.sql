BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SET search_path TO public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "DialoguePhase" AS ENUM ('REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH');
CREATE TYPE "WorkshopStatus" AS ENUM ('DRAFT', 'DISCOVERY_SENT', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "WorkshopType" AS ENUM ('STRATEGY', 'PROCESS', 'CHANGE', 'TEAM', 'CUSTOMER', 'INNOVATION', 'CULTURE', 'CUSTOM');
CREATE TYPE "AttributionPreference" AS ENUM ('NAMED', 'ANONYMOUS');
CREATE TYPE "ConversationStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED');
CREATE TYPE "MessageRole" AS ENUM ('AI', 'PARTICIPANT');
CREATE TYPE "ConversationRunType" AS ENUM ('BASELINE', 'FOLLOWUP');
CREATE TYPE "InsightType" AS ENUM ('ACTUAL_JOB', 'WHAT_WORKS', 'CHALLENGE', 'CONSTRAINT', 'VISION', 'BELIEF', 'RATING');
CREATE TYPE "InsightCategory" AS ENUM ('BUSINESS', 'TECHNOLOGY', 'PEOPLE', 'CUSTOMER', 'REGULATION');
CREATE TYPE "TranscriptSource" AS ENUM ('ZOOM', 'DEEPGRAM', 'WHISPER');
CREATE TYPE "DataPointSource" AS ENUM ('SPEECH', 'MANUAL');
CREATE TYPE "DataPointPrimaryType" AS ENUM ('VISIONARY', 'OPPORTUNITY', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'INSIGHT');

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshops" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "businessContext" TEXT,
  "workshopType" "WorkshopType" NOT NULL DEFAULT 'CUSTOM',
  "status" "WorkshopStatus" NOT NULL DEFAULT 'DRAFT',
  "zoomMeetingId" TEXT,
  "createdById" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3),
  "responseDeadline" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "includeRegulation" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transcript_chunks" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "speakerId" TEXT,
  "startTimeMs" INTEGER NOT NULL,
  "endTimeMs" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "source" "TranscriptSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transcript_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshop_participants" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "department" TEXT,
  "discoveryToken" TEXT NOT NULL,
  "attributionPreference" "AttributionPreference" NOT NULL DEFAULT 'NAMED',
  "emailSentAt" TIMESTAMP(3),
  "responseStartedAt" TIMESTAMP(3),
  "responseCompletedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_sessions" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "runType" "ConversationRunType" NOT NULL DEFAULT 'BASELINE',
  "questionSetVersion" TEXT NOT NULL DEFAULT 'v1',
  "currentPhase" TEXT NOT NULL DEFAULT 'intro',
  "phaseProgress" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "totalDurationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
  "includeRegulation" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_messages" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" "MessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "phase" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_points" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "transcriptChunkId" TEXT,
  "rawText" TEXT NOT NULL,
  "source" "DataPointSource" NOT NULL,
  "speakerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sessionId" TEXT,
  "participantId" TEXT,
  "questionKey" TEXT,
  CONSTRAINT "data_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_point_classifications" (
  "id" TEXT NOT NULL,
  "dataPointId" TEXT NOT NULL,
  "primaryType" "DataPointPrimaryType" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "keywords" TEXT[],
  "suggestedArea" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_point_classifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_point_annotations" (
  "id" TEXT NOT NULL,
  "dataPointId" TEXT NOT NULL,
  "dialoguePhase" "DialoguePhase",
  "intent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "data_point_annotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_insights" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "insightType" "InsightType" NOT NULL,
  "category" "InsightCategory",
  "text" TEXT NOT NULL,
  "severity" INTEGER,
  "impact" TEXT,
  "sourceMessageIds" TEXT[],
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "embedding" vector,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_reports" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "executiveSummary" TEXT NOT NULL,
  "tone" TEXT,
  "feedback" TEXT NOT NULL,
  "inputQuality" JSONB,
  "keyInsights" JSONB,
  "phaseInsights" JSONB,
  "wordCloudThemes" JSONB,
  "modelVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversation_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discovery_themes" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "themeLabel" TEXT NOT NULL,
  "themeDescription" TEXT,
  "participantCount" INTEGER NOT NULL DEFAULT 0,
  "responseIds" TEXT[],
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "modelVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discovery_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "data_points_transcriptChunkId_key" ON "data_points"("transcriptChunkId");
CREATE UNIQUE INDEX "data_points_sessionid_questionkey_key" ON "data_points"("sessionId", "questionKey");
CREATE UNIQUE INDEX "data_point_classifications_dataPointId_key" ON "data_point_classifications"("dataPointId");
CREATE UNIQUE INDEX "data_point_annotations_dataPointId_key" ON "data_point_annotations"("dataPointId");
CREATE UNIQUE INDEX "workshop_participants_discoveryToken_key" ON "workshop_participants"("discoveryToken");
CREATE UNIQUE INDEX "conversation_reports_sessionId_key" ON "conversation_reports"("sessionId");

ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_participantid_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_sessionid_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_transcriptChunkId_fkey" FOREIGN KEY ("transcriptChunkId") REFERENCES "transcript_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_point_classifications" ADD CONSTRAINT "data_point_classifications_dataPointId_fkey" FOREIGN KEY ("dataPointId") REFERENCES "data_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_point_annotations" ADD CONSTRAINT "data_point_annotations_dataPointId_fkey" FOREIGN KEY ("dataPointId") REFERENCES "data_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discovery_themes" ADD CONSTRAINT "discovery_themes_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "organizations" ("id", "name", "createdAt", "updatedAt")
VALUES ('org_demo', 'Demo Organization', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "users" ("id", "email", "name", "organizationId", "createdAt", "updatedAt")
VALUES ('user_demo', 'admin@demo.com', 'Demo Admin', 'org_demo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "workshops" (
  "id", "organizationId", "name", "description", "businessContext", "workshopType", "status", "createdById", "createdAt", "updatedAt", "includeRegulation"
)
VALUES (
  'ws_demo_1',
  'org_demo',
  'Synthetic Workshop – Reset Seed',
  'Fresh schema + 10 participants + discovery answers keyed to fixed questions',
  'This workshop is seeded for rapid validation of the admin review and report generation pipeline.',
  'CUSTOM',
  'IN_PROGRESS',
  'user_demo',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  true
);

WITH p AS (
  SELECT * FROM (
    VALUES
      ('p1','CEO','Exec','Leadership','p1@demo.com'),
      ('p2','CX Manager','Manager','Customer','p2@demo.com'),
      ('p3','Operations Lead','Lead','Operations','p3@demo.com'),
      ('p4','IT Architect','Architect','Technology','p4@demo.com'),
      ('p5','Data Lead','Lead','Technology','p5@demo.com'),
      ('p6','Compliance Lead','Lead','Regulation','p6@demo.com'),
      ('p7','Finance Lead','Lead','Business','p7@demo.com'),
      ('p8','Product Owner','Owner','Business','p8@demo.com'),
      ('p9','Team Leader','Leader','People','p9@demo.com'),
      ('p10','Agent Rep','Agent','People','p10@demo.com')
  ) AS t(id, name, role, department, email)
)
INSERT INTO "workshop_participants" (
  "id","workshopId","email","name","role","department","discoveryToken","attributionPreference",
  "responseStartedAt","responseCompletedAt","createdAt"
)
SELECT
  p.id,
  'ws_demo_1',
  p.email,
  p.name,
  p.role,
  p.department,
  (gen_random_uuid())::text,
  'NAMED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM p;

INSERT INTO "conversation_sessions" (
  "id","workshopId","participantId","status","runType","questionSetVersion","currentPhase","phaseProgress",
  "startedAt","completedAt","createdAt","updatedAt","language","voiceEnabled","includeRegulation"
)
SELECT
  'cs_' || wp.id,
  'ws_demo_1',
  wp.id,
  'COMPLETED',
  'BASELINE',
  'v1',
  'summary',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'en',
  false,
  true
FROM "workshop_participants" wp
WHERE wp."workshopId" = 'ws_demo_1';

WITH q AS (
  SELECT * FROM (
    VALUES
      ('v1:intro:context:0', 'I am {name}. I have been here 2 years. My role focuses on delivery, decision-making, and removing blockers.'),
      ('v1:intro:working:1', 'The best thing is strong colleagues and a shared sense of purpose. What keeps me going is seeing real customer impact.'),
      ('v1:intro:pain_points:2', 'The most frustrating thing is slow approvals and unclear ownership, which creates rework.'),

      ('v1:people:triple_rating:0', 'Current: 5 Target: 8 Projected: 6'),
      ('v1:people:strengths:1', 'When everything works, teams collaborate quickly and leaders make decisions without excessive escalation.'),
      ('v1:people:gaps:2', 'We need better role clarity and more training on new tools and customer journeys.'),
      ('v1:people:future:3', 'Improve cross-team handoffs and reduce the number of queues and duplicative reviews.'),
      ('v1:people:future:4', 'AI should handle repetitive admin tasks; humans should focus on complex judgement and relationship management.'),

      ('v1:corporate:triple_rating:0', 'Current: 4 Target: 8 Projected: 5'),
      ('v1:corporate:friction:1', 'Approvals for simple changes take too long because responsibilities are unclear and sign-offs are duplicated.'),
      ('v1:corporate:friction:2', 'We often work around official processes because the “happy path” doesn’t match real operational constraints.'),
      ('v1:corporate:future:3', 'Clarify decision rights and automate low-risk approvals so work can flow faster.'),

      ('v1:customer:triple_rating:0', 'Current: 6 Target: 9 Projected: 6'),
      ('v1:customer:working:1', 'Great experiences happen when agents have a full picture of the customer and can resolve issues end-to-end.'),
      ('v1:customer:pain_points:2', 'Poor experiences occur when customers repeat information and transfers happen without context.'),
      ('v1:customer:pain_points:3', 'Customers waste time navigating channels and repeating verification steps.'),
      ('v1:customer:future:4', 'In 18 months, customers should have faster resolution, fewer handoffs, and proactive updates.'),

      ('v1:technology:triple_rating:0', 'Current: 4 Target: 8 Projected: 5'),
      ('v1:technology:working:1', 'One tool that helps is a reliable knowledge base that is searchable and kept up to date.'),
      ('v1:technology:pain_points:2', 'The biggest time waste is copying data between systems and re-entering information multiple times a day.'),
      ('v1:technology:gaps:3', 'We struggle to get consistent reporting and a single view of customer history across channels.'),
      ('v1:technology:future:4', 'Automate repetitive workflows and improve integration so data is trustworthy and accessible.'),

      ('v1:regulation:triple_rating:0', 'Current: 5 Target: 8 Projected: 6'),
      ('v1:regulation:constraint:1', 'Compliance requirements add steps and rework, especially when guidance is unclear or changes mid-stream.'),
      ('v1:regulation:friction:2', 'We have been caught off-guard by regulatory updates, leading to rushed changes and uncertainty.'),
      ('v1:regulation:future:3', 'Make compliance embedded and automated where possible, with clearer guidance and better training.'),

      ('v1:prioritization:biggest_constraint:0', 'Technology'),
      ('v1:prioritization:high_impact:1', 'Corporate/Organisational'),
      ('v1:prioritization:optimism:2', 'Mixed — I believe change is possible, but only with clearer ownership and faster decisions.'),
      ('v1:prioritization:lessons_learned:3', 'Previous initiatives failed due to unclear scope, weak governance, and insufficient change management.'),
      ('v1:prioritization:final_thoughts:4', 'Focus on one journey first, measure outcomes, and scale based on what works.')
  ) AS t(question_key, answer_template)
)
INSERT INTO "data_points" (
  "id","workshopId","rawText","source","speakerId","createdAt","sessionId","participantId","questionKey"
)
SELECT
  (gen_random_uuid())::text,
  'ws_demo_1',
  replace(q.answer_template, '{name}', wp."name"),
  'MANUAL',
  NULL,
  CURRENT_TIMESTAMP,
  cs."id",
  wp."id",
  q.question_key
FROM q
JOIN "conversation_sessions" cs ON cs."id" = ('cs_' || cs."participantId")
JOIN "workshop_participants" wp ON wp."id" = cs."participantId"
WHERE cs."workshopId" = 'ws_demo_1';

COMMIT;
