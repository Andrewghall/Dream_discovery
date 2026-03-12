/**
 * Supabase Storage utilities for image uploads
 * Used for solution overview images in workshop scratchpads
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase credentials not configured. Image upload will not work.');
  }
  return createClient(url, anonKey);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      `[storage] Supabase admin credentials not configured. ` +
      `URL=${url ? 'set' : 'MISSING'}, SERVICE_KEY=${serviceRoleKey ? 'set' : 'MISSING'}. ` +
      `Admin operations require SUPABASE_SERVICE_ROLE_KEY — anon key fallback removed.`
    );
  }
  return createClient(url, serviceRoleKey);
}

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

    const client = getSupabaseClient();

    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = client.storage
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

    const { error } = await getSupabaseClient().storage
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

  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `organizations/${organizationId}/logo-${Date.now()}.${fileExt}`;

  const admin = getSupabaseAdmin();

  // Convert File to Buffer for server-side upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await admin.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, { cacheControl: '3600', upsert: true, contentType: file.type });

  if (error) throw error;

  const { data: urlData } = admin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
  return urlData.publicUrl;
}

/**
 * Initialize storage bucket (run once during setup)
 * Creates the workshop-images bucket with public access
 */
export async function initializeStorageBucket() {
  try {
    const client = getSupabaseClient();

    // Check if bucket exists
    const { data: buckets } = await client.storage.listBuckets();

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket
      const { error } = await client.storage.createBucket(BUCKET_NAME, {
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
