-- Add DREAM prep fields to workshops table
-- These support the pre-workshop intelligence pipeline:
-- Research Agent, Question Set Agent, Discovery Intelligence Agent

-- DREAM track enum
CREATE TYPE "DreamTrack" AS ENUM ('ENTERPRISE', 'DOMAIN');

-- New columns on workshops
ALTER TABLE "workshops" ADD COLUMN "client_name"        TEXT;
ALTER TABLE "workshops" ADD COLUMN "industry"           TEXT;
ALTER TABLE "workshops" ADD COLUMN "company_website"    TEXT;
ALTER TABLE "workshops" ADD COLUMN "dream_track"        "DreamTrack";
ALTER TABLE "workshops" ADD COLUMN "target_domain"      TEXT;
ALTER TABLE "workshops" ADD COLUMN "prep_research"      JSONB;
ALTER TABLE "workshops" ADD COLUMN "custom_questions"   JSONB;
ALTER TABLE "workshops" ADD COLUMN "discovery_briefing" JSONB;
