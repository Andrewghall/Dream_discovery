'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * ParticipationImbalanceWarning
 *
 * Yellow warning banner displayed when participation imbalance
 * exceeds 30% across actor groups. Used across all output sections.
 */

interface ParticipationImbalanceWarningProps {
  message: string;
}

export function ParticipationImbalanceWarning({ message }: ParticipationImbalanceWarningProps) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-700 leading-relaxed">{message}</p>
    </div>
  );
}
