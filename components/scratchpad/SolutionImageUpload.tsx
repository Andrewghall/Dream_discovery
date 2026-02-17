'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface SolutionImageUploadProps {
  workshopId: string;
  currentImageUrl?: string | null;
  onImageUpdate: (imageUrl: string | null) => void;
}

export function SolutionImageUpload({
  workshopId,
  currentImageUrl,
  onImageUpdate,
}: SolutionImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      // Create form data
      const formData = new FormData();
      formData.append('image', file);

      // Upload image
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/upload-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      onImageUpdate(data.imageUrl);
      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/upload-image`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      onImageUpdate(null);
      alert('Image deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete image');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Solution Overview Image
        </label>
        {!currentImageUrl && (
          <div className="text-xs text-gray-500">
            Max 5MB • JPEG, PNG, GIF, WebP
          </div>
        )}
      </div>

      {currentImageUrl ? (
        <div className="relative group">
          <div className="relative w-full h-64 border-2 border-gray-200 rounded-lg overflow-hidden">
            <Image
              src={currentImageUrl}
              alt="Solution Overview"
              fill
              className="object-contain"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <label className="flex-1">
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
                className="w-full"
                disabled={uploading}
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Replace Image'}
              </Button>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <X className="h-4 w-4 mr-2" />
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
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                  <p className="text-sm text-gray-600">Uploading...</p>
                </>
              ) : (
                <>
                  <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF or WebP (max 5MB)
                  </p>
                </>
              )}
            </div>
          </label>
        </div>
      )}

      <p className="text-xs text-gray-500">
        This image will be displayed in the Solution Overview section and included in the HTML export.
      </p>
    </div>
  );
}
