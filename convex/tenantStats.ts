import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getTenantId } from "./tenantContext";
import {
  affiliateByStatusAggregate,
  commissionByStatusAggregate,
  commissionByFlagAggregate,
  leadByStatusAggregate,
  payoutByStatusAggregate,
  conversionsAggregate,
  apiCallsDirect,
  degradationDirect,
  type AggregateBounds,
} from "./aggregates";

// =============================================================================
// Helpers
// =============================================================================

// NOTE: All month-boundary calculations use UTC (Convex V8 runtime timezone).
// Timestamps are stored in UTC in the database. Frontend display uses
// browser-local timezone via Intl.DateTimeFormat / date-fns, so users
// see dates converted to their local time automatically.

function getMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function getNextMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

/**
 * Get or create the tenantStats document for a tenant.
 * If the month has rolled over, resets monthly counters.
 */
async function getOrCreateStats(ctx: MutationCtx, tenantId: Id<"tenants">) {
  const stats = await ctx.db
    .query("tenantStats")
    .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
    .first();

  const monthStart = getMonthStart();
  const needsReset = stats && stats.currentMonthStart < monthStart;

  if (!stats) {
    const id = await ctx.db.insert("tenantStats", {
      tenantId,
      affiliatesPending: 0,
      affiliatesActive: 0,
      affiliatesSuspended: 0,
      affiliatesRejected: 0,
      commissionsPendingCount: 0,
      commissionsPendingValue: 0,
      commissionsConfirmedThisMonth: 0,
      commissionsConfirmedValueThisMonth: 0,
      commissionsReversedThisMonth: 0,
      commissionsReversedValueThisMonth: 0,
      commissionsFlagged: 0,
      totalPaidOut: 0,
      pendingPayoutTotal: 0,
      pendingPayoutCount: 0,
      currentMonthStart: monthStart,
      apiCallsThisMonth: 0,
      totalConversionsThisMonth: 0,
      organicConversionsThisMonth: 0,
      leadsCreatedThisMonth: 0,
      leadsConvertedThisMonth: 0,
      lastSyncedAt: Date.now(),
      // API Resilience Layer — degradation counters (Task 17)
      degradationCount: 0,
      circuitBreakerTrips: 0,
    });
    return (await ctx.db.get(id))!;
  }

  if (needsReset) {
    await ctx.db.patch(stats._id, {
      // Copy ThisMonth → LastMonth BEFORE zeroing (fixes stale LastMonth gap)
      commissionsConfirmedLastMonth: stats.commissionsConfirmedThisMonth,
      commissionsConfirmedValueLastMonth: stats.commissionsConfirmedValueThisMonth,
      totalClicksLastMonth: stats.totalClicksLastMonth ?? 0,
      totalConversionsLastMonth: stats.totalConversionsThisMonth ?? 0,
      organicConversionsLastMonth: stats.organicConversionsThisMonth ?? 0,
      leadsCreatedLastMonth: stats.leadsCreatedThisMonth ?? 0,
      // Now zero ThisMonth fields
      commissionsConfirmedThisMonth: 0,
      commissionsConfirmedValueThisMonth: 0,
      commissionsReversedThisMonth: 0,
      commissionsReversedValueThisMonth: 0,
      organicConversionsThisMonth: 0,
      totalConversionsThisMonth: 0,
      currentMonthStart: monthStart,
      apiCallsThisMonth: 0,
      leadsCreatedThisMonth: 0,
      leadsConvertedThisMonth: 0,
      lastSyncedAt: Date.now(),
    });
    // Re-fetch after reset to avoid returning stale in-memory values
    return (await ctx.db.get(stats._id))!;
  }

  return stats;
}

// =============================================================================
// Public Query: Get Stats for Dashboard
// =============================================================================

/**
 * Get the denormalized stats for a tenant.
 * Uses O(log n) aggregate queries instead of reading a single denormalized document.
 */
export const getStats = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    affiliatesPending: v.number(),
    affiliatesActive: v.number(),
    affiliatesSuspended: v.number(),
    affiliatesRejected: v.number(),
    commissionsPendingCount: v.number(),
    commissionsPendingValue: v.number(),
    commissionsConfirmedThisMonth: v.number(),
    commissionsConfirmedValueThisMonth: v.number(),
    commissionsReversedThisMonth: v.number(),
    commissionsReversedValueThisMonth: v.number(),
    commissionsFlagged: v.number(),
    totalPaidOut: v.number(),
    pendingPayoutTotal: v.number(),
    pendingPayoutCount: v.number(),
    apiCallsThisMonth: v.number(),
    degradationCount: v.number(),
    circuitBreakerTrips: v.number(),
  }),
  handler: async (ctx, args) => {
    const ns = { namespace: args.tenantId };
    const monthStart = getMonthStart();

    const [
      affiliatesPending,
      affiliatesActive,
      affiliatesSuspended,
      affiliatesRejected,
      commissionsPendingCount,
      commissionsPendingValue,
      totalPaidOut,
      pendingPayoutTotal,
      pendingPayoutCount,
      commissionsFlagged,
      apiCallsCount,
      degradationCount,
      circuitBreakerTrips,
    ] = await Promise.all([
      affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
      affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["active"] } } as any),
      affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["suspended"] } } as any),
      affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["rejected"] } } as any),
      commissionByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
      commissionByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
      payoutByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["paid"] } } as any),
      commissionByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["approved"] } } as any),
      commissionByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["approved"] } } as any),
      commissionByFlagAggregate.count(ctx, { ...ns, bounds: { prefix: [true] } } as any),
      apiCallsDirect.count(ctx, { ...ns, bounds: { lower: { key: monthStart, inclusive: true }, upper: { key: getNextMonthStart(), inclusive: false } } } as any),
      degradationDirect.count(ctx, { ...ns, bounds: { prefix: ["degradation"] } } as any),
      degradationDirect.count(ctx, { ...ns, bounds: { prefix: ["circuitBreaker"] } } as any),
    ]);

    const [
      commissionsConfirmedThisMonth,
      commissionsConfirmedValueThisMonth,
      declinedCount,
      declinedValue,
      reversedCount,
      reversedValue,
    ] = await Promise.all([
      commissionByStatusAggregate.count(ctx, {
        ...ns,
        bounds: {
          lower: { key: ["approved", monthStart] as [string, number], inclusive: true },
          upper: { key: ["approved", getNextMonthStart()] as [string, number], inclusive: false },
        },
      } as any),
      commissionByStatusAggregate.sum(ctx, {
        ...ns,
        bounds: {
          lower: { key: ["approved", monthStart] as [string, number], inclusive: true },
          upper: { key: ["approved", getNextMonthStart()] as [string, number], inclusive: false },
        },
      } as any),
      commissionByStatusAggregate.count(ctx, {
        ...ns,
        bounds: {
          lower: { key: ["declined", monthStart] as [string, number], inclusive: true },
          upper: { key: ["declined", getNextMonthStart()] as [string, number], inclusive: false },
        },
      } as any),
      commissionByStatusAggregate.sum(ctx, {
        ...ns,
        bounds: {
          lower: { key: ["declined", monthStart] as [string, number], inclusive: true },
          upper: { key: ["declined", getNextMonthStart()] as [string, number], inclusive: false },
        },
      } as any),
      commissionByStatusAggregate.count(ctx, {
        ...ns,
        bounds: {
          lower: { key: ["reversed", monthStart] as [string, number], inclusive: true },
          upper: { key: ["reversed", getNextMonthStart()] as [string, number], inclusive: false },
        },
      } as any),
      commissionByStatusAggregate.sum(ctx, {
        ...ns,
        bounds: {
          lower: { key: ["reversed", monthStart] as [string, number], inclusive: true },
          upper: { key: ["reversed", getNextMonthStart()] as [string, number], inclusive: false },
        },
      } as any),
    ]);

    const commissionsReversedThisMonth = declinedCount + reversedCount;
    const commissionsReversedValueThisMonth = declinedValue + reversedValue;

    return {
      affiliatesPending,
      affiliatesActive,
      affiliatesSuspended,
      affiliatesRejected,
      commissionsPendingCount,
      commissionsPendingValue,
      commissionsConfirmedThisMonth,
      commissionsConfirmedValueThisMonth,
      commissionsReversedThisMonth,
      commissionsReversedValueThisMonth,
      commissionsFlagged,
      totalPaidOut,
      pendingPayoutTotal,
      pendingPayoutCount,
      apiCallsThisMonth: apiCallsCount,
      degradationCount,
      circuitBreakerTrips,
    };
  },
});

// =============================================================================
// Public Query: Sidebar Badge Counts
// =============================================================================

/**
 * Get pending action counts for sidebar notification badges.
 * Uses O(log n) aggregate queries.
 */
export const getSidebarBadgeCounts = query({
  args: {},
  returns: v.object({
    pendingAffiliates: v.number(),
    pendingCommissions: v.number(),
    pendingPayouts: v.number(),
  }),
  handler: async (ctx) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return { pendingAffiliates: 0, pendingCommissions: 0, pendingPayouts: 0 };
    }

    const ns = { namespace: tenantId };

    const [pendingAffiliates, pendingCommissions, pendingPayouts] = await Promise.all([
      affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
      commissionByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
      commissionByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["approved"] } } as any),
    ]);

    return { pendingAffiliates, pendingCommissions, pendingPayouts };
  },
});

// =============================================================================
// Internal: Seed & Backfill
// =============================================================================

/**
 * Seed tenantStats for a new tenant (called during tenant creation).
 */
export const seedStats = internalMutation({
  args: { tenantId: v.id("tenants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("tenantStats", {
      tenantId: args.tenantId,
      affiliatesPending: 0,
      affiliatesActive: 0,
      affiliatesSuspended: 0,
      affiliatesRejected: 0,
      commissionsPendingCount: 0,
      commissionsPendingValue: 0,
      commissionsConfirmedThisMonth: 0,
      commissionsConfirmedValueThisMonth: 0,
      commissionsReversedThisMonth: 0,
      commissionsReversedValueThisMonth: 0,
      commissionsFlagged: 0,
      totalPaidOut: 0,
      pendingPayoutTotal: 0,
      pendingPayoutCount: 0,
      currentMonthStart: getMonthStart(),
      apiCallsThisMonth: 0,
      totalConversionsThisMonth: 0,
      organicConversionsThisMonth: 0,
      leadsCreatedThisMonth: 0,
      leadsConvertedThisMonth: 0,
    });
    return null;
  },
});

/**
 * Backfill stats for a single tenant from actual records.
 */
export const backfillStats = internalMutation({
  args: { tenantId: v.id("tenants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { tenantId } = args;

    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(5000);

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(10000);

    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .take(5000);

    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(5000);

    const referralLeads = await ctx.db
      .query("referralLeads")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(1000);

    const monthStart = getMonthStart();
    const lastMonthStart = new Date(
      new Date(monthStart).getFullYear(),
      new Date(monthStart).getMonth() - 1, 1
    ).getTime();
    const threeMonthsAgoStart = new Date(
      new Date(monthStart).getFullYear(),
      new Date(monthStart).getMonth() - 2, 1
    ).getTime();

    let affiliatesPending = 0, affiliatesActive = 0, affiliatesSuspended = 0, affiliatesRejected = 0;
    for (const a of affiliates) {
      if (a.status === "pending") affiliatesPending++;
      else if (a.status === "active") affiliatesActive++;
      else if (a.status === "suspended") affiliatesSuspended++;
      else if (a.status === "rejected") affiliatesRejected++;
    }

    let commissionsPendingCount = 0, commissionsPendingValue = 0;
    let commissionsConfirmedThisMonth = 0, commissionsConfirmedValueThisMonth = 0;
    let commissionsReversedThisMonth = 0, commissionsReversedValueThisMonth = 0;
    let commissionsFlagged = 0;

    for (const c of commissions) {
      if (c.status === "pending") {
        commissionsPendingCount++;
        commissionsPendingValue += c.amount;
      } else if (c.status === "approved") {
        if (c._creationTime >= monthStart) {
          commissionsConfirmedThisMonth++;
          commissionsConfirmedValueThisMonth += c.amount;
        }
      } else if (c.status === "reversed") {
        if (c._creationTime >= monthStart) {
          commissionsReversedThisMonth++;
          commissionsReversedValueThisMonth += c.amount;
        }
      }
      if ((c.fraudIndicators && c.fraudIndicators.length > 0) || c.isSelfReferral === true) {
        commissionsFlagged++;
      }
    }

    let totalPaidOut = 0;
    let pendingPayoutTotal = 0;
    let pendingPayoutCount = 0;
    for (const p of payouts) {
      if (p.status === "paid") {
        totalPaidOut += p.amount;
      }
    }

    // Count approved commissions (pending payouts) — not month-bound
    for (const c of commissions) {
      if (c.status === "approved") {
        if (!c.batchId) {
          pendingPayoutTotal += c.amount;
          pendingPayoutCount++;
        }
      }
    }

    // Compute total + organic conversion counters by time window
    let totalConversionsThisMonth = 0, totalConversionsLastMonth = 0, totalConversionsLast3Months = 0;
    let organicConversionsThisMonth = 0, organicConversionsLastMonth = 0, organicConversionsLast3Months = 0;
    for (const conv of conversions) {
      const isOrganic = !conv.affiliateId || conv.attributionSource === "organic";
      if (conv._creationTime >= monthStart) {
        totalConversionsThisMonth++;
        if (isOrganic) organicConversionsThisMonth++;
      } else if (conv._creationTime >= lastMonthStart) {
        totalConversionsLastMonth++;
        if (isOrganic) organicConversionsLastMonth++;
      }
      if (conv._creationTime >= threeMonthsAgoStart) {
        totalConversionsLast3Months++;
        if (isOrganic) organicConversionsLast3Months++;
      }
    }

    // Compute lead counters
    let leadsCreatedThisMonth = 0, leadsConvertedThisMonth = 0;
    for (const lead of referralLeads) {
      if (lead._creationTime >= monthStart) {
        leadsCreatedThisMonth++;
      }
      if (lead.status === "converted" && lead.convertedAt && lead.convertedAt >= monthStart) {
        leadsConvertedThisMonth++;
      }
    }

    const existing = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .first();

    const data = {
      tenantId,
      affiliatesPending,
      affiliatesActive,
      affiliatesSuspended,
      affiliatesRejected,
      commissionsPendingCount,
      commissionsPendingValue,
      commissionsConfirmedThisMonth,
      commissionsConfirmedValueThisMonth,
      commissionsReversedThisMonth,
      commissionsReversedValueThisMonth,
      commissionsFlagged,
      totalPaidOut,
      pendingPayoutTotal,
      pendingPayoutCount,
      currentMonthStart: monthStart,
      apiCallsThisMonth: 0,
      // Conversion counters (fixes pre-existing bug: these were never computed)
      totalConversionsThisMonth,
      totalConversionsLastMonth,
      totalConversionsLast3Months,
      // Organic conversion counters
      organicConversionsThisMonth,
      organicConversionsLastMonth,
      organicConversionsLast3Months,
      // Lead counters
      leadsCreatedThisMonth,
      leadsConvertedThisMonth,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("tenantStats", data);
    }

    return null;
  },
});

// =============================================================================
// Mutation Hooks — replaced by aggregate triggers
// =============================================================================
// The following hooks were removed:
// - updateAffiliateCount → affiliateByStatusAggregate trigger
// - onCommissionCreated → commissionByStatusAggregate trigger
// - onCommissionStatusChange → commissionByStatusAggregate trigger
// - onCommissionAmountChanged → commissionByStatusAggregate trigger (via replace)
// - incrementTotalPaidOut → payoutByStatusAggregate trigger
// - onOrganicConversionCreated → kept in tenantStats (needs organic filter)
// - incrementTotalConversions → conversionsAggregate trigger
// - onLeadCreated → leadByStatusAggregate trigger
// - onLeadConverted → leadByStatusAggregate trigger
// - incrementApiCalls → apiCallsDirect (DirectAggregate)

/**
 * Called when an organic conversion is created (no affiliate attribution).
 * Increments organic-specific counters AND totalConversionsThisMonth.
 * Kept as manual hook because aggregate cannot filter by isOrganic.
 */
export async function onOrganicConversionCreated(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  await ctx.db.patch(stats._id, {
    organicConversionsThisMonth: (stats.organicConversionsThisMonth ?? 0) + 1,
    organicConversionsLast3Months: (stats.organicConversionsLast3Months ?? 0) + 1,
    totalConversionsThisMonth: (stats.totalConversionsThisMonth ?? 0) + 1,
  });
}

/**
 * Track pending payout totals — approved commissions not yet assigned to a batch.
 * Kept as manual hook because aggregate cannot filter by batchId.
 * Call from commission mutations that create/approve/decline commissions.
 */
export async function adjustPendingPayoutTotals(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  deltaCount: number,
  deltaValue: number,
) {
  if (deltaCount === 0 && deltaValue === 0) return;
  const stats = await getOrCreateStats(ctx, tenantId);
  await ctx.db.patch(stats._id, {
    pendingPayoutTotal: Math.max(0, (stats.pendingPayoutTotal ?? 0) + deltaValue),
    pendingPayoutCount: Math.max(0, (stats.pendingPayoutCount ?? 0) + deltaCount),
  });
}

// =============================================================================
// Internal Action: Discover & Backfill New Tenants (Cron-driven)
// =============================================================================
// REMOVED: _discoverAndBackfillImpl, _listTenantsForBackfill, _checkTenantHasStats
// getOrCreateStats() in tenantStats.ts already creates stats on-demand.
