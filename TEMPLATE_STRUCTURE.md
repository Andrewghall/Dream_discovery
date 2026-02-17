# DREAM Workshop Output Template Structure

## Overview
The DREAM methodology uses 5 core lenses to analyze and transform organizations:

1. **Customer** 👥 - Customer experience, needs, pain points
2. **Client** 🏢 - The organization itself, business model, operations
3. **Organisation** 🔄 - People, culture, change management
4. **Technology** 💻 - Technical architecture, systems, integrations
5. **Regulator** ⚖️ - Compliance, regulatory constraints, legal requirements

## Template Philosophy

**The template is a reusable shell** - all headings, layout, structure, generic images, and accordion components remain **exactly the same** across all workshops. Only the workshop-specific data (participant names, quotes, metrics, client name) gets replaced.

Based on the PAM Wellness design, this template uses elegant accordion-based layouts that expand/collapse sections - no "puking words onto the page."

---

## Header (Generic - Never Changes)

```
[Back Button] | [Upstream Works Logo] | [Action Buttons →]
```

**Action Buttons:**
- 📋 Load Empty Template
- 🎯 Load Demo Data
- 🔒 Set Commercial Password
- 💾 Save Draft
- 👁️ Publish
- ⬇️ Download for Client

---

## Navigation Tabs (Generic Structure - Never Changes)

1. **Discovery Summary**
2. **Reimagine Output**
3. **Constraints**
4. **Solution Overview**
5. **🔒 Commercial** (password protected)
6. **Summary**

---

## Tab 1: Discovery Summary

### Section A: Executive Summary

**Generic Structure (stays same):**
- Hero card with workshop title and overview (gradient blue background)
- 4 metric cards in a grid
- Key findings accordion (collapsible by category with impact badges)

**What Changes Per Workshop:**
- Workshop title
- Overview text
- Metric numbers (participants, domains, insights, transformational ideas)
- Finding titles, descriptions, and impact levels

---

### Section B: Discovery Output

**Generic Structure (stays same):**

**Overview Stats (4 cards):**
- 👥 Participants
- 💬 Insights Captured
- 🧠 Perspectives (5 DREAM lenses)
- 📈 Alignment (consensus %)

**5 Domain Accordions (same structure for all workshops):**
Each accordion has:
- Icon + Domain name + Insight count + Top themes
- When expanded:
  - **Word Cloud** - varying text sizes based on frequency
  - **Representative Quotes** - with participant attribution
  - **Sentiment Distribution** - visual bar (concerned/neutral/optimistic)

**5 DREAM Lenses (ALWAYS these 5):**
1. 👥 Customer (blue)
2. 🏢 Client (green)
3. 🔄 Organisation (indigo)
4. 💻 Technology (orange)
5. ⚖️ Regulator (purple)

**Spider Diagram Placeholder** - shows consensus levels across domains

**What Changes Per Workshop:**
- Number of participants
- Total insights captured
- Consensus percentage
- Word clouds (different words and sizes per domain)
- Participant quotes (names and text)
- Sentiment percentages
- Top themes per domain

---

## Tab 2: Reimagine Output

**Generic Structure (stays same):**

### Three Houses Framework (Accordions)

**House 1: The Old House 🏚️ (Red)**
- Image: `/PAMWellness/house-old.png`
- Title: "The Old House"
- Subtitle: "Today's Constrained Way"
- Description: The Noisy, Cluttered Present
- Bullet points about constraints (stays same)

**House 2: The Refreshed House 🏠 (Orange)**
- Image: `/PAMWellness/house-refreshed.png`
- Title: "The Refreshed House"
- Subtitle: "Small Incremental Steps"
- Description: The Trap of Small Fixes
- Bullet points about incremental changes (stays same)

**House 3: The Ideal House 🏡 (Green)**
- Image: `/PAMWellness/house-ideal.png`
- Title: "The Ideal House"
- Subtitle: "Transformational Reimagination"
- Description: The Vision of What Could Be
- Bullet points about transformation (stays same)

**What Changes Per Workshop:**
- Nothing! This section is 100% generic template

---

## Tab 3: Constraints

**Generic Structure (stays same):**

4 constraint category accordions:
1. 🛡️ Regulatory Constraints
2. 💻 Technical Constraints
3. 💰 Commercial Constraints
4. 👥 Organizational Constraints

Each constraint shows:
- Title
- Impact badge (Critical/High/Medium/Low)
- Description
- Mitigation strategy

**What Changes Per Workshop:**
- Specific constraints identified
- Impact levels
- Mitigation strategies

---

## Tab 4: Solution Overview

**Generic Structure (stays same):**
- Heading: "Solution Overview"
- Subtitle: "High-level solution architecture and approach"
- Placeholder for synthesized content

**What Changes Per Workshop:**
- Solution description content

---

## Tab 5: Commercial (Password Protected)

**Generic Structure (stays same):**

**Investment Summary (4 cards always visible):**
- 💰 Total Investment
- 📈 5-Year ROI
- 📅 Payback Period
- 💵 Annual Savings

**Delivery Phases (accordion)**
- Phase 1, 2, 3... with scope and outcomes

**Risk Assessment (accordion)**
- Risks with probability, impact, and mitigation

**What Changes Per Workshop:**
- All numbers and values
- Phase descriptions
- Identified risks

---

## Tab 6: Summary

**Generic Structure (stays same):**

**Key Findings (accordion by category)**
- Each category has multiple insights

**Recommended Next Steps (numbered 1-4)**
- Step name
- Timeline badge
- Owner
- Actions list

**Success Metrics (grid of cards)**
- Metric name
- Baseline value
- Target value
- Measurement approach

**What Changes Per Workshop:**
- All content - findings, steps, metrics, timelines

---

## Data Structure

### Empty Template (`empty-template-data.ts`)
Contains the structure with empty arrays and zero values, ready to be populated by AI-generated workshop synthesis.

### Demo Data (`travel-contact-centre-data.ts`)
Example of a fully populated workshop for TravelWise Contact Centre Transformation - shows how real data fills the template.

---

## Future AI Integration Workflow

1. **Workshop Recording** → CaptureAPI captures all audio
2. **AI Processing** → Agent synthesizes across 5 DREAM lenses
3. **Generate Structure** → AI creates JSON matching template schema
4. **Populate Template** → Click button to load AI output into template
5. **Review & Edit** → Human refines content
6. **Export** → Download branded HTML for client delivery

---

## Key Design Principles

✅ **Template is generic** - headings, layout, images never change
✅ **Accordion-based** - elegant, expandable sections (PAM Wellness style)
✅ **5 DREAM lenses always present** - Customer, Client, Organisation, Technology, Regulator
✅ **Client-friendly language** - "Insights" not "Utterances", "Alignment" not "Consensus"
✅ **Reusable** - same template for every workshop, only data changes
✅ **AI-ready** - designed to accept long-form synthesis output from AI processing
