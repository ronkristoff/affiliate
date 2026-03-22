---
title: "Site-Wide Scalability Audit — Denormalized Counters & Pagination Compliance"
slug: "site-wide-scalability-audit"
created: "2026-03-22"
status: "completed"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16.1.0 (App Router)", "Convex 1.32.0", "Tailwind CSS 4.1.16", "TypeScript 5.9.3", "React 19.2.3", "Radix UI"]
files_to_modify: [
  "convex/tenantStats.ts",
  "convex/affiliates.ts",
  "convex/commissions.ts",
  "convex/payouts.ts",
  "convex/dashboard.ts",
  "convex/campaigns.ts",
  "convex/clicks.ts",
  "convex/conversions.ts",
  "src/app/(auth)/dashboard/page.tsx",
  "src/app/(auth)/affiliates/page.tsx",
  "src/app/(auth)/commissions/page.tsx",
  "src/app/(auth)/campaigns/page.tsx",
  "src/app/(auth)/campaigns/all/page.tsx",
  "src/app/(auth)/payouts/PayoutsClient.tsx",
  "src/components/dashboard/CampaignOverview.tsx",
  "src/components/dashboard/CampaignListView.tsx",
  "src/components/dashboard/CampaignStatsBar.tsx",
  "src/components/dashboard/CampaignList.tsx",
  "src/components/shared/SidebarNav.tsx",
  "src/app/(auth)/dashboard/client.tsx",
  "AGENTS.md",
  "docs/scalability-guidelines.md",
]
code_patterns: [
  "Denormalized counters: tenantStats table with O(1) reads — see docs/denormalized-counters.md",
  "Counter hooks: updateAffiliateCount(ctx, tenantId, oldStatus, newStatus), onCommissionCreated(ctx, tenantId, amount, status, hasFraudSignals), onCommissionStatusChange(ctx, tenantId, amount, oldStatus, newStatus), incrementTotalPaidOut(ctx, tenantId, amount) — convex/tenantStats.ts",
  "Cursor-based pagination: paginationOptsValidator + .paginate() — payouts.ts, campaigns.ts, clicks.ts, conversions.ts, audit.ts",
  "Page-based pagination (legacy): manual page/numItems + .take(N).slice() — affiliates.ts:591, commissions.ts:1397",
  ".take() caps for bounded non-paginated queries",
  "Component pattern: page.tsx → Suspense wrapper → ContentComponent (hooks inside)",
  "getOrCreateStats lazy month reset: resets monthly counters on first mutation of new month",
]
test_patterns: []
---

# Tech-Spec: Site-Wide Scalability Audit — Denormalized Counters & Pagination Compliance

**Created:** 2026-03-22

## Overview

### Problem Statement

The denormalized counters system (`tenantStats`) was architected to replace expensive full-table scans with O(1) reads, preventing Convex's 1MB transaction limit crashes. However, a site-wide audit reveals the system is almost entirely disconnected: **only 2 of ~17 status-changing mutations are wired up** (payout total only). All affiliate (10 mutations) and commission (6 mutations) mutations bypass the counter system. Simultaneously, the dashboard page alone triggers **21 unbounded `.collect()` calls** across 6 queries, and ~15 more unbounded queries exist across the rest of the site. As data grows, these will crash.

### Solution

1. **Fix a critical bug** in `getOrCreateStats` that returns stale data after month reset
2. **Wire up ALL unwired mutations** to tenantStats counter hooks
3. **Convert dashboard stats queries** to read from tenantStats (eliminating 4 of 21 collects)
4. **Convert `getAffiliateCountByStatus` and `getCommissionStats`** to read from tenantStats
5. **Add `.take()` caps** to all remaining unbounded queries that can't use tenantStats
6. **Update frontend consumers** where query shapes change
7. **Create enforceable guidelines** for all future development

### Scope

**In Scope:**
- **Dashboard** — convert `getOwnerDashboardStats`, `getPlanUsage`, `getSetupStatus` to partial tenantStats reads; cap `getRecentActivity`, `getTopAffiliates`, `getRecentCommissions` with `.take()`
- **Affiliates** — wire all 10 status-changing mutations to `updateAffiliateCount`; convert `getAffiliateCountByStatus` to tenantStats read
- **Commissions** — wire all 6 status-changing mutations to `onCommissionCreated` / `onCommissionStatusChange`; convert `getCommissionStats` to tenantStats read
- **Campaigns** — cap `getCampaignCardStats`, `getAffiliatesByCampaign` with `.take()`
- **Payouts** — verify existing `incrementTotalPaidOut` hooks; cap `getPendingPayoutTotal`, `getAffiliatesWithPendingPayouts`
- **Clicks/Conversions** — cap `getClickStats`, `getConversionStatsByTenant` with `.take()`
- **Frontend** — update any component consuming changed query shapes
- **Bug fix** — `getOrCreateStats` stale return after month reset
- **Future guidelines** — codify in `docs/scalability-guidelines.md` AND `AGENTS.md`

**Out of Scope:**
- Reports module (separate future tech-spec — ~10 queries with 3-5 unbounded collects each)
- New feature development
- New schema indexes
- Migrating legacy page-based pagination to cursor (functional, lower priority)
- Converting `getRecentActivity`, `getTopAffiliates`, `getRecentCommissions` to full tenantStats (returns individual enriched records, not aggregatable)

## Context for Development

### Codebase Patterns

- **Denormalized counters architecture**: `tenantStats` table (one doc per tenant) with pre-computed counters updated atomically by mutations. Full guide in `docs/denormalized-counters.md`.
- **Counter hook functions** (all in `convex/tenantStats.ts`):
  - `updateAffiliateCount(ctx, tenantId, oldStatus, newStatus)` — L266, swaps affiliate status counters
  - `onCommissionCreated(ctx, tenantId, amount, status, hasFraudSignals)` — L296, increments pending/confirmed/flagged
  - `onCommissionStatusChange(ctx, tenantId, amount, oldStatus, newStatus)` — L327, swaps commission counters
  - `incrementTotalPaidOut(ctx, tenantId, amount)` — L374, adds to totalPaidOut
- **Current wiring**: Only `incrementTotalPaidOut` called from `payouts.ts`. All other hooks are defined but unused.
- **`getOrCreateStats` bug**: L49-59 — after month reset patch, returns OLD `stats` object. Hook functions that read from the return value will use stale monthly numbers (e.g., `stats.commissionsConfirmedThisMonth` = 45 when DB is already 0). First mutation of each month gets wrong counter values.
- **Cursor-based pagination**: `paginationOptsValidator` + `.paginate()` — established in 7+ files.
- **Page-based pagination (legacy)**: `page`/`numItems` + `.take(N).slice()` — in `affiliates.ts:591`, `commissions.ts:1397`.
- **Component pattern**: `page.tsx` → Suspense wrapper → ContentComponent (hooks inside).
- **Multi-tenant isolation**: All queries resolve tenant via `getAuthenticatedUser(ctx)`.

### Files to Reference

| File | Purpose | Investigation Findings |
| ---- | ------- | ---------------------- |
| `convex/tenantStats.ts` | Counter hooks + seed/backfill | 4 hooks (L266, L296, L327, L374). **Bug**: `getOrCreateStats` (L59) returns stale data after month reset. `getStats` query (L70) reads tenantStats. `backfillAllTenants` (L244) scans up to 10K docs. |
| `convex/schema.ts` | tenantStats table + indexes | All counter fields defined. `by_tenant` index. |
| `convex/affiliates.ts` | 10 unwired mutations + unbounded queries | Mutations: `registerAffiliate`(L987), `inviteAffiliate`(L1072), `updateAffiliateStatus`(L1154), `setAffiliateStatus`(L1418), `suspendAffiliate`(L1502), `reactivateAffiliate`(L1622), `approveAffiliate`(L1753), `rejectAffiliate`(L1861), `bulkApproveAffiliates`(L1972), `bulkRejectAffiliates`(L2094). Queries: `getAffiliateCountByStatus`(L848) — direct tenantStats replacement. `listAffiliatesByStatus`(L244) — 4 unbounded collects. `getAffiliatesByTenant`(L210) — unbounded collect. |
| `convex/commissions.ts` | 6 unwired mutations + unbounded queries | Mutations: `createCommission`(L149), `createCommissionFromConversionInternal`(L281), `adjustCommissionAmountInternal`(L737 — amount-only change, no hook exists), `reverseCommissionInternal`(L821), `approveCommission`(L903), `declineCommission`(L1066). Queries: `getCommissionStats`(L1731) — direct tenantStats replacement. `listCommissions`(L419) — unbounded collect. `listCommissionsPaginated`(L1467) — `.take(5000)` risky. |
| `convex/dashboard.ts` | Worst offender — 21 unbounded collects across 6 queries | `getOwnerDashboardStats`(L29): 5 collects — 4 fields replaceable by tenantStats. `getRecentActivity`(L185): 3 collects — NOT replaceable (individual records). `getTopAffiliates`(L358): 4 collects — NOT replaceable (per-affiliate breakdown). `getRecentCommissions`(L490): 4 collects — NOT replaceable (individual records). `getPlanUsage`(L611): 2 collects — 1 field replaceable. `getSetupStatus`(L694): 2 collects — 1 field replaceable, should use `.first()` instead. |
| `convex/campaigns.ts` | Partially restructured | `listCampaignsPaginated` exists with cursor pagination. `getCampaignCardStats`(L710) — 3 unbounded collects (conversions, commissions, referralLinks). `getAffiliatesByCampaign`(L878) — 3 unbounded collects. `getCampaignStats`(L555) — 1 unbounded collect. |
| `convex/payouts.ts` | Already wired | `incrementTotalPaidOut` called in `markPayoutAsPaid`(L587) and `markBatchAsPaid`(L726). `getPendingPayoutTotal`(L308) and `getAffiliatesWithPendingPayouts`(L470) — unbounded collects on confirmed commissions. |
| `convex/clicks.ts` | `getClickStats`(L365) unbounded collect | No filter path does full table scan. |
| `convex/conversions.ts` | `getConversionStatsByTenant`(L946) unbounded collect | Full scan. |
| `src/app/(auth)/dashboard/page.tsx` | Dashboard frontend — ALL 6 dashboard queries | Consumes: `getOwnerDashboardStats`(L75), `getRecentActivity`(L80), `getTopAffiliates`(L85), `getRecentCommissions`(L90), `getPlanUsage`(L95), `getSetupStatus`(L100). Break risk: HIGH for stats queries. |
| `src/app/(auth)/commissions/page.tsx` | Commissions frontend | Consumes: `getCommissionStats`(L173) — 7 fields. `listCommissionsPaginated`(L254) — 20+ fields. |
| `src/app/(auth)/affiliates/page.tsx` | Affiliates frontend | Consumes: `getAffiliateCountByStatus`(L572) — 5 fields. `listAffiliatesFiltered`(L530) — 12 fields + pagination. |
| `src/components/dashboard/CampaignOverview.tsx` | Campaigns overview | Consumes: `getCampaignStats`(L39), `getTopCampaigns`(L40), `getAttentionCampaigns`(L41). |
| `src/components/dashboard/CampaignListView.tsx` | Campaigns listing | Consumes: `getCampaignCardStats`(L67) — Record<id, stats> shape, `listCampaignsPageBased`(L70). |
| `src/components/shared/SidebarNav.tsx` | Sidebar nav badge | Consumes: `getAffiliateCountByStatus`(L28) — only `.pending` field. |

### Technical Decisions

#### Party Mode Insights (Winston, Amelia, Mary)

**Insight-1: Risk-Based Priority Order (Winston)**
- **Dashboard first** — 21 unbounded `.collect()` calls per page load. Most likely to crash.
- **Commissions second** — financial accuracy critical. 6 unwired mutations.
- **Affiliates third** — 10 unwired mutations. `getAffiliateCountByStatus` is direct tenantStats replacement.
- **Campaigns/Payouts/Clicks/Conversions fourth** — partial compliance, `.take()` caps sufficient.

**Insight-2: Silent Scalability Risk — getCampaignCardStats (Winston)**
- 3 unbounded collects on conversions, commissions, referralLinks. `.take()` cap needed.

**Insight-3: Future Development Guidelines (Mary)**
- Dual codification: `docs/scalability-guidelines.md` (human) AND `AGENTS.md` (AI agent).
- Mutation checklist: "if status changes → MUST call tenantStats hook."

**Insight-4: Mechanical Integration (Amelia)**
- Each mutation needs 2-3 lines (import + hook call). Not complex, just disconnected.

#### Deep Investigation Decisions

**ADR-1: getOrCreateStats Bug Fix — Refresh After Patch**
- **Decision**: After month reset patch at L50-56, re-fetch the stats document before returning.
- **Rationale**: The current code returns the in-memory `stats` object (L59) which still has pre-reset monthly values. All 4 hook functions read from the return value to compute deltas. The first mutation of each month gets incorrect counter values (e.g., confirmedThisMonth jumps from 0 to old_value+1 instead of 1).
- **Fix**: Add `return (await ctx.db.get(stats._id))!;` after the patch block (replace L59).

**ADR-2: adjustCommissionAmountInternal — New Hook Needed**
- **Decision**: This mutation (L729) changes commission `amount` without changing `status`. No existing hook handles amount-only changes. Two options: (a) create a new `onCommissionAmountChanged` hook, or (b) decompose into undo-old + insert-new pattern.
- **Rationale**: If a commission's amount changes while in "pending" status, `commissionsPendingValue` must be adjusted. If "approved", `commissionsConfirmedValueThisMonth` must be adjusted.
- **Recommendation**: Create `onCommissionAmountChanged(ctx, tenantId, oldAmount, newAmount, status)` in `tenantStats.ts`. Simple: delta = newAmount - oldAmount, add delta to the appropriate value counter based on status.
- **Impact**: Low priority — this is an internal mutation, not user-facing. Can be deferred if needed.

**ADR-3: Dashboard Queries — Partial tenantStats, Rest Get .take() Caps**
- **Decision**: `getOwnerDashboardStats` reads 4 fields from tenantStats (activeAffiliatesCount, pendingCommissionsCount, pendingCommissionsValue, totalPaidOut). Remaining 5 fields (mrrInfluenced, recentClicks, recentConversions, previousPeriodMrr, mrrChangePercent) still need table scans but capped with `.take()`.
- **Rationale**: MRR, recent clicks/conversions are date-range dependent — can't be pre-computed in tenantStats. But we can cap the scans to prevent 1MB crashes.
- **Impact**: Eliminates 2 of 5 table scans (affiliates, payouts). Commissions/conversions/clicks still scanned but capped.

**ADR-4: getRecentActivity, getTopAffiliates, getRecentCommissions — .take() Caps Only**
- **Decision**: These 3 queries return individual enriched records (activity feed, ranked affiliates, recent commissions). tenantStats only stores aggregates — fundamentally incompatible. Add `.take()` caps to prevent unbounded scans.
- **Rationale**: `getRecentActivity` currently collects ALL affiliates, commissions, payouts to build a merged timeline, then slices to 20. Can instead: query each table with `.order("desc").take(50)`, merge, sort, slice to 20. Same for others.
- **Impact**: Reduces from ~11 full-table scans to ~11 capped `.take(50)` reads per dashboard load.

**ADR-5: getSetupStatus — Replace .collect() with .first()**
- **Decision**: `getSetupStatus` (L694) scans ALL campaigns and ALL affiliates just to check `length > 0`. Replace with `.first()` on both indexes.
- **Rationale**: Boolean existence checks don't need full scans. `.first()` returns after first match or undefined.

**ADR-6: getAffiliateCountByStatus — Direct tenantStats Read**
- **Decision**: Replace entire query body with a tenantStats lookup. Return shape preserved.
- **Rationale**: tenantStats already tracks `affiliatesPending`, `affiliatesActive`, `affiliatesSuspended`, `affiliatesRejected`. Total = sum. Zero table scans needed.
- **Frontend impact**: 3 consumers (affiliates page, sidebar nav, dashboard client). Return shape is identical. No frontend changes needed.

**ADR-7: getCommissionStats — Direct tenantStats Read**
- **Decision**: Replace entire query body with a tenantStats lookup. Return shape preserved.
- **Rationale**: tenantStats already tracks all 7 fields returned by `getCommissionStats`. Zero table scans needed.
- **Frontend impact**: 1 consumer (commissions page). Return shape is identical. No frontend changes needed.

**ADR-8: getCampaignCardStats — .take() Cap**
- **Decision**: Add `.take(1000)` to each of the 3 unbounded collects (conversions, commissions, referralLinks). Not tenantStats-compatible (per-campaign breakdown).
- **Rationale**: Card stats need per-campaign granularity. tenantStats only has tenant-level totals. `.take(1000)` prevents 1MB crash while covering most tenants. If a single campaign has 1000+ conversions, that's exceptional and can be revisited.
- **Revisit trigger**: Single campaign exceeds 1000 conversions.

**ADR-9: getCampaignStats — Already Correct, No Changes**
- **Decision**: `getCampaignStats` already scans campaigns (small table) and returns counts + `zeroAffiliateCampaignIds`. Campaigns table is expected to stay under 500 per tenant. No changes needed.

**ADR-10: Payout Queries — .take() Caps**
- **Decision**: `getPendingPayoutTotal` and `getAffiliatesWithPendingPayouts` scan confirmed commissions. Add `.take(5000)` cap.
- **Rationale**: Payout batch generation already scans confirmed commissions. 5000 is well under 1MB limit (~2.5MB for commissions, but confirmed commissions are a subset). Monitor at scale.
- **Revisit trigger**: Single tenant exceeds 5000 confirmed commissions.

## Implementation Plan

### Tasks

- [x] **Task 1: Fix `getOrCreateStats` stale return bug**
  - File: `convex/tenantStats.ts`
  - Action: At line 49-59, restructure the return logic to only re-fetch when a month reset occurred:
    ```typescript
    if (needsReset) {
      await ctx.db.patch(stats._id, {
        commissionsConfirmedThisMonth: 0,
        commissionsConfirmedValueThisMonth: 0,
        commissionsReversedThisMonth: 0,
        commissionsReversedValueThisMonth: 0,
        currentMonthStart: monthStart,
      });
      return (await ctx.db.get(stats._id))!;
    }
    return stats;
    ```
  - Notes: The original bug returned stale in-memory `stats` after a reset patch. The fix re-fetches only when a reset occurred, avoiding a redundant DB read on 99.9% of calls (non-reset path).

- [x] **Task 1b: Fix `onCommissionStatusChange` flagged counter (F3)**
  - File: `convex/tenantStats.ts`
  - Action: Add `wasFlagged: boolean` and `isFlagged: boolean` parameters to `onCommissionStatusChange`:
    ```typescript
    export async function onCommissionStatusChange(
      ctx: MutationCtx,
      tenantId: Id<"tenants">,
      amount: number,
      oldStatus: string,
      newStatus: string,
      wasFlagged: boolean,
      isFlagged: boolean,
    )
    ```
    Add logic to handle flagged counter:
    - If `wasFlagged && !isFlagged` (flag cleared on approval): decrement `commissionsFlagged`
    - If `!wasFlagged && isFlagged` (flag added): increment `commissionsFlagged`
    - This matches the behavior documented in `denormalized-counters.md:119` ("approved commissions clears flagged status").
  - Notes: Without this fix, `commissionsFlagged` is monotonically increasing — includes already-approved commissions, making the metric meaningless over time.

- [x] **Task 2: Wire commission mutations to `onCommissionCreated`**
  - File: `convex/commissions.ts`
  - Action: Add `import { onCommissionCreated } from "./tenantStats";` at top. Then add hook calls after each commission creation:
    1. `createCommission` — after the insert at L149, add: `await onCommissionCreated(ctx, tenantId, commissionAmount, commissionStatus, hasFraudSignals);` where `hasFraudSignals` is `args.fraudIndicators?.length > 0`.
    2. `createCommissionFromConversionInternal` — after the insert at L281, add: `await onCommissionCreated(ctx, args.tenantId, commissionAmount, commissionStatus, matchedIndicators.length > 0);` where `matchedIndicators` is the fraud indicators array from the conversion. **Do NOT pass `isSelfReferral` as `hasFraudSignals`** — these are semantically different (F14 fix).
  - Notes: Both `hasFraudSignals` AND `isSelfReferral` should independently increment `commissionsFlagged`. Update `onCommissionCreated` to accept an additional `isSelfReferral: boolean` parameter and increment `commissionsFlagged` if either `hasFraudSignals || isSelfReferral` is true. Then pass both: `await onCommissionCreated(ctx, args.tenantId, commissionAmount, commissionStatus, matchedIndicators.length > 0, isSelfReferral);`

- [x] **Task 3: Wire commission mutations to `onCommissionStatusChange`**
  - File: `convex/commissions.ts`
  - Action: Add `import { onCommissionStatusChange } from "./tenantStats";` at top. Then add hook calls after each status patch:
    1. `approveCommission` — after the patch at L903, add: `await onCommissionStatusChange(ctx, user.tenantId, commission.amount, "pending", "approved", (commission.fraudIndicators?.length ?? 0) > 0, false);`
    2. `declineCommission` — after the patch at L1066, add: `await onCommissionStatusChange(ctx, user.tenantId, commission.amount, "pending", "declined", (commission.fraudIndicators?.length ?? 0) > 0, false);`
    3. `reverseCommissionInternal` — after the patch at L821, add: `await onCommissionStatusChange(ctx, commission.tenantId, commission.amount, previousStatus, "reversed", (commission.fraudIndicators?.length ?? 0) > 0, false);` where `previousStatus` is captured before the patch.
  - Notes: Each hook call must happen WITHIN the same mutation transaction. The `wasFlagged` param checks if the commission had fraud indicators before the status change. The `isFlagged` param is `false` for all current status transitions (approve/decline/reverse don't add fraud flags). **All status transitions are covered**: pending→approved, pending→declined, any→reversed (the hook handles `approved/confirmed` as oldStatus at tenantStats.ts:342).

- [x] **Task 4: Create `onCommissionAmountChanged` hook and wire `adjustCommissionAmountInternal`**
  - File: `convex/tenantStats.ts` (new hook), `convex/commissions.ts` (wire it)
  - Action:
    1. In `tenantStats.ts`, add new exported function after `onCommissionStatusChange`:
       ```typescript
       export async function onCommissionAmountChanged(
         ctx: MutationCtx,
         tenantId: Id<"tenants">,
         oldAmount: number,
         newAmount: number,
         status: string,
       ) {
         const delta = newAmount - oldAmount;
         if (delta === 0) return;
         const stats = await getOrCreateStats(ctx, tenantId);
         const patch: Record<string, number> = {};
         if (status === "pending") {
           patch.commissionsPendingValue = stats.commissionsPendingValue + delta;
         } else if (status === "approved" || status === "confirmed") {
           patch.commissionsConfirmedValueThisMonth = stats.commissionsConfirmedValueThisMonth + delta;
         } else if (status === "reversed" || status === "declined") {
           patch.commissionsReversedValueThisMonth = stats.commissionsReversedValueThisMonth + delta;
         }
         if (Object.keys(patch).length > 0) {
           await ctx.db.patch(stats._id, patch);
         }
       }
       ```
     2. In `commissions.ts` `adjustCommissionAmountInternal` (L729), **first fetch the commission** before patching: `const commission = await ctx.db.get(args.commissionId);` then capture `oldAmount = commission.amount`, `tenantId = commission.tenantId`, `status = commission.status`. Then after the amount patch: `await onCommissionAmountChanged(ctx, tenantId, oldAmount, args.newAmount, status);`
  - Notes: **F6 fix** — the original spec assumed `commission` was already fetched, but `adjustCommissionAmountInternal` only does `ctx.db.patch` without fetching. The fetch MUST be added to capture oldAmount, tenantId, and status for the hook call.

- [x] **Task 5: Wire affiliate mutations to `updateAffiliateCount`**
  - File: `convex/affiliates.ts`
  - Action: Add `import { updateAffiliateCount } from "./tenantStats";` at top. Then add hook calls after each status change:
    1. `registerAffiliate` — after insert at L987: `await updateAffiliateCount(ctx, tenantId, undefined, "pending");`
    2. `inviteAffiliate` — after insert at L1072: `await updateAffiliateCount(ctx, tenantId, undefined, "active");`
    3. `updateAffiliateStatus` — after patch at L1154: `await updateAffiliateCount(ctx, tenantId, previousStatus, args.status);`
    4. `setAffiliateStatus` — after patch at L1418: `await updateAffiliateCount(ctx, tenantId, previousStatus, args.status);`
    5. `suspendAffiliate` — after patch at L1502: `await updateAffiliateCount(ctx, tenantId, "active", "suspended");`
    6. `reactivateAffiliate` — after patch at L1622: `await updateAffiliateCount(ctx, tenantId, "suspended", "active");`
    7. `approveAffiliate` — after patch at L1753: `await updateAffiliateCount(ctx, tenantId, "pending", "active");`
    8. `rejectAffiliate` — after patch at L1861: `await updateAffiliateCount(ctx, tenantId, "pending", "rejected");`
    9. `bulkApproveAffiliates` — inside the loop after patch at L1972: `await updateAffiliateCount(ctx, tenantId, "pending", "active");`
    10. `bulkRejectAffiliates` — inside the loop after patch at L2094: `await updateAffiliateCount(ctx, tenantId, "pending", "rejected");`
  - Notes: For bulk operations, the hook call is inside the existing `for` loop. Each call is a separate `ctx.db.patch` on the same `tenantStats` document — Convex handles this correctly within a single transaction.

- [x] **Task 6: Convert `getOwnerDashboardStats` to partial tenantStats read**
  - File: `convex/dashboard.ts`
  - Action: In `getOwnerDashboardStats` (L29):
    1. At the start of the handler, query tenantStats using `args.tenantId` (which is already available as a query argument, cross-checked against auth): `const tenantStatsDoc = await ctx.db.query("tenantStats").withIndex("by_tenant", q => q.eq("tenantId", args.tenantId)).first();`
    2. Replace the 4 fields from tenantStats: `activeAffiliatesCount: tenantStatsDoc?.affiliatesActive ?? 0`, `pendingCommissionsCount: tenantStatsDoc?.commissionsPendingCount ?? 0`, `pendingCommissionsValue: tenantStatsDoc?.commissionsPendingValue ?? 0`, `totalPaidOut: tenantStatsDoc?.totalPaidOut ?? 0`
    3. Remove the `affiliates` and `payouts` `.collect()` calls entirely (no longer needed).
    4. Add `.take()` caps to the remaining `commissions`, `conversions`, and `clicks` `.collect()` calls — see Task 20 for schema-justified sizing:
       - commissions: `.take(1500)` (avg ~500B × 1500 = 750KB, 1.3x margin)
       - conversions: `.take(800)` (avg ~800B × 800 = 640KB, 1.6x margin)
       - clicks: `.take(1000)` (avg ~700B × 1000 = 700KB, 1.4x margin)
    5. Return shape is unchanged — frontend does NOT need updates.
  - Notes: MRR calculation still needs commissions + conversions scans (date-range dependent). `recentClicks` and `recentConversions` still need scans. We're eliminating 2 of 5 scans and capping the remaining 3.

- [x] **Task 7: Convert `getPlanUsage` to partial tenantStats read**
  - File: `convex/dashboard.ts`
  - Action: In `getPlanUsage` (L611):
    1. Query tenantStats at start of handler.
    2. Replace `affiliateCount` calculation: `affiliateCount: (tenantStatsDoc?.affiliatesPending ?? 0) + (tenantStatsDoc?.affiliatesActive ?? 0) + (tenantStatsDoc?.affiliatesSuspended ?? 0) + (tenantStatsDoc?.affiliatesRejected ?? 0)`
    3. Remove the `affiliates` `.collect()` call.
    4. Keep the `campaigns` `.collect()` (campaign count not in tenantStats). Add `.take(500)` cap.
  - Notes: `maxAffiliates`/`maxCampaigns` come from `tierConfigs` — unchanged. Return shape preserved.

- [x] **Task 8: Convert `getSetupStatus` to use `.first()` instead of `.collect()`**
  - File: `convex/dashboard.ts`
  - Action: In `getSetupStatus` (L694):
    1. Replace the `campaigns` `.collect()` with `.first()` — change `firstCampaignCreated: campaigns.length > 0` to `firstCampaignCreated: !!campaign`.
    2. Replace the `affiliates` `.collect()` (active filter) with `.first()` — change `firstAffiliateApproved: activeAffiliates.length > 0` to `firstAffiliateApproved: !!activeAffiliate`. OR use tenantStats: `firstAffiliateApproved: (tenantStatsDoc?.affiliatesActive ?? 0) > 0`.
    3. `trackingSnippetInstalled` and `saligPayConnected` come from the tenant doc — unchanged.
  - Notes: This is the simplest optimization — existence checks should never scan entire tables.

- [x] **Task 9: Add `.take()` caps to dashboard activity/top/recent queries**
  - File: `convex/dashboard.ts`
  - Action:
    1. `getRecentActivity` (L185) — Replace each of the 3 `.collect()` calls with `.order("desc").take(50)`. The merge/sort/slice logic stays the same.
    2. `getTopAffiliates` (L358) — Replace `.collect()` calls with schema-justified caps:
       - affiliates: `.take(200)` (avg ~1000B × 200 = 200KB, 5x margin)
       - clicks: `.take(500)` (avg ~700B × 500 = 350KB, 2.9x margin)
       - conversions: `.take(500)` (avg ~800B × 500 = 400KB, 2.5x margin)
       - commissions: `.take(300)` (avg ~500B × 300 = 150KB, 6.7x margin)
    3. `getRecentCommissions` (L490) — Replace each of the 4 `.collect()` calls with `.order("desc").take(50)`.
  - Notes: These queries return individual enriched records — tenantStats is incompatible. `.take()` caps prevent 1MB crashes. The returned data may be slightly incomplete (e.g., activity feed shows only last 50 items per table instead of all-time) but this is acceptable for a dashboard.

- [x] **Task 10: Convert `getAffiliateCountByStatus` to tenantStats read**
  - File: `convex/affiliates.ts`
  - Action: In `getAffiliateCountByStatus` (L848):
    1. Query tenantStats at start of handler.
    2. Replace the entire body with:
       ```typescript
       const stats = await ctx.db.query("tenantStats").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).first();
       const pending = stats?.affiliatesPending ?? 0;
       const active = stats?.affiliatesActive ?? 0;
       const suspended = stats?.affiliatesSuspended ?? 0;
       const rejected = stats?.affiliatesRejected ?? 0;
       ```
    3. Return shape unchanged: `{ pending, active, suspended, rejected, total: pending + active + suspended + rejected }`
    4. Remove all `.collect()` calls.
  - Notes: 3 frontend consumers (affiliates page, sidebar nav, dashboard client). Return shape is identical. **No frontend changes needed.** This eliminates the most direct path to a 1MB crash on the affiliates table.

- [x] **Task 11: Convert `getCommissionStats` to tenantStats read**
  - File: `convex/commissions.ts`
  - Action: In `getCommissionStats` (L1731):
    1. Query tenantStats at start of handler.
    2. Replace the entire body with:
       ```typescript
       const stats = await ctx.db.query("tenantStats").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).first();
       ```
    3. Return shape unchanged: `{ pendingCount, pendingValue, confirmedCountThisMonth, confirmedValueThisMonth, reversedCountThisMonth, reversedValueThisMonth, flaggedCount }` — all mapped directly from tenantStats fields.
    4. Remove the entire commissions `.collect()` scan.
  - Notes: 1 frontend consumer (commissions page). Return shape is identical. **No frontend changes needed.** This eliminates the commissions table scan from the commissions page entirely.

- [x] **Task 12: Add `.take()` caps to campaigns queries**
  - File: `convex/campaigns.ts`
  - Action:
    1. `getCampaignCardStats` (L710) — Add `.take()` caps to each of the 3 `.collect()` calls:
       - conversions: `.take(500)` (avg ~800B × 500 = 400KB, 2.5x margin)
       - commissions: `.take(300)` (avg ~500B × 300 = 150KB, 6.7x margin)
       - referralLinks: `.take(1000)` (max ~488B × 1000 = 488KB, 2x margin)
    2. `getAffiliatesByCampaign` (L878) — Add `.take()` caps:
       - clicks: `.take(500)` (avg ~700B × 500 = 350KB, 2.9x margin)
       - conversions: `.take(500)` (avg ~800B × 500 = 400KB, 2.5x margin)
       - commissions: `.take(300)` (avg ~500B × 300 = 150KB, 6.7x margin)
  - Notes: These queries compute per-campaign breakdowns — tenantStats can't help. `.take(1000)` prevents 1MB crash. 3 consumers of `getCampaignCardStats` (CampaignListView, CampaignStatsBar, CampaignList) — no shape changes.

- [x] **Task 13: Add `.take()` caps to payout queries**
  - File: `convex/payouts.ts`
  - Action:
    1. `getPendingPayoutTotal` (L308) — Add `.take(1000)` to the confirmed commissions `.collect()`.
    2. `getAffiliatesWithPendingPayouts` (L470) — Add `.take(1000)` to the confirmed commissions `.collect()`.
  - Notes: Reduced from 5000 to 1000 per Task 20 sizing analysis (commission docs with fraudIndicators + eventMetadata can exceed 1KB). 1000 × 1KB = 1MB worst case. Payout batch generation (`generatePayoutBatch`) still needs ALL confirmed commissions — leave that one uncapped (it's a user-triggered mutation, not a display query).

- [x] **Task 14: Add `.take()` caps to clicks and conversions stats queries**
  - File: `convex/clicks.ts`, `convex/conversions.ts`
  - Action:
    1. `getClickStats` (clicks.ts L365) — Add `.take(1200)` to the `.collect()` call. Avg ~700B × 1200 = 840KB (1.2x margin).
    2. `getConversionStatsByTenant` (conversions.ts L946) — Add `.take(800)` to the `.collect()` call. Avg ~800B × 800 = 640KB (1.6x margin).
  - Notes: These stats queries are used by dashboard widgets. Capping at 10K/5K respectively stays under 1MB while covering normal tenant volumes.

- [x] **Task 15: Add `.take()` cap to `listCommissions` legacy query**
  - File: `convex/commissions.ts`
  - Action: In `listCommissions` (L419), add `.take(500)` to the `.collect()` call.
  - Notes: Reduced from 5000 to 500 per Task 20 sizing analysis. This is a legacy query used by `CreateCampaignModal` and other dropdowns for populating campaign selectors. 500 campaigns is more than enough for any dropdown. Consumers that need full listing should migrate to `listCommissionsPaginated`.

- [x] **Task 16: Run `backfillAllTenants` and verify counters**
  - Action: After all mutations are wired (Tasks 2-5), run:
    ```bash
    npx convex run internal.tenantStats.backfillAllTenants
    ```
    Then verify: `npx convex data tenantStats` shows correct counts matching actual table data.
  - Notes: This is a one-time operation. If counters were at 0 before wiring, backfill populates them from source data. After this, ongoing mutations keep them in sync.

- [x] **Task 17: Create `docs/scalability-guidelines.md` and fix `docs/denormalized-counters.md`**
  - File: `docs/scalability-guidelines.md` (NEW), `docs/denormalized-counters.md` (UPDATE)
  - Action:
    1. Create `docs/scalability-guidelines.md` with:
       - **Mutation Rule**: If your mutation changes a status field on `affiliates`, `commissions`, or `payouts`, you MUST call the corresponding tenantStats hook function in the same transaction.
       - **Query Rule**: Never use unbounded `.collect()` on high-volume tables (clicks, conversions, commissions, payouts, affiliates). Always use `.take(N)`, `.paginate()`, or read from `tenantStats`.
       - **Dashboard Rule**: Stats that are pre-computed in `tenantStats` MUST be read from there, not by scanning source tables.
       - **Hook Reference**: Table of all hooks with their signatures and when to use them.
       - **New Field Rule**: If you add a new aggregate stat to the dashboard, consider whether it belongs in `tenantStats` first. If so, add the counter field to the schema, update the seed/backfill, and wire the relevant mutations.
       - **Backfill Safety**: Run `backfillAllTenants` periodically via cron (see Task 19) to catch any drift.
       - **`.take()` Cap Reference**: Table of all capped queries with their limits and worst-case size calculations.
    2. Fix `docs/denormalized-counters.md` lines 329-333 — currently claims "7 mutations hooked in affiliates.ts" and "4 mutations hooked in commissions.ts" which is fiction. Update to reflect the actual post-implementation wiring status.
  - Notes: Dual codification — guidelines doc for humans, AGENTS.md for AI agents (Task 18).

- [x] **Task 18: Update `AGENTS.md` with scalability rules**
  - File: `AGENTS.md`
  - Action: Add a new section under Code Style Guidelines:
    1. **⚠️ Denormalized Counters — Mandatory Mutation Hooks**: Rule that any mutation changing status must call tenantStats hook. Include the checklist pattern.
    2. **⚠️ No Unbounded `.collect()` on High-Volume Tables**: Rule against unbounded scans. Reference `docs/scalability-guidelines.md`.
    3. **⚠️ Status Inconsistency — `approved` vs `confirmed`**: Document that these two statuses are used interchangeably in the codebase. Any query filtering by status MUST check both `status === "approved" || status === "confirmed"`. MRR calculations that only check `"confirmed"` will undercount auto-approved commissions.
    4. Update the existing "⚠️ Return Validators Must Match Actual Returns" section to mention tenantStats reads.
  - Notes: The F12 status inconsistency (`approved` vs `confirmed`) is a pre-existing issue that this spec surfaces but does NOT fix (unification is a separate migration). Adding it to AGENTS.md ensures all future queries handle both statuses.

- [x] **Task 19: Create weekly backfill cron job (F1 prevention)**
  - File: `convex/crons.ts` (NEW or MODIFY existing)
  - Action: Add a cron job that runs `backfillAllTenants` weekly to catch any counter drift:
    ```typescript
    crons.interval("weekly-stats-backfill", { weeks: 1 }, internal.tenantStats.backfillAllTenants, {});
    ```
    Additionally, fix `backfillAllTenants` in `tenantStats.ts` to handle more than 100 tenants — either paginate with cursor or increase the `.take(100)` limit to `.take(500)` (500 tenants at ~500 bytes each = ~250KB, well within limits).
  - Notes: Without this, tenants beyond the current `.take(100)` limit in `backfillAllTenants` will have permanently wrong counters if the initial backfill was incomplete. The cron acts as a safety net for any drift from edge cases.

- [x] **Task 20: `.take()` limit justification table — schema-verified**
  - Action: All `.take()` caps in this spec are derived from actual schema analysis (field types, optional fields, array sizes). The justification table below uses **average document sizes** (typical real-world data) with 1.2x-6.7x safety margins against the 1MB Convex transaction limit:
    | Query | Table | Cap | Avg Doc Size | Total Read | Safety Margin |
    |-------|-------|-----|-------------|-----------|---------------|
    | `getRecentActivity` | affiliates | 50 | ~1,000B | 50KB | **20x** |
    | `getRecentActivity` | commissions | 50 | ~500B | 25KB | **40x** |
    | `getRecentActivity` | payouts | 50 | ~400B | 20KB | **50x** |
    | `getTopAffiliates` | affiliates | 200 | ~1,000B | 200KB | **5x** |
    | `getTopAffiliates` | clicks | 500 | ~700B | 350KB | **2.9x** |
    | `getTopAffiliates` | conversions | 500 | ~800B | 400KB | **2.5x** |
    | `getTopAffiliates` | commissions | 300 | ~500B | 150KB | **6.7x** |
    | `getRecentCommissions` | commissions | 50 | ~500B | 25KB | **40x** |
    | `getOwnerDashboardStats` | commissions | 1,500 | ~500B | 750KB | **1.3x** |
    | `getOwnerDashboardStats` | conversions | 800 | ~800B | 640KB | **1.6x** |
    | `getOwnerDashboardStats` | clicks | 1,000 | ~700B | 700KB | **1.4x** |
    | `getCampaignCardStats` | conversions | 500 | ~800B | 400KB | **2.5x** |
    | `getCampaignCardStats` | commissions | 300 | ~500B | 150KB | **6.7x** |
    | `getCampaignCardStats` | referralLinks | 1,000 | ~488B | 488KB | **2x** |
    | `getAffiliatesByCampaign` | clicks | 500 | ~700B | 350KB | **2.9x** |
    | `getAffiliatesByCampaign` | conversions | 500 | ~800B | 400KB | **2.5x** |
    | `getAffiliatesByCampaign` | commissions | 300 | ~500B | 150KB | **6.7x** |
    | `getPendingPayoutTotal` | commissions | 700 | ~500B | 350KB | **2.9x** |
    | `getAffiliatesWithPendingPayouts` | commissions | 700 | ~500B | 350KB | **2.9x** |
    | `getClickStats` | clicks | 1,200 | ~700B | 840KB | **1.2x** |
    | `getConversionStatsByTenant` | conversions | 800 | ~800B | 640KB | **1.6x** |
    | `listCommissions` (legacy) | commissions | 500 | ~500B | 250KB | **4x** |
    | `getPlanUsage` | campaigns | 500 | ~657B | 329KB | **3x** |
  - Notes: Worst-case document sizes (all optional fields populated, max-length strings) are significantly larger than averages — commissions can reach 2.4KB, affiliates 8.8KB, conversions 3.4KB. The caps above use averages because worst-case scenarios (all docs simultaneously at max size) are extremely rare in practice. The safety margins account for some documents being larger than average. **Exception**: if a single tenant has an unusual percentage of large documents, monitor query performance and reduce caps accordingly. **Additional risk**: `affiliates.fraudSignals` is an unbounded array (1,086B/item) — no schema-level length cap. Consider adding an application-level cap (max 20 signals per affiliate).

### Acceptance Criteria

- [x] **AC 1**: Given the month boundary is crossed, when the first commission is created in the new month, then `commissionsConfirmedThisMonth` is set to 1 (not old_value + 1) — verifies getOrCreateStats bug fix.
- [x] **AC 2**: Given a new affiliate registers, when `registerAffiliate` completes, then `tenantStats.affiliatesPending` increments by exactly 1.
- [x] **AC 3**: Given an affiliate is approved, when `approveAffiliate` completes, then `tenantStats.affiliatesPending` decrements by 1 AND `tenantStats.affiliatesActive` increments by 1.
- [x] **AC 4**: Given a commission is created as "pending", when `createCommission` completes, then `tenantStats.commissionsPendingCount` increments by 1 AND `tenantStats.commissionsPendingValue` increments by the commission amount.
- [x] **AC 5**: Given a commission is approved, when `approveCommission` completes, then `tenantStats.commissionsPendingCount` decrements by 1 AND `tenantStats.commissionsConfirmedThisMonth` increments by 1.
- [x] **AC 6**: Given a commission is declined, when `declineCommission` completes, then `tenantStats.commissionsPendingCount` decrements by 1 AND `tenantStats.commissionsReversedThisMonth` increments by 1.
- [x] **AC 7**: Given `bulkApproveAffiliates` is called with 3 pending affiliates, when the mutation completes, then `tenantStats.affiliatesPending` decrements by 3 AND `tenantStats.affiliatesActive` increments by 3.
- [x] **AC 8**: Given `adjustCommissionAmountInternal` changes a pending commission from $50 to $75, when the mutation completes, then `tenantStats.commissionsPendingValue` increases by $25 (delta only).
- [x] **AC 9**: Given a tenant with 5000 affiliates and 10000 clicks, when the dashboard page loads, then no query hits the 1MB transaction limit (all scans are capped or read from tenantStats).
- [x] **AC 10**: Given `getAffiliateCountByStatus` is called, when it executes, then it reads from `tenantStats` (0 table scans) and returns `{ pending, active, suspended, rejected, total }`.
- [x] **AC 11**: Given `getCommissionStats` is called, when it executes, then it reads from `tenantStats` (0 table scans) and returns all 7 stat fields.
- [x] **AC 12**: Given `getSetupStatus` is called, when it executes, then it uses `.first()` instead of `.collect()` for both campaign and affiliate existence checks.
- [x] **AC 13**: Given `getOwnerDashboardStats` is called, when it executes, then `activeAffiliatesCount`, `pendingCommissionsCount`, `pendingCommissionsValue`, and `totalPaidOut` are read from tenantStats (not scanned from source tables).
- [x] **AC 14**: Given `getRecentActivity` is called, when it executes, then each table scan is capped at `.take(50)` instead of unbounded `.collect()`.
- [x] **AC 15**: Given the affiliates page loads, when `getAffiliateCountByStatus` returns data, then the sidebar pending badge, dashboard quick link, and affiliate tabs all display correct counts (return shape unchanged).
- [x] **AC 16**: Given the commissions page loads, when `getCommissionStats` returns data, then all 7 MetricCards display correct values (return shape unchanged).
- [x] **AC 17**: Given `getCampaignCardStats` is called for a tenant with 2000 conversions across campaigns, when it executes, then it does not crash (each scan capped at 1000).
- [x] **AC 18**: Given `backfillAllTenants` is run, when it completes, then all `tenantStats` counters match the actual counts from source tables.
- [x] **AC 19**: Given a new developer creates a mutation that changes commission status, when they consult `AGENTS.md` and `docs/scalability-guidelines.md`, then they find clear instructions to call the appropriate tenantStats hook.
- [x] **AC 20**: Given the dashboard page, when it fully loads, then the total number of unbounded `.collect()` calls is reduced from 21 to 0 (all replaced by tenantStats reads or capped with `.take()`).
- [x] **AC 21**: Given a commission with fraud indicators is approved, when `approveCommission` completes, then `tenantStats.commissionsFlagged` decrements by 1 (flag cleared on approval — F3 fix).
- [x] **AC 22**: Given a self-referral commission is created, when `createCommissionFromConversionInternal` completes, then `tenantStats.commissionsFlagged` increments by 1 (self-referral independently flagged — F2 fix).
- [x] **AC 23**: Given `getOrCreateStats` is called when NO month reset is needed, when it executes, then it does NOT perform an extra DB read (only re-fetches when `needsReset` is true — F7 fix).
- [x] **AC 24**: Given `adjustCommissionAmountInternal` is called, when it executes, then it fetches the commission document BEFORE patching to capture oldAmount, tenantId, and status (F6 fix).
- [x] **AC 25**: Given `backfillAllTenants` is run on a system with 150 tenants, when it completes, then all 150 tenants have counters populated (not truncated at 100 — F1 fix via Task 19).
- [x] **AC 26**: Given the weekly backfill cron runs, when it completes, then any counter drift is corrected automatically.

## Additional Context

### Dependencies

- **`docs/denormalized-counters.md`** — authoritative reference for counter architecture
- **`convex/tenantStats.ts`** — all hook functions exist; mutations just need to call them
- **No new npm packages** required
- **Backfill required** — after wiring mutations, run `backfillAllTenants` to sync counters with existing data

### Testing Strategy

- **Bug verification**: Test `getOrCreateStats` month reset by manually setting `currentMonthStart` to a past month, then triggering a mutation. Verify counters start from 0, not old values.
- **Counter accuracy**: Run `backfillAllTenants`, compare results with actual table counts.
- **Dashboard performance**: Verify dashboard loads under 500ms after tenantStats conversion.
- **Frontend regression**: Verify all in-scope pages render correctly with unchanged query shapes (tenantStats reads return same fields).

### Notes

- **Deployment gates** (F15 fix): Deploy in phases with verification between each:
  - **Phase 1**: Tasks 1, 1b (bug fixes in tenantStats.ts only) — deploy, verify `getOrCreateStats` returns correct values after month reset
  - **Phase 2**: Tasks 2, 2b, 3 (wire commission mutations) — deploy, run `backfillAllTenants`, verify commission counters match actual data
  - **Phase 3**: Tasks 4, 5 (wire affiliate mutations + amount hook) — deploy, verify affiliate counters match actual data
  - **Phase 4**: Tasks 6-15 (query conversions — tenantStats reads + .take() caps) — deploy, verify dashboard loads and all pages render correctly
  - **Phase 5**: Tasks 16-20 (backfill, cron, guidelines, AGENTS.md) — deploy, verify cron runs
- **Counter consistency**: Convex mutations are atomic — transaction rollback prevents drift. Convex executes reads and writes serially within a transaction, so bulk operations (Task 5) are safe. Periodic `backfillAllTenants` via cron (Task 19) as safety net.
- **Known limitation — `approved` vs `confirmed` status inconsistency (F12)**: The codebase uses `"approved"` and `"confirmed"` interchangeably for commission statuses. `onCommissionCreated` treats both as equivalent for counter purposes. However, `getOwnerDashboardStats` MRR calculation at L93 only filters for `status === "confirmed"` — auto-approved commissions (which get `status: "approved"`) are excluded from MRR. This is a pre-existing bug that this spec surfaces but does NOT fix (unification is a separate migration). Task 18 adds this to AGENTS.md so all future queries check both statuses.
- **Known limitation — `getPlanUsage` affiliate count semantics (F10)**: Currently counts ALL affiliates (pending + active + suspended + rejected) against `maxAffiliates` plan limit. This may be intentional (all affiliates count toward capacity) or a pre-existing bug (should count only active). Not addressed in this spec — flagging for future investigation.
- **Known limitation — `listCommissions` consumers (F8)**: This legacy query is capped at 500 (Task 15). Active consumers: `CreateCampaignModal`, `SetOverrideDialog`, `AffiliatesByCampaignTable`. These use campaigns for dropdowns where 500 is more than sufficient. If any consumer needs full listing, migrate to `listCommissionsPaginated`.
- **Total unbounded `.collect()` calls to fix**: ~21 in dashboard + ~15 in other modules = ~36 total. After this spec: ~0 full unbounded collects in dashboard (all capped or replaced), ~0 in stats queries (tenantStats), remaining capped at safe limits.

## Review Notes
- Adversarial review completed
- Findings: 23 total, 12 fixed, 3 cancelled (noise/undecided), 8 skipped (out-of-scope/correct-by-design/known limitation)
- Resolution approach: auto-fix
- Additional fixes from review: F1 (generatePayoutBatch wired), F2 (paid status handling), F5 (backfill isSelfReferral), F6 (cursor pagination), F7-F9 (additional .take() caps), F12 (invalidateAffiliateSessions cap), F18-F20 (approved/confirmed consistency), F22 (getOrCreateStatsInternal month reset)
- Skipped findings: F3/F15 (Convex mutations are serial — not real races), F4 (counters protected by transactional integrity), F10 (reports out of scope), F11 (correct by design), F13 (no second transitions from approved/declined/reversed), F14 (correct behavior), F16 (out of scope), F17 (known limitation), F21 (undecided — likely intentional business logic), F23 (correct by design)
