---
title: "Admin Subscription Management & Revenue Dashboard"
slug: "admin-subscription-management"
created: "2026-03-26"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16 (App Router)", "Convex 1.32.0", "TypeScript 5.9.3", "Tailwind CSS 4.1.16", "Radix UI", "React 19.2.3", "Vitest"]
files_to_modify: ["convex/admin/subscriptions.ts (NEW)", "convex/admin/subscriptions.test.ts (NEW)", "convex/admin/tenants.ts (MODIFY)", "convex/tenants.ts (MODIFY - deletion guard)", "src/app/(admin)/tenants/_components/SubscriptionStatusBadge.tsx (NEW)", "src/app/(admin)/tenants/_components/TenantTable.tsx (MODIFY)", "src/app/(admin)/tenants/page.tsx (MODIFY)", "src/app/(admin)/tenants/[tenantId]/_components/types.ts (NEW - shared TenantDetail)", "src/app/(admin)/tenants/[tenantId]/_components/TenantDetailContent.tsx (MODIFY)", "src/app/(admin)/tenants/[tenantId]/_components/OverviewTab.tsx (MODIFY)", "src/app/(admin)/tenants/[tenantId]/_components/SubscriptionSummaryCard.tsx (NEW)", "src/app/(admin)/tenants/[tenantId]/_components/TenantTabs.tsx (MODIFY)", "src/app/(admin)/tenants/[tenantId]/_components/BillingTab.tsx (NEW)", "src/app/(admin)/tenants/[tenantId]/_components/AdminBillingHistoryTable.tsx (NEW)", "src/app/(admin)/tenants/[tenantId]/_components/AdminSubscriptionActions.tsx (NEW)", "src/app/(admin)/revenue/page.tsx (NEW)", "src/app/(admin)/revenue/_components/RevenueDashboard.tsx (NEW)", "src/app/(admin)/revenue/_components/RevenueDashboardSkeleton.tsx (NEW)", "src/app/(admin)/_components/AdminSidebar.tsx (MODIFY)"]
code_patterns: ["requireAdmin auth from convex/admin/_helpers.ts", "readTenantStats for O(1) aggregate counts", ".take(N) caps on all queries - no unbounded .collect()", "auditLogs with actorType:'admin' on all mutations", "FilterTabs + conditional render for tab pattern", "PlanBadge config-map lookup pattern for badges", "ColumnFilter[] + URL state sync for table filters", "Suspense wrapper: inner content + outer default export", "Status colors: trial=blue, active=green, cancelled=red, past_due=yellow", "DataTable generic component for tables", "Cursor-stack pagination pattern"]
test_patterns: ["Vitest with .test.ts suffix", "Tests co-located with source files", "Placeholder tests exist in project"]
---

# Tech-Spec: Admin Subscription Management & Revenue Dashboard

**Created:** 2026-03-26

## Overview

### Problem Statement

Platform admins currently have no visibility into tenant subscription lifecycles. They can see which plan a tenant is on (starter/growth/scale) but cannot see subscription status (trial/active/past_due/cancelled), billing dates, trial expiration, scheduled cancellations/deletions, or billing history. Additionally, there's no aggregate revenue intelligence — no MRR tracking, churn metrics, or trial conversion rates. Admins also cannot take corrective actions on subscriptions when needed.

### Solution

Add a comprehensive subscription management layer to the admin panel — a summary on the tenant Overview tab, a dedicated Billing tab per tenant with full lifecycle visibility + admin actions, a subscription status column on the tenants list, and a revenue metrics dashboard with MRR, churn, and trial conversion KPIs.

### Scope

**In Scope:**
- Subscription status badge on tenants list table (`/admin/tenants`)
- Subscription summary cards on tenant Overview tab (status, billing dates, trial info)
- Dedicated "Billing" tab on tenant detail page with full billing history + lifecycle timeline
- Admin subscription actions: change plan, extend trial, cancel/reactivate subscription on behalf of tenant
- Revenue metrics dashboard (total MRR, active/past_due/cancelled breakdown, trial conversion rate, churned MRR)
- All backend queries/mutations needed to support the above

**Out of Scope:**
- SaaS owner billing page changes (already built at `/settings/billing`)
- Payment gateway integration (mock payment only, matching existing pattern)
- Dunning/automated email sequences for past-due subscriptions
- Refund processing
- Invoice generation/PDF

## Context for Development

### Codebase Patterns

**Admin Auth Pattern:**
- Import `requireAdmin` from `convex/admin/_helpers.ts`
- Call `await requireAdmin(ctx)` at handler top — throws on failure
- Admin queries take explicit `tenantId` arg (bypass tenant isolation)
- All admin mutations write to `auditLogs` with `actorType: "admin"` and `actorId: admin._id` (the Convex `Id<"users">` — NOT `admin.authId` which is a Better Auth string)

**Data Access Pattern:**
- Aggregate counts from `readTenantStats(ctx, tenantId)` — O(1) denormalized counters
- All table queries use `.take(N)` with explicit caps; `.paginate()` for user-facing lists
- Never use unbounded `.collect()` on high-volume tables
- `tenantStats` table stores: affiliate counts, commission counts/values, payout totals, click/conversion counts

**Subscription Data Model (on `tenants` table):**
| Field | Type | Purpose |
|-------|------|---------|
| `plan` | `string` | "starter", "growth", "scale" |
| `subscriptionStatus` | `string?` | "trial", "active", "cancelled", "past_due" |
| `subscriptionId` | `string?` | External transaction reference |
| `billingStartDate` | `number?` | Billing cycle start (ms timestamp) |
| `billingEndDate` | `number?` | Billing cycle end (ms timestamp) |
| `trialEndsAt` | `number?` | Trial expiration (ms timestamp) |
| `cancellationDate` | `number?` | When cancellation requested |
| `deletionScheduledDate` | `number?` | Scheduled data deletion |

**Billing History Table:**
| Field | Type |
|-------|------|
| `tenantId` | `Id<"tenants">` |
| `event` | `string` — "upgrade", "downgrade", "cancel", "renew", "trial_conversion" |
| `plan` | `string?` |
| `amount` | `number?` |
| `timestamp` | `number` |
| `transactionId` | `string?` |
| `actorId` | `Id<"users">?` |
| `newPlan` / `previousPlan` | `string?` |
| `proratedAmount` | `number?` |
| `mockTransaction` | `boolean?` |
| Indexes: `by_tenant`, `by_tenant_and_time` (compound: tenantId + timestamp) |

**Tier Pricing (DEFAULT_TIER_CONFIGS):**
| Tier | Price (PHP/mo) |
|------|---------------|
| Starter | 0 |
| Growth | 2,499 |
| Scale | 4,999 |

**Frontend Patterns:**
- Tab pattern: `TenantTabs.tsx` defines `Tab` type union + `buildTabs()` returning `FilterTabItem[]`. Tab content conditionally rendered in `TenantDetailContent.tsx`
- Badge pattern: `PlanBadge.tsx` uses config-map `Record<string, {label, bg, text, border?}>` with fallback lookup, `<span>` + `cn()`
- Column filter pattern: `FilterOption[]` module-level const, `ColumnFilter[]` unified array, URL state sync via `useSearchParams` + `router.replace`
- DataTable: Generic `<T>` component from `@/components/ui/DataTable` with `DateCell`, `CurrencyCell` cell renderers
- Suspense: Inner content component with hooks + outer default-export wrapper with `<Suspense>` + skeleton fallback
- `TenantDetail` type is duplicated inline in `TenantDetailContent.tsx` and `OverviewTab.tsx` — must update both when adding fields

**Existing Subscription Functions (owner-facing, `convex/subscriptions.ts`):**
- `getCurrentSubscription` — returns subscription status for authenticated user's tenant
- `getBillingHistory` — paginated billing history for authenticated tenant
- `upgradeSubscription` / `convertTrialToPaid` / `upgradeTier` / `downgradeTier` / `cancelSubscription`
- All mutations: authenticate via `getAuthenticatedUser(ctx)`, write to `billingHistory` + `auditLogs`, read `tierConfigs` for pricing
- Transaction ID patterns: `mock_sub_`, `mock_trial_`, `mock_upgrade_`, `downgrade_`

**Key Finding: No admin subscription queries exist.** The `convex/admin/` folder has zero subscription/billing queries. All subscription operations are owner-scoped.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/admin/_helpers.ts` | `requireAdmin`, `readTenantStats` — admin auth + O(1) stats |
| `convex/admin/tenants.ts` | `getTenantDetails`, `searchTenants`, `getPlatformStats` — existing admin queries |
| `convex/subscriptions.ts` | Owner subscription mutations — pattern reference for admin actions |
| `convex/schema.ts` | `tenants` table (subscription fields), `billingHistory` table, `tenantStats` table |
| `convex/tierConfig.ts` | `DEFAULT_TIER_CONFIGS`, `getTierConfig`, `getAllTierConfigs` — plan pricing |
| `src/app/(admin)/tenants/_components/TenantTable.tsx` | Column definition pattern, filter pattern |
| `src/app/(admin)/tenants/_components/PlanBadge.tsx` | Badge config-map pattern to replicate |
| `src/app/(admin)/tenants/page.tsx` | URL state sync, Suspense wrapper, data fetching |
| `src/app/(admin)/tenants/[tenantId]/_components/TenantTabs.tsx` | Tab type union, buildTabs() pattern |
| `src/app/(admin)/tenants/[tenantId]/_components/TenantDetailContent.tsx` | Tab orchestration, TenantDetail type, tab content rendering |
| `src/app/(admin)/tenants/[tenantId]/_components/OverviewTab.tsx` | Overview layout (3-col grid), insertion points |
| `src/app/(admin)/tenants/[tenantId]/_components/PlanUsageCard.tsx` | Usage vs limits card pattern |
| `src/components/settings/BillingHistoryTable.tsx` | Billing history table pattern (owner-scoped, needs admin variant) |
| `src/components/settings/SubscriptionStatusCard.tsx` | Status badge config (trial=blue, active=green, cancelled=red, past_due=yellow) |
| `src/app/(admin)/_components/AdminSidebar.tsx` | Admin navigation — needs revenue menu item |
| `src/components/ui/DataTable.tsx` | Generic DataTable component, DateCell, CurrencyCell |

### Technical Decisions

1. **No new database table needed** — subscription data already lives on `tenants` table with all required fields. No schema migration required.
2. **New admin Convex module** — `convex/admin/subscriptions.ts` for all admin subscription queries/mutations. Follows existing `requireAdmin` pattern.
3. **Revenue metrics computed at query time** — Aggregated from `tenants` table + `tierConfigs` pricing. No separate revenue table. Source of truth = tenant subscription status + plan pricing.
4. **BillingTab reuses DataTable** — Admin billing history uses the same `DataTable` generic component but is a new prop-driven component (accepts `tenantId`), not reusing the owner's self-fetching `BillingHistoryTable`.
5. **SubscriptionStatusBadge follows PlanBadge pattern** — Config-map lookup with `Record<string, {label, bg, text}>`, fallback for unknown values.
6. **Admin subscription actions mirror owner mutations** — Same patterns (write to `billingHistory` + `auditLogs`, read `tierConfigs`), but authenticated via `requireAdmin` and accept explicit `tenantId`.
7. **Extract TenantDetail type to shared file** — Create `src/app/(admin)/tenants/[tenantId]/_components/types.ts` and remove inline definitions from `TenantDetailContent.tsx` and `OverviewTab.tsx`. Both files import from the shared location.
8. **Revenue dashboard as new route** — `/admin/revenue` with its own page + dashboard component. Added to `AdminSidebar.tsx` navigation.

## Implementation Plan

### Tasks

#### Phase 1: Backend — Admin Subscription Module

- [x] **Task 1: Create admin subscription queries**
  - File: `convex/admin/subscriptions.ts` (NEW)
  - Action: Create new Convex module with admin subscription queries:
    - `getTenantSubscription` — query accepting `{ tenantId: v.id("tenants") }`, returns full subscription details (plan, subscriptionStatus, billingStartDate, billingEndDate, trialEndsAt, cancellationDate, deletionScheduledDate, subscriptionId) + computed fields (isTrial, trialDaysRemaining, billingCycleDaysRemaining, daysSinceCancellation). Uses `requireAdmin` + `ctx.db.get(args.tenantId)`. Include explicit return validator with ALL fields.
    - `getTenantBillingHistory` — query accepting `{ tenantId: v.id("tenants"), paginationOpts }`, returns paginated billing history using `by_tenant_and_time` index ordered desc. Returns same shape as owner's `getBillingHistory` (page, continueCursor, isDone). Uses `requireAdmin`.
    - `getPlatformRevenueMetrics` — query accepting `{}`, returns aggregate revenue metrics computed from `tenants` table `.take(500)`: totalMRR, activeMRR, pastDueMRR, trialCount, activeCount, pastDueCount, cancelledCount, churnedMRR, trialConversionRate. Uses `requireAdmin`. **Performance: Load all tierConfigs once at start** via `ctx.db.query("tierConfigs").collect()` (only 3 rows — safe), build a `Map<tierName, price>` for O(1) lookups. Then iterate tenants using the map instead of per-tenant DB reads. This prevents 500 individual index lookups inside a single query (which would hit Convex's 10-second timeout). Falls back to `DEFAULT_TIER_CONFIGS` (import from `tierConfig.ts`) for any tier not found in the DB. Sums by subscriptionStatus. Trial conversion rate: `tenants with plan !== "starter" AND subscriptionStatus === "active"` divided by `tenants with billingHistory event "trial_conversion"` (query billingHistory table for unique tenantIds with event "trial_conversion").
    - `getRecentSubscriptionActivity` — query accepting `{}`, returns the 10 most recent `billingHistory` events across ALL tenants. Uses `requireAdmin`. **Implementation**: Query `billingHistory` table using default index (ordered by `_creationTime` desc), `.take(10)`. For each event, look up the tenant name from `ctx.db.get(event.tenantId)` and the actor name from `ctx.db.get(event.actorId)` if present. Return array of `{ _id, timestamp, event, tenantId, tenantName, plan, newPlan, previousPlan, amount, actorId, actorName }`. This powers the "Recent Activity" feed on the revenue dashboard.
  - Notes: Import `requireAdmin` from `./_helpers`. Import `DEFAULT_TIER_CONFIGS` from `../tierConfig`. All queries use `requireAdmin` at handler top. No dynamic imports.

- [x] **Task 2: Create admin subscription mutations**
  - File: `convex/admin/subscriptions.ts` (same file, append)
  - Action: Add admin subscription action mutations:
    - `adminChangePlan` — mutation accepting `{ tenantId: v.id("tenants"), targetPlan: v.union(v.literal("starter"), v.literal("growth"), v.literal("scale")), reason: v.string() }`. Validates tenant exists and `targetPlan !== tenant.plan`. **Transitions `subscriptionStatus`**: if tenant is on trial and changing to growth/scale, set `subscriptionStatus: "active"` and clear `trialEndsAt`; if tenant is cancelled, keep cancelled status (admin must explicitly reactivate). Patches `tenants` with new `plan`, updated `subscriptionStatus`, `subscriptionId: "admin_plan_change_${Date.now()}"` (mock transaction ID so the tenant has a payment record — prevents owner's `convertTrialToPaid` from being callable on an already-active tenant), and `billingStartDate`/`billingEndDate` to current time + 30 days. Inserts `billingHistory` record (event: "admin_plan_change", previousPlan, newPlan, amount from tierConfig, transactionId matching subscriptionId). Inserts `auditLogs` record (action: "ADMIN_PLAN_CHANGE", actorType: "admin", actorId: `admin._id`, details including reason). Returns `{ success: true, previousPlan, newPlan }`. Uses `requireAdmin`.
    - `adminExtendTrial` — mutation accepting `{ tenantId: v.id("tenants"), additionalDays: v.number(), reason: v.string() }`. Validates `additionalDays` is 1-90. Validates tenant exists and `subscriptionStatus === "trial"`. Computes new trial end: `(tenant.trialEndsAt ?? Date.now()) + additionalDays * 86400000` — MUST fallback to `Date.now()` when `trialEndsAt` is null to avoid `null + N = 0` (epoch corruption). Patches `tenants` with new `trialEndsAt`. Inserts `billingHistory` record (event: "admin_trial_extension", amount: 0). Inserts `auditLogs` record (action: "ADMIN_TRIAL_EXTENSION", details including additionalDays and reason). Returns `{ success: true, newTrialEndsAt }`. Uses `requireAdmin`.
    - `adminCancelSubscription` — mutation accepting `{ tenantId: v.id("tenants"), reason: v.string() }`. Validates tenant exists and `subscriptionStatus === "active"` or `subscriptionStatus === "trial"`. Patches `tenants` with `subscriptionStatus: "cancelled"`, `cancellationDate: Date.now()`, `deletionScheduledDate: (tenant.billingEndDate ?? Date.now()) + 30 * 86400000` — **matches owner's cancel pattern**: deletion is scheduled relative to billing cycle end, not from now, so the tenant retains access until their paid period ends. Inserts `billingHistory` record (event: "admin_cancel"). Inserts `auditLogs` record (action: "ADMIN_SUBSCRIPTION_CANCEL", details including reason). Returns `{ success: true, deletionScheduledDate }`. Uses `requireAdmin`.
    - `adminReactivateSubscription` — mutation accepting `{ tenantId: v.id("tenants"), reason: v.string() }`. Validates tenant exists and `subscriptionStatus === "cancelled"`. **CRITICAL: Cancel any pending scheduled deletion.** The owner's `cancelSubscription` schedules a background job via `ctx.scheduler.runAfter` calling `internal.tenants.deleteTenantData`. Convex does not expose a `ctx.scheduler.cancel()` API, so instead: patch `deletionScheduledDate` to `undefined` and add a guard check at the top of the `deleteTenantData` internal mutation in `convex/tenants.ts` — if `tenant.deletionScheduledDate` is `undefined`, abort deletion silently (this must be done as part of this task). Then patches `tenants` with `subscriptionStatus: "active"`, clears `cancellationDate` and `deletionScheduledDate`. If plan is "starter", also set `billingStartDate` and `billingEndDate`. Inserts `billingHistory` record (event: "admin_reactivate"). Inserts `auditLogs` record (action: "ADMIN_SUBSCRIPTION_REACTIVATE", details including reason). Returns `{ success: true }`. Uses `requireAdmin`.
  - Notes: Follow exact same `billingHistory` + `auditLogs` write pattern as `convex/subscriptions.ts`. All mutations use `requireAdmin`. All return validators must match actual returns exactly.

- [x] **Task 3: Update existing admin queries to include subscription fields**
  - File: `convex/admin/tenants.ts` (MODIFY)
  - Action:
    - Update the `TenantRow` interface (defined inline around line 135-147): Add `subscriptionStatus?: string | null` to the interface. This is required because `searchTenants` enriches tenant data through this typed interface — TypeScript will reject new fields not in the type.
    - In `getTenantDetails` (line ~687): Add subscription fields to the return object and return validator: `subscriptionStatus`, `billingStartDate`, `billingEndDate`, `trialEndsAt`, `cancellationDate`, `deletionScheduledDate`. These fields are already on the tenant doc — just include them in the spread/return.
    - In `searchTenants` (line ~157): Add `subscriptionStatus` to the returned tenant shape and return validator. This enables the tenants list to display and filter by subscription status.
  - Notes: Read the existing return validators carefully. Add new fields to the `v.object({...})` return validators. Do NOT break existing fields. **Also:** `tenants.ts` defines its own local `requireAdmin` (lines 19-41) that returns `null` on failure — inconsistent with the canonical throwing version in `_helpers.ts`. Remove the local `requireAdmin` function and replace all usages with `import { requireAdmin } from "./_helpers"`. This eliminates the inconsistency and means all admin functions in this file will throw on auth failure (matching the new `subscriptions.ts` module).

#### Phase 2: Frontend — Tenants List Enhancement

- [x] **Task 4: Create SubscriptionStatusBadge component**
  - File: `src/app/(admin)/tenants/_components/SubscriptionStatusBadge.tsx` (NEW)
  - Action: Create badge component following `PlanBadge.tsx` pattern:
    - Props: `{ status: string | null | undefined; className?: string }`
    - Config map: `Record<string, { label: string; bg: string; text: string }>` with entries for: `trial` (blue-100/blue-800), `active` (green-100/green-800), `cancelled` (red-100/red-800), `past_due` (yellow-100/yellow-800). Fallback for null/undefined: neutral gray "None" badge. Fallback for unknown: raw value as label.
    - Render: `<span>` with `cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold", config.bg, config.text, className)>{config.label}</span>`
    - Export as named export `SubscriptionStatusBadge`.
  - Notes: Match exact Tailwind classes from `SubscriptionStatusCard.tsx` status badge colors. Use CSS custom properties where existing `PlanBadge` uses them (e.g., `var(--bg-page)`, `var(--text-muted)`).

- [x] **Task 5: Add subscription status column to tenants list**
  - File: `src/app/(admin)/tenants/_components/TenantTable.tsx` (MODIFY)
  - Action:
    - Add `subscriptionStatus` to the `Tenant` interface (if not already present from Task 3 backend changes).
    - Add `"subscriptionStatus"` to `TenantSortField` union type.
    - Add module-level `const subscriptionStatusFilterOptions: FilterOption[]` with values: `{ value: "trial", label: "Trial" }`, `{ value: "active", label: "Active" }`, `{ value: "past_due", label: "Past Due" }`, `{ value: "cancelled", label: "Cancelled" }`.
    - Add new column object to the `columns` array (insert between `plan` and `status` columns): `{ key: "subscriptionStatus", header: "Subscription", sortable: true, sortField: "subscriptionStatus", filterable: true, filterType: "select", filterOptions: subscriptionStatusFilterOptions, filterLabel: "Subscription", cell: (row) => <SubscriptionStatusBadge status={row.subscriptionStatus} /> }`.
    - Import `SubscriptionStatusBadge` from `./SubscriptionStatusBadge`.
  - File: `src/app/(admin)/tenants/page.tsx` (MODIFY)
  - Action:
    - Add `subscriptionStatusFilter` state variable initialized from `searchParams.get("subscriptionStatus") || ""`.
    - Add to URL sync `useEffect`: set `subscriptionStatus` param if non-empty.
    - Add to `activeFilters` useMemo: push `{ columnKey: "subscriptionStatus", type: "select", values: subscriptionStatusFilter.split(",") }` if non-empty.
    - Add to `handleColumnFilterChange`: handle `"subscriptionStatus"` case → `setSubscriptionStatusFilter(value)`.
    - Add to client-side filter logic: filter `data` by `subscriptionStatus` if filter is set.
    - Add to sort comparator: handle `"subscriptionStatus"` case with `localeCompare`.
    - Add to `columns` array for FilterChips: `{ key: "subscriptionStatus", header: "Subscription", filterLabel: "Subscription", cell: () => null }`.
  - Notes: Follow exact same pattern as existing `planFilter` — it's the most similar column (select filter, string sort).

#### Phase 3: Frontend — Tenant Detail Enhancement

- [x] **Task 6: Extract shared TenantDetail type and add SubscriptionSummaryCard to Overview**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/types.ts` (NEW)
  - Action: Extract the duplicated `TenantDetail` interface into a shared types file. Define it once with all fields including new subscription fields: `subscriptionStatus?: string | null`, `subscriptionId?: string | null`, `billingStartDate?: number | null`, `billingEndDate?: number | null`, `trialEndsAt?: number | null`, `cancellationDate?: number | null`, `deletionScheduledDate?: number | null`. Export as `TenantDetail`. This replaces the inline definitions in both `TenantDetailContent.tsx` and `OverviewTab.tsx`.
  - File: `src/app/(admin)/tenants/[tenantId]/_components/TenantDetailContent.tsx` (MODIFY)
  - Action: Remove the inline `TenantDetail` interface. Import `TenantDetail` from `./types`. Update the component's `TenantDetailContentProps` to use the imported type.
  - File: `src/app/(admin)/tenants/[tenantId]/_components/OverviewTab.tsx` (MODIFY)
  - Action: Remove the inline `TenantDetail` interface. Import `TenantDetail` from `./types`. Update the component's `OverviewTabProps` to use the imported type.
    - Insert `<SubscriptionSummaryCard tenant={tenant} />` above the existing grid, inside a `<div className="space-y-6">` wrapper (or inside existing spacing). Import `SubscriptionSummaryCard` from `./SubscriptionSummaryCard`.
  - File: `src/app/(admin)/tenants/[tenantId]/_components/SubscriptionSummaryCard.tsx` (NEW)
  - Action: Create subscription summary card component:
    - Props: `{ tenant: { plan: string; subscriptionStatus?: string | null; subscriptionId?: string | null; billingStartDate?: number | null; billingEndDate?: number | null; trialEndsAt?: number | null; cancellationDate?: number | null; deletionScheduledDate?: number | null } }`
    - Layout: A single `<Card>` (from `@/components/ui/card`) with `<CardContent>` containing a grid of key-value pairs.
    - Display fields:
      - **Status**: `<SubscriptionStatusBadge>` component
      - **Billing Period**: `billingStartDate` → `billingEndDate` formatted as dates, or "N/A"
      - **Trial Ends**: `trialEndsAt` formatted as date + days remaining, or "N/A" if not on trial
      - **Cancellation Date**: `cancellationDate` formatted, or "N/A"
      - **Deletion Scheduled**: `deletionScheduledDate` formatted, or "N/A"
      - **Subscription ID**: `subscriptionId` or "N/A"
    - Use `DateCell`-style date formatting (or a simple `new Date(ts).toLocaleDateString()`).
    - Conditional: If all subscription fields are null/undefined, show a minimal "No subscription data" state.
    - Wrap in `"use client"` directive (it receives props, no hooks needed — but parent is client so this is fine either way).
  - Notes: Keep the card compact — it sits above the overview grid. Use muted text for labels, normal text for values. Follow `PlanUsageCard.tsx` styling conventions.

- [x] **Task 7: Add Billing tab infrastructure**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/TenantTabs.tsx` (MODIFY)
  - Action:
    - Add `"billing"` to the `Tab` type union.
    - Add `{ key: "billing", label: "Billing", icon: <Receipt className="h-3.5 w-3.5" /> }` to the `buildTabs()` array (insert after "payouts"). Import `Receipt` from `lucide-react`.
  - File: `src/app/(admin)/tenants/[tenantId]/_components/TenantDetailContent.tsx` (MODIFY)
  - Action:
    - Add `"billing"` to the `TABS` const array (insert after "payouts").
    - Add conditional render block: `{activeTab === "billing" && <BillingTab tenantId={tenant._id} tenant={tenant} />}`. Import `BillingTab` from `./BillingTab`.
  - Notes: Follow exact pattern of existing tabs (e.g., "payouts" → `<PayoutsTab tenantId={tenant._id} />`).

- [x] **Task 8: Create AdminBillingHistoryTable component**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/AdminBillingHistoryTable.tsx` (NEW)
  - Action: Create admin billing history table:
    - `"use client"` directive.
    - Props: `{ tenantId: Id<"tenants"> }` (self-fetching via `useQuery(api.admin.subscriptions.getTenantBillingHistory, { tenantId, paginationOpts })`).
    - Uses Convex `usePaginatedQuery` for cursor-based pagination.
    - Renders `<DataTable>` with columns: Date (`DateCell`), Event (colored pill badge matching owner's `BillingHistoryTable` event colors), Plan (transition arrow `Previous → New`), Amount (`CurrencyCell`), Actor (admin badge if `actorId` exists).
    - Pagination controls: "Load more" button or Previous/Next using `loadMore` / `prev` / `next` from `usePaginatedQuery`.
    - Event color map: `upgrade` = green, `downgrade` = amber, `cancel` = red, `renew` = blue, `trial_conversion` = purple, `admin_plan_change` = indigo, `admin_trial_extension` = cyan, `admin_cancel` = red, `admin_reactivate` = emerald.
    - Empty state: "No billing history for this tenant."
    - Loading state: Skeleton rows matching table structure.
  - Notes: Do NOT reuse owner's `BillingHistoryTable` — it's self-fetching with owner-scoped query. This is a new component that uses admin-scoped query. Follow the DataTable column definition pattern from `TenantTable.tsx`.

- [x] **Task 9: Create AdminSubscriptionActions component**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/AdminSubscriptionActions.tsx` (NEW)
  - Action: Create admin subscription actions panel:
    - `"use client"` directive.
    - Props: `{ tenantId: Id<"tenants">; tenant: { plan: string; subscriptionStatus?: string | null; trialEndsAt?: number | null } }`.
    - Fetches subscription data via `useQuery(api.admin.subscriptions.getTenantSubscription, { tenantId })`.
    - Renders a `<Card>` with action buttons based on current state:
      - **Change Plan** (always visible except cancelled): Opens a dialog/sheet to select new plan (starter/growth/scale). Calls `adminChangePlan` mutation with selected plan + required reason input.
      - **Extend Trial** (visible only when `subscriptionStatus === "trial"`): Opens a dialog with number input (1-90 days) + reason input. Calls `adminExtendTrial` mutation.
      - **Cancel Subscription** (visible when `subscriptionStatus === "active"` or `"trial"`): Opens a confirmation dialog with reason input (required). Shows impact warning (deletion in 30 days). Calls `adminCancelSubscription` mutation.
      - **Reactivate Subscription** (visible only when `subscriptionStatus === "cancelled"`): Opens a confirmation dialog with reason input. Calls `adminReactivateSubscription` mutation.
    - Each action: loading state on button, success/error toast via `sonner`, refetch subscription data on success.
    - Use `<Button>` from `@/components/ui/button`, `<Dialog>` from `@/components/ui/dialog`, `<Input>` from `@/components/ui/input`, `<Label>` from `@/components/ui/label`.
    - All actions require a reason — show validation error if empty.
  - Notes: Use `useMutation` from Convex for all actions. Import mutations from `@/convex/_generated/api`. Follow `AlertInset.tsx` pattern for action cards within the tenant detail.

- [x] **Task 10: Create BillingTab component**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/BillingTab.tsx` (NEW)
  - Action: Create Billing tab orchestrator:
    - `"use client"` directive.
    - Props: `{ tenantId: Id<"tenants">; tenant: TenantDetail }`.
    - Layout: Two-column grid (`grid-cols-1 lg:grid-cols-3`):
      - Left column (`lg:col-span-2`): `<AdminBillingHistoryTable tenantId={tenantId} />`
      - Right column: `<AdminSubscriptionActions tenantId={tenantId} tenant={tenant} />`
    - Wrap in `<Suspense>` with a skeleton fallback matching the two-column layout.
  - Notes: Follow same layout pattern as `OverviewTab.tsx` (3-col grid with 2-col + 1-col split).

#### Phase 4: Revenue Dashboard

- [x] **Task 11: Create revenue dashboard page and component**
  - File: `src/app/(admin)/revenue/page.tsx` (NEW)
  - Action: Create revenue dashboard page:
    - `"use client"` directive + Suspense wrapper pattern.
    - Inner component `RevenueContent` fetches data via `useQuery(api.admin.subscriptions.getPlatformRevenueMetrics, {})` and `useQuery(api.admin.subscriptions.getRecentSubscriptionActivity, {})`.
    - Renders `<RevenueDashboard metrics={data} isLoading={isLoading} recentActivity={activity} />`.
    - Outer default export `RevenuePage` wraps in `<Suspense fallback={<RevenueDashboardSkeleton />}>`.
    - Page metadata: export `metadata` with title "Revenue Dashboard".
  - File: `src/app/(admin)/revenue/_components/RevenueDashboard.tsx` (NEW)
  - Action: Create revenue dashboard component:
    - Props: `{ metrics: RevenueMetrics | undefined; isLoading: boolean; recentActivity: RecentActivity[] | undefined }`.
    - Layout:
      - **KPI Cards Row** (4 cards in a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`):
        1. **Total MRR**: Large number (formatted PHP currency), subtitle "Monthly Recurring Revenue"
        2. **Active Subscriptions**: Count of active tenants, subtitle "Paying customers"
        3. **Trial Accounts**: Count of trial tenants, subtitle "Free trial"
        4. **Past Due**: Count of past_due tenants, subtitle "Requires attention" (with warning color if > 0)
      - **Subscription Breakdown** (card with visual bars or simple list):
        - Active: count + MRR amount
        - Trial: count
        - Past Due: count + MRR amount
        - Cancelled: count + churned MRR amount
      - **Plan Distribution** (card):
        - Starter count, Growth count + MRR, Scale count + MRR
      - **Recent Subscription Activity** (card):
        - Shows the 10 most recent billing events across all tenants
        - Each row: timestamp (relative, e.g., "2 hours ago"), event type badge (color-coded matching AdminBillingHistoryTable event colors), tenant name (clickable link to `/admin/tenants/[tenantId]`), plan transition (if applicable), amount
        - Empty state: "No recent activity"
        - This answers the fundamental admin question: "What happened recently?"
    - Use `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`.
    - Loading state: Show skeleton cards.
    - Empty/null state: "No revenue data available."
  - File: `src/app/(admin)/revenue/_components/RevenueDashboardSkeleton.tsx` (NEW)
  - Action: Create skeleton fallback matching the RevenueDashboard layout — 4 KPI card skeletons + 2 detail card skeletons.
  - Notes: Use PHP currency formatting. Follow `StatsRow.tsx` pattern for KPI cards. Keep it clean and data-focused — admin dashboard aesthetic.

- [x] **Task 12: Add Revenue to admin sidebar navigation**
  - File: `src/app/(admin)/_components/AdminSidebar.tsx` (MODIFY)
  - Action:
    - Add a "Revenue" navigation item with an **inline SVG icon** matching the existing sidebar style (hand-crafted SVG, NOT `lucide-react` — `AdminSidebar.tsx` uses inline SVGs for all nav items). Use a trending-up or dollar-sign SVG path matching the existing icon dimensions/stroke style.
    - Place it after "Tenants" in the navigation order (or in a logical grouping).
    - Link href: `/admin/revenue`.
    - Follow exact same pattern as existing sidebar items (inline SVG icon + label + active state detection via `usePathname`).
  - Notes: Check if sidebar uses a `usePathname()` pattern for active state highlighting and replicate.

### Acceptance Criteria

- [x] **AC 1:** Given an admin is logged in and viewing the tenants list (`/admin/tenants`), when the page loads, then each tenant row displays a subscription status badge showing "Trial" (blue), "Active" (green), "Past Due" (yellow), "Cancelled" (red), or "None" (gray) based on the tenant's `subscriptionStatus` field.
- [x] **AC 2:** Given an admin is viewing the tenants list, when the admin clicks the subscription column filter, then a dropdown appears with options: Trial, Active, Past Due, Cancelled. When an option is selected, the table filters to show only matching tenants.
- [x] **AC 3:** Given an admin is viewing the tenants list, when the admin sorts by the subscription column, then tenants are ordered alphabetically by subscription status.
- [x] **AC 4:** Given an admin is viewing a tenant's detail page, when the Overview tab is active, then a subscription summary card is displayed showing: status badge, billing period dates, trial end date (if applicable), cancellation date (if applicable), deletion scheduled date (if applicable), and subscription ID.
- [x] **AC 5:** Given an admin is viewing a tenant's detail page, when the admin clicks the "Billing" tab, then the Billing tab displays a two-column layout with billing history table (left) and subscription action buttons (right).
- [x] **AC 6:** Given an admin is viewing the Billing tab, when the billing history table loads, then it shows all billing events for that tenant in reverse chronological order with columns: Date, Event (color-coded pill), Plan transition, Amount, and Actor.
- [x] **AC 7:** Given an admin is viewing the Billing tab and the tenant has a subscription, when the admin clicks "Change Plan", then a dialog opens with plan options (Starter/Growth/Scale) and a required reason field. When submitted, the tenant's plan is updated, a billing history record is created, and an audit log entry is written.
- [x] **AC 8:** Given an admin is viewing the Billing tab and the tenant is on a trial, when the admin clicks "Extend Trial", then a dialog opens with a days input (1-90) and required reason field. When submitted, the trial end date is extended, a billing history record is created, and an audit log entry is written.
- [x] **AC 9:** Given an admin is viewing the Billing tab and the tenant has an active or trial subscription, when the admin clicks "Cancel Subscription", then a confirmation dialog appears with a warning about 30-day deletion and a required reason field. When confirmed, the subscription status becomes "cancelled", deletion is scheduled, a billing history record is created, and an audit log entry is written.
- [x] **AC 10:** Given an admin is viewing the Billing tab and the tenant has a cancelled subscription, when the admin clicks "Reactivate", then a confirmation dialog appears with a required reason field. When confirmed, the subscription status becomes "active", cancellation/deletion dates are cleared, a billing history record is created, and an audit log entry is written.
- [x] **AC 11:** Given an admin attempts to extend a trial for a tenant that is NOT on trial, when the "Extend Trial" button is clicked (or the action is attempted), then the action is not available (button is hidden) or the mutation returns an error.
- [x] **AC 12:** Given an admin submits any subscription action without providing a reason, when the form is submitted, then a validation error is displayed and the action is not executed.
- [x] **AC 13:** Given an admin is viewing the revenue dashboard (`/admin/revenue`), when the page loads, then four KPI cards are displayed: Total MRR (PHP), Active Subscriptions count, Trial Accounts count, and Past Due count.
- [x] **AC 14:** Given the revenue dashboard is loaded, when the metrics are displayed, then a subscription breakdown section shows counts and MRR amounts for each subscription status (active, trial, past due, cancelled) and a plan distribution section shows counts per plan tier.
- [x] **AC 15:** Given a non-admin user attempts to access any admin subscription query or mutation, when the request is made, then a "Unauthorized: Admin access required" error is thrown.
- [x] **AC 16:** Given an admin is viewing the revenue dashboard, when the page loads, then a "Recent Subscription Activity" section displays the 10 most recent billing events across all tenants with: timestamp, event type (color-coded), tenant name (link to tenant detail), plan transition, and amount.

## Additional Context

### Dependencies

- Existing `tenants` table schema (subscription fields already present — no migration)
- Existing `billingHistory` table with `by_tenant` and `by_tenant_and_time` indexes
- Existing `tierConfigs` table for plan pricing data (source of truth for prices)
- Existing `convex/subscriptions.ts` for mutation patterns (reference only, not imported)
- Existing `convex/tenants.ts` — `deleteTenantData` internal mutation needs deletion guard added
- Existing admin tab infrastructure (`TenantTabs.tsx`, `TenantDetailContent.tsx`)
- Existing `DataTable` generic component for table rendering
- Existing `AdminSidebar.tsx` for navigation (uses inline SVGs, not lucide-react)
- `sonner` for toast notifications on admin actions

### Testing Strategy

**Unit tests (convex/admin/subscriptions.test.ts):**
- `getTenantSubscription`: Returns correct subscription data for a valid tenant; returns error for non-existent tenant; admin auth check works
- `getTenantBillingHistory`: Returns paginated billing history; handles empty history
- `getPlatformRevenueMetrics`: Returns correct MRR aggregation using DB tierConfigs (loaded once via `.collect()`, not per-tenant); handles zero tenants; falls back to DEFAULT_TIER_CONFIGS when DB is empty
- `getRecentSubscriptionActivity`: Returns up to 10 most recent billingHistory events with tenant names; handles empty state
- `adminChangePlan`: Successfully changes plan with strict union validator; transitions trial→active when upgrading from trial; sets `subscriptionId` to mock admin transaction ID; rejects same-plan change; requires reason; writes billingHistory + auditLogs with `actorId: admin._id` (Id<"users">, not string)
- `adminExtendTrial`: Successfully extends trial; handles null `trialEndsAt` by falling back to `Date.now()`; rejects non-trial tenant; validates day range 1-90; rejects days > 90 or < 1
- `adminCancelSubscription`: Successfully cancels; schedules deletion relative to `billingEndDate` (not `Date.now()`); rejects already-cancelled tenant
- `adminReactivateSubscription`: Successfully reactivates; clears cancellation/deletion dates; rejects non-cancelled tenant; **verify deletion guard**: `deleteTenantData` internal mutation aborts when `deletionScheduledDate` is undefined

**Manual testing steps:**
1. Login as admin → verify subscription status badges on tenants list
2. Filter tenants list by subscription status → verify correct filtering
3. Click into a tenant → verify subscription summary on Overview tab
4. Navigate to Billing tab → verify billing history loads
5. Change plan via admin action → verify plan updated, history recorded, audit logged
6. Extend trial → verify trial end date extended
7. Cancel subscription → verify status changed, deletion scheduled
8. Reactivate subscription → verify status restored
9. Navigate to `/admin/revenue` → verify KPI cards, breakdown, and recent activity feed display
10. Verify non-admin cannot access admin subscription endpoints

### Notes

- **High-risk items:** Admin plan changes bypass the owner-facing payment flow. The `adminChangePlan` mutation directly patches the tenant without processing payment. This is acceptable for admin override scenarios but should be clearly audit-trailed. The mutation sets a mock `subscriptionId` (`admin_plan_change_${Date.now()}`) to ensure the owner's trial-to-paid flow can't be invoked on an already-active tenant.
- **Revenue accuracy limitation (current-rate MRR, not contracted MRR):** The revenue dashboard computes MRR using current `tierConfigs` prices, not the prices tenants were actually billed at. If an admin changes a tier's price, the MRR will reflect the new price for all tenants on that tier — not what they're actually paying. For accurate contracted revenue, a `billingHistory.amount` aggregation would be needed (out of scope, future enhancement).
- **Known limitations:** Revenue metrics use `.take(500)` on the tenants table. For platforms with >500 tenants, this will undercount. **Migration threshold:** When tenant count approaches 500, migrate to a denormalized `platformRevenue` table with hooks that update on every plan/status change. Until then, computed-at-query-time is acceptable.
- **Deletion guard requirement:** `adminReactivateSubscription` requires adding a guard check in `convex/tenants.ts` at the top of the `deleteTenantData` internal mutation — if `tenant.deletionScheduledDate` is `undefined`, abort deletion silently. This is necessary because Convex does not expose `ctx.scheduler.cancel()`.
- **Concurrent admin action risk:** Two admins could perform conflicting actions (e.g., cancel + reactivate) simultaneously on the same tenant, resulting in race conditions. This is acceptable for the current single-admin platform model. The `billingHistory` + `auditLogs` dual-write makes conflicts detectable after the fact. If multi-admin becomes common, optimistic locking (version field on tenants table) should be added.
- **Phase 2 enhancements (deliberately scoped out):**
  - **Churn prediction signals:** Tenants who were `past_due` last month or have declining affiliate activity are churn risks. The revenue dashboard shows current state only — no predictive signals.
  - **Trial expiry alerts:** Trial tenants with <3 days remaining should be surfaced to admins. Could be added as a filter on the tenants list or a dedicated alert card on the revenue dashboard.
  - **Contracted MRR:** Historical revenue tracking via `billingHistory.amount` aggregation for accurate revenue reporting.
  - **Historical MRR charts:** Time-series MRR data would require a new `dailyRevenueSnapshots` table populated by a cron job.
  - **Multi-subscription support:** Current `tenants` table schema supports one subscription per tenant. If multi-subscription (e.g., add-on products) is needed, a separate `subscriptions` table would be required.
- **Future considerations:** Real payment integration (Stripe/Lemon Squeezy) will require webhook-driven subscription status updates. The current mock pattern should be replaced with event-driven status management. Dunning automation for past-due subscriptions. Refund/credit admin actions.
