import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { put, del } from '@vercel/blob';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
    }

    // Get current scratchpad to check if there's an existing logo
    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { clientLogoUrl: true },
    });

    // Delete old logo if it exists
    if (scratchpad?.clientLogoUrl) {
      try {
        await del(scratchpad.clientLogoUrl);
      } catch (error) {
        console.error('Failed to delete old logo:', error);
        // Continue anyway - we'll upload the new one
      }
    }

    // Upload new logo to Vercel Blob
    const blob = await put(`workshops/${workshopId}/logo-${Date.now()}.${file.name.split('.').pop()}`, file, {
      access: 'public',
    });

    // Update scratchpad with new logo URL
    await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: { clientLogoUrl: blob.url },
    });

    return NextResponse.json({ logoUrl: blob.url });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    // Get current scratchpad
    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { clientLogoUrl: true },
    });

    if (!scratchpad?.clientLogoUrl) {
      return NextResponse.json({ error: 'No logo to delete' }, { status: 404 });
    }

    // Delete from Vercel Blob
    try {
      await del(scratchpad.clientLogoUrl);
    } catch (error) {
      console.error('Failed to delete logo from blob storage:', error);
      // Continue anyway - we'll clear the URL from the database
    }

    // Update scratchpad to remove logo URL
    await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: { clientLogoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logo deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
