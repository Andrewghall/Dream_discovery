'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Users,
  Building2,
  Heart,
  Cpu,
  Scale,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Download,
  ClipboardCheck,
  Check,
} from 'lucide-react';
import { ScrollReveal, AnimatedCounter } from './scroll-reveal';
import { RadarChart } from './radar-chart';
import { CalendlyButton } from './calendly-button';

/* ────────────────────────────────────────────────────────────
   POCTR Capability Maturity Model — Data & Types
   ──────────────────────────────────────────────────────────── */

const MATURITY_LEVELS = [
  { level: 1, name: 'Ad Hoc',    description: 'No formal approach; reactive and inconsistent' },
  { level: 2, name: 'Emerging',  description: 'Some awareness and initial processes; fragmented' },
  { level: 3, name: 'Defined',   description: 'Documented processes; cross-functional consistency' },
  { level: 4, name: 'Managed',   description: 'Measured and data-driven; actively optimised' },
  { level: 5, name: 'Leading',   description: 'Innovative and adaptive; industry-leading' },
] as const;

interface MaturityQuestion {
  id: string;
  dimension: string;
  question: string;
  descriptors: [string, string, string, string, string]; // L1–L5
}

interface Domain {
  key: string;
  name: string;
  description: string;
  icon: typeof Users;
  colour: string;
  colourHex: string;
  levelDescriptors: [string, string, string, string, string]; // Domain-level L1–L5
  questions: [MaturityQuestion, MaturityQuestion, MaturityQuestion];
}

const DOMAINS: Domain[] = [
  {
    key: 'people',
    name: 'People',
    description: 'Talent development, leadership alignment, and cultural readiness for change.',
    icon: Users,
    colour: 'bg-blue-500',
    colourHex: '#3b82f6',
    levelDescriptors: [
      'Skills development is ad hoc. Leadership communication is inconsistent. Retention is reactive.',
      'Some talent programmes exist but are fragmented. Leadership vision is communicated top-down without structured alignment.',
      'Structured talent development with skills frameworks aligned to strategic goals. Leaders actively build alignment across teams.',
      'Workforce capability is measured, benchmarked, and continuously developed. Leadership drives a data-informed culture of accountability.',
      'Talent is a strategic differentiator. Adaptive workforce planning anticipates future needs. Leaders model continuous learning at every level.',
    ],
    questions: [
      {
        id: 'p1',
        dimension: 'Talent Development & Skills Capability',
        question: 'How does your organisation develop the skills and capabilities it needs?',
        descriptors: [
          'Skills development is informal — individuals seek out their own training with no organisational strategy.',
          'Some training programmes exist, but they are not connected to strategic priorities or future needs.',
          'A structured skills framework exists with development paths aligned to organisational strategy.',
          'Skills gaps are systematically identified, measured, and addressed through targeted investment.',
          'Workforce capability planning anticipates future needs; the organisation is known for developing exceptional talent.',
        ],
      },
      {
        id: 'p2',
        dimension: 'Leadership Alignment & Communication',
        question: 'How does leadership create alignment on strategic direction?',
        descriptors: [
          'Leaders communicate in silos; teams have different understandings of strategic priorities.',
          'Leadership communicates a vision, but translation into team-level action is inconsistent.',
          'Leaders actively align teams around shared objectives with regular cadence and feedback loops.',
          'Strategic alignment is measured and tracked; leaders use data to identify and resolve misalignment.',
          'Alignment is cultural — teams self-organise around strategic priorities; leadership enables rather than directs.',
        ],
      },
      {
        id: 'p3',
        dimension: 'Change Readiness & Culture',
        question: 'How does your workforce respond when the organisation needs to change direction?',
        descriptors: [
          'Change is resisted; there is no structured change management and initiatives stall frequently.',
          'Change management exists for large programmes, but day-to-day adaptability is low.',
          'The organisation has a consistent approach to change; most teams can adapt with appropriate support.',
          'Change capability is embedded; teams adapt quickly and change fatigue is actively monitored.',
          'Adaptability is a defining cultural trait; the workforce embraces continuous change as the norm.',
        ],
      },
    ],
  },
  {
    key: 'organisation',
    name: 'Organisation',
    description: 'Governance, cross-functional collaboration, partner ecosystem alignment, and operating model adaptability.',
    icon: Building2,
    colour: 'bg-green-500',
    colourHex: '#22c55e',
    levelDescriptors: [
      'Decision-making is centralised and slow. Governance is process-heavy and change-resistant. Partner relationships are transactional.',
      'Some cross-functional collaboration exists but is project-driven rather than structural. Partner engagement is ad hoc. Governance recognises the need for agility.',
      'Governance frameworks balance control and speed. Cross-functional teams operate with clear mandates. Key partners are structurally aligned.',
      'Organisational design is intentionally optimised. Decision authority is distributed with clear escalation. Strategic partners are integrated into planning cycles.',
      'The organisation is structurally adaptive. Governance evolves in real time. Internal and partner ecosystems collaborate seamlessly.',
    ],
    questions: [
      {
        id: 'o1',
        dimension: 'Decision-Making Speed & Governance',
        question: 'How quickly can your organisation make and execute strategic decisions?',
        descriptors: [
          'Decisions require multiple approval layers; speed-to-decision is a recognised bottleneck.',
          'Some decision authority is delegated, but escalation is frequent and governance processes are heavy.',
          'Decision rights are clearly defined; governance balances control with the need for speed.',
          'Decision-making is streamlined with defined SLAs; data-driven governance enables rapid response.',
          'Decision authority flows to where the insight is; governance is adaptive and enables real-time response.',
        ],
      },
      {
        id: 'o2',
        dimension: 'Cross-Boundary Collaboration',
        question: 'How effectively do teams collaborate across functional boundaries and with external partners?',
        descriptors: [
          'Teams operate in silos; collaboration depends on personal relationships. External partner relationships are transactional and siloed.',
          'Cross-functional projects exist but coordination is manual. Partner engagement is ad hoc with no structured alignment.',
          'Cross-functional teams have clear mandates and shared objectives. Key partnerships have structured collaboration and shared goals.',
          'Collaboration is embedded in operating models with shared metrics. Strategic partners are integrated into planning and delivery cycles.',
          'Functional boundaries are fluid; teams self-form around opportunities. The ecosystem is an extension of the organisation — partners co-create and co-innovate seamlessly.',
        ],
      },
      {
        id: 'o3',
        dimension: 'Operating Model Adaptability',
        question: 'How well does your operating model support new ways of working?',
        descriptors: [
          'The operating model is rigid and inherited; changes require major restructuring.',
          'There is awareness that the operating model needs to evolve, but structural change is slow.',
          'The operating model is periodically reviewed and adapted to support strategic shifts.',
          'Operating model design is a continuous process; the organisation can reconfigure rapidly.',
          'The operating model is modular and adaptive by design; new capabilities can be stood up and stood down quickly.',
        ],
      },
    ],
  },
  {
    key: 'customer',
    name: 'Customer',
    description: 'Customer insight, experience coherence across touchpoints, and voice of the customer in decisions.',
    icon: Heart,
    colour: 'bg-purple-500',
    colourHex: '#a855f7',
    levelDescriptors: [
      'Customer insight is anecdotal. Experiences are siloed by channel. Feedback is gathered but rarely acted upon.',
      'Basic customer data is collected. Some journey mapping has been attempted. Feedback loops exist in isolated functions.',
      'Customer insights inform product and service decisions. Journey mapping is embedded. Multi-channel experience is actively managed.',
      'Real-time customer intelligence drives decisions. Personalisation is systematic. Customer outcomes are measured and optimised.',
      'The organisation anticipates customer needs before they emerge. Co-creation with customers is standard. Experience innovation is continuous.',
    ],
    questions: [
      {
        id: 'c1',
        dimension: 'Customer Insight & Understanding',
        question: 'How well does your organisation understand what customers actually need?',
        descriptors: [
          'Customer understanding is based on assumptions and anecdotal feedback from front-line staff.',
          'Some customer research is conducted, but insights are not systematically shared or acted upon.',
          'Customer insights are gathered through structured research and inform product and service decisions.',
          'Real-time customer data and analytics drive a deep understanding of needs, behaviours, and value drivers.',
          'The organisation anticipates emerging customer needs; co-creation and continuous discovery are standard practice.',
        ],
      },
      {
        id: 'c2',
        dimension: 'Experience Coherence Across Touchpoints',
        question: 'How consistently do customers experience your brand across all channels and interactions?',
        descriptors: [
          'Each channel operates independently; customers encounter different experiences depending on how they interact.',
          'Some effort has been made to align channels, but gaps and handoff friction are common.',
          'Customer journeys are mapped and actively managed; key touchpoints deliver a consistent experience.',
          'Omnichannel experience is integrated; transitions between channels are seamless and personalised.',
          'The customer experience is continuously optimised and innovated; the organisation sets the standard in its sector.',
        ],
      },
      {
        id: 'c3',
        dimension: 'Voice of the Customer in Decision-Making',
        question: 'How systematically does customer feedback influence strategic and operational decisions?',
        descriptors: [
          'Customer complaints are handled reactively; feedback rarely reaches decision-makers.',
          'Customer satisfaction is measured periodically, but results do not consistently influence decisions.',
          'Customer feedback loops are established; insights are reported to leadership and inform planning cycles.',
          'Customer metrics are embedded in strategic KPIs; product and service decisions are validated against customer outcomes.',
          'Customers are active participants in strategy; their voice is a first-class input to all significant decisions.',
        ],
      },
    ],
  },
  {
    key: 'technology',
    name: 'Technology',
    description: 'Architecture maturity, data as a strategic asset, and AI & automation readiness.',
    icon: Cpu,
    colour: 'bg-orange-500',
    colourHex: '#f97316',
    levelDescriptors: [
      'Technology is legacy-heavy and fragmented. Data is siloed. IT is seen as a cost centre.',
      'Some modernisation efforts are underway. Data is accessible within departments. Technology strategy exists but lacks execution.',
      'Integrated platforms support core processes. Data governance is established. Technology is a recognised enabler of strategy.',
      'Cloud-native, API-driven architecture. Data analytics informs strategic decisions. Technology investment is outcome-driven.',
      'Technology enables continuous innovation. AI and automation are embedded. The organisation is a technology-native enterprise.',
    ],
    questions: [
      {
        id: 't1',
        dimension: 'Architecture & Integration Maturity',
        question: 'How modern and integrated is your technology landscape?',
        descriptors: [
          'Systems are legacy, fragmented, and poorly documented; integration is point-to-point and brittle.',
          'Some modernisation initiatives are underway, but legacy dependencies create friction and delay.',
          'Core systems are integrated through defined interfaces; architecture principles guide technology decisions.',
          'Cloud-native, API-driven architecture enables rapid change; technology supports rather than constrains the business.',
          'Architecture is continuously evolving; the platform enables experimentation, rapid scaling, and innovation at speed.',
        ],
      },
      {
        id: 't2',
        dimension: 'Data as a Strategic Asset',
        question: 'How effectively does your organisation use data to make decisions?',
        descriptors: [
          'Data is siloed in spreadsheets and departmental systems; reporting is manual and inconsistent.',
          'Some centralised reporting exists, but data quality issues limit trust and usage.',
          'Data governance is established; consistent reporting supports operational and strategic decisions.',
          'Advanced analytics and insight capabilities drive data-informed decision-making across the organisation.',
          'AI-augmented intelligence is embedded; data is a recognised strategic asset that drives competitive advantage.',
        ],
      },
      {
        id: 't3',
        dimension: 'Automation & AI Readiness',
        question: 'How mature is your organisation\'s use of automation and artificial intelligence?',
        descriptors: [
          'Automation is minimal and manual processes dominate; AI is not on the agenda.',
          'Some process automation has been implemented in isolated areas; AI is being explored but lacks strategy.',
          'Automation is applied strategically to high-value processes; an AI strategy exists with initial pilots underway.',
          'Intelligent automation is embedded in core operations; AI models are in production and generating measurable value.',
          'AI and automation are a core capability; the organisation continuously identifies and scales new applications.',
        ],
      },
    ],
  },
  {
    key: 'regulation',
    name: 'Regulation',
    description: 'Compliance as an enabler, regulatory change readiness, and risk appetite governance.',
    icon: Scale,
    colour: 'bg-red-500',
    colourHex: '#ef4444',
    levelDescriptors: [
      'Compliance is reactive and siloed. Regulatory change creates disruption. Risk is managed through avoidance.',
      'Compliance processes are documented but manual. Some regulatory horizon scanning exists. Risk appetite is poorly defined.',
      'Compliance is integrated into operations. Regulatory change management is proactive. Risk frameworks balance protection and opportunity.',
      'Regulatory intelligence informs strategy. Compliance is automated where possible. Risk is quantified and actively managed as a portfolio.',
      'Regulation is leveraged as competitive advantage. The organisation shapes industry standards. Compliance enables innovation rather than constraining it.',
    ],
    questions: [
      {
        id: 'r1',
        dimension: 'Compliance as an Enabler',
        question: 'Does your compliance framework enable innovation or constrain it?',
        descriptors: [
          'Compliance is treated as a constraint; teams avoid innovation for fear of regulatory exposure.',
          'Compliance processes are understood but manual; they slow delivery without adding proportionate value.',
          'Compliance is integrated into delivery processes; teams understand how to innovate within boundaries.',
          'Compliance is automated where possible; regulatory requirements are embedded as guardrails, not gates.',
          'The organisation uses regulatory expertise as a competitive advantage; compliance enables faster, safer innovation.',
        ],
      },
      {
        id: 'r2',
        dimension: 'Regulatory Change Readiness',
        question: 'How well does your organisation anticipate and respond to regulatory changes?',
        descriptors: [
          'Regulatory changes are discovered late and create scrambles; impact assessment is reactive.',
          'Some horizon scanning exists, but regulatory change management is manual and inconsistent.',
          'A structured process monitors regulatory change; impact is assessed and implementation is planned proactively.',
          'Regulatory intelligence is integrated into strategic planning; the organisation responds to change ahead of deadlines.',
          'The organisation actively engages with regulators and shapes the regulatory landscape in its sector.',
        ],
      },
      {
        id: 'r3',
        dimension: 'Risk Appetite & Governance',
        question: 'How clearly is your organisation\'s risk appetite defined and applied to decisions?',
        descriptors: [
          'Risk appetite is undefined; decisions either avoid all risk or take risk without understanding consequences.',
          'Risk appetite is discussed at board level but is not translated into practical guidance for teams.',
          'Risk appetite is defined and communicated; frameworks help teams make risk-informed decisions consistently.',
          'Risk is quantified, dynamically monitored, and managed as a portfolio; risk appetite informs strategy actively.',
          'Risk intelligence is a strategic capability; the organisation balances protection with opportunity as a competitive lever.',
        ],
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────
   Scores & Results Types
   ──────────────────────────────────────────────────────────── */

interface Scores {
  [questionId: string]: number | null;
}

const DEFAULT_SCORES: Scores = Object.fromEntries(
  DOMAINS.flatMap((d) => d.questions.map((q) => [q.id, null])),
);

interface DomainResult {
  name: string;
  colourHex: string;
  score: number;
  levelName: string;
  levelDescriptor: string;
  nextLevelName: string;
  nextLevelDescriptor: string;
}

/* ────────────────────────────────────────────────────────────
   Recommendation Logic
   ──────────────────────────────────────────────────────────── */

interface Recommendation {
  headline: string;
  body: string;
  focus: 'Foundation' | 'Acceleration' | 'Optimisation';
}

const DOMAIN_ADVICE: Record<string, string> = {
  People: 'building leadership alignment and developing the skills capability your organisation needs',
  Organisation: 'strengthening governance agility, cross-functional collaboration, and partner ecosystem alignment to enable faster transformation',
  Customer: 'deepening customer understanding and creating seamless, coherent experiences across touchpoints',
  Technology: 'modernising your technology landscape and building a data-driven decision-making culture',
  Regulation: 'reframing compliance as an enabler of innovation rather than a barrier to progress',
};

function getRecommendation(
  priorityDomain: string,
  overallScore: number,
  overallLevelName: string,
): Recommendation {
  let focus: Recommendation['focus'];
  if (overallScore <= 2.0) focus = 'Foundation';
  else if (overallScore <= 3.5) focus = 'Acceleration';
  else focus = 'Optimisation';

  const advice = DOMAIN_ADVICE[priorityDomain] || 'addressing your organisational gaps';

  const headlines: Record<string, string> = {
    Foundation: 'Build Your Foundation',
    Acceleration: 'Accelerate Your Transformation',
    Optimisation: 'Optimise What You\'ve Built',
  };

  const bodies: Record<string, string> = {
    Foundation: `Your organisation assessed at maturity level ${overallLevelName}. The biggest opportunity lies in ${advice}. A DREAM Foundation workshop would help you build the shared understanding and strategic clarity needed to move forward with confidence.`,
    Acceleration: `Your organisation assessed at maturity level ${overallLevelName} — a solid base, but significant gaps remain, particularly in ${advice}. A DREAM Acceleration workshop would cut through the noise, align your teams around the gaps that matter most, and build a constraint-aware roadmap for transformation.`,
    Optimisation: `Your organisation assessed at maturity level ${overallLevelName}. There are still meaningful opportunities — especially in ${advice}. A DREAM Optimisation workshop would help you fine-tune your strategy, identify the constraints holding you back from the next level, and design a focused path forward.`,
  };

  return { headline: headlines[focus], body: bodies[focus], focus };
}

/* ────────────────────────────────────────────────────────────
   Maturity Level Selector Component
   ──────────────────────────────────────────────────────────── */

function MaturityLevelSelector({
  question,
  selectedLevel,
  onSelect,
  accentHex,
}: {
  question: MaturityQuestion;
  selectedLevel: number | null;
  onSelect: (level: number) => void;
  accentHex: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {question.dimension}
        </p>
        <p className="text-sm font-medium text-slate-700 leading-relaxed">
          {question.question}
        </p>
      </div>
      <div className="space-y-2">
        {MATURITY_LEVELS.map((level, i) => {
          const isSelected = selectedLevel === level.level;
          return (
            <button
              key={level.level}
              type="button"
              onClick={() => onSelect(level.level)}
              className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                isSelected
                  ? 'shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              style={
                isSelected
                  ? {
                      borderColor: accentHex,
                      backgroundColor: `${accentHex}08`,
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                  style={{
                    backgroundColor: isSelected ? accentHex : '#e2e8f0',
                    color: isSelected ? '#fff' : '#64748b',
                  }}
                >
                  {level.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                      {level.name}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentHex }} />
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                    {question.descriptors[i]}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────────── */

export function AssessmentSection() {
  // step: 0 = intro, 1–5 = domain, 6 = results
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Scores>({ ...DEFAULT_SCORES });

  // Email form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Score helpers ───────────────────────────────────────────

  const updateScore = useCallback(
    (qId: string, level: number) => {
      setScores((prev) => ({ ...prev, [qId]: level }));
    },
    [],
  );

  // ── Computed: current domain completeness ────────────────────

  const currentDomainComplete = useMemo(() => {
    if (step < 1 || step > 5) return true;
    const domain = DOMAINS[step - 1];
    return domain.questions.every((q) => scores[q.id] !== null);
  }, [step, scores]);

  // ── Computed results ────────────────────────────────────────

  const domainResults: DomainResult[] = useMemo(
    () =>
      DOMAINS.map((d) => {
        const vals = d.questions.map((q) => scores[q.id] || 0);
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        const score = Math.round(avg * 10) / 10;
        const levelIndex = Math.min(Math.max(Math.round(avg) - 1, 0), 4);
        const nextLevelIndex = Math.min(levelIndex + 1, 4);
        return {
          name: d.name,
          colourHex: d.colourHex,
          score,
          levelName: MATURITY_LEVELS[levelIndex].name,
          levelDescriptor: d.levelDescriptors[levelIndex],
          nextLevelName: MATURITY_LEVELS[nextLevelIndex].name,
          nextLevelDescriptor: d.levelDescriptors[nextLevelIndex],
        };
      }),
    [scores],
  );

  const overallScore = useMemo(
    () => Math.round((domainResults.reduce((s, r) => s + r.score, 0) / domainResults.length) * 10) / 10,
    [domainResults],
  );

  const overallLevelIndex = Math.min(Math.max(Math.round(overallScore) - 1, 0), 4);
  const overallLevelName = MATURITY_LEVELS[overallLevelIndex].name;

  const priorityDomains = useMemo(
    () => [...domainResults].sort((a, b) => a.score - b.score),
    [domainResults],
  );

  const recommendation = useMemo(
    () => getRecommendation(priorityDomains[0]?.name || 'People', overallScore, overallLevelName),
    [priorityDomains, overallScore, overallLevelName],
  );

  // ── Email submit ────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        organisation: organisation.trim() || undefined,
        scores: domainResults.map((r) => ({
          domain: r.name,
          score: r.score,
          levelName: r.levelName,
          levelDescriptor: r.levelDescriptor,
          nextLevelName: r.nextLevelName,
          nextLevelDescriptor: r.nextLevelDescriptor,
        })),
        overallScore,
        overallLevelName,
        recommendation: recommendation.focus,
      };

      const res = await fetch('/api/public/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send report');
      }

      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render intro ────────────────────────────────────────────

  if (step === 0) {
    return (
      <section id="assessment" className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <div className="bg-[#0d0d0d] rounded-3xl p-8 sm:p-12 overflow-hidden relative">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 60% at 20% 50%, rgba(92, 242, 142, 0.08), transparent)',
                }}
              />
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#5cf28e]/20 flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-[#5cf28e]" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#5cf28e]/20 text-[#5cf28e]">
                    5 Minute Assessment
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                  How Ready Is Your Organisation to{' '}
                  <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
                    Transform?
                  </span>
                </h2>
                <p className="text-white/60 leading-relaxed mb-4">
                  Whether you&apos;re deploying agentic AI, rethinking your operating model,
                  aligning partner ecosystems, or driving a new strategy &mdash; transformation
                  success depends on the same five dimensions. Rate your organisation across
                  People, Organisation, Customer, Technology, and Regulation to see where
                  you&apos;re strong and where the gaps will stall your programmes.
                </p>
                <p className="text-white/40 text-xs leading-relaxed mb-6">
                  The POCTR model measures your readiness to execute strategic change &mdash; from
                  enterprise AI adoption and partner alignment to operating model redesign. Used
                  by DREAM workshops to ground transformation in what your people actually think.
                </p>
                <div className="flex flex-wrap gap-4 mb-8">
                  {DOMAINS.map((d) => (
                    <div key={d.key} className="flex items-center gap-1.5 text-white/50">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: d.colourHex }}
                      />
                      <span className="text-xs">{d.name}</span>
                    </div>
                  ))}
                </div>

                {/* Maturity level preview */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {MATURITY_LEVELS.map((l) => (
                    <div
                      key={l.level}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.08]"
                    >
                      <span className="text-[10px] font-bold text-[#5cf28e]">L{l.level}</span>
                      <span className="text-[10px] text-white/50">{l.name}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all shadow-lg shadow-[#5cf28e]/20"
                >
                  Start Assessment <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  // ── Render domain questions (steps 1–5) ─────────────────────

  if (step >= 1 && step <= 5) {
    const domain = DOMAINS[step - 1];
    const Icon = domain.icon;
    const answeredCount = domain.questions.filter((q) => scores[q.id] !== null).length;

    return (
      <section id="assessment" className="bg-gradient-to-b from-slate-50 to-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-8">
              {DOMAINS.map((d, i) => (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="h-1.5 w-full rounded-full transition-all duration-300"
                    style={{
                      backgroundColor:
                        i < step - 1
                          ? '#5cf28e'
                          : i === step - 1
                          ? d.colourHex
                          : '#e2e8f0',
                    }}
                  />
                  <span
                    className="text-[9px] font-medium hidden sm:block"
                    style={{
                      color: i <= step - 1 ? d.colourHex : '#94a3b8',
                    }}
                  >
                    {d.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Domain card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${domain.colourHex}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color: domain.colourHex }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{domain.name}</h3>
                  <p className="text-xs text-slate-400">
                    Step {step} of 5 &middot; {answeredCount} of 3 answered
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4 ml-[52px]">{domain.description}</p>

              {/* Question completion indicators */}
              <div className="flex items-center gap-2 mb-6">
                {domain.questions.map((q, qi) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-1"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        backgroundColor: scores[q.id] !== null ? domain.colourHex : '#e2e8f0',
                        color: scores[q.id] !== null ? '#fff' : '#94a3b8',
                      }}
                    >
                      {scores[q.id] !== null ? <Check className="h-3 w-3" /> : qi + 1}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-8">
                {domain.questions.map((q) => (
                  <MaturityLevelSelector
                    key={q.id}
                    question={q}
                    selectedLevel={scores[q.id]}
                    onSelect={(level) => updateScore(q.id, level)}
                    accentHex={domain.colourHex}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                <button
                  onClick={() => setStep(step - 1)}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {step === 1 ? 'Back' : 'Previous'}
                </button>
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!currentDomainComplete}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {step === 5 ? 'See Results' : 'Next'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Render results (step 6) ─────────────────────────────────

  return (
    <section id="assessment" className="bg-gradient-to-b from-slate-50 to-white py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
            Your Results
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
            Transformation Readiness Profile
          </h2>
          <p className="text-slate-500 text-sm">
            POCTR Capability Maturity Model &mdash; measuring readiness to execute strategic change
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* ── Left: Radar + overall ── */}
          <div className="flex flex-col items-center">
            <RadarChart
              domains={DOMAINS.map((d) => d.name)}
              current={domainResults.map((r) => r.score)}
              maxValue={5}
              animated
            />

            {/* Overall maturity level */}
            <div className="mt-6 text-center">
              <div className="text-4xl font-black text-slate-900 mb-1">
                Level {overallLevelIndex + 1}
              </div>
              <div className="text-lg font-bold text-[#5cf28e] mb-1">
                {overallLevelName}
              </div>
              <div className="text-sm text-slate-400 tabular-nums">
                {overallScore.toFixed(1)} / 5
              </div>
            </div>

            {/* Maturity scale reference */}
            <div className="flex items-center gap-1 mt-6">
              {MATURITY_LEVELS.map((l) => (
                <div
                  key={l.level}
                  className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
                    l.level === overallLevelIndex + 1
                      ? 'bg-[#5cf28e] text-[#0d0d0d]'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {l.name}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Domain breakdown + recommendation + email ── */}
          <div className="space-y-6">
            {/* Domain breakdown — sorted by priority (lowest first) */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                Priority Development Areas
              </h3>
              <div className="space-y-3">
                {priorityDomains.map((result, i) => (
                  <div
                    key={result.name}
                    className="bg-white rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: result.colourHex }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-semibold text-slate-900">{result.name}</span>
                          <span className="text-xs font-bold" style={{ color: result.colourHex }}>
                            L{Math.round(result.score)} &middot; {result.levelName}
                          </span>
                        </div>
                        {/* Continuous progress bar */}
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(result.score / 5) * 100}%`,
                              backgroundColor: result.colourHex,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Next level recommendation */}
                    {Math.round(result.score) < 5 && (
                      <div className="ml-11 mt-2 pl-3 border-l-2 border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          Next: {result.nextLevelName}
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {result.nextLevelDescriptor}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation */}
            <div className="bg-[#0d0d0d] rounded-2xl p-6">
              <p className="text-[#5cf28e] text-[10px] font-bold uppercase tracking-wider mb-2">
                Recommendation
              </p>
              <h4 className="text-lg font-bold text-white mb-2">{recommendation.headline}</h4>
              <p className="text-white/60 text-sm leading-relaxed">{recommendation.body}</p>
            </div>

            {/* Email capture / submitted confirmation */}
            {!submitted ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Download className="h-4 w-4 text-[#5cf28e]" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Get your full report as a PDF
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  We&apos;ll send you a detailed PDF with your transformation readiness profile,
                  domain breakdown, next-level recommendations, and personalised guidance
                  on where to focus &mdash; from AI adoption and partner ecosystem alignment
                  to operating model change.
                </p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5cf28e]/40 focus:border-[#5cf28e] transition-all"
                  />
                  <input
                    type="email"
                    placeholder="Email address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5cf28e]/40 focus:border-[#5cf28e] transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Organisation (optional)"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5cf28e]/40 focus:border-[#5cf28e] transition-all"
                  />
                  {submitError && (
                    <p className="text-xs text-red-500">{submitError}</p>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !name.trim() || !email.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#0d0d0d]/20 border-t-[#0d0d0d] rounded-full animate-spin" />
                        Generating report&hellip;
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" /> Send My Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#5cf28e]/30 p-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-[#5cf28e] mx-auto mb-3" />
                <h4 className="text-lg font-bold text-slate-900 mb-1">Report Sent!</h4>
                <p className="text-sm text-slate-500 mb-4">
                  Check your inbox &mdash; your Transformation Readiness Report is on its way.
                </p>
                <CalendlyButton
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all cursor-pointer"
                >
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </CalendlyButton>
              </div>
            )}

            {/* Retake */}
            <button
              onClick={() => {
                setStep(0);
                setScores({ ...DEFAULT_SCORES });
                setSubmitted(false);
                setSubmitError('');
                setName('');
                setEmail('');
                setOrganisation('');
              }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              &larr; Retake assessment
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
