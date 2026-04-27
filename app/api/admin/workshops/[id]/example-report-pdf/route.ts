/**
 * GET /api/admin/workshops/[id]/example-report-pdf
 *
 * Generates a sample discovery report PDF using the workshop's actual prep
 * lenses (from discoveryQuestions), so the example reflects the exact
 * canonical lens structure participants will experience for this specific workshop.
 *
 * If no discovery questions have been generated yet, falls back to the
 * canonical seven-lens default.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';
import { prisma } from '@/lib/prisma';
import { generateDiscoveryReportPdf } from '@/lib/pdf/discovery-report';
import { CANONICAL_LENSES, canonicalizeLensName } from '@/lib/workshop/canonical-lenses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscoveryLens {
  key: string;
  label: string;
  questions: Array<{ id: string; text: string; tag?: string; purpose?: string }>;
}

interface DiscoveryQuestionSet {
  lenses: DiscoveryLens[];
}

// ── Per-lens example content ──────────────────────────────────────────────────
// Keyed by normalised lens label (lowercase). Provides realistic illustrative
// data for common lenses; unknown lenses get the generic fallback.

const LENS_CONTENT: Record<string, {
  currentScore: number;
  targetScore: number;
  projectedScore: number;
  strengths: string[];
  working: string[];
  gaps: string[];
  painPoints: string[];
  frictions: string[];
  barriers: string[];
  constraint: string[];
  future: string[];
  support: string[];
}> = {
  people: {
    currentScore: 5, targetScore: 8, projectedScore: 6,
    strengths: [
      'Experienced frontline team with deep institutional knowledge',
      'Strong customer empathy — staff genuinely care about outcomes',
      'Informal knowledge-sharing networks function well despite structural gaps',
    ],
    working: ['Collaboration within departments is effective', 'Escalation paths are well understood'],
    gaps: [
      'Data literacy and analytical skills underdeveloped across most roles',
      'Process design skills absent — no one formally owns end-to-end workflows',
      'Manager capability to coach and develop staff is inconsistent',
    ],
    painPoints: [
      'Staff spend significant time on manual data reconciliation',
      'Key expertise sits with specific individuals with no succession plan',
    ],
    frictions: ['Onboarding for new starters takes 3–4 months before full productivity'],
    barriers: ['No budget allocated for L&D in the current financial year'],
    constraint: ['Union agreement limits scope of role redesign without lengthy consultation'],
    future: [
      'AI-assisted decision support for complex case handling',
      'Cross-functional pod model with shared accountability for end-to-end outcomes',
    ],
    support: ['Digital skills bootcamp programme', 'Dedicated change management resource'],
  },

  commercial: {
    currentScore: 6, targetScore: 9, projectedScore: 7,
    strengths: [
      'High satisfaction scores for face-to-face and phone interactions',
      'Staff are empowered to resolve most issues on first contact',
    ],
    working: ['Complaint handling process is well-defined and consistently followed', 'Customer feedback reviewed monthly'],
    gaps: [
      'Digital self-service underdeveloped — most customers still prefer phone',
      'No single end-to-end customer journey map exists',
      'Proactive communication is limited — most contact is reactive',
    ],
    painPoints: [
      'Customers repeat themselves when transferred between departments',
      'Long wait times during peak periods damage satisfaction scores',
    ],
    frictions: ['CRM does not integrate with fulfilment system — agents switch between two screens'],
    barriers: ['Legacy CRM cannot be replaced until broader technology programme is funded'],
    constraint: [],
    future: [
      'Real-time case tracking visible to both customers and agents',
      'Proactive AI-generated updates at key journey milestones',
      'Single 360-degree customer view across all touchpoints',
    ],
    support: ['CRM upgrade investment', 'Customer journey mapping expertise'],
  },

  technology: {
    currentScore: 4, targetScore: 8, projectedScore: 5,
    strengths: ['Core infrastructure is stable and reliable', 'IT support team is responsive and well-regarded'],
    working: ['Cloud migration underway for some workloads', 'Cybersecurity posture has improved significantly'],
    gaps: [
      'Technology estate is fragmented — 14 separate systems for core operations',
      'No data integration layer — point-to-point integrations are brittle and expensive',
      'AI and automation capabilities absent — no proofs-of-concept have been run',
    ],
    painPoints: [
      'Manual data re-entry between systems — estimated 3.5 hours per agent per week',
      'Reporting requires manual extraction and manipulation in spreadsheets',
    ],
    frictions: ['IT change management averages six weeks even for minor changes'],
    barriers: ['Core ERP end-of-life but replacement not yet funded'],
    constraint: ['Data residency requirements limit use of some cloud-native AI services', 'Legacy vendor has restrictive API access policy'],
    future: [
      'Unified integration platform connecting all operational systems',
      'AI agent handling routine queries end-to-end without human intervention',
      'Real-time analytics accessible to all customer-facing staff',
    ],
    support: ['Technology strategy and architecture review', 'Proof-of-concept funding for AI automation pilots'],
  },

  'risk/compliance': {
    currentScore: 6, targetScore: 7, projectedScore: 6,
    strengths: ['Compliance team is experienced and well-resourced', 'Good track record with regulatory audits'],
    working: ['GDPR processes are mature and consistently applied', 'Mandatory regulatory training is well-attended'],
    gaps: [
      'Regulatory requirements not embedded in process design — compliance is a final check rather than a design input',
      'AI and automation regulation landscape not well understood at leadership level',
    ],
    painPoints: ['Late-stage compliance reviews frequently require process redesign', 'Documentation burden is high and largely manual'],
    frictions: ['Legal and compliance teams not embedded in project teams — they review at the end'],
    barriers: [],
    constraint: ['Sector-specific regulation limits automation of certain customer-facing decisions'],
    future: ['Compliance-by-design embedded into all process and technology change from the outset'],
    support: ['Regulatory horizon scanning — particularly for AI and automated decision-making legislation'],
  },

  finance: {
    currentScore: 5, targetScore: 7, projectedScore: 6,
    strengths: ['Strong financial controls and audit trails', 'Finance team has good relationships with operational leaders'],
    working: ['Monthly management accounts produced on schedule', 'Purchase approval process is clearly understood'],
    gaps: [
      'Financial data is not accessible in real time — reporting is retrospective',
      'Budget setting process is disconnected from operational planning',
      'Finance analytics capability is limited to spreadsheet tools',
    ],
    painPoints: ['Month-end close takes longer than peers due to manual reconciliation', 'Variance analysis is reactive rather than predictive'],
    frictions: ['Finance systems do not integrate with operational platforms — double entry is routine'],
    barriers: ['ERP upgrade deprioritised due to cost and risk perception'],
    constraint: ['External audit requirements limit some automation opportunities'],
    future: ['Real-time financial dashboards accessible to budget holders', 'Automated variance flagging with AI-driven root cause suggestions'],
    support: ['Finance systems modernisation roadmap', 'FP&A capability building programme'],
  },

  operations: {
    currentScore: 5, targetScore: 8, projectedScore: 6,
    strengths: ['Operational teams are experienced and resilient', 'Strong performance culture with clear KPIs'],
    working: ['Daily stand-ups keep teams aligned', 'Escalation processes are well-understood'],
    gaps: [
      'End-to-end process ownership is unclear across department boundaries',
      'Capacity planning is reactive rather than demand-led',
      'Operational data is not consistently captured or used for improvement',
    ],
    painPoints: ['Rework is high — errors caught late in the process create expensive fixes', 'Handoffs between teams consistently lose context'],
    frictions: ['Legacy workflow tooling forces manual steps that should be automated'],
    barriers: ['Investment in operational improvement has been deprioritised in recent years'],
    constraint: ['Volume spikes cannot be absorbed without agency staff at additional cost'],
    future: ['Intelligent workload routing with AI-assisted prioritisation', 'End-to-end digital process with real-time exception management'],
    support: ['Process excellence programme', 'Operational analytics platform'],
  },
};

// Maps lens display labels to the internal FIXED_QUESTIONS phase keys.
const LABEL_TO_PHASE_KEY: Record<string, string> = {
  People: 'people',
  Operations: 'operations',
  Organisation: 'operations',
  Corporate: 'operations',
  Technology: 'technology',
  Commercial: 'commercial',
  Customer: 'customer',
  'Risk/Compliance': 'risk_compliance',
  Regulation: 'risk_compliance',
  Finance: 'finance',
  Partners: 'partners',
};

// Generic maturity scale used for custom lenses that have no FIXED_QUESTIONS entry
const GENERIC_MATURITY_SCALE = [
  'Ad hoc and inconsistent. Relies on individual effort. No clear standard or accountability.',
  'Basic processes defined. Some consistency but depends on key people. Gaps are visible.',
  'Standardised and repeatable. Clear accountability. Performance is tracked and improving.',
  'Data-driven and proactive. AI-assisted where appropriate. Continuously optimised.',
  'Intelligent and adaptive. Self-optimising. Considered industry-leading in this area.',
];

function genericMaturityQuestion(label: string): string {
  return `When looking specifically at ${label}, rate the current maturity level in this area — where the organisation is today, where it should be, and where it will be if nothing changes.`;
}

// Generic fallback for lenses without specific content
function genericLensContent(label: string, index: number): typeof LENS_CONTENT[string] {
  const scores = [
    { c: 5, t: 8, p: 6 },
    { c: 4, t: 7, p: 5 },
    { c: 6, t: 8, p: 7 },
    { c: 3, t: 7, p: 5 },
    { c: 5, t: 9, p: 6 },
  ][index % 5];
  return {
    currentScore: scores.c,
    targetScore: scores.t,
    projectedScore: scores.p,
    strengths: [
      `Experienced team with strong domain knowledge in ${label.toLowerCase()}`,
      `Leadership is committed to improving ${label.toLowerCase()} outcomes`,
    ],
    working: [`Core ${label.toLowerCase()} processes are understood and followed`, 'Escalation paths are clear'],
    gaps: [
      `${label} data is not consistently captured or used to drive decisions`,
      `End-to-end accountability for ${label.toLowerCase()} outcomes is unclear`,
      'Automation and AI opportunities in this area are not yet explored',
    ],
    painPoints: [
      `Manual ${label.toLowerCase()} processes create unnecessary rework and delay`,
      'Knowledge is siloed — key expertise sits with specific individuals',
    ],
    frictions: [`${label} workflows require multiple system switches — context is lost between steps`],
    barriers: ['Investment in this area has been deprioritised in the current cycle'],
    constraint: [],
    future: [
      `Intelligent ${label.toLowerCase()} support with AI-assisted decision making`,
      `Real-time visibility of ${label.toLowerCase()} performance for all relevant staff`,
    ],
    support: [`${label} capability development programme`, 'External expertise to support transformation design'],
  };
}

// ── Example executive summary + insights ──────────────────────────────────────

function buildExecutiveSummary(lensLabels: string[]): string {
  const lensStr = lensLabels.slice(0, -1).join(', ') + (lensLabels.length > 1 ? ` and ${lensLabels[lensLabels.length - 1]}` : lensLabels[0]);
  return `This participant demonstrates a clear-eyed understanding of current operational constraints, particularly around manual handoffs and fragmented data across the ${lensStr} dimensions explored in the discovery. They describe a landscape where multiple systems and teams exist in parallel but rarely share information in real time, leading to repeated data entry and frequent reconciliation rework.\n\nThe participant expresses genuine optimism about what structured improvement and automation could deliver, placing ambition scores consistently above 7 across most dimensions. However, they temper this with pragmatic concern about change fatigue within the organisation, noting that previous initiatives have stalled at implementation. Their responses suggest a workforce that is willing but under-equipped, with gaps concentrated in data literacy and cross-functional process ownership.`;
}

function buildKeyInsights(lensLabels: string[]) {
  return [
    {
      title: 'Manual handoffs are the primary source of friction across all lenses',
      insight: `The participant identifies handoffs between teams — across ${lensLabels.join(', ')} — as the root cause of most delays and errors. This is not a technology gap in isolation but a process design and accountability gap.`,
      confidence: 'high' as const,
      evidence: [
        'Every time a case moves between teams we basically start again — the next person has no context.',
        'We have the data, it\'s just in three different places and nobody owns making sure they match.',
      ],
    },
    {
      title: 'Change fatigue is a significant adoption risk',
      insight: 'Previous transformation initiatives have left the team sceptical. The participant describes a pattern of tools introduced without sufficient training, creating an "initiative graveyard" that dampens enthusiasm for new technology.',
      confidence: 'high' as const,
      evidence: [
        'We\'ve had three new systems in four years. Each one was going to fix everything. None of them did.',
        'People just work around them and keep the spreadsheet going because they don\'t trust the system.',
      ],
    },
    {
      title: 'Data literacy is a foundational capability gap',
      insight: 'The participant repeatedly returns to the inability of staff to interpret and act on data that is technically available. The problem is not data access but the skills and culture to use it effectively.',
      confidence: 'medium' as const,
      evidence: [
        'The dashboard is there but the team don\'t look at it. They don\'t really know what they\'re looking at.',
        'Knowing how to pull a report is one thing — knowing what to do with it afterwards is the hard bit.',
      ],
    },
  ];
}

function buildWordCloud(lensLabels: string[]) {
  const base = [
    { text: 'data', value: 18 }, { text: 'handoffs', value: 15 }, { text: 'manual', value: 14 },
    { text: 'automation', value: 12 }, { text: 'skills', value: 11 }, { text: 'training', value: 10 },
    { text: 'silos', value: 9 }, { text: 'visibility', value: 8 }, { text: 'change', value: 8 },
    { text: 'process', value: 7 }, { text: 'rework', value: 7 }, { text: 'legacy', value: 6 },
    { text: 'accountability', value: 6 }, { text: 'real-time', value: 5 }, { text: 'AI', value: 5 },
    { text: 'integration', value: 5 }, { text: 'friction', value: 4 }, { text: 'culture', value: 4 },
    { text: 'collaboration', value: 4 }, { text: 'ownership', value: 3 }, { text: 'reporting', value: 3 },
    { text: 'governance', value: 3 }, { text: 'empathy', value: 3 },
  ];
  // Inject lens labels as high-weight terms
  const lensTerms = lensLabels.map((l, i) => ({ text: l.toLowerCase(), value: 16 - i * 2 }));
  return [...lensTerms, ...base];
}

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

    // Fetch workshop name + discovery questions (for actual lenses)
    const workshop = await prisma.workshop.findUnique({
      where: { id: workshopId },
      select: { name: true, discoveryQuestions: true },
    });

    // ── Determine lenses ───────────────────────────────────────────────────
    let lenses: DiscoveryLens[] = [];

    const dq = workshop?.discoveryQuestions as DiscoveryQuestionSet | null | undefined;
    if (dq?.lenses && Array.isArray(dq.lenses) && dq.lenses.length > 0) {
      lenses = dq.lenses;
    }

    // Fallback: use the canonical lens set if no questions generated yet.
    if (lenses.length === 0) {
      lenses = CANONICAL_LENSES.map((lens) => ({
        key: lens.phase,
        label: lens.name,
        questions: [],
      }));
    }

    lenses = lenses.map((lens) => {
      const canonicalLabel = canonicalizeLensName(lens.label);
      if (!canonicalLabel) {
        return lens;
      }
      const canonicalLens = CANONICAL_LENSES.find((entry) => entry.name === canonicalLabel);
      return {
        ...lens,
        key: canonicalLens?.phase ?? lens.key,
        label: canonicalLabel,
      };
    });

    const lensLabels = lenses.map((l) => l.label);

    // ── Build phase insights from actual lenses ────────────────────────────
    const phaseInsights = lenses.map((lens, idx) => {
      // Look up example narrative content by normalised label
      const contentKey = lens.label.toLowerCase().replace(/\s+/g, '').replace(/risk\/compliance/, 'risk/compliance');
      const content = LENS_CONTENT[contentKey] ?? genericLensContent(lens.label, idx);

      // Map to the internal FIXED_QUESTIONS phase key so the maturity scale
      // lookup in generateDiscoveryReportPdf works for standard lenses.
      // For custom / unmapped lenses, fall back to the label itself and
      // supply explicit override question + scale so the section always renders.
      const phaseKey = LABEL_TO_PHASE_KEY[lens.label];
      const isKnownPhase = !!phaseKey;

      return {
        phase: isKnownPhase ? phaseKey : lens.label,
        // For unknown lenses, always supply the colourful maturity section
        ...(!isKnownPhase && {
          overrideQuestion: genericMaturityQuestion(lens.label),
          overrideMaturityScale: GENERIC_MATURITY_SCALE,
        }),
        ...content,
      };
    });

    // ── Build the rest of the report ──────────────────────────────────────
    const pdfBuffer = await generateDiscoveryReportPdf({
      participantName: 'Example Participant',
      workshopName: workshop?.name ?? 'DREAM Discovery',
      discoveryUrl: '',
      orgName: 'DREAM Discovery',
      executiveSummary: buildExecutiveSummary(lensLabels),
      tone: 'optimistic',
      feedback: 'Thank you for your thoughtful and detailed responses. Your perspective on the gap between current capability and your desired future state is valuable — the tensions you have identified between digital ambition and implementation readiness are widely shared and will enrich the collective picture for the workshop.',
      inputQuality: {
        score: 82,
        label: 'high',
        rationale: 'Responses were detailed and grounded in specific operational examples. The participant provided concrete process descriptions, named specific friction points, and supported their maturity ratings with clear reasoning.',
      },
      keyInsights: buildKeyInsights(lensLabels),
      phaseInsights,
      wordCloudThemes: buildWordCloud(lensLabels),
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
