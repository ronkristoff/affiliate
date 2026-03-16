# Story 8.6: Brand Asset Library

Status: done

## Story

As an affiliate,
I want to access a brand asset library provided by the SaaS Owner,
so that I can use approved marketing materials. (FR42)

## Acceptance Criteria

### AC1: Assets Page Navigation
**Given** the affiliate is logged into the portal
**When** they navigate to the Assets page (new nav item or Links page section)
**Then** the brand asset library is accessible
**And** it shows a list of available marketing assets

### AC2: Asset Display - Categories
**Given** the SaaS Owner has uploaded brand assets
**When** the affiliate views the Assets page
**Then** assets are displayed organized by category:
- **Logos** (brand logos in various formats)
- **Banners** (promotional banners in various sizes)
- **Product Images** (product/service screenshots or photos)
- **Copy Text** (pre-approved promotional copy snippets)

### AC3: Asset Preview
**Given** the affiliate is viewing the asset library
**When** they see an asset
**Then** a preview/thumbnail is displayed
**And** the asset title, type, and dimensions (for images) are shown

### AC4: Asset Download/Copy Actions
**Given** the affiliate wants to use an asset
**When** they click on an asset or its action button
**Then** a download option is available for files (images, logos)
**And** a copy option is available for text assets
**And** the action completes with a success toast

### AC5: Usage Guidelines Display
**Given** the affiliate is viewing assets
**When** the page loads
**Then** usage guidelines are displayed (if configured by SaaS Owner)
**And** guidelines explain how to properly use the brand materials

### AC6: Empty State - No Assets
**Given** the SaaS Owner has not uploaded any assets
**When** the affiliate views the Assets page
**Then** a helpful empty state is displayed
**And** it explains that assets will be added by the program owner

### AC7: Tenant Branding Consistency
**Given** the affiliate is on the Assets page
**When** the page renders
**Then** it uses the tenant's branding (logo, colors)
**And** no salig-affiliate branding is visible

## Tasks / Subtasks

- [x] Task 1: Create brandAssets schema (AC: #2)
  - [x] 1.1 Add `brandAssets` table to `convex/schema.ts`
  - [x] 1.2 Fields: tenantId, type, title, description, fileUrl (or storageId), dimensions, format, category, sortOrder, isActive
  - [x] 1.3 Add index by_tenant and by_tenant_and_category

- [x] Task 2: Create asset queries for affiliate portal (AC: #1-3)
  - [x] 2.1 Create `getAffiliateBrandAssets` query in `convex/brandAssets.ts`
  - [x] 2.2 Return assets grouped by category
  - [x] 2.3 Filter by `isActive: true`
  - [x] 2.4 Order by sortOrder then creationTime

- [x] Task 3: Update portal navigation (AC: #1)
  - [x] 3.1 Add "Assets" item to `PortalSidebar.tsx`
  - [x] 3.2 Add "Assets" item to `PortalBottomNav.tsx`
  - [x] 3.3 Update navigation to include `/portal/assets` route

- [x] Task 4: Create Assets page (AC: #1, #6, #7)
  - [x] 4.1 Create `src/app/portal/assets/page.tsx`
  - [x] 4.2 Follow session management pattern from other portal pages
  - [x] 4.3 Fetch tenant context for branding
  - [x] 4.4 Implement empty state for no assets

- [x] Task 5: Create AssetCard component (AC: #3, #4)
  - [x] 5.1 Create `src/app/portal/assets/components/AssetCard.tsx`
  - [x] 5.2 Display thumbnail/preview for images
  - [x] 5.3 Display title, type, dimensions
  - [x] 5.4 Add download button for files
  - [x] 5.5 Add copy button for text assets

- [x] Task 6: Create AssetCategorySection component (AC: #2)
  - [x] 6.1 Create `src/app/portal/assets/components/AssetCategorySection.tsx`
  - [x] 6.2 Group assets by category (logos, banners, product-images, copy-text)
  - [x] 6.3 Collapsible/expandable sections

- [x] Task 7: Create UsageGuidelines component (AC: #5)
  - [x] 7.1 Create `src/app/portal/assets/components/UsageGuidelines.tsx`
  - [x] 7.2 Display guidelines from tenant settings
  - [x] 7.3 Expandable/collapsible card

- [x] Task 8: Create copy text display component (AC: #4)
  - [x] 8.1 Create `src/app/portal/assets/components/CopyTextCard.tsx`
  - [x] 8.2 Display promotional text with copy button
  - [x] 8.3 Support markdown or plain text

- [ ] Task 9: Integrate with existing PromoLibrary (Optional Enhancement)
  - [ ] 9.1 Consider merging PromoLibrary's copy templates into Brand Assets
  - [ ] 9.2 Or keep separate: system templates (PromoLibrary) + owner assets (Brand Assets)

### Review Follow-ups (AI-Generated)

Issues identified during code review that were deprioritized (LOW severity):

- [ ] [AI-Review][LOW] Improve download method for cross-origin URLs - anchor download may fail in Safari [AssetCard.tsx:40-56]
- [ ] [AI-Review][LOW] Add markdown rendering support for usage guidelines instead of simple line splitting [UsageGuidelines.tsx:39-43]
- [ ] [AI-Review][LOW] Add skeleton loading state matching other portal pages pattern [page.tsx:78-83]
- [ ] [AI-Review][LOW] Update navigation active state logic to support sub-routes [PortalSidebar.tsx, PortalBottomNav.tsx]

## Dev Notes

### CRITICAL: Understanding the Asset Library vs PromoLibrary

**Current State:**
The `PromoLibrary` component in `/portal/links/components/PromoLibrary.tsx` provides:
- Pre-defined copy templates (hardcoded, system-provided)
- Placeholder SVG banners (dynamically generated with tenant color)

**This Story Adds:**
A **Brand Asset Library** with assets **uploaded by the SaaS Owner**:
- Custom logos in various formats
- Real promotional banners (not placeholders)
- Product images
- Pre-approved copy text snippets

**Design Decision:**
- Option A: Create separate `/portal/assets` page for owner-uploaded assets
- Option B: Integrate owner assets into the existing PromoLibrary component
- **Recommendation:** Option A - separate page for cleaner UX and future extensibility

### Database Schema Design

```typescript
// convex/schema.ts - Add brandAssets table

brandAssets: defineTable({
  tenantId: v.id("tenants"),
  type: v.union(
    v.literal("logo"),
    v.literal("banner"),
    v.literal("product-image"),
    v.literal("copy-text"),
  ),
  title: v.string(),
  description: v.optional(v.string()),
  // For file-based assets (images)
  fileUrl: v.optional(v.string()),         // External URL or Convex storage URL
  storageId: v.optional(v.id("_storage")), // If using Convex file storage
  format: v.optional(v.string()),          // "png", "jpg", "svg", "webp"
  dimensions: v.optional(v.object({
    width: v.number(),
    height: v.number(),
  })),
  // For text assets
  textContent: v.optional(v.string()),     // For copy-text type
  // Common fields
  category: v.optional(v.string()),        // Optional sub-category
  sortOrder: v.optional(v.number()),
  isActive: v.boolean(),                   // Allow owner to hide without deleting
}).index("by_tenant", ["tenantId"])
  .index("by_tenant_and_type", ["tenantId", "type"])
  .index("by_tenant_and_active", ["tenantId", "isActive"]);
```

### Query Design

```typescript
// convex/brandAssets.ts (new file) or add to affiliateAuth.ts

export const getAffiliateBrandAssets = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    logos: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      fileUrl: v.string(),
      format: v.optional(v.string()),
      dimensions: v.optional(v.object({
        width: v.number(),
        height: v.number(),
      })),
    })),
    banners: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      fileUrl: v.string(),
      format: v.optional(v.string()),
      dimensions: v.optional(v.object({
        width: v.number(),
        height: v.number(),
      })),
    })),
    productImages: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      fileUrl: v.string(),
      description: v.optional(v.string()),
    })),
    copyText: v.array(v.object({
      _id: v.id("brandAssets"),
      title: v.string(),
      textContent: v.string(),
      description: v.optional(v.string()),
    })),
    usageGuidelines: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify tenant exists
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Fetch all active assets for tenant
    const assets = await ctx.db
      .query("brandAssets")
      .withIndex("by_tenant_and_active", (q) => 
        q.eq("tenantId", args.tenantId).eq("isActive", true)
      )
      .order("asc")
      .collect();

    // Group by type
    const logos = assets.filter(a => a.type === "logo" && a.fileUrl);
    const banners = assets.filter(a => a.type === "banner" && a.fileUrl);
    const productImages = assets.filter(a => a.type === "product-image" && a.fileUrl);
    const copyText = assets.filter(a => a.type === "copy-text" && a.textContent);

    // Get usage guidelines from tenant settings (could be branding field)
    const usageGuidelines = tenant.branding?.assetGuidelines;

    return {
      logos,
      banners,
      productImages,
      copyText,
      usageGuidelines,
    };
  },
});
```

### UI Component Patterns

**Following patterns from previous Epic 8 stories:**

1. **Page Structure** (from `earnings/page.tsx`):
   - Session fetching via `/api/affiliate-auth/session`
   - Tenant context for branding
   - Loading states with skeletons
   - Error handling with error banner

2. **Navigation** (from `PortalSidebar.tsx`, `PortalBottomNav.tsx`):
   - Add "Assets" nav item with appropriate icon (Image or FolderOpen from lucide)
   - Position after "Links" in nav order

3. **Card Components** (from existing portal components):
   - Use shadcn/ui Card, CardHeader, CardTitle, CardContent
   - Tenant's primary color for accents
   - Toast notifications from sonner

### Asset Card Design

```typescript
// AssetCard.tsx structure

interface AssetCardProps {
  asset: {
    _id: Id<"brandAssets">;
    title: string;
    type: "logo" | "banner" | "product-image" | "copy-text";
    fileUrl?: string;
    textContent?: string;
    format?: string;
    dimensions?: { width: number; height: number };
  };
  primaryColor: string;
}

// For images: show thumbnail, download button
// For text: show preview, copy button
// Common: title, type badge, dimensions (if applicable)
```

### File Storage Strategy

**Option 1: Convex File Storage** (Recommended for MVP)
- Use Convex's built-in file storage (`ctx.storage`)
- Store `storageId` in brandAssets table
- Generate URLs via `ctx.storage.getUrl(storageId)`

**Option 2: External URLs**
- SaaS Owner provides URLs to externally hosted assets
- Store directly as `fileUrl` string
- Simpler for MVP but less integrated

**Recommendation:** Start with Option 2 (external URLs) for simplicity, migrate to Convex storage in v2.

### Tenant Branding Extension

Add usage guidelines to tenant branding:

```typescript
// In schema.ts - extend branding object
branding: v.optional(v.object({
  logoUrl: v.optional(v.string()),
  primaryColor: v.optional(v.string()),
  portalName: v.optional(v.string()),
  assetGuidelines: v.optional(v.string()), // NEW: Markdown text with usage guidelines
})),
```

### Navigation Order

Update navigation to include Assets:

| Position | Nav Item | Icon | Route |
|----------|----------|------|-------|
| 1 | Home | LayoutGrid | /portal/home |
| 2 | Earnings | DollarSign | /portal/earnings |
| 3 | Links | Link | /portal/links |
| 4 | **Assets** | **Images** | **/portal/assets** |
| 5 | Account | User | /portal/account |

### Mobile-First Design

The Affiliate Portal is **mobile-first**. Assets page must:
- Load fast on 3G (optimize image previews)
- Have large tap targets for download/copy buttons
- Use bottom sheet or modal for asset detail if needed
- Responsive grid: 1 column on mobile, 2-3 on tablet/desktop

### White-Label Requirement

**CRITICAL:** All components must reflect tenant branding:
- Use tenant's primary color as CSS `--brand` variable
- Use tenant's logo in header
- Use tenant's `portalName` in display
- NO salig-affiliate branding visible to affiliates
- Assets themselves reflect the SaaS Owner's brand

### Empty State Copy

When no assets exist:
```
"No Brand Assets Yet"

"Alex hasn't uploaded any marketing assets yet. Check back soon for 
logos, banners, and promotional copy you can use."

[Action: None - this is informational]
```

### Anti-Pattern Prevention

**DO NOT:**
- Hardcode asset URLs or content - all must come from database
- Show placeholder/generic assets - only show owner-uploaded content
- Create SaaS Owner upload UI in this story - that's a separate story
- Forget loading states - show skeletons while fetching
- Skip error handling - handle query failures gracefully
- Use salig-affiliate branding on the Assets page

### Status Badge System (Existing - Reference Only)

Assets don't need status badges, but for reference:
- **Confirmed**: Green background (#d1fae5), green text (#065f46)
- **Pending**: Yellow background (#fef3c7), amber text (#92400e)
- **Paid**: Gray background (#f3f4f6), gray text (#374151)
- **Reversed**: Red background (#fee2e2), red text (#991b1b)

### File Structure

```
src/app/portal/assets/
├── page.tsx                           # NEW: Main assets page
└── components/
    ├── AssetCard.tsx                  # NEW: Individual asset display
    ├── AssetCategorySection.tsx       # NEW: Category grouping
    ├── CopyTextCard.tsx               # NEW: Text asset with copy
    ├── UsageGuidelines.tsx            # NEW: Guidelines display
    └── AssetsEmptyState.tsx           # NEW: Empty state component

convex/
├── schema.ts                          # UPDATE: Add brandAssets table
├── brandAssets.ts                     # NEW: Asset queries (or add to affiliateAuth.ts)
└── tenants.ts                         # UPDATE: Add assetGuidelines to branding

src/components/affiliate/
├── PortalSidebar.tsx                  # UPDATE: Add Assets nav item
└── PortalBottomNav.tsx                # UPDATE: Add Assets nav item
```

### Previous Story Intelligence (8-5: Payout Balance View)

From the previous story implementation:
- Session management pattern: fetch from `/api/affiliate-auth/session`
- Tenant branding via `getAffiliateTenantContext` query
- Loading states with Loader2 spinner
- Error handling with error state and retry button
- Navigation components: PortalHeader, PortalBottomNav, PortalSidebar
- Responsive layout: sidebar for desktop (hidden on mobile), bottom nav for mobile
- Toast notifications using sonner
- Primary color applied via CSS variable or direct prop

### Database Tables Involved

| Table | Fields Used | Purpose |
|-------|------------|---------|
| `brandAssets` | **NEW TABLE** | Store asset metadata |
| `tenants` | branding.assetGuidelines | Usage guidelines text |
| `affiliates` | (via session) | Affiliate authentication |
| `affiliateSessions` | (via API) | Session validation |

### Testing Considerations

- Test with no assets (empty state)
- Test with only logos
- Test with only banners
- Test with mix of all asset types
- Test download functionality
- Test copy text functionality
- Test with usage guidelines set/unset
- Test tenant branding is applied correctly
- Test mobile responsiveness

### Out of Scope (Future Stories)

- SaaS Owner asset upload interface (likely Story 8.7: Portal Brand Configuration)
- Asset analytics (which assets are downloaded most)
- Asset versioning/history
- Convex file storage integration (v2)
- Bulk asset download

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1491-1507`] - Story definition and acceptance criteria
- [Source: `_bmad-output/planning-artifacts/prd.md#L742`] - FR42 definition
- [Source: `_bmad-output/project-context.md`] - Project coding standards
- [Source: `_bmad-output/implementation-artifacts/8-5-payout-balance-view.md`] - Previous story patterns
- [Source: `src/app/portal/links/page.tsx`] - Portal page pattern
- [Source: `src/app/portal/links/components/PromoLibrary.tsx`] - Existing promo component (different scope)
- [Source: `src/components/affiliate/PortalSidebar.tsx`] - Navigation component
- [Source: `convex/schema.ts`] - Database schema

## Change Log

- **2026-03-16**: Story created with comprehensive context from epic analysis
  - Analyzed Epic 8 requirements and previous story learnings
  - Clarified distinction between PromoLibrary (system templates) and Brand Asset Library (owner assets)
  - Designed schema for brandAssets table
  - Documented required queries and components
  - Status: ready-for-dev

- **2026-03-16**: Implementation completed
  - Added brandAssets table to convex/schema.ts with fields: tenantId, type, title, description, fileUrl, storageId, format, dimensions, textContent, category, sortOrder, isActive
  - Added assetGuidelines field to tenant branding object
  - Created convex/brandAssets.ts with getAffiliateBrandAssets and getBrandAssetById queries
  - Updated PortalSidebar.tsx and PortalBottomNav.tsx with Assets nav item
  - Created /portal/assets/page.tsx with session management, empty state, and tenant branding
  - Created AssetCard.tsx for image asset display with download functionality
  - Created CopyTextCard.tsx for text asset display with copy functionality
  - Created AssetCategorySection.tsx for grouped asset display with collapsible sections
  - Created UsageGuidelines.tsx for displaying tenant's asset usage guidelines
  - Created AssetsEmptyState.tsx for empty state display
  - Status: review

## Dev Agent Record

### Agent Model Used

Claude (big-pickle)

### Debug Log References

### Completion Notes List

- **Implementation completed successfully on 2026-03-16**
- All 8 tasks completed with all subtasks checked
- Schema changes: Added brandAssets table to convex/schema.ts, added assetGuidelines to tenant branding
- Query functions: Created convex/brandAssets.ts with getAffiliateBrandAssets (grouped by category) and getBrandAssetById
- Navigation: Updated PortalSidebar.tsx and PortalBottomNav.tsx with Assets nav item
- Page: Created src/app/portal/assets/page.tsx following existing portal page patterns
- Components: Created AssetCard, CopyTextCard, AssetCategorySection, UsageGuidelines, AssetsEmptyState
- TypeScript validation passed
- Convex codegen completed successfully

- **Code Review Fixes Applied on 2026-03-16 (by Dev Agent - Code Review Workflow)**
- CRITICAL: Created comprehensive test suite in convex/brandAssets.test.ts (25+ test cases covering all ACs)
- HIGH: Added missing by_tenant_and_category index to convex/schema.ts
- HIGH: Fixed security vulnerability in AssetCard.tsx - added rel="noopener noreferrer" to prevent tabnabbing
- HIGH: Fixed hardcoded tenant slug "default" - created getAffiliateTenantContextById query using session tenantId
- MEDIUM: Removed unused imports (Copy, Check) from AssetCard.tsx
- HIGH: Fixed duplicate Task 8 subtasks in story file
- All HIGH and MEDIUM severity issues from code review have been resolved

### File List

- convex/schema.ts (modified - added brandAssets table and assetGuidelines to branding, added by_tenant_and_category index)
- convex/brandAssets.ts (new - asset queries with getAffiliateBrandAssets, getBrandAssetById, getAffiliateTenantContextById)
- convex/brandAssets.test.ts (new - comprehensive test suite with 25+ test cases)
- src/components/affiliate/PortalSidebar.tsx (modified - added Assets nav item)
- src/components/affiliate/PortalBottomNav.tsx (modified - added Assets nav item)
- src/app/portal/assets/page.tsx (modified - main assets page, fixed tenantId from session)
- src/app/portal/assets/components/AssetCard.tsx (modified - image asset display with security fix)
- src/app/portal/assets/components/CopyTextCard.tsx (new - text asset display)
- src/app/portal/assets/components/AssetCategorySection.tsx (new - category grouping)
- src/app/portal/assets/components/UsageGuidelines.tsx (new - guidelines display)
- src/app/portal/assets/components/AssetsEmptyState.tsx (new - empty state)
