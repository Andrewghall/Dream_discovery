'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  Building2,
  Heart,
  Cpu,
  Scale,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,

} from 'lucide-react';

import { ScrollReveal } from './scroll-reveal';
import { RadarChart } from './radar-chart';
import { CalendlyButton } from './calendly-button';
import { PATTERNS, detectPattern } from './assessment/patterns';
import { useVoice } from './assessment/use-voice';
import { AnalysingScreen } from './assessment/screens/analysing';

/* ────────────────────────────────────────────────────────────
   POCTR Capability Maturity Model  -  Data & Types
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
  descriptors: [string, string, string, string, string]; // L1-L5
}

interface Domain {
  key: string;
  name: string;
  description: string;
  icon: typeof Users;
  colour: string;
  colourHex: string;
  levelDescriptors: [string, string, string, string, string]; // Domain-level L1-L5
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
          'Skills development is informal  -  individuals seek out their own training with no organisational strategy.',
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
          'Alignment is cultural  -  teams self-organise around strategic priorities; leadership enables rather than directs.',
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
    name: 'Organisation & Partners',
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
          'Decisions require multiple approval layers; speed-to-decision is a recognised bottleneck. Decisions involving partners require separate, slower processes.',
          'Some decision authority is delegated, but escalation is frequent and governance processes are heavy. Partner-related decisions lack clear ownership or escalation paths.',
          'Decision rights are clearly defined; governance balances control with the need for speed. Joint decisions with key partners follow agreed governance frameworks.',
          'Decision-making is streamlined with defined SLAs; data-driven governance enables rapid response. Partner decisions are embedded in the same governance cadence as internal ones.',
          'Decision authority flows to where the insight is; governance is adaptive and enables real-time response. Partners participate in shared decision frameworks as naturally as internal teams.',
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
          'Functional boundaries are fluid; teams self-form around opportunities. The ecosystem is an extension of the organisation  -  partners co-create and co-innovate seamlessly.',
        ],
      },
      {
        id: 'o3',
        dimension: 'Operating Model Adaptability',
        question: 'How well does your operating model support new ways of working?',
        descriptors: [
          'The operating model is rigid and inherited; changes require major restructuring. Partner integration requires bespoke workarounds each time.',
          'There is awareness that the operating model needs to evolve, but structural change is slow. Adapting the model to include partner workflows is manual and time-consuming.',
          'The operating model is periodically reviewed and adapted to support strategic shifts. The model accommodates partner collaboration through defined integration points.',
          'Operating model design is a continuous process; the organisation can reconfigure rapidly. Partner and internal operations share modular, reconfigurable building blocks.',
          'The operating model is modular and adaptive by design; new capabilities can be stood up and stood down quickly. Partners plug in and out of the operating model as seamlessly as internal teams.',
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
          'Customer journeys are mapped and actively managed; key touchpoints, including partner-delivered channels, deliver a consistent experience.',
          'Omnichannel experience is integrated; transitions between direct and partner channels are seamless and personalised.',
          'The customer experience is continuously optimised across owned and partner channels; the organisation sets the standard in its sector.',
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
          'Core systems are integrated through defined interfaces; partner systems connect through standard APIs.',
          'Cloud-native, API-driven architecture enables rapid change; partner and internal platforms interoperate seamlessly.',
          'Architecture is continuously evolving; the platform enables experimentation, rapid scaling, and partner ecosystems integrate natively.',
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
        question: "How mature is your organisation's use of automation and artificial intelligence?",
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
        question: "How clearly is your organisation's risk appetite defined and applied to decisions?",
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

/* ─────────────────────────────────────────────────────────────
   All questions flattened + quick track (1 per domain)
   ───────────────────────────────────────────────────────────── */

const ALL_QUESTIONS = DOMAINS.flatMap(d => d.questions.map(q => ({ ...q, domain: d })));
// Quick track: first question from each domain — one per capability area
const QUICK_QUESTIONS = DOMAINS.map(d => ({ ...d.questions[0], domain: d }));

interface Scores { [qId: string]: number | null }
const EMPTY_SCORES: Scores = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, null]));

/* ─────────────────────────────────────────────────────────────
   Multiple Choice Input Component
   ───────────────────────────────────────────────────────────── */

function MultipleChoiceInput({
  descriptors,
  maturityLevels,
  domainColourHex,
  onSelect,
}: {
  descriptors: [string, string, string, string, string]
  maturityLevels: readonly { level: number; name: string; description: string }[]
  domainColourHex: string
  onSelect: (level: number) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  const handleClick = (level: number) => {
    if (selected !== null) return; // prevent double-tap
    setSelected(level)
    // Brief green flash so user sees their choice registered, then advance
    setTimeout(() => onSelect(level), 150)
  }

  return (
    <div className="space-y-2.5 w-full max-w-lg" style={{ animation: 'qFadeUp 0.3s ease both' }}>
      <p className="text-xs text-white/70 mb-3">Select the level that best describes your organisation today</p>
      {maturityLevels.map((lvl, i) => {
        const isSelected = selected === lvl.level
        const isHovered = hovered === lvl.level && selected === null
        return (
          <button
            key={lvl.level}
            type="button"
            onClick={() => handleClick(lvl.level)}
            onMouseEnter={() => setHovered(lvl.level)}
            onMouseLeave={() => setHovered(null)}
            disabled={selected !== null}
            className="w-full text-left p-4 rounded-xl border-2 transition-all"
            style={{
              borderColor: isSelected ? `${domainColourHex}90` : isHovered ? `${domainColourHex}60` : 'rgba(255,255,255,0.08)',
              background: isSelected ? `${domainColourHex}18` : isHovered ? `${domainColourHex}10` : 'rgba(255,255,255,0.02)',
              opacity: selected !== null && !isSelected ? 0.45 : 1,
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-all"
                style={{
                  background: isSelected ? `${domainColourHex}35` : isHovered ? `${domainColourHex}25` : 'rgba(255,255,255,0.07)',
                  color: isSelected ? domainColourHex : isHovered ? domainColourHex : 'rgba(255,255,255,0.35)',
                }}
              >
                {isSelected ? '✓' : lvl.level}
              </span>
              <div>
                <span
                  className="text-xs font-bold block mb-0.5 transition-colors"
                  style={{ color: isSelected ? domainColourHex : isHovered ? domainColourHex : 'rgba(255,255,255,0.55)' }}
                >
                  {lvl.name}
                </span>
                <span className="text-xs text-white/80 leading-relaxed">{descriptors[i]}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────────── */

export function AssessmentSection() {
  // mode: null=not chosen, 'quick'=5 questions, 'full'=15 questions
  const [mode, setMode] = useState<'quick' | 'full' | null>(null);
  // step: 0=intro, 1-N=question, N+1=analysing, N+2=email gate, N+3=results
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Scores>({ ...EMPTY_SCORES });
  const [voiceMode, setVoiceMode] = useState(false); // opt-in — silent by default for fast answering

  // Email / submit state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const voice = useVoice();
  const sectionRef = useRef<HTMLElement>(null);

  // Derive active question set and counts from chosen mode
  const activeQuestions = mode === 'quick' ? QUICK_QUESTIONS : ALL_QUESTIONS;
  const totalSteps = activeQuestions.length; // 5 or 15
  const analysingStep = totalSteps + 1;
  const gateStep = totalSteps + 2;
  const resultsStep = totalSteps + 3;

  const currentQ = step >= 1 && step <= totalSteps ? activeQuestions[step - 1] : null;

  // Live domain scores (partial — uses answered questions only)
  const liveDomainScores = useMemo(() => DOMAINS.map(d => {
    const answered = d.questions.map(q => scores[q.id]).filter((v): v is number => v !== null);
    const score = answered.length > 0 ? answered.reduce((s, v) => s + v, 0) / answered.length : 0;
    return score;
  }), [scores]);

  // Final domain results for results screen
  const domainResults = useMemo(() => DOMAINS.map(d => {
    const vals = d.questions.map(q => scores[q.id] || 0);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const score = Math.round(avg * 10) / 10;
    const li = Math.min(Math.max(Math.round(avg) - 1, 0), 4);
    return {
      name: d.name,
      colourHex: d.colourHex,
      score,
      levelName: MATURITY_LEVELS[li].name,
      levelDescriptor: d.levelDescriptors[li],
    };
  }), [scores]);

  const overallScore = useMemo(
    () => Math.round(domainResults.reduce((s, r) => s + r.score, 0) / domainResults.length * 10) / 10,
    [domainResults]
  );
  const pattern = useMemo(() => detectPattern(domainResults), [domainResults]);

  // Scroll question into view on each step change
  useEffect(() => {
    if (step >= 1 && step <= totalSteps && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step, totalSteps]);

  // Speak question when it appears (only if read-aloud mode is on)
  useEffect(() => {
    if (!voiceMode || !currentQ || step < 1 || step > totalSteps) return;
    voice.stopSpeaking();
    voice.speak(currentQ.question);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, voiceMode]);

  const handleSelect = useCallback((level: number) => {
    if (!currentQ) return;
    voice.stopSpeaking();
    setScores(prev => ({ ...prev, [currentQ.id]: level }));
    // MultipleChoiceInput already flashed 150ms — advance immediately
    if (step < totalSteps) {
      setStep(s => s + 1);
    } else {
      setStep(analysingStep);
    }
  }, [currentQ, step, totalSteps, analysingStep, voice]);

  const reset = () => {
    voice.stopSpeaking();
    setMode(null); setStep(0); setScores({ ...EMPTY_SCORES });
    setSubmitError(''); setName(''); setEmail(''); setOrganisation('');
  };

  /* ── INTRO ── */
  if (step === 0) {
    return (
      <section id="assessment" className="bg-gradient-to-b from-slate-50 to-white py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="bg-[#0a0a0a] rounded-3xl overflow-hidden relative">
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 60% at 20% 50%, rgba(92,242,142,0.07), transparent)' }} />
              <div className="relative z-10 px-8 sm:px-14 py-14 sm:py-16">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]" />
                  <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/75">Capability Diagnostic</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.05] tracking-tight mb-5">
                  Every organisation has<br className="hidden sm:block" /> untapped potential.
                </h2>
                <p className="text-white/75 text-lg sm:text-xl font-light leading-relaxed mb-3">
                  The question is where it lives — and what&apos;s ready to be unlocked.
                </p>
                <p className="text-white/80 text-sm leading-relaxed mb-10 max-w-lg">
                  Five capability areas — People, Organisation, Customer, Technology and Regulation. Choose a quick 2-minute version or go deeper with the full 15-minute assessment. No right or wrong answers.
                </p>

                {/* Read aloud toggle */}
                <div className="flex items-center gap-3 mb-8">
                  <button
                    onClick={() => setVoiceMode(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${voiceMode ? 'bg-[#5cf28e] text-[#0a0a0a]' : 'border border-white/15 text-white/75 hover:border-white/30'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                    Read aloud
                  </button>
                  <button
                    onClick={() => setVoiceMode(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!voiceMode ? 'bg-[#5cf28e] text-[#0a0a0a]' : 'border border-white/15 text-white/75 hover:border-white/30'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                    Silent
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => { setMode('quick'); setStep(1); }}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-base font-bold rounded-xl bg-[#5cf28e] text-[#0a0a0a] hover:bg-[#50d47e] transition-all shadow-lg shadow-[#5cf28e]/20 hover:shadow-xl hover:shadow-[#5cf28e]/30"
                  >
                    Quick — 2 minutes
                    <span className="text-[11px] font-normal opacity-70">(5 questions)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setMode('full'); setStep(1); }}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-base font-bold rounded-xl border border-white/20 text-white hover:bg-white/[0.06] transition-all"
                  >
                    Full Assessment — 15 minutes
                    <span className="text-[11px] font-normal opacity-70">(15 questions)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  /* ── ANALYSING ── */
  if (step === analysingStep) return <AnalysingScreen onDone={() => setStep(gateStep)} />;

  /* ── EMAIL GATE ── */
  if (step === gateStep) {
    const isCompanyEmail = (addr: string) => {
      const domain = addr.split('@')[1]?.toLowerCase() ?? '';
      const FREE_DOMAINS = [
        'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.fr','yahoo.de','yahoo.es','yahoo.it',
        'yahoo.ca','yahoo.com.au','yahoo.co.in','hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.de',
        'hotmail.es','hotmail.it','outlook.com','outlook.co.uk','outlook.fr','live.com','live.co.uk',
        'icloud.com','me.com','mac.com','aol.com','protonmail.com','proton.me','mail.com','ymail.com',
        'msn.com','gmx.com','gmx.de','web.de','inbox.com','fastmail.com','zohomail.com','tutanota.com',
      ];
      return domain.length > 0 && !FREE_DOMAINS.includes(domain);
    };

    const handleGateSubmit = async () => {
      if (!name.trim()) { setSubmitError('Please enter your name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSubmitError('Please enter a valid email address.'); return; }
      if (!isCompanyEmail(email)) { setSubmitError('Please use your work email address — personal email providers are not accepted.'); return; }
      setSubmitError('');
      setSubmitting(true);
      try {
        await fetch('/api/public/assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(), email: email.trim(), organisation: organisation.trim() || undefined,
            scores: domainResults.map(r => ({
              domain: r.name, score: r.score, levelName: r.levelName,
              levelDescriptor: r.levelDescriptor, nextLevelName: '', nextLevelDescriptor: '',
            })),
            overallScore,
            overallLevelName: MATURITY_LEVELS[Math.min(Math.max(Math.round(overallScore) - 1, 0), 4)].name,
            recommendation: overallScore <= 2 ? 'Foundation' : overallScore <= 3.5 ? 'Acceleration' : 'Optimisation',
          }),
        });
      } catch { /* non-blocking — advance regardless */ }
      finally { setSubmitting(false); }
      setStep(resultsStep);
    };

    return (
      <section id="assessment" className="bg-[#0a0a0a] min-h-screen flex items-center justify-center px-6 py-16">
        <style>{`@keyframes gFadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div className="w-full max-w-lg" style={{ animation: 'gFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>

          {/* Pattern teaser */}
          <div className="mb-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#5cf28e]/60 mb-3">Your Pattern</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">{pattern.name}</h2>
            <p className="text-white/70 text-base font-light leading-relaxed max-w-sm mx-auto">{pattern.headline}</p>
          </div>

          {/* Gate card */}
          <div className="bg-[#111111] border border-white/[0.08] rounded-2xl p-7">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]" />
              <h3 className="text-sm font-bold text-white">Unlock your full profile</h3>
            </div>
            <p className="text-white/80 text-xs leading-relaxed mb-6 pl-4">
              Enter your details to see your complete capability breakdown, domain scores, and what a DREAM session would surface for your specific constraints. Your PDF report will be emailed to you.
            </p>

            <div className="space-y-3">
              <input
                type="text" placeholder="Your name *" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#5cf28e]/40 transition-colors"
              />
              <div>
                <input
                  type="email" placeholder="Work email address *" value={email}
                  onChange={e => { setEmail(e.target.value); setSubmitError(''); }}
                  className={`w-full px-4 py-3 text-sm bg-white/[0.04] border rounded-xl text-white placeholder-white/25 focus:outline-none transition-colors ${submitError && submitError.includes('email') ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/10 focus:border-[#5cf28e]/40'}`}
                />
                <p className="text-[10px] text-white/70 mt-1.5 pl-1">Work email required — personal addresses not accepted</p>
              </div>
              <input
                type="text" placeholder="Organisation" value={organisation} onChange={e => setOrganisation(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#5cf28e]/40 transition-colors"
              />
            </div>

            {submitError && <p className="text-red-400 text-xs mt-3">{submitError}</p>}

            <button
              onClick={handleGateSubmit}
              disabled={submitting || !name.trim() || !email.trim()}
              className="w-full mt-5 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-[#5cf28e] text-[#0a0a0a] hover:bg-[#50d47e] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#5cf28e]/15"
            >
              {submitting
                ? <><span className="w-4 h-4 border-2 border-[#0a0a0a]/20 border-t-[#0a0a0a] rounded-full animate-spin" />Sending…</>
                : <>Unlock My Results <ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </div>

          <button onClick={reset} className="mt-5 w-full text-xs text-white/70 hover:text-white/85 transition-colors text-center">
            ← Start over
          </button>
        </div>
      </section>
    );
  }

  /* ── QUESTIONS ── */
  if (step >= 1 && step <= totalSteps && currentQ) {
    const domain = currentQ.domain;
    const progressPct = ((step - 1) / totalSteps) * 100;
    const DomainIcon = domain.icon;

    return (
      <section ref={sectionRef} id="assessment" className="bg-[#0a0a0a] min-h-screen flex flex-col">
        <style>{`
          @keyframes qFadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes micPulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(92,242,142,0.4)} 50%{transform:scale(1.05);box-shadow:0 0 0 16px rgba(92,242,142,0)} }
          @keyframes processingDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
          @keyframes fadeInAnim { from{opacity:0} to{opacity:1} }
        `}</style>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${domain.colourHex}25` }}>
              <DomainIcon className="w-3.5 h-3.5" style={{ color: domain.colourHex }} />
            </div>
            <span className="text-xs font-semibold text-white/70 tracking-wide">{domain.name}</span>
          </div>
          <span className="text-xs text-white/75 tabular-nums">{step} / {totalSteps}</span>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 mx-6 rounded-full bg-white/[0.06] mb-8">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: domain.colourHex }} />
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-8 px-6 pb-8 max-w-5xl mx-auto w-full">

          {/* Question + voice area */}
          <div className="flex-1 flex flex-col justify-center" key={step} style={{ animation: 'qFadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-4" style={{ color: `${domain.colourHex}99` }}>
              {currentQ.dimension}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-8">
              {currentQ.question}
            </h2>

            {/* Multiple choice options */}
            <MultipleChoiceInput
              key={step}
              descriptors={currentQ.descriptors}
              maturityLevels={MATURITY_LEVELS}
              domainColourHex={domain.colourHex}
              onSelect={handleSelect}
            />

          </div>

          {/* Live radar — desktop only */}
          <div className="hidden lg:flex flex-col items-center justify-center w-72 shrink-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 mb-3">Your Profile</p>
            <RadarChart
              domains={DOMAINS.map(d => d.name)}
              current={liveDomainScores}
              maxValue={5}
              size={240}
              animated={false}
            />
            <p className="text-[10px] text-white/70 mt-2 text-center max-w-[180px] leading-relaxed">
              Updates as you answer each question
            </p>
          </div>
        </div>

        {/* Back */}
        <div className="px-6 pb-6">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} className="text-xs text-white/70 hover:text-white/70 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </div>
      </section>
    );
  }

  /* ── RESULTS (step 18) ── */
  const overallLevelIndex = Math.min(Math.max(Math.round(overallScore) - 1, 0), 4);
  const BENCHMARK = [3.5, 3.5, 3.5, 3.5, 3.5];

  return (
    <section id="assessment" className="bg-[#0a0a0a] py-16 px-6 min-h-screen">
      <style>{`
        @keyframes rFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes signalIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-10">

        {/* Pattern reveal */}
        <div style={{ animation: 'rFadeUp 0.6s ease both' }}>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#5cf28e]/60 mb-3">Your Pattern</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
            {pattern.name}
          </h2>
          <p className="text-white/75 text-xl font-light leading-relaxed mb-3 max-w-2xl">
            {pattern.headline}
          </p>
          <p className="text-white/85 text-sm leading-relaxed max-w-xl">
            {pattern.insight}
          </p>
        </div>

        {/* Profile + domain breakdown */}
        <div className="grid lg:grid-cols-2 gap-8" style={{ animation: 'rFadeUp 0.6s ease 0.15s both', opacity: 0 }}>
          {/* Radar */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.07] p-6 flex flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75 mb-4">Transformation Profile</p>
            <RadarChart
              domains={DOMAINS.map(d => d.name)}
              current={domainResults.map(r => r.score)}
              target={BENCHMARK}
              maxValue={5}
              size={260}
              animated
            />
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full bg-[#5cf28e]/70" />
                <span className="text-[10px] text-white/75">Your profile</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full border-t border-dashed border-white/30" />
                <span className="text-[10px] text-white/75">Transformation-ready threshold</span>
              </div>
            </div>
          </div>

          {/* Domain scores */}
          <div className="space-y-3">
            {[...domainResults].sort((a, b) => a.score - b.score).map((r, i) => {
              const gap = Math.max(0, 3.5 - r.score);
              return (
                <div key={r.name} className="bg-white/[0.03] rounded-xl border border-white/[0.07] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white/80">{r.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: r.colourHex }}>{r.score.toFixed(1)}</span>
                      {gap > 0.3 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30">↑ {gap.toFixed(1)} to threshold</span>}
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(r.score / 5) * 100}%`, backgroundColor: r.colourHex, opacity: 0.8 }} />
                  </div>
                  {i === 0 && <p className="text-[10px] text-white/75 mt-2 leading-relaxed">{r.levelDescriptor}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* What DREAM would find */}
        <div style={{ animation: 'rFadeUp 0.6s ease 0.3s both', opacity: 0 }}>
          <div className="border-t border-white/[0.06] pt-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/75 mb-2">What A DREAM Session Would Surface</p>
            <p className="text-white/75 text-sm mb-6 max-w-xl">{pattern.dreamFocus}</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {pattern.signals.map((signal, i) => (
                <div key={i} className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]"
                  style={{ animation: `signalIn 0.5s ease ${0.4 + i * 0.1}s both`, opacity: 0 }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]/60 mb-3" />
                  <p className="text-white/75 text-xs leading-relaxed">{signal}</p>
                </div>
              ))}
            </div>
            <p className="text-white/70 text-xs italic max-w-lg">
              These patterns don&apos;t come from surveys. They surface when the right people are in the room, asked the right questions, in the right order.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#0d1a10] to-[#0a0a0a] rounded-2xl border border-[#5cf28e]/15 p-8" style={{ animation: 'rFadeUp 0.6s ease 0.45s both', opacity: 0 }}>
          <p className="text-[#5cf28e] text-[10px] font-bold uppercase tracking-[0.25em] mb-3">Ready to go deeper?</p>
          <h3 className="text-xl font-bold text-white mb-2">Book a DREAM Discovery Session</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-lg">
            In 90 minutes, DREAM would surface the constraints behind this profile — the ones that don&apos;t show up in data, but shape every decision your organisation makes.
          </p>
          <CalendlyButton className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-[#5cf28e] text-[#0a0a0a] hover:bg-[#50d47e] transition-all shadow-lg shadow-[#5cf28e]/20 cursor-pointer">
            Book a DREAM Session <ArrowRight className="h-4 w-4" />
          </CalendlyButton>
        </div>

        {/* PDF sent confirmation + start over */}
        <div className="flex items-center justify-between" style={{ animation: 'rFadeUp 0.6s ease 0.55s both', opacity: 0 }}>
          <div className="flex items-center gap-2 text-white/75 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#5cf28e]/60" />
            PDF report sent to {email}
          </div>
          {overallLevelIndex != null && (
            <button onClick={reset} className="text-xs text-white/70 hover:text-white/85 transition-colors">← Start over</button>
          )}
        </div>
      </div>
    </section>
  );
}
