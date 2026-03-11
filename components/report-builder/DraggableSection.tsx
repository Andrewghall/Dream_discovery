'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronDown, ChevronUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { ReportSectionConfig } from '@/lib/output-intelligence/types';

// Source page badges — shown on sections that came from outside the Download Report page
const SOURCE_BADGE: Record<string, string> = {
  strategic_impact:     'Brain Scan',
  discovery_diagnostic: 'Discovery',
  discovery_signals:    'Discovery',
  insight_summary:      'Insight Map',
  structural_alignment: 'Discovery',
  structural_narrative: 'Discovery',
  structural_tensions:  'Discovery',
  structural_barriers:  'Discovery',
};

interface DraggableSectionProps {
  config: ReportSectionConfig;
  children: React.ReactNode;
  onToggleEnabled: () => void;
  onToggleCollapsed: () => void;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  isDragOverlay?: boolean;
}

export function DraggableSection({
  config,
  children,
  onToggleEnabled,
  onToggleCollapsed,
  onRemove,
  onTitleChange,
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

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.title);

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  // ── Chapter type: minimal strip with editable title ───────────────────────
  if (config.type === 'chapter') {
    return (
      <div
        ref={isDragOverlay ? undefined : setNodeRef}
        style={style}
        className={`relative ${isDragging ? 'opacity-30 z-0' : 'opacity-100'} ${isDragOverlay ? 'shadow-2xl rotate-[0.5deg]' : ''}`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-primary/30 border-l-4 border-l-primary bg-primary/5">
          {/* Drag handle */}
          <button
            {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5 rounded shrink-0"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Editable chapter title */}
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => {
                  setEditingTitle(false);
                  const trimmed = draftTitle.trim();
                  if (trimmed && trimmed !== config.title) {
                    onTitleChange?.(trimmed);
                  } else {
                    setDraftTitle(config.title);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setDraftTitle(config.title); setEditingTitle(false); }
                }}
                className="w-full bg-transparent border-none outline-none text-sm font-bold text-foreground"
              />
            ) : (
              <button
                onClick={() => { setDraftTitle(config.title); setEditingTitle(true); }}
                className="text-sm font-bold text-foreground hover:text-primary transition-colors truncate block w-full text-left"
                title="Click to edit chapter title"
              >
                {config.title}
              </button>
            )}
          </div>

          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
            Chapter
          </span>

          {/* Delete */}
          {onRemove && (
            <button
              onClick={onRemove}
              className="shrink-0 p-1 rounded text-muted-foreground/30 hover:text-red-500 transition-colors"
              title="Remove chapter"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Standard section ──────────────────────────────────────────────────────
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

          {/* Title + source badge */}
          <span className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className={`text-[11px] font-semibold uppercase tracking-widest truncate ${
              config.enabled ? 'text-muted-foreground' : 'text-muted-foreground/40 line-through'
            }`}>
              {config.title}
            </span>
            {SOURCE_BADGE[config.id] && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground">
                {SOURCE_BADGE[config.id]}
              </span>
            )}
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
