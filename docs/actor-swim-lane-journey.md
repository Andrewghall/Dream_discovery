# Progressive Actor Swim-Lane Journey on Live Page

## Context

The live page (`/admin/workshops/[id]/live/page.tsx`) now extracts business actors and their interactions from every utterance via the agentic analysis pipeline. Actors data arrives via SSE `agentic.analyzed` events and is stored on each node's `agenticAnalysis.actors` array. However, **there is no visual rendering** of this data on the live page.

The user wants a **swim-lane journey map** that builds progressively in real-time as the workshop unfolds. Based on the reference diagram, this is:

- **Horizontal stages** across the top (journey phases extracted from the conversation)
- **Vertical swim lanes** for each actor (Customer, Agent, Executive, System, etc.)
- **Cards at intersections** showing what happens at each stage for each actor
- **Colour-coded by sentiment/criticality** (green=positive, amber=concerned, red=critical/frustrated)
- **Barriers/blockers** identified at stage transitions
- **Progressive** -- new actors, stages, and interactions appear as utterances arrive

## Design

### Location on the live page

Add a new **collapsible Card** in the right column (split view) or stacked section (facilitator view), placed **after the Pressure Points card** and **before the Workboard card**. This is the natural spot -- it sits between "what's blocking" and "what's happening".

The card has a collapse/expand toggle button. Default: **collapsed** (to avoid overwhelming a new session). Auto-expands once 3+ actor interactions have been detected.

### Data model (client-side, computed from nodesById)

Computed via `useMemo` from `nodesById`:

```typescript
type AggregatedActor = {
  name: string;                    // normalised: "Customer", "Agent"
  roles: Set<string>;              // collected role descriptions
  mentionCount: number;
  sentiments: string[];            // all sentiments seen
  dominantSentiment: string;       // most frequent
};

type AggregatedInteraction = {
  fromActor: string;
  toActor: string;
  action: string;
  sentiment: string;
  context: string;
  utteranceId: string;             // dataPointId for linking back
};

type JourneyStage = {
  label: string;                   // e.g., "Initial Contact", "Assessment", "Escalation"
  orderIndex: number;
  interactions: AggregatedInteraction[];
};
```

### Stage inference (client-side, no GPT call)

Since this runs live, we can't call GPT per-update. Instead, stages are inferred from interaction patterns:

1. **Stage extraction from action verbs**: Group interactions by their action semantics:
   - "contacts", "calls", "reaches out" --> **Contact**
   - "assesses", "reviews", "evaluates" --> **Assessment**
   - "escalates", "transfers", "hands off" --> **Escalation**
   - "approves", "decides", "authorises" --> **Decision**
   - "resolves", "completes", "delivers" --> **Resolution**
   - "follows up", "monitors", "checks" --> **Follow-up**
   - Everything else --> **Processing** (catch-all)

2. **Temporal ordering**: Stages are ordered by first appearance (chronological as the workshop progresses)

3. **Progressive addition**: New stages appear as new interaction types are detected

### Swim-lane rendering

```
+-------------------------------------------------------------+
| Actor Journey Map                          [v Collapse]      |
| 4 actors . 12 interactions . 5 stages                        |
+---------+----------+----------+----------+----------+--------+
|         | Contact  | Assess   | Escalate | Decision |Resolve |
+---------+----------+----------+----------+----------+--------+
|Customer | [card]   | [card]   |          |          | [card] |
|         |"calls    |"repeats  |          |          |"gets   |
|         | agent"   | issue"   |          |          |update" |
+---------+----------+----------+----------+----------+--------+
| Agent   | [card]   | [card]   | [card]   |          |        |
|         |"receives |"lacks    |"escalates|          |        |
|         | call"    | context" | to exec" |          |        |
+---------+----------+----------+----------+----------+--------+
|Executive|          |          |          | [card]   |        |
|         |          |          |          |"delayed  |        |
|         |          |          |          | approval"|        |
+---------+----------+----------+----------+----------+--------+
| System  |          | [card]   |          |          | [card] |
|         |          |"no CRM   |          |          |"sends  |
|         |          | link"    |          |          | email" |
+---------+----------+----------+----------+----------+--------+
Cards colour: green bg = positive/smooth, amber bg = concerned/delayed, red bg = frustrated/critical
Empty cells = actor not involved at that stage
```

### Card colour mapping

```typescript
function sentimentColor(sentiment: string): string {
  const s = sentiment.toLowerCase();
  if (s.includes('frustrat') || s.includes('critical') || s.includes('angry') || s.includes('blocked'))
    return 'bg-red-900/40 border-red-500/50 text-red-200';
  if (s.includes('concern') || s.includes('delay') || s.includes('slow') || s.includes('confused') || s.includes('unclear'))
    return 'bg-amber-900/40 border-amber-500/50 text-amber-200';
  if (s.includes('smooth') || s.includes('positive') || s.includes('empower') || s.includes('efficient') || s.includes('good'))
    return 'bg-emerald-900/40 border-emerald-500/50 text-emerald-200';
  return 'bg-zinc-800/60 border-zinc-600/50 text-zinc-300'; // neutral
}
```

### Progressive updates

The swim-lane recomputes on every `nodesById` change (via `useMemo`). As new utterances arrive:
1. New actors appear as new swim lanes
2. New interaction types create new stage columns
3. New cards fill in the grid
4. The card animates in with a brief highlight (CSS transition)

### Summary strip at the top of the card

```
4 actors . 12 interactions . 5 stages
Dominant sentiment: [====] concerned (58%) [==] critical (25%) [=] smooth (17%)
```

### Actor column (left side)

Each actor row header shows:
- Actor name
- Mention count badge
- Tiny sentiment bar (proportional coloured segments)

## Implementation Steps

### Step 1: Add actor aggregation useMemo

**File:** `app/admin/workshops/[id]/live/page.tsx`

After the existing `workboard` useMemo, add a new `actorJourney` useMemo that:
- Iterates all nodes in `nodesById`
- Collects all actors and their interactions from `node.agenticAnalysis?.actors`
- Normalises actor names (capitalise first letter)
- Deduplicates actors by name
- Infers stages from action verbs
- Returns `{ actors, interactions, stages, totalInteractions }`

### Step 2: Add collapsible state

```typescript
const [actorJourneyExpanded, setActorJourneyExpanded] = useState(false);
```

Auto-expand effect:
```typescript
useEffect(() => {
  if (!actorJourneyExpanded && actorJourney.totalInteractions >= 3) {
    setActorJourneyExpanded(true);
  }
}, [actorJourney.totalInteractions]);
```

### Step 3: Add the swim-lane Card component

**Location:** After Pressure Points card, before Workboard card.

Renders:
1. Card header with title, stats summary, collapse toggle
2. When expanded: horizontal-scrollable swim-lane grid
3. Stage headers row
4. Actor swim lane rows with intersection cards
5. Summary sentiment strip

### Step 4: Stage inference helper

Helper function `inferStage(action: string): string` that maps action verbs to stage labels using keyword matching (no GPT needed).

### Step 5: Include actors in snapshot payload

The snapshot save already includes `nodesById` which contains `agenticAnalysis.actors` -- **no change needed**. The actor journey data is derived from the existing saved state.

## Files to Modify

| File | Change |
|------|--------|
| `app/admin/workshops/[id]/live/page.tsx` | Add `actorJourney` useMemo, expand state, swim-lane Card after Pressure Points |

**Single file change.** All logic is client-side, computed from existing `nodesById` state.

## Verification

1. Start a live capture and speak about business actors interacting
2. Watch for `[Agentic Analysis Received]` console logs with actors data
3. Once 3+ interactions detected, Actor Journey Map card auto-expands
4. Swim lanes show actors as rows, stages as columns
5. Cards at intersections show action + context, colour-coded by sentiment
6. New utterances lead to new cards animating in, new stages/actors appear
7. Collapse/expand toggle works
8. Save snapshot, reload, actor journey recomputes from loaded state
