/**
 * Targeted question refinements — selective edits only.
 * Fixes: near-identical surface/depth pairs, repeated edge shapes,
 * generic Reimagine language, solution-jumping in Define Approach.
 */
import { prisma } from '@/lib/prisma';

const WORKSHOPS = [
  { id: 'cmoabyrde0004xuzp8vqykhdh', name: 'Aer Lingus' },
  { id: 'cmoahj3dl000gxuzpu79zhiph', name: 'Marks and Spencer' },
  { id: 'cmoahaplf000exuzp47ys1j4q', name: 'easyJet' },
  { id: 'cmoah4o9s000cxuzpyqrlbv2i', name: 'Bupa' },
  { id: 'cmoagr0vu000axuzp7b5db2r6', name: 'Lloyds Banking Group' },
  { id: 'cmoagjf2h0008xuzprn4yhey4', name: 'Tesco' },
];

type QuestionUpdate = {
  phase: string;
  lens: string;
  depth: string;
  newText: string;
};

// Map: workshopId -> list of updates
const UPDATES: Record<string, QuestionUpdate[]> = {
  // ─── AER LINGUS ───────────────────────────────────────────────────────────
  cmoabyrde0004xuzp8vqykhdh: [
    // REIMAGINE — remove "most ambitious" language
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'edge',
      newText: "What would Aer Lingus have to stop doing entirely to deliver the customer experience we've just described?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'edge',
      newText: "What partnership arrangement would feel too uncomfortable to propose in this room — and why is that the one worth naming?",
    },
    // CONSTRAINTS — fix near-identical surface/depth pairs
    {
      phase: 'CONSTRAINTS', lens: 'Technology', depth: 'depth',
      newText: "When a technology problem surfaces mid-operation, who absorbs the impact first — and what do they have to do to work around it?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Operations', depth: 'depth',
      newText: "Which operational constraint has come up most recently — and when it did, who was left dealing with the fallout?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Partners', depth: 'depth',
      newText: "When a partner collaboration breaks down, who ends up carrying the problem day-to-day — and how visible is that to the wider team?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Commercial', depth: 'depth',
      newText: "When a customer expectation isn't met, who hears about it first — and what typically happens next?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'People', depth: 'depth',
      newText: "When staff can't serve customers the way they'd like to, what workarounds do they reach for — and how long has that been the norm?",
    },
    // DEFINE_APPROACH — surface: away from solution-jumping
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'surface',
      newText: "Before we talk about what needs to change — what's already working in operations that this approach could be built on?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'surface',
      newText: "What are staff already doing with the current technology that gets closest to the experience we're describing?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'surface',
      newText: "Which customer interactions are already closest to the standard we're aiming for — and what's making those work?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'surface',
      newText: "Where does compliance already enable rather than block good service here — and what can we learn from those moments?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'surface',
      newText: "Which partner relationship already operates closest to the way we need — and what makes that one different?",
    },
    // DEFINE_APPROACH — edge: vary the repeated "hardest resistance" shape
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'edge',
      newText: "Which part of this operational plan is most likely to get quietly shelved when the next pressure hits?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'edge',
      newText: "What does a half-implemented version of these technology changes look like — and would it leave us in a worse position than today?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'edge',
      newText: "What are we not saying in this room about the commercial approach that would make it more honest?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'edge',
      newText: "Who benefits from compliance staying complicated here — and how does that shape what we're about to propose?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'edge',
      newText: "What would our partners say about this plan if they were in the room right now?",
    },
  ],

  // ─── MARKS AND SPENCER ────────────────────────────────────────────────────
  cmoahj3dl000gxuzpu79zhiph: [
    // REIMAGINE — generic language
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'edge',
      newText: "What would M&S have to fundamentally stop believing about its customers to build the experience we've just described?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'surface',
      newText: "What would partners genuinely want from M&S that we've never actually delivered?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'edge',
      newText: "Which partner relationship is currently tolerated rather than valued — and what would happen if we named that in this room?",
    },
    // CONSTRAINTS — near-identical depth
    {
      phase: 'CONSTRAINTS', lens: 'People', depth: 'depth',
      newText: "Who in the team ends up absorbing the most pressure when people-related constraints bite — and is that visible to anyone above them?",
    },
    // DEFINE_APPROACH — surface: away from "first concrete step" for every lens
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'surface',
      newText: "What's already working in operations that this approach could extend — rather than replace?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'surface',
      newText: "What are staff already doing with current systems that points toward the direction we need to go?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'surface',
      newText: "Which customer interactions are already closest to the experience we're describing — and what's making those work?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'surface',
      newText: "Where does compliance already enable good service here — and what can we learn from those moments?",
    },
    // DEFINE_APPROACH — edge: vary the repeated "hardest resistance" shape
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'edge',
      newText: "Which part of this operational plan gets quietly dropped when the first real pressure hits?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'edge',
      newText: "What does a partial technology rollout look like here — and would it create more problems than it solves?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'edge',
      newText: "What are we quietly assuming about customers that this plan hasn't actually tested?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'edge',
      newText: "Who has the most to lose from making compliance simpler here — and are they in the room?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'edge',
      newText: "What would our partners say about this plan if they saw it tomorrow?",
    },
  ],

  // ─── EASYJET ──────────────────────────────────────────────────────────────
  cmoahaplf000exuzp47ys1j4q: [
    // REIMAGINE — generic/superlative language
    {
      phase: 'REIMAGINE', lens: 'People', depth: 'edge',
      newText: "What would easyJet have to stop doing — or stop protecting — to genuinely change how customers experience the airline?",
    },
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'edge',
      newText: "What would customers say easyJet has always promised but never quite delivered — and what would it actually take to change that?",
    },
    // CONSTRAINTS — near-identical surface/depth pairs (worst offender)
    {
      phase: 'CONSTRAINTS', lens: 'Risk/Compliance', depth: 'depth',
      newText: "When regulatory requirements clash with operational priorities, who in the team ends up navigating that conflict — and what does it actually cost them?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Partners', depth: 'depth',
      newText: "When a partnership isn't delivering what was expected, how long does it take for that to surface — and who names it first?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Technology', depth: 'depth',
      newText: "When a technology limitation hits a customer-facing process, what does the workaround look like — and who invented it?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Operations', depth: 'depth',
      newText: "When a route decision is delayed or reversed, what's actually happening behind it — and who's most affected by the fallout?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Commercial', depth: 'depth',
      newText: "When targeting efforts miss the mark, how does the team find out — and what's the typical response?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'People', depth: 'depth',
      newText: "When staff training falls short, what does that look like in a real customer interaction — and who notices first?",
    },
    // DEFINE_APPROACH — edge questions were recycled from CONSTRAINTS (identical)
    {
      phase: 'DEFINE_APPROACH', lens: 'People', depth: 'edge',
      newText: "Who on the team will quietly resist this training approach — and what will that look like in practice?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'edge',
      newText: "Which part of this route optimisation plan gets shelved first when commercial pressure hits?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'edge',
      newText: "What does a half-rolled-out version of these technology changes look like — and is that worse than where we are now?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'edge',
      newText: "What assumption about our customers is baked into this plan that we haven't actually tested?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'edge',
      newText: "What does the compliance function say about this plan when it's presented to them — and have we checked?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'edge',
      newText: "Which of our current partners would feel most threatened by this approach — and how might that play out?",
    },
    // DEFINE_APPROACH — surface: vary from "first step / immediate actions"
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'surface',
      newText: "What do we already know about route performance that this plan should be built around?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'surface',
      newText: "What are staff already doing that points toward the technology direction we need to go?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'surface',
      newText: "What do we already know about our best customers that our current targeting isn't acting on?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'surface',
      newText: "Where are we already navigating regulatory requirements well — and what makes those cases different?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'surface',
      newText: "Which existing partnership is already closest to what we need — and what would it take to replicate that?",
    },
  ],

  // ─── BUPA ─────────────────────────────────────────────────────────────────
  cmoah4o9s000cxuzpyqrlbv2i: [
    // REIMAGINE — "ideal world", "ideal future state"
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'surface',
      newText: "How would Bupa's service offerings change if we started from what members actually need rather than what we currently provide?",
    },
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'depth',
      newText: "What would a member's week look like if the service model worked the way we've just described?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'surface',
      newText: "What would partners be doing differently if they were genuinely set up to help Bupa members succeed?",
    },
    // CONSTRAINTS — repeated "What is this X constraint actually protecting" edge shape (5/6 lenses)
    {
      phase: 'CONSTRAINTS', lens: 'Technology', depth: 'edge',
      newText: "What does the team actually gain from working around this technology constraint — and what does that workaround cost that nobody measures?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Operations', depth: 'edge',
      newText: "Who would push back hardest if this operational constraint were removed — and what does that tell us about why it persists?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'Commercial', depth: 'edge',
      newText: "What would have to change commercially before removing this constraint felt safe — and is that change within reach?",
    },
    {
      phase: 'CONSTRAINTS', lens: 'People', depth: 'edge',
      newText: "What does the team that lives with this people constraint say about it in private — and has anyone in leadership heard that?",
    },
    // DEFINE_APPROACH — surface: vary from "first concrete step" repeated
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'surface',
      newText: "What's already working in how Bupa operates today that this approach could be built on?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'surface',
      newText: "What are teams already doing with current technology that gets closest to what we need?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'surface',
      newText: "Where does compliance already work smoothly here — and what's making those cases different from the ones that don't?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'surface',
      newText: "Which partner relationship is already working closest to the way we need — and what can we learn from it?",
    },
    // DEFINE_APPROACH — edge: repeated "half-implemented" shape (5/6 lenses)
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'edge',
      newText: "What are we quietly assuming about commercial performance that this approach hasn't tested?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'edge',
      newText: "Who has the most to lose from this compliance approach working — and have we thought through how they might respond?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'edge',
      newText: "What would Bupa's partners say about this plan if they saw it before it was finalised?",
    },
  ],

  // ─── LLOYDS BANKING GROUP ─────────────────────────────────────────────────
  cmoagr0vu000axuzp7b5db2r6: [
    // REIMAGINE — "perfect", "ideal future", "most radical"
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'surface',
      newText: "If you followed a client through every touchpoint with Lloyds, where would the experience actually feel different — and what would cause that?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'depth',
      newText: "If a partnership was genuinely working well for customers — not just commercially — what would be different about how it operated day-to-day?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'edge',
      newText: "What partnership model would feel too uncomfortable to propose here today — and why is that discomfort worth examining?",
    },
    // DEFINE_APPROACH — surface: all six are "What is the first concrete step..."
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'surface',
      newText: "What's already working well in how operations runs today that this approach could be built around?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'surface',
      newText: "What are teams already doing with current technology that points toward the direction we need?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'surface',
      newText: "Which customer interactions are already landing well commercially — and what's making those work?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'surface',
      newText: "Where does the compliance process already feel proportionate and workable — and what can we learn from those moments?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'surface',
      newText: "Which partnership is already performing closest to what we need — and what would it take to replicate that elsewhere?",
    },
    // DEFINE_APPROACH — depth: all six are "What evidence would indicate... within 90 days"
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'depth',
      newText: "What has to change in how teams hand off work to each other for this to function — and who needs to own that change?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'depth',
      newText: "What does adoption actually look like for a technology change like this — and where have similar efforts stalled before?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'depth',
      newText: "What do commercial teams need to believe about customers for this approach to stick — and is that belief already there?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'depth',
      newText: "Which teams need to work differently together for this compliance change to land — and what's currently stopping them?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'depth',
      newText: "What does a partner need to understand about Lloyds's direction for this to work — and have we actually shared that with them?",
    },
    // DEFINE_APPROACH — edge: all six are "Where might our approach to X quietly fail"
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'edge',
      newText: "Which part of this operational plan gets quietly deprioritised when something more urgent lands?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'edge',
      newText: "What does a half-rolled-out version of this technology approach look like — and is it worse than where we started?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'edge',
      newText: "What are we assuming about how customers will respond to this that we haven't actually tested?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'edge',
      newText: "Who has the most to lose from compliance becoming simpler here — and how might that resistance show up?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'edge',
      newText: "What would our partners say about this approach if they saw it before it was finalised?",
    },
  ],

  // ─── TESCO ────────────────────────────────────────────────────────────────
  cmoagjf2h0008xuzprn4yhey4: [
    // REIMAGINE — "bold steps", "revolutionary", "most trusted"
    {
      phase: 'REIMAGINE', lens: 'People', depth: 'edge',
      newText: "What would Tesco have to stop protecting — in its operations or its culture — to genuinely change the customer experience?",
    },
    {
      phase: 'REIMAGINE', lens: 'Commercial', depth: 'edge',
      newText: "What would Tesco's product range look like if it was built entirely around what customers actually value — rather than what's operationally convenient?",
    },
    {
      phase: 'REIMAGINE', lens: 'Partners', depth: 'edge',
      newText: "What do partners privately think about working with Tesco that nobody says out loud — and what would it take to change that?",
    },
    // CONSTRAINTS — repeated depth shape (Commercial/Risk same as each other)
    {
      phase: 'CONSTRAINTS', lens: 'Commercial', depth: 'depth',
      newText: "When commercial constraints prevent us from matching what customers expect, who hears about it first — and how is it typically resolved?",
    },
    // DEFINE_APPROACH — surface: "What initial steps" repeated across 5 lenses
    {
      phase: 'DEFINE_APPROACH', lens: 'Operations', depth: 'surface',
      newText: "What's already working in how Tesco operations runs that this approach can be built around?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'surface',
      newText: "What are staff already doing with current technology that gets closest to the experience we need to deliver?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'surface',
      newText: "Which commercial decisions are already landing well with customers — and what's driving those?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'surface',
      newText: "Where does compliance already enable smooth service delivery at Tesco — and what makes those moments work?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'surface',
      newText: "Which partner is already working closest to the way we need — and what would it take to replicate that elsewhere?",
    },
    // DEFINE_APPROACH — depth: "What collaborative practices need to be established" repeated 4 lenses
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'depth',
      newText: "What does adoption look like for a technology change at Tesco's scale — and where have similar changes stalled before?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'depth',
      newText: "What do commercial teams need to agree on for this approach to work — and what's currently preventing that alignment?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'depth',
      newText: "Which teams need to work differently together for compliance changes to actually stick — and what's in the way of that?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'depth',
      newText: "What does a partner need to understand about Tesco's direction for this approach to work — and have we actually told them?",
    },
    // DEFINE_APPROACH — edge: "Where might our approach to X quietly fail" repeated 4 lenses
    {
      phase: 'DEFINE_APPROACH', lens: 'Technology', depth: 'edge',
      newText: "What does a half-implemented technology rollout look like at Tesco's scale — and is that better or worse than doing nothing?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Commercial', depth: 'edge',
      newText: "What are we assuming about customer behaviour that this commercial approach depends on — and have we tested that?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Risk/Compliance', depth: 'edge',
      newText: "Who benefits from compliance staying as it is — and how might that resistance show up when this plan is presented?",
    },
    {
      phase: 'DEFINE_APPROACH', lens: 'Partners', depth: 'edge',
      newText: "What would Tesco's partners say about this plan if they saw it before it was finalised?",
    },
  ],
};

async function main() {
  let totalUpdated = 0;
  let totalMissed = 0;

  for (const ws of WORKSHOPS) {
    const updates = UPDATES[ws.id];
    if (!updates?.length) continue;

    const row = await prisma.workshop.findUniqueOrThrow({
      where: { id: ws.id },
      select: { customQuestions: true },
    });

    const cq = row.customQuestions as any;
    let wsUpdated = 0;
    let wsMissed = 0;

    for (const update of updates) {
      const phaseData = cq.phases?.[update.phase];
      if (!phaseData?.questions) {
        console.warn(`  [MISS] ${ws.name} / ${update.phase}: phase not found`);
        wsMissed++;
        continue;
      }

      const question = phaseData.questions.find(
        (q: any) => q.lens === update.lens && q.depth === update.depth
      );

      if (!question) {
        console.warn(`  [MISS] ${ws.name} / ${update.phase} / ${update.lens} / ${update.depth}: question not found`);
        wsMissed++;
        continue;
      }

      const oldText = question.text;
      question.text = update.newText;
      console.log(`  [OK] ${ws.name} / ${update.phase} / ${update.lens} / ${update.depth}`);
      console.log(`       WAS: ${oldText.slice(0, 80)}`);
      console.log(`       NOW: ${update.newText.slice(0, 80)}`);
      wsUpdated++;
    }

    await prisma.workshop.update({
      where: { id: ws.id },
      data: { customQuestions: cq },
    });

    console.log(`\n${ws.name}: ${wsUpdated} updated, ${wsMissed} missed\n`);
    totalUpdated += wsUpdated;
    totalMissed += wsMissed;
  }

  console.log(`\n=== DONE: ${totalUpdated} questions updated, ${totalMissed} missed ===`);
  await prisma.$disconnect();
}

main().catch(console.error);
