'use client';

import { ArrowRight } from 'lucide-react';

/**
 * SectionAction — sits beneath any data section header.
 * Shows: what the section is + what to do with it.
 * Keep it short. One sentence each.
 */
export function SectionAction({
  what,
  action,
}: {
  what: string;   // What this data shows
  action: string; // What to do with it
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-xs">
      <div className="flex-1 space-y-1">
        <p className="text-amber-800">
          <span className="font-semibold">What this shows: </span>
          {what}
        </p>
        <p className="text-amber-900">
          <span className="font-semibold inline-flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            What to do:
          </span>{' '}
          {action}
        </p>
      </div>
    </div>
  );
}
