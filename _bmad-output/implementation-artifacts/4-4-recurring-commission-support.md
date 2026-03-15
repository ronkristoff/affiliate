# Story 4.4: Recurring Commission Support

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a SaaS Owner,
I I want to enable recurring commissions on a campaign with flexible rate options,
so that affiliates earn on every renewal charge, not just the first payment.

## Acceptance Criteria

1. **Given** the user is creating or editing a campaign
   **When** they enable "Recurring Commissions"
   **Then** a recurring commission configuration section is displayed
   **And** options for recurring rate type are shown: "Same as Initial", "Reduced Rate", or "Custom Rate"

2. **Given** the user selects "Same as Initial" rate type
   **When** the campaign is saved
   **Then** the recurring rate equals the initial commission rate
   **And** no separate rate input is needed

3. **Given** the user selects "Reduced Rate" rate type
   **When** the campaign is saved
   **Then** a reduced percentage is stored (default: 50% of initial rate)
   **And** the user can customize the reduced percentage

4. **Given** the user selects "Custom Rate" rate type
   **When** the campaign is saved
   **Then** a custom percentage is stored
   **And** the user specifies the exact percentage

5. **Given** recurring commissions are enabled on a campaign
   **When** a subscription renewal is processed
   **Then** a commission is created for the renewal
   **And** the recurring rate type is applied correctly

6. **Given** the campaign is in edit mode
   **When** the user disables recurring commissions
   **Then** existing recurring commissions are preserved
   **And** no new recurring commissions will be created

## Tasks / Subtasks

- [x] Add recurring rate type field to schema (AC: #1)
  - [x] Add `recurringRateType` field to campaigns table
  - [x] Values: "same", "reduced", "custom"
  - [x] Default: "same" when recurring enabled

- [x] Enhance CreateCampaignModal with rate type selector (AC: #1, #2, #3, #4)
  - [x] Add Select component for recurring rate type
  - [x] Show/hide rate input based on selected type
  - [x] Calculate default reduced rate (50% of initial)
  - [x] Update preview to show recurring commission example

- [x] Enhance Campaign Edit page with rate type selector (AC: #1, #2, #3, #4)
  - [x] Mirror CreateCampaignModal enhancements
  - [x] Load existing rate type configuration

- [x] Update Convex mutations for recurring rate type (AC: #2, #3, #4)
  - [x] Add `recurringRateType` to createCampaign args
  - [x] Add `recurringRateType` to updateCampaign args
  - [x] Calculate recurring rate based on type:
    - "same": use commissionRate
    - "reduced": use commissionRate * 0.5 (or custom reduced value)
    - "custom": use recurringRate value

- [x] Update CommissionPreview component (AC: #1)
  - [x] Show recurring commission preview when enabled
  - [x] Display initial + recurring commission calculation

- [x] Add helper function for calculating effective recurring rate (AC: #5)
  - [x] Create utility function `getEffectiveRecurringRate(campaign)`
  - [x] Handle all three rate types

- [x] Verify commission calculation logic (AC: #5)
  - [x] Review how recurring commissions will be created (future Epic 7)
  - [x] Ensure rate type is stored for commission engine use

## Dev Notes

### Architecture Patterns and Constraints

**Database Schema Update Required:**

The campaigns table already has:
- `recurringCommissions: v.optional(v.boolean())` - toggle for recurring
- `recurringRate: v.optional(v.number())` - custom recurring percentage

**NEW field needed:**
```typescript
// In convex/schema.ts campaigns table
recurringRateType: v.optional(v.union(
  v.literal("same"),      // Same as initial commission rate
  v.literal("reduced"),   // Reduced rate (50% of initial)
  v.literal("custom")     // Custom percentage specified in recurringRate
)),
```

**Rate Calculation Logic:**
```typescript
// Helper function to calculate effective recurring rate
function getEffectiveRecurringRate(campaign: Campaign): number {
  if (!campaign.recurringCommissions) return 0;
  
  switch (campaign.recurringRateType) {
    case "same":
      return campaign.commissionRate; // Same as initial
    case "reduced":
      return campaign.commissionRate * 0.5; // 50% of initial
    case "custom":
      return campaign.recurringRate ?? campaign.commissionRate; // Custom or fallback
    default:
      return campaign.commissionRate; // Default to same
  }
}
```

**Multi-Tenant Data Isolation (ESTABLISHED PATTERN - from Story 4.1):**
- ALL queries filter by authenticated `tenantId`
- Use `getAuthenticatedUser(ctx)` to get current user
- Apply filter: `.withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))`
- NEVER return data without tenant filtering

**Convex Function Pattern (NEW SYNTAX REQUIRED):**
```typescript
// In convex/campaigns.ts - Update existing mutations
export const createCampaign = mutation({
  args: {
    // ... existing args
    recurringRateType: v.optional(v.union(
      v.literal("same"),
      v.literal("reduced"),
      v.literal("custom")
    )),
  },
  // ...
});

export const updateCampaign = mutation({
  args: {
    // ... existing args
    recurringRateType: v.optional(v.union(
      v.literal("same"),
      v.literal("reduced"),
      v.literal("custom")
    )),
  },
  // ...
});
```

### Source Tree Components to Touch

**Frontend Components:**
- `src/components/dashboard/CreateCampaignModal.tsx` - Add rate type selector, conditional rate input
- `src/components/dashboard/CommissionPreview.tsx` - Add recurring commission preview
- `src/app/(auth)/campaigns/[id]/page.tsx` - Add rate type selector to edit form

**Convex Backend:**
- `convex/schema.ts` - Add `recurringRateType` field to campaigns table
- `convex/campaigns.ts` - Update mutations with new field:
  - `createCampaign` - add recurringRateType arg and validation
  - `updateCampaign` - add recurringRateType arg and validation
  - `getCampaign` - verify return type includes new field
  - `listCampaigns` - verify return type includes new field

**UI Components (shadcn/ui - EXISTING):**
- Select, SelectContent, SelectItem, SelectTrigger - for rate type selector
- Input - for custom rate value
- Switch - for recurring toggle
- Label - for field labels

### Testing Standards Summary

**No tests currently exist in this project** - Manual testing required during development

**Manual Testing Checklist:**
1. Recurring toggle shows/hides rate type selector
2. Rate type selector has three options: Same as Initial, Reduced, Custom
3. "Same as Initial" hides custom rate input
4. "Reduced" shows rate input with 50% default
5. "Custom" shows rate input for custom percentage
6. Campaign created successfully with recurring configuration
7. Campaign edit loads existing rate type correctly
8. Campaign edit saves rate type changes
9. Commission preview shows recurring calculation
10. Multi-tenant isolation verified
11. Edge cases: switching between rate types preserves data appropriately
12. Validation: recurring rate must be1-100 for custom type

### Project Structure Notes

**Alignment with unified project structure:**

Following established patterns from Stories 4.1, 4.2, and 4.3:
- ✅ Next.js 16 App Router with route groups `(auth)` for protected routes
- ✅ Server Components by default, `"use client"` for interactive forms
- ✅ Tailwind CSS v4 utility classes
- ✅ shadcn/ui components for consistent UI (Select, Switch, Input)
- ✅ Better Auth for authentication via `authClient`
- ✅ Convex backend with new function syntax
- ✅ TypeScript strict mode enabled
- ✅ Multi-tenant data isolation via tenantId filtering
- ✅ Currency symbol: ₱ (Philippine Peso)

**Detected conflicts or variances (with rationale):**

None expected - this story extends the existing recurring commission infrastructure from Stories 4.1, 4.2, and 4.3.

**Key Implementation Notes:**
- The recurring commissions toggle and rate input already exist in the UI
- This story adds the **rate type selector** (same/reduced/custom)
- Schema migration needed: add `recurringRateType` field
- Backward compatibility: if `recurringRateType` is null, default to "same" behavior

### References

**Source Documents:**
- PRD: FR12 (Recurring commissions)
- Epic 4 Story 4.4: `_bmad-output/planning-artifacts/epics.md` lines 797-813
- Previous Story 4.1: `_bmad-output/implementation-artifacts/4-1-campaign-creation.md`
- Previous Story 4.2: `_bmad-output/implementation-artifacts/4-2-percentage-commission-configuration.md`
- Previous Story 4.3: `_bmad-output/implementation-artifacts/4-3-flat-fee-commission-configuration.md`
- Architecture: Commission calculation patterns
- UX Screens: Campaign configuration UI in `05-owner-campaigns.html` and `16-onboarding-campaign.html`

**Relevant Architecture Sections:**
- Database schema patterns: `_bmad-output/planning-artifacts/architecture.md` lines 139-148
- Convex function patterns: `_bmad-output/planning-artifacts/architecture.md` lines 259-268
- Multi-tenant data isolation: `_bmad-output/planning-artifacts/architecture.md` lines 461-474
- Tier enforcement architecture: `_bmad-output/planning-artifacts/architecture.md` lines 436-436

**Design Tokens:**
- Brand colors: `--brand-primary: #10409a`, `--brand-secondary: #1659d6`
- Status colors: success (green), warning (amber), danger (red), info (blue)
- Typography: Poppins (body), Passion One (display headings)
- Border radius: 12px (0.75rem) default
- Input components: shadcn/ui with Tailwind v4
- Currency symbol: ₱ (Philippine Peso)

### Previous Story Intelligence

**Learnings from Story 4.1 (Campaign Creation):**
1. **CRITICAL:** Multi-tenant data isolation is enforced via tenantId filtering in ALL queries
2. **CRITICAL:** Use `getTierConfig()` service for all limit enforcement - do NOT duplicate tier logic
3. **CRITICAL:** Always use NEW Convex function syntax with validators on args and returns
4. **CRITICAL:** Currency symbol must be ₱ (not $) for Philippine market consistency
5. Campaign table structure already has recurringCommissions and recurringRate fields
6. Form validation should be real-time with visual feedback
7. Loading states should be displayed for async operations
8. Commission preview component pattern exists and can be extended

**Learnings from Story 4.2 (Percentage Commission):**
1. CommissionPreview component already handles both percentage and flat fee types
2. Use shadcn/ui Select instead of native `<select>`
3. Use shadcn/ui Switch instead of native checkboxes
4. Commission rate input has suffix (₱ for flat fee, % for percentage)
5. Default value pattern: set appropriate default when switching types
6. Clear validation errors when switching commission types
7. Real-time validation with inline error display

**Learnings from Story 4.3 (Flat Fee Commission):**
1. Default value for flat fee is ₱50
2. Enhanced helper text improves UX
3. Type switching should set appropriate defaults
4. Commission calculation formula is already in place
5. Backend validation already handles flat fee validation

**Files Modified in Previous Stories:**
- `convex/schema.ts` - Campaigns table with commission fields
- `convex/campaigns.ts` - CRUD operations with recurring commission fields (lines 24-25, 86-87)
- `convex/tierConfig.ts` - Tier configuration service
- `src/components/dashboard/CreateCampaignModal.tsx` - Campaign creation form with recurring toggle
- `src/components/dashboard/CommissionPreview.tsx` - Live commission preview
- `src/components/dashboard/CampaignList.tsx` - Campaign list
- `src/app/(auth)/campaigns/page.tsx` - Campaigns list page
- `src/app/(auth)/campaigns/[id]/page.tsx` - Campaign detail/edit page

**Current State Analysis:**

The following functionality is ALREADY IMPLEMENTED:

1. **Schema Fields** (`convex/schema.ts`):
   - `recurringCommissions: v.optional(v.boolean())` - toggle for recurring
   - `recurringRate: v.optional(v.number())` - custom recurring percentage

2. **Backend Validation** (`convex/campaigns.ts` lines 60-65):
   ```typescript
   // Validate recurring rate if recurring is enabled
   if (args.recurringCommissions && args.recurringRate !== undefined) {
     if (args.recurringRate < 1 || args.recurringRate > 100) {
       throw new Error("Recurring commission rate must be between 1 and 100");
     }
   }
   ```

3. **Frontend UI** (`CreateCampaignModal.tsx` lines 370-406):
   - Switch for recurring commissions toggle
   - Input for recurring rate percentage

**What Still Needs Work:**

1. **Schema Migration**: Add `recurringRateType` field to campaigns table
2. **Rate Type Selector UI**: Add Select component for choosing same/reduced/custom
3. **Conditional Rate Input**: Show/hide rate input based on rate type
4. **Default Reduced Rate**: Calculate 50% of initial rate for "reduced" type
5. **Commission Preview Enhancement**: Show recurring commission preview
6. **Backend Updates**: Handle recurringRateType in mutations

**Git Intelligence (Recent Commits):**
- Recent work focused on campaign management (Stories 4.1, 4.2, 4.3)
- Pattern established: extend existing components rather than create new ones
- Multi-tenant isolation is consistently enforced
- Form validation patterns are well-established
- shadcn/ui components are used throughout

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

N/A - Story creation phase

### Completion Notes List

**Story Creation Phase:**
- [x] Loaded and analyzed all artifact files
- [x] Extracted story requirements from epics.md (Story 4.4)
- [x] Reviewed previous stories (4.1, 4.2, 4.3) for context and patterns
- [x] Identified key implementation requirements:
  - Add `recurringRateType` field to schema (same/reduced/custom)
  - Create rate type selector UI with conditional rate input
  - Update mutations to handle rate type
  - Enhance commission preview for recurring commissions
  - Calculate effective recurring rate based on type
- [x] Documented multi-tenant data isolation pattern from previous stories
- [x] Documented tier enforcement pattern from previous stories
- [x] Documented Convex new function syntax requirement
- [x] Identified all files to touch based on previous story structure
- [x] Extracted design tokens and brand guidelines
- [x] Created comprehensive task breakdown with acceptance criteria mapping
- [x] Documented previous story learnings to prevent reinventing patterns
- [x] Git intelligence analyzed for recent work patterns

### Implementation Completion Notes

**Implementation Phase (2026-03-14):**
- [x] Added `recurringRateType` field to campaigns table in schema with union type: "same" | "reduced" | "custom"
- [x] Updated Convex mutations (createCampaign, updateCampaign) to accept and store recurringRateType
- [x] Updated Convex queries (listCampaigns, getCampaign) to return recurringRateType in response
- [x] Enhanced CreateCampaignModal with rate type selector:
  - Added Select component for choosing rate type
  - Conditional rate input display based on type selection
  - Auto-calculate 50% default for reduced type
  - Validation for reduced/custom rate types
- [x] Enhanced Campaign Edit page with same rate type selector functionality
- [x] Enhanced CommissionPreview component:
  - Added recurring commission preview display
  - Shows effective recurring rate based on type
  - Displays rate type description (same/reduced/custom)
- [x] Added utility functions in lib/utils.ts:
  - `getEffectiveRecurringRate()` - calculates effective recurring rate
  - `getRecurringRateDescription()` - human-readable rate description
- [x] Ran Convex schema migration successfully
- [x] Verified TypeScript compilation passes (no errors)
- [x] Updated story tasks and subtasks to completed status
      - [x] Updated story status to "review"
      - [x] Updated sprint-status.yaml to "review"

**Code Review Phase (2026-03-14):**
- [x] Fixed: Backend validation for recurring rate type logic (HIGH)
- [x] Fixed: Created DEFAULT_REDUCED_RATE_PERCENTAGE constant (MEDIUM)
- [x] Fixed: Removed flat fee restriction from recurring preview (MEDIUM)
- [x] Fixed: Improved helper text clarity (MEDIUM)
- [x] Fixed: Created comprehensive unit tests (MEDIUM)
- [x] Fixed: Campaign detail display logic using utilities (LOW)
- [x] Updated story status to "done"
- [x] Updated sprint-status.yaml to "done"

### File List

**Files to Create:**
- `src/lib/utils.test.ts` - Unit tests for rate calculation utilities

**Files to Modify:**
- `convex/schema.ts` - Add `recurringRateType` field to campaigns table
- `convex/campaigns.ts` - Update mutations with new field, add validation
- `src/components/dashboard/CreateCampaignModal.tsx` - Add rate type selector UI
- `src/components/dashboard/CommissionPreview.tsx` - Add recurring commission preview
- `src/app/(auth)/campaigns/[id]/page.tsx` - Add rate type selector to edit form
- `src/lib/utils.ts` - Add utility functions and constant for reduced rate

**Total: 6 files modified, 1 file created**

---

## Senior Developer Review (AI)

**Reviewer:** bmm-dev agent on 2026-03-14
**Outcome:** APPROVED with fixes applied

### Issues Found and Fixed

#### 🔴 HIGH (1 issue) - FIXED
1. **Missing Backend Validation for Recurring Rate Type Logic**
   - Location: `convex/campaigns.ts` (createCampaign and updateCampaign)
   - Issue: No validation that "custom" or "reduced" rate types require a recurringRate value
   - Fix: Added validation logic to ensure recurringRate is provided when required
   - Lines modified: 65-82 (createCampaign), 299-312 (updateCampaign)

#### 🟡 MEDIUM (4 issues) - FIXED
2. **Hardcoded 50% Reduced Rate - Not Configurable**
   - Issue: 50% value hardcoded in 4 different locations
   - Fix: Created `DEFAULT_REDUCED_RATE_PERCENTAGE` constant in `src/lib/utils.ts`
   - Files updated: `utils.ts`, `CreateCampaignModal.tsx`, `[id]/page.tsx`, `CommissionPreview.tsx`

3. **Commission Preview Shows Recurring Only for Percentage Type**
   - Issue: Flat fee campaigns couldn't see recurring commission preview
   - Fix: Removed flat fee restriction in `CommissionPreview.tsx` line 124

4. **Reduced Rate Helper Text Shows Confusing Calculation**
   - Issue: Displayed "5% of 10%" which is confusing
   - Fix: Changed to "50% of initial rate = 5.0% (initial: 10%)"
   - Files updated: `CreateCampaignModal.tsx` line 469, `[id]/page.tsx` line 519

5. **No Unit Tests for Rate Calculation Logic**
   - Issue: No automated tests for core business logic
   - Fix: Created comprehensive test suite in `src/lib/utils.test.ts`
   - Coverage: All three rate types (same/reduced/custom) and edge cases

#### 🟢 LOW (2 issues) - FIXED
6. **Campaign Detail Page Shows Incorrect Reduced Rate Display**
   - Fix: Now uses `getRecurringRateDescription()` utility and displays stored rate when available

7. **Missing getRecurringRateDescription Usage**
   - Fix: Refactored display logic to use centralized utility function in both components

### Code Quality Improvements
- Added comprehensive backend validation for recurring commission configuration
- Centralized rate calculation logic with configurable constant
- Improved UX with clearer helper text
- Added unit test coverage for business-critical calculations
- Used utility functions consistently across components

### Files Changed During Review
- Modified: `convex/campaigns.ts` - Enhanced validation
- Modified: `src/lib/utils.ts` - Added constant and improved logic
- Modified: `src/components/dashboard/CreateCampaignModal.tsx` - Used constant
- Modified: `src/components/dashboard/CommissionPreview.tsx` - Removed restrictions
- Modified: `src/app/(auth)/campaigns/[id]/page.tsx` - Used utilities
- Created: `src/lib/utils.test.ts` - New test suite
