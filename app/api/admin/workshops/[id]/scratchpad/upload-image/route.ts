import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadImage, deleteImage } from '@/lib/storage';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image (JPEG, PNG, GIF, or WebP)' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image must be less than 5MB' },
        { status: 400 }
      );
    }

    // Get existing scratchpad to delete old image if exists
    const existingScratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { solutionImageUrl: true },
    });

    // Upload new image
    const imageUrl = await uploadImage(file, workshopId);

    // Update scratchpad with new image URL
    await prisma.workshopScratchpad.upsert({
      where: { workshopId },
      update: {
        solutionImageUrl: imageUrl,
        updatedAt: new Date(),
      },
      create: {
        workshopId,
        solutionImageUrl: imageUrl,
      },
    });

    // Delete old image if it exists
    if (existingScratchpad?.solutionImageUrl) {
      try {
        await deleteImage(existingScratchpad.solutionImageUrl);
      } catch (error) {
        console.error('Failed to delete old image:', error);
        // Don't fail the request if old image deletion fails
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to upload image',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id: workshopId } = await params;

    const access = await validateWorkshopAccess(workshopId, auth.organizationId, auth.role);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    // Get scratchpad to find image URL
    const scratchpad = await prisma.workshopScratchpad.findUnique({
      where: { workshopId },
      select: { solutionImageUrl: true },
    });

    if (!scratchpad?.solutionImageUrl) {
      return NextResponse.json(
        { error: 'No image to delete' },
        { status: 404 }
      );
    }

    // Delete image from storage
    await deleteImage(scratchpad.solutionImageUrl);

    // Remove URL from database
    await prisma.workshopScratchpad.update({
      where: { workshopId },
      data: {
        solutionImageUrl: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Image deletion error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete image',
      },
      { status: 500 }
    );
  }
}
