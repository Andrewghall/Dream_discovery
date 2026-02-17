'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ClientLogoUploadProps {
  workshopId: string;
  currentLogoUrl?: string | null;
  onLogoUpdate: (logoUrl: string | null) => void;
}

export function ClientLogoUpload({
  workshopId,
  currentLogoUrl,
  onLogoUpdate,
}: ClientLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, GIF, SVG, or WebP)');
      return;
    }

    // Validate file size (2MB for logos)
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be less than 2MB');
      return;
    }

    try {
      setUploading(true);

      // Create form data
      const formData = new FormData();
      formData.append('logo', file);

      // Upload logo
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      onLogoUpdate(data.logoUrl);
      alert('Logo uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this logo?')) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/upload-logo`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      onLogoUpdate(null);
      alert('Logo deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete logo');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {currentLogoUrl ? (
        <div className="flex items-center gap-4">
          <div className="relative w-48 h-20 border-2 border-gray-200 rounded-lg overflow-hidden bg-white p-2">
            <Image
              src={currentLogoUrl}
              alt="Client Logo"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              >
                <Upload className="h-3 w-3 mr-2" />
                {uploading ? 'Uploading...' : 'Replace'}
              </Button>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-3 w-3 mr-2" />
              {deleting ? 'Deleting...' : 'Remove'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
            id="logo-upload"
          />
          <label
            htmlFor="logo-upload"
            className={`flex items-center justify-center w-48 h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center">
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                  <p className="text-xs text-gray-600">Uploading...</p>
                </>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-xs text-gray-600 font-semibold">Upload Logo</p>
                  <p className="text-xs text-gray-400">Max 2MB</p>
                </>
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
