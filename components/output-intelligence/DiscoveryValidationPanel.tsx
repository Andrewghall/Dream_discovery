'use client';

import { CheckCircle2, PlusCircle, MinusCircle } from 'lucide-react';
import type { DiscoveryValidation } from '@/lib/output-intelligence/types';

interface Props {
  data: DiscoveryValidation;
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[level]}`}>
      {level}
    </span>
  );
}

export function DiscoveryValidationPanel({ data }: Props) {
  const accuracy = Math.max(0, Math.min(100, data.hypothesisAccuracy ?? 0));
  const accuracyColor =
    accuracy >= 70 ? 'text-emerald-600' : accuracy >= 40 ? 'text-amber-600' : 'text-red-500';
  const barColor =
    accuracy >= 70 ? 'bg-emerald-500' : accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-8">
      {/* Hypothesis accuracy */}
      <div className="p-6 rounded-xl border border-slate-200 bg-white">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Hypothesis Accuracy
        </p>
        <div className="flex items-end gap-4">
          <span className={`text-6xl font-bold ${accuracyColor}`}>{accuracy}</span>
          <span className="text-2xl text-slate-400 mb-2">/100</span>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${accuracy}%` }}
          />
        </div>
        {data.summary && (
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">{data.summary}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Confirmed Issues */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Confirmed Issues ({data.confirmedIssues?.length ?? 0})
            </h3>
          </div>
          {(data.confirmedIssues ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No confirmed issues</p>
          ) : (
            <div className="space-y-3">
              {data.confirmedIssues.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-800">{item.issue}</p>
                    <ConfidenceBadge level={item.confidence} />
                  </div>
                  {item.workshopEvidence && (
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="font-medium">Evidence: </span>{item.workshopEvidence}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Issues */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              New Issues ({data.newIssues?.length ?? 0})
            </h3>
          </div>
          {(data.newIssues ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No new issues surfaced</p>
          ) : (
            <div className="space-y-3">
              {data.newIssues.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-sm font-medium text-slate-800 mb-1">{item.issue}</p>
                  {item.workshopEvidence && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">Evidence: </span>{item.workshopEvidence}
                    </p>
                  )}
                  {item.significance && (
                    <p className="text-xs text-blue-600 mt-1">
                      <span className="font-medium">Significance: </span>{item.significance}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reduced Importance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MinusCircle className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">
              Reduced Importance ({data.reducedIssues?.length ?? 0})
            </h3>
          </div>
          {(data.reducedIssues ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No issues reduced in importance</p>
          ) : (
            <div className="space-y-3">
              {data.reducedIssues.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-1">{item.issue}</p>
                  {item.reason && (
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">Reason: </span>{item.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
