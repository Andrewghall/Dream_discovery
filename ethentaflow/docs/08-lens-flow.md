# 08 - Lens Flow

The five lenses are exploration territories, not a script. The system must explore all five over a discovery session, but the order is driven by the conversation.

## The five lenses

1. **People** - team, capability, culture, leadership, capacity.
2. **Commercial** - ICP, proposition, pricing, pipeline, retention.
3. **Partners** - resellers, alliances, ecosystem, partnerships.
4. **Technology** - stack, integration, data, AI readiness.
5. **Operations** - process, delivery, compliance, scale constraints.

A sixth state, `open`, represents the conversation before a lens has been clearly established or after one has closed.

## When to transition

A lens is "done enough to transition" when:
- At least one insight has been extracted at depth 3, AND
- No new signals in that lens have surfaced in the last 2 turns.

OR

- The user has explicitly signaled completion ("I don't think there's more to say on that").

The system should NOT try to fully exhaust a lens before transitioning. Partial depth is fine; diminishing returns matter more than completeness.

## Natural transitions

The probe engine's `transition_lens` strategy is the main transition mechanism. The probe is generated such that it pivots via something the user just said.

Good transition examples:

> User has just described a people capability gap in sales.
> Bad: "Let's talk about technology now."
> Good: "When those capability gaps show up with clients, what does the revenue impact look like?" (people → commercial)

> User has just described a commercial pipeline problem.
> Bad: "Moving on to partners."
> Good: "Have there been partnerships or channels you've tried to shore that up?" (commercial → partners)

The `prompts/probe-generator.md` contains specific instructions and examples for this.

## Forced transitions

If a lens has been open for more than 6 turns without reaching depth 3, force a transition with a meta-probe that acknowledges:

> "This area is clearly layered. Let me come back to it - I want to understand another angle first. [transition probe]"

Mark the lens as `parked` in state. Return to parked lenses if time permits later.

## Lens priority ordering (when nothing specific is driving)

When the state machine needs to select a next lens and the conversation provides no strong signal, priority order is:

1. Whichever lens the user has introduced but not yet explored.
2. Commercial (usually the anchor lens for GTM discovery).
3. People (typically the second-most consequential).
4. Operations.
5. Partners.
6. Technology (often surfaces only when explicitly probed).

This is a tiebreaker, not a script. A user who opens with a tech problem gets technology first.

## Lens coverage in the UI

The debug panel shows a 5-lens coverage widget:

```
PEOPLE       ████░░░░░░ depth 2, 3 insights
COMMERCIAL   ██████████ depth 3, 5 insights (CURRENT)
PARTNERS     ░░░░░░░░░░ untouched
TECHNOLOGY   ██░░░░░░░░ depth 1, 0 insights
OPERATIONS   ██████░░░░ depth 3, 2 insights
```

This helps the operator see session state at a glance. Not end-user UI; debug-mode only.

## Lens scoring

Each lens maintains:

```typescript
interface LensScore {
  coverage: number;          // 0-1, composite of turns and insights
  depthReached: number;      // max depth score achieved in this lens
  insightCount: number;
  lastTouchedAt: number;
  status: 'untouched' | 'active' | 'parked' | 'closed';
}
```

`coverage` formula (intentionally simple):

```
coverage = min(1, (0.2 × turnCount + 0.3 × insightCount + 0.5 × (depthReached / 3)) / 1)
```

A lens reaches coverage = 1 typically after 3-4 substantive turns with at least 1 depth-3 insight.

## Session completion criteria

A discovery session is "complete enough" when:
- At least 3 of 5 lenses have coverage >= 0.6.
- At least 5 insights extracted total.
- Session duration >= 15 minutes.

The system does not end the session automatically. The user decides. The debug panel shows completion status; the operator (Andrew, in a demo) can wrap whenever appropriate.

## Cross-lens insights

Some insights span lenses. Example: "The sales team doesn't have the technical depth to sell the new AI proposition" is both people and commercial and technology.

For v1, tag each insight with a single primary lens. Multi-lens tagging adds complexity that doesn't materially change the output quality. Revisit in v2.
