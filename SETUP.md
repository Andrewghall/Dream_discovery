# Quick Setup Guide

## Prerequisites

1. **PostgreSQL** with pgvector extension
2. **Node.js** 18+
3. **OpenAI API Key**

## Step-by-Step Setup

### 1. Database Setup

```bash
# Create database
createdb dream_discovery

# Connect and enable pgvector
psql dream_discovery
CREATE EXTENSION vector;
\q
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` and add:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dream_discovery"
OPENAI_API_KEY="sk-your-key-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Install Dependencies & Generate Prisma Client

```bash
npm install
npm run db:generate
npm run db:push
```

### 4. Seed Database with Demo Data

```bash
npm run db:seed
```

This creates:
- Demo organization
- Demo admin user
- Sample workshop with 3 participants

### 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000/admin

## Testing the System

### Admin Flow

1. Go to http://localhost:3000/admin
2. View the demo workshop
3. Click on the workshop to see details
4. Add more participants if needed
5. Copy a participant's discovery link

### Participant Flow

1. Open the discovery link in a new tab/incognito window
2. Choose attribution preference (named or anonymous)
3. Start the AI conversation
4. Answer questions - AI will probe for depth
5. Complete all 6 phases

### What to Expect

**Phase 1: Intro** - AI welcomes and asks for attribution preference
**Phase 2: Current State** - AI asks about challenges, probes for examples
**Phase 3: Constraints** - AI explores blockers and frustrations
**Phase 4: Vision** - AI asks about ideal future state
**Phase 5: Prioritization** - AI asks for top priorities
**Phase 6: Summary** - AI summarizes and confirms understanding

The AI will:
- Ask follow-up questions if answers are vague
- Request specific examples
- Ask for quantification (how often, how long)
- Probe for named entities (systems, people, processes)
- Not move to next phase until minimum insights extracted

## Troubleshooting

### Prisma Client Not Found

```bash
npm run db:generate
```

### Database Connection Error

Check your `DATABASE_URL` in `.env` and ensure PostgreSQL is running.

### OpenAI API Error

Verify your `OPENAI_API_KEY` is correct and has credits.

### TypeScript Errors

The lint errors about implicit 'any' types are expected before running `npm run db:generate`. They will resolve once Prisma client is generated.

## Next Steps

- Create your own workshops
- Invite real participants
- Monitor conversations in admin dashboard
- Review extracted insights
- Export conversation transcripts

## Architecture Overview

```
Participant → Discovery Link → AI Conversation → Insights Extracted → Admin Dashboard
                                      ↓
                              Stored in Database
                                      ↓
                              Embedded in Vector Store
                                      ↓
                              Available for Analysis
```

## Database Schema

- `organizations` - Multi-tenant orgs
- `users` - Admin users
- `workshops` - Workshop sessions
- `workshop_participants` - Participants with unique tokens
- `conversation_sessions` - Active conversations
- `conversation_messages` - Chat history
- `conversation_insights` - Extracted insights with embeddings
- `discovery_themes` - Aggregated themes

## API Endpoints

**Admin:**
- `GET /api/admin/workshops` - List all workshops
- `POST /api/admin/workshops` - Create workshop
- `GET /api/admin/workshops/:id` - Get workshop details
- `POST /api/admin/workshops/:id/participants` - Add participant
- `POST /api/admin/workshops/:id/send-invitations` - Send emails

**Participant:**
- `POST /api/conversation/init` - Initialize session
- `POST /api/conversation/message` - Send/receive messages

## Support

For issues or questions, check the main README.md or review the spec documents in the parent directory.
