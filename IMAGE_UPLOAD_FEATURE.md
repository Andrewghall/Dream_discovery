# Solution Overview Image Upload - Feature Documentation

## Overview
Facilitators can upload a single image to the Solution Overview section of the workshop scratchpad. This image visualizes the proposed solution and is included in the HTML export for clients.

## Feature Specifications

### Upload Constraints
- **File Types:** JPEG, PNG, GIF, WebP
- **Max Size:** 5MB
- **Quantity:** 1 image per workshop
- **Location:** Executive Summary tab > Solution Overview section

### Storage
- **Backend:** Supabase Storage
- **Bucket:** `workshop-images`
- **Path Structure:** `{workshopId}/solution-overview-{timestamp}.{ext}`
- **Access:** Public URLs (accessible without authentication)

### Database
- **Field:** `solutionImageUrl` in `workshop_scratchpads` table
- **Type:** String (nullable)
- **Stores:** Full public URL from Supabase Storage

## User Experience

### Upload Flow
1. Navigate to workshop scratchpad
2. Click "Executive Summary" tab
3. See "Solution Overview Image" section
4. Click upload area or drag & drop image
5. Image uploads to Supabase Storage
6. Preview displays immediately
7. Image URL saved to database

### Replace Image
1. Click "Replace Image" button
2. Select new image
3. Old image deleted from storage
4. New image uploaded
5. Database updated with new URL

### Delete Image
1. Click "Remove" button
2. Confirm deletion
3. Image removed from storage
4. Database field set to null

## Technical Implementation

### Components

**SolutionImageUpload.tsx**
- Upload UI with drag & drop
- Image preview
- Replace/Remove buttons
- File validation
- Loading states

### API Endpoints

**POST /api/admin/workshops/[id]/scratchpad/upload-image**
- Accepts multipart/form-data
- Validates file type and size
- Uploads to Supabase Storage
- Updates database
- Deletes old image (if exists)
- Returns public URL

**DELETE /api/admin/workshops/[id]/scratchpad/upload-image**
- Retrieves current image URL from database
- Deletes image from Supabase Storage
- Removes URL from database
- Returns success confirmation

### Storage Utilities

**lib/storage.ts**
- `uploadImage(file, workshopId)` - Upload to Supabase
- `deleteImage(imageUrl)` - Delete from Supabase
- `initializeStorageBucket()` - Create bucket (one-time setup)

### Database Migration

**prisma/migrations/add-solution-image.sql**
```sql
ALTER TABLE "workshop_scratchpads"
ADD COLUMN IF NOT EXISTS "solutionImageUrl" TEXT;
```

## Setup Instructions

### 1. Configure Supabase Storage

**Create Storage Bucket:**
1. Go to Supabase Dashboard > Storage
2. Create new bucket: `workshop-images`
3. Set to **Public** (allows direct URL access)
4. Set size limit: 5MB
5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

**Get API Credentials:**
1. Go to Supabase Dashboard > Settings > API
2. Copy **Project URL**
3. Copy **anon/public** key

**Update `.env`:**
```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
```

### 2. Run Database Migration

```bash
# Apply migration
psql $DATABASE_URL -f prisma/migrations/add-solution-image.sql

# Or generate Prisma migration
npx prisma migrate dev --name add-solution-image
```

### 3. Initialize Storage Bucket (Optional)

If bucket doesn't exist, create it programmatically:

```typescript
import { initializeStorageBucket } from '@/lib/storage';

// Run once
await initializeStorageBucket();
```

### 4. Test Upload

1. Start dev server: `npm run dev`
2. Navigate to any workshop scratchpad
3. Go to Executive Summary tab
4. Upload a test image
5. Verify image appears in preview
6. Check Supabase Storage for uploaded file

## HTML Export Integration

### Current Status
The `solutionImageUrl` field is available in the scratchpad data when exporting HTML. The export function needs to be updated to:

1. **Option A: Embed as Base64**
   ```typescript
   // Fetch image and convert to base64
   const imageResponse = await fetch(scratchpad.solutionImageUrl);
   const imageBuffer = await imageResponse.arrayBuffer();
   const base64 = Buffer.from(imageBuffer).toString('base64');
   const dataUri = `data:image/jpeg;base64,${base64}`;

   // Use in HTML
   <img src="${dataUri}" alt="Solution Overview" />
   ```

2. **Option B: Include as Separate File** (Recommended)
   ```typescript
   // Download image
   const imageResponse = await fetch(scratchpad.solutionImageUrl);
   const imageBuffer = await imageResponse.arrayBuffer();

   // Add to ZIP
   zip.file('images/solution-overview.jpg', imageBuffer);

   // Reference in HTML
   <img src="images/solution-overview.jpg" alt="Solution Overview" />
   ```

### To-Do: Update Export Function

**File:** `/app/api/admin/workshops/[id]/export-html/route.ts`

Add this logic:
```typescript
// If solution image exists, download and include in ZIP
if (scratchpad.solutionImageUrl) {
  const imageResponse = await fetch(scratchpad.solutionImageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();

  // Determine file extension
  const ext = scratchpad.solutionImageUrl.split('.').pop();
  const filename = `images/solution-overview.${ext}`;

  zip.file(filename, imageBuffer);

  // Pass image path to HTML template
  htmlPackage.solutionImagePath = filename;
}
```

## Security Considerations

### ✅ What's Protected
- File type validation (images only)
- File size limit (5MB max)
- Supabase Storage access policies
- Only authenticated admins can upload
- Old images automatically deleted on replace

### ⚠️ Considerations
- Images are **publicly accessible** via URL (by design for export)
- No virus/malware scanning (relies on browser validation)
- No image optimization (stored as-is)
- No CDN (served directly from Supabase)

### Best Practices
1. Only upload trusted images
2. Optimize images before upload (use tools like TinyPNG)
3. Use appropriate image formats (JPEG for photos, PNG for diagrams)
4. Consider image dimensions (recommend max 1920x1080)

## Error Handling

### Common Errors

**"No image file provided"**
- Cause: FormData doesn't contain 'image' field
- Solution: Ensure file input has name="image"

**"Image must be less than 5MB"**
- Cause: File size exceeds limit
- Solution: Compress image or use smaller file

**"Failed to upload image"**
- Cause: Supabase credentials missing or invalid
- Solution: Check NEXT_PUBLIC_SUPABASE_URL and KEY in .env

**"Invalid image URL"**
- Cause: Image URL doesn't match expected format
- Solution: Ensure URL is from Supabase Storage

## Future Enhancements

- [ ] Image cropping/resizing tool
- [ ] Multiple image support (gallery)
- [ ] Drag & drop reordering
- [ ] Image captions/descriptions
- [ ] Automatic image optimization
- [ ] CDN integration for faster loading
- [ ] Image version history
- [ ] Bulk upload

## Testing Checklist

- [ ] Upload JPEG image successfully
- [ ] Upload PNG image successfully
- [ ] Upload GIF image successfully
- [ ] Upload WebP image successfully
- [ ] Reject non-image file (PDF, etc.)
- [ ] Reject oversized image (>5MB)
- [ ] Replace existing image
- [ ] Delete image
- [ ] Image persists after page reload
- [ ] Image included in HTML export (when implemented)
- [ ] Old images deleted on replace

---

**Status:** ✅ Complete (except HTML export integration)
**Date:** February 13, 2026
**Priority:** High (core feature for facilitators)
