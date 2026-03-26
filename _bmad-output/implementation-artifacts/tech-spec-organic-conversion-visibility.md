---
title: "Organic Conversion Visibility for Owners"
slug: "organic-conversion-visibility"
created: "2026-03-26"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["TypeScript", "Convex 1.32.0", "Next.js 16.1.0", "React 19.2.3", "Tailwind CSS 4.1.16"]
files_to_modify: [
  "convex/schema.ts",
  "convex/tenantStats.ts",
  "convex/conversions.ts",
  "convex/dashboard.ts",
  "convex/reports/summary.ts",
  "convex/reports/funnel.ts",
  "src/app/(auth)/dashboard/page.tsx",
  "src/app/(auth)/reports/page.tsx",
  "src/app/(auth)/reports/funnel/page.tsx",
  "src/app/(auth)/reports/funnel/components/ConversionFunnel.tsx",
]
code_patterns: [
  "denormalized-counters",
  "mutation-hook-counter-increment",
  "backfill-stats",
  "metric-card-display",
  "suspense-boundary",
  "capped-queries",
  "capped-list-query",
]
test_patterns: []
---

# Tech-Spec: Organic Conversion Visibility for Owners

**Created:** 2026-03-26
**Reviewed:** 2026-03-26 (adversarial review, 14 findings fixed)

## Overview

### Problem Statement

Organic conversions (sales with no affiliate attribution) are recorded in the `conversions` table with `attributionSource: "organic"` and `affiliateId: undefined`, but are effectively invisible to SaaS Owners in the UI. Owners cannot answer "How many of my sales are organic vs affiliate-referred?" — a critical business metric for evaluating program ROI. The funnel report's `totalConversions` silently includes organic conversions, inflating conversion rate without the owner knowing why. The `getConversionStatsByTenant` query already computes organic/attribution breakdowns but is capped at 800 records and no UI calls it.

Additionally, a **pre-existing bug** exists: `totalConversionsThisMonth` in `tenantStats` is never incremented by any code path (no hook, no backfill). The Reports page `totalConversions` metric has always displayed 0. This spec fixes that bug as part of the organic conversion work.

### Solution

Add organic conversion tracking to the `tenantStats` denormalized counters for accurate, uncapped counts. Fix the broken `totalConversionsThisMonth` counter by adding increment hooks and backfill. Introduce copy-then-reset for ALL `*LastMonth` fields at month boundaries (fixing a design gap where `*LastMonth` was only populated by weekly backfill). Display the attributed-vs-organic split as aggregate metrics on the Dashboard, Reports index, and Conversion Funnel pages. Provide a capped list of individual organic conversions so owners can inspect them.

### Scope

**In Scope:**
- Add `organicConversionsThisMonth`, `organicConversionsLastMonth`, `organicConversionsLast3Months` to `tenantStats` schema
- Fix `totalConversionsThisMonth` counter (pre-existing bug — never incremented)
- Introduce copy-then-reset for ALL `*LastMonth` fields at month boundary (existing design gap)
- Update `createOrganicConversion` mutation to increment organic + total conversion counters
- Add backfill logic to `backfillStats` for organic + total conversion counters
- Add aggregate metric on `/dashboard` showing organic vs attributed conversion split
- Add aggregate metric(s) on `/reports` (Reports index) showing organic vs attributed split
- Add label/badge on `/reports/funnel` Conversion Funnel showing organic portion of total conversions
- Add a capped list of individual organic conversions (customer email, amount, timestamp, attribution source)
- Wire up the new `tenantStats` counters to the existing summary queries

**Out of Scope:**
- Affiliate portal — affiliates don't need to see organic conversions
- Admin panel — platform admins don't need this per-tenant
- Modifying the existing conversion creation flow (only the counter increment hook)
- Exporting organic conversions to CSV (can be a follow-up)
- New routes — organic conversions list lives within existing pages
- Adding a new Convex index for organic conversions (the table doesn't have a dedicated `by_tenant_and_organic` index; adding one requires a schema migration that drops and recreates the index)

## Context for Development

### Codebase Patterns

- **Denormalized counters**: `tenantStats` table tracks aggregate counts by time window (`*ThisMonth`, `*LastMonth`, `*Last3Months`). Month-boundary reset happens in `getOrCreateStats()` — resets `*ThisMonth` fields and `apiCallsThisMonth`. **⚠️ Design gap**: `getOrCreateStats()` resets `*ThisMonth` to 0 but does NOT copy to `*LastMonth`. All `*LastMonth` fields (`commissionsConfirmedLastMonth`, `totalClicksLastMonth`, `totalConversionsLastMonth`) are only populated by the weekly `backfillStats` cron — meaning they're stale for up to 7 days after a month boundary. This spec fixes this gap by introducing copy-then-reset for ALL `*LastMonth` fields. Rolling counters (`*Last3Months`) are NOT reset monthly; they're only recalculated by `backfillStats`.
- **Backfill pattern**: `backfillStats()` scans source tables with `.take()` caps, counts by status/time window, patches `tenantStats`. Called by `backfillAllTenants` (cron weekly). Current per-tenant read cost: ~5K affiliates + 10K commissions + 5K payouts = 20K reads. New conversions scan adds up to 5K more = ~25K reads per tenant. For 100 tenants = 2.5M reads in the sequential `backfillAllTenants` mutation. This is within Convex limits but should be monitored as the platform scales.
- **Counter increment hooks**: Exported async functions (e.g., `onCommissionCreated`) called from mutations. Pattern: `getOrCreateStats()` → compute patch → `ctx.db.patch()`. These hooks are NOT idempotent — if a mutation is retried on write conflict, the counter increments twice. The weekly `backfillStats` cron serves as a periodic correction mechanism. The `createOrganicConversion` mutation currently does NOT call any counter hook — it only inserts the conversion record and an audit log.
- **Pre-existing bug**: `totalConversionsThisMonth` exists in the schema but is NEVER incremented by any hook or written to by any code path. `seedStats` and `getOrCreateStats` don't include it in their insert defaults. `backfillStats` doesn't compute it. The Reports page `totalConversions` metric has always been 0.
- **Dashboard merged query**: `getDashboardData` in `dashboard.ts` fetches everything in one query via `Promise.all`. The `stats` return object includes `recentConversions` (count of conversions in date range) but does NOT distinguish organic vs attributed. It reads `conversions` with `.take(800)`.
- **Reports summary query**: `getProgramSummaryMetrics` reads directly from `tenantStats` (zero table scans). Selects counters by window preset. Currently returns `totalConversions` from `tenantStats` — does NOT split organic vs attributed.
- **Funnel query**: `getConversionFunnel` scans `conversions` with `.take(5000)`, post-filters by date range. `totalConversions = filteredConversions.length` (includes organic). Per-affiliate breakdown skips organic (`if (!conv.affiliateId) continue;`). Per-campaign breakdown also skips organic (no `campaignId`). The sum of campaign conversions + organic may not equal `totalConversions` — this is expected and acceptable.
- **Dashboard design system**: `.card` CSS classes, `PageTopbar`, `bg-[var(--bg-page)]`, `px-8`, CSS variable colors. Typography: `text-[17px]` page titles, `text-[14px]` card titles, `text-[13px]` body, `text-[11px]` labels.
- **MetricCard**: Accepts `label`, `numericValue`, `formatValue`, `icon`, `variant` (blue/green/yellow/gray), `subtext`, `delta`, `isLoading`. No built-in "split" display — `subtext` is a single string.
- **Suspense boundaries**: Required for all client components using `useQuery`. Pattern: content component + skeleton + wrapper with `<Suspense>`.
- **Capped queries**: High-volume tables use `.take(N)` or `.paginate()`. The conversions table uses `by_tenant` index + `.order("desc")`. **⚠️ Pagination caveat**: `.paginate()` with post-filtering (filtering results AFTER pagination) is broken — cursor advances past N total documents but only returns the filtered subset, causing empty pages and incorrect `isDone` flags. For filtered queries, use `.take(N)` with client-side cursor logic instead.
- **Paginated conversions list**: `getConversionsByTenant` uses `paginationOptsValidator`, paginates on `by_tenant` index, enriches with affiliate/campaign names. Returns `page`, `continueCursor`, `isDone`. Organic conversions have `affiliateId: undefined` and `attributionSource: "organic"`.

### Files to Reference

| File | Purpose | Key Details |
| ---- | ------- | ----------- |
| `convex/schema.ts` (L582-586) | `tenantStats` table — add new fields | Currently has `totalConversionsThisMonth/LastMonth/Last3Months` (all conversions, no split). New fields needed: `organicConversionsThisMonth`, `organicConversionsLastMonth`, `organicConversionsLast3Months`. Place after `totalConversionsThisMonth` (L583). |
| `convex/tenantStats.ts` | Counter functions + backfill | `getOrCreateStats()` (L21-67) creates/initializes document with defaults + month reset. `backfillStats()` (L196-304) scans commissions + payouts. `seedStats()` (L166-191) initial insert. `getOrCreateStatsInternal()` (L515-561) action-side stats init. **All 4 locations** need synchronized field additions (see checklist in Task 3). Need new `onOrganicConversionCreated()` hook function. |
| `convex/conversions.ts` (L387-436) | `createOrganicConversion` mutation | Currently inserts conversion + audit log. Must add `onOrganicConversionCreated(ctx, tenantId)` call. Is `internalMutation`. |
| `convex/dashboard.ts` (L35-75, L180-188) | `getDashboardData` query | `stats` return shape has `recentConversions` (all conversions in date range, L185-188). Need to add `recentOrganicConversions` count. Reads conversions with `.take(800)`. |
| `convex/reports/summary.ts` (L35-132) | `getProgramSummaryMetrics` | Reads from `tenantStats` by window. Need to add `organicConversions` to return shape. |
| `convex/reports/funnel.ts` (L12-459) | `getConversionFunnel` | `totalConversions` = all filtered conversions (L103). Need to add `organicConversions` count. Per-campaign breakdown excludes organic — this is expected. |
| `src/app/(auth)/dashboard/page.tsx` (L204-244) | Dashboard page | 4-column MetricCard grid. Need to add organic split display. |
| `src/app/(auth)/reports/page.tsx` (L155-191) | Reports index | 4-column MetricCard grid (MRR, Clicks, Conversions, Commissions). Need to add organic split to Conversions card. |
| `src/app/(auth)/reports/funnel/page.tsx` (L293-326) | Funnel page | 3-column MetricCard grid. Conversions card shows total + conversion rate. Need to add organic label. |
| `src/app/(auth)/reports/funnel/components/ConversionFunnel.tsx` | Funnel visualization | 3-bar funnel. Conversions bar shows count + percentage. Need to show organic portion. |
| `src/components/ui/MetricCard.tsx` | Metric display component | `subtext` is a single string — can show "X organic / Y total". |

### Technical Decisions

1. **Source of truth: `tenantStats` counters** — Chosen over `getConversionStatsByTenant` (capped at 800) for accuracy at scale. Requires schema change + backfill.
2. **Organic conversion list uses `.take()` not `.paginate()`** — Post-filtering after `.paginate()` is fundamentally broken (cursor advances past filtered-out documents, causing empty pages and incorrect `isDone`). The organic conversions list uses `.take(50)` with client-side "Load More" button instead. No new Convex index needed.
3. **Month-boundary reset: copy-then-reset for ALL `*LastMonth` fields** — The existing codebase has a design gap where `*LastMonth` fields are only populated by weekly backfill (stale for up to 7 days). This spec introduces copy-then-reset for ALL `*LastMonth` fields at month boundary, not just organic ones. This fixes the gap consistently.
4. **Counter increment timing** — Must happen inside `createOrganicConversion` mutation (same transaction) following the existing `tenantStats` pattern via a new `onOrganicConversionCreated()` hook function.
5. **Dashboard metric approach** — Add `recentOrganicConversions` to the `getDashboardData` stats return shape. Display as a new MetricCard in the grid, expanding it from 4 to 5 columns with responsive breakpoints (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`). The card shows organic conversion count with subtext showing the organic percentage of total conversions.
6. **Funnel organic label** — Add `organicConversions` to `getConversionFunnel` return. Show as subtext on the Conversions MetricCard (e.g., "142 total · 38 organic"). On the ConversionFunnel visualization, add a small organic count badge next to the Conversions bar.
7. **Reports index organic metric** — Add `organicConversions` to `getProgramSummaryMetrics` return. Show as subtext on the "Total Conversions" MetricCard (e.g., "X organic · Y attributed"). Use `Math.max(0, total - organic)` guard to prevent negative attributed count.
8. **Fix `totalConversionsThisMonth` pre-existing bug** — Add `totalConversionsThisMonth` increment to the `onOrganicConversionCreated` hook AND to the existing `createConversion` mutation (attributed conversions). Add backfill computation in `backfillStats`. Add to all 4 insert-default locations.

## Implementation Plan

### Tasks

- [x] **Task 1: Add organic conversion counter fields to `tenantStats` schema**
  - File: `convex/schema.ts`
  - Action: Add three new optional number fields to the `tenantStats` table definition:
    ```typescript
    organicConversionsThisMonth: v.optional(v.number()),
    organicConversionsLastMonth: v.optional(v.number()),
    organicConversionsLast3Months: v.optional(v.number()),
    ```
  - Place them after `totalConversionsThisMonth` (L583) to group with current-month conversion counters.
  - Notes: Convex handles optional field additions automatically — no migration needed, new fields default to `undefined`.

- [x] **Task 2: Add `onOrganicConversionCreated()` hook to `tenantStats.ts`**
  - File: `convex/tenantStats.ts`
  - Action: Create a new exported async function following the existing hook pattern:
    ```typescript
    export async function onOrganicConversionCreated(
      ctx: MutationCtx,
      tenantId: Id<"tenants">,
    ) {
      const stats = await getOrCreateStats(ctx, tenantId);
      await ctx.db.patch(stats._id, {
        organicConversionsThisMonth: (stats.organicConversionsThisMonth ?? 0) + 1,
        organicConversionsLast3Months: (stats.organicConversionsLast3Months ?? 0) + 1,
        // Also fix pre-existing bug: totalConversionsThisMonth was never incremented
        totalConversionsThisMonth: (stats.totalConversionsThisMonth ?? 0) + 1,
      });
    }
    ```
  - Notes: Increments `organicConversionsThisMonth`, `organicConversionsLast3Months`, AND `totalConversionsThisMonth` (fixing the pre-existing bug where total conversions were never tracked). Only increments `*ThisMonth` and `*Last3Months`. The `*LastMonth` counter is set during the month-boundary rollover (Task 3) and during `backfillStats` (Task 4). ⚠️ This hook is not idempotent — if the mutation is retried on write conflict, the counter increments twice. The weekly `backfillStats` cron serves as a periodic correction.

- [x] **Task 3: Update `getOrCreateStats()` — month-boundary copy-then-reset + insert defaults**
  - File: `convex/tenantStats.ts`
  - Action: This is the most sensitive task — changes must be applied to **4 locations** in sync. Use this checklist:

  **Synchronized field addition checklist** — the following fields must be added to ALL 4 locations:
  - `organicConversionsThisMonth` (default: `0`)
  - `totalConversionsThisMonth` (default: `0`) — pre-existing field, was missing from insert defaults

  | Location | Type | Changes |
  |----------|------|---------|
  | `getOrCreateStats()` insert (L31-49) | New tenant | Add `organicConversionsThisMonth: 0, totalConversionsThisMonth: 0` to insert object |
  | `getOrCreateStats()` month reset (L54-61) | Month boundary | **NEW: copy-then-reset for ALL `*LastMonth` fields**. Before zeroing `*ThisMonth` fields, copy them to corresponding `*LastMonth` fields. See detailed code below. |
  | `seedStats()` (L166-191) | Seed | Add `organicConversionsThisMonth: 0, totalConversionsThisMonth: 0` to insert object |
  | `getOrCreateStatsInternal()` insert (L515-561) | Action-side init | Add `organicConversionsThisMonth: 0, totalConversionsThisMonth: 0` to insert object. Add same copy-then-reset block as `getOrCreateStats()`. |

  **Month-boundary copy-then-reset** (replaces the existing reset block at L54-61):
  ```typescript
  if (needsReset) {
    await ctx.db.patch(stats._id, {
      // Copy ThisMonth → LastMonth BEFORE zeroing
      commissionsConfirmedLastMonth: stats.commissionsConfirmedThisMonth,
      commissionsConfirmedValueLastMonth: stats.commissionsConfirmedValueThisMonth,
      totalClicksLastMonth: stats.totalClicksLastMonth ?? 0,
      totalConversionsLastMonth: stats.totalConversionsThisMonth ?? 0,
      organicConversionsLastMonth: stats.organicConversionsThisMonth ?? 0,
      // Now zero ThisMonth fields
      commissionsConfirmedThisMonth: 0,
      commissionsConfirmedValueThisMonth: 0,
      commissionsReversedThisMonth: 0,
      commissionsReversedValueThisMonth: 0,
      organicConversionsThisMonth: 0,
      totalConversionsThisMonth: 0,
      currentMonthStart: monthStart,
      apiCallsThisMonth: 0,
    });
    return (await ctx.db.get(stats._id))!;
  }
  ```
  Apply the SAME copy-then-reset block to `getOrCreateStatsInternal()` (L548-557).

  - Notes: This fixes a pre-existing design gap where `*LastMonth` fields were only populated by weekly backfill (stale for up to 7 days). Now they're accurate immediately after month boundary. The `*Last3Months` counter is NOT reset monthly — it's a rolling window recalculated only by `backfillStats`.

- [x] **Task 4: Update `backfillStats()` to scan conversions and compute organic + total counters**
  - File: `convex/tenantStats.ts`
  - Action: In the `backfillStats` handler (L196-304):
    1. Add a conversions query (capped at 5000 to control mutation cost):
       ```typescript
       const conversions = await ctx.db
         .query("conversions")
         .withIndex("by_tenant", q => q.eq("tenantId", tenantId))
         .take(5000);
       ```
    2. Compute total AND organic counts for each time window in a single pass:
       ```typescript
       const lastMonthStart = new Date(
         new Date(monthStart).getFullYear(),
         new Date(monthStart).getMonth() - 1, 1
       ).getTime();
       const threeMonthsAgoStart = new Date(
         new Date(monthStart).getFullYear(),
         new Date(monthStart).getMonth() - 2, 1
       ).getTime();

       let totalConversionsThisMonth = 0, totalConversionsLastMonth = 0, totalConversionsLast3Months = 0;
       let organicConversionsThisMonth = 0, organicConversionsLastMonth = 0, organicConversionsLast3Months = 0;

       for (const c of conversions) {
         const isOrganic = !c.affiliateId;
         if (c._creationTime >= monthStart) {
           totalConversionsThisMonth++;
           if (isOrganic) organicConversionsThisMonth++;
         } else if (c._creationTime >= lastMonthStart) {
           totalConversionsLastMonth++;
           if (isOrganic) organicConversionsLastMonth++;
         }
         if (c._creationTime >= threeMonthsAgoStart) {
           totalConversionsLast3Months++;
           if (isOrganic) organicConversionsLast3Months++;
         }
       }
       ```
    3. Add all six fields (`totalConversionsThisMonth/LastMonth/Last3Months`, `organicConversionsThisMonth/LastMonth/Last3Months`) to the `data` object that gets patched/inserted (L276-294).
  - Notes: This fixes the pre-existing bug where `totalConversionsThisMonth` was never written by any code path. The 5000 cap (reduced from 10000) keeps per-tenant backfill cost at ~25K reads. ⚠️ If a tenant has more than 5000 conversions, the backfill will undercount. This is acceptable for now — the real-time hooks keep `*ThisMonth` accurate, and the 5000 cap covers most tenants. A future optimization could use cursor-based pagination within the backfill.

- [x] **Task 5: Wire `onOrganicConversionCreated()` into `createOrganicConversion` mutation**
  - File: `convex/conversions.ts`
  - Action: Add import at top: `import { onOrganicConversionCreated } from "./tenantStats";`
  - In `createOrganicConversion` handler (L404-435), add after the conversion insert (L406-416) and before the audit log insert (L418):
    ```typescript
    // Increment organic + total conversion counters
    await onOrganicConversionCreated(ctx, args.tenantId);
    ```
  - Notes: This is an `internalMutation` so it runs in a Convex transaction. The counter increment is atomic with the conversion insert. All callers (`http.ts`, `commissionEngine.ts`) automatically benefit. ⚠️ Also add `totalConversionsThisMonth` increment to the existing `createConversion` mutation (L545-567) for attributed conversions, since that counter was never incremented either:
    ```typescript
    // In createConversion handler, after the insert:
    import { incrementTotalConversions } from "./tenantStats";
    await incrementTotalConversions(ctx, args.tenantId);
    ```
    Create a lightweight `incrementTotalConversions` helper in `tenantStats.ts`:
    ```typescript
    export async function incrementTotalConversions(ctx: MutationCtx, tenantId: Id<"tenants">) {
      const stats = await getOrCreateStats(ctx, tenantId);
      await ctx.db.patch(stats._id, {
        totalConversionsThisMonth: (stats.totalConversionsThisMonth ?? 0) + 1,
      });
    }
    ```

- [x] **Task 6: Add `recentOrganicConversions` to `getDashboardData` query**
  - File: `convex/dashboard.ts`
  - Action: Two changes:
    1. **Return shape** (L43-53): Add `recentOrganicConversions: v.number()` to the `stats` object validator.
    2. **Handler** (L180-188): In the existing conversions counting loop, add an organic counter:
       ```typescript
       let recentOrganicConversions = 0;
       for (const conversion of conversions) {
         if (conversion._creationTime >= startDate && conversion._creationTime <= endDate) {
           recentConversions++;
           if (!conversion.affiliateId) recentOrganicConversions++;
         }
       }
       ```
    3. Add `recentOrganicConversions` to the stats return object.
  - Notes: Zero additional DB reads — computed in the same loop that already counts `recentConversions`.

- [x] **Task 7: Add `organicConversions` to `getProgramSummaryMetrics` query**
  - File: `convex/reports/summary.ts`
  - Action: Three changes:
    1. **Return shape** (L40-52): Add `organicConversions: v.number()`.
    2. **Default return** (L71-84): Add `organicConversions: 0`.
    3. **Handler** (L86-130): For each window case (thisMonth, lastMonth, last3Months), read the corresponding `organicConversions` field from `stats`:
       ```typescript
       let organicConversions: number;
       switch (window) {
         case "lastMonth":
           organicConversions = stats.organicConversionsLastMonth ?? 0;
           break;
         case "last3Months":
           organicConversions = stats.organicConversionsLast3Months ?? 0;
           break;
         case "thisMonth":
         default:
           organicConversions = stats.organicConversionsThisMonth ?? 0;
           break;
       }
       ```
    4. Add `organicConversions` to the return object.
  - Notes: Reads from `tenantStats` — zero table scans. With the copy-then-reset fix (Task 3), `lastMonth` is now accurate immediately after month boundary.

- [x] **Task 8: Add `organicConversions` to `getConversionFunnel` query**
  - File: `convex/reports/funnel.ts`
  - Action: Two changes:
    1. **Return shape** (L18-42): Add `organicConversions: v.number()` to the top-level return object.
    2. **Handler** (L81-121): After computing `totalConversions` (L103), compute organic:
       ```typescript
       const organicConversions = filteredConversions.filter(c => !c.affiliateId).length;
       ```
    3. Add `organicConversions` to the return object (L454).
  - Notes: The funnel query already has `filteredConversions` in memory — this is just an additional `.filter()` pass, zero additional DB reads.

- [x] **Task 9: Add organic conversion MetricCard to Dashboard page**
  - File: `src/app/(auth)/dashboard/page.tsx`
  - Action:
    1. Import `Leaf` icon from `lucide-react` (represents organic/natural).
    2. Update the MetricCard grid responsive classes (L204):
       - Change from: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8`
       - Change to: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8`
       - This gives: 2 cols on mobile (2+2+1 rows), 3 cols on sm (2 rows), 5 cols on lg (1 row)
    3. Add a new MetricCard after the "Total Paid Out" card (after L243):
       ```tsx
       <MetricCard
         label="Organic Sales"
         numericValue={stats?.recentOrganicConversions ?? 0}
         subtext={
           stats && stats.recentConversions > 0
             ? `${Math.round(((stats.recentOrganicConversions ?? 0) / stats.recentConversions) * 100)}% of all conversions`
             : undefined
         }
         isLoading={!stats}
         variant="blue"
         icon={<Leaf className="w-4 h-4" />}
       />
       ```
  - Notes: Uses `Leaf` icon to visually distinguish organic from affiliate-referred. The subtext shows the organic percentage of total conversions.

- [x] **Task 10: Add organic split subtext to Reports index Conversions card**
  - File: `src/app/(auth)/reports/page.tsx`
  - Action: Update the "Total Conversions" MetricCard (L173-181) to include organic subtext with defensive clamp:
    ```tsx
    <MetricCard
      label="Total Conversions"
      numericValue={summaryMetrics?.totalConversions ?? 0}
      subtext={
        summaryMetrics && summaryMetrics.totalConversions > 0
          ? `${summaryMetrics.organicConversions} organic · ${Math.max(0, summaryMetrics.totalConversions - summaryMetrics.organicConversions)} attributed`
          : `${summaryMetrics?.avgConversionRate?.toFixed(1) ?? 0}% conversion rate`
      }
      delta={conversionsDelta}
      variant="yellow"
      isLoading={isLoading}
      icon={<Target className="w-4 h-4" />}
    />
    ```
  - Notes: Shows "X organic · Y attributed" when there are conversions. Uses `Math.max(0, ...)` to prevent negative attributed count if data sources are temporarily inconsistent. Falls back to conversion rate when zero.

- [x] **Task 11: Add organic label to Funnel page Conversions card**
  - File: `src/app/(auth)/reports/funnel/page.tsx`
  - Action: Update the "Conversions" MetricCard (L301-312) to include organic subtext:
    ```tsx
    <MetricCard
      label="Conversions"
      numericValue={funnelData?.totalConversions ?? 0}
      icon={<Target className="w-4 h-4" />}
      variant="green"
      isLoading={isLoading}
      subtext={
        funnelData && funnelData.totalConversions > 0
          ? `${funnelData.clickToConversionRate.toFixed(1)}% conversion rate · ${funnelData.organicConversions} organic`
          : undefined
      }
    />
    ```
  - Notes: Appends organic count to existing conversion rate subtext.

- [x] **Task 12: Add organic indicator to ConversionFunnel visualization**
  - File: `src/app/(auth)/reports/funnel/components/ConversionFunnel.tsx`
  - Action:
    1. Add `organicConversions?: number` to the `ConversionFunnelProps` interface.
    2. In the Conversions step count badge (L159-168), add an organic indicator after the count:
       ```tsx
       {!isFirst && step.count > 0 && (
         <span className="text-xs text-[var(--text-muted)] ml-1.5">
           ({step.width.toFixed(1)}%)
         </span>
       )}
       {/* Show organic count for Conversions step */}
       {step.label === "Conversions" && organicConversions !== undefined && organicConversions > 0 && (
         <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
           <Leaf className="w-3 h-3" />
           {organicConversions} organic
         </span>
       )}
       ```
    3. Import `Leaf` from `lucide-react`.
  - Notes: Small, non-intrusive indicator. Uses `Leaf` icon consistent with the dashboard MetricCard. The funnel's per-campaign bars exclude organic (expected — organic has no campaign). The total includes organic, which is fine — the organic label on the Conversions bar explains the discrepancy.

- [x] **Task 13: Create `getOrganicConversions` capped query (NOT paginated)**
  - File: `convex/conversions.ts`
  - Action: Add a new public query using `.take()` instead of `.paginate()`:
    ```typescript
    export const getOrganicConversions = query({
      args: {
        tenantId: v.id("tenants"),
        limit: v.optional(v.number()),  // max 100
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      },
      returns: v.array(v.object({
        _id: v.id("conversions"),
        _creationTime: v.number(),
        tenantId: v.id("tenants"),
        customerEmail: v.optional(v.string()),
        amount: v.number(),
        status: v.optional(v.string()),
        attributionSource: v.optional(v.string()),
        metadata: v.optional(v.any()),
      })),
      handler: async (ctx, args) => {
        const limit = Math.min(args.limit ?? 50, 100);

        const allConversions = await ctx.db
          .query("conversions")
          .withIndex("by_tenant", q => q.eq("tenantId", args.tenantId))
          .order("desc")
          .take(limit * 5); // Overscan to account for attributed conversions being filtered out

        const organic = allConversions
          .filter(c => !c.affiliateId)
          .filter(c => {
            if (args.startDate && c._creationTime < args.startDate) return false;
            if (args.endDate && c._creationTime > args.endDate) return false;
            return true;
          });

        return organic.slice(0, limit);
      },
    });
    ```
  - Notes: ⚠️ **Critical: does NOT use `.paginate()`** — post-filtering after pagination is fundamentally broken (cursor advances past filtered-out documents, causing empty pages). Instead uses `.take(limit * 5)` with overscan to get enough organic results. Returns a flat array (not paginated). Client component handles "Load More" by calling again with a higher limit. The 100 max cap prevents unbounded reads. No new Convex index needed.

- [x] **Task 14: Create OrganicConversionsTable component with Suspense boundary**
  - File: `src/app/(auth)/reports/funnel/components/OrganicConversionsTable.tsx` (new file)
  - Action: Create a new client component that displays capped organic conversions:
    ```tsx
    "use client";

    import { useState } from "react";
    import { useQuery } from "convex/react";
    import { api } from "@/convex/_generated/api";
    import { Id } from "@/convex/_generated/dataModel";
    import { Skeleton } from "@/components/ui/skeleton";
    import { format } from "date-fns";
    import { Leaf } from "lucide-react";
    import { Button } from "@/components/ui/button";

    interface OrganicConversionsTableProps {
      tenantId: Id<"tenants">;
      startDate?: number;
      endDate?: number;
    }

    const PAGE_SIZE = 20;

    export function OrganicConversionsTable({ tenantId, startDate, endDate }: OrganicConversionsTableProps) {
      const [limit, setLimit] = useState(PAGE_SIZE);
      const results = useQuery(
        api.conversions.getOrganicConversions,
        { tenantId, limit, startDate, endDate }
      );

      if (!results) {
        return (
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        );
      }

      if (results.length === 0) {
        return (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            No organic conversions recorded
          </div>
        );
      }

      return (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Date</th>
                  <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Customer</th>
                  <th className="text-right py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Amount</th>
                  <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Source</th>
                  <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map(conv => (
                  <tr key={conv._id} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-page)]">
                    <td className="py-2.5 px-4 text-[13px] text-[var(--text-muted)]">
                      {format(conv._creationTime, "MMM d, yyyy")}
                    </td>
                    <td className="py-2.5 px-4 text-[13px]">
                      {conv.customerEmail ?? "—"}
                    </td>
                    <td className="py-2.5 px-4 text-[13px] text-right tabular-nums font-medium">
                      {conv.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Leaf className="w-3 h-3" />
                        {conv.attributionSource ?? "organic"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs font-medium text-[var(--success)]">
                        {conv.status ?? "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length >= limit && (
            <div className="flex justify-center py-4">
              <Button variant="outline" size="sm" onClick={() => setLimit(prev => prev + PAGE_SIZE)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      );
    }
    ```
  - Notes: Uses `.card` CSS class for the outer container (added in Task 15, not inside this component). Uses `useState` for `limit` — each "Load More" click increases the limit and refetches. ⚠️ This component MUST be wrapped in `<Suspense>` in the parent page (see Task 15).

- [x] **Task 15: Add OrganicConversionsTable to Funnel page with Suspense boundary**
  - File: `src/app/(auth)/reports/funnel/page.tsx`
  - Action:
    1. Import `OrganicConversionsTable` from `./components` and `Suspense` from `react`.
    2. Add it after the `FunnelAffiliateTable` (after L352), inside the page content div, **wrapped in `<Suspense>`**:
       ```tsx
       {/* Organic Conversions List */}
       <div className="card">
         <div className="card-header">
           <h3 className="card-title flex items-center gap-2">
             <Leaf className="w-4 h-4" />
             Organic Conversions
           </h3>
           <span className="text-xs text-[var(--text-muted)]">
             Sales with no affiliate attribution
           </span>
         </div>
         <Suspense fallback={
           <div className="space-y-3 p-4">
             {[...Array(5)].map((_, i) => (
               <Skeleton key={i} className="h-10 w-full" />
             ))}
           </div>
         }>
           <OrganicConversionsTable
             tenantId={tenantId!}
             startDate={queryDateRange?.start}
             endDate={queryDateRange?.end}
           />
         </Suspense>
       </div>
       ```
    3. Import `Leaf` from `lucide-react` and `Skeleton` from `@/components/ui/skeleton`.
    4. Export `OrganicConversionsTable` from `./components/index.ts`.
  - Notes: ⚠️ **Suspense boundary is REQUIRED** — the component uses `useQuery` + `useState`. Without `<Suspense>`, Next.js 16 streaming SSR will throw "Blocking Route" errors. Only renders when `tenantId` is available. Uses the same date range as the funnel filter.

- [x] **Task 16: Pass `organicConversions` prop to ConversionFunnel component**
  - File: `src/app/(auth)/reports/funnel/page.tsx`
  - Action: Update the `<ConversionFunnel>` usage (L329-337) to pass the new prop:
    ```tsx
    <ConversionFunnel
      totalClicks={funnelData?.totalClicks ?? 0}
      totalConversions={funnelData?.totalConversions ?? 0}
      totalCommissions={funnelData?.totalCommissions ?? 0}
      clickToConversionRate={funnelData?.clickToConversionRate ?? 0}
      conversionToCommissionRate={funnelData?.conversionToCommissionRate ?? 0}
      overallRate={funnelData?.overallRate ?? 0}
      organicConversions={funnelData?.organicConversions ?? 0}
      isLoading={isLoading}
    />
    ```
  - Notes: Depends on Task 8 (query) and Task 12 (component prop).

- [x] **Task 17: Run backfill to populate counters for existing data**
  - Action: After deploying, run the backfill to populate organic + total conversion counters for all existing tenants:
    ```bash
    npx convex run tenantStats:backfillAll
    ```
  - Notes: This is a one-time action after deployment. The weekly cron (`backfillAllTenants`) will keep counters accurate going forward. Can be run in Convex dashboard or via CLI.

### Acceptance Criteria

- [x] **AC 1:** Given a tenant with existing organic conversions in the database, when `backfillStats` runs, then `tenantStats.organicConversionsThisMonth` equals the count of organic conversions created this month (up to the 5000 conversion scan cap).
- [x] **AC 2:** Given the month boundary rolls over (e.g., April 1st), when `getOrCreateStats` is called, then `organicConversionsLastMonth` equals the previous `organicConversionsThisMonth` value, `totalConversionsLastMonth` equals the previous `totalConversionsThisMonth`, and ALL `*ThisMonth` fields are reset to 0.
- [x] **AC 3:** Given an organic conversion is created via `createOrganicConversion`, when the mutation completes, then `organicConversionsThisMonth`, `totalConversionsThisMonth`, and `organicConversionsLast3Months` are all incremented by 1.
- [x] **AC 4:** Given an attributed conversion is created via `createConversion`, when the mutation completes, then `totalConversionsThisMonth` is incremented by 1 (fixing the pre-existing bug).
- [x] **AC 5:** Given the Dashboard page loads, when the owner views the metric cards, then an "Organic Sales" card displays the organic conversion count with the organic percentage of total conversions as subtext.
- [x] **AC 6:** Given the Reports index page loads, when the owner views the "Total Conversions" card, then the subtext shows "X organic · Y attributed" (or conversion rate when zero conversions). The attributed count is never negative (defensive `Math.max(0, ...)` clamp).
- [x] **AC 7:** Given the Conversion Funnel page loads, when the owner views the "Conversions" MetricCard, then the subtext includes the organic count (e.g., "3.2% conversion rate · 12 organic").
- [x] **AC 8:** Given the Conversion Funnel visualization renders, when there are organic conversions, then the Conversions bar shows a small organic indicator with count.
- [x] **AC 9:** Given the Funnel page has organic conversions in the date range, when the owner scrolls below the funnel visualization, then a table of organic conversions displays with columns: Date, Customer Email, Amount, Source, Status. The table is wrapped in a `<Suspense>` boundary.
- [x] **AC 10:** Given the `getOrganicConversions` query is called, when results are returned, then only conversions with `affiliateId === undefined` are returned, respecting the `startDate`/`endDate` filters, capped at the requested limit.
- [x] **AC 11:** Given a viewer (non-owner/non-manager) views the Funnel page, when the page renders, then the organic conversion count is visible (not gated by RBAC) since it's not sensitive financial data.
- [x] **AC 12:** Given no organic conversions exist, when the OrganicConversionsTable renders, then an empty state message is displayed ("No organic conversions recorded").
- [x] **AC 13:** Given the `getProgramSummaryMetrics` query is called with window "lastMonth" after a month boundary, when the stats document exists, then the returned `organicConversions` is immediately accurate (not stale for up to 7 days).
- [x] **AC 14:** Given the `getProgramSummaryMetrics` query is called with window "thisMonth", when the stats document exists, then the returned `totalConversions` is non-zero (fixing the pre-existing bug).

## Additional Context

### Dependencies

- No new packages required
- Depends on existing `tenantStats` pattern (already in codebase)
- Schema migration: adding optional fields to `tenantStats` — Convex handles this automatically (new fields default to `undefined`)
- `lucide-react` already installed — `Leaf` icon is available
- `date-fns` already installed — `format()` is available

### Testing Strategy

**Manual Testing Steps:**
1. Run `pnpm convex dev` to start backend
2. Trigger an organic conversion via the HTTP endpoint (hit `/api/track/convert` without a valid affiliate cookie)
3. Verify `tenantStats` document has `organicConversionsThisMonth` AND `totalConversionsThisMonth` both incremented by 1
4. Check Dashboard page — "Organic Sales" card should show count
5. Check Reports page — "Total Conversions" card should show non-zero total + organic split subtext
6. Check Funnel page — Conversions card subtext should show organic count
7. Check Funnel page — Organic Conversions table should list the conversion (wrapped in Suspense)
8. Run `npx convex run tenantStats:backfillAll` and verify historical organic conversions are counted
9. View the Funnel page with a date range filter — table should respect the filter
10. Click "Load More" on the organic conversions table — should fetch more results

**Edge Cases to Verify:**
- Tenant with zero organic conversions — all displays should show 0 or empty state gracefully
- Month boundary rollover — ALL `*LastMonth` counters copy correctly (not just organic)
- Viewer role (non-owner/non-manager) — organic counts visible, commission amounts hidden
- Large tenant with many conversions — backfill `.take(5000)` cap handles gracefully (may undercount)
- Negative attributed guard — Reports page shows 0 attributed (not negative) if data inconsistent

### Notes

- The funnel report's per-affiliate table already skips organic conversions (`if (!conv.affiliateId) continue;`). This is correct behavior — organic conversions should NOT appear in affiliate breakdowns.
- The funnel's per-campaign breakdown also excludes organic conversions (no `campaignId`). The sum of campaign conversions + organic may not equal `totalConversions`. The organic label on the Conversions bar explains this to the user.
- `createOrganicConversion` is an `internalMutation` called from `http.ts` and `commissionEngine.ts` — all callers automatically benefit from the counter increment.
- Counter hooks are NOT idempotent — Convex retries on write conflict could double-count. The weekly `backfillStats` cron serves as a periodic correction mechanism.
- The dashboard `getDashboardData` query already iterates conversions — computing organic count in the same loop adds zero additional DB reads.
- Future consideration: CSV export of organic conversions (currently out of scope but follows the same pattern as existing commission CSV export).
- Future consideration: Add a `by_tenant_and_attribution` compound index on conversions to enable efficient server-side pagination of organic conversions (currently uses overscan approach). This requires a schema migration that drops and recreates the index.
