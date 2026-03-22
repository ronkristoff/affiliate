import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";

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
    });
    return (await ctx.db.get(id))!;
  }

  if (needsReset) {
    await ctx.db.patch(stats._id, {
      commissionsConfirmedThisMonth: 0,
      commissionsConfirmedValueThisMonth: 0,
      commissionsReversedThisMonth: 0,
      commissionsReversedValueThisMonth: 0,
      currentMonthStart: monthStart,
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

    const monthStart = getMonthStart();

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
      } else if (c.status === "approved" || c.status === "confirmed") {
        if (c._creationTime >= monthStart) {
          commissionsConfirmedThisMonth++;
          commissionsConfirmedValueThisMonth += c.amount;
        }
      } else if (c.status === "reversed" || c.status === "declined") {
        if (c._creationTime >= monthStart) {
          commissionsReversedThisMonth++;
          commissionsReversedValueThisMonth += c.amount;
        }
      }
      if (c.fraudIndicators && c.fraudIndicators.length > 0) {
        commissionsFlagged++;
      }
      if (c.isSelfReferral === true) {
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

    // Count confirmed commissions (pending payouts) — not month-bound
    for (const c of commissions) {
      if (c.status === "confirmed" || c.status === "approved") {
        if (!c.batchId) {
          pendingPayoutTotal += c.amount;
          pendingPayoutCount++;
        }
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
  } else if (status === "approved" || status === "confirmed") {
    patch.commissionsConfirmedThisMonth = stats.commissionsConfirmedThisMonth + 1;
    patch.commissionsConfirmedValueThisMonth = stats.commissionsConfirmedValueThisMonth + amount;
    // Also track as pending payout (confirmed = awaiting payment)
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
  if (oldStatus === "approved" || oldStatus === "confirmed") {
    patch.commissionsConfirmedThisMonth = stats.commissionsConfirmedThisMonth - 1;
    patch.commissionsConfirmedValueThisMonth = stats.commissionsConfirmedValueThisMonth - amount;
    // Undo pending payout tracking
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
  if (newStatus === "approved" || newStatus === "confirmed") {
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
  } else if (status === "approved" || status === "confirmed") {
    patch.commissionsConfirmedValueThisMonth = stats.commissionsConfirmedValueThisMonth + delta;
    // Also adjust pending payout total
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
      });
    }

    // Check for month boundary reset
    const monthStart = getMonthStart();
    if (stats && stats.currentMonthStart < monthStart) {
      await ctx.db.patch(stats._id, {
        commissionsConfirmedThisMonth: 0,
        commissionsConfirmedValueThisMonth: 0,
        commissionsReversedThisMonth: 0,
        commissionsReversedValueThisMonth: 0,
        currentMonthStart: monthStart,
      });
    }

    return null;
  },
});
