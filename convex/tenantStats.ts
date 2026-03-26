import { query, action, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getTenantId } from "./tenantContext";

// =============================================================================
// Helpers
// =============================================================================

function getMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
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
 * Used by the owner dashboard to show summary metrics without scanning tables.
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
  }),
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .first();

    const monthStart = getMonthStart();
    const stale = stats && stats.currentMonthStart < monthStart;

    return {
      affiliatesPending: stats?.affiliatesPending ?? 0,
      affiliatesActive: stats?.affiliatesActive ?? 0,
      affiliatesSuspended: stats?.affiliatesSuspended ?? 0,
      affiliatesRejected: stats?.affiliatesRejected ?? 0,
      commissionsPendingCount: stats?.commissionsPendingCount ?? 0,
      commissionsPendingValue: stats?.commissionsPendingValue ?? 0,
      commissionsConfirmedThisMonth: stale ? 0 : (stats?.commissionsConfirmedThisMonth ?? 0),
      commissionsConfirmedValueThisMonth: stale ? 0 : (stats?.commissionsConfirmedValueThisMonth ?? 0),
      commissionsReversedThisMonth: stale ? 0 : (stats?.commissionsReversedThisMonth ?? 0),
      commissionsReversedValueThisMonth: stale ? 0 : (stats?.commissionsReversedValueThisMonth ?? 0),
      commissionsFlagged: stats?.commissionsFlagged ?? 0,
      totalPaidOut: stats?.totalPaidOut ?? 0,
      pendingPayoutTotal: stats?.pendingPayoutTotal ?? 0,
      pendingPayoutCount: stats?.pendingPayoutCount ?? 0,
      apiCallsThisMonth: stale ? 0 : (stats?.apiCallsThisMonth ?? 0),
    };
  },
});

// =============================================================================
// Public Query: Sidebar Badge Counts
// =============================================================================

/**
 * Get pending action counts for sidebar notification badges.
 * Single read from denormalized tenantStats — O(1), no table scans.
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

    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .first();

    return {
      pendingAffiliates: stats?.affiliatesPending ?? 0,
      pendingCommissions: stats?.commissionsPendingCount ?? 0,
      pendingPayouts: stats?.pendingPayoutCount ?? 0,
    };
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
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("tenantStats", data);
    }

    return null;
  },
});

/**
 * Backfill stats for all tenants. Run once after deploying tenantStats.
 * Also runs weekly via cron job in crons.ts.
 */
export const backfillAllTenants = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let cursor = null;
    let totalBackfilled = 0;
    let isDone = false;
    do {
      const result = await ctx.db
        .query("tenants")
        .paginate({ numItems: 500, cursor, });
      for (const tenant of result.page) {
        await ctx.runMutation(internal.tenantStats.backfillStats, {
          tenantId: tenant._id,
        });
        totalBackfilled++;
      }
      cursor = result.continueCursor;
      isDone = result.isDone;
    } while (!isDone);
    console.log(`Backfilled ${totalBackfilled} tenants`);
    return null;
  },
});

// =============================================================================
// Mutation Hooks — called by other mutations to keep counters in sync
// =============================================================================

/**
 * Called when an affiliate status changes.
 * Updates the affiliate counters atomically.
 */
export async function updateAffiliateCount(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  oldStatus: string | undefined,
  newStatus: string,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  const patch: Record<string, number> = {};

  // Undo old status
  if (oldStatus === "pending") patch.affiliatesPending = stats.affiliatesPending - 1;
  if (oldStatus === "active") patch.affiliatesActive = stats.affiliatesActive - 1;
  if (oldStatus === "suspended") patch.affiliatesSuspended = stats.affiliatesSuspended - 1;
  if (oldStatus === "rejected") patch.affiliatesRejected = stats.affiliatesRejected - 1;

  // Apply new status
  if (newStatus === "pending") patch.affiliatesPending = (patch.affiliatesPending ?? stats.affiliatesPending) + 1;
  if (newStatus === "active") patch.affiliatesActive = (patch.affiliatesActive ?? stats.affiliatesActive) + 1;
  if (newStatus === "suspended") patch.affiliatesSuspended = (patch.affiliatesSuspended ?? stats.affiliatesSuspended) + 1;
  if (newStatus === "rejected") patch.affiliatesRejected = (patch.affiliatesRejected ?? stats.affiliatesRejected) + 1;

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(stats._id, patch);
  }
}

/**
 * Called when a commission is created.
 * Increments pending or confirmed counters based on status.
 */
export async function onCommissionCreated(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  amount: number,
  status: string,
  hasFraudSignals: boolean = false,
  isSelfReferral: boolean = false,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  const patch: Record<string, number> = {};

  if (status === "pending") {
    patch.commissionsPendingCount = stats.commissionsPendingCount + 1;
    patch.commissionsPendingValue = stats.commissionsPendingValue + amount;
  } else if (status === "approved") {
    patch.commissionsConfirmedThisMonth = stats.commissionsConfirmedThisMonth + 1;
    patch.commissionsConfirmedValueThisMonth = stats.commissionsConfirmedValueThisMonth + amount;
    // Also track as pending payout (approved = awaiting payment)
    patch.pendingPayoutTotal = (stats.pendingPayoutTotal ?? 0) + amount;
    patch.pendingPayoutCount = (stats.pendingPayoutCount ?? 0) + 1;
  }

  if (hasFraudSignals || isSelfReferral) {
    patch.commissionsFlagged = stats.commissionsFlagged + 1;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(stats._id, patch);
  }
}

/**
 * Called when a commission status changes (approve, decline, reverse).
 * Swaps counters between statuses atomically.
 */
export async function onCommissionStatusChange(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  amount: number,
  oldStatus: string,
  newStatus: string,
  wasFlagged: boolean = false,
  isFlagged: boolean = false,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  const patch: Record<string, number> = {};

  // Undo old status
  if (oldStatus === "pending") {
    patch.commissionsPendingCount = stats.commissionsPendingCount - 1;
    patch.commissionsPendingValue = stats.commissionsPendingValue - amount;
  }
  if (oldStatus === "approved") {
    patch.pendingPayoutTotal = (patch.pendingPayoutTotal ?? stats.pendingPayoutTotal ?? 0) - amount;
    patch.pendingPayoutCount = (patch.pendingPayoutCount ?? stats.pendingPayoutCount ?? 0) - 1;
  }
  if (oldStatus === "reversed" || oldStatus === "declined") {
    patch.commissionsReversedThisMonth = stats.commissionsReversedThisMonth - 1;
    patch.commissionsReversedValueThisMonth = stats.commissionsReversedValueThisMonth - amount;
  }

  // Apply new status
  if (newStatus === "pending") {
    patch.commissionsPendingCount = (patch.commissionsPendingCount ?? stats.commissionsPendingCount ?? 0) + 1;
    patch.commissionsPendingValue = (patch.commissionsPendingValue ?? stats.commissionsPendingValue ?? 0) + amount;
  }
  if (newStatus === "approved") {
    patch.commissionsConfirmedThisMonth = (patch.commissionsConfirmedThisMonth ?? stats.commissionsConfirmedThisMonth ?? 0) + 1;
    patch.commissionsConfirmedValueThisMonth = (patch.commissionsConfirmedValueThisMonth ?? stats.commissionsConfirmedValueThisMonth ?? 0) + amount;
    // Track as pending payout
    patch.pendingPayoutTotal = (patch.pendingPayoutTotal ?? stats.pendingPayoutTotal ?? 0) + amount;
    patch.pendingPayoutCount = (patch.pendingPayoutCount ?? stats.pendingPayoutCount ?? 0) + 1;
  }
  if (newStatus === "reversed" || newStatus === "declined") {
    patch.commissionsReversedThisMonth = (patch.commissionsReversedThisMonth ?? stats.commissionsReversedThisMonth ?? 0) + 1;
    patch.commissionsReversedValueThisMonth = (patch.commissionsReversedValueThisMonth ?? stats.commissionsReversedValueThisMonth ?? 0) + amount;
  }
  // "paid" is a terminal status — no counter bucket for paid commissions
  // The old status undo (above) handles decrementing the source bucket

  // Handle flagged counter changes
  if (wasFlagged && !isFlagged) {
    // Flag cleared (e.g., on approval)
    patch.commissionsFlagged = stats.commissionsFlagged - 1;
  } else if (!wasFlagged && isFlagged) {
    // Flag added
    patch.commissionsFlagged = stats.commissionsFlagged + 1;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(stats._id, patch);
  }
}

/**
 * Increment totalPaidOut counter for a tenant.
 * Called when payouts are marked as paid.
 */
export async function incrementTotalPaidOut(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  amount: number,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  await ctx.db.patch(stats._id, {
    totalPaidOut: stats.totalPaidOut + amount,
  });
}

/**
 * Called when an organic conversion is created (no affiliate attribution).
 * Increments organic-specific counters AND totalConversionsThisMonth.
 * Note: NOT idempotent — Convex retries on write conflict could double-count.
 * The weekly backfillStats cron serves as a periodic correction mechanism.
 */
export async function onOrganicConversionCreated(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  await ctx.db.patch(stats._id, {
    organicConversionsThisMonth: (stats.organicConversionsThisMonth ?? 0) + 1,
    organicConversionsLast3Months: (stats.organicConversionsLast3Months ?? 0) + 1,
    // Fix pre-existing bug: totalConversionsThisMonth was never incremented
    totalConversionsThisMonth: (stats.totalConversionsThisMonth ?? 0) + 1,
  });
}

/**
 * Increment totalConversionsThisMonth for attributed conversions.
 * Fixes the pre-existing bug where totalConversionsThisMonth was never incremented.
 */
export async function incrementTotalConversions(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
) {
  const stats = await getOrCreateStats(ctx, tenantId);
  await ctx.db.patch(stats._id, {
    totalConversionsThisMonth: (stats.totalConversionsThisMonth ?? 0) + 1,
  });
}

/**
 * Called when a commission amount changes without a status change.
 * Adjusts the appropriate value counter based on current status.
 */
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
  } else if (status === "approved") {
    patch.pendingPayoutTotal = (stats.pendingPayoutTotal ?? 0) + delta;
  } else if (status === "reversed" || status === "declined") {
    patch.commissionsReversedValueThisMonth = stats.commissionsReversedValueThisMonth + delta;
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(stats._id, patch);
  }
}

/**
 * Internal mutation: get or create stats (for use in actions).
 */
export const getOrCreateStatsInternal = internalMutation({
  args: { tenantId: v.id("tenants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .first();

    if (!stats) {
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
      });
    }

    // Check for month boundary reset
    const monthStart = getMonthStart();
    if (stats && stats.currentMonthStart < monthStart) {
      await ctx.db.patch(stats._id, {
        // Copy ThisMonth → LastMonth BEFORE zeroing (fixes stale LastMonth gap)
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
    }

    return null;
  },
});

// =============================================================================
// Internal Mutation: Increment API Calls Counter
// =============================================================================

/**
 * Increment the apiCallsThisMonth counter for a tenant.
 * Called by HTTP action handlers to track API usage against tier limits.
 * Uses getOrCreateStats to handle month boundary resets automatically.
 */
export const incrementApiCalls = internalMutation({
  args: { tenantId: v.id("tenants"), count: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stats = await getOrCreateStats(ctx, args.tenantId);
    await ctx.db.patch(stats._id, {
      apiCallsThisMonth: (stats.apiCallsThisMonth ?? 0) + args.count,
    });
    return null;
  },
});

// =============================================================================
// Public Action: Trigger Backfill (dev convenience)
// =============================================================================

/**
 * Public action to trigger a full backfill of all tenant stats.
 * Intended for dev/debugging use only — the weekly cron handles production.
 * Run via: npx convex run tenantStats:backfillAll
 */
export const backfillAll = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.tenantStats.backfillAllTenants, {});
    return "Backfill complete.";
  },
});
