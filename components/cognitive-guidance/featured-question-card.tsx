'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FacilitationQuestion, LensName } from '@/lib/cognition/agents/agent-types';

// ── Lens colour dots for the main question card ──────────────
const LENS_DOT_COLORS: Record<string, string> = {
  People: '#3b82f6',
  Organisation: '#10b981',
  Customer: '#8b5cf6',
  Technology: '#f97316',
  Regulation: '#ef4444',
  General: '#94a3b8',
};

// ══════════════════════════════════════════════════════════════
// MAIN QUESTION CARD — warm amber, shows the overarching question
// ══════════════════════════════════════════════════════════════

interface MainQuestionCardProps {
  question: FacilitationQuestion;
  questionIndex: number;       // 0-based
  totalQuestions: number;
  phaseLabel: string;          // e.g. "Reimagine"
  onPrevious: () => void;
  onNext: () => void;
  completionPercent?: number;  // 0-100 blended completion
  lensColors?: Record<string, { bg: string }>;
}

// ── Progress bar colour — matches sticky pad coverage bar logic ──
function completionBarColor(percent: number): string {
  if (percent >= 70) return '#22c55e'; // green-500
  if (percent >= 40) return '#3b82f6'; // blue-500
  return '#6366f1';                     // indigo-500
}

export function MainQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  phaseLabel,
  onPrevious,
  onNext,
  completionPercent,
  lensColors,
}: MainQuestionCardProps) {
  const isFirst = questionIndex === 0;
  const isLast = questionIndex === totalQuestions - 1;

  // Determine which lenses this question targets
  const lenses: string[] = [];
  if (question.lens) {
    lenses.push(question.lens);
  }
  // Also gather lenses from sub-questions
  if (question.subQuestions?.length) {
    for (const sq of question.subQuestions) {
      if (sq.lens && !lenses.includes(sq.lens)) {
        lenses.push(sq.lens);
      }
    }
  }

  return (
    <div
      className="relative rounded-xl p-6 transition-all duration-300"
      style={{
        backgroundColor: '#fef3c7',
        color: '#78350f',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header: phase label + counter */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm"
          style={{ backgroundColor: '#fde68a', color: '#92400e' }}
        >
          {phaseLabel}
        </span>
        <span className="text-xs font-medium" style={{ color: '#92400e', opacity: 0.7 }}>
          Question {questionIndex + 1} of {totalQuestions}
          {completionPercent !== undefined && (
            <span className="ml-1.5 font-bold" style={{ color: completionBarColor(completionPercent) }}>
              · {completionPercent}% complete
            </span>
          )}
        </span>
      </div>

      {/* Thin completion progress bar */}
      {completionPercent !== undefined && (
        <div className="h-1 rounded-full overflow-hidden mb-3" style={{ backgroundColor: '#fde68a' }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${completionPercent}%`,
              backgroundColor: completionBarColor(completionPercent),
            }}
          />
        </div>
      )}

      {/* Main question text — large and prominent */}
      <p className="text-xl font-semibold leading-relaxed mb-3" style={{ color: '#78350f' }}>
        {question.text}
      </p>

      {/* Purpose / Grounding */}
      {(question.purpose || question.grounding) && (
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#92400e', opacity: 0.7 }}>
          {question.purpose}
          {question.grounding && question.purpose && ' — '}
          {question.grounding && (
            <span className="italic">{question.grounding}</span>
          )}
        </p>
      )}

      {/* Lens indicators + Navigation */}
      <div className="flex items-center justify-between mt-4">
        {/* Lens dots */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#92400e', opacity: 0.5 }}>
            Lenses
          </span>
          {lenses.map((lens) => (
            <div key={lens} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: lensColors?.[lens]?.bg || LENS_DOT_COLORS[lens] || '#94a3b8' }}
              />
              <span className="text-[10px] font-medium" style={{ color: '#92400e', opacity: 0.6 }}>
                {lens}
              </span>
            </div>
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevious}
            disabled={isFirst}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: isFirst ? '#fde68a44' : '#fde68a',
              color: isFirst ? '#92400e66' : '#92400e',
              cursor: isFirst ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={isLast}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: isLast ? '#fde68a44' : '#fde68a',
              color: isLast ? '#92400e66' : '#92400e',
              cursor: isLast ? 'not-allowed' : 'pointer',
            }}
          >
            Next Question
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
