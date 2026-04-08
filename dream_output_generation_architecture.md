
# DREAM Output Generation Architecture

## 1. Purpose

DREAM outputs must **not be static reports**.

They must be **generated dynamically from workshop signals** using agentic analysis.

The system should transform workshop inputs into **Decision Intelligence** by answering:

1. What is actually broken
2. Why it is broken
3. What the future should look like
4. How to get there
5. What impact the transformation will deliver

---

# 2. Core Input Signals

DREAM outputs must be generated from **three input layers**.

## 2.1 Discovery Inputs

Collected before the workshop.

Examples:

- discovery heat maps
- participant survey responses
- journey ratings
- actor contribution weighting

Purpose:

Provides the **initial hypothesis of organisational issues**.

---

## 2.2 Workshop Signals

Captured during DREAM.

Examples:

- hemisphere datapoints
- actor perspectives
- annotations
- classification outputs
- themes
- constraints
- ideas
- journey stage contributions

Purpose:

Captures the **collective intelligence of the organisation**.

---

## 2.3 Context Layer

Provided when the workshop is created.

Examples:

- domain (contact centre, legal, asset management etc)
- workshop objective
- business problem statement
- transformation scope

Purpose:

Determines **which output modules should be generated**.

---

# 3. Domain Detection

When the workshop finishes, the system must determine:

- domain_type
- workshop_objective
- transformation_scope

Example domains:

- Contact Centre
- Legal Services
- Asset Management
- Customer Experience
- Operations
- Compliance

This determines **which domain output modules are activated**.

---

# 4. Output Generation Pipeline

Outputs should be generated using a **five stage analysis pipeline**.

1. Discovery Validation
2. Root Cause Intelligence
3. Future State Design
4. Execution Roadmap
5. Strategic Impact

Each stage produces **structured outputs and visualisations**.

---

# 5. Discovery Validation Engine

Compare **discovery signals vs workshop findings**.

Inputs:

- discovery heat map
- workshop datapoints
- journey stage signals
- actor contributions

Outputs:

- validated heat map
- delta analysis
- confirmed vs new issues

Example outputs:

- Discovery Issue → Confirmed
- Discovery Issue → Reduced importance
- Discovery Issue → Not supported
- New Issue → Identified during workshop

Purpose:

Shows whether **the workshop confirmed the discovery hypothesis**.

---

# 6. Root Cause Intelligence Engine

The system must analyse signals to determine **true drivers of problems**.

Inputs:

- datapoint classification
- journey stages
- actor signals
- constraints

Process:

- cluster datapoints
- detect friction points
- rank root causes
- map to journey stages

Outputs:

- ranked root causes
- friction heat maps
- actor impact mapping

Purpose:

Move from **symptoms to systemic causes**.

---

# 7. Future State Design Engine

This stage transforms **creative workshop signals** into a **coherent target operating model**.

Inputs:

- creative ideas
- redesign signals
- actor contributions
- constraints

Outputs:

- redesigned journey
- AI + human interaction model
- operating model changes

Visual outputs may include:

- future journey map
- interaction diagrams
- capability model

Purpose:

Define **what the organisation should become**.

---

# 8. Execution Roadmap Engine

Convert the future state into **phased transformation**.

Standard phases:

- Phase 1 — Immediate enablement
- Phase 2 — Structural transformation
- Phase 3 — Advanced automation / optimisation

Outputs:

For each phase:

- initiatives
- capabilities required
- dependencies
- constraints

Purpose:

Turn **vision into delivery**.

---

# 9. Strategic Impact Engine

Quantify the transformation impact.

Possible metrics:

- cost efficiency
- automation potential
- experience improvements
- operational improvements
- risk reduction

Outputs example:

- Automation Potential
- AI Assisted Work
- Human Only Work
- Operational Efficiency Gains
- Experience Improvements

Purpose:

Support **business case creation**.

---

# 10. Domain-Specific Output Modules

After the core outputs are generated, the system loads **domain modules**.

---

# Contact Centre Module

Additional analysis:

### Contact Driver Analysis

Outputs:

- top contact drivers
- repeat contact causes
- journey breakdown points

### Operational Pressure Mapping

Outputs:

- queue stress
- volume spikes
- failure points

### Workforce Model

Tasks classified as:

- AI Only
- AI Assisted
- Human Only

### Contact Centre Future Model

Outputs:

- AI agent interactions
- human escalation points
- supervisor intervention points

---

# Legal / LSAC Module

Additional analysis:

### Legal Task Classification

Tasks categorised as:

- AI Only
- AI Assisted
- Human Only

### Workload Offset Model

Outputs:

Estimated:

- % automated
- % AI assisted
- % human retained

### Legal Workflow Redesign

Outputs:

- chatbot triage
- automated responses
- legal escalation

### Automation Roadmap

Example:

Phase 1
AI triage

Phase 2
assisted responses

Phase 3
autonomous case handling

---

# 11. Visualisation Layer

Outputs must produce **dynamic visuals**, not static summaries.

Examples:

- heat maps
- root cause rankings
- journey redesign diagrams
- automation classification charts
- roadmap timelines

---

# 12. Agentic Output Logic

The system must generate outputs using this logic:

- detect_domain()
- detect_workshop_objective()
- analyse_discovery_inputs()
- analyse_workshop_signals()
- generate_root_cause_analysis()
- generate_future_state()
- generate_execution_roadmap()
- generate_strategic_impact()
- load_domain_specific_modules()
- render_visualisations()

---

# 13. Key Principle

DREAM outputs must **feel like strategic intelligence**, not a workshop report.

The system must answer:

- What is broken
- Why it is broken
- What the future should look like
- How to get there
- What value it creates
