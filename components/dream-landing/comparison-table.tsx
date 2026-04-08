'use client';

import { ScrollReveal } from './scroll-reveal';

/* ── Data ────────────────────────────────────────────────── */

const COMPETITORS = ['Qualtrics', 'Medallia', 'InMoment', 'Forsta'];

type CellValue = 'yes' | 'partial' | 'no';

interface Row {
  capability: string;
  competitors: CellValue;
  dream: CellValue;
  dreamNote?: string;
  competitorNote?: string;
  dividerAbove?: boolean;
}

const ROWS: Row[] = [
  { capability: 'Data collection (VoC / VoE)',       competitors: 'yes',     dream: 'yes' },
  { capability: 'Multi-channel ingestion',            competitors: 'yes',     dream: 'yes' },
  { capability: 'Sentiment / NLP analysis',           competitors: 'yes',     dream: 'yes' },
  { capability: 'Dashboards & reporting',             competitors: 'yes',     dream: 'yes' },
  { capability: 'Alerts & workflow triggers',         competitors: 'yes',     dream: 'yes' },
  { capability: 'Journey visibility',                 competitors: 'yes',     dream: 'yes' },
  {
    capability: 'Root cause indication',
    competitors: 'partial', competitorNote: 'surface-level',
    dream: 'yes', dreamNote: 'deep, structured',
    dividerAbove: true,
  },
  { capability: 'Cross-domain synthesis (people + process + tech)', competitors: 'no', dream: 'yes' },
  { capability: 'Corporate psyche mapping',           competitors: 'no',      dream: 'yes' },
  { capability: 'Internal belief vs. customer & empirical reality gap analysis', competitors: 'no', dream: 'yes' },
  { capability: 'Facilitated structured capture',     competitors: 'no',      dream: 'yes' },
  { capability: 'Actor-based modelling',              competitors: 'no',      dream: 'yes' },
  { capability: 'Constraint mapping',                 competitors: 'no',      dream: 'yes' },
  { capability: 'Decision generation',                competitors: 'no',      dream: 'yes' },
  { capability: 'Prioritised transformation plan',    competitors: 'no',      dream: 'yes' },
  { capability: 'Operating model redesign output',    competitors: 'no',      dream: 'yes' },
  { capability: 'Agentic reasoning',                  competitors: 'no',      dream: 'yes' },
];

/* ── Cell Icons ──────────────────────────────────────────── */

function Cell({ value, note, isDream }: { value: CellValue; note?: string; isDream?: boolean }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="none"
          style={{ color: isDream ? '#5cf28e' : 'rgba(255,255,255,0.75)' }}>
          <path d="M3 8.5L6.5 12 13 5" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {note && (
          <span className="text-[11px]" style={{ color: isDream ? '#5cf28e' : 'rgba(255,255,255,0.65)' }}>
            {note}
          </span>
        )}
      </span>
    );
  }

  if (value === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0 text-white/55" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2 A6 6 0 0 1 8 14 Z" fill="currentColor" />
        </svg>
        {note && <span className="text-[11px] text-white/55">{note}</span>}
      </span>
    );
  }

  // no
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0 text-white/30" fill="none">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────── */

export function ComparisonTable() {
  return (
    <section className="bg-[#0a0a0a] py-20 px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 75% 50%, rgba(92,242,142,0.04), transparent)' }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        <ScrollReveal>
          <p className="text-[#5cf28e]/70 text-[11px] font-semibold tracking-[0.25em] uppercase mb-3">
            How We Compare
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            DREAM alongside the leading feedback platforms.
          </h2>
          <p className="text-white/65 text-base leading-relaxed mb-10 max-w-2xl">
            Qualtrics, Medallia, InMoment and Forsta are excellent at capturing signal. DREAM does that too — and goes further. It maps how your organisation actually thinks, then cross-checks that corporate psychology against customer data and empirical evidence to surface the gaps between internal belief and external reality.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <div className="w-full overflow-x-auto rounded-2xl border border-white/[0.10] bg-white/[0.03]">
            <table className="w-full min-w-[640px] text-sm border-collapse">
              {/* Header */}
              <thead>
                <tr className="border-b border-white/[0.10]">
                  <th className="text-left px-5 py-4 text-white/60 font-semibold text-xs tracking-wide w-[42%]">
                    Capability
                  </th>
                  {COMPETITORS.map(c => (
                    <th key={c} className="px-3 py-4 text-center text-white/55 font-semibold text-xs tracking-wide">
                      {c}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-center text-xs font-bold tracking-wide"
                    style={{ color: '#5cf28e', background: 'rgba(92,242,142,0.07)' }}>
                    DREAM
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {ROWS.map((row) => (
                  <tr
                    key={row.capability}
                    className="border-b border-white/[0.06] last:border-0 transition-colors hover:bg-white/[0.025]"
                    style={row.dividerAbove ? { borderTop: '1px solid rgba(92,242,142,0.15)' } : {}}
                  >
                    <td className="px-5 py-3.5 text-white/85 text-sm leading-snug font-medium">
                      {row.capability}
                    </td>
                    {COMPETITORS.map(c => (
                      <td key={c} className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center">
                          <Cell value={row.competitors} note={c === COMPETITORS[0] ? row.competitorNote : undefined} />
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-center" style={{ background: 'rgba(92,242,142,0.05)' }}>
                      <div className="flex items-center justify-center">
                        <Cell value={row.dream} note={row.dreamNote} isDream />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={150}>
          <p className="mt-5 text-white/45 text-xs leading-relaxed max-w-xl">
            Competitor assessment based on publicly available product documentation and feature comparisons.
            DREAM capabilities reflect the current platform.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
