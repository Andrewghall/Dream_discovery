'use client';

import { EditableText } from './EditableText';

interface EditableListProps {
  items: string[];
  onChange: (items: string[]) => void;
  itemClassName?: string;
  bullet?: string;
  bulletClassName?: string;
  addLabel?: string;
}

export function EditableList({
  items,
  onChange,
  itemClassName,
  bullet,
  bulletClassName,
  addLabel = '+ Add item',
}: EditableListProps) {
  const handleEdit = (index: number, newValue: string) => {
    const updated = [...items];
    updated[index] = newValue;
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([...items, '']);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="group flex items-start gap-2">
          {bullet && (
            <span className={bulletClassName || 'mt-1 flex-shrink-0'}>{bullet}</span>
          )}
          <div className="flex-1">
            <EditableText
              value={item}
              onChange={(v) => handleEdit(i, v)}
              className={itemClassName}
              placeholder="Enter text..."
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(i);
            }}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs ml-1 flex-shrink-0 mt-1 transition-opacity"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleAdd();
        }}
        className="text-xs text-blue-500 hover:text-blue-700 py-1 transition-colors"
      >
        {addLabel}
      </button>
    </div>
  );
}
