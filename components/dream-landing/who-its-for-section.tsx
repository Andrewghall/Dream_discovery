'use client';

import { Building2, Lightbulb, Briefcase, Shield } from 'lucide-react';
import { ScrollReveal } from './scroll-reveal';

const PERSONAS = [
  {
    icon: Building2,
    iconBg: 'bg-blue-100 text-blue-600',
    title: 'Enterprise Transformation Teams',
    description:
      'Leading large-scale digital, cultural, or operational transformation? DREAM captures every voice and surfaces the tensions that derail programmes before they start.',
  },
  {
    icon: Lightbulb,
    iconBg: 'bg-purple-100 text-purple-600',
    title: 'Strategy & Innovation Leaders',
    description:
      'Need a 360-degree view before making strategic bets? DREAM gives you the organisational truth that PowerPoint decks and steering committees hide.',
  },
  {
    icon: Briefcase,
    iconBg: 'bg-emerald-100 text-emerald-600',
    title: 'Consultancies & Advisory Firms',
    description:
      'Deliver deeper client insight in less time. DREAM replaces weeks of interviews with structured AI-powered intelligence that clients have never seen before.',
  },
  {
    icon: Shield,
    iconBg: 'bg-amber-100 text-amber-700',
    title: 'Regulated Industries',
    description:
      'Financial services, healthcare, government. DREAM maps constraints as first-class citizens and balances innovation with governance and compliance.',
  },
];

export function WhoItsForSection() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <ScrollReveal>
          <p className="text-[#50c878] text-sm font-semibold tracking-[0.15em] uppercase mb-3 text-center">
            Who It&apos;s For
          </p>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-14 text-center">
            Built for Organisations That Demand Clarity
          </h2>
        </ScrollReveal>

        {/* Persona cards — 2x2 */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {PERSONAS.map((persona, i) => {
            const Icon = persona.icon;
            return (
              <ScrollReveal key={persona.title} delay={200 + i * 100}>
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className={`w-12 h-12 rounded-xl ${persona.iconBg} flex items-center justify-center mb-5`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{persona.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{persona.description}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
