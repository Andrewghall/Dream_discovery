import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import type { MeetingPlan } from '@/lib/sales/sales-analysis';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workshopId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workshopId } = await params;
    const body = await request.json();
    const { message, chatHistory } = body as {
      message: string;
      chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { organizationId: true, meetingPlan: true, name: true },
    });

    if (!workshop) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && workshop.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plan = (workshop.meetingPlan as MeetingPlan) || {};
    const planContext = buildPlanSnapshot(plan);

    const systemPrompt = `You are a senior sales strategist and meeting coach. You help sales professionals prepare for important sales calls.

CURRENT MEETING PLAN:
${planContext}

Your role:
1. Help the user refine their meeting strategy by asking probing questions
2. Challenge assumptions — if they've missed something, point it out
3. Suggest specific tactics based on the deal stage and customer context
4. Help craft objection responses that sound natural, not scripted
5. Recommend specific questions to ask based on what they know (and don't know)
6. Identify gaps in their preparation and suggest how to fill them
7. Help prioritise — what are the 3 most important things to get right on this call?

Guidelines:
- Be direct and practical — no corporate fluff
- Reference their specific plan details (customer name, deal stage, goals)
- If they haven't filled in a section, ask about it
- Push them to think about the customer's perspective
- Keep responses concise (2-4 paragraphs max unless they ask for detail)
- When suggesting talk tracks, make them conversational, not scripted`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory || []).slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.5,
      max_tokens: 1000,
    });

    const reply = response.choices[0]?.message?.content || 'I couldn\'t generate a response. Please try again.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Error in plan chat:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}

function buildPlanSnapshot(plan: MeetingPlan): string {
  const sections: string[] = [];

  // The Opportunity
  const opp = [
    plan.customerName && `Customer: ${plan.customerName}`,
    plan.industry && `Industry: ${plan.industry}`,
    plan.companySize && `Company Size: ${plan.companySize}`,
    plan.opportunityName && `Opportunity: ${plan.opportunityName}`,
    plan.estimatedValue && `Value: ${plan.estimatedValue}`,
    plan.dealStage && `Stage: ${plan.dealStage}`,
    plan.opportunityOrigin && `Origin: ${plan.opportunityOrigin}`,
  ].filter(Boolean);
  if (opp.length) sections.push(`OPPORTUNITY:\n${opp.join('\n')}`);

  // Why This Meeting
  const why = [
    plan.meetingIntent && `Intent: ${plan.meetingIntent}`,
    plan.meetingTrigger && `Trigger: ${plan.meetingTrigger}`,
    plan.salesProcessPosition && `Process Position: ${plan.salesProcessPosition}`,
    plan.requiredNextStep && `Required Next Step: ${plan.requiredNextStep}`,
  ].filter(Boolean);
  if (why.length) sections.push(`WHY THIS MEETING:\n${why.join('\n')}`);

  // Goals
  const goals = [
    plan.primaryGoal && `Primary: ${plan.primaryGoal}`,
    plan.secondaryGoals && `Secondary: ${plan.secondaryGoals}`,
    plan.endInMind && `End in Mind: ${plan.endInMind}`,
    plan.minimumOutcome && `Minimum: ${plan.minimumOutcome}`,
    plan.definitionOfFailure && `Failure: ${plan.definitionOfFailure}`,
  ].filter(Boolean);
  if (goals.length) sections.push(`GOALS:\n${goals.join('\n')}`);

  // People
  const people = [
    plan.ourAttendees && `Our Team: ${plan.ourAttendees}`,
    plan.theirAttendees && `Their Team: ${plan.theirAttendees}`,
    plan.keyDecisionMaker && `Decision Maker: ${plan.keyDecisionMaker}`,
    plan.keyInfluencer && `Influencer: ${plan.keyInfluencer}`,
    plan.champion && `Champion: ${plan.champion}`,
    plan.blocker && `Blocker: ${plan.blocker}`,
  ].filter(Boolean);
  if (people.length) sections.push(`PEOPLE:\n${people.join('\n')}`);

  // Customer World
  const cust = [
    plan.knownPainPoints && `Pain Points: ${plan.knownPainPoints}`,
    plan.currentSolution && `Current Solution: ${plan.currentSolution}`,
    plan.businessDrivers && `Drivers: ${plan.businessDrivers}`,
    plan.successCriteria && `Success Criteria: ${plan.successCriteria}`,
    plan.budget && `Budget: ${plan.budget}`,
    plan.timeline && `Timeline: ${plan.timeline}`,
  ].filter(Boolean);
  if (cust.length) sections.push(`CUSTOMER:\n${cust.join('\n')}`);

  // Position & Competition
  const pos = [
    plan.solutionsToDiscuss && `Solutions: ${plan.solutionsToDiscuss}`,
    plan.valueProposition && `Value Prop: ${plan.valueProposition}`,
    plan.keyDifferentiators && `Differentiators: ${plan.keyDifferentiators}`,
    plan.knownCompetitors && `Competitors: ${plan.knownCompetitors}`,
  ].filter(Boolean);
  if (pos.length) sections.push(`OUR POSITION:\n${pos.join('\n')}`);

  // Objections
  const obj = [
    plan.anticipatedObjections && `Objections: ${plan.anticipatedObjections}`,
    plan.commonStalls && `Stalls: ${plan.commonStalls}`,
  ].filter(Boolean);
  if (obj.length) sections.push(`OBJECTIONS:\n${obj.join('\n')}`);

  // Questions & Approach
  const qa = [
    plan.discoveryQuestions && `Discovery: ${plan.discoveryQuestions}`,
    plan.qualificationQuestions && `Qualification: ${plan.qualificationQuestions}`,
    plan.keyTalkingPoints && `Talking Points: ${plan.keyTalkingPoints}`,
    plan.closingApproach && `Close: ${plan.closingApproach}`,
  ].filter(Boolean);
  if (qa.length) sections.push(`QUESTIONS & APPROACH:\n${qa.join('\n')}`);

  return sections.length > 0 ? sections.join('\n\n') : 'No plan details entered yet.';
}
