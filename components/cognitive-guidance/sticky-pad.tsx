'use client';

import { X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StickyPad as StickyPadType, StickyPadType as PadType } from '@/lib/cognitive-guidance/pipeline';

const BORDER_COLORS: Record<PadType, string> = {
  CLARIFICATION: '#60a5fa',
  GAP_PROBE: '#f59e0b',
  CONTRADICTION_PROBE: '#ef4444',
  RISK_PROBE: '#f97316',
  ENABLER_PROBE: '#34d399',
  CUSTOMER_IMPACT: '#a78bfa',
  OWNERSHIP_ACTION: '#64748b',
};

const BADGE_CLASSES: Record<PadType, string> = {
  CLARIFICATION: 'bg-blue-100 text-blue-700 border-blue-200',
  GAP_PROBE: 'bg-amber-100 text-amber-700 border-amber-200',
  CONTRADICTION_PROBE: 'bg-red-100 text-red-700 border-red-200',
  RISK_PROBE: 'bg-orange-100 text-orange-700 border-orange-200',
  ENABLER_PROBE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CUSTOMER_IMPACT: 'bg-purple-100 text-purple-700 border-purple-200',
  OWNERSHIP_ACTION: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface StickyPadProps {
  pad: StickyPadType;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function formatPadType(type: PadType): string {
  return type.replace(/_/g, ' ');
}

export function StickyPad({ pad, onDismiss, onSnooze, isSelected, onClick }: StickyPadProps) {
  const borderColor = BORDER_COLORS[pad.type];
  const isSnoozed = pad.status === 'snoozed';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(pad.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(pad.id);
        }
      }}
      className={`
        relative rounded-lg border bg-white p-3 shadow-sm transition-all cursor-pointer
        ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : 'hover:shadow-md'}
        ${isSnoozed ? 'opacity-50' : ''}
      `}
      style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
    >
      {/* Top row: type badge + signal strength */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <Badge
          variant="outline"
          className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0 ${BADGE_CLASSES[pad.type]}`}
        >
          {formatPadType(pad.type)}
        </Badge>

        {/* Signal strength bar */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {Math.round(pad.signalStrength * 100)}%
          </span>
          <div className="h-1.5 w-12 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pad.signalStrength * 100}%`,
                backgroundColor: borderColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Body: prompt text */}
      <p className="text-sm text-gray-800 leading-relaxed mb-3">
        {pad.prompt}
      </p>

      {/* Bottom row: provenance + actions */}
      <div className="flex items-end justify-between gap-2">
        <p className="text-[11px] text-muted-foreground leading-snug flex-1 min-w-0">
          {pad.provenance.description}
        </p>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-muted-foreground hover:text-amber-600"
            onClick={(e) => {
              e.stopPropagation();
              onSnooze(pad.id);
            }}
            title="Snooze"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-muted-foreground hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(pad.id);
            }}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
