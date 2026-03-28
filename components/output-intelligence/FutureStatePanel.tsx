'use client';

import { useState } from 'react';
import { Bot, User, Users, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import type { FutureStateDesign, FutureStateTheme } from '@/lib/output-intelligence/types';

interface Props {
  data: FutureStateDesign;
}

// ── AI/Human helpers (kept for technical model section) ─────────────────────

function RecommendationIcon({ rec }: { rec: 'AI Only' | 'AI Assisted' | 'Human Only' }) {
  if (rec === 'AI Only') return <Bot className="h-4 w-4 text-purple-500" />;
  if (rec === 'AI Assisted') return <Users className="h-4 w-4 text-blue-500" />;
  return <User className="h-4 w-4 text-slate-500" />;
}

function RecommendationBadge({ rec }: { rec: 'AI Only' | 'AI Assisted' | 'Human Only' }) {
  const styles = {
    'AI Only': 'bg-purple-50 text-purple-700 border-purple-200',
    'AI Assisted': 'bg-blue-50 text-blue-700 border-blue-200',
    'Human Only': 'bg-slate-100 text-slate-600 border-slate-200',
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
  const styles = {
    'very high': 'bg-rose-100 text-rose-700 border border-rose-200',
    'high':      'bg-amber-100 text-amber-700 border border-amber-200',
    'medium':    'bg-slate-100 text-slate-500 border border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[badge]}`}>
      {badge}
    </span>
  );
}

// ── Expandable theme card ────────────────────────────────────────────────────

function ThemeCard({
  theme,
  number,
  isPrimary,
}: {
  theme: FutureStateTheme;
  number: number;
  isPrimary: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const accentBg = isPrimary ? 'from-slate-50 to-white' : 'from-slate-50/50 to-white';
  const numberBg = isPrimary ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600';
  const borderColor = isPrimary ? 'border-slate-200 hover:border-slate-300' : 'border-slate-100 hover:border-slate-200';
  const subBg = isPrimary ? 'bg-indigo-50/60 border-indigo-100' : 'bg-slate-50 border-slate-100';
  const subTitleColor = isPrimary ? 'text-indigo-800' : 'text-slate-700';

  return (
    <div className={`rounded-xl border ${borderColor} bg-gradient-to-br ${accentBg} transition-colors`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5"
      >
        <div className="flex items-start gap-4">
          <span className={`shrink-0 w-8 h-8 rounded-full ${numberBg} text-sm font-bold flex items-center justify-center mt-0.5`}>
            {number}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <ThemeBadge badge={theme.badge} />
            </div>
            <h4 className={`font-semibold text-base ${isPrimary ? 'text-slate-900' : 'text-slate-700'} leading-snug`}>
              {theme.title}
            </h4>
            {theme.description && (
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {theme.description}
              </p>
            )}
          </div>
          <span className="shrink-0 mt-1 text-slate-400">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </div>
      </button>

      {expanded && theme.subSections && theme.subSections.length > 0 && (
        <div className="px-5 pb-5 pt-1 space-y-3">
          {theme.subSections.map((sub, si) => (
            <div key={si} className={`p-4 rounded-lg border ${subBg}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${subTitleColor}`}>
                {sub.title}
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">{sub.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Three Houses ─────────────────────────────────────────────────────────────

function HouseIcon({ variant }: { variant: 'current' | 'transition' | 'future' }) {
  // Simple SVG house silhouettes with different states
  if (variant === 'current') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <path d="M6 22L24 6l18 16v20H6V22z" stroke="#94a3b8" strokeWidth="2" fill="#f1f5f9" />
        <rect x="18" y="30" width="12" height="12" stroke="#94a3b8" strokeWidth="1.5" fill="#e2e8f0" />
        <line x1="24" y1="30" x2="24" y2="42" stroke="#94a3b8" strokeWidth="1.5" />
        <rect x="9" y="24" width="7" height="6" stroke="#94a3b8" strokeWidth="1.5" fill="#e2e8f0" />
        <rect x="32" y="24" width="7" height="6" stroke="#94a3b8" strokeWidth="1.5" fill="#e2e8f0" />
      </svg>
    );
  }
  if (variant === 'transition') {
    return (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
        <path d="M6 22L24 6l18 16v20H6V22z" stroke="#6366f1" strokeWidth="2" fill="#eef2ff" />
        <rect x="18" y="30" width="12" height="12" stroke="#6366f1" strokeWidth="1.5" fill="#e0e7ff" />
        <line x1="24" y1="30" x2="24" y2="42" stroke="#6366f1" strokeWidth="1.5" />
        <rect x="9" y="24" width="7" height="6" stroke="#6366f1" strokeWidth="1.5" fill="#c7d2fe" />
        <rect x="32" y="24" width="7" height="6" stroke="#6366f1" strokeWidth="1.5" fill="#c7d2fe" />
        <circle cx="24" cy="16" r="3" fill="#6366f1" opacity="0.6" />
      </svg>
    );
  }
  // future
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10" aria-hidden="true">
      <path d="M6 22L24 6l18 16v20H6V22z" stroke="#059669" strokeWidth="2" fill="#ecfdf5" />
      <rect x="18" y="30" width="12" height="12" stroke="#059669" strokeWidth="1.5" fill="#d1fae5" />
      <line x1="24" y1="30" x2="24" y2="42" stroke="#059669" strokeWidth="1.5" />
      <rect x="9" y="24" width="7" height="6" stroke="#059669" strokeWidth="1.5" fill="#a7f3d0" />
      <rect x="32" y="24" width="7" height="6" stroke="#059669" strokeWidth="1.5" fill="#a7f3d0" />
      <path d="M21 16l2 2 4-4" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function FutureStatePanel({ data }: Props) {
  const hasNewFormat = !!(data.title || data.primaryThemes?.length || data.directionOfTravel?.length);

  return (
    <div className="space-y-10">

      {/* ── PAM-quality header ──────────────────────────────────────────── */}
      {hasNewFormat && (
        <>
          {/* Badge + title + description */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-widest">
                Reimagine Output
              </span>
            </div>
            {data.title && (
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-3" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {data.title}
              </h2>
            )}
            {data.description && (
              <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
                {data.description}
              </p>
            )}
          </div>

          {/* Three Houses */}
          {data.threeHouses && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Transformation Arc
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Current */}
                <div className="flex flex-col items-center text-center p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <HouseIcon variant="current" />
                  <p className="mt-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Today</p>
                  <p className="mt-1 font-bold text-slate-700 text-sm">{data.threeHouses.current.label}</p>
                  <p className="mt-1.5 text-xs text-slate-500 leading-snug">{data.threeHouses.current.description}</p>
                </div>

                {/* Connecting arrow */}
                <div className="hidden sm:flex items-center justify-center relative">
                  {/* Left arrow */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
                    <ArrowRight className="h-5 w-5 text-indigo-300" />
                  </div>
                  {/* Transition box */}
                  <div className="flex flex-col items-center text-center p-5 rounded-xl bg-indigo-50 border border-indigo-200 w-full">
                    <HouseIcon variant="transition" />
                    <p className="mt-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider">In Progress</p>
                    <p className="mt-1 font-bold text-indigo-700 text-sm">{data.threeHouses.transition.label}</p>
                    <p className="mt-1.5 text-xs text-indigo-500 leading-snug">{data.threeHouses.transition.description}</p>
                  </div>
                  {/* Right arrow */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <ArrowRight className="h-5 w-5 text-emerald-300" />
                  </div>
                </div>

                {/* Transition (mobile only) */}
                <div className="flex flex-col items-center text-center p-5 rounded-xl bg-indigo-50 border border-indigo-200 sm:hidden">
                  <HouseIcon variant="transition" />
                  <p className="mt-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider">In Progress</p>
                  <p className="mt-1 font-bold text-indigo-700 text-sm">{data.threeHouses.transition.label}</p>
                  <p className="mt-1.5 text-xs text-indigo-500 leading-snug">{data.threeHouses.transition.description}</p>
                </div>

                {/* Future */}
                <div className="flex flex-col items-center text-center p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <HouseIcon variant="future" />
                  <p className="mt-3 text-xs font-semibold text-emerald-500 uppercase tracking-wider">Vision</p>
                  <p className="mt-1 font-bold text-emerald-800 text-sm">{data.threeHouses.future.label}</p>
                  <p className="mt-1.5 text-xs text-emerald-600 leading-snug">{data.threeHouses.future.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Direction of Travel */}
          {(data.directionOfTravel ?? []).length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Overall direction of travel
              </h3>
              <div className="space-y-3">
                {data.directionOfTravel!.map((shift, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <span className="shrink-0 w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-slate-500 font-medium text-sm flex-1 min-w-0">
                      {shift.from}
                    </span>
                    <ArrowRight className="shrink-0 h-4 w-4 text-slate-300" />
                    <span className="text-orange-700 font-bold text-sm flex-1 min-w-0">
                      {shift.to}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Themes 1–5 */}
          {(data.primaryThemes ?? []).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  Primary themes
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {data.primaryThemes!.length} themes — click to expand
                </span>
              </div>
              <div className="space-y-3">
                {data.primaryThemes!.map((theme, i) => (
                  <ThemeCard key={i} theme={theme} number={i + 1} isPrimary={true} />
                ))}
              </div>
            </div>
          )}

          {/* Supporting Themes 6–8 */}
          {(data.supportingThemes ?? []).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  Supporting themes
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {data.supportingThemes!.length} themes
                </span>
              </div>
              <div className="space-y-3">
                {data.supportingThemes!.map((theme, i) => {
                  const absoluteNum = (data.primaryThemes?.length ?? 5) + i + 1;
                  return (
                    <ThemeCard key={i} theme={theme} number={absoluteNum} isPrimary={false} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Vision Alignment */}
          {data.visionAlignment && (
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Platform Vision Alignment
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Core Principles */}
                <div className="p-5 rounded-xl bg-slate-900 text-white">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    Core Principles
                  </p>
                  <ul className="space-y-2">
                    {(data.visionAlignment.corePrinciples ?? []).map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                        <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Platform Position */}
                <div className="p-5 rounded-xl bg-indigo-600 text-white">
                  <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-3">
                    Platform Position
                  </p>
                  <p className="text-sm text-indigo-100 leading-relaxed">
                    {data.visionAlignment.platformPosition}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Horizon Vision */}
          {data.horizonVision && (
            <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-3">
                Horizon Vision
              </p>
              <p className="text-base leading-relaxed text-indigo-100 italic" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                "{data.horizonVision}"
              </p>
            </div>
          )}

          {/* Divider before technical model */}
          <div className="border-t border-slate-200 pt-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
              Technical Model Detail
            </p>
          </div>
        </>
      )}

      {/* ── Legacy / fallback header (when no new-format fields) ─────────── */}
      {!hasNewFormat && data.targetOperatingModel && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-3">
            Target Operating Model
          </p>
          <p className="text-sm leading-relaxed text-indigo-100">{data.targetOperatingModel}</p>
        </div>
      )}

      {/* ── Target operating model (technical detail, shown under new format) */}
      {hasNewFormat && data.targetOperatingModel && (
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
            Target Operating Model
          </p>
          <p className="text-sm leading-relaxed text-slate-700">{data.targetOperatingModel}</p>
        </div>
      )}

      {/* Narrative */}
      {data.narrative && !hasNewFormat && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-sm text-slate-600 leading-relaxed italic">{data.narrative}</p>
        </div>
      )}

      {/* Redesign principles */}
      {(data.redesignPrinciples ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Design Principles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.redesignPrinciples.map((p, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-white border border-slate-200"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI / Human model */}
      {(data.aiHumanModel ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            AI / Human Model ({data.aiHumanModel.length} tasks)
          </h3>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[40%]">
                    Task
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[20%]">
                    Recommendation
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Rationale
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.aiHumanModel.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-800 font-medium">{item.task}</td>
                    <td className="px-4 py-3">
                      <RecommendationBadge rec={item.recommendation} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operating model changes */}
      {(data.operatingModelChanges ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Operating Model Changes</h3>
          <div className="space-y-3">
            {data.operatingModelChanges.map((change, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  {change.area}
                </p>
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
