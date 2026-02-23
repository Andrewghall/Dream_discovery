# Dream Discovery Platform — Technical & Commercial Deep Dive

---

## 1. Executive Summary

Dream Discovery is a multi-tenant SaaS platform that transforms live business conversations — workshops, strategy sessions, sales calls — into structured strategic intelligence in real-time. Unlike traditional workshop tools that record and then analyse, Dream Discovery builds its understanding *during* the conversation. The output report is a live projection of what the system currently understands, not a post-hoc synthesis.

### The Problem

Traditional workshop facilitation follows a broken pattern: record everything, then spend days manually synthesising themes, insights, and recommendations. The intelligence arrives too late — momentum is lost, context fades, and the report rarely captures the nuanced interplay of ideas that emerged in the room.

AI-assisted tools have improved this, but most still operate in discrete chunks: transcribe a segment, classify it, move on. Each utterance is analysed in isolation. There is no evolving understanding, no belief system that strengthens as evidence accumulates, no contradiction detection when participants disagree.

### What Dream Discovery Does Differently

The platform maintains a **living cognitive state** throughout the session. As participants speak, the DREAM cognitive engine:

- Forms beliefs about what the group thinks (with confidence levels and evidence counts)
- Reinforces beliefs when multiple participants echo the same theme
- Detects contradictions when statements conflict with existing beliefs
- Tracks domain focus (People, Operations, Customer, Technology, Regulation) as conversation evolves
- Projects its understanding into 7 output lenses in real-time

By the time the session ends, the report is already written. The facilitator can see exactly what the system understood, challenge its conclusions, and refine the output — all before participants leave the room.

### Platform at a Glance

| Dimension | Detail |
|-----------|--------|
| **Application** | Next.js 16.1 on Vercel (serverless) |
| **Database** | PostgreSQL via Supabase (20 models, 15+ indices) |
| **AI Tier 1** | Llama 3.2 (3B) SLM on Railway — transcript cleanup, entity extraction |
| **AI Tier 2** | GPT-4o-mini agentic engine — tool-calling belief system |
| **AI Tier 3** | GPT-4o — end-of-session deep synthesis |
| **Real-time** | Server-Sent Events (SSE) for live UI updates |
| **Multi-tenancy** | Organization-scoped with RBAC (3 roles) |
| **Security** | AES-256-GCM encryption, JWT auth, GDPR compliance |
| **Scale** | 75 API routes, 31 pages, 233k+ lines of code |
| **Modules** | Workshop analysis, Sales call intelligence, Discovery interviews |

---

## 2. Architecture & Infrastructure

### System Overview

```
                    ┌─────────────────────────────────────────────────┐
                    │                   CLIENT                        │
                    │  Next.js App (React 19, Radix UI, Tailwind)     │
                    │  Hemisphere Viz | Scratchpad | Reasoning Panel  │
                    └──────────────┬──────────────────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────────────────────────┐
                    │              VERCEL (Serverless)                 │
                    │                                                  │
                    │  API Routes (75)     SSE Events (globalThis)     │
                    │  Auth Middleware      Cognitive State Store       │
                    │  DREAM Agent          Lens Projector              │
                    │                                                  │
                    │  ┌─────────────┐    ┌─────────────────────┐     │
                    │  │ Transcript  │───▶│ Agentic Engine       │     │
                    │  │ Route       │    │ GPT-4o-mini + Tools  │     │
                    │  └─────────────┘    │ (4 iterations max)   │     │
                    │                     └─────────────────────┘     │
                    └──────┬───────────────────────┬──────────────────┘
                           │                       │
              ┌────────────▼──────────┐   ┌───────▼──────────────┐
              │   SUPABASE            │   │   RAILWAY            │
              │                       │   │                      │
              │  PostgreSQL (20 models)│   │  CaptureAPI (FastAPI)│
              │  Row-Level Security   │   │  Llama 3.2 (Ollama)  │
              │  Storage (images)     │   │  Deepgram / Whisper  │
              │  Encryption at rest   │   │  Entity extraction   │
              └───────────────────────┘   └──────────────────────┘
```

### Deployment Model

**Vercel** hosts the Next.js application as serverless functions. Each API route is an independent function that scales to zero and auto-scales under load. The cognitive state and SSE event stores use `globalThis` for in-memory persistence across warm invocations within the same isolate.

**Railway** hosts CaptureAPI — a Python FastAPI service running Ollama (Llama 3.2) for SLM processing and integrating with Deepgram for cloud transcription or Whisper for offline transcription.

**Supabase** provides managed PostgreSQL with connection pooling, built-in storage for images and exports, and infrastructure-level encryption at rest.

### Multi-Tenant Data Model

Every piece of data is scoped to an organisation:

```
Organization
  ├── Users (PLATFORM_ADMIN, TENANT_ADMIN, TENANT_USER)
  ├── Workshops
  │     ├── DataPoints (utterances)
  │     │     ├── TranscriptChunks
  │     │     ├── DataPointClassifications
  │     │     ├── AgenticAnalysis
  │     │     └── DataPointAnnotations
  │     ├── WorkshopParticipants
  │     │     ├── ConversationSessions
  │     │     │     ├── ConversationMessages
  │     │     │     └── ConversationInsights
  │     │     └── ConversationReports
  │     ├── DiscoveryThemes
  │     ├── LiveWorkshopSnapshots
  │     └── WorkshopScratchpad
  └── AuditLogs
```

API routes enforce organisation ownership via `validateWorkshopAccess()` before returning any data. JWT tokens carry the `organizationId` claim, and middleware verifies it on every request.

### Real-Time Architecture

The platform uses **Server-Sent Events (SSE)** for live updates during capture sessions. Event types include:

- `utterance.new` — New transcribed utterance
- `classification.updated` — Cognitive engine classified an utterance
- `belief.created` / `belief.reinforced` / `belief.stabilised` — Belief system changes
- `contradiction.detected` — Tension found between beliefs
- `agentic.reasoning` — Live tool calls from the agentic engine

Events are stored in a `globalThis`-backed Map keyed by `workshopId`. Listeners subscribe per-workshop. Events are garbage-collected after the session ends.

---

## 3. The AI/ML Pipeline — SLM + Agentic Framework

Dream Discovery uses a two-tier AI architecture: a lightweight SLM for fast preprocessing, and a heavyweight agentic engine for deep semantic understanding.

### Tier 1: SLM — CaptureAPI on Railway

**Model**: Llama 3.2 (3B parameters) via Ollama
**Deployment**: Railway (CPU inference)
**Latency**: ~500-1000ms per utterance
**Offline capable**: Yes (Whisper for transcription + Ollama runs locally)

The SLM handles the fast, mechanical work that doesn't need deep reasoning:

1. **Transcript cleanup** — Removes filler words (um, uh, you know), false starts, and repetitions while preserving all meaning-bearing content. Conservative approach: when uncertain, keep the original text.

2. **Entity extraction** — Identifies five entity types:
   - `noun_phrase`: concepts, names, systems ("customer feedback platform")
   - `verb_phrase`: actions with modifiers ("failing to address")
   - `time_reference`: temporal markers ("last quarter", "by Q3")
   - `measurement`: quantified statements ("50% reduction", "3 months")
   - `location`: places and organisational units ("headquarters", "APAC region")

3. **Emotional tone detection** — Classifies each utterance as positive, neutral, concerned, or critical with a confidence score.

The SLM returns both `rawText` (original transcription) and `cleanText` (processed version), along with structured metadata. The clean text flows into the agentic engine; the raw text is preserved for audit and fallback.

**Transcription backends**:
- **Deepgram** (primary): Cloud-based, ~94% accuracy, speaker diarisation
- **Whisper** (fallback): Open-source, runs on-device, offline-capable

### Tier 2: DREAM Agentic Cognitive Engine

**Model**: GPT-4o-mini via OpenAI API
**Pattern**: Tool-calling agentic loop (not single-call extraction)
**Latency**: ~1.5-2.5s per utterance (typically 2 iterations)
**Max iterations**: 4 rounds
**Hard timeout**: 5 seconds

This is a genuine agentic system. The model receives an utterance and a set of 6 tools, then *decides for itself* what to investigate before committing its analysis.

#### The Agentic Loop

```
Utterance arrives ("We need to invest more in customer feedback systems")
  │
  ▼
Iteration 1: Model decides what to investigate
  ├── Calls query_beliefs("customer feedback") → finds 2 existing beliefs
  ├── Calls search_entities("feedback system") → finds co-occurring entities
  └── Observes results, reasons about connections
  │
  ▼
Iteration 2: Model refines its understanding
  ├── Calls check_contradiction(belief_123, belief_456) → no conflict found
  └── Calls commit_analysis → produces final CognitiveStateUpdate
  │
  ▼
State engine applies the update:
  ├── Reinforces existing belief "Customer visibility needs improvement" (confidence 45% → 52%)
  ├── Creates new belief "Investment in feedback technology" (confidence 30%)
  └── Emits SSE events for the live UI
```

#### The 6 Agent Tools

All tools execute in-process against the in-memory CognitiveState. Zero network latency — the only cost is the GPT-4o-mini API round-trips.

| Tool | Purpose | Typical Response |
|------|---------|-----------------|
| `query_beliefs` | Search existing beliefs by keyword, category, or domain | Top 5 matches with IDs, confidence, evidence count |
| `check_contradiction` | Compare two beliefs for tension | Category analysis, shared domains, existing contradiction records |
| `search_entities` | Find tracked concepts and their co-occurrences | Entity list with mention counts and relationships |
| `get_actor_context` | Retrieve what's known about a specific person/role | Role, mention count, interaction history |
| `get_conversation_momentum` | Check domain focus, sentiment trajectory | Full momentum snapshot |
| `commit_analysis` | **Terminal** — produce final analysis and end the loop | CognitiveStateUpdate (beliefs, contradictions, entities, classification) |

The model self-selects tools, can call multiple in parallel, and decides when it has enough information to commit. On the final iteration, the system forces `commit_analysis` to guarantee termination.

#### Model-Agnostic Interface

The agentic engine implements a clean interface (`CognitiveReasoningEngine`) that any model can implement:

```typescript
interface CognitiveReasoningEngine {
  processUtterance(
    state: CognitiveState,
    utterance: UtteranceInput,
    onReasoningStep?: (entry: ReasoningEntry) => void
  ): Promise<CognitiveStateUpdate>

  readonly engineName: string
}
```

Today this is implemented by GPT-4o-mini. The interface is designed so a future SLM, Claude, or custom model can replace it without changing any other code.

### Tier 3: GPT-4o Deep Synthesis

**Model**: GPT-4o
**When**: End-of-session "Generate Report" action
**Purpose**: Deep reasoning over the full corpus of beliefs, themes, and contradictions

While Tier 2 processes one utterance at a time (building understanding incrementally), Tier 3 synthesises the complete cognitive state into structured output for the scratchpad tabs. This is the only non-real-time AI call — it runs when the facilitator explicitly requests synthesis.

### How the Tiers Work Together

```
Audio from room microphone
  │
  ▼
CaptureAPI (Tier 1 — SLM)
  ├── Deepgram transcription (cloud) or Whisper (offline)
  ├── Llama 3.2 cleanup: filler removal, entity extraction, tone
  └── Returns: cleanText + entities + tone + metadata
  │
  ▼
Transcript Route (Vercel)
  ├── Utterance buffer (filters trivial fragments < 3 words)
  ├── Stores DataPoint + TranscriptChunk in Supabase
  └── Triggers async cognitive analysis
  │
  ▼
DREAM Agentic Engine (Tier 2 — GPT-4o-mini)
  ├── Receives utterance + tool definitions
  ├── Queries own cognitive state via tools
  ├── Commits analysis (beliefs, classification, contradictions)
  └── Emits SSE events for live UI
  │
  ▼
State Engine
  ├── Applies belief updates (create/reinforce/weaken)
  ├── Checks stabilisation thresholds
  ├── Updates entity graph and actor network
  └── Updates conversation momentum
  │
  ▼
Live UI (client)
  ├── Hemisphere nodes appear and colour by type
  ├── Domain radar updates with weighted counts
  ├── Reasoning panel shows tool calls in real-time
  └── Lens projections update (scratchpad preview)

  │ (later, on demand)
  ▼
Synthesis (Tier 3 — GPT-4o)
  ├── Reads full cognitive state + all snapshots
  └── Generates structured scratchpad JSON for all 7 tabs
```

---

## 4. Cognitive State & Belief System

The cognitive state is the central innovation. It is not a log of events — it is a living, evolving model of what the system currently understands about the workshop conversation.

### Belief Lifecycle

```
Utterance → "We struggle with customer feedback visibility"
  │
  ▼
CREATE belief: "Customer feedback visibility is a challenge"
  category: constraint
  domains: [Customer: 0.8, Operations: 0.5]
  confidence: 0.30 (new beliefs start modest)
  evidence: 1
  │
  ▼ (later utterance reinforces)
REINFORCE: confidence 0.30 → 0.40 (+15% logarithmic growth)
  evidence: 2
  │
  ▼ (another reinforcement)
REINFORCE: confidence 0.40 → 0.49
  evidence: 3
  │
  ▼ (hits stabilisation thresholds)
STABILISE: locked into output
  confidence ≥ 0.6 ✓
  evidence ≥ 2 ✓
  age ≥ 20 seconds ✓
  no unresolved contradictions ✓
```

### Confidence Dynamics

- **New beliefs** start between 0.20 and 0.50 (capped by the state engine regardless of what the model suggests)
- **Reinforcement** uses logarithmic growth: `confidence + (1 - confidence) * 0.15` — fast initial growth, diminishing returns
- **Weakening** applies a 0.7 multiplier: `confidence * 0.7` (minimum 0.05)
- **Contradiction** reduces both conflicting beliefs by 0.8 multiplier

### Semantic Deduplication

When the engine tries to create a new belief, the state engine checks for existing beliefs with similar content using Jaccard similarity on semantic signatures:

1. Extract content words (remove 200+ stop words)
2. Sort alphabetically → canonical "semantic signature"
3. Compare signatures: if Jaccard similarity > 0.5, reinforce existing belief instead of creating a duplicate

This prevents the belief store from accumulating redundant entries when participants repeat themes in different words.

### Contradiction Detection

The agentic engine can use the `check_contradiction` tool to compare beliefs. The system identifies structural contradictions based on:

- **Category tension**: aspiration vs constraint, opportunity vs risk, enabler vs constraint
- **Domain overlap**: contradictions are stronger when beliefs share the same domain
- **Existing records**: checks if the contradiction was already detected

When a contradiction is confirmed, both beliefs have their confidence reduced and the contradiction is tracked as a first-class object with its own lifecycle (detected → resolved or persisted).

### The 7 Output Lenses

The lens projector transforms the cognitive state into 7 structured views, each serving a different analytical purpose:

| Lens | What It Shows | Source Beliefs |
|------|--------------|----------------|
| **Discovery** | All beliefs organised by domain | All stabilised beliefs, grouped by 5 domains |
| **Reimagine** | Aspirations and opportunities | category: aspiration, opportunity |
| **Constraints** | Blockers, risks, and contradictions | category: constraint, risk + active contradictions |
| **Potential Solution** | Enablers and actions | category: enabler, action |
| **Customer Journey** | Actor network and interactions | TrackedActors with interaction history |
| **Commercial** | Business-value beliefs | opportunity/action/enabler beliefs in Customer/Operations domains |
| **Summary** | Cross-domain high-confidence findings | Top 15 beliefs by confidence + domain coverage stats |

These lenses project in real-time as beliefs form. By the end of the session, each lens contains a structured view of what the system understood.

---

## 5. Live Workshop Experience

### Audio Capture Pipeline

The facilitator starts a capture session from the admin live page. Audio flows through this pipeline:

1. **Browser captures microphone audio** in 5-second chunks (`CHUNK_MS = 5000`)
2. **CaptureAPI** receives the audio, transcribes it (Deepgram or Whisper), and applies SLM processing
3. **Transcript route** receives the clean text, stores it, and triggers async cognitive analysis
4. **Utterance buffer** accumulates fragments and flushes complete utterances (filters trivial fragments with < 3 substantive words)
5. **Agentic engine** processes each utterance through the tool-calling loop
6. **SSE events** push results to the client in real-time

### Hemisphere Visualisation

The hemisphere is a live node-link graph that grows as utterances are processed:

- **Nodes** represent classified utterances (coloured by type: blue for Visionary, green for Enabler, red for Constraint, etc.)
- **Edges** represent relationships between utterances (co-occurrence, reinforcement, contradiction)
- **Domain radar** shows the weighted distribution across 5 domains, updating in real-time from the cognitive engine's domain assignments
- **Layers** (H1-H4) organise nodes by confidence and stabilisation status

### Agentic Reasoning Panel

A dark-themed panel below the hemisphere shows the agent's real-time thinking:

- Tool call entries appear as they happen (e.g., "Queried beliefs for 'customer experience' — found 3 matches")
- Model thinking is captured between tool calls
- Final commits show what the agent decided and why
- Colour-coded by severity: red (stabilisation), yellow (contradiction), blue (belief), green (utterance)

### Scratchpad Output Tabs

Seven tabs present the cognitive state through different analytical lenses:

1. **Executive Summary** — Vision narrative, strategic shifts, today's challenge, future principles
2. **Discovery Output** — Strategic tables with domain-grouped beliefs, design principles, linked intelligence
3. **Reimagine** — Aspirations and opportunities with confidence indicators
4. **Constraints** — Blockers, risks, and active contradictions with resolution status
5. **Potential Solution** — Enablers and recommended actions with implementation path
6. **Commercial** — Password-protected business analysis (delivery phases, investment summary)
7. **Customer Journey** — Actor swim-lanes with editable journey map and pain points

Each tab supports inline editing, AI-generated insight cards, and can be published for client delivery.

### Export & Reporting

- **HTML export**: Self-contained static package with base64-encoded images, embedded SVG, no external dependencies. Can be opened in any browser without internet.
- **PDF reports**: Generated via Puppeteer with multi-format output.
- **Snapshot system**: Captures hemisphere state at key moments for later comparison and synthesis.

---

## 6. Sales Module

The sales module is architecturally separate from the workshop system (27% of the codebase) but shares the same infrastructure.

### Capabilities

**Pre-call: Meeting Plan Builder**
- Opportunity context, goals, key people
- Customer's world analysis
- Competitive landscape
- Objection preparation with pre-built responses
- Strategic approach and talking points

**During call: Real-Time Analysis**
- Live utterance classification using GPT-4o-mini
- Sales-specific domains: CustomerIntent, ObjectionHandling, BuyingSignal, Discovery, Competition
- Coaching moments: real-time prompts when objections arise or opportunities are missed
- Plan coverage tracking: which objectives have been addressed, which talking points remain

**Post-call: Synthesis & Reporting**
- GPT-4o deep synthesis of the full call
- Customer needs with evidence quotes
- Objection tracking (raised → addressed → resolved)
- Opportunity assessment (Hot / Warm / Cool / Cold)
- Action items with owners and deadlines
- Plan vs actual adherence scoring
- PDF report generation

---

## 7. Security, Compliance & Multi-Tenancy

### Encryption

**Application-level**: AES-256-GCM encryption for sensitive fields:
- Key derivation: PBKDF2 with 100,000 iterations
- Proper IV generation, authentication tags, and salt handling
- Applied to: workshop business context, participant emails, commercial content

**Infrastructure-level**: Supabase provides PostgreSQL disk encryption at rest. All data in transit is HTTPS-enforced.

### Authentication & Session Management

- **JWT-based sessions** (HS256 signing) with 24-hour expiry and sliding-window refresh
- **Bcrypt password hashing** for stored credentials
- **Rate-limited login**: 5 failed attempts trigger a 15-minute account lockout (tracked per email, not IP)
- **Session revocation**: Database-backed session table with explicit revocation support
- **Login audit trail**: Every attempt logged with timestamp, IP, user agent, and outcome

### Role-Based Access Control

| Role | Access | Scope |
|------|--------|-------|
| PLATFORM_ADMIN | Full admin panel, all organisations | Global |
| TENANT_ADMIN | Organisation dashboard, own workshops | Own organisation |
| TENANT_USER | Assigned workshops only | Own organisation |

Middleware enforces role boundaries: tenant users cannot access admin routes, and admins cannot access other organisations' data.

### GDPR Compliance

- **Data export** (`/api/gdpr/export`): Full export of participant data in machine-readable format
- **Right to deletion** (`/api/gdpr/delete`): Two-step confirmed deletion of all personal data with audit trail preservation (per GDPR Article 17(3))
- **Consent management**: Tracked per participant with attribution preferences (named or anonymous)
- **Audit logging**: 16 action types including CREATE, VIEW, UPDATE, DELETE operations across workshops, participants, conversations, and scratchpads
- **Data retention**: Audit logs retained for compliance; session data cleaned after inactivity

### Multi-Tenant Isolation

- Every database query is scoped to `organizationId`
- API routes call `validateWorkshopAccess()` before returning data
- JWT tokens carry organisation claims verified on every request
- Guest access uses unique discovery tokens (CUID, cryptographically random) tied to specific workshops
- Organisation-level branding (colours, logos) with per-org seat limits

---

## 8. Differentiators & Future Direction

### What Makes This Different

**1. Understanding builds during the session, not after.**
Most AI-assisted workshop tools record first, then synthesise. Dream Discovery's cognitive state evolves in real-time. The beliefs, contradictions, and domain analysis that form during the conversation ARE the output. The report is just a snapshot.

**2. Genuine agentic reasoning, not structured extraction.**
The DREAM cognitive engine uses a tool-calling loop where the model queries its own belief state, checks for contradictions, and decides what to investigate. This is observable — the facilitator can watch the agent think in real-time via the reasoning panel.

**3. Two-tier AI: SLM for speed, LLM for depth.**
The Llama 3.2 SLM handles fast, mechanical processing (cleanup, entities, tone) at sub-second latency. The GPT-4o-mini agentic engine handles deep semantic understanding at 1-2 second latency. Neither could do the other's job well.

**4. Model-agnostic by design.**
The `CognitiveReasoningEngine` interface means the agentic engine can be swapped from GPT-4o-mini to Claude, a local SLM, or a future model without changing any other code. The cognitive state, belief dynamics, SSE pipeline, and UI all remain unchanged.

**5. Multi-modal analysis.**
The platform supports workshop facilitation, sales call intelligence, and structured discovery interviews — each with domain-specific agents but shared infrastructure.

### Technical Roadmap

- **Live lens tabs**: Real-time scratchpad projections during capture (lens projector exists, UI wiring in progress)
- **Scratchpad integration**: "Generate Report" uses cognitive state directly instead of re-reading all utterances
- **Encryption expansion**: Application-level encryption for transcript text and conversation messages
- **Row-level security**: Full Supabase RLS policy enforcement alongside application-layer checks
- **SLM expansion**: Run more of the cognitive pipeline on-device for latency and cost reduction
- **Multi-language support**: Leverage existing language selector infrastructure for non-English workshops

---

*Document generated from codebase analysis. All technical claims are verifiable against the source code.*
