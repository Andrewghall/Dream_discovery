# DREAM Discovery Platform

AI-driven conversational discovery system for pre-workshop intelligence gathering.

## Overview

The DREAM Discovery Platform enables organizations to gather detailed, valuable insights from workshop participants through natural AI-facilitated conversations instead of static forms. Participants engage in a 15-minute dialogue that adapts to their responses, probes for depth, and extracts structured insights automatically.

## Features

- **AI-Driven Conversations**: Natural dialogue with GPT-4 that adapts to participant responses
- **Depth-Checking Logic**: Automatically probes for specific examples, quantification, and details
- **Real-time Insight Extraction**: Categorizes responses as challenges, constraints, visions, or priorities
- **6-Phase Conversation Flow**: Structured progression from intro to summary
- **Attribution Control**: Participants choose named or anonymous responses
- **Admin Dashboard**: Monitor conversations, view transcripts, analyze insights (coming soon)
- **Pre-Meeting Visualization**: Aggregated insights dashboard for workshop kickoff (coming soon)

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Vector Store**: pgvector for semantic search
- **AI**: OpenAI GPT-4 (or Anthropic Claude)
- **UI**: Tailwind CSS + shadcn/ui
- **Email**: Resend

## Setup

### 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key (or Anthropic API key)

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a PostgreSQL database and enable pgvector:

```sql
CREATE DATABASE dream_discovery;
\c dream_discovery
CREATE EXTENSION vector;
```

### 4. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: Your OpenAI API key
- `NEXT_PUBLIC_APP_URL`: Your app URL (default: http://localhost:3000)

Optional:
- `ANTHROPIC_API_KEY`: Alternative to OpenAI
- `RESEND_API_KEY`: For email invitations
- `FROM_EMAIL`: Sender email address

### 5. Generate Prisma Client & Run Migrations

```bash
npx prisma generate
npx prisma db push
```

### 6. Seed Database (Optional)

Create a test organization, user, and workshop:

```bash
npm run db:seed
```

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### For Participants

1. Receive email invitation with unique discovery link
2. Click link to start conversation (no login required)
3. Choose attribution preference (named or anonymous)
4. Engage in 15-minute AI-facilitated conversation
5. AI probes for specific examples, quantification, and details
6. Conversation auto-saves progress
7. Receive confirmation when complete

### For Workshop Organizers

1. Create workshop with business context
2. Add participants (manual, CSV, or org directory)
3. Send discovery invitations
4. Monitor completion rates in real-time
5. Review conversation transcripts and extracted insights
6. Open pre-meeting visualization at workshop start
7. Conduct workshop with full context

## Project Structure

```
/app
  /api
    /conversation
      /init          - Initialize conversation session
      /message       - Handle messages and AI responses
  /discovery
    /[workshopId]/[token]  - Participant conversation page
/components
  /chat              - Chat UI components
  /ui                - shadcn/ui components
/lib
  /ai
    system-prompts.ts      - AI facilitator prompts
    depth-analysis.ts      - Response depth checking
  /types
    conversation.ts        - TypeScript types
  prisma.ts         - Prisma client
  env.ts            - Environment validation
/prisma
  schema.prisma     - Database schema
```

## Database Schema

Key tables:
- `organizations` - Multi-tenant organizations
- `users` - Admin users
- `workshops` - Workshop sessions
- `workshop_participants` - Participants with unique tokens
- `conversation_sessions` - Active conversations
- `conversation_messages` - Chat messages
- `conversation_insights` - Extracted insights with embeddings
- `discovery_themes` - Aggregated themes across participants

## Conversation Flow

1. **Intro** (1-2 min): Welcome, attribution choice
2. **Current State** (3-5 min): Explore challenges and workflows
3. **Constraints** (2-3 min): Identify blockers and frustrations
4. **Vision** (3-4 min): Ideal future state without constraints
5. **Prioritization** (1-2 min): Top priorities and quick wins
6. **Summary** (1-2 min): Confirm understanding, thank participant

## Depth Requirements

The AI ensures valuable insights by requiring:
- ✅ Specific examples with context
- ✅ Quantified impact (time, cost, frequency)
- ✅ Named entities (systems, people, processes)
- ✅ Root causes, not just symptoms
- ✅ Minimum word count (>30 words per response)

## Next Steps

- [ ] Build admin dashboard for workshop management
- [ ] Create email invitation system
- [ ] Develop pre-meeting visualization dashboard
- [ ] Implement theme extraction across conversations
- [ ] Add Zoom meeting integration
- [ ] Build combined analysis (discovery + transcript)

## Documentation

See `/docs` folder for:
- `conversational-discovery-spec.md` - Full system specification
- `dialogue-depth-strategy.md` - Depth checking strategy
- `DREAM-Discovery-Platform.md` - Product development plan

## License

Proprietary - DREAM Meeting Automation
