BEGIN;

SET search_path TO public;

INSERT INTO "organizations" ("id", "name", "createdAt", "updatedAt")
VALUES ('org_ws_demo_1', 'Demo Organization', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "users" ("id", "email", "name", "organizationId", "createdAt", "updatedAt")
VALUES ('user_ws_demo_1_admin', 'ws_demo_1_admin@seed.local', 'Demo Admin', 'org_ws_demo_1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "email" = EXCLUDED."email",
    "name" = EXCLUDED."name",
    "organizationId" = EXCLUDED."organizationId",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "workshops" (
  "id", "organizationId", "name", "description", "businessContext", "workshopType", "status", "createdById",
  "scheduledDate", "responseDeadline", "createdAt", "updatedAt", "includeRegulation"
)
VALUES (
  'ws_demo_1',
  'org_ws_demo_1',
  'Synthetic Workshop – Reset Seed',
  'Seeded workshop with 10 participants and discovery answers keyed to fixed questions',
  'Seeded for rapid validation of the admin review and report generation pipeline.',
  'CUSTOM',
  'IN_PROGRESS',
  'user_ws_demo_1_admin',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  true
)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "businessContext" = EXCLUDED."businessContext",
    "workshopType" = EXCLUDED."workshopType",
    "status" = EXCLUDED."status",
    "createdById" = EXCLUDED."createdById",
    "organizationId" = EXCLUDED."organizationId",
    "includeRegulation" = EXCLUDED."includeRegulation",
    "updatedAt" = CURRENT_TIMESTAMP;

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
  md5('token:' || p.email),
  'NAMED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM p
ON CONFLICT ("id") DO UPDATE
SET "workshopId" = EXCLUDED."workshopId",
    "email" = EXCLUDED."email",
    "name" = EXCLUDED."name",
    "role" = EXCLUDED."role",
    "department" = EXCLUDED."department",
    "attributionPreference" = EXCLUDED."attributionPreference",
    "responseStartedAt" = EXCLUDED."responseStartedAt",
    "responseCompletedAt" = EXCLUDED."responseCompletedAt";

INSERT INTO "conversation_sessions" (
  "id","workshopId","participantId","status","runType","questionSetVersion","currentPhase","phaseProgress",
  "startedAt","completedAt","totalDurationMs","createdAt","updatedAt","language","voiceEnabled","includeRegulation"
)
SELECT
  'cs_' || wp."id",
  'ws_demo_1',
  wp."id",
  'COMPLETED',
  'BASELINE',
  'v1',
  'summary',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'en',
  false,
  true
FROM "workshop_participants" wp
WHERE wp."workshopId" = 'ws_demo_1'
ON CONFLICT ("id") DO UPDATE
SET "status" = EXCLUDED."status",
    "runType" = EXCLUDED."runType",
    "questionSetVersion" = EXCLUDED."questionSetVersion",
    "currentPhase" = EXCLUDED."currentPhase",
    "phaseProgress" = EXCLUDED."phaseProgress",
    "startedAt" = EXCLUDED."startedAt",
    "completedAt" = EXCLUDED."completedAt",
    "updatedAt" = CURRENT_TIMESTAMP,
    "includeRegulation" = EXCLUDED."includeRegulation";

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
CROSS JOIN "conversation_sessions" cs
JOIN "workshop_participants" wp ON wp."id" = cs."participantId"
WHERE cs."workshopId" = 'ws_demo_1'
ON CONFLICT ("sessionId", "questionKey") DO UPDATE
SET "rawText" = EXCLUDED."rawText",
    "workshopId" = EXCLUDED."workshopId",
    "participantId" = EXCLUDED."participantId",
    "source" = EXCLUDED."source";

COMMIT;
