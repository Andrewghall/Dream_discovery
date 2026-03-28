'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Bot, User, Users, ArrowRight, ArrowDown } from 'lucide-react';
import type { FutureStateDesign, FutureStateTheme } from '@/lib/output-intelligence/types';

interface Props {
  data: FutureStateDesign;
}

// ── AI/Human helpers ─────────────────────────────────────────────────────────

function RecommendationIcon({ rec }: { rec: 'AI Only' | 'AI Assisted' | 'Human Only' }) {
  if (rec === 'AI Only') return <Bot className="h-4 w-4 text-purple-500" />;
  if (rec === 'AI Assisted') return <Users className="h-4 w-4 text-blue-500" />;
  return <User className="h-4 w-4 text-slate-500" />;
}

function RecommendationBadge({ rec }: { rec: 'AI Only' | 'AI Assisted' | 'Human Only' }) {
  const styles = {
    'AI Only':     'bg-purple-50 text-purple-700 border-purple-200',
    'AI Assisted': 'bg-blue-50 text-blue-700 border-blue-200',
    'Human Only':  'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[rec]}`}>
      <RecommendationIcon rec={rec} />
      {rec}
    </span>
  );
}

// ── Badge pill ───────────────────────────────────────────────────────────────

function ThemeBadge({ badge }: { badge: FutureStateTheme['badge'] }) {
  const styles: Record<FutureStateTheme['badge'], string> = {
    'very high': 'bg-rose-100 text-rose-700',
    'high':      'bg-amber-100 text-amber-700',
    'medium':    'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[badge]}`}>
      {badge} weighting
    </span>
  );
}

// ── Reimagined Journey section ───────────────────────────────────────────────

function ActorIcon({ actor }: { actor: string }) {
  const a = actor.toLowerCase();
  if (a.includes('customer') || a.includes('passenger')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
        <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    );
  }
  if (a.includes('bpo')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    );
  }
  if (a.includes('manager') || a.includes('leader') || a.includes('head') || a.includes('director') || a.includes('chief')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    );
  }
  // Frontline / agent default
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

type ActorJourney = NonNullable<FutureStateDesign['reimaginedJourney']>['actorJourneys'][number];

function ActorJourneyCard({ journey }: { journey: ActorJourney }) {
  const isCustomer = journey.actor.toLowerCase().includes('customer') || journey.actor.toLowerCase().includes('passenger');
  const accentBorder = isCustomer ? 'border-indigo-200' : 'border-slate-200';
  const accentTop    = isCustomer ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white';

  return (
    <div className={`rounded-xl border ${accentBorder} overflow-hidden shadow-sm`}>
      {/* Actor header */}
      <div className={`${accentTop} px-5 py-3 flex items-center gap-2.5`}>
        <ActorIcon actor={journey.actor} />
        <span className="font-bold text-sm tracking-wide">{journey.actor}</span>
      </div>

      <div className="p-5 space-y-4 bg-white">
        {/* Today */}
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Today</p>
          <p className="text-sm text-slate-600 leading-relaxed">{journey.currentReality}</p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowDown className="h-4 w-4 text-slate-300" />
        </div>

        {/* Tomorrow */}
        <div className={`rounded-lg p-4 ${isCustomer ? 'bg-indigo-50 border border-indigo-100' : 'bg-emerald-50 border border-emerald-100'}`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${isCustomer ? 'text-indigo-500' : 'text-emerald-600'}`}>
            The Dream
          </p>
          <p className={`text-sm leading-relaxed ${isCustomer ? 'text-indigo-900' : 'text-emerald-900'}`}>
            {journey.reimaginedExperience}
          </p>
        </div>

        {/* Key enablers */}
        {(journey.keyEnablers ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {journey.keyEnablers.map((e, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Two-panel theme explorer ─────────────────────────────────────────────────

function ThemeExplorer({
  themes,
  startNumber,
  label,
  sublabel,
}: {
  themes: FutureStateTheme[];
  startNumber: number;
  label: string;
  sublabel: string;
}) {
  const [selected, setSelected] = useState(0);
  const active = themes[selected];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-700 text-white text-xs font-bold shrink-0">
          {startNumber}–{startNumber + themes.length - 1}
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">{label}</h3>
          <p className="text-xs text-slate-500">{sublabel}</p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

        {/* LEFT — theme list */}
        <div className="border-r border-slate-200 bg-white divide-y divide-slate-100">
          {themes.map((theme, i) => {
            const num = startNumber + i;
            const isActive = selected === i;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-left flex items-center gap-3 px-5 py-4 transition-colors ${
                  isActive
                    ? 'bg-orange-50 border-l-2 border-l-orange-600'
                    : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
              >
                {/* Number circle */}
                <span
                  className={`shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${
                    isActive ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {num}
                </span>
                {/* Title + badge */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${isActive ? 'text-orange-900' : 'text-slate-800'}`}>
                    {theme.title}
                  </p>
                  <div className="mt-0.5">
                    <ThemeBadge badge={theme.badge} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT — detail panel */}
        <div className="bg-white p-6 flex flex-col gap-5">
          {active && (
            <>
              {/* Active theme header */}
              <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
                <span className="shrink-0 w-8 h-8 rounded-full bg-orange-700 text-white text-sm font-bold flex items-center justify-center mt-0.5">
                  {startNumber + selected}
                </span>
                <div>
                  <ThemeBadge badge={active.badge} />
                  <h4 className="text-lg font-bold text-slate-900 mt-1 leading-snug">
                    {active.title}
                  </h4>
                </div>
              </div>

              {/* Description */}
              {active.description && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {active.description}
                </p>
              )}

              {/* Sub-sections */}
              {(active.subSections ?? []).map((sub, si) => (
                <div key={si}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    {sub.title}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {sub.detail}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function FutureStatePanel({ data }: Props) {
  const hasNewFormat = !!(data.title || data.primaryThemes?.length || data.directionOfTravel?.length);

  return (
    <div className="space-y-10">

      {hasNewFormat && (
        <>

          {/* 1. Badge + serif title + description */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-widest">
                Reimagine Output
              </span>
            </div>
            {data.title && (
              <h2
                className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-3"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
                {data.description}
              </p>
            )}
          </div>

          {/* 2. Three Houses — real images */}
          {data.threeHouses && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
                Transformation Arc
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col items-center text-center p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="relative w-28 h-24 mb-3">
                    <Image src="/framework/house-old.png" alt="Current state" fill className="object-contain" />
                  </div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Today</p>
                  <p className="font-bold text-slate-700 text-sm leading-snug mb-1.5">{data.threeHouses.current.label}</p>
                  <p className="text-xs text-slate-500 leading-snug">{data.threeHouses.current.description}</p>
                </div>
                <div className="flex flex-col items-center text-center p-5 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="relative w-28 h-24 mb-3">
                    <Image src="/framework/house-refreshed.png" alt="In transition" fill className="object-contain" />
                  </div>
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">In Progress</p>
                  <p className="font-bold text-indigo-700 text-sm leading-snug mb-1.5">{data.threeHouses.transition.label}</p>
                  <p className="text-xs text-indigo-500 leading-snug">{data.threeHouses.transition.description}</p>
                </div>
                <div className="flex flex-col items-center text-center p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="relative w-28 h-24 mb-3">
                    <Image src="/framework/house-ideal.png" alt="Future vision" fill className="object-contain" />
                  </div>
                  <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">Vision</p>
                  <p className="font-bold text-emerald-800 text-sm leading-snug mb-1.5">{data.threeHouses.future.label}</p>
                  <p className="text-xs text-emerald-600 leading-snug">{data.threeHouses.future.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. The Journey Reimagined — actor perspective cards */}
          {data.reimaginedJourney && (data.reimaginedJourney.actorJourneys ?? []).length > 0 && (
            <div>
              <div className="mb-5">
                <h3 className="text-xl font-bold text-slate-900">{data.reimaginedJourney.headline || 'The Journey Reimagined'}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  What each actor experiences in the future state — grounded in their own signals.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.reimaginedJourney.actorJourneys.map((j, i) => (
                  <ActorJourneyCard key={i} journey={j} />
                ))}
              </div>
            </div>
          )}

          {/* 4. Primary themes — two-panel explorer */}
          {(data.primaryThemes ?? []).length > 0 && (
            <ThemeExplorer
              themes={data.primaryThemes!}
              startNumber={1}
              label="Primary themes"
              sublabel="Highest weighting — these topics dominated the discussion"
            />
          )}

          {/* 5. Supporting themes — two-panel explorer */}
          {(data.supportingThemes ?? []).length > 0 && (
            <ThemeExplorer
              themes={data.supportingThemes!}
              startNumber={(data.primaryThemes?.length ?? 5) + 1}
              label="Supporting themes"
              sublabel="Important but secondary — meaningful signals worth tracking"
            />
          )}

          {/* 6. Vision Alignment */}
          {data.visionAlignment && (
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Platform Vision Alignment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-slate-900 text-white">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Core Principles</p>
                  <ul className="space-y-3">
                    {(data.visionAlignment.corePrinciples ?? []).map((p, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                        <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span className="leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6 rounded-xl bg-indigo-600 text-white">
                  <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-4">Platform Position</p>
                  <p className="text-sm text-indigo-100 leading-relaxed">{data.visionAlignment.platformPosition}</p>
                </div>
              </div>
            </div>
          )}

          {/* 7. Horizon Vision */}
          {data.horizonVision && (
            <div className="p-7 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-3">Horizon Vision</p>
              <p
                className="text-base sm:text-lg leading-relaxed text-indigo-100 italic"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                "{data.horizonVision}"
              </p>
            </div>
          )}

          {/* 8. Overall direction of travel — bottom */}
          {(data.directionOfTravel ?? []).length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Overall direction of travel</h3>
              <p className="text-sm text-slate-500 mb-5">
                The fundamental shifts this organisation must make to realise its vision.
              </p>
              <div className="space-y-3">
                {data.directionOfTravel!.map((shift, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-slate-500 font-medium text-sm flex-1 min-w-0">{shift.from}</span>
                    <ArrowRight className="shrink-0 h-4 w-4 text-slate-300" />
                    <span className="text-orange-700 font-bold text-sm flex-1 min-w-0">{shift.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider before technical detail */}
          <div className="border-t border-slate-200 pt-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Technical Model Detail</p>
          </div>

        </>
      )}

      {/* ── Legacy fallback ───────────────────────────────────────────────── */}
      {!hasNewFormat && data.targetOperatingModel && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-3">Target Operating Model</p>
          <p className="text-sm leading-relaxed text-indigo-100">{data.targetOperatingModel}</p>
        </div>
      )}

      {hasNewFormat && data.targetOperatingModel && (
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Target Operating Model</p>
          <p className="text-sm leading-relaxed text-slate-700">{data.targetOperatingModel}</p>
        </div>
      )}

      {data.narrative && !hasNewFormat && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-sm text-slate-600 leading-relaxed italic">{data.narrative}</p>
        </div>
      )}

      {(data.redesignPrinciples ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Design Principles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.redesignPrinciples.map((p, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <p className="text-sm text-slate-700">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.aiHumanModel ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">AI / Human Model ({data.aiHumanModel.length} tasks)</h3>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[40%]">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[20%]">Recommendation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.aiHumanModel.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-800 font-medium">{item.task}</td>
                    <td className="px-4 py-3"><RecommendationBadge rec={item.recommendation} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(data.operatingModelChanges ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Operating Model Changes</h3>
          <div className="space-y-3">
            {data.operatingModelChanges.map((change, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{change.area}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Current State</p>
                    <p className="text-sm text-slate-700">{change.currentState}</p>
                  </div>
                  <div className="flex items-center justify-center text-slate-300 text-2xl">→</div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Future State</p>
                    <p className="text-sm text-slate-700 font-medium">{change.futureState}</p>
                  </div>
                </div>
                {change.enabler && (
                  <p className="mt-3 text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                    <span className="font-semibold">Enabler:</span> {change.enabler}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
