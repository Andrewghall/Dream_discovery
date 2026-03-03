'use client';

/**
 * Shared components for the output dashboard.
 * Extracted from the original output page for reuse across sections.
 */

// ── Section Header ────────────────────────────────────────────

export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

// ── Key Stat Card (with optional delta) ───────────────────────

export function KeyStatCard({
  label,
  value,
  previousValue,
  suffix,
  positiveIsGood,
}: {
  label: string;
  value: number;
  previousValue?: number;
  suffix?: string;
  positiveIsGood?: boolean;
}) {
  const delta = previousValue != null ? value - previousValue : null;
  const isPositive = delta != null && delta > 0;
  const isDeltaGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <span className="text-sm font-normal text-slate-400 ml-1">{suffix}</span>}
      </div>
      {delta != null && delta !== 0 && (
        <div className={`text-xs font-medium mt-1 ${isDeltaGood ? 'text-emerald-600' : 'text-red-500'}`}>
          {delta > 0 ? '+' : ''}{delta}{suffix === '%' ? 'pp' : ''} from baseline
        </div>
      )}
    </div>
  );
}

// ── Mini Stat ─────────────────────────────────────────────────

export function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${color || 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

// ── Loading State ─────────────────────────────────────────────

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
      <p className="text-sm text-slate-400 italic max-w-md text-center">{message}</p>
    </div>
  );
}

// ── Decision Card ─────────────────────────────────────────────

export function DecisionCard({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${accent || 'border-blue-500'} border border-slate-200 p-5`}>
      <h4 className="text-sm font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
