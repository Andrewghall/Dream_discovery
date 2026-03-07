'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  /** Main tooltip text */
  content: React.ReactNode;
  /** Optional second line / detail */
  detail?: React.ReactNode;
  /** Side to show the tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Small icon size variant */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * HelpTooltip — a small ? icon that shows an explanatory tooltip on hover.
 * Uses Radix UI Tooltip primitives (already in the project via shadcn/ui).
 *
 * Usage:
 *   <HelpTooltip content="This chart shows alignment between themes and stakeholder groups." />
 */
export function HelpTooltip({ content, detail, side = 'top', size = 'sm', className }: HelpTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
              size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
              className,
            )}
            aria-label="Help"
          >
            <HelpCircle className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'} />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className={cn(
              'z-[9999] max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg',
              'text-xs text-slate-700 leading-relaxed',
              'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            )}
          >
            <p className="font-medium text-slate-800">{content}</p>
            {detail && <p className="mt-1 text-slate-500">{detail}</p>}
            <TooltipPrimitive.Arrow className="fill-white drop-shadow-sm" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/** Inline help label: label text + ? icon side by side */
export function HelpLabel({ label, content, detail, className }: { label: string; content: React.ReactNode; detail?: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{label}</span>
      <HelpTooltip content={content} detail={detail} />
    </span>
  );
}
