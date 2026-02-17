# White-Label Multi-Tenant Architecture
**DREAM Discovery Platform**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR PLATFORM LAYER                       │
│                                                              │
│  admin.dreamdiscovery.com (SUPER ADMIN)                     │
│  - Manage all tenants                                        │
│  - Monitor servers (CaptureAPI, DB)                         │
│  - Billing, usage, alerts                                   │
│  - YOUR branding                                            │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   TENANT 1   │  │   TENANT 2   │  │   TENANT 3   │
│              │  │              │  │              │
│ Upstream     │  │ Consultant   │  │ Agency       │
│ Works        │  │ Co           │  │ XYZ          │
└──────────────┘  └──────────────┘  └──────────────┘
       │
       │ TENANT LAYER (Upstream Works Example)
       ▼
┌─────────────────────────────────────────────────────────────┐
│                UPSTREAM WORKS ADMIN PORTAL                   │
│                                                              │
│  admin.upstreamworks.com                                    │
│  - Manage THEIR workshops                                   │
│  - Manage THEIR facilitators                                │
│  - Create custom domains for THEIR customers                │
│  - UPSTREAM WORKS branding                                  │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ CUSTOMER 1   │  │ CUSTOMER 2   │  │ CUSTOMER 3   │
│              │  │              │  │              │
│ acme-corp    │  │ nhs-trust    │  │ startup-co   │
│ .upstream    │  │ .upstream    │  │ .upstream    │
│ works.com    │  │ works.com    │  │ works.com    │
└──────────────┘  └──────────────┘  └──────────────┘
       │
       │ END-CUSTOMER LAYER (Acme Corp Example)
       ▼
┌─────────────────────────────────────────────────────────────┐
│           acme-corp.upstreamworks.com                        │
│                                                              │
│  PARTICIPANT VIEW:                                          │
│  - Discovery conversation (AI chat)                         │
│  - Shows UPSTREAM WORKS branding                            │
│  - Participant sees their workshop                          │
│                                                              │
│  PUBLISHED REPORT VIEW:                                     │
│  - /report - Final scratchpad output                        │
│  - PDF download                                             │
│  - Shareable link                                           │
│  - UPSTREAM WORKS branding                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Extensions

### Organizations Table (Enhanced)

```typescript
model Organization {
  id               String    @id @default(cuid())
  name             String    // "Upstream Works"

  // White-label branding
  logo             String?   // URL to logo
  primaryColor     String?   // #1E40AF
  secondaryColor   String?   // #3B82F6

  // Custom domain
  customDomain     String?   @unique // "upstreamworks.com"

  // Subscription tier
  tier             OrgTier   @default(STARTER)
  maxWorkshops     Int       @default(10)
  maxUsers         Int       @default(5)

  // Contact
  billingEmail     String
  supportEmail     String?

  // Status
  status           OrgStatus @default(ACTIVE)

  users            User[]
  workshops        Workshop[]
  customDomains    CustomDomain[]

  @@map("organizations")
}

enum OrgTier {
  STARTER      // 10 workshops/month
  PROFESSIONAL // 50 workshops/month
  ENTERPRISE   // Unlimited
}

enum OrgStatus {
  ACTIVE
  SUSPENDED
  TRIAL
  CANCELLED
}
```

### Custom Domains Table (NEW)

```typescript
model CustomDomain {
  id             String       @id @default(cuid())
  organizationId String
  workshopId     String?      // If workshop-specific

  // Domain info
  domain         String       @unique // "acme-corp.upstreamworks.com"
  verified       Boolean      @default(false)
  verificationCode String?    // For DNS verification

  // SSL
  sslEnabled     Boolean      @default(false)
  sslCert        String?      // Path to cert

  // Status
  active         Boolean      @default(true)
  createdAt      DateTime     @default(now())

  organization   Organization @relation(...)
  workshop       Workshop?    @relation(...)

  @@map("custom_domains")
}
```

### Workshops Table (Enhanced)

```typescript
model Workshop {
  id                String    @id @default(cuid())
  organizationId    String
  name              String    // "Acme Corp Q4 Strategy"

  // Custom domain for THIS workshop
  customSlug        String?   // "acme-corp" → acme-corp.upstreamworks.com
  customDomain      CustomDomain?

  // Published report
  publishedAt       DateTime?
  publishedUrl      String?   // Public URL to report
  reportPassword    String?   // Optional password protection

  // Branding override (optional - uses org branding by default)
  customLogo        String?
  customColors      Json?

  organization      Organization @relation(...)
  scratchpad        WorkshopScratchpad?

  @@map("workshops")
}
```

### Users Table (Enhanced)

```typescript
model User {
  id               String       @id @default(cuid())
  email            String       @unique
  name             String
  organizationId   String?      // NULL for super admins

  // Role
  role             UserRole     @default(ORG_ADMIN)

  // Permissions
  permissions      Json?        // Granular permissions

  // Status
  active           Boolean      @default(true)
  lastLoginAt      DateTime?

  organization     Organization? @relation(...)

  @@map("users")
}

enum UserRole {
  SUPER_ADMIN      // You - see ALL orgs, platform controls
  ORG_ADMIN        // Upstream Works admin - see their org only
  FACILITATOR      // Can run workshops, limited admin
  ANALYST          // Read-only access
}
```

---

## URL Routing Strategy

### Option A: Subdomain-Based (RECOMMENDED)

**Platform Admin:**
- `admin.dreamdiscovery.com` → Super admin dashboard

**Tenant Portals:**
- `admin.upstreamworks.com` → Upstream Works admin
- `admin.consultantco.com` → Consultant Co admin

**End-Customer Workshops:**
- `acme-corp.upstreamworks.com` → Acme's workshop
- `nhs-trust.upstreamworks.com` → NHS workshop
- `startup-co.upstreamworks.com` → Startup's workshop

**Implementation:**
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // Super admin
  if (hostname.startsWith('admin.dreamdiscovery.com')) {
    return handleSuperAdmin(request);
  }

  // Tenant admin portal
  if (hostname.startsWith('admin.')) {
    const domain = hostname.replace('admin.', '');
    return handleTenantAdmin(request, domain);
  }

  // End-customer workshop
  const customDomain = await getCustomDomain(hostname);
  if (customDomain) {
    return handleWorkshop(request, customDomain);
  }
}
```

---

### Option B: Path-Based (Simpler DNS)

**Single domain:** `app.dreamdiscovery.com`

**Platform Admin:**
- `app.dreamdiscovery.com/platform`

**Tenant Portals:**
- `app.dreamdiscovery.com/upstream-works/admin`
- `app.dreamdiscovery.com/consultant-co/admin`

**End-Customer:**
- `app.dreamdiscovery.com/upstream-works/acme-corp`
- `app.dreamdiscovery.com/upstream-works/nhs-trust`

**Pros:** Simpler DNS, one SSL cert
**Cons:** Less "white-label" feel, URLs show your brand

---

## DNS Configuration

### For Each Tenant (e.g., Upstream Works)

**When Upstream Works signs up:**

1. **You configure:**
   ```
   admin.upstreamworks.com  → CNAME → your-app.vercel.app
   *.upstreamworks.com      → CNAME → your-app.vercel.app
   ```

2. **They configure (on their domain):**
   ```
   DNS Record Type: CNAME
   Name: admin
   Value: your-app.vercel.app

   DNS Record Type: CNAME
   Name: *
   Value: your-app.vercel.app
   ```

3. **SSL Certificate:**
   - Vercel handles wildcard SSL automatically
   - Or use Cloudflare for SSL management

---

## Branding System

### Dynamic Theming

```typescript
// Get branding based on hostname
export async function getBranding(hostname: string) {
  // Check if custom domain
  const customDomain = await prisma.customDomain.findUnique({
    where: { domain: hostname },
    include: {
      organization: true,
      workshop: true
    }
  });

  if (customDomain) {
    return {
      logo: customDomain.organization.logo,
      primaryColor: customDomain.organization.primaryColor,
      secondaryColor: customDomain.organization.secondaryColor,
      name: customDomain.organization.name
    };
  }

  // Default platform branding
  return {
    logo: '/platform-logo.png',
    primaryColor: '#1E40AF',
    secondaryColor: '#3B82F6',
    name: 'DREAM Discovery'
  };
}
```

### Layout Component

```tsx
// app/layout.tsx
export default async function RootLayout({ children }) {
  const hostname = headers().get('host') || '';
  const branding = await getBranding(hostname);

  return (
    <html>
      <head>
        <style>{`
          :root {
            --primary-color: ${branding.primaryColor};
            --secondary-color: ${branding.secondaryColor};
          }
        `}</style>
      </head>
      <body>
        <header>
          <img src={branding.logo} alt={branding.name} />
        </header>
        {children}
      </body>
    </html>
  );
}
```

---

## Published Report URLs

### Workshop Report Publishing Flow

1. **Workshop Completed**
   - Facilitator clicks "Publish Report"
   - System generates scratchpad

2. **Custom URL Creation**
   ```typescript
   // When publishing
   const workshop = await prisma.workshop.update({
     where: { id: workshopId },
     data: {
       publishedAt: new Date(),
       customSlug: 'acme-corp', // From workshop name
       publishedUrl: 'https://acme-corp.upstreamworks.com/report'
     }
   });

   // Create custom domain entry
   await prisma.customDomain.create({
     data: {
       domain: 'acme-corp.upstreamworks.com',
       organizationId: workshop.organizationId,
       workshopId: workshop.id,
       verified: true
     }
   });
   ```

3. **Public Access**
   ```
   https://acme-corp.upstreamworks.com/report

   Shows:
   - Upstream Works branding
   - Workshop scratchpad (6 tabs)
   - PDF download
   - Optional password protection
   ```

---

## Platform Admin Dashboard

### Super Admin Views

**Dashboard:**
- Total tenants: 12
- Active workshops: 45
- Server health: ✅ CaptureAPI, ✅ Database
- Alerts: 2 warnings
- Revenue this month: $5,400

**Tenant Management:**
```
┌────────────────────────────────────────────────────────┐
│ Organization        │ Tier    │ Workshops │ Status    │
├────────────────────────────────────────────────────────┤
│ Upstream Works      │ PRO     │ 12/50     │ ✅ Active │
│ Consultant Co       │ STARTER │ 8/10      │ ✅ Active │
│ Agency XYZ          │ ENTER   │ 45/∞      │ ✅ Active │
│ Beta Client         │ TRIAL   │ 2/10      │ ⚠️ Trial  │
└────────────────────────────────────────────────────────┘
```

**Monitoring:**
- CaptureAPI status: ✅ Running (Railway)
- Database: ✅ Healthy (Supabase)
- Response time (p95): 145ms
- Error rate: 0.02%
- Disk usage: 45%

---

## Implementation Priorities

### PHASE 1: Core White-Label (Today - 3 hours)
1. Add CustomDomain table
2. Add Organization branding fields
3. Add UserRole enum
4. Build super admin dashboard skeleton
5. Add custom domain routing

### PHASE 2: Branding System (Tomorrow - 2 hours)
6. Dynamic theming based on hostname
7. Logo upload functionality
8. Color customization UI
9. Preview mode

### PHASE 3: Published Reports (Day 3 - 3 hours)
10. Report publishing flow
11. Custom slug generation
12. Public report page
13. PDF export with branding

### PHASE 4: Monitoring (Day 4 - 2 hours)
14. Server health checks
15. Usage metrics
16. Alert system
17. Analytics dashboard

---

## Cost Implications

### DNS & SSL
- Vercel: Automatic SSL for custom domains (included)
- Cloudflare: Free tier supports this
- Cost: $0

### Subdomain Routing
- Wildcard DNS: Supported by most platforms
- Vercel/Railway: Handles this automatically
- Cost: $0

### Storage
- Logos: Use S3 or Supabase Storage
- Cost: ~$1-5/month

### Total Additional Cost: ~$5/month

---

## Security Considerations

### Domain Verification
```typescript
// Before activating custom domain
async function verifyDomain(domain: string) {
  // Generate verification code
  const verificationCode = generateRandomString();

  // Ask tenant to add TXT record:
  // _dream-verify.acme-corp.upstreamworks.com = verification-code-123

  // Check DNS
  const txtRecords = await resolveTxt(`_dream-verify.${domain}`);
  return txtRecords.includes(verificationCode);
}
```

### SSL Certificate Management
- Vercel handles automatically
- Or use Let's Encrypt + Cloudflare

### Rate Limiting
```typescript
// Per custom domain
const rateLimit = new RateLimit({
  identifier: hostname,
  limit: 100,
  window: '1m'
});
```

---

## Next Steps

**Tell me:**
1. Do you want subdomain-based (Option A) or path-based (Option B)?
2. What's your platform brand name? (for admin.yourname.com)
3. Should I build this now or document for later?

**I can build today:**
- Database migrations for custom domains
- Super admin dashboard
- Custom domain routing
- Basic branding system

**Estimated time: 3-4 hours**

Ready to proceed?
