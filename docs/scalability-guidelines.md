# Scalability Guidelines

_This document codifies enforceable rules for all future development to prevent Convex's 1MB transaction limit crashes._

---

## Core Rules

### Rule 1: Mutation Hooks — Mandatory

If your mutation changes a **status field** on `affiliates`, `commissions`, or `payouts`, you **MUST** call the corresponding `tenantStats` hook function **in the same transaction** (same mutation handler).

| Table | Status Change | Hook Function | Location |
|-------|--------------|---------------|----------|
| `affiliates` | Any status change | `updateAffiliateCount(ctx, tenantId, oldStatus, newStatus)` | `convex/tenantStats.ts` |
| `commissions` | Created | `onCommissionCreated(ctx, tenantId, amount, status, hasFraudSignals, isSelfReferral)` | `convex/tenantStats.ts` |
| `commissions` | Status change | `onCommissionStatusChange(ctx, tenantId, amount, oldStatus, newStatus, wasFlagged, isFlagged)` | `convex/tenantStats.ts` |
| `commissions` | Amount change (no status) | `onCommissionAmountChanged(ctx, tenantId, oldAmount, newAmount, status)` | `convex/tenantStats.ts` |
| `payouts` | Marked as paid | `incrementTotalPaidOut(ctx, tenantId, amount)` | `convex/tenantStats.ts` |
| `referralLeads` | Created | `onLeadCreated(ctx, tenantId)` | `convex/tenantStats.ts` |
| `referralLeads` | Marked converted | `onLeadConverted(ctx, tenantId)` | `convex/tenantStats.ts` |

**Checklist for any new mutation:**
- [ ] Does it change `affiliate.status`? → Call `updateAffiliateCount`
- [ ] Does it create a commission? → Call `onCommissionCreated`
- [ ] Does it change `commission.status`? → Call `onCommissionStatusChange`
- [ ] Does it change `commission.amount`? → Call `onCommissionAmountChanged`
- [ ] Does it mark a payout as paid? → Call `incrementTotalPaidOut`

### Rule 2: No Unbounded `.collect()` on High-Volume Tables

**High-volume tables** (clicks, conversions, commissions, payouts, affiliates, referralLeads) must NEVER use unbounded `.collect()`. Always use one of:

1. **`.take(N)`** — for bounded non-paginated queries (dashboard widgets, stats)
2. **`.paginate(paginationOpts)`** — for user-facing lists (tables, feeds)
3. **Read from `tenantStats`** — for aggregate counts (stats cards, badges)

### Rule 3: Dashboard Stats from tenantStats

Stats that are pre-computed in `tenantStats` **MUST** be read from there, not by scanning source tables.

| Stat | tenantStats Field | Consumers |
|------|-------------------|-----------|
| Active affiliates | `affiliatesActive` | Dashboard, Plan Usage |
| Pending affiliates | `affiliatesPending` | Sidebar badge, Affiliate tabs |
| Pending commissions count | `commissionsPendingCount` | Dashboard |
| Pending commissions value | `commissionsPendingValue` | Dashboard |
| Confirmed this month | `commissionsConfirmedThisMonth` | Commission stats |
| Total paid out | `totalPaidOut` | Dashboard |
| Flagged commissions | `commissionsFlagged` | Commission stats |

### Rule 4: New Aggregate Stats

If you add a new aggregate stat to the dashboard or any page:

1. Consider whether it belongs in `tenantStats` first
2. If yes: add the counter field to the schema (`convex/schema.ts`), update the seed/backfill (`convex/tenantStats.ts`), wire the relevant mutations, and read from tenantStats in queries
3. If no (date-range dependent): use `.take()` caps

### Rule 5: Existence Checks Use `.first()`

Boolean existence checks (e.g., "does any campaign exist?") must use `.first()` instead of `.collect()` + `length > 0`.

```typescript
// WRONG — scans entire table
const campaigns = await ctx.db.query("campaigns").collect();
const hasCampaigns = campaigns.length > 0;

// CORRECT — returns after first match
const campaign = await ctx.db.query("campaigns").first();
const hasCampaigns = !!campaign;
```

---

## `.take()` Cap Reference

All capped queries and their limits with worst-case size calculations against Convex's 1MB transaction limit:

| Query | Table | Cap | Avg Doc Size | Total Read | Safety Margin |
|-------|-------|-----|-------------|-----------|---------------|
| `getRecentActivity` | affiliates | 50 | ~1,000B | 50KB | 20x |
| `getRecentActivity` | commissions | 50 | ~500B | 25KB | 40x |
| `getRecentActivity` | payouts | 50 | ~400B | 20KB | 50x |
| `getTopAffiliates` | affiliates | 200 | ~1,000B | 200KB | 5x |
| `getTopAffiliates` | clicks | 500 | ~700B | 350KB | 2.9x |
| `getTopAffiliates` | conversions | 500 | ~800B | 400KB | 2.5x |
| `getTopAffiliates` | commissions | 300 | ~500B | 150KB | 6.7x |
| `getRecentCommissions` | commissions | 50 | ~500B | 25KB | 40x |
| `getOwnerDashboardStats` | commissions | 1,500 | ~500B | 750KB | 1.3x |
| `getOwnerDashboardStats` | conversions | 800 | ~800B | 640KB | 1.6x |
| `getOwnerDashboardStats` | clicks | 1,000 | ~700B | 700KB | 1.4x |
| `getCampaignCardStats` | conversions | 500 | ~800B | 400KB | 2.5x |
| `getCampaignCardStats` | commissions | 300 | ~500B | 150KB | 6.7x |
| `getCampaignCardStats` | referralLinks | 1,000 | ~488B | 488KB | 2x |
| `getAffiliatesByCampaign` | clicks | 500 | ~700B | 350KB | 2.9x |
| `getAffiliatesByCampaign` | conversions | 500 | ~800B | 400KB | 2.5x |
| `getAffiliatesByCampaign` | commissions | 300 | ~500B | 150KB | 6.7x |
| `getPendingPayoutTotal` | commissions | 700 | ~500B | 350KB | 2.9x |
| `getAffiliatesWithPendingPayouts` | commissions | 700 | ~500B | 350KB | 2.9x |
| `getClickStats` | clicks | 1,200 | ~700B | 840KB | 1.2x |
| `getConversionStatsByTenant` | conversions | 800 | ~800B | 640KB | 1.6x |
| `listCommissions` (legacy) | commissions | 500 | ~500B | 250KB | 4x |
| `getPlanUsage` | campaigns | 500 | ~657B | 329KB | 3x |
| `findLeadByEmail` | referralLeads | 1 | ~800B | 800B | 1250x |
| `getLeadsByAffiliate` | referralLeads | 500 | ~800B | 400KB | 2.5x |
| `expireStaleLeads` | referralLeads | 100 | ~800B | 80KB | 12.5x |

---

## Backfill Safety

- Run `backfillAllTenants` periodically via the weekly cron job (`convex/crons.ts`) to catch any counter drift
- The cron runs `internal.tenantStats.backfillAllTenants` every week
- After deploying new counter wiring, run `npx convex run internal.tenantStats.backfillAllTenants` manually to sync counters

---

## Status Inconsistency: `approved` vs `confirmed`

The codebase uses `"approved"` and `"confirmed"` interchangeably for commission statuses. Any query filtering by status **MUST** check both:

```typescript
// WRONG — misses auto-approved commissions
c.status === "confirmed"

// CORRECT — catches both statuses
c.status === "approved" || c.status === "confirmed"
```

All `tenantStats` hooks treat both as equivalent for counter purposes.

---

_Last Updated: 2026-03-22_
