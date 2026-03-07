'use client';

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export type EngineStatus = 'idle' | 'running' | 'complete' | 'error';

interface EngineShellProps {
  title: string;
  description?: string;
  status: EngineStatus;
  children?: React.ReactNode;
}

export function EngineShell({ title, description, status, children }: EngineShellProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {status === 'running' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </div>
        )}
        {status === 'complete' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            Partial
          </div>
        )}
      </div>

      {/* Content */}
      {status === 'idle' && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Generate intelligence to see results
        </div>
      )}
      {status === 'running' && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-sm text-slate-500">Analysing workshop signals…</p>
          </div>
        </div>
      )}
      {(status === 'complete' || status === 'error') && children}
    </div>
  );
}
