-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "DialoguePhase" AS ENUM ('REIMAGINE', 'CONSTRAINTS', 'DEFINE_APPROACH');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('DRAFT', 'DISCOVERY_SENT', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkshopType" AS ENUM ('STRATEGY', 'PROCESS', 'CHANGE', 'TEAM', 'CUSTOMER', 'INNOVATION', 'CULTURE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AttributionPreference" AS ENUM ('NAMED', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('AI', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('ACTUAL_JOB', 'WHAT_WORKS', 'CHALLENGE', 'CONSTRAINT', 'VISION', 'BELIEF', 'RATING');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('BUSINESS', 'TECHNOLOGY', 'PEOPLE', 'CUSTOMER', 'REGULATION');

-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('ZOOM', 'DEEPGRAM', 'WHISPER');

-- CreateEnum
CREATE TYPE "DataPointSource" AS ENUM ('SPEECH', 'MANUAL');

-- CreateEnum
CREATE TYPE "DataPointPrimaryType" AS ENUM ('VISIONARY', 'OPPORTUNITY', 'CONSTRAINT', 'RISK', 'ENABLER', 'ACTION', 'QUESTION', 'INSIGHT');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "data_point_annotations" (
    "id" TEXT NOT NULL,
    "dataPointId" TEXT NOT NULL,
    "dialoguePhase" "DialoguePhase",
    "intent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_point_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "data_points_transcriptChunkId_key" ON "data_points"("transcriptChunkId");

-- CreateIndex
CREATE UNIQUE INDEX "data_points_sessionid_questionkey_key" ON "data_points"("sessionId", "questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "data_point_classifications_dataPointId_key" ON "data_point_classifications"("dataPointId");

-- CreateIndex
CREATE UNIQUE INDEX "data_point_annotations_dataPointId_key" ON "data_point_annotations"("dataPointId");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_participants_discoveryToken_key" ON "workshop_participants"("discoveryToken");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_participantid_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_sessionid_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_transcriptChunkId_fkey" FOREIGN KEY ("transcriptChunkId") REFERENCES "transcript_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_point_classifications" ADD CONSTRAINT "data_point_classifications_dataPointId_fkey" FOREIGN KEY ("dataPointId") REFERENCES "data_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_point_annotations" ADD CONSTRAINT "data_point_annotations_dataPointId_fkey" FOREIGN KEY ("dataPointId") REFERENCES "data_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "workshop_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_themes" ADD CONSTRAINT "discovery_themes_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

