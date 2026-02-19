'use client';

import { Sparkles } from 'lucide-react';

interface AiInsightCardProps {
  summary: string;
}

export function AiInsightCard({ summary }: AiInsightCardProps) {
  if (!summary) return null;

  return (
    <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 rounded-lg bg-blue-100 p-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h4 className="mb-1.5 text-sm font-semibold text-blue-900">AI Executive Insight</h4>
          <p className="text-sm leading-relaxed text-blue-800">{summary}</p>
        </div>
      </div>
    </div>
  );
}
