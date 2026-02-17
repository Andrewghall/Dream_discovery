# Commercial Tab Password Protection - Feature Documentation

## Overview
The Commercial tab in the scratchpad editor now has password protection to secure sensitive business information like pricing, investment summaries, and delivery phases.

## Features Implemented

### 1. Set Commercial Password
- **Location:** Scratchpad editor header
- **Button:** "Set Commercial Password" (with lock icon)
- **Requirements:**
  - Minimum 6 characters
  - Must confirm password (double entry)
  - Password is hashed with bcrypt (10 rounds)

### 2. Password Verification
- **Trigger:** Clicking the Commercial tab when locked
- **Behavior:**
  - Shows password dialog
  - Validates against hashed password in database
  - Unlocks tab on successful verification
  - Shows error message on incorrect password

### 3. Security Features
- ✅ Password hashed with bcrypt before storage
- ✅ Password NOT included in HTML exports for clients
- ✅ Password stored in `commercialPassword` field (nullable)
- ✅ Lock icon displayed on Commercial tab when locked
- ✅ Tab content hidden until correct password entered

## Database Schema

```sql
-- WorkshopScratchpad table
commercialPassword String? -- Hashed password (nullable)
commercialContent  Json?   -- Commercial data (delivery phases, investment)
```

## API Endpoints

### Set Commercial Password
```
POST /api/admin/workshops/[id]/scratchpad/set-commercial-password
Body: { password: string }
Response: { success: true, message: string }
```

### Verify Commercial Password
```
POST /api/admin/workshops/[id]/scratchpad/verify-commercial/route.ts
Body: { password: string }
Response: { success: true } | { error: string }
```

## User Flow

### Setting Password (First Time or Update)
1. Open workshop scratchpad editor
2. Click "Set Commercial Password" button in header
3. Dialog appears with two fields:
   - New Password (min 6 chars)
   - Confirm Password
4. Click "Set Password"
5. Password is hashed and saved
6. Commercial tab automatically unlocks

### Accessing Commercial Tab
1. Click "Commercial" tab (with lock icon)
2. If not unlocked:
   - Password dialog appears
   - Enter password
   - Click "Unlock"
3. If correct:
   - Tab unlocks for current session
   - Content is displayed
4. If incorrect:
   - Error message shown
   - Can retry

## Files Created/Modified

### Created:
- `/app/api/admin/workshops/[id]/scratchpad/set-commercial-password/route.ts`

### Modified:
- `/app/admin/workshops/[id]/scratchpad/page.tsx`
  - Added state for password dialogs
  - Added "Set Commercial Password" button
  - Added set password dialog UI
  - Added password setting handler

## Testing Checklist

- [ ] Set a commercial password (minimum 6 characters)
- [ ] Verify password mismatch shows error
- [ ] Verify short password (<6 chars) shows error
- [ ] Click Commercial tab when locked → shows password dialog
- [ ] Enter correct password → unlocks tab
- [ ] Enter incorrect password → shows error
- [ ] Verify commercial content is visible after unlock
- [ ] Update existing password successfully
- [ ] Export HTML and verify password is NOT in export
- [ ] Verify commercialContent IS in export (data only, not password)

## Security Considerations

### ✅ What's Protected:
- Password hashed with bcrypt (10 rounds) before database storage
- Password never sent to client (except during set/verify)
- Password excluded from HTML exports
- Commercial content protected behind password verification

### ⚠️ Limitations:
- Password unlock persists only for current browser session
- Password is per-scratchpad (not per-user)
- No password recovery mechanism (admin must reset)
- No password expiration or rotation policy

## Future Enhancements (Optional)

- [ ] Password strength indicator
- [ ] Password recovery via email
- [ ] Password expiration after X days
- [ ] Audit log for password set/verify attempts
- [ ] Role-based access (PLATFORM_ADMIN can bypass)
- [ ] "Remember me" option for password unlock

---

**Status:** ✅ Complete
**Date:** February 13, 2026
**Phase:** Phase 2 - Task #10
