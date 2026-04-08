'use client';

import { useState } from 'react';
import type { BehaviouralIntervention } from '@/lib/behavioural-interventions/types';

interface ComBWheelProps {
  interventions: BehaviouralIntervention[];
  activeFilter: string | null;
  onFilter: (id: string | null) => void;
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const s1 = polarToCartesian(cx, cy, outerR, startDeg);
  const e1 = polarToCartesian(cx, cy, outerR, endDeg);
  const s2 = polarToCartesian(cx, cy, innerR, endDeg);
  const e2 = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${e1.x.toFixed(2)} ${e1.y.toFixed(2)} L ${s2.x.toFixed(2)} ${s2.y.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${e2.x.toFixed(2)} ${e2.y.toFixed(2)} Z`;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function getCount(interventions: BehaviouralIntervention[], subCompId: string): number {
  return interventions.filter((item) => {
    switch (subCompId) {
      case 'physical_capability':
        return item.capability_type === 'Physical' || item.capability_type === 'Both';
      case 'psychological_capability':
        return item.capability_type === 'Psychological' || item.capability_type === 'Both';
      case 'reflective_motivation':
        return item.motivation_type === 'Reflective' || item.motivation_type === 'Both';
      case 'automatic_motivation':
        return item.motivation_type === 'Automatic' || item.motivation_type === 'Both';
      case 'social_opportunity':
        return item.opportunity_type === 'Social' || item.opportunity_type === 'Both';
      case 'physical_opportunity':
        return item.opportunity_type === 'Physical' || item.opportunity_type === 'Both';
      default:
        return false;
    }
  }).length;
}

// Outer ring: 6 segments × 60°, clockwise from top, with 2° gap each side
const OUTER_SEGMENTS = [
  { id: 'physical_capability',      label: 'Physical Capability',      color: '#ef4444', startDeg: 0,   endDeg: 60  },
  { id: 'psychological_capability', label: 'Psychological Capability', color: '#b91c1c', startDeg: 60,  endDeg: 120 },
  { id: 'reflective_motivation',    label: 'Reflective Motivation',    color: '#f59e0b', startDeg: 120, endDeg: 180 },
  { id: 'automatic_motivation',     label: 'Automatic Motivation',     color: '#b45309', startDeg: 180, endDeg: 240 },
  { id: 'social_opportunity',       label: 'Social Opportunity',       color: '#16a34a', startDeg: 240, endDeg: 300 },
  { id: 'physical_opportunity',     label: 'Physical Opportunity',     color: '#15803d', startDeg: 300, endDeg: 360 },
] as const;

// Inner ring: 3 segments × 120°
const INNER_SEGMENTS = [
  { id: 'capability',  label: 'C', color: '#ef4444', startDeg: 0,   endDeg: 120 },
  { id: 'motivation',  label: 'M', color: '#f59e0b', startDeg: 120, endDeg: 240 },
  { id: 'opportunity', label: 'O', color: '#22c55e', startDeg: 240, endDeg: 360 },
] as const;

// SVG constants
const CX = 140;
const CY = 140;
const OUTER_INNER_R = 92;
const OUTER_OUTER_R = 125;
const INNER_INNER_R = 54;
const INNER_OUTER_R = 88;
const CENTRE_R = 50;
const GAP = 2; // degrees of gap between segments (applied each side)

// ─── Outer segment (own hover state) ─────────────────────────────────────────

type OuterSegmentDef = (typeof OUTER_SEGMENTS)[number];

interface OuterSegmentProps {
  seg: OuterSegmentDef;
  count: number;
  maxCount: number;
  activeFilter: string | null;
  onFilter: (id: string | null) => void;
}

function OuterSegment({ seg, count, maxCount, activeFilter, onFilter }: OuterSegmentProps) {
  const [hovered, setHovered] = useState(false);

  const path = donutSegmentPath(
    CX, CY, OUTER_INNER_R, OUTER_OUTER_R,
    seg.startDeg + GAP, seg.endDeg - GAP,
  );
  const mid = (seg.startDeg + seg.endDeg) / 2;
  const isActive = activeFilter === seg.id;

  // Opacity: active/hovered = full; filtered-out = 0.2; normal = scale by count
  let opacity: number;
  if (isActive || hovered) {
    opacity = 1;
  } else if (activeFilter !== null) {
    opacity = 0.2;
  } else {
    opacity = count === 0 ? 0.15 : 0.3 + (count / maxCount) * 0.7;
  }

  // Count badge position — midpoint radially
  const badgeR = (OUTER_INNER_R + OUTER_OUTER_R) / 2;
  const badgePos = polarToCartesian(CX, CY, badgeR, mid);

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onFilter(isActive ? null : seg.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path d={path} fill={seg.color} opacity={opacity} />
      {count > 0 && (
        <text
          x={badgePos.x}
          y={badgePos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight="bold"
          fill="white"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {count}
        </text>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComBWheel({ interventions, activeFilter, onFilter }: ComBWheelProps) {
  const counts = Object.fromEntries(
    OUTER_SEGMENTS.map((seg) => [seg.id, getCount(interventions, seg.id)]),
  );
  const maxCount = Math.max(...Object.values(counts), 1);
  const total = interventions.length;

  // Sub-types were added in a later schema version — detect old data
  const hasSubTypes = total === 0 || Object.values(counts).some((c) => c > 0);

  return (
    <div className="flex gap-8 items-start">
      {/* ── SVG wheel ── */}
      <svg
        viewBox="0 0 280 280"
        width={220}
        height={220}
        className="shrink-0"
        aria-label="COM-B wheel"
      >
        {/* Inner ring */}
        {INNER_SEGMENTS.map((seg) => {
          const path = donutSegmentPath(
            CX, CY, INNER_INNER_R, INNER_OUTER_R,
            seg.startDeg + GAP, seg.endDeg - GAP,
          );
          const mid = (seg.startDeg + seg.endDeg) / 2;
          const labelPos = polarToCartesian(CX, CY, (INNER_INNER_R + INNER_OUTER_R) / 2, mid);
          return (
            <g key={seg.id}>
              <path d={path} fill={seg.color} opacity={0.85} />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fontWeight="bold"
                fill="white"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {seg.label}
              </text>
            </g>
          );
        })}

        {/* Outer ring — interactive segments */}
        {OUTER_SEGMENTS.map((seg) => (
          <OuterSegment
            key={seg.id}
            seg={seg}
            count={hasSubTypes ? (counts[seg.id] ?? 0) : 1}
            maxCount={hasSubTypes ? maxCount : 1}
            activeFilter={activeFilter}
            onFilter={onFilter}
          />
        ))}

        {/* Centre circle */}
        <circle cx={CX} cy={CY} r={CENTRE_R} fill="white" />
        <text
          x={CX}
          y={activeFilter ? CY - 10 : CY - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={activeFilter ? 22 : 26}
          fontWeight="bold"
          fill="#111827"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {total}
        </text>
        <text
          x={CX}
          y={activeFilter ? CY + 8 : CY + 12}
          textAnchor="middle"
          fontSize={6.5}
          fontWeight="600"
          fill="#6b7280"
          style={{ pointerEvents: 'none', userSelect: 'none', letterSpacing: '0.05em' }}
        >
          INTERVENTIONS
        </text>
        {activeFilter && (
          <>
            <text
              x={CX}
              y={CY + 22}
              textAnchor="middle"
              fontSize={6}
              fill="#9ca3af"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              click to clear
            </text>
            {/* Transparent click target over centre */}
            <circle
              cx={CX}
              cy={CY}
              r={CENTRE_R}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onFilter(null)}
            />
          </>
        )}
      </svg>

      {/* ── Legend panel ── */}
      <div className="flex-1 space-y-1.5">
        {!hasSubTypes ? (
          <div className="flex flex-col justify-center h-full space-y-3 py-4">
            <p className="text-sm font-medium text-foreground">Sub-component breakdown not available</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This analysis was generated before sub-type classification was added.
              Click <span className="font-semibold">Regenerate</span> to update — the wheel will show which specific types of Capability, Motivation, and Opportunity are blocking each behaviour.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              {OUTER_SEGMENTS.map((seg) => (
                <div key={seg.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  {seg.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {OUTER_SEGMENTS.map((seg) => {
              const count = counts[seg.id] ?? 0;
              const isActive = activeFilter === seg.id;
              const barPct = total > 0 ? (count / total) * 100 : 0;
              return (
                <button
                  key={seg.id}
                  onClick={() => onFilter(isActive ? null : seg.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors text-sm ${
                    isActive
                      ? 'bg-accent ring-1 ring-inset ring-border'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <span className="shrink-0 w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className={`flex-1 ${isActive ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {seg.label}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums w-5 text-right">{count}</span>
                  <div className="shrink-0 w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barPct}%`, backgroundColor: seg.color }}
                    />
                  </div>
                </button>
              );
            })}
            {activeFilter && (
              <button
                onClick={() => onFilter(null)}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Clear filter
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
