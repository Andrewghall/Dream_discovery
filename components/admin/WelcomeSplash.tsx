'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  Brain,
  Users,
  Radio,
  Globe,
  FileText,
  ChevronRight,
  HelpCircle,
  X,
} from 'lucide-react';
import Image from 'next/image';

interface WelcomeSplashProps {
  /** User's first name for personalisation */
  userName?: string | null;
  /** Org logo URL */
  orgLogoUrl?: string | null;
  /** Org primary colour for accent */
  orgPrimaryColor?: string | null;
  /** Org name */
  orgName?: string | null;
}

const STORAGE_KEY = 'dream_welcome_splash_dismissed';

const STEPS = [
  {
    icon: PlusCircle,
    step: '1',
    title: 'Create a Workshop',
    desc: 'Set up your discovery session with a title, context, and objectives. Choose the workshop type (Discovery, Reimagine, or Full Cycle) to shape the AI\'s focus.',
    tip: 'Add rich context — the more the AI knows about your organisation, the sharper the insights.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: Brain,
    step: '2',
    title: 'Run AI Prep',
    desc: 'Once created, open the workshop and click Run Prep. The AI Research Agent builds your discovery blueprint: question sets, actor taxonomy, journey stages, and lens categories.',
    tip: 'Prep takes 60–90 seconds. Review the blueprint before going live — edit lens names or actors to match your organisation.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: Users,
    step: '3',
    title: 'Invite Participants',
    desc: 'Share the Capture link with workshop participants. They join on their own devices — mobile-friendly. Each participant registers with a name and role.',
    tip: 'You can run individual discovery calls or group sessions. The capture link stays open until you close it.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: Radio,
    step: '4',
    title: 'Facilitate Live Session',
    desc: 'Open Cognitive Guidance to run your live session. Main questions guide the conversation, AI-generated sub-questions help you dig deeper, and nodes capture every insight in real time.',
    tip: 'Speak naturally — the AI tags lens coverage, detects contradictions, and builds the journey map as you go.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
  {
    icon: Globe,
    step: '5',
    title: 'Synthesise with Hemisphere',
    desc: 'Open the Hemisphere page to see all insights visualised as a 3D node network. Click Generate Report — the AI synthesises themes, constraints, actors, and strategic signals into structured output.',
    tip: 'Use lens filters and the Diagnostic tab to explore contradictions and coverage gaps before generating.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-100',
  },
  {
    icon: FileText,
    step: '6',
    title: 'Review Output Report',
    desc: 'The Output page contains your full AI-generated report: Executive Summary, Discovery Insights, Constraints Analysis, Potential Solutions, Commercial Impact, and Customer Journey narrative.',
    tip: 'Use View Output → after synthesis completes. Each section can be copied or exported as a standalone HTML package.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
];

export function WelcomeSplash({ userName, orgLogoUrl, orgPrimaryColor, orgName }: WelcomeSplashProps) {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Show on first visit or if not permanently dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay so the dashboard loads first
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(false);
  };

  const accentColor = orgPrimaryColor || '#5cf28e';

  return (
    <>
      {/* Trigger button — always accessible */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs"
        title="Platform guide"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Guide
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Brand header */}
          <div
            className="relative px-8 py-7 rounded-t-lg"
            style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, #0d0d0d 100%)`, borderBottom: `2px solid ${accentColor}33` }}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-4 mb-3">
              {orgLogoUrl ? (
                <div className="relative h-10 w-28">
                  <Image src={orgLogoUrl} alt={orgName || 'Organisation logo'} fill className="object-contain object-left" />
                </div>
              ) : orgName ? (
                <span className="text-white font-bold text-lg">{orgName}</span>
              ) : null}

              <Badge className="text-[10px] font-semibold" style={{ backgroundColor: `${accentColor}33`, color: accentColor, border: `1px solid ${accentColor}44` }}>
                DREAM Discovery
              </Badge>
            </div>

            <DialogHeader>
              <DialogTitle className="text-white text-2xl font-bold">
                {userName ? `Welcome, ${userName} 👋` : 'Welcome to DREAM Discovery'}
              </DialogTitle>
              <p className="text-white/60 text-sm mt-1">
                Here's how to get from a blank workshop to a fully synthesised strategic output — in six steps.
              </p>
            </DialogHeader>
          </div>

          {/* Workflow steps */}
          <div className="px-8 py-6">
            <div className="grid grid-cols-1 gap-4">
              {STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className={`flex gap-4 p-4 rounded-xl border ${s.border} ${s.bg}`}>
                    {/* Step number + icon */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} border ${s.border}`}>
                        <Icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{s.step}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800">{s.title}</h3>
                        <ChevronRight className="h-3 w-3 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-2">{s.desc}</p>
                      <p className="text-xs text-slate-500 italic flex items-start gap-1">
                        <span className={`font-bold not-italic ${s.color}`}>Tip:</span>
                        {s.tip}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick reference */}
            <div className="mt-6 p-4 bg-slate-800 rounded-xl">
              <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">Quick Reference — Where to find things</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 font-mono mt-0.5">›</span>
                  <span><strong className="text-slate-300">Dashboard</strong> — All workshops, create new</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 font-mono mt-0.5">›</span>
                  <span><strong className="text-slate-300">Workshop → Prep</strong> — AI blueprint generation</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 font-mono mt-0.5">›</span>
                  <span><strong className="text-slate-300">Workshop → Live Session</strong> — Cognitive guidance</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 font-mono mt-0.5">›</span>
                  <span><strong className="text-slate-300">Workshop → Hemisphere</strong> — 3D synthesis + generate</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 font-mono mt-0.5">›</span>
                  <span><strong className="text-slate-300">Workshop → Output</strong> — Generated report</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 font-mono mt-0.5">›</span>
                  <span><strong className="text-slate-300">Workshop → Discover</strong> — Deep analysis charts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-lg">
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Don't show this again
            </label>

            <Button
              onClick={handleClose}
              style={{ backgroundColor: accentColor, color: '#0d0d0d' }}
              className="font-semibold hover:opacity-90 text-sm"
            >
              Get Started →
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
