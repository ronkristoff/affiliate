# Story 11.6: Tier Configuration Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Platform Admin**,
I want to configure platform-wide tier definitions including pricing, affiliate limits, campaign limits, and feature gates,
so that I can adjust plans without code deployment. (FR68)

## Acceptance Criteria

### AC1: Tier Configuration List View
**Given** the Platform Admin is on the Admin > Tier Configuration page (`/admin/tiers`)
**When** the page loads
**Then** all tier definitions are displayed in a card or table layout showing:
- Tier name (Starter, Growth, Scale)
- Monthly price
- Affiliate limit (show "Unlimited" for -1)
- Campaign limit
- Team member limit
- Payout limit
- Feature gates (custom domain, advanced analytics, priority support) as checkmarks/crosses
- An "Edit" button per tier

### AC2: Edit Tier Configuration Modal
**Given** the Platform Admin clicks "Edit" on a tier
**When** the edit modal opens
**Then** it displays all configurable fields with current values:
- Price (number input, required, min 0)
- Max Affiliates (number input, -1 = unlimited)
- Max Campaigns (number input, -1 = unlimited)
- Max Team Members (number input, -1 = unlimited)
- Max Payouts Per Month (number input, -1 = unlimited)
- Max API Calls (number input, -1 = unlimited)
- Feature toggles (custom domain, advanced analytics, priority support) as switches

### AC3: Tier Configuration Validation
**Given** the Platform Admin modifies tier configuration values
**When** they attempt to save
**Then** validation rules are enforced:
- Price must be >= 0
- Limit values must be > 0 or exactly -1 (unlimited)
- At least one tier must remain at all times (cannot delete all tiers)
- Tier name cannot be changed (it is the unique identifier)
- If `maxApiCalls` is set to -1 (unlimited), warn that API rate limiting is disabled

### AC4: Impact Assessment on Limit Decreases
**Given** the Platform Admin decreases a limit value (e.g., maxAffiliates from 5000 to 2000)
**When** they submit the change
**Then** the system calculates and displays how many existing tenants on this tier would be affected (current usage > new limit)
**And** the Platform Admin must confirm with a warning modal showing affected tenant count before the change is saved

### AC5: Save Tier Configuration
**Given** the Platform Admin saves tier configuration changes
**When** the mutation executes
**Then** the `tierConfigs` table record is updated with `ctx.db.patch()`
**And** changes take effect immediately for new operations (all functions using `getTierConfig` or `by_tier` index queries will see new values)
**And** an audit log entry is created with action `"tier_config_updated"`, including before and after values and admin identity

### AC6: Tenant Notification on Limit Decrease (Notification-Ready)
**Given** a tier configuration is saved with decreased limits
**When** the save completes
**Then** affected tenants are identified (tenants on this tier whose current usage exceeds the new limit)
**And** a notification record is created for each affected tenant (stored for the email system to pick up — actual email delivery is handled by the existing email infrastructure)
**And** the notification includes: which limits decreased, old vs new values, and advice to upgrade or reduce usage

### AC7: Feature Gate Toggle
**Given** the Platform Admin toggles a feature gate (e.g., enables "customDomain" for Growth tier)
**When** they save
**Then** the feature gate is immediately available to all tenants on that tier
**And** the toggle change is included in the audit log

## Tasks / Subtasks

- [x] Task 1: Backend - Tier Config Update Mutation (AC: #3, #4, #5, #6)
  - [x] Subtask 1.1: Create `updateTierConfig` mutation in `convex/admin/tier-configs.ts`
  - [x] Subtask 1.2: Use `requireAdmin()` from `convex/admin/_helpers.ts` for auth
  - [x] Subtask 1.3: Validate inputs (price >= 0, limits > 0 or -1, tier exists)
  - [x] Subtask 1.4: Fetch existing tier config to compute diff (before vs after)
  - [x] Subtask 1.5: Calculate impact: query tenants on this tier, count those whose current usage would exceed new limits
  - [x] Subtask 1.6: Accept `forceApply: boolean` arg to allow saving despite impact (frontend must confirm first)
  - [x] Subtask 1.7: Patch tierConfigs record with `ctx.db.patch()`
  - [x] Subtask 1.8: Create audit log entry with action `"tier_config_updated"` containing before/after values and admin identity
  - [x] Subtask 1.9: If limits decreased, create notification records for affected tenants (for email pickup)

- [x] Task 2: Backend - Admin Tier Config Query (AC: #1)
  - [x] Subtask 2.1: Create `getAdminTierConfigs` query in `convex/admin/tier-configs.ts`
  - [x] Subtask 2.2: Admin-only (use `requireAdmin()`)
  - [x] Subtask 2.3: Fetch all tierConfigs, sort by tier name (starter, growth, scale)
  - [x] Subtask 2.4: Include tenant counts per tier (how many tenants are on each plan)
  - [x] Subtask 2.5: Return formatted data with `-1` values represented as `"unlimited"` string

- [x] Task 3: Backend - Impact Assessment Query (AC: #4)
  - [x] Subtask 3.1: Create `assessTierChangeImpact` query in `convex/admin/tier-configs.ts`
  - [x] Subtask 3.2: Accept tier name and proposed new limits as args
  - [x] Subtask 3.3: Compare proposed limits against current limits
  - [x] Subtask 3.4: For each decreased limit, count affected tenants (current usage > proposed limit)
  - [x] Subtask 3.5: Return structured impact report: `{ affectedTenants: number, breakdownByLimit: {...}, severity: "none" | "warning" | "critical" }`

- [x] Task 4: Backend - Notification Records for Affected Tenants (AC: #6)
  - [x] Subtask 4.1: Create `createTierChangeNotifications` internal mutation in `convex/admin/tier-configs.ts`
  - [x] Subtask 4.2: For each affected tenant, create a notification record (or email-ready entry)
  - [x] Subtask 4.3: Include: tier name, which limits changed, old vs new values
  - [x] Subtask 4.4: Store as email-ready entry that the existing email system can process

- [x] Task 5: Frontend - Tier Configuration Page (AC: #1)
  - [x] Subtask 5.1: Create `/admin/tiers/page.tsx` as Server Component wrapper
  - [x] Subtask 5.2: Create `TierConfigClient.tsx` as client component in `src/app/(admin)/tiers/_components/`
  - [x] Subtask 5.3: Display all tier configs in a responsive card grid (3 columns on desktop, stacked on mobile)
  - [x] Subtask 5.4: Each card shows: tier name (with badge color), price, all limits with icons, feature gates as toggle indicators, edit button
  - [x] Subtask 5.5: Use existing Card component from `src/components/ui/card.tsx`
  - [x] Subtask 5.6: Add tenant count per tier on each card (from `getAdminTierConfigs`)
  - [x] Subtask 5.7: Handle loading and error states

- [x] Task 6: Frontend - Edit Tier Configuration Modal (AC: #2, #3, #4)
  - [x] Subtask 6.1: Create `EditTierConfigModal.tsx` in `src/app/(admin)/tiers/_components/`
  - [x] Subtask 6.2: Use Radix Dialog with consistent styling (follow OverrideLimitsModal pattern from Story 11.5)
  - [x] Subtask 6.3: Form fields: price, all 5 limit inputs, 3 feature toggle switches
  - [x] Subtask 6.4: For limit inputs: show "-1" as "Unlimited" label, allow typing -1 or any positive number
  - [x] Subtask 6.5: Client-side validation matching backend rules
  - [x] Subtask 6.6: On submit: first call `assessTierChangeImpact` query to check for limit decreases
  - [x] Subtask 6.7: If impact exists, show confirmation modal with affected tenant count before proceeding
  - [x] Subtask 6.8: Wire to `updateTierConfig` mutation with `forceApply: true` after confirmation
  - [x] Subtask 6.9: Show success/error toast via sonner
  - [x] Subtask 6.10: Optimistic update: refresh tier list after save

- [x] Task 7: Frontend - Impact Warning Modal (AC: #4)
  - [x] Subtask 7.1: Create `ImpactWarningModal.tsx` in `src/app/(admin)/tiers/_components/`
  - [x] Subtask 7.2: Show when limit decreases detected with affected tenant count
  - [x] Subtask 7.3: Breakdown by limit type (e.g., "12 tenants exceed new affiliate limit")
  - [x] Subtask 7.4: Warning/danger styling (amber or red depending on severity)
  - [x] Subtask 7.5: "Proceed Anyway" and "Go Back" buttons

- [x] Task 8: Frontend - Admin Sidebar Update
  - [x] Subtask 8.1: Add "Tier Config" navigation item to `AdminSidebar.tsx`
  - [x] Subtask 8.2: Use Settings icon from Lucide
  - [x] Subtask 8.3: Link to `/admin/tiers`
  - [x] Subtask 8.4: Active state highlighting when on tier config page

- [x] Task 9: Write Tests (AC: #1-7)
  - [x] Subtask 9.1: Unit tests for `updateTierConfig` mutation (validation, patch, audit log)
  - [x] Subtask 9.2: Unit tests for impact assessment logic (detect decreased limits, count affected tenants)
  - [x] Subtask 9.3: Unit tests for notification creation (correct tenants identified, correct content)
  - [x] Subtask 9.4: Unit tests for validation rules (price, limits, feature gates)
  - [x] Subtask 9.5: Integration test for full edit flow (view → edit → impact check → save → audit log)

## Dev Notes

### Architecture & Patterns

**Building on Stories 11.1-11.5:**
This is the final story in Epic 11. The admin layout, sidebar, route protection, and all tenant management patterns are well-established. This story introduces a NEW admin page (`/admin/tiers`) and a NEW backend file (`convex/admin/tier-configs.ts`).

**Key Architectural Decisions:**

1. **Existing `tierConfigs` Table Reuse**: The `tierConfigs` table already exists in the schema (from Story 1.7) with `by_tier` index. We UPDATE existing records via `ctx.db.patch()` — do NOT create new records or modify the schema.

2. **Tier Name is Immutable**: The tier name (`starter`, `growth`, `scale`) is the unique identifier used across the entire system (tenant.plan field, getTierConfig lookups, ALL limit enforcement). It CANNOT be changed. Only the values within a tier are editable.

3. **Immediate Effect**: Changes to `tierConfigs` take effect immediately for all new operations. There is no caching layer — all functions query the database directly via the `by_tier` index. This satisfies NFR21 (10x tenant count scalability without architectural changes).

4. **Impact Assessment Before Save**: When limits decrease, we pre-calculate affected tenants before applying the change. This prevents silent breakage. The admin must explicitly confirm (forceApply=true).

5. **Notification-Ready, Not Email-Blocking**: Rather than sending emails synchronously during the mutation (which would slow it down), we create notification records that the existing email infrastructure (convex/email.tsx + @convex-dev/resend) can process asynchronously.

### Existing tierConfig.ts Functions — DO NOT Duplicate

The file `convex/tierConfig.ts` already contains these PUBLIC functions:
- `getTierConfig` — Get config for a tenant (reads from DB, falls back to defaults)
- `getMyTierConfig` — Get config for current authenticated user
- `checkLimit` — Check limit status for a resource type
- `canCreateResource` — Check if resource creation is allowed
- `enforceLimit` — Enforce limit with audit logging
- `getAllLimits` — Get all limit statuses for a tenant
- `getAllTierConfigs` — Get all tier configs (public, used for pricing display)
- `seedTierConfigs` — Seed default tier configs

**DO NOT modify any of these functions.** Your new admin functions go in a NEW file: `convex/admin/tier-configs.ts`.

### tierConfigs Table Schema (from convex/schema.ts, line 137)

```typescript
tierConfigs: defineTable({
  tier: v.string(),           // "starter" | "growth" | "scale" — UNIQUE identifier
  price: v.number(),          // Monthly price
  maxAffiliates: v.number(),  // -1 = unlimited
  maxCampaigns: v.number(),   // -1 = unlimited
  maxTeamMembers: v.number(), // -1 = unlimited
  maxPayoutsPerMonth: v.number(), // -1 = unlimited
  maxApiCalls: v.number(),    // -1 = unlimited
  features: v.object({
    customDomain: v.boolean(),
    advancedAnalytics: v.boolean(),
    prioritySupport: v.boolean(),
  }),
}).index("by_tier", ["tier"]),
```

### DEFAULT_TIER_CONFIGS Reference (from convex/tierConfig.ts)

```typescript
starter:  { price: 0, maxAffiliates: 100, maxCampaigns: 3, maxTeamMembers: 5, maxPayoutsPerMonth: 10, maxApiCalls: 1000 }
growth:   { price: 99, maxAffiliates: 5000, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 100, maxApiCalls: 10000 }
scale:    { price: 299, maxAffiliates: -1, maxCampaigns: -1, maxTeamMembers: -1, maxPayoutsPerMonth: -1, maxApiCalls: -1 }
```

**Note:** The PRD specifies prices in PHP (₱1,999, ₱4,499, ₱8,999) but the DEFAULT_TIER_CONFIGS uses placeholder values (0, 99, 299). The admin UI should display whatever is currently in the database.

### PRD Requirements Reference (FR68)

> "A Platform Admin can configure platform-wide tier definitions including pricing, affiliate limits, campaign limits, and feature gates without a code deployment."

Additional PRD context:
- Configuration model: all tier definitions are stored in the platform database, not hardcoded
- All enforcement logic reads from this config at runtime via `getTierConfig`
- Changes take effect immediately
- Existing tenants on the tier are notified if limits decreased

### NFR Considerations

- **NFR21**: The tier config system (`getTierConfig`) must support 10x tenant count without architectural changes — already satisfied by the existing index-based lookup pattern. No caching needed; direct DB reads scale with Convex.
- **NFR14**: Audit log records must be immutable — all tier config changes are logged as new audit log entries (append-only).
- **NFR15**: Audit log retention 2 years — no action needed, system handles this.

### Project Structure Notes

**Files to Create:**
1. `convex/admin/tier-configs.ts` — Backend mutations and queries for admin tier management
2. `convex/admin/tier-configs.test.ts` — Unit tests
3. `src/app/(admin)/tiers/page.tsx` — Page wrapper (Server Component)
4. `src/app/(admin)/tiers/_components/TierConfigClient.tsx` — Main client component
5. `src/app/(admin)/tiers/_components/EditTierConfigModal.tsx` — Edit modal with form
6. `src/app/(admin)/tiers/_components/ImpactWarningModal.tsx` — Impact confirmation modal

**Files to Modify:**
1. `src/app/(admin)/_components/AdminSidebar.tsx` — Add "Tier Config" nav item

**Files to NOT Modify:**
1. `convex/tierConfig.ts` — DO NOT TOUCH. Existing public API functions are used across the entire platform.
2. `convex/schema.ts` — No schema changes needed. `tierConfigs` table already exists.
3. `convex/admin/_helpers.ts` — Already has `requireAdmin()`, just import and use it.

### Previous Story Intelligence (Stories 11.1-11.5)

**Patterns Established and MUST Follow:**

1. ✅ **`requireAdmin()` from shared helpers** — Import from `convex/admin/_helpers.ts` (NOT duplicate inline)
2. ✅ **Admin layout and sidebar** — Already exists at `src/app/(admin)/layout.tsx` with `AdminSidebar`
3. ✅ **Audit logging pattern** — Insert into `auditLogs` with `{ tenantId, action, entityType, entityId, actorId, actorType, metadata }`
4. ✅ **Radix Dialog modals** — Follow OverrideLimitsModal pattern (from Story 11.5) with consistent styling
5. ✅ **Loading states** — Use `Loader2` spinner from Lucide during mutations
6. ✅ **Error handling** — `try/catch/finally` with toast notifications via sonner
7. ✅ **`cn()` utility** — Import from `@/lib/utils`, never reimplement inline
8. ✅ **Server/Client component split** — Page is Server Component, interactive content in `"use client"` components

**Code Patterns from Story 11.5 (Tier Override):**
- Modal with warning styling when destructive actions
- Audit logging with admin identity
- Expiration handling and impact assessment patterns
- `MAX_OVERRIDE_VALUE = 100000` upper bound pattern — apply similar MAX_VALUE to tier config fields

### Security Considerations

1. **Admin Role Verification**: ALL functions in `convex/admin/tier-configs.ts` must use `requireAdmin()` from `_helpers.ts`
2. **Audit Trail**: Every tier config change is logged with before/after values
3. **No Tier Deletion**: Prevent accidental deletion of all tiers (minimum 1 tier must exist)
4. **No Tier Name Changes**: Tier name is the unique key used everywhere — immutable
5. **Rate Limiting**: Consider adding cooldown to prevent rapid successive changes (optional)
6. **Input Validation**: Backend must validate all inputs regardless of frontend validation

### Frontend Design Guidelines

**Tier Card Layout:**
- Use Card component from `src/components/ui/card.tsx`
- 3-column grid on desktop (`grid grid-cols-1 md:grid-cols-3 gap-6`)
- Tier name as card header with color badge (starter=gray, growth=blue, scale=purple)
- Price prominently displayed with currency symbol
- Limits displayed as rows with icons (Users, Target, Users, DollarSign)
- Feature gates as small toggle/badge indicators
- "Edit" button at bottom of each card

**Edit Modal:**
- Follow Radix Dialog pattern from OverrideLimitsModal
- Form sections: Pricing, Limits, Feature Gates
- Limit inputs with "-1 = Unlimited" helper text
- Save and Cancel buttons
- Loading state on Save button during mutation

**Color System (from project-context.md):**
- Brand primary: `#10409a`, Secondary: `#1659d6`
- Status colors: success (green), warning (amber), danger (red), info (blue)
- Impact warning modal: amber/danger styling

### Testing Requirements

**Backend Tests (convex/admin/tier-configs.test.ts):**
- `updateTierConfig` requires admin role
- `updateTierConfig` validates price >= 0
- `updateTierConfig` validates limits > 0 or -1
- `updateTierConfig` rejects unknown tier names
- `updateTierConfig` creates audit log with before/after values
- `updateTierConfig` without forceApply rejects when impact exists
- `updateTierConfig` with forceApply applies despite impact
- `getAdminTierConfigs` returns sorted configs with tenant counts
- `assessTierChangeImpact` correctly identifies decreased limits
- `assessTierChangeImpact` correctly counts affected tenants
- Notification creation for affected tenants

**Frontend Tests:**
- Modal opens and closes correctly
- Form validation shows errors for invalid inputs
- Impact warning modal shows when limits decreased
- Success toast on save

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.6] Tier Configuration Management requirements
- [Source: _bmad-output/planning-artifacts/prd.md#FR68] Platform admin tier configuration requirement
- [Source: _bmad-output/planning-artifacts/prd.md#Subscription Tiers] Tier configuration model and default structure
- [Source: _bmad-output/planning-artifacts/architecture.md#Tier Enforcement] getTierConfig service layer pattern
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] Design system colors and typography
- [Source: _bmad-output/implementation-artifacts/11-5-tier-limit-override.md] Previous story with modal patterns, audit logging, impact assessment
- [Source: _bmad-output/implementation-artifacts/11-4-plan-limit-usage-view.md] Plan usage display patterns
- [Source: _bmad-output/implementation-artifacts/11-1-tenant-search.md] Admin role verification pattern
- [Source: convex/schema.ts#tierConfigs] tierConfigs table definition with by_tier index
- [Source: convex/tierConfig.ts] Existing tier config service — DO NOT MODIFY
- [Source: convex/admin/_helpers.ts] Shared requireAdmin() helper
- [Source: convex/admin/tier-overrides.ts] Pattern reference for admin mutations with audit logging
- [Source: src/app/(admin)/layout.tsx] Admin layout with sidebar
- [Source: src/app/(admin)/_components/AdminSidebar.tsx] Admin sidebar navigation

## Senior Developer Review (AI)

**Review Date:** 2026-03-18  
**Reviewer:** Code Review Agent  
**Outcome:** Changes Requested → Fixed

### Issues Found & Fixed

| Severity | Issue | Location | Fix Applied |
|----------|-------|----------|-------------|
| 🔴 CRITICAL | Notification email used non-existent `tenant.ownerEmail` field | `convex/admin/tier-configs.ts:615` | Changed to use correctly fetched `ownerEmail` variable |
| 🟡 MEDIUM | Unused `impactQuery` variable declared but never used | `EditTierConfigModal.tsx:79` | Removed dead code |
| 🟡 MEDIUM | Impact breakdown not fetched from backend | `EditTierConfigModal.tsx` | Added `impactQueryArgs` state + `useEffect` to fetch and display breakdown |
| 🟡 MEDIUM | ImpactWarningModal recalculated limits instead of using backend data | `ImpactWarningModal.tsx` | Added `breakdownByLimit` prop and display affected count per limit |

### Post-Fix Verification

- ✅ All 42 unit tests pass
- ✅ Backend notification bug fixed (AC6 now functional)
- ✅ Impact assessment properly integrated (AC4 enhanced)
- ✅ No regressions introduced

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

No debug issues encountered during implementation.

### Completion Notes List

- ✅ Created `convex/admin/tier-configs.ts` with 3 backend functions: `updateTierConfig` (mutation), `getAdminTierConfigs` (query), `assessTierChangeImpact` (query)
- ✅ Implemented pure business logic functions exported for testing: `validateTierConfigValues`, `validateTierName`, `calculateDecreasedLimits`, `formatLimitValue`, `determineImpactSeverity`
- ✅ Impact assessment detects decreased limits (including unlimited → limited transitions) and counts affected tenants
- ✅ Notification records created in `emails` table (existing infrastructure) for affected tenants when limits decrease
- ✅ Audit logging with before/after values and admin identity for all tier config changes
- ✅ Frontend: 3-column responsive card grid with tier color badges (starter=gray, growth=blue, scale=purple)
- ✅ Frontend: Edit modal with Radix Dialog, form validation, impact assessment flow, and confirmation modal
- ✅ Frontend: Impact Warning Modal with severity-based styling (amber=warning, red=critical) and breakdown by limit type
- ✅ Admin sidebar updated with "Tier Config" nav item using Layers icon
- ✅ 42 unit tests covering validation, impact assessment, notification logic, feature gates, and integration flow
- ✅ All 247 admin tests pass (6 test files), no regressions introduced

### File List

**New files:**
- `convex/admin/tier-configs.ts` — Backend mutations and queries for admin tier configuration management
- `convex/admin/tier-configs.test.ts` — Unit tests for tier config validation, impact assessment, and notification logic
- `src/app/(admin)/tiers/page.tsx` — Page wrapper for tier configuration (Server Component)
- `src/app/(admin)/tiers/_components/TierConfigClient.tsx` — Main client component with tier card grid
- `src/app/(admin)/tiers/_components/EditTierConfigModal.tsx` — Edit modal with form, validation, and impact check
- `src/app/(admin)/tiers/_components/ImpactWarningModal.tsx` — Impact confirmation modal with breakdown

**Modified files:**
- `src/app/(admin)/_components/AdminSidebar.tsx` — Added "Tier Config" navigation item

**Files NOT modified (as specified in Dev Notes):**
- `convex/tierConfig.ts` — Existing tier config service untouched
- `convex/schema.ts` — No schema changes needed
- `convex/admin/_helpers.ts` — No changes needed

### Change Log

- 2026-03-18: Implemented full Story 11.6 Tier Configuration Management
  - Created backend with update mutation, admin query, and impact assessment query
  - Created notification system using existing emails table
  - Built frontend tier configuration page with card grid layout
  - Built edit modal with validation and impact confirmation flow
  - Added sidebar navigation item
  - Wrote 42 unit tests covering all acceptance criteria

- 2026-03-18: Code Review Fixes (Auto-fixed)
  - FIXED: Notification email bug in `createTierChangeNotifications` - using fetched `ownerEmail` instead of non-existent `tenant.ownerEmail` (CRITICAL)
  - FIXED: Removed unused `impactQuery` variable in EditTierConfigModal.tsx (MEDIUM)
  - FIXED: Added proper impact assessment query integration - now fetches breakdown from backend before showing warning modal (MEDIUM)
  - FIXED: ImpactWarningModal now displays affected tenant count per limit from backend breakdown data (MEDIUM)
  - Added `breakdownByLimit` prop to ImpactWarningModal for accurate impact display
