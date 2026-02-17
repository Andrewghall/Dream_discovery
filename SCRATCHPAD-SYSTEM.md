# DREAM Scratchpad System

## Overview

The scratchpad is the bridge between raw workshop data and the final published report. It allows you to refine AI-organized content before it populates your web template.

## System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     1. WORKSHOP HAPPENS                              │
│  - Live transcription (via CaptureAPI)                              │
│  - Discovery sessions (participant interviews)                       │
│  - Manual data points                                                │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 2. AGENTIC AI ANALYSIS                               │
│  Agent: workshop-analyst-agent.ts                                   │
│  - Analyzes each utterance semantically                             │
│  - Assigns domains (People, Customer, Tech, Regulation, Org)        │
│  - Categorizes (aspiration, opportunity, constraint, risk, enabler) │
│  - Extracts themes and connections                                  │
│  Storage: AgenticAnalysis table                                     │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              3. "PREPARE FOR SCRATCHPAD" BUTTON                      │
│  Endpoint: POST /api/admin/workshops/[id]/prepare-scratchpad        │
│  AI Model: GPT-4o (temp 0.1 for consistency)                        │
│                                                                      │
│  What it does:                                                       │
│  ✓ Fetches all data points with agentic analyses                    │
│  ✓ Fetches conversation reports                                     │
│  ✓ Fetches live snapshot data                                       │
│  ✓ Uses GPT-4o to intelligently organize into:                      │
│    - 5 domains (People, Customer, Technology, Regulation, Org)      │
│    - 5 types per domain (aspiration, opportunity, enabler,          │
│      constraint, risk)                                               │
│  ✓ Orders items logically within each domain                        │
│  ✓ Creates/updates WorkshopScratchpad record in database            │
│  ✓ Downloads JSON file for your records                             │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  4. SCRATCHPAD EDITOR                                │
│  Page: /admin/workshops/[id]/scratchpad                            │
│  Database: WorkshopScratchpad table                                 │
│                                                                      │
│  6 TABS:                                                             │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │ 1. Executive Summary                                       │     │
│  │    - Vision statement                                      │     │
│  │    - Strategic shifts (from → to)                          │     │
│  │    - Today's challenge                                     │     │
│  │    - Future state principles                               │     │
│  ├───────────────────────────────────────────────────────────┤     │
│  │ 2. Discovery Output ⭐ (Currently Built)                  │     │
│  │    LEFT SIDE (2/3 width):                                  │     │
│  │    - Strategic Tables by Domain                            │     │
│  │      • People (clinicians, staff, change management)       │     │
│  │      • Customer (employees, employers, ROI)                │     │
│  │      • Technology (platform, integrations, legacy)         │     │
│  │      • Regulation (HIPAA, GDPR, compliance)                │     │
│  │      • Organisation (culture, teams, budgets)              │     │
│  │    - Design Principles (colored badges)                    │     │
│  │                                                             │     │
│  │    RIGHT SIDE (1/3 width):                                 │     │
│  │    - Linked Intelligence panels                            │     │
│  │      • Clinical (evidence-based insights)                  │     │
│  │      • Strategic (market positioning)                      │     │
│  │      • Commercial (cost/value)                             │     │
│  ├───────────────────────────────────────────────────────────┤     │
│  │ 3. Reimagine                                               │     │
│  │    - Aspirations and opportunities only                    │     │
│  │    - Future-focused vision                                 │     │
│  ├───────────────────────────────────────────────────────────┤     │
│  │ 4. Constraints                                             │     │
│  │    - Constraints and risks only                            │     │
│  │    - What blocks progress                                  │     │
│  ├───────────────────────────────────────────────────────────┤     │
│  │ 5. Commercial (Password Protected 🔒)                     │     │
│  │    - Delivery phases                                       │     │
│  │    - Investment breakdown                                  │     │
│  │    - ROI projections                                       │     │
│  │    - What gets built                                       │     │
│  ├───────────────────────────────────────────────────────────┤     │
│  │ 6. Summary                                                 │     │
│  │    - Final summary                                         │     │
│  │    - Next steps                                            │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ACTIONS:                                                            │
│  • Save Draft - Save edits to database                              │
│  • Publish - Marks as PUBLISHED, ready for template                 │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    5. WEB TEMPLATE                                   │
│  (Future: Public-facing report)                                     │
│  - Pulls data from WorkshopScratchpad (status=PUBLISHED)            │
│  - Beautiful branded presentation                                   │
│  - Stakeholder-ready format                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Example

### Input (Raw Workshop Data)
```
DataPoint #1: "We need to empower clinicians with better tools"
  ↓ Agentic Analysis
  - Domain: People
  - Type: Aspiration
  - Confidence: 0.92

DataPoint #2: "Current systems are too complex to use"
  ↓ Agentic Analysis
  - Domain: Technology
  - Type: Constraint
  - Confidence: 0.88
```

### Output (Scratchpad JSON)
```json
{
  "sections": [
    {
      "domain": "People",
      "content": [
        {
          "type": "aspiration",
          "text": "Empower clinicians with unified digital tools...",
          "sourceId": "dp_001",
          "confidence": 0.92
        }
      ]
    },
    {
      "domain": "Technology",
      "content": [
        {
          "type": "constraint",
          "text": "Current systems are too complex requiring training...",
          "sourceId": "dp_002",
          "confidence": 0.88
        }
      ]
    }
  ]
}
```

### Rendered in Scratchpad UI

**People Section:**
```
╔════════════════════════════════════════════════╗
║ People                                         ║
║ People strategic priorities                    ║
║                                                 ║
║ ┌──────────────────────────────────────────┐  ║
║ │ 🟦 Aspiration                            │  ║
║ │ Empower clinicians with unified digital  │  ║
║ │ tools that reduce administrative burden  │  ║
║ └──────────────────────────────────────────┘  ║
╚════════════════════════════════════════════════╝
```

## Component Architecture

### 1. StrategicTable Component
**Location:** `/components/scratchpad/StrategicTable.tsx`

**Props:**
- `title`: Domain name (e.g., "People", "Customer")
- `subtitle`: Description
- `items`: Array of content items
- `onToggle`: Handler for selecting items

**Styling:**
- Aspirations: Blue background
- Opportunities: Green background
- Constraints: Orange background
- Risks: Red background
- Enablers: Purple background

### 2. DesignPrinciples Component
**Location:** `/components/scratchpad/DesignPrinciples.tsx`

**Props:**
- `principles`: Array of principle objects

**Renders:** Colored badge pills with category-based styling

### 3. LinkedIntelligence Component
**Location:** `/components/scratchpad/LinkedIntelligence.tsx`

**Props:**
- `clinical`: Clinical insights
- `strategic`: Strategic insights
- `commercial`: Commercial insights

**Renders:** Sidebar cards with icons and color-coding

### 4. ScoreIndicator Component
**Location:** `/components/scratchpad/ScoreIndicator.tsx`

**Props:**
- `score`: Numeric score
- `label`: Description
- `maxScore`: Maximum value

**Renders:** Circular badge with color based on percentage

## Database Schema

```prisma
model WorkshopScratchpad {
  id                String   @id @default(cuid())
  workshopId        String   @unique
  version           Int      @default(1)

  // Tab content (all stored as JSON)
  execSummary       Json?    // Executive Summary tab
  discoveryOutput   Json?    // Discovery Output tab
  reimagineContent  Json?    // Reimagine tab
  constraintsContent Json?   // Constraints tab
  commercialContent  Json?   // Commercial tab (password protected)
  summaryContent     Json?   // Summary tab

  // Metadata
  commercialPassword String? // Hashed password
  status            ScratchpadStatus @default(DRAFT)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  publishedAt       DateTime?

  workshop Workshop @relation(...)
}

enum ScratchpadStatus {
  DRAFT        // Being edited
  IN_REVIEW    // Ready for review
  PUBLISHED    // Live to stakeholders
}
```

## API Endpoints

### GET `/api/admin/workshops/[id]/scratchpad`
Fetches scratchpad data for display

### POST `/api/admin/workshops/[id]/scratchpad`
Creates new scratchpad

### PATCH `/api/admin/workshops/[id]/scratchpad`
Updates scratchpad content (Save Draft)

### POST `/api/admin/workshops/[id]/scratchpad/publish`
Marks scratchpad as PUBLISHED

### POST `/api/admin/workshops/[id]/scratchpad/verify-commercial`
Verifies password for commercial section

### POST `/api/admin/workshops/[id]/prepare-scratchpad`
**Main AI endpoint** - Organizes workshop data into scratchpad structure

## How to Use

### As Workshop Organizer:

1. **Run Workshop**
   - Conduct live session or discovery interviews
   - Data flows into DREAM platform

2. **Mark Workshop Complete**
   - Change workshop status to COMPLETED

3. **Prepare Scratchpad**
   - Click "Prepare for Scratchpad" button
   - AI organizes all content
   - Downloads JSON for your records

4. **Edit in Scratchpad**
   - Click "Scratchpad" button
   - Review AI-organized content
   - Edit text, reorder items, add notes
   - Click "Save Draft" to save changes

5. **Publish**
   - When satisfied, click "Publish"
   - Content is now ready for web template
   - Status changes to PUBLISHED

### As Developer:

**To populate from agentic data:**
```typescript
// The prepare-scratchpad endpoint does this automatically
const analysis = await analyzeUtteranceAgentically({
  utterance: text,
  speaker: speakerId,
  context: workshopContext
});

// Stores in AgenticAnalysis table
// Then prepare-scratchpad organizes all analyses into scratchpad
```

**To render in custom template:**
```typescript
const scratchpad = await prisma.workshopScratchpad.findUnique({
  where: { workshopId, status: 'PUBLISHED' }
});

// scratchpad.discoveryOutput.sections = array of domains
// scratchpad.discoveryOutput.designPrinciples = badges
// scratchpad.commercialContent = investment data
```

## Current Status

✅ **Completed:**
- Database schema
- API endpoints
- Scratchpad page with 6 tabs
- Discovery Output tab fully built with:
  - Strategic Tables
  - Design Principles
  - Linked Intelligence
  - Score Indicator
- Example data loaded

⏳ **In Progress:**
- Executive Summary tab
- Commercial tab with investment breakdown

📋 **TODO:**
- Reimagine tab
- Constraints tab
- Summary tab
- Make items editable (inline editing)
- Drag-and-drop reordering
- Export to PDF
- Web template integration

## Example Output

See `/Users/andrewhall/Dream_discovery/example-scratchpad-output.json` for full example structure.

## Testing

**View live scratchpad:**
```
http://localhost:3000/admin/workshops/demo-workshop/scratchpad
```

**Load example data via CLI:**
```bash
cd /Users/andrewhall/Dream_discovery
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(await fs.readFile('example-scratchpad-output.json', 'utf-8'));
  await prisma.workshopScratchpad.update({
    where: { workshopId: 'demo-workshop' },
    data: { discoveryOutput: data }
  });
}
main();
"
```
