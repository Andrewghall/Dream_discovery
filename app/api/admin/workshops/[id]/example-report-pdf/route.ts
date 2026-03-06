/**
 * GET /api/admin/workshops/[id]/example-report-pdf
 *
 * Generates and returns a sample discovery report PDF, showing participants
 * exactly what they will receive once they complete the questionnaire.
 *
 * The data is entirely illustrative — no real session data is used.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { generateDiscoveryReportPdf } from '@/lib/pdf/discovery-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Sample report data ────────────────────────────────────────────────────────

const EXAMPLE_REPORT = {
  participantName: 'Example Participant',
  executiveSummary:
    `This participant demonstrates a clear-eyed understanding of current operational constraints, particularly around manual handoffs between customer-facing teams and back-office processing. They describe a fragmented technology landscape where multiple systems exist in parallel but rarely share data in real time, leading to repeated data entry and frequent reconciliation rework.\n\nThe participant expresses genuine optimism about what automation could deliver, placing ambition scores consistently above 7 across all dimensions. However, they temper this with pragmatic concern around regulatory readiness and change fatigue within the organisation, noting that previous digital initiatives have stalled at the implementation stage. Their responses suggest a workforce that is willing but under-equipped, with skills gaps concentrated in data literacy and process design.`,
  tone: 'optimistic',
  feedback:
    `Thank you for your thoughtful and detailed responses. Your perspective on the gap between current capability and your desired future state is valuable — the tensions you have identified between digital ambition and implementation readiness are widely shared across the sector and will enrich the collective picture. The specific examples you provided around customer handoff friction and data duplication will be particularly useful in shaping the workshop's reimagined journey.`,
  inputQuality: {
    score: 82,
    label: 'high' as const,
    rationale:
      'Responses were detailed and grounded in specific operational examples. The participant provided concrete process descriptions, named specific friction points, and supported their maturity ratings with clear reasoning. Minor deductions for the regulation section where answers were briefer and more general.',
  },
  keyInsights: [
    {
      title: 'Manual handoffs are the primary source of customer friction',
      insight:
        'The participant identifies handoffs between departments — particularly between front-line customer service and back-office fulfilment — as the root cause of most delays and errors. This is not a technology gap but a process design and accountability gap.',
      confidence: 'high' as const,
      evidence: [
        'Every time a case moves between teams we basically start again — the next person has no context so they call the customer again.',
        'We have the data, it\'s just in three different places and nobody owns making sure they match.',
      ],
    },
    {
      title: 'Change fatigue is a significant adoption risk',
      insight:
        'Previous transformation initiatives have left the team sceptical. The participant notes a pattern of tools being introduced without sufficient training or follow-through, creating a "initiative graveyard" that dampens enthusiasm for new technology.',
      confidence: 'high' as const,
      evidence: [
        'We\'ve had three new systems in four years. Each one was going to fix everything. None of them did.',
        'People just work around them. They keep the spreadsheet going because they don\'t trust the system.',
      ],
    },
    {
      title: 'Data literacy is a foundational skills gap',
      insight:
        'The participant repeatedly returns to the inability of staff to interpret and act on data that is technically available. The problem is not data access but the skills and culture to use it effectively in day-to-day decisions.',
      confidence: 'medium' as const,
      evidence: [
        'The dashboard is there but honestly most of the team don\'t look at it. They don\'t really know what they\'re looking at.',
        'If you asked someone to pull a report they could do it, but knowing what to do with it afterwards — that\'s the hard bit.',
      ],
    },
    {
      title: 'Regulation is perceived as a barrier rather than a framework',
      insight:
        'Compliance requirements are seen as constraints on innovation rather than as a design input. This framing means regulatory considerations are introduced late in process design, creating rework.',
      confidence: 'medium' as const,
      evidence: [
        'Legal always comes in at the end and changes things. It would be better if they were involved earlier but that\'s not how it works here.',
      ],
    },
  ],
  phaseInsights: [
    {
      phase: 'people',
      currentScore: 5,
      targetScore: 8,
      projectedScore: 6,
      strengths: [
        'Experienced frontline team with deep institutional knowledge',
        'Strong customer empathy — staff genuinely care about outcomes',
        'Informal knowledge-sharing networks function well despite structural gaps',
      ],
      working: [
        'Team collaboration within individual departments is effective',
        'Escalation paths are well understood',
      ],
      gaps: [
        'Data literacy and analytical skills are underdeveloped across most roles',
        'Process design skills absent — no one formally owns end-to-end workflows',
        'Manager capability to coach and develop staff is inconsistent',
      ],
      painPoints: [
        'Staff spend significant time on manual data reconciliation',
        'Knowledge is siloed — key expertise sits with specific individuals with no succession plan',
      ],
      frictions: [
        'Onboarding for new starters takes 3–4 months before they are fully productive',
        'Training catalogue is outdated and not relevant to current tools',
      ],
      barriers: ['No budget allocated for L&D in current financial year'],
      constraint: ['Union agreement limits scope of role redesign without lengthy consultation'],
      future: [
        'AI-assisted decision support for complex case handling',
        'Cross-functional "pod" working model with shared accountability for end-to-end outcomes',
      ],
      support: [
        'Digital skills bootcamp programme',
        'Dedicated change management resource for transformation programmes',
      ],
    },
    {
      phase: 'corporate',
      currentScore: 4,
      targetScore: 7,
      projectedScore: 5,
      strengths: [
        'Leadership team is aligned on the need for change',
        'Clear strategic direction communicated from the top',
      ],
      working: [
        'Monthly cross-functional forums provide some coordination',
        'Budget approval process is reasonably fast for operational spend',
      ],
      gaps: [
        'Accountability for cross-departmental outcomes is unclear',
        'Decision-making is slow for anything requiring sign-off above team manager level',
        'Change management capability is thin — initiatives are often under-resourced for adoption',
      ],
      painPoints: [
        'Projects regularly stall waiting for governance approvals',
        'Ownership disputes between departments create work duplication',
      ],
      frictions: ['Multiple reporting lines create ambiguity about priorities'],
      barriers: [
        'Annual budgeting cycle prevents agile funding of emerging needs',
        'Risk-averse culture means experimentation is not rewarded',
      ],
      constraint: ['Outsourcing contract with key vendor limits ability to change certain processes'],
      future: [
        'Product-owner model for core customer journeys spanning all departments',
        'Fast-track approval pathway for low-risk digital experiments',
      ],
      support: [
        'External organisational design expertise',
        'Executive sponsorship programme for transformation initiatives',
      ],
    },
    {
      phase: 'customer',
      currentScore: 6,
      targetScore: 9,
      projectedScore: 7,
      strengths: [
        'High customer satisfaction scores for face-to-face and phone interactions',
        'Staff are empowered to resolve most issues on first contact',
        'Clear escalation path for complex cases',
      ],
      working: [
        'Complaint handling process is well-defined and consistently followed',
        'Customer feedback mechanisms are in place and reviewed monthly',
      ],
      gaps: [
        'Digital self-service channel is underdeveloped — most customers still prefer phone',
        'Customer journey is not mapped end-to-end — no single view of the experience',
        'Proactive communication to customers is limited — most contact is reactive',
      ],
      painPoints: [
        'Customers repeat themselves when transferred between departments',
        'Long wait times during peak periods damage satisfaction scores',
        'No real-time visibility of where a case is in the process',
      ],
      frictions: ['CRM does not integrate with fulfilment system — agents switch between two screens'],
      barriers: ['Legacy CRM cannot be replaced until broader technology programme is funded'],
      constraint: [],
      future: [
        'Real-time case tracking visible to both customers and agents',
        'Proactive AI-generated updates sent to customers at key journey milestones',
        'Single 360-degree view of the customer across all touchpoints',
      ],
      support: ['CRM upgrade investment', 'Customer journey mapping expertise'],
    },
    {
      phase: 'technology',
      currentScore: 4,
      targetScore: 8,
      projectedScore: 5,
      strengths: [
        'Core infrastructure is stable and reliable',
        'IT support team is responsive and well-regarded by the business',
      ],
      working: ['Cloud migration is underway for some workloads', 'Cybersecurity posture has improved significantly'],
      gaps: [
        'Technology estate is fragmented — 14 separate systems identified for core operations',
        'No data integration layer — point-to-point integrations are brittle and expensive to maintain',
        'AI and automation capabilities are absent — no proofs-of-concept have been run',
      ],
      painPoints: [
        'Significant manual data re-entry between systems — estimated at 3.5 hours per agent per week',
        'Reporting requires manual extraction and manipulation in Excel',
      ],
      frictions: [
        'IT change management process takes an average of 6 weeks for even minor changes',
        'Shadow IT is prevalent — teams maintain their own spreadsheets and databases',
      ],
      barriers: ['Core ERP system is end-of-life but replacement is not yet funded'],
      constraint: [
        'Data residency requirements limit use of some cloud-native AI services',
        'Legacy system vendor has restrictive API access policy',
      ],
      future: [
        'Unified integration platform connecting all operational systems',
        'AI agent handling routine customer queries end-to-end without human intervention',
        'Real-time analytics dashboard accessible to all customer-facing staff',
      ],
      support: [
        'Technology strategy and architecture review',
        'Proof-of-concept funding for two AI automation pilots',
      ],
    },
    {
      phase: 'regulation',
      currentScore: 6,
      targetScore: 7,
      projectedScore: 6,
      strengths: [
        'Compliance team is experienced and well-resourced',
        'Good track record with regulatory audits',
      ],
      working: ['GDPR processes are mature and consistently applied', 'Training on regulatory requirements is mandatory and well-attended'],
      gaps: [
        'Regulatory requirements are not embedded into process design — compliance is a final check rather than a design input',
        'AI and automation regulation landscape is not well understood at leadership level',
      ],
      painPoints: ['Late-stage compliance reviews frequently require process redesign', 'Documentation burden is high and largely manual'],
      frictions: ['Legal and compliance teams are not embedded in project teams — they review at the end'],
      barriers: [],
      constraint: ['Sector-specific regulation limits automation of certain customer-facing decisions'],
      future: ['Compliance-by-design embedded into all process and technology change from the outset'],
      support: ['Regulatory horizon scanning — particularly for AI and automated decision-making legislation'],
    },
  ],
  wordCloudThemes: [
    { text: 'data', value: 18 },
    { text: 'handoffs', value: 15 },
    { text: 'manual', value: 14 },
    { text: 'training', value: 12 },
    { text: 'automation', value: 11 },
    { text: 'customer', value: 10 },
    { text: 'integration', value: 9 },
    { text: 'skills', value: 9 },
    { text: 'compliance', value: 8 },
    { text: 'silos', value: 8 },
    { text: 'legacy', value: 7 },
    { text: 'accountability', value: 7 },
    { text: 'change', value: 6 },
    { text: 'process', value: 6 },
    { text: 'visibility', value: 6 },
    { text: 'real-time', value: 5 },
    { text: 'AI', value: 5 },
    { text: 'rework', value: 5 },
    { text: 'empathy', value: 4 },
    { text: 'governance', value: 4 },
    { text: 'ownership', value: 4 },
    { text: 'reporting', value: 3 },
    { text: 'friction', value: 3 },
    { text: 'culture', value: 3 },
    { text: 'collaboration', value: 3 },
  ],
};

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workshopId } = await params;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Pull the workshop name so the example PDF feels relevant
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true },
    });

    const pdfBuffer = await generateDiscoveryReportPdf({
      ...EXAMPLE_REPORT,
      workshopName: workshop?.name ?? 'DREAM Discovery',
      discoveryUrl: '',
      orgName: 'DREAM Discovery',
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="example-discovery-report.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to generate example report PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate example report PDF' },
      { status: 500 },
    );
  }
}
