/**
 * Supabase Storage utilities for image uploads
 * Used for solution overview images in workshop scratchpads
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Image upload will not work.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client — bypasses RLS, server-side only, never exposed to browser
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);

const BUCKET_NAME = 'workshop-images';

/**
 * Upload image to Supabase Storage
 *
 * @param file - File object from input
 * @param workshopId - Workshop ID for organization
 * @returns Public URL of uploaded image
 */
export async function uploadImage(file: File, workshopId: string): Promise<string> {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be less than 5MB');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${workshopId}/solution-overview-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Delete image from Supabase Storage
 *
 * @param imageUrl - Full public URL of the image
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extract path from URL
    const urlParts = imageUrl.split(`${BUCKET_NAME}/`);
    if (urlParts.length < 2) {
      throw new Error('Invalid image URL');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Image deletion error:', error);
    throw new Error('Failed to delete image');
  }
}

/**
 * Upload org logo to Supabase Storage
 */
export async function uploadOrgLogo(file: File, organizationId: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File must be an image');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be less than 5MB');

  const fileExt = file.name.split('.').pop();
  const fileName = `organizations/${organizationId}/logo-${Date.now()}.${fileExt}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, { cacheControl: '3600', upsert: true });

  if (error) throw error;

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return urlData.publicUrl;
}

/**
 * Initialize storage bucket (run once during setup)
 * Creates the workshop-images bucket with public access
 */
export async function initializeStorageBucket() {
  try {
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      });

      if (error) {
        throw error;
      }

      console.log('Storage bucket created successfully');
    }
  } catch (error) {
    console.error('Bucket initialization error:', error);
    throw error;
  }
}
