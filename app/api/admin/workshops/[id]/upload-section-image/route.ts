/**
 * POST /api/admin/workshops/[id]/upload-section-image
 *
 * Accepts a multipart/form-data upload with a single `image` field.
 * Stores the image in Vercel Blob and returns the public URL.
 *
 * Used by custom report sections to embed images in the Download Report.
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params;

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await validateWorkshopAccess(workshopId, user.organizationId, user.role, user.userId);
  if (!access.valid) return NextResponse.json({ error: access.error }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type. Use JPEG, PNG, GIF, WebP or SVG.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 400 });
  }

  try {
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
    const filename = `report-sections/${workshopId}/${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url, size: file.size, type: file.type });
  } catch (err) {
    console.error('Image upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
  }
}
