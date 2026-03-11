'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';

// ── Section heading ───────────────────────────────────────────────────────────

export function SectionHeading({
  label,
  sublabel,
}: {
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
          {label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {sublabel && (
        <p className="text-xs text-muted-foreground text-center mt-1">{sublabel}</p>
      )}
    </div>
  );
}

// ── Inline field editor ───────────────────────────────────────────────────────

export function EditableText({
  value,
  onSave,
  multiline = false,
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          className={`w-full bg-transparent rounded-sm px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none border border-primary/20 leading-relaxed ${className ?? ''}`}
          value={draft}
          rows={Math.max(3, (draft.match(/\n/g) ?? []).length + 2)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
          autoFocus
        />
      );
    }
    return (
      <input
        className={`w-full bg-transparent border-b border-primary/40 focus:outline-none focus:border-primary pb-0.5 ${className ?? ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        autoFocus
      />
    );
  }

  return (
    <div
      className={`group/editable relative cursor-text rounded-sm hover:bg-primary/[0.04] transition-colors -mx-1 px-1 ${className ?? ''}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground/40 italic text-xs">{placeholder ?? 'Click to add'}</span>}
      <Pencil className="absolute right-0 top-0.5 h-3 w-3 text-primary/25 opacity-0 group-hover/editable:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}

// ── Inline list item adder ────────────────────────────────────────────────────

export function AddItemInput({
  onAdd,
  placeholder,
}: {
  onAdd: (text: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-2 py-1"
      >
        <Plus className="h-3 w-3" />
        Add item
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        className="flex-1 bg-transparent border-b border-primary/40 text-sm focus:outline-none focus:border-primary pb-0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(''); setOpen(false); }
        }}
        placeholder={placeholder ?? 'Type and press Enter to add'}
        autoFocus
      />
      <button onClick={commit} className="text-xs text-primary font-medium shrink-0">Add</button>
      <button onClick={() => { setValue(''); setOpen(false); }} className="text-xs text-muted-foreground shrink-0">Cancel</button>
    </div>
  );
}
