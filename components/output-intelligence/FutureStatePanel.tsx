'use client';

import { Bot, User, Users } from 'lucide-react';
import type { FutureStateDesign } from '@/lib/output-intelligence/types';

interface Props {
  data: FutureStateDesign;
}

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

export function FutureStatePanel({ data }: Props) {
  return (
    <div className="space-y-8">
      {/* Target operating model */}
      {data.targetOperatingModel && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white">
          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest mb-3">
            Target Operating Model
          </p>
          <p className="text-sm leading-relaxed text-indigo-100">{data.targetOperatingModel}</p>
        </div>
      )}

      {/* Narrative */}
      {data.narrative && (
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
