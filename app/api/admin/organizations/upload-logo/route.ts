import { NextRequest, NextResponse } from 'next/server';
import { uploadOrgLogo } from '@/lib/storage';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const organizationId = formData.get('organizationId') as string;

    if (auth.role !== 'PLATFORM_ADMIN' && auth.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!organizationId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Image must be less than 5MB' }, { status: 400 });

    const logoUrl = await uploadOrgLogo(file, organizationId);
    return NextResponse.json({ logoUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Logo upload error:', msg, error);
    return NextResponse.json({ error: `Failed to upload logo: ${msg}` }, { status: 500 });
  }
}
