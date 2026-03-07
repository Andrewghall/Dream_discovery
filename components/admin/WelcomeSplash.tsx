'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  Brain,
  Users,
  Radio,
  Globe,
  FileText,
  HelpCircle,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface WelcomeSplashProps {
  userName?: string | null;
  orgLogoUrl?: string | null;
  orgPrimaryColor?: string | null;
  orgName?: string | null;
}

const STORAGE_KEY = 'dream_welcome_splash_dismissed';

const STEPS = [
  {
    icon: PlusCircle,
    step: '1',
    title: 'Create a Workshop',
    action: 'New Workshop → fill in title, context, and objectives.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    dot: 'bg-violet-500',
  },
  {
    icon: Brain,
    step: '2',
    title: 'Run AI Prep',
    action: 'Open the workshop → Run Prep. Generates blueprint, questions, actors, and lenses in ~90 seconds.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
  {
    icon: Users,
    step: '3',
    title: 'Invite Participants',
    action: 'Share the Capture link. Participants join on any device, register their name and role.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  {
    icon: Radio,
    step: '4',
    title: 'Facilitate Live',
    action: 'Open Cognitive Guidance. Questions, sub-questions, and node capture all happen in real time.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    dot: 'bg-orange-500',
  },
  {
    icon: Globe,
    step: '5',
    title: 'Synthesise',
    action: 'Open Hemisphere → Generate Report. AI synthesises every insight into structured strategic output.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    dot: 'bg-cyan-500',
  },
  {
    icon: FileText,
    step: '6',
    title: 'Review Output',
    action: 'View Output → full report with Executive Summary, Insights, Constraints, Solutions, and Journey Map.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    dot: 'bg-rose-500',
  },
];

export function WelcomeSplash({ userName, orgLogoUrl, orgPrimaryColor, orgName }: WelcomeSplashProps) {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
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
      {/* Trigger — always accessible from dashboard header */}
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
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">

          {/* Header */}
          <div
            className="relative px-7 py-6"
            style={{
              background: `linear-gradient(135deg, ${accentColor}22 0%, #0d0d0d 100%)`,
              borderBottom: `2px solid ${accentColor}33`,
            }}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Logo / org name */}
            <div className="flex items-center gap-3 mb-3">
              {orgLogoUrl ? (
                <div className="relative h-8 w-24">
                  <Image src={orgLogoUrl} alt={orgName || 'Organisation'} fill className="object-contain object-left" />
                </div>
              ) : orgName ? (
                <span className="text-white font-semibold text-sm">{orgName}</span>
              ) : null}
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${accentColor}30`, color: accentColor }}
              >
                DREAM Discovery
              </span>
            </div>

            <h2 className="text-white text-xl font-bold leading-tight">
              {userName ? `Welcome, ${userName}` : 'Welcome to DREAM Discovery'}
            </h2>
            <p className="text-white/50 text-xs mt-1">Six steps from blank workshop to fully synthesised strategic output.</p>
          </div>

          {/* Steps — 2 column grid */}
          <div className="px-7 py-5 bg-white">
            <div className="grid grid-cols-2 gap-3">
              {STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.step} className={`flex gap-3 p-3.5 rounded-xl ${s.bg}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="relative">
                        <Icon className={`h-4 w-4 ${s.color}`} />
                        <span
                          className={`absolute -top-1.5 -right-2 text-[9px] font-bold text-white w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none ${s.dot}`}
                        >
                          {s.step}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold mb-0.5 ${s.color}`}>{s.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{s.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                Don&apos;t show this again
              </label>
              <Link
                href="/terms"
                target="_blank"
                className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
              >
                Terms &amp; Conditions
              </Link>
            </div>
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
