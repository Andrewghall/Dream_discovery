'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, ImageIcon, Table2, Presentation, X, Loader2 } from 'lucide-react';

interface UploadResult {
  id: string;
  fileName: string;
  status: 'ready' | 'failed';
  error?: string;
}

interface EvidenceUploadZoneProps {
  workshopId: string;
  onUploadComplete: (results: UploadResult[]) => void;
  disabled?: boolean;
}

// .ppt excluded — backend only supports OOXML .pptx; legacy binary .ppt is rejected by the API
const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xls,.xlsx,.csv,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt';

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon className="h-4 w-4" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <Table2 className="h-4 w-4" />;
  if (ext === 'pptx') return <Presentation className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function EvidenceUploadZone({ workshopId, onUploadComplete, disabled }: EvidenceUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))];
    });
    setUploadError(null);
  }, []);

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) addFiles(e.dataTransfer.files);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset so same file can be re-added
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      for (const file of pendingFiles) formData.append('files', file);

      const res = await fetch(`/api/admin/workshops/${workshopId}/evidence`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload failed');
      }

      const { documents } = await res.json();
      setPendingFiles([]);
      onUploadComplete(documents);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={`
          relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all
          ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'}
          ${disabled || isUploading ? 'cursor-not-allowed opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled || isUploading}
        />
        <Upload className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">
          Drop files here or <span className="text-indigo-600">browse</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          PDF · Word · Excel · PowerPoint · CSV · Images · Screenshots
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          No formatting required — the system interprets the content automatically
        </p>
      </div>

      {/* Pending file list */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          {pendingFiles.map((file, i) => (
            <div
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="text-slate-500">{fileIcon(file.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>
      )}
    </div>
  );
}
