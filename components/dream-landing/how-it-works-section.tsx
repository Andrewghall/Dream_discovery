'use client';

import { MessageSquare, Users, BarChart3 } from 'lucide-react';
import { ScrollReveal } from './scroll-reveal';

const STEPS = [
  {
    number: 1,
    icon: MessageSquare,
    title: 'Before the Workshop',
    subtitle: 'AI-Powered Discovery',
    points: [
      '15-minute AI-guided conversations with each participant',
      'Structured extraction across People, Organisation, Customer, Technology, Regulation',
      'Individual maturity ratings and confidence scoring',
      'Automatic insight extraction and theme detection',
    ],
  },
  {
    number: 2,
    icon: Users,
    title: 'During the Workshop',
    subtitle: 'Live Cognitive Guidance',
    points: [
      'AI-powered facilitation through Reimagine, Constraints, and Apply phases',
      'Real-time synthesis using Agentic AI facilitation',
      'Dynamic question generation grounded in Discovery data',
      '360\u00B0 Hemisphere builds live on-screen',
    ],
  },
  {
    number: 3,
    icon: BarChart3,
    title: 'After the Workshop',
    subtitle: 'Decision Intelligence',
    points: [
      'Post-live analytical dashboard with 7 deep views',
      'Hemisphere Psyche Diagnostic comparing before and after',
      'Executive scratchpad with editable strategic deliverables',
      'Exportable reports for board-level presentation',
    ],
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <ScrollReveal>
          <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
            The Journey
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-14 text-center">
            From Conversation to Action
          </h2>
        </ScrollReveal>

        {/* Timeline */}
        <div className="relative">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-0.5 border-t-2 border-dashed border-[#50c878]/40" />

          <div className="grid md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.number} delay={200 + i * 150}>
                  <div className="text-center">
                    {/* Number circle */}
                    <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#5cf28e]/10 to-[#50c878]/10 border-2 border-[#50c878]/30 mb-6">
                      <Icon className="h-8 w-8 text-[#33824d]" />
                      <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-[#5cf28e] to-[#50c878] text-[#0d0d0d] text-xs font-bold flex items-center justify-center shadow-md">
                        {step.number}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{step.title}</h3>
                    <p className="text-sm text-[#33824d] font-medium mb-4">{step.subtitle}</p>

                    {/* Points */}
                    <ul className="text-left space-y-2 max-w-xs mx-auto">
                      {step.points.map((point) => (
                        <li key={point} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#50c878] flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
