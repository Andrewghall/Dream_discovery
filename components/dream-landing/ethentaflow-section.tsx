'use client';

import { Brain, Sparkles, BarChart3 } from 'lucide-react';
import { ScrollReveal } from './scroll-reveal';

const CAPABILITIES = [
  {
    icon: Brain,
    iconBg: 'bg-emerald-100 text-emerald-700',
    title: 'Capture Everything',
    description:
      'Every insight, constraint, and vision is captured through AI-guided conversations across five organisational domains. No signal is lost.',
  },
  {
    icon: Sparkles,
    iconBg: 'bg-indigo-100 text-indigo-600',
    title: 'Synthesise in Real-Time',
    description:
      'Multiple specialist AI agents work in concert  -  a Facilitation Orchestrator coordinates theme clustering, question generation, and pattern recognition agents as the workshop unfolds. Insights compound in real-time.',
  },
  {
    icon: BarChart3,
    iconBg: 'bg-purple-100 text-purple-600',
    title: 'Deliver Intelligence',
    description:
      'Seven analytical views transform raw dialogue into sentiment indices, bias detection, balance safeguards, and multi-lens confidence scoring.',
  },
];

export function EthentaFlowSection() {
  return (
    <section id="ethentaflow" className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <ScrollReveal>
          <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3">
            The Technology
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Powered by{' '}
            <span className="bg-gradient-to-r from-[#5cf28e] to-[#50c878] bg-clip-text text-transparent">
              EthentaFlow&trade;
            </span>
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <p className="text-lg text-slate-600 max-w-2xl mb-14">
            The capture-and-synthesise engine that transforms conversations into organisational intelligence.
          </p>
        </ScrollReveal>

        {/* Capability cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <ScrollReveal key={cap.title} delay={200 + i * 100}>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200 h-full">
                  <div className={`w-12 h-12 rounded-xl ${cap.iconBg} flex items-center justify-center mb-5`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{cap.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{cap.description}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Pull quote */}
        <ScrollReveal delay={500}>
          <div className="max-w-3xl mx-auto text-center">
            <div className="relative px-8 py-6">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#5cf28e]/10 via-[#50c878]/10 to-[#33824d]/10" />
              <p className="relative text-xl md:text-2xl text-slate-700 italic font-medium leading-relaxed">
                &ldquo;EthentaFlow doesn&rsquo;t summarise what was said. It reveals what the organisation actually thinks.&rdquo;
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
