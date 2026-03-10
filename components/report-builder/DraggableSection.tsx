'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { ReportSectionConfig } from '@/lib/output-intelligence/types';

interface DraggableSectionProps {
  config: ReportSectionConfig;
  children: React.ReactNode;
  onToggleEnabled: () => void;
  onToggleCollapsed: () => void;
  onRemove?: () => void;
  isDragOverlay?: boolean;
}

export function DraggableSection({
  config,
  children,
  onToggleEnabled,
  onToggleCollapsed,
  onRemove,
  isDragOverlay = false,
}: DraggableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-30 z-0' : 'opacity-100'} ${isDragOverlay ? 'shadow-2xl rotate-[0.5deg]' : ''}`}
    >
      {/* Section card */}
      <div className={`rounded-xl border transition-colors ${
        config.enabled
          ? 'border-border bg-card'
          : 'border-border/50 bg-muted/20'
      }`}>
        {/* ── Section header ──────────────────────────────────── */}
        <div className={`flex items-center gap-2 px-3 py-2.5 ${config.collapsed ? '' : 'border-b border-border/60'}`}>
          {/* Drag handle */}
          <button
            {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5 rounded shrink-0"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Title */}
          <span className={`flex-1 text-[11px] font-semibold uppercase tracking-widest ${
            config.enabled ? 'text-muted-foreground' : 'text-muted-foreground/40 line-through'
          }`}>
            {config.title}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Enable/disable toggle */}
            <button
              onClick={onToggleEnabled}
              className={`p-1 rounded transition-colors ${
                config.enabled
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-muted-foreground/30 hover:text-muted-foreground'
              }`}
              title={config.enabled ? 'Exclude from PDF' : 'Include in PDF'}
            >
              {config.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>

            {/* Remove (custom sections only) */}
            {config.type === 'custom' && onRemove && (
              <button
                onClick={onRemove}
                className="p-1 rounded text-muted-foreground/30 hover:text-red-500 transition-colors"
                title="Remove section"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Collapse/expand */}
            <button
              onClick={onToggleCollapsed}
              className="p-1 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
              title={config.collapsed ? 'Expand' : 'Collapse'}
            >
              {config.collapsed
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronUp className="h-3.5 w-3.5" />
              }
            </button>
          </div>
        </div>

        {/* ── Section body ─────────────────────────────────────── */}
        {!config.collapsed && (
          <div className={`${config.enabled ? '' : 'opacity-40 pointer-events-none select-none'}`}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item-level toggle (wraps each insight/finding/diagnostic) ─────────────────

interface ItemToggleProps {
  id: string;
  excluded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function ItemToggle({ id, excluded, onToggle, children, className }: ItemToggleProps) {
  return (
    <div className={`group/item relative flex items-start gap-2 ${className ?? ''}`}>
      <div className={`flex-1 min-w-0 transition-opacity ${excluded ? 'opacity-30 line-through' : ''}`}>
        {children}
      </div>
      <button
        onClick={() => onToggle(id)}
        className={`shrink-0 mt-0.5 p-0.5 rounded transition-colors opacity-0 group-hover/item:opacity-100 ${
          excluded
            ? 'text-muted-foreground/40 hover:text-foreground'
            : 'text-muted-foreground/40 hover:text-red-500'
        }`}
        title={excluded ? 'Include in PDF' : 'Exclude from PDF'}
      >
        {excluded ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ── Drop indicator line (rendered between sections) ───────────────────────────

export function DropIndicator({ isOver }: { isOver: boolean }) {
  if (!isOver) return null;
  return (
    <div className="h-0.5 bg-blue-500 rounded-full mx-2 my-1 animate-in fade-in duration-150" />
  );
}
