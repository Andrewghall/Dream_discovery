'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  multiline?: boolean;
  type?: 'text' | 'number';
  style?: React.CSSProperties;
}

export function EditableText({
  value,
  onChange,
  className,
  inputClassName,
  placeholder,
  multiline,
  type = 'text',
  style,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync when parent data changes
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Auto-focus on edit
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      if (inputRef.current instanceof HTMLTextAreaElement || inputRef.current instanceof HTMLInputElement) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const finalValue = type === 'number' ? String(Number(draft) || 0) : draft;
    if (finalValue !== value) {
      onChange(type === 'number' ? (Number(draft) || 0) as any : draft);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent AccordionTrigger toggle
    setEditing(true);
  };

  if (!editing) {
    return (
      <span
        className={cn(
          className,
          'hover:bg-black/5 cursor-pointer rounded px-1 -mx-1 transition-colors inline-block min-w-[20px]'
        )}
        style={style}
        onClick={handleClick}
        title="Click to edit"
      >
        {value || (
          <span className="text-gray-400 italic text-sm">
            {placeholder || 'Click to edit'}
          </span>
        )}
      </span>
    );
  }

  const inputClasses = cn(
    className,
    'border border-blue-300 rounded bg-white/90 px-2 outline-none focus:ring-2 focus:ring-blue-200',
    inputClassName
  );

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className={cn(inputClasses, 'w-full min-h-[60px] resize-y block')}
        style={style}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
        }}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type}
      className={cn(inputClasses, 'w-full')}
      style={style}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') cancel();
      }}
    />
  );
}
