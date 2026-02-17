# End-to-End Testing Guide

## Table of Contents

- [Quick Test Checklist](#quick-test-checklist)
- [Manual Testing Workflows](#manual-testing-workflows)
- [Automated E2E Testing Setup](#automated-e2e-testing-setup)
- [Database Setup for Testing](#database-setup-for-testing)
- [Testing Critical Security Features](#testing-critical-security-features)
- [Testing GDPR Compliance](#testing-gdpr-compliance)
- [Performance Testing](#performance-testing)
- [Troubleshooting](#troubleshooting)

---

## Quick Test Checklist

### Pre-Deployment Checklist ✅

Run these tests before deploying to production:

```bash
# 1. Run all unit and integration tests
npm test

# 2. Check test coverage (should be 60%+)
npm run test:coverage

# 3. Verify environment variables
npm run dev  # Should start without errors

# 4. Run database migrations
npx prisma db push

# 5. Check TypeScript compilation
npm run build
```

**Critical Paths to Test Manually**:
- [ ] Admin login + session validation
- [ ] Workshop creation → participant invitation → conversation completion
- [ ] GDPR data export
- [ ] GDPR data deletion (two-step process)
- [ ] Live workshop visualization
- [ ] Account lockout (5 failed logins)

---

## Manual Testing Workflows

### 1. Complete Workshop Flow (20 minutes)

This tests the full user journey from workshop creation to data analysis.

#### Step 1: Admin Login & Workshop Creation

```bash
# Start the dev server
npm run dev
```

1. **Navigate to**: `http://localhost:3001/admin/login`
2. **Login with**:
   - Email: `admin@example.com`
   - Password: `password123` (if using seed data)
3. **Create Workshop**:
   - Click "Create Workshop"
   - Name: "E2E Test Workshop"
   - Description: "Testing full workflow"
   - Business Context: "Validating platform functionality"
   - Workshop Type: "STRATEGY"
   - Schedule Date: Tomorrow
   - Response Deadline: Next week
   - Include Regulation: ✅
   - Click "Create"

#### Step 2: Add Participants

**Option A: Manual Entry**
1. Click into the workshop
2. Click "Add Participant"
3. Enter:
   - Email: `participant@example.com`
   - Name: "Test Participant"
   - Role: "Product Manager"
   - Department: "Product"
   - Attribution: "NAMED"
4. Click "Save"

**Option B: CSV Upload** (faster for multiple participants)
1. Create a CSV file `test-participants.csv`:
   ```csv
   email,name,role,department
   participant1@example.com,Alice Johnson,Product Manager,Product
   participant2@example.com,Bob Smith,Engineer,Engineering
   participant3@example.com,Carol Davis,Designer,Design
   ```
2. Upload via "Import CSV" button

#### Step 3: Get Discovery Link

1. In the participants table, copy the `discoveryToken` for a participant
2. Note the `workshopId` from the URL
3. **Discovery URL format**:
   ```
   http://localhost:3001/discovery/[workshopId]/[discoveryToken]
   ```
4. Example:
   ```
   http://localhost:3001/discovery/workshop-123/abc123token
   ```

#### Step 4: Complete Participant Conversation

1. **Open discovery link** in incognito/private window (to test as participant)
2. **Grant Consent**:
   - Review consent types
   - Click "I Consent"
3. **Complete Conversation**:
   - Intro phase: Confirm attribution preference
   - Current State: "Our main challenge is coordinating across distributed teams in different time zones. We waste about 2 hours per day in synchronous meetings that could be asynchronous."
   - Constraints: "We're limited by our legacy communication tools which don't support threaded conversations or async decision-making."
   - Vision: "Ideally, we'd have AI-powered async collaboration where context is preserved and decisions happen in real-time without meetings."
   - Prioritization: "Top priority is reducing meeting overhead. Quick win would be moving status updates to async."
   - Summary: Confirm insights
4. **Verify completion**: Should see "Thank you" message

#### Step 5: Verify Admin Dashboard

1. **Return to admin dashboard**
2. **Check workshop status**:
   - Participant should show `responseCompletedAt` timestamp
   - Completion rate: 1/1 (100%)
3. **View transcript**:
   - Navigate to workshop → Transcripts
   - Verify all conversation phases captured
4. **View insights**:
   - Navigate to workshop → Insights
   - Verify AI extracted:
     - Challenge: "Distributed team coordination"
     - Constraint: "Legacy communication tools"
     - Vision: "AI-powered async collaboration"
     - Priority: "Reducing meeting overhead"

#### Step 6: Test Live Workshop Features

1. **Open Live View**: `/admin/workshops/[id]/live`
2. **Verify Hemisphere Visualization**:
   - Should show nodes for each insight
   - Links connecting related concepts
   - Stats: 1 active participant, X nodes, Y links
3. **Test Scratchpad**:
   - Navigate to Scratchpad tab
   - Click "Generate Scratchpad"
   - Verify synthesis document generated
   - Test PDF export

**Expected Result**: ✅ Complete workflow from creation → participation → analysis

---

### 2. Security & Authentication Testing (15 minutes)

#### Test 1: JWT Session Validation

**Goal**: Verify JWTs are properly signed and validated

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' \
  -c cookies.txt -v
```

**Verify**:
1. Response includes `Set-Cookie: admin_session=<jwt>; HttpOnly; SameSite=Strict`
2. JWT format: `header.payload.signature` (3 parts separated by dots)
3. Try accessing protected endpoint:
   ```bash
   curl http://localhost:3001/api/admin/workshops \
     -b cookies.txt
   ```
4. Should return workshops (not 401)

**Test Invalid JWT**:
```bash
curl http://localhost:3001/api/admin/workshops \
  -H "Cookie: admin_session=invalid.jwt.token"
```
**Expected**: 401 Unauthorized

#### Test 2: Account Lockout Protection

**Goal**: Verify account locks after 5 failed attempts

1. **Attempt 1-4**: Login with wrong password
   ```bash
   for i in {1..4}; do
     curl -X POST http://localhost:3001/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"admin@example.com","password":"wrongpassword"}'
     echo "\n"
   done
   ```
   **Expected**: 401 "Invalid email or password"

2. **Attempt 5**: Should lock account
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"wrongpassword"}'
   ```
   **Expected**: 403 "Account locked for 15 minutes"

3. **Attempt 6**: Even correct password fails
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}'
   ```
   **Expected**: 403 "Account locked"

4. **Wait 15 minutes** (or manually reset in database):
   ```sql
   UPDATE users
   SET "failedLoginCount" = 0, "lockedUntil" = NULL
   WHERE email = 'admin@example.com';
   ```

5. **Test successful login** after reset

**Expected Result**: ✅ Account lockout working correctly

#### Test 3: Organization Isolation

**Goal**: Verify tenants can only access their own data

**Setup**: Create two organizations and users
```sql
-- Run in Prisma Studio or psql
INSERT INTO organizations (id, name) VALUES
  ('org-a', 'Company A'),
  ('org-b', 'Company B');

INSERT INTO users (id, email, name, password, role, "organizationId", "isActive") VALUES
  ('user-a', 'admin-a@example.com', 'Admin A', '$2a$10$...', 'TENANT_ADMIN', 'org-a', true),
  ('user-b', 'admin-b@example.com', 'Admin B', '$2a$10$...', 'TENANT_ADMIN', 'org-b', true);

INSERT INTO workshops (id, "organizationId", name, "createdById") VALUES
  ('workshop-a', 'org-a', 'Workshop A', 'user-a'),
  ('workshop-b', 'org-b', 'Workshop B', 'user-b');
```

**Test**:
1. Login as Admin A
2. Try to access Workshop B:
   ```bash
   curl http://localhost:3001/api/admin/workshops/workshop-b \
     -b cookies-admin-a.txt
   ```
   **Expected**: 403 "Access denied: Workshop belongs to different organization"

3. Verify Admin A can access Workshop A:
   ```bash
   curl http://localhost:3001/api/admin/workshops/workshop-a \
     -b cookies-admin-a.txt
   ```
   **Expected**: 200 with workshop data

**Expected Result**: ✅ Organization isolation working

---

### 3. GDPR Compliance Testing (20 minutes)

#### Test 1: Data Export (Article 15)

**Step 1: Get participant credentials**
```sql
SELECT email, "workshopId", "discoveryToken"
FROM workshop_participants
WHERE email = 'participant@example.com';
```

**Step 2: Request export**
```bash
curl -X POST http://localhost:3001/api/gdpr/export \
  -H "Content-Type: application/json" \
  -d '{
    "email": "participant@example.com",
    "workshopId": "workshop-123",
    "authToken": "abc123discoverytoken"
  }' | jq .
```

**Verify Response Includes**:
- ✅ `data.participant` (personal info)
- ✅ `data.workshop` (context)
- ✅ `data.sessions` (conversation metadata)
- ✅ `data.messages` (chat history)
- ✅ `data.dataPoints` (captured utterances)
- ✅ `data.insights` (AI analysis)
- ✅ `data.reports` (summaries)
- ✅ `data.consentRecords` (consent history)
- ✅ `metadata.exportedAt` (timestamp)
- ✅ `metadata.format: "GDPR_EXPORT_V1"`
- ✅ `metadata.article: "Article 15 - Right to Access"`

**Test Rate Limiting**:
```bash
# Try 6 exports in quick succession
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/gdpr/export \
    -H "Content-Type: application/json" \
    -d '{...}' -w "\nStatus: %{http_code}\n"
done
```
**Expected**: First 5 succeed (200), 6th fails (429 "Rate limit exceeded")

#### Test 2: Data Deletion (Article 17)

**⚠️ WARNING**: This permanently deletes data. Test with non-production data only!

**Step 1: Request deletion** (generates confirmation token)
```bash
RESPONSE=$(curl -X POST http://localhost:3001/api/gdpr/delete \
  -H "Content-Type: application/json" \
  -d '{
    "email": "participant@example.com",
    "workshopId": "workshop-123",
    "authToken": "abc123discoverytoken"
  }')

echo $RESPONSE | jq .

# Extract confirmation token
CONFIRMATION_TOKEN=$(echo $RESPONSE | jq -r '.confirmationToken')
```

**Verify**:
- ✅ Status 200
- ✅ Message contains "confirmation"
- ✅ `confirmationToken` returned

**Step 2: Confirm deletion** (within 30 minutes)
```bash
curl -X POST http://localhost:3001/api/gdpr/delete \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"participant@example.com\",
    \"workshopId\": \"workshop-123\",
    \"authToken\": \"abc123discoverytoken\",
    \"confirmationToken\": \"$CONFIRMATION_TOKEN\"
  }" | jq .
```

**Verify Response**:
- ✅ Status 200
- ✅ `deletedRecords` object with counts:
  - `messages: N`
  - `insights: N`
  - `reports: N`
  - `dataPoints: N`
  - `classifications: N`
  - `annotations: N`
  - `sessions: N`
  - `consentRecords: N`
  - `participant: 1`

**Step 3: Verify deletion in database**
```sql
-- Should return 0 rows
SELECT * FROM workshop_participants WHERE email = 'participant@example.com';
SELECT * FROM conversation_sessions WHERE "participantId" = '<participant-id>';
SELECT * FROM conversation_messages WHERE "sessionId" IN (...);
```

**Step 4: Verify audit log preserved**
```sql
-- Should still exist
SELECT * FROM audit_logs WHERE action = 'GDPR_DELETE' AND "userEmail" = 'participant@example.com';
```

**Test Edge Cases**:
1. **Invalid confirmation token**:
   ```bash
   curl -X POST http://localhost:3001/api/gdpr/delete \
     -d '{..., "confirmationToken": "wrong-token"}'
   ```
   **Expected**: 401 "Invalid confirmation token"

2. **Expired token** (after 30 minutes):
   - Update `deletionRequestedAt` to 31 minutes ago in DB
   - Try deletion with valid token
   **Expected**: 401 "Confirmation token expired"

3. **Delete twice** (idempotency):
   - Try deletion again after successful deletion
   **Expected**: 401 "Participant not found"

**Expected Result**: ✅ GDPR deletion working correctly

---

### 4. Performance Testing (10 minutes)

#### Test 1: Database Index Performance

**Before Applying Indexes** (baseline):
```sql
EXPLAIN ANALYZE
SELECT * FROM data_points
WHERE "workshopId" = 'workshop-123'
ORDER BY "createdAt" DESC;
```
Note the execution time.

**Apply Indexes**:
```bash
psql $DATABASE_URL -f prisma/migrations/add_performance_indexes.sql
```

**After Applying Indexes**:
```sql
EXPLAIN ANALYZE
SELECT * FROM data_points
WHERE "workshopId" = 'workshop-123'
ORDER BY "createdAt" DESC;
```

**Expected**: 10-100x faster (should use Index Scan instead of Seq Scan)

#### Test 2: Pagination Performance

**Unbounded Query** (bad):
```bash
curl http://localhost:3001/api/admin/workshops
```
Monitor response time for 1000+ workshops.

**Paginated Query** (good):
```bash
curl "http://localhost:3001/api/admin/workshops?page=1&limit=20"
```

**Expected**: Paginated query should be consistently fast regardless of total count.

#### Test 3: N+1 Query Verification

**Enable Prisma Query Logging**:
```env
# .env
DATABASE_URL="postgresql://...?connection_limit=1"
DEBUG="prisma:query"
```

**Test Hemisphere Endpoint**:
```bash
npm run dev 2>&1 | grep "prisma:query" > queries.log &
curl http://localhost:3001/api/admin/workshops/workshop-123/hemisphere
```

**Verify**:
- Old code: 1 session query + N report queries + N insight queries (N+1 problem)
- New code: 1 query with `include` (fixed)

**Expected**: Should see single query with JOIN instead of multiple queries

---

## Automated E2E Testing Setup

### Option 1: Playwright (Recommended)

**Install Playwright**:
```bash
npm install -D @playwright/test
npx playwright install
```

**Create E2E Test** (`e2e/workshop-flow.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Complete Workshop Flow', () => {
  test('admin can create workshop and participant can complete conversation', async ({ browser }) => {
    // Create two contexts: admin and participant
    const adminContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const participantPage = await participantContext.newPage();

    // Admin flow
    await test.step('Admin logs in', async () => {
      await adminPage.goto('http://localhost:3001/admin/login');
      await adminPage.fill('input[name="email"]', 'admin@example.com');
      await adminPage.fill('input[name="password"]', 'password123');
      await adminPage.click('button[type="submit"]');
      await expect(adminPage).toHaveURL(/\/admin\/dashboard/);
    });

    await test.step('Admin creates workshop', async () => {
      await adminPage.click('text=Create Workshop');
      await adminPage.fill('input[name="name"]', 'E2E Test Workshop');
      await adminPage.fill('textarea[name="description"]', 'Automated test');
      await adminPage.fill('textarea[name="businessContext"]', 'Testing');
      await adminPage.selectOption('select[name="workshopType"]', 'STRATEGY');
      await adminPage.check('input[name="includeRegulation"]');
      await adminPage.click('button[type="submit"]');
      await expect(adminPage.locator('text=Workshop created')).toBeVisible();
    });

    let discoveryUrl: string;
    await test.step('Admin adds participant', async () => {
      await adminPage.click('text=Add Participant');
      await adminPage.fill('input[name="email"]', 'e2e-test@example.com');
      await adminPage.fill('input[name="name"]', 'E2E Test User');
      await adminPage.fill('input[name="role"]', 'Tester');
      await adminPage.fill('input[name="department"]', 'QA');
      await adminPage.click('button[type="submit"]');

      // Get discovery link
      discoveryUrl = await adminPage.locator('[data-testid="discovery-link"]').textContent();
    });

    // Participant flow
    await test.step('Participant completes conversation', async () => {
      await participantPage.goto(discoveryUrl);

      // Consent
      await participantPage.click('text=I Consent');

      // Phase 1: Intro
      await participantPage.fill('textarea', 'I prefer named attribution');
      await participantPage.click('button:has-text("Continue")');

      // Phase 2: Current State
      await participantPage.fill('textarea',
        'Our main challenge is coordinating across distributed teams. ' +
        'We waste about 2 hours per day in meetings.'
      );
      await participantPage.click('button:has-text("Send")');
      await participantPage.waitForSelector('text=Can you tell me more');

      // Continue conversation...
      // (Add more phases as needed)

      // Verify completion
      await expect(participantPage.locator('text=Thank you')).toBeVisible();
    });

    await test.step('Admin verifies completion', async () => {
      await adminPage.reload();
      await expect(adminPage.locator('text=1/1 completed')).toBeVisible();

      // Check transcript
      await adminPage.click('text=View Transcript');
      await expect(adminPage.locator('text=coordinating across distributed teams')).toBeVisible();
    });

    // Cleanup
    await adminContext.close();
    await participantContext.close();
  });
});
```

**Run E2E Tests**:
```bash
# Start dev server in background
npm run dev &

# Run Playwright tests
npx playwright test

# View test report
npx playwright show-report
```

---

### Option 2: Cypress

**Install Cypress**:
```bash
npm install -D cypress
npx cypress open
```

**Create Test** (`cypress/e2e/workshop-flow.cy.ts`):
```typescript
describe('Workshop Flow', () => {
  it('completes full workflow', () => {
    // Admin login
    cy.visit('http://localhost:3001/admin/login');
    cy.get('input[name="email"]').type('admin@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    // Create workshop
    cy.contains('Create Workshop').click();
    cy.get('input[name="name"]').type('Cypress Test Workshop');
    // ... rest of test
  });
});
```

---

## Database Setup for Testing

### Test Database Configuration

**Create separate test database**:
```bash
createdb dream_discovery_test
psql dream_discovery_test -c "CREATE EXTENSION vector;"
```

**Configure `.env.test`**:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dream_discovery_test"
SESSION_SECRET="test-secret-key-min-32-chars-long"
OPENAI_API_KEY="test-key"
NODE_ENV="test"
```

**Reset test database before each test run**:
```bash
# Add to package.json scripts
{
  "scripts": {
    "test:e2e": "npm run test:db:reset && playwright test",
    "test:db:reset": "dotenv -e .env.test -- npx prisma db push --force-reset"
  }
}
```

---

## Troubleshooting

### Common Issues

#### Issue: "Rate limit exceeded" during testing

**Solution**: Reset rate limits between tests
```typescript
// In test setup
beforeEach(async () => {
  // Clear rate limit cache
  await fetch('http://localhost:3001/api/test/reset-rate-limits', {
    method: 'POST'
  });
});
```

#### Issue: JWT "Invalid signature" errors

**Solution**: Ensure SESSION_SECRET is consistent
```bash
# Check if SESSION_SECRET is set
echo $SESSION_SECRET

# Set in .env if missing
SESSION_SECRET=$(openssl rand -base64 32)
```

#### Issue: Prisma "Connection pool timeout"

**Solution**: Increase connection pool size
```env
DATABASE_URL="postgresql://...?connection_limit=10"
```

#### Issue: Tests fail due to stale data

**Solution**: Use transactions and rollback
```typescript
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

---

## Continuous Integration Setup

### GitHub Actions Example

Create `.github/workflows/test.yml`:
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        run: |
          npx prisma db push
          npm run db:seed

      - name: Run unit & integration tests
        run: npm test

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Summary

### Testing Pyramid

```
       E2E Tests (5%)          ← Playwright/Cypress (this guide)
      /           \
    Integration (15%)          ← Vitest integration tests (done)
   /                 \
  Unit Tests (80%)               ← Vitest unit tests (done)
```

### Priority Testing Order

1. **✅ Unit Tests** - Already complete (encryption, consent, audit)
2. **✅ Integration Tests** - Already complete (auth, GDPR)
3. **🔄 Manual E2E** - Use workflows above (20 min per release)
4. **🔜 Automated E2E** - Set up Playwright (recommended next step)

### Recommended Test Schedule

- **Before every commit**: Unit tests (`npm test`)
- **Before every PR**: Integration tests + manual critical path
- **Before every release**: Full E2E suite (manual or automated)
- **Weekly**: Performance benchmarks
- **Monthly**: Security audit + GDPR compliance review

---

**Questions or Issues?**
- Open a GitHub issue for test failures
- See `/docs/API_GUIDE.md` for endpoint documentation
- Check `/IMPLEMENTATION_SUMMARY.md` for recent changes
