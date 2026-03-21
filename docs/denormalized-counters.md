# Denormalized Counters — Architecture Guide

## What Are Denormalized Counters?

Denormalized counters are **pre-computed aggregate values** stored in a dedicated table (`tenantStats`) so that dashboard and stats queries can read them in O(1) instead of scanning entire tables.

### Normalized vs Denormalized

**Normalized** (scan the source of truth every time):
```typescript
// To answer "how many pending commissions?"
const allCommissions = await ctx.db.query("commissions")...collect();
const pendingCount = allCommissions.filter(c => c.status === "pending").length;
// O(n) — reads every commission document into memory
```

**Denormalized** (read a cached answer):
```typescript
// Same question, answered instantly
const pendingCount = tenantStats.commissionsPendingCount;
// O(1) — reads one number from one document
```

The `tenantStats` table is **not** the source of truth. The `commissions`, `affiliates`, and `payouts` tables are. The counters are a cached copy of aggregate data that mutations keep in sync.

### The Analogy

Think of a store's inventory:

- **Normalized**: Count every item on every shelf to know how many you have. Always accurate, but slow.
- **Denormalized**: A whiteboard on the wall that says "Widget count: 47". Instant to read, but someone must update the whiteboard every time stock changes.

Our `tenantStats` document is that whiteboard.

---

## Why We Need This

### Convex Has a Hard Limit: 1MB Per Transaction

Every Convex query/mutation runs as a single database transaction. Convex enforces a **1MB read limit per transaction**. If a single function reads more than 1MB of document data, it crashes with `Transaction is too large`.

A single commission document is roughly 300-500 bytes:

| Commissions | Memory Read | Status |
|-------------|-------------|--------|
| 1,000 | ~400KB | Works |
| 2,000 | ~800KB | Close to limit |
| 3,000 | ~1.2MB | **Crashes** |

### The Dashboard Was the Worst Offender

`getOwnerDashboardStats` did 5 separate `.collect()` calls in ONE function:

```typescript
const affiliates = await ctx.db.query("affiliates")...collect();     // ~200KB
const allCommissions = await ctx.db.query("commissions")...collect(); // ~800KB
const allConversions = await ctx.db.query("conversions")...collect(); // ~400KB
const payouts = await ctx.db.query("payouts")...collect();            // ~100KB
const clicks = await ctx.db.query("clicks")...collect();              // ~2MB
// Total: ~3.5MB in one transaction → CRASHES
```

A tenant with just 10,000 clicks (very common for a running affiliate program) would make the dashboard completely unusable. Not slow — **broken**. The page wouldn't load at all.

### What Denormalized Counters Fix

The dashboard now reads **1 document** (~500 bytes) instead of scanning 5 tables. It scales from 100 records to 10 million records with the same performance.

---

## The Schema

### Table: `tenantStats`

One document per tenant with counters updated atomically by mutations:

```typescript
tenantStats: defineTable({
  tenantId: v.id("tenants"),

  // Affiliate counts by status
  affiliatesPending: v.number(),
  affiliatesActive: v.number(),
  affiliatesSuspended: v.number(),
  affiliatesRejected: v.number(),

  // Commission stats
  commissionsPendingCount: v.number(),
  commissionsPendingValue: v.number(),
  commissionsConfirmedThisMonth: v.number(),
  commissionsConfirmedValueThisMonth: v.number(),
  commissionsReversedThisMonth: v.number(),
  commissionsReversedValueThisMonth: v.number(),
  commissionsFlagged: v.number(),

  // Payout stats
  totalPaidOut: v.number(),

  // Timestamp for month-boundary resets
  currentMonthStart: v.number(),
}).index("by_tenant", ["tenantId"]),
```

### Field Reference

| Counter | Type | Description | Updated By |
|---------|------|-------------|------------|
| `affiliatesPending` | number | Affiliates awaiting approval | create, approve, reject |
| `affiliatesActive` | number | Active affiliates | approve, suspend, reactivate |
| `affiliatesSuspended` | number | Suspended affiliates | suspend, reactivate |
| `affiliatesRejected` | number | Rejected affiliate applications | reject |
| `commissionsPendingCount` | number | Number of pending commissions | create, approve, decline |
| `commissionsPendingValue` | number | Total $ value of pending commissions | create, approve, decline |
| `commissionsConfirmedThisMonth` | number | Approved commissions this month | create (auto), approve |
| `commissionsConfirmedValueThisMonth` | number | Total $ value of confirmed this month | create (auto), approve |
| `commissionsReversedThisMonth` | number | Reversed/declined commissions this month | decline |
| `commissionsReversedValueThisMonth` | number | Total $ value of reversed this month | decline |
| `commissionsFlagged` | number | Commissions with fraud signals | create (fraud), approve (clears) |
| `totalPaidOut` | number | Lifetime paid out amount | mark batch paid |
| `currentMonthStart` | number | Timestamp of current month start | auto (month reset) |

---

## Lifecycle

### 1. Creation

#### New Tenants: `seedStats`

When a new tenant signs up, call `seedStats` to create a zeroed-out document:

```typescript
// In your tenant creation mutation, after inserting the tenant:
await ctx.runMutation(internal.tenantStats.seedStats, {
  tenantId: newTenantId,
});
```

Creates:
```json
{
  "tenantId": "kx74cnbs...",
  "affiliatesPending": 0,
  "affiliatesActive": 0,
  "affiliatesSuspended": 0,
  "affiliatesRejected": 0,
  "commissionsPendingCount": 0,
  "commissionsPendingValue": 0,
  "commissionsConfirmedThisMonth": 0,
  "commissionsConfirmedValueThisMonth": 0,
  "commissionsReversedThisMonth": 0,
  "commissionsReversedValueThisMonth": 0,
  "commissionsFlagged": 0,
  "totalPaidOut": 0,
  "currentMonthStart": 1772323200000
}
```

#### Existing Tenants: `backfillStats`

For tenants that already have data, run `backfillAllTenants` to compute initial counters from actual records:

```typescript
// Run once after deploying the tenantStats feature
await ctx.runMutation(internal.tenantStats.backfillAllTenants, {});
```

This scans the affiliates, commissions, and payouts tables **once** and populates the counters. After this, no more full scans are needed.

### 2. Updates (Mutation Hooks)

Every time a mutation changes something that affects a counter, the counter must be updated atomically within the same transaction.

#### Affiliate Status Changes

| Mutation | What Happens | Counter Update |
|----------|-------------|----------------|
| `registerAffiliate` | New affiliate created as "pending" | `affiliatesPending += 1` |
| `approveAffiliate` | Status "pending" → "active" | `affiliatesPending -= 1`, `affiliatesActive += 1` |
| `rejectAffiliate` | Status "X" → "rejected" | `affiliatesX -= 1`, `affiliatesRejected += 1` |
| `suspendAffiliate` | Status "active" → "suspended" | `affiliatesActive -= 1`, `affiliatesSuspended += 1` |
| `reactivateAffiliate` | Status "suspended" → "active" | `affiliatesSuspended -= 1`, `affiliatesActive += 1` |
| `bulkApproveAffiliates` | Each "pending" → "active" | `affiliatesPending -= 1`, `affiliatesActive += 1` (per affiliate) |
| `bulkRejectAffiliates` | Each "X" → "rejected" | `affiliatesX -= 1`, `affiliatesRejected += 1` (per affiliate) |

#### Commission Lifecycle

| Mutation | What Happens | Counter Update |
|----------|-------------|----------------|
| `createCommission` | New commission (usually "pending") | `commissionsPendingCount += 1`, `commissionsPendingValue += amount` |
| `createCommission` (auto-approved) | New commission with "approved" status | `commissionsConfirmedThisMonth += 1`, `commissionsConfirmedValueThisMonth += amount` |
| `createCommission` (fraud detected) | New flagged commission | `commissionsFlagged += 1` |
| `approveCommission` | Status "pending" → "approved" | `pending -= 1`, `confirmed += 1` (swap counters) |
| `declineCommission` | Status "pending" → "declined" | `pending -= 1`, `reversed += 1` |
| `bulkApproveCommissions` | Each "pending" → "approved" | Swap pending→confirmed per commission |

#### Payouts

| Mutation | What Happens | Counter Update |
|----------|-------------|----------------|
| `markBatchAsPaid` | Batch marked as paid | `totalPaidOut += batchAmount` |

#### Code Pattern

Every counter update follows the same pattern — read current value, compute new value, patch:

```typescript
// From convex/tenantStats.ts — onCommissionStatusChange
export async function onCommissionStatusChange(
  ctx, tenantId, amount, oldStatus, newStatus, wasFlagged, isFlagged
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  const patch: Record<string, number> = {};

  // Undo old status
  if (oldStatus === "pending") {
    patch.commissionsPendingCount = stats.commissionsPendingCount - 1;
    patch.commissionsPendingValue = stats.commissionsPendingValue - amount;
  }

  // Apply new status
  if (newStatus === "approved") {
    patch.commissionsConfirmedThisMonth = stats.commissionsConfirmedThisMonth + 1;
    patch.commissionsConfirmedValueThisMonth = stats.commissionsConfirmedValueThisMonth + amount;
  }

  await ctx.db.patch(stats._id, patch);
}
```

### 3. Querying

Three queries now read from `tenantStats` instead of scanning tables.

#### `dashboard.getOwnerDashboardStats`

**Before** (5 table scans, ~3.5MB):
```typescript
const affiliates = await ctx.db.query("affiliates")...collect();
const commissions = await ctx.db.query("commissions")...collect();
const conversions = await ctx.db.query("conversions")...collect();
const payouts = await ctx.db.query("payouts")...collect();
const clicks = await ctx.db.query("clicks")...collect();
```

**After** (1 document read, ~500 bytes):
```typescript
const tenantStats = await ctx.db.query("tenantStats")
  .withIndex("by_tenant", q => q.eq("tenantId", tenantId))
  .first();

return {
  activeAffiliatesCount: tenantStats.affiliatesActive,
  pendingCommissionsCount: tenantStats.commissionsPendingCount,
  pendingCommissionsValue: tenantStats.commissionsPendingValue,
  totalPaidOut: tenantStats.totalPaidOut,
  // MRR still needs commission/conversion reads (date-range dependent)
};
```

#### `commissions.getCommissionStats`

**Before**: Scanned all commissions, filtered by status, computed month boundaries.

**After**:
```typescript
const tenantStats = await ctx.db.query("tenantStats")...first();

return {
  pendingCount: tenantStats.commissionsPendingCount,
  pendingValue: tenantStats.commissionsPendingValue,
  confirmedCountThisMonth: tenantStats.commissionsConfirmedThisMonth,
  confirmedValueThisMonth: tenantStats.commissionsConfirmedValueThisMonth,
  reversedCountThisMonth: tenantStats.commissionsReversedThisMonth,
  reversedValueThisMonth: tenantStats.commissionsReversedValueThisMonth,
  flaggedCount: tenantStats.commissionsFlagged,
};
```

#### `affiliates.getAffiliateCountByStatus`

**Before**: Scanned all affiliates, counted by status.

**After**:
```typescript
const tenantStats = await ctx.db.query("tenantStats")...first();

return {
  pending: tenantStats.affiliatesPending,
  active: tenantStats.affiliatesActive,
  suspended: tenantStats.affiliatesSuspended,
  rejected: tenantStats.affiliatesRejected,
  total: pending + active + suspended + rejected,
};
```

---

## Monthly Counter Auto-Reset

The "this month" counters (`commissionsConfirmedThisMonth`, `commissionsReversedThisMonth`, etc.) need to reset when the month changes. This happens **lazily** — the next mutation that touches the stats detects the month boundary and resets:

```typescript
// In getOrCreateStats (called by every counter update)
const monthStart = getMonthStart(); // First day of current month as timestamp
if (stats.currentMonthStart < monthStart) {
  // Month changed! Reset monthly counters
  await ctx.db.patch(stats._id, {
    commissionsConfirmedThisMonth: 0,
    commissionsConfirmedValueThisMonth: 0,
    commissionsReversedThisMonth: 0,
    commissionsReversedValueThisMonth: 0,
    currentMonthStart: monthStart,
  });
}
```

The query-side (`getStats`) also detects stale monthly counters and returns 0 for them, so even if no mutation has run yet in the new month, the dashboard shows correct values.

---

## Files Reference

| File | Purpose |
|------|---------|
| `convex/schema.ts` | `tenantStats` table definition |
| `convex/tenantStats.ts` | Helper functions, seed, backfill, internal query |
| `convex/affiliates.ts` | 7 mutations hooked with `updateAffiliateStatus` / `incrementAffiliateCount` |
| `convex/commissions.ts` | 4 mutations hooked with `onCommissionCreated` / `onCommissionStatusChange` |
| `convex/dashboard.ts` | `getOwnerDashboardStats` reads from `tenantStats` |
| `convex/commissions.ts` | `getCommissionStats` reads from `tenantStats` |
| `convex/affiliates.ts` | `getAffiliateCountByStatus` reads from `tenantStats` |

---

## Scale Impact

| Metric | Before (Normalized) | After (Denormalized) |
|--------|-------------------|---------------------|
| Dashboard load | ~5MB reads (crashes at 1MB) | ~1KB read (scales infinitely) |
| Commission stats | ~2000 docs scanned | 1 doc read |
| Affiliate counts | ~5000 docs scanned | 1 doc read |
| Write cost | 1 mutation | 1 mutation + 1 counter patch |
| Storage overhead | 0 | ~500 bytes per tenant |

---

## Tradeoffs

| Aspect | Normalized (scan tables) | Denormalized (counters) |
|--------|------------------------|------------------------|
| Read speed | O(n) — slow at scale | O(1) — always instant |
| Write complexity | Simple (just insert/patch) | Slightly more (insert + update counter) |
| Data consistency | Always consistent | Could drift if a mutation fails mid-way |
| Storage | No extra | One extra document per tenant |

### Consistency Risk

If `approveCommission` updates the commission but crashes before updating the counter, they'd be out of sync. In practice, Convex mutations are **atomic** — if one `ctx.db.patch` fails, the whole transaction rolls back, so this risk is minimal.

For extra safety, you could run `backfillAllTenants` periodically (e.g., daily cron job) to recompute counters from source data and fix any drift.

### What's NOT Denormalized

Some queries still scan tables because they depend on user-selected date ranges:

- **MRR calculation** — depends on the user's selected date range, can't be pre-computed
- **Recent clicks/conversions** — depends on "last 30 days" rolling window
- **DataTable pagination** — the actual page of data must come from the source tables

These use `.take()` capped reads as a safety net instead.

---

## Operations

### Backfill All Tenants

Run once after deploying, or periodically for drift correction:

```bash
npx convex run internal.tenantStats.backfillAllTenants
```

### Backfill Single Tenant

```bash
npx convex run internal.tenantStats.backfillStats '{"tenantId":"kx74cnbs..."}'
```

### Seed New Tenant

Call during tenant creation:

```typescript
await ctx.runMutation(internal.tenantStats.seedStats, { tenantId: newTenantId });
```

### Verify Counters

```bash
npx convex data tenantStats
```
