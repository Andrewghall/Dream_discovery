'use client';

import { Card } from '@/components/ui/card';
import { EditableText } from './EditableText';
import { EditableList } from './EditableList';

interface PotentialSolutionTabProps {
  data: any;
  onChange?: (data: any) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

export function PotentialSolutionTab({ data, onChange }: PotentialSolutionTabProps) {
  if (!data || typeof data !== 'object') {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No potential solution data yet. Generate a report from the Hemisphere to populate this tab.
        </p>
      </Card>
    );
  }

  const update = (fn: (d: any) => void) => {
    if (!onChange) return;
    const clone = JSON.parse(JSON.stringify(data));
    fn(clone);
    onChange(clone);
  };

  const enablers = Array.isArray(data.enablers) ? data.enablers : [];
  const implPath = Array.isArray(data.implementationPath) ? data.implementationPath : [];

  return (
    <div className="space-y-12 bg-[#f8f4ec] -mx-8 -my-8 px-8 py-12 min-h-screen">
      {/* Title */}
      <div className="bg-white rounded-3xl p-16 border-0 shadow-sm">
        <div className="inline-block px-4 py-1.5 rounded-full border border-black/10 text-[10px] uppercase tracking-[0.25em] text-black/40 mb-8 font-medium">
          POTENTIAL SOLUTION
        </div>
        <h1 className="text-7xl font-semibold mb-8 leading-[1.1] text-gray-900" style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}>
          Solution &amp; Enablers
        </h1>
        <div className="space-y-6 max-w-4xl">
          <EditableText
            value={data.overview || 'Based on the workshop analysis, the following enablers and implementation path have been identified.'}
            onChange={(v) => update((d) => { d.overview = v; })}
            className="text-lg text-gray-700 leading-relaxed"
            multiline
          />
        </div>
      </div>

      {/* Enablers Grid */}
      {enablers.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-[#D4A89A] mb-8 font-medium">
            KEY ENABLERS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enablers.map((enabler: any, idx: number) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-sm border border-black/5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    <EditableText
                      value={enabler.title}
                      onChange={(v) => update((d) => { d.enablers[idx].title = v; })}
                      className="text-lg font-semibold text-gray-900"
                    />
                  </h3>
                  <span className={`ml-3 px-3 py-1 rounded-full text-[10px] font-semibold uppercase border ${PRIORITY_COLORS[enabler.priority] || PRIORITY_COLORS.MEDIUM}`}>
                    <EditableText
                      value={enabler.priority || 'MEDIUM'}
                      onChange={(v) => update((d) => { d.enablers[idx].priority = v; })}
                      className="text-[10px] font-semibold uppercase"
                    />
                  </span>
                </div>
                {enabler.domain && (
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-500 font-medium mb-3">
                    <EditableText
                      value={enabler.domain}
                      onChange={(v) => update((d) => { d.enablers[idx].domain = v; })}
                      className="text-[10px] text-slate-500 font-medium"
                    />
                  </div>
                )}
                <EditableText
                  value={enabler.description}
                  onChange={(v) => update((d) => { d.enablers[idx].description = v; })}
                  className="text-sm text-gray-600 leading-relaxed mb-4"
                  multiline
                />
                {Array.isArray(enabler.dependencies) && enabler.dependencies.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-medium">Dependencies</div>
                    <EditableList
                      items={enabler.dependencies}
                      onChange={(items) => update((d) => { d.enablers[idx].dependencies = items; })}
                      itemClassName="inline-block px-2 py-0.5 rounded bg-slate-50 text-[11px] text-slate-600 border border-slate-100"
                      addLabel="+ Add dependency"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Implementation Path */}
      {implPath.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-[#D4A89A] mb-8 font-medium">
            IMPLEMENTATION ROADMAP
          </div>
          <div className="space-y-6">
            {implPath.map((phase: any, idx: number) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-sm border border-black/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      <EditableText
                        value={phase.phase || `Phase ${idx + 1}`}
                        onChange={(v) => update((d) => { d.implementationPath[idx].phase = v; })}
                        className="text-lg font-semibold text-gray-900"
                      />
                    </h3>
                    {phase.timeframe && (
                      <EditableText
                        value={phase.timeframe}
                        onChange={(v) => update((d) => { d.implementationPath[idx].timeframe = v; })}
                        className="text-sm text-gray-500"
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {Array.isArray(phase.actions) && phase.actions.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-3 font-medium">Actions</div>
                      <EditableList
                        items={phase.actions}
                        onChange={(items) => update((d) => { d.implementationPath[idx].actions = items; })}
                        bullet="•"
                        bulletClassName="mt-1.5 h-1.5 w-1.5 text-blue-400 flex-shrink-0"
                        itemClassName="text-sm text-gray-700"
                        addLabel="+ Add action"
                      />
                    </div>
                  )}
                  {Array.isArray(phase.outcomes) && phase.outcomes.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-3 font-medium">Expected Outcomes</div>
                      <EditableList
                        items={phase.outcomes}
                        onChange={(items) => update((d) => { d.implementationPath[idx].outcomes = items; })}
                        bullet="•"
                        bulletClassName="mt-1.5 h-1.5 w-1.5 text-green-400 flex-shrink-0"
                        itemClassName="text-sm text-gray-700"
                        addLabel="+ Add outcome"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
