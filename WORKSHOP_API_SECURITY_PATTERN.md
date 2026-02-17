# Workshop API Security Pattern

## ✅ Implemented: Organization-Scoped Access Control

All workshop API endpoints **MUST** validate that the authenticated user can access the requested workshop based on their organization.

## Security Pattern (Apply to ALL workshop endpoints)

```typescript
import { getAuthenticatedUser } from '@/lib/auth/get-session-user';
import { validateWorkshopAccess } from '@/lib/middleware/validate-workshop-access';

export async function GET/POST/PATCH/DELETE(request, { params }) {
  try {
    const { id } = await params; // or extract workshopId from body

    // Step 1: Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Validate workshop access (organization-scoped)
    const validation = await validateWorkshopAccess(id, user.organizationId, user.role);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 });
    }

    // Step 3: Proceed with operation
    // Workshop operations here...
  } catch (error) {
    // Error handling
  }
}
```

## Endpoints That Need This Pattern

### ✅ Already Secured:
- `GET/PATCH/DELETE /api/admin/workshops/[id]/route.ts`

### ⚠️ Still Need Security (Priority Order):

**HIGH PRIORITY (Data modification):**
1. `/api/admin/workshops/[id]/participants/route.ts` - Add/modify participants
2. `/api/admin/workshops/[id]/reset-sessions/route.ts` - Reset sessions
3. `/api/admin/workshops/[id]/send-invitations/route.ts` - Send emails
4. `/api/admin/workshops/[id]/scratchpad/*` - All scratchpad endpoints
5. `/api/admin/workshops/[id]/publish/route.ts` - Publish workshop

**MEDIUM PRIORITY (Data access):**
6. `/api/admin/workshops/[id]/sessions/route.ts` - View sessions
7. `/api/admin/workshops/[id]/answers/route.ts` - View answers
8. `/api/admin/workshops/[id]/synthesize/route.ts` - Generate synthesis
9. `/api/admin/workshops/[id]/hemisphere/route.ts` - View hemisphere data
10. `/api/admin/workshops/[id]/live/*` - All live workshop endpoints
11. `/api/admin/workshops/[id]/transcript/route.ts` - View transcripts

**LOW PRIORITY (Analytics/reporting):**
12. `/api/admin/workshops/[id]/prepare-scratchpad/route.ts` - Prepare output
13. `/api/admin/workshops/[id]/export-html/route.ts` - Export results

## How It Works

### For PLATFORM_ADMIN:
- Can access **ALL** workshops across all organizations
- No organization restriction

### For TENANT_ADMIN:
- Can ONLY access workshops in their own organization
- Cross-organization access returns 403 Forbidden

## Example: Protected vs Unprotected

### ❌ BEFORE (Vulnerable):
```typescript
export async function GET(request, { params }) {
  const { id } = await params;
  const workshop = await prisma.workshop.findUnique({ where: { id } });
  return NextResponse.json({ workshop });
}
```
**Problem:** ANY authenticated user (even from different org) can access ANY workshop

### ✅ AFTER (Secure):
```typescript
export async function GET(request, { params }) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const validation = await validateWorkshopAccess(id, user.organizationId, user.role);
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 403 });

  const workshop = await prisma.workshop.findUnique({ where: { id } });
  return NextResponse.json({ workshop });
}
```
**Fixed:** User must be authenticated AND workshop must belong to their organization

## Testing

Test with two organizations:
1. Create workshops in Org A and Org B
2. Login as Org A admin
3. Try to access Org B workshop ID → Should return 403
4. Try to access Org A workshop ID → Should succeed (200)

## Migration Plan

Apply this pattern to all workshop endpoints in priority order above. Each endpoint takes ~5 minutes to secure.

**Estimated time:** 13 endpoints × 5 minutes = ~65 minutes total
