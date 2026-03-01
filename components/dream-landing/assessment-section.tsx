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
} from 'lucide-react';
import { ScrollReveal, AnimatedCounter } from './scroll-reveal';
import { RadarChart } from './radar-chart';

/* ────────────────────────────────────────────────────────────
   Types & Data
   ──────────────────────────────────────────────────────────── */

interface DomainQuestion {
  id: string;
  text: string;
}

interface Domain {
  key: string;
  name: string;
  icon: typeof Users;
  colour: string;         // tailwind bg class
  colourHex: string;      // for accents
  questions: [DomainQuestion, DomainQuestion];
}

const DOMAINS: Domain[] = [
  {
    key: 'people',
    name: 'People',
    icon: Users,
    colour: 'bg-blue-500',
    colourHex: '#3b82f6',
    questions: [
      { id: 'p1', text: 'How effectively does your organisation develop and retain the skills needed for its strategic goals?' },
      { id: 'p2', text: 'How well does leadership communicate vision and create alignment across teams?' },
    ],
  },
  {
    key: 'organisation',
    name: 'Organisation',
    icon: Building2,
    colour: 'bg-green-500',
    colourHex: '#22c55e',
    questions: [
      { id: 'o1', text: 'How agile are your governance and decision-making processes when responding to change?' },
      { id: 'o2', text: 'How effectively do cross-functional teams collaborate on shared objectives?' },
    ],
  },
  {
    key: 'customer',
    name: 'Customer',
    icon: Heart,
    colour: 'bg-purple-500',
    colourHex: '#a855f7',
    questions: [
      { id: 'c1', text: 'How well does your organisation understand and respond to changing customer expectations?' },
      { id: 'c2', text: 'How seamlessly do customers experience your services across different touchpoints?' },
    ],
  },
  {
    key: 'technology',
    name: 'Technology',
    icon: Cpu,
    colour: 'bg-orange-500',
    colourHex: '#f97316',
    questions: [
      { id: 't1', text: 'How modern and integrated is your technology landscape for supporting business goals?' },
      { id: 't2', text: 'How effectively does your organisation leverage data for strategic decision-making?' },
    ],
  },
  {
    key: 'regulation',
    name: 'Regulation',
    icon: Scale,
    colour: 'bg-red-500',
    colourHex: '#ef4444',
    questions: [
      { id: 'r1', text: 'How well does your compliance framework enable (rather than hinder) innovation?' },
      { id: 'r2', text: 'How confident are you that your organisation can adapt to new regulatory requirements?' },
    ],
  },
];

interface Scores {
  [questionId: string]: { current: number; target: number };
}

const DEFAULT_SCORES: Scores = Object.fromEntries(
  DOMAINS.flatMap((d) =>
    d.questions.map((q) => [q.id, { current: 5, target: 7 }]),
  ),
);

interface DomainResult {
  name: string;
  colourHex: string;
  current: number;
  target: number;
  gap: number;
}

/* ────────────────────────────────────────────────────────────
   Recommendation Logic
   ──────────────────────────────────────────────────────────── */

interface Recommendation {
  headline: string;
  body: string;
  focus: 'Foundation' | 'Acceleration' | 'Optimisation';
}

function getRecommendation(
  results: DomainResult[],
  overallReadiness: number,
): Recommendation {
  const sorted = [...results].sort((a, b) => b.gap - a.gap);
  const topGap = sorted[0];

  let focus: Recommendation['focus'];
  if (overallReadiness < 4) focus = 'Foundation';
  else if (overallReadiness <= 6) focus = 'Acceleration';
  else focus = 'Optimisation';

  const domainAdvice: Record<string, string> = {
    People: 'building leadership alignment and skills capability',
    Organisation: 'strengthening governance agility and cross-functional collaboration',
    Customer: 'deepening customer understanding and journey coherence',
    Technology: 'modernising your technology landscape and data strategy',
    Regulation: 'reframing compliance as an enabler of innovation',
  };

  const advice = domainAdvice[topGap.name] || 'addressing your organisational gaps';

  const headlines: Record<string, string> = {
    Foundation: 'Build Your Foundation',
    Acceleration: 'Accelerate Your Transformation',
    Optimisation: 'Optimise What You\'ve Built',
  };

  const bodies: Record<string, string> = {
    Foundation: `Your organisation is in the early stages of transformation readiness. The biggest opportunity lies in ${advice}. A DREAM Foundation workshop would help you build the shared understanding and strategic clarity needed to move forward with confidence.`,
    Acceleration: `Your organisation has a solid base but significant gaps remain — particularly in ${advice}. A DREAM Acceleration workshop would cut through the noise, align your teams around the gaps that matter most, and build a constraint-aware roadmap for transformation.`,
    Optimisation: `Your organisation is relatively mature but there are still meaningful gaps — especially in ${advice}. A DREAM Optimisation workshop would help you fine-tune your strategy, identify the constraints holding you back from the next level, and design a focused path forward.`,
  };

  return {
    headline: headlines[focus],
    body: bodies[focus],
    focus,
  };
}

/* ────────────────────────────────────────────────────────────
   Custom Slider
   ──────────────────────────────────────────────────────────── */

function MaturitySlider({
  label,
  value,
  onChange,
  accentHex,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accentHex: string;
}) {
  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <span
          className="text-sm font-bold tabular-nums min-w-[2ch] text-center"
          style={{ color: accentHex }}
        >
          {value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-input w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${accentHex} 0%, ${accentHex} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-300 px-0.5">
        <span>1</span>
        <span>5</span>
        <span>10</span>
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
    (qId: string, field: 'current' | 'target', val: number) => {
      setScores((prev) => ({
        ...prev,
        [qId]: { ...prev[qId], [field]: val },
      }));
    },
    [],
  );

  // ── Computed results ────────────────────────────────────────

  const domainResults: DomainResult[] = useMemo(
    () =>
      DOMAINS.map((d) => {
        const s1 = scores[d.questions[0].id];
        const s2 = scores[d.questions[1].id];
        const current = (s1.current + s2.current) / 2;
        const target = (s1.target + s2.target) / 2;
        return {
          name: d.name,
          colourHex: d.colourHex,
          current: Math.round(current * 10) / 10,
          target: Math.round(target * 10) / 10,
          gap: Math.round((target - current) * 10) / 10,
        };
      }),
    [scores],
  );

  const overallReadiness = useMemo(
    () => Math.round((domainResults.reduce((s, r) => s + r.current, 0) / domainResults.length) * 10) / 10,
    [domainResults],
  );

  const transformationDistance = useMemo(
    () => Math.round((domainResults.reduce((s, r) => s + r.gap, 0) / domainResults.length) * 10) / 10,
    [domainResults],
  );

  const topGaps = useMemo(
    () => [...domainResults].sort((a, b) => b.gap - a.gap).slice(0, 3),
    [domainResults],
  );

  const recommendation = useMemo(
    () => getRecommendation(domainResults, overallReadiness),
    [domainResults, overallReadiness],
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
        scores: DOMAINS.map((d) => ({
          domain: d.name,
          current: domainResults.find((r) => r.name === d.name)!.current,
          target: domainResults.find((r) => r.name === d.name)!.target,
        })),
        overallReadiness,
        transformationDistance,
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
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
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
                  Assess Your{' '}
                  <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
                    Readiness
                  </span>
                </h2>
                <p className="text-white/60 leading-relaxed mb-6">
                  Rate your organisation across five critical domains — People, Organisation,
                  Customer, Technology, and Regulation — to see where you are today versus where you
                  need to be. Get an instant gap analysis with a visual radar diagram, plus a
                  personalised PDF report with workshop recommendations.
                </p>
                <div className="flex flex-wrap gap-4 mb-8">
                  {DOMAINS.map((d) => {
                    const Icon = d.icon;
                    return (
                      <div key={d.key} className="flex items-center gap-1.5 text-white/50">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: d.colourHex }}
                        />
                        <span className="text-xs">{d.name}</span>
                      </div>
                    );
                  })}
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

    return (
      <section className="bg-gradient-to-b from-slate-50 to-white py-20">
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
                        i < step
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
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${domain.colourHex}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color: domain.colourHex }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{domain.name}</h3>
                  <p className="text-xs text-slate-400">
                    Step {step} of 5
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                {domain.questions.map((q, qi) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-slate-700 mb-4 leading-relaxed">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white mr-2"
                        style={{ backgroundColor: domain.colourHex }}
                      >
                        {qi + 1}
                      </span>
                      {q.text}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4 pl-7">
                      <MaturitySlider
                        label="Where are you today?"
                        value={scores[q.id].current}
                        onChange={(v) => updateScore(q.id, 'current', v)}
                        accentHex={domain.colourHex}
                      />
                      <MaturitySlider
                        label="Where do you need to be?"
                        value={scores[q.id].target}
                        onChange={(v) => updateScore(q.id, 'target', v)}
                        accentHex={domain.colourHex}
                      />
                    </div>
                  </div>
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all"
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
    <section className="bg-gradient-to-b from-slate-50 to-white py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
            Your Results
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
            Readiness Assessment
          </h2>
          <p className="text-slate-500">Here&apos;s where your organisation stands today.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          {/* ── Left: Radar + scores ── */}
          <div className="flex flex-col items-center">
            <RadarChart
              domains={DOMAINS.map((d) => d.name)}
              current={domainResults.map((r) => r.current)}
              target={domainResults.map((r) => r.target)}
              animated
            />

            <div className="flex items-center gap-6 mt-4 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded bg-[#5cf28e]" />
                <span className="text-xs text-slate-500">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded border border-[#5cf28e]" style={{ borderStyle: 'dashed' }} />
                <span className="text-xs text-slate-500">Target</span>
              </div>
            </div>

            {/* Overall scores */}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <div className="text-3xl font-black text-slate-900">
                  <AnimatedCounter target={Math.round(overallReadiness * 10)} duration={1200} suffix="" />
                  <span className="text-lg font-bold text-slate-400">/{10}</span>
                </div>
                <div className="text-xs text-slate-500">Overall Readiness</div>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-black text-[#5cf28e]">
                  +{transformationDistance.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Avg. Gap</div>
              </div>
            </div>
          </div>

          {/* ── Right: Gaps + recommendation + email ── */}
          <div className="space-y-6">
            {/* Top gaps */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                Your Top Gaps
              </h3>
              <div className="space-y-3">
                {topGaps.map((gap, i) => (
                  <div
                    key={gap.name}
                    className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: gap.colourHex }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-900">{gap.name}</span>
                        <span className="text-sm font-bold" style={{ color: gap.colourHex }}>
                          +{gap.gap}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(gap.current / 10) * 100}%`,
                              backgroundColor: gap.colourHex,
                              opacity: 0.6,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {gap.current} → {gap.target}
                        </span>
                      </div>
                    </div>
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
                  We&apos;ll send you a detailed PDF with your radar chart, domain scores, gap analysis,
                  and personalised workshop recommendation.
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
                        Generating report…
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
                  Check your inbox — your personalised readiness report is on its way.
                </p>
                <a
                  href="mailto:hello@ethenta.com?subject=DREAM%20Assessment%20—%20Book%20a%20Demo"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all"
                >
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </a>
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
              ← Retake assessment
            </button>
          </div>
        </div>
      </div>

      {/* ── Slider custom styles ── */}
      <style jsx global>{`
        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #5cf28e;
          border: 2px solid #0d0d0d;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        }
        .slider-input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #5cf28e;
          border: 2px solid #0d0d0d;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        }
        .slider-input::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 9999px;
        }
        .slider-input::-moz-range-track {
          height: 8px;
          border-radius: 9999px;
          background: transparent;
        }
      `}</style>
    </section>
  );
}
