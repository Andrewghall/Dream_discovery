'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Circle, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { CrossValidationResult, CrossValidationMatch } from '@/lib/evidence/types';

interface CrossValidationPanelProps {
  workshopId: string;
  crossValidation: CrossValidationResult | null;
  hasReadyDocs: boolean;
  onValidated: (result: CrossValidationResult) => void;
}

function MatchCard({ match, color }: { match: CrossValidationMatch; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border ${color} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{match.discoveryFinding}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Evidence: {match.evidenceFinding}
            <span className="ml-2 text-slate-400">({match.documentName})</span>
          </p>
        </div>
        {match.note && (
          <button
            onClick={() => setOpen(v => !v)}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {open && match.note && (
        <p className="mt-2 text-xs text-slate-600 italic">{match.note}</p>
      )}
    </div>
  );
}

export function CrossValidationPanel({
  workshopId,
  crossValidation,
  hasReadyDocs,
  onValidated,
}: CrossValidationPanelProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runValidation = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/evidence/cross-validate`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Cross-validation failed');
      }
      const { crossValidation: result } = await res.json();
      onValidated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run cross-validation');
    } finally {
      setRunning(false);
    }
  };

  const total = crossValidation
    ? crossValidation.corroborated.length +
      crossValidation.contradicted.length +
      crossValidation.partiallySupported.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header + run button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Cross-Validation</h3>
          <p className="text-xs text-slate-500">
            Discovery findings vs uploaded evidence — what aligns, what contradicts, what&apos;s missing
          </p>
        </div>
        <button
          onClick={runValidation}
          disabled={running || !hasReadyDocs}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {running ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</>
          ) : (
            <><RefreshCw className="h-3.5 w-3.5" />{crossValidation ? 'Re-validate' : 'Run Validation'}</>
          )}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!crossValidation && !running && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
          <p className="text-sm text-slate-500">
            {hasReadyDocs
              ? 'Click "Run Validation" to compare evidence against workshop discovery.'
              : 'Upload and process evidence documents first.'}
          </p>
        </div>
      )}

      {crossValidation && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3">
            <StatPill
              count={crossValidation.corroborated.length}
              label="Corroborated"
              icon={<CheckCircle className="h-4 w-4 text-green-600" />}
              bg="bg-green-50"
              text="text-green-800"
            />
            <StatPill
              count={crossValidation.contradicted.length}
              label="Contradicted"
              icon={<XCircle className="h-4 w-4 text-red-600" />}
              bg="bg-red-50"
              text="text-red-800"
            />
            <StatPill
              count={crossValidation.partiallySupported.length}
              label="Partial"
              icon={<AlertCircle className="h-4 w-4 text-amber-600" />}
              bg="bg-amber-50"
              text="text-amber-800"
            />
            <StatPill
              count={crossValidation.unsupported.length}
              label="No Evidence"
              icon={<Circle className="h-4 w-4 text-slate-400" />}
              bg="bg-slate-50"
              text="text-slate-600"
            />
          </div>

          {/* Corroborated */}
          {crossValidation.corroborated.length > 0 && (
            <Section title="✅ Corroborated" subtitle="Workshop findings confirmed by evidence" count={crossValidation.corroborated.length}>
              {crossValidation.corroborated.map((m, i) => (
                <MatchCard key={i} match={m} color="border-green-200 bg-green-50/40" />
              ))}
            </Section>
          )}

          {/* Contradicted */}
          {crossValidation.contradicted.length > 0 && (
            <Section title="❌ Contradicted" subtitle="Evidence directly conflicts with workshop findings" count={crossValidation.contradicted.length}>
              {crossValidation.contradicted.map((m, i) => (
                <MatchCard key={i} match={m} color="border-red-200 bg-red-50/40" />
              ))}
            </Section>
          )}

          {/* Partially supported */}
          {crossValidation.partiallySupported.length > 0 && (
            <Section title="⚠️ Partially Supported" subtitle="Evidence provides qualified support" count={crossValidation.partiallySupported.length}>
              {crossValidation.partiallySupported.map((m, i) => (
                <MatchCard key={i} match={m} color="border-amber-200 bg-amber-50/40" />
              ))}
            </Section>
          )}

          {/* Not in evidence */}
          {crossValidation.unsupported.length > 0 && (
            <Section title="○ No Evidence Coverage" subtitle="Workshop findings not corroborated by any uploaded document" count={crossValidation.unsupported.length}>
              <ul className="space-y-1.5">
                {crossValidation.unsupported.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Evidence-only findings */}
          {crossValidation.evidenceOnly.length > 0 && (
            <Section title="📋 In Evidence — Not in Discovery" subtitle="Findings from documents that the workshop didn't surface" count={crossValidation.evidenceOnly.length}>
              <ul className="space-y-2">
                {crossValidation.evidenceOnly.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <div>
                      <p className="text-sm text-slate-700">{e.finding.text}</p>
                      <p className="text-xs text-slate-400">{e.documentName}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Conclusion impact */}
          {crossValidation.conclusionImpact && (
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">What This Changes</h4>
              <p className="text-sm leading-relaxed text-indigo-900">{crossValidation.conclusionImpact}</p>
              <p className="mt-2 text-xs text-indigo-500">
                Validated against {total} finding{total !== 1 ? 's' : ''} ·{' '}
                {new Date(crossValidation.generatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({
  count, label, icon, bg, text,
}: { count: number; label: string; icon: React.ReactNode; bg: string; text: string }) {
  return (
    <div className={`flex flex-col items-center rounded-xl ${bg} px-3 py-3`}>
      {icon}
      <p className={`mt-1 text-xl font-bold ${text}`}>{count}</p>
      <p className={`text-xs ${text} opacity-80`}>{label}</p>
    </div>
  );
}

function Section({
  title, subtitle, count, children,
}: { title: string; subtitle: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="ml-2 text-xs text-slate-400">({count})</span>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}
