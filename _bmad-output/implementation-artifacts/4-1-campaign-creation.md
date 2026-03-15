# Story 4.1: Campaign Creation

Status: done

## Tasks / Subtasks

- [x] Create campaign creation form UI (AC: #1)
  - [x] Build campaign creation modal/dialog component
  - [x] Implement commission type selector (percentage vs flat fee)
  - [x] Add campaign name and description inputs
  - [x] Create commission rate input with validation
  - [x] Add cookie duration configuration
  - [x] Implement recurring commission toggle
  - [x] Add auto-approve commission toggle
  - [x] Create live commission preview component

- [x] Implement campaign creation mutation (AC: #2)
  - [x] Create Convex mutation: `createCampaign`
  - [x] Add input validation using `v` validators
  - [x] Enforce tier limit check via `getTierConfig()`
  - [x] Implement multi-tenant data isolation (scope by `tenantId`)
  - [x] Generate unique campaign ID
  - [x] Create campaign record in database

- [x] Add campaign list query (AC: #2)
  - [x] Create Convex query: `listCampaigns`
  - [x] Filter by `tenantId` for data isolation
  - [x] Order by creation date (newest first)
  - [x] Include campaign statistics aggregation

- [x] Implement tier limit enforcement (AC: #3)
  - [x] Create `getTierConfig()` service function
  - [x] Check campaign count against tier limits
  - [x] Return warning at 80% threshold
  - [x] Return critical warning at 95% threshold
  - [x] Block creation when at limit
  - [x] Display upgrade prompt with tier comparison

- [x] Build campaign detail page (AC: #2)
  - [x] Create campaign detail view component
  - [x] Display campaign configuration
  - [x] Show campaign statistics
  - [x] Add edit/pause/archive actions
  - [x] Implement navigation from list to detail

## Dev Notes

### Architecture Patterns and Constraints

**Database Schema:**
- Campaigns table defined in `convex/schema.ts`
- Required fields: `tenantId`, `name`, `description`, `commissionType`, `commissionRate`, `cookieDuration`, `recurringCommissions`, `autoApproveCommissions`, `status`
- Index on `by_tenant` for efficient tenant-scoped queries
- Index on `by_tenant_status` for filtering by status

**Multi-Tenant Data Isolation:**
- ALL queries must filter by authenticated `tenantId`
- Use `ctx.auth.getUserId()` to get current user
- Look up tenant from `users` table to get `tenantId`
- Apply filter: `.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))`
- NEVER return data without tenant filtering

**Tier Enforcement Pattern:**
- Call `getTierConfig(tenantId)` before creating campaign
- Check current campaign count against `tierConfig.maxCampaigns`
- Return error with upgrade prompt if at limit
- Warning UI at 80% and 95% of limit

**Convex Function Pattern (NEW SYNTAX REQUIRED):**
```typescript
export const createCampaign = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    commissionType: v.union(v.literal("percentage"), v.literal("flatFee")),
    commissionRate: v.number(),
    cookieDuration: v.number(),
    recurringCommissions: v.boolean(),
    autoApproveCommissions: v.boolean(),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    // Implementation
  },
});
```

**Validation Rules:**
- Campaign name: required, min 2 chars, max 100 chars
- Commission type: required (percentage or flatFee)
- Commission rate: required, min 1, max 100 (percentage) or min 0 (flat fee in PHP)
- Cookie duration: optional, default 30 days, min 1, max 365
- Recurring commissions: optional, default false
- Auto-approve: optional, default true (manual review at threshold)

### Source Tree Components to Touch

**Frontend Components:**
- `src/app/(auth)/campaigns/page.tsx` - Campaigns list page
- `src/components/dashboard/CampaignList.tsx` - Campaign list component
- `src/components/dashboard/CreateCampaignModal.tsx` - Campaign creation modal
- `src/components/dashboard/CampaignCard.tsx` - Campaign card display
- `src/components/dashboard/CampaignDetail.tsx` - Campaign detail view

**Convex Backend:**
- `convex/campaigns.ts` - Campaign mutations and queries
  - `createCampaign` - Create new campaign
  - `listCampaigns` - List tenant's campaigns
  - `getCampaign` - Get single campaign by ID
  - `updateCampaign` - Update campaign (for edit/pause/archive)
  - `deleteCampaign` - Archive campaign
- `convex/tierConfig.ts` - Tier configuration service
  - `getTierConfig` - Get tier limits for tenant

**UI Components (shadcn/ui):**
- Button, Input, Label, Dialog, Select, Switch, Card, Badge
- Form components from existing `src/components/ui/` directory

### Testing Standards Summary

**No tests currently exist in this project** - Manual testing required during development

**Manual Testing Checklist:**
1. Campaign creation form displays correctly
2. Commission type selector works (percentage/flat fee)
3. Validation errors display for invalid inputs
4. Live preview updates in real-time
5. Tier limit enforced and upgrade prompt shown
6. Campaign created successfully in database
7. Redirect to campaign detail page works
8. Campaign list displays new campaign
9. Multi-tenant isolation verified (can't see other tenants' campaigns)

### Project Structure Notes

**Alignment with unified project structure:**

Following established patterns from existing codebase:
- ✅ Next.js 16 App Router with route groups `(auth)` for protected routes
- ✅ Server Components by default, `"use client"` for interactive forms
- ✅ Tailwind CSS v4 utility classes
- ✅ shadcn/ui components for consistent UI
- ✅ Better Auth for authentication via `authClient`
- ✅ Convex backend with new function syntax
- ✅ TypeScript strict mode enabled

**Detected conflicts or variances (with rationale):**

None expected - this is the first campaign management story and follows established patterns.

### References

**Source Documents:**
- PRD: FR10, FR11-FR15 (Campaign Management requirements)
- Epic 4 Details: `_bmad-output/planning-artifacts/epics.md#epic-4` lines 725-758
- Architecture: Tier enforcement via `getTierConfig()` service layer
- UX Screens: Campaign creation UI patterns in `05-owner-campaigns.html` and `16-onboarding-campaign.html`
- Project Context: Technology stack and coding rules in `_bmad-output/project-context.md`

**Relevant Architecture Sections:**
- Multi-tenant data isolation: `_bmad-output/planning-artifacts/architecture.md` lines 461-474
- Tier enforcement architecture: `_bmad-output/planning-artifacts/architecture.md` lines 436-436
- Convex function patterns: `_bmad-output/planning-artifacts/architecture.md` lines 259-268
- Database schema patterns: `_bmad-output/planning-artifacts/architecture.md` lines 139-148

**Design Tokens:**
- Brand colors: `--brand-primary: #10409a`, `--brand-secondary: #1659d6`
- Status colors: success (green), warning (amber), danger (red)
- Typography: Poppins (body), Passion One (display headings)
- Border radius: 12px (0.75rem) default
- Input components: shadcn/ui with Tailwind v4

## Dev Agent Record

### Agent Model Used

GLM-4.7 (zai-coding-plan/glm-4.7)

### Debug Log References

Implementation completed successfully. Convex functions validated, TypeScript compiles without errors.

### Completion Notes List

**2026-03-14 - Implementation Complete:**
- Updated `convex/schema.ts` with enhanced campaigns table fields
- Created `convex/campaigns.ts` with all required mutations and queries
- Built campaign creation modal with live preview and tier limit enforcement
- Created campaign list component with stats summary
- Built campaign detail page with edit/pause/archive functionality
- Implemented multi-tenant data isolation using tenantId filtering
- Added tier limit enforcement with warning at 80% and critical at 95%
- All acceptance criteria satisfied

**2026-03-14 - Code Review Fixes Applied:**
- [x] Refactored campaigns.ts to use tierConfig service - eliminated duplicate DEFAULT_LIMITS logic
- [x] Added internalQuery `checkCampaignLimitInternal` to tierConfig.ts for cross-module use
- [x] Fixed currency symbol: changed $ to ₱ in commission preview (CreateCampaignModal.tsx:107)
- [x] Removed unused import `requireTenantId` from campaigns.ts
- [x] Added frontend form validation before submit with real-time error display
- [x] Added loading state for campaign limit check in CreateCampaignModal.tsx
- [x] Added status transition validation in updateCampaign (prevents invalid transitions)
- [x] Fixed error messages in CampaignCard.tsx to show actual error instead of generic message

### File List

**New Files:**
- `convex/campaigns.ts` - Campaign CRUD operations (createCampaign, listCampaigns, getCampaign, updateCampaign, pauseCampaign, resumeCampaign, archiveCampaign, getCampaignStats, checkCampaignLimit)
- `src/components/dashboard/CreateCampaignModal.tsx` - Campaign creation form modal
- `src/components/dashboard/CampaignCard.tsx` - Campaign card component
- `src/components/dashboard/CampaignList.tsx` - Campaign list with stats
- `src/app/(auth)/campaigns/page.tsx` - Campaigns list page
- `src/app/(auth)/campaigns/[id]/page.tsx` - Campaign detail/edit page

**Modified Files:**
- `convex/schema.ts` - Updated campaigns table with new fields (commissionType, commissionRate, cookieDuration, recurringCommissions, autoApproveCommissions)
- `convex/tierConfig.ts` - Added checkCampaignLimitInternal internalQuery for cross-module use

**Total: 8 files (6 new, 2 modified)**

## Senior Developer Review (AI)

**Reviewer:** Code Review Agent (claude-opus)  
**Date:** 2026-03-14  
**Outcome:** Changes Required → Fixed

### Issues Found and Fixed

**🔴 HIGH (4 issues - ALL FIXED):**
1. **Fixed:** Removed duplicate tier limit logic in campaigns.ts - now uses centralized tierConfig service
2. **Fixed:** Currency symbol changed from $ to ₱ for Philippine market consistency
3. **Fixed:** Added comprehensive frontend form validation with error display
4. **Fixed:** Removed dead code (unused import)

**🟡 MEDIUM (5 issues - 4 FIXED, 1 REMAINING):**
1. **Fixed:** Added loading state for campaign limit check
2. **Fixed:** Error messages now show actual error details
3. **Fixed:** Added status transition validation (prevents invalid state changes)
4. **Fixed:** Tier limit constants now centralized in tierConfig service
5. **Deferred:** Replace native `<select>` with shadcn/ui Select component (requires component installation)

### Code Quality Improvements
- DRY principle applied: eliminated duplicate DEFAULT_LIMITS
- Better UX: real-time form validation with visual feedback
- Better error handling: actual error messages shown to users
- Architecture: proper separation of concerns with tierConfig service

## Change Log

- 2026-03-14: Initial implementation - Campaign creation story completed. Added campaign CRUD operations, creation modal, list page, detail page, and tier limit enforcement. (Status: review)
- 2026-03-14: Code review fixes applied - Refactored to use tierConfig service, added frontend validation, fixed currency symbols, improved error handling. (Status: done)
