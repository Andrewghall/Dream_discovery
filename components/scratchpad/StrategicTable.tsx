import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Edit2, Trash2, Plus, Check, X } from 'lucide-react';
import { useState } from 'react';

interface StrategicTableItem {
  type: 'aspiration' | 'opportunity' | 'constraint' | 'risk' | 'enabler';
  text: string;
  selected?: boolean;
}

interface StrategicTableProps {
  title: string;
  subtitle?: string;
  items: StrategicTableItem[];
  onToggle?: (index: number) => void;
  onEdit?: (index: number, newText: string) => void;
  onDelete?: (index: number) => void;
  onAdd?: (newItem: StrategicTableItem) => void;
  editable?: boolean;
}

const typeColors = {
  aspiration: 'bg-blue-50 border-blue-200 text-blue-900',
  opportunity: 'bg-green-50 border-green-200 text-green-900',
  constraint: 'bg-orange-50 border-orange-200 text-orange-900',
  risk: 'bg-red-50 border-red-200 text-red-900',
  enabler: 'bg-purple-50 border-purple-200 text-purple-900',
};

const typeLabels = {
  aspiration: 'Aspiration',
  opportunity: 'Opportunity',
  constraint: 'Constraint',
  risk: 'Risk',
  enabler: 'Enabler',
};

export function StrategicTable({
  title,
  subtitle,
  items,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  editable = false
}: StrategicTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemType, setNewItemType] = useState<StrategicTableItem['type']>('aspiration');

  const handleStartEdit = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditText(currentText);
  };

  const handleSaveEdit = (index: number) => {
    if (editText.trim() && onEdit) {
      onEdit(index, editText.trim());
    }
    setEditingIndex(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleAddItem = () => {
    if (newItemText.trim() && onAdd) {
      onAdd({ type: newItemType, text: newItemText.trim() });
      setNewItemText('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {editable && onAdd && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className={`
              border rounded-lg p-4 transition-all
              ${typeColors[item.type]}
              ${item.selected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'}
            `}
          >
            {editingIndex === index ? (
              // Edit mode
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-medium">
                    {typeLabels[item.type]}
                  </Badge>
                </div>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[80px] text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(index)}
                    className="flex items-center gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex items-start gap-3">
                {item.selected && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-medium">
                      {typeLabels[item.type]}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{item.text}</p>
                </div>
                {editable && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(index, item.text)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(index)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new item form */}
        {isAdding && (
          <div className={`
            border rounded-lg p-4
            bg-gray-50 border-gray-200
          `}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as StrategicTableItem['type'])}
                  className="text-xs px-2 py-1 border rounded"
                >
                  <option value="aspiration">Aspiration</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="enabler">Enabler</option>
                  <option value="constraint">Constraint</option>
                  <option value="risk">Risk</option>
                </select>
              </div>
              <Textarea
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Enter the new item text..."
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddItem}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setNewItemText('');
                  }}
                  className="flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
