'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export const HISTORICAL_UPLOAD_ACCEPT = '.pdf,.docx,.xls,.xlsx,.csv,.tsv,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.md';

interface HistoricalEvidenceUploaderProps {
  accept?: string;
  disabled?: boolean;
  helperText?: string;
  label?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
}

export function HistoricalEvidenceUploader({
  accept = HISTORICAL_UPLOAD_ACCEPT,
  disabled = false,
  helperText,
  label = 'Drop a file here or click to browse',
  multiple = false,
  onFilesSelected,
}: HistoricalEvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return;
      const arr = Array.from(files ?? []);
      if (arr.length === 0) return;
      const selected = multiple ? arr : [arr[0]];
      onFilesSelected(selected);
    },
    [disabled, multiple, onFilesSelected],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;
      event.dataTransfer.dropEffect = 'copy';
      setDragActive(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;
      setDragActive(false);
      processFiles(event.dataTransfer.files);
    },
    [disabled, processFiles],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      processFiles(event.target.files ?? []);
      if (event.target) event.target.value = '';
    },
    [disabled, processFiles],
  );

  return (
    <div
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all ${
        dragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
      />
      <Upload className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      {!helperText && (
        <p className="mt-1 text-xs text-slate-500">
          PDF · Word · Excel · PowerPoint · CSV/TSV · Images · Text
        </p>
      )}
      <p className="mt-0.5 text-[10px] text-slate-400">Supports historical evidence formats</p>
    </div>
  );
}
