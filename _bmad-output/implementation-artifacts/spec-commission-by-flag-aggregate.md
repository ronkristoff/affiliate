---
title: 'Add commissionByFlagAggregate to eliminate tenantStats dependency'
type: 'refactor'
created: '2026-04-18'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** `commissionsFlagged` was the last field on `tenantStats` that couldn't be derived from aggregates, forcing `getStats()`, `getAggregatePlatformKPIs()`, and `getTenantLeaderboard()` to read from the stale denormalized `tenantStats` table.

**Approach:** Create a `commissionByFlagAggregate` with a derived boolean sort key (`isFlagged = fraudIndicators.length > 0 || isSelfReferral === true`) and update all three consumer queries to use it. Rewrite `getTenantLeaderboard()` to read entirely from aggregates.

## Suggested Review Order

1. [convex/aggregates.ts](convex/aggregates.ts) — New `commissionByFlagAggregate` definition with derived sort key
2. [convex/triggers.ts](convex/triggers.ts) — Third trigger registered on `commissions` table
3. [convex/tenantStats.ts:139](convex/tenantStats.ts) — `getStats()` now reads `commissionsFlagged` from aggregate (only `lastDegradedAt` remains from tenantStats)
4. [convex/admin/platformStats.ts](convex/admin/platformStats.ts) — `getAggregatePlatformKPIs()` and `getTenantLeaderboard()` fully aggregate-driven
5. [convex/notifications.ts:16](convex/notifications.ts) — Import fix: `mutation`/`internalMutation` from `./triggers`

## Verification

**Commands:**
- `pnpm tsc --noEmit` — expected: no errors
- `pnpm convex run aggregates:backfillAll --typecheck=disable -- '{}'` — required after deploy to index existing commissions
