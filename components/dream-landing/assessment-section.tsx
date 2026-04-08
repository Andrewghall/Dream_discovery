'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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
   All questions flattened
   ───────────────────────────────────────────────────────────── */

const ALL_QUESTIONS = DOMAINS.flatMap(d => d.questions.map(q => ({ ...q, domain: d })));

interface Scores { [qId: string]: number | null }
const EMPTY_SCORES: Scores = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, null]));

/* ─────────────────────────────────────────────────────────────
   Text Answer Input Component
   ───────────────────────────────────────────────────────────── */

function TextAnswerInput({
  domainColourHex,
  onSubmit,
  onQuickSelect,
  maturityLevels,
  descriptors,
}: {
  domainColourHex: string
  onSubmit: (text: string) => void
  onQuickSelect: (level: number) => void
  maturityLevels: readonly { level: number; name: string; description: string }[]
  descriptors: [string, string, string, string, string]
}) {
  const [text, setText] = useState('')
  const [showLevels, setShowLevels] = useState(false)

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (trimmed.length < 5) return
    onSubmit(trimmed)
  }

  return (
    <div className="space-y-4" style={{ animation: 'qFadeUp 0.3s ease both' }}>
      {/* Free-text input */}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe how your organisation approaches this in your own words…"
          rows={4}
          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-white/80 text-sm leading-relaxed placeholder-white/20 resize-none focus:outline-none focus:border-white/25 transition-colors max-w-lg"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
          }}
        />
        <span className="absolute bottom-3 right-4 text-[10px] text-white/15 pointer-events-none">
          ⌘↵ to submit
        </span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={text.trim().length < 5}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: domainColourHex, color: '#0a0a0a' }}
      >
        Interpret my answer
      </button>

      {/* Quick-select toggle */}
      <button
        onClick={() => setShowLevels(v => !v)}
        className="text-xs text-white/20 hover:text-white/40 transition-colors"
      >
        {showLevels ? 'Hide levels ↑' : 'Or pick a level directly →'}
      </button>

      {showLevels && (
        <div className="space-y-2 pt-1">
          {maturityLevels.map((level, i) => (
            <button key={level.level} type="button" onClick={() => onQuickSelect(level.level)}
              className="w-full text-left p-4 rounded-xl border-2 border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-white/[0.08] text-white/35">
                  {level.level}
                </div>
                <div>
                  <span className="text-xs font-bold text-white/60 block mb-0.5">{level.name}</span>
                  <span className="text-xs text-white/35 leading-relaxed">{descriptors[i]}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────────── */

export function AssessmentSection() {
  // step: 0=intro, 1-15=question, 16=analysing, 17=results
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Scores>({ ...EMPTY_SCORES });
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [voiceMode, setVoiceMode] = useState(true);
  const [currentReflection, setCurrentReflection] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [interpreting, setInterpreting] = useState(false);

  // Email / submit state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const voice = useVoice();

  const currentQ = step >= 1 && step <= 15 ? ALL_QUESTIONS[step - 1] : null;

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

  // Speak question when it appears
  useEffect(() => {
    if (!voiceMode || !currentQ || step < 1 || step > 15) return;
    voice.stopSpeaking();
    const timer = setTimeout(() => {
      voice.speak(currentQ.question);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, voiceMode]);

  const handleVoiceAnswer = useCallback(async (transcript: string) => {
    if (!currentQ) return;
    setInterpreting(true);
    voice.setVoiceState('processing');
    try {
      const res = await fetch('/api/public/assessment/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQ.question, dimension: currentQ.dimension, transcript }),
      });
      const data = await res.json() as { level: number; reflection: string };
      setPendingLevel(data.level);
      setCurrentReflection(data.reflection);
      setShowConfirm(true);
      voice.setVoiceState('reflecting');
      if (voiceMode) {
        setTimeout(() => voice.speak(data.reflection), 300);
      }
    } catch {
      setInterpreting(false);
    } finally {
      setInterpreting(false);
    }
  }, [currentQ, voiceMode, voice]);

  const confirmAnswer = useCallback((level: number) => {
    if (!currentQ) return;
    voice.stopSpeaking();
    setScores(prev => ({ ...prev, [currentQ.id]: level }));
    if (currentReflection) setReflections(prev => ({ ...prev, [currentQ.id]: currentReflection }));
    setShowConfirm(false);
    setPendingLevel(null);
    setCurrentReflection('');
    if (step < 15) {
      setTimeout(() => setStep(s => s + 1), 350);
    } else {
      setTimeout(() => setStep(16), 350);
    }
  }, [currentQ, currentReflection, step, voice]);

  const handleManualSelect = useCallback((level: number) => {
    if (!currentQ) return;
    setScores(prev => ({ ...prev, [currentQ.id]: level }));
    setShowConfirm(false);
    setPendingLevel(null);
    setCurrentReflection('');
    if (step < 15) {
      setTimeout(() => setStep(s => s + 1), 350);
    } else {
      setTimeout(() => setStep(16), 350);
    }
  }, [currentQ, step]);

  const handleSubmitEmail = async () => {
    if (!name.trim() || !email.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSubmitError('Please enter a valid email address.'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const res = await fetch('/api/public/assessment', {
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
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
    } catch { setSubmitError('Something went wrong. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const reset = () => {
    voice.stopSpeaking();
    setStep(0); setScores({ ...EMPTY_SCORES }); setReflections({});
    setCurrentReflection(''); setShowConfirm(false); setPendingLevel(null);
    setSubmitted(false); setSubmitError(''); setName(''); setEmail(''); setOrganisation('');
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
                  <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/50">5-Minute Diagnostic</span>
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.05] tracking-tight mb-5">
                  Every organisation has<br className="hidden sm:block" /> untapped potential.
                </h2>
                <p className="text-white/50 text-lg sm:text-xl font-light leading-relaxed mb-3">
                  The question is where it lives — and what&apos;s ready to be unlocked.
                </p>
                <p className="text-white/30 text-sm leading-relaxed mb-10 max-w-lg">
                  Speak or write your way through 15 questions. In five minutes, you&apos;ll see your organisation&apos;s full capability profile — and exactly where a DREAM session would accelerate you.
                </p>

                {/* Voice toggle */}
                <div className="flex items-center gap-3 mb-8">
                  <button
                    onClick={() => setVoiceMode(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${voiceMode ? 'bg-[#5cf28e] text-[#0a0a0a]' : 'border border-white/15 text-white/50 hover:border-white/30'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                    Voice
                  </button>
                  <button
                    onClick={() => setVoiceMode(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!voiceMode ? 'bg-[#5cf28e] text-[#0a0a0a]' : 'border border-white/15 text-white/50 hover:border-white/30'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Text
                  </button>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 text-base font-bold rounded-xl bg-[#5cf28e] text-[#0a0a0a] hover:bg-[#50d47e] transition-all shadow-lg shadow-[#5cf28e]/20 hover:shadow-xl hover:shadow-[#5cf28e]/30"
                >
                  Discover Your Profile
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    );
  }

  /* ── ANALYSING ── */
  if (step === 16) return <AnalysingScreen onDone={() => setStep(17)} />;

  /* ── QUESTIONS (steps 1-15) ── */
  if (step >= 1 && step <= 15 && currentQ) {
    const domain = currentQ.domain;
    const progressPct = ((step - 1) / 15) * 100;
    const DomainIcon = domain.icon;

    return (
      <section id="assessment" className="bg-[#0a0a0a] min-h-screen flex flex-col">
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
            <span className="text-xs font-semibold text-white/40 tracking-wide">{domain.name}</span>
          </div>
          <span className="text-xs text-white/25 tabular-nums">{step} / 15</span>
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

            {/* Voice mode — mic button */}
            {voiceMode && !showConfirm && !interpreting && (
              <div className="flex flex-col items-start gap-4">
                {voice.state === 'idle' || voice.state === 'speaking' ? (
                  <button
                    onClick={() => { voice.stopSpeaking(); voice.startListening(handleVoiceAnswer); }}
                    className="flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                    style={{ background: `${domain.colourHex}18`, border: `1.5px solid ${domain.colourHex}50`, color: domain.colourHex }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                    {voice.state === 'speaking' ? 'Listening to question…' : 'Tap to answer'}
                  </button>
                ) : voice.state === 'listening' ? (
                  <div className="space-y-3 w-full">
                    <button
                      onClick={voice.stopListening}
                      className="flex items-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-sm"
                      style={{ background: 'rgba(92,242,142,0.15)', border: '1.5px solid rgba(92,242,142,0.6)', color: '#5cf28e', animation: 'micPulse 2s ease-in-out infinite' }}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#5cf28e]" style={{ animation: 'micPulse 1s ease-in-out infinite' }} />
                      Listening — tap to finish
                    </button>
                    {(voice.transcript || voice.interimTranscript) && (
                      <p className="text-white/50 text-sm leading-relaxed pl-1 max-w-lg">
                        {voice.transcript}<span className="text-white/25">{voice.interimTranscript}</span>
                      </p>
                    )}
                  </div>
                ) : null}
                <button onClick={() => setVoiceMode(false)} className="text-xs text-white/20 hover:text-white/40 transition-colors">
                  Prefer to type instead →
                </button>
              </div>
            )}

            {/* Text mode */}
            {!voiceMode && !showConfirm && !interpreting && (
              <TextAnswerInput
                key={step}
                domainColourHex={domain.colourHex}
                onSubmit={handleVoiceAnswer}
                onQuickSelect={handleManualSelect}
                maturityLevels={MATURITY_LEVELS}
                descriptors={currentQ.descriptors}
              />
            )}

            {/* Processing — shared between voice and text */}
            {(interpreting || voice.state === 'processing') && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]/60" style={{ animation: `processingDot 1.4s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                </div>
                <span className="text-white/40 text-sm">Understanding your answer…</span>
              </div>
            )}

            {/* Reflection + confirm — shared between voice and text */}
            {showConfirm && pendingLevel !== null && (
              <div className="space-y-4" style={{ animation: 'qFadeUp 0.4s ease both' }}>
                <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.04]">
                  <p className="text-white/70 text-sm leading-relaxed mb-4">{currentReflection}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => confirmAnswer(pendingLevel)}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: domain.colourHex, color: '#0a0a0a' }}
                    >
                      That&apos;s right
                    </button>
                    <span className="text-white/25 text-xs">or adjust:</span>
                    {MATURITY_LEVELS.map(l => (
                      <button key={l.level} onClick={() => confirmAnswer(l.level)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${pendingLevel === l.level ? 'text-[#0a0a0a]' : 'border-white/10 text-white/35 hover:border-white/25'}`}
                        style={pendingLevel === l.level ? { background: domain.colourHex, borderColor: domain.colourHex } : {}}
                      >
                        L{l.level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live radar — desktop only */}
          <div className="hidden lg:flex flex-col items-center justify-center w-72 shrink-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 mb-3">Your Profile</p>
            <RadarChart
              domains={DOMAINS.map(d => d.name)}
              current={liveDomainScores}
              maxValue={5}
              size={240}
              animated={false}
            />
            <p className="text-[10px] text-white/15 mt-2 text-center max-w-[180px] leading-relaxed">
              Updates as you answer each question
            </p>
          </div>
        </div>

        {/* Back */}
        {!showConfirm && (
          <div className="px-6 pb-6">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} className="text-xs text-white/20 hover:text-white/40 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          </div>
        )}
      </section>
    );
  }

  /* ── RESULTS (step 17) ── */
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
          <p className="text-white/50 text-xl font-light leading-relaxed mb-3 max-w-2xl">
            {pattern.headline}
          </p>
          <p className="text-white/35 text-sm leading-relaxed max-w-xl">
            {pattern.insight}
          </p>
        </div>

        {/* Profile + domain breakdown */}
        <div className="grid lg:grid-cols-2 gap-8" style={{ animation: 'rFadeUp 0.6s ease 0.15s both', opacity: 0 }}>
          {/* Radar */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.07] p-6 flex flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-4">Transformation Profile</p>
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
                <span className="text-[10px] text-white/30">Your profile</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full border-t border-dashed border-white/30" />
                <span className="text-[10px] text-white/30">Transformation-ready threshold</span>
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
                  {i === 0 && <p className="text-[10px] text-white/25 mt-2 leading-relaxed">{r.levelDescriptor}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* What DREAM would find */}
        <div style={{ animation: 'rFadeUp 0.6s ease 0.3s both', opacity: 0 }}>
          <div className="border-t border-white/[0.06] pt-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-2">What A DREAM Session Would Surface</p>
            <p className="text-white/50 text-sm mb-6 max-w-xl">{pattern.dreamFocus}</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {pattern.signals.map((signal, i) => (
                <div key={i} className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]"
                  style={{ animation: `signalIn 0.5s ease ${0.4 + i * 0.1}s both`, opacity: 0 }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#5cf28e]/60 mb-3" />
                  <p className="text-white/55 text-xs leading-relaxed">{signal}</p>
                </div>
              ))}
            </div>
            <p className="text-white/20 text-xs italic max-w-lg">
              These patterns don&apos;t come from surveys. They surface when the right people are in the room, asked the right questions, in the right order.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#0d1a10] to-[#0a0a0a] rounded-2xl border border-[#5cf28e]/15 p-8" style={{ animation: 'rFadeUp 0.6s ease 0.45s both', opacity: 0 }}>
          <p className="text-[#5cf28e] text-[10px] font-bold uppercase tracking-[0.25em] mb-3">Ready to go deeper?</p>
          <h3 className="text-xl font-bold text-white mb-2">Book a DREAM Discovery Session</h3>
          <p className="text-white/45 text-sm leading-relaxed mb-6 max-w-lg">
            In 90 minutes, DREAM would surface the constraints behind this profile — the ones that don&apos;t show up in data, but shape every decision your organisation makes.
          </p>
          <CalendlyButton className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl bg-[#5cf28e] text-[#0a0a0a] hover:bg-[#50d47e] transition-all shadow-lg shadow-[#5cf28e]/20 cursor-pointer">
            Book a DREAM Session <ArrowRight className="h-4 w-4" />
          </CalendlyButton>
        </div>

        {/* Email capture */}
        {!submitted ? (
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.07] p-6" style={{ animation: 'rFadeUp 0.6s ease 0.55s both', opacity: 0 }}>
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-4 w-4 text-[#5cf28e]/60" />
              <h4 className="text-sm font-bold text-white">Get your full diagnostic as a PDF</h4>
            </div>
            <p className="text-white/35 text-xs mb-4 ml-6">We&apos;ll send your pattern analysis, profile breakdown, and what a DREAM session would focus on for your specific constraints.</p>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <input type="text" placeholder="Your name *" value={name} onChange={e => setName(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#5cf28e]/40 transition-colors" />
              <input type="email" placeholder="Email address *" value={email} onChange={e => setEmail(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#5cf28e]/40 transition-colors" />
              <input type="text" placeholder="Organisation" value={organisation} onChange={e => setOrganisation(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#5cf28e]/40 transition-colors" />
            </div>
            {submitError && <p className="text-red-400 text-xs mb-2">{submitError}</p>}
            <button onClick={handleSubmitEmail} disabled={submitting || !name.trim() || !email.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0a0a0a] hover:bg-[#50d47e] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-[#0a0a0a]/20 border-t-[#0a0a0a] rounded-full animate-spin" />Sending…</>
              ) : (
                <><Mail className="h-3.5 w-3.5" />Send My Diagnostic</>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white/[0.03] rounded-2xl border border-[#5cf28e]/20 p-6 text-center" style={{ animation: 'rFadeUp 0.4s ease both' }}>
            <CheckCircle2 className="h-8 w-8 text-[#5cf28e] mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">Diagnostic sent.</h4>
            <p className="text-white/35 text-sm">Check your inbox — your DREAM pattern analysis is on its way.</p>
          </div>
        )}

        {/* suppress unused variable warning for overallLevelIndex */}
        {overallLevelIndex != null && (
          <button onClick={reset} className="text-xs text-white/15 hover:text-white/35 transition-colors">← Start over</button>
        )}
      </div>
    </section>
  );
}
