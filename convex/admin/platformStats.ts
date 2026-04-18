import { query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./_helpers";
import {
  affiliateByStatusAggregate,
  commissionByStatusAggregate,
  commissionByFlagAggregate,
  payoutByStatusAggregate,
  clicksAggregate,
  conversionsAggregate,
  type AggregateBounds,
} from "../aggregates";
import type { Id } from "../_generated/dataModel";

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

// =============================================================================
// Platform-wide Stats — Cached in platformStats table, refreshed by cron
// =============================================================================

/**
 * Read platform KPIs from the cached platformStats document.
 * Falls back to zeros if the cache hasn't been populated yet.
 * Refreshed every 5 minutes by the refreshPlatformStats cron.
 */
export const getAggregatePlatformKPIs = query({
  args: {},
  returns: v.object({
    _id: v.optional(v.id("platformStats")),
    _creationTime: v.number(),
    key: v.string(),
    totalMRR: v.number(),
    totalActiveAffiliates: v.number(),
    totalCommissions: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalFraudSignals: v.number(),
    activeTenantCount: v.number(),
    totalPendingCommissions: v.number(),
    totalApprovedCommissions: v.number(),
    totalPaidOut: v.number(),
    lastUpdatedAt: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const cached = await ctx.db
      .query("platformStats")
      .withIndex("by_key", (q) => q.eq("key", "platform"))
      .first();

    if (!cached) {
      return {
        _id: undefined,
        _creationTime: 0,
        key: "platform",
        totalMRR: 0,
        totalActiveAffiliates: 0,
        totalCommissions: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalFraudSignals: 0,
        activeTenantCount: 0,
        totalPendingCommissions: 0,
        totalApprovedCommissions: 0,
        totalPaidOut: 0,
        lastUpdatedAt: 0,
      };
    }

    return cached;
  },
});

/**
 * Recalculate platformStats and rebuild tenantLeaderboard from aggregate queries.
 * Called by a lightweight cron every 5 minutes.
 * Iterates all non-deleted/non-cancelled tenants and sums O(log n) aggregate calls.
 */
export const refreshPlatformStats = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let totalActiveAffiliates = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalFraudSignals = 0;
    let activeTenantCount = 0;
    let totalPendingCommissions = 0;
    let totalApprovedCommissions = 0;
    let totalPaidOut = 0;

    const monthStart = getMonthStart();
    const nextMonthStart = getNextMonthStart();
    const now = Date.now();

    const leaderboardRows: Array<{
      tenantId: Id<"tenants">;
      tenantName: string;
      plan: string;
      status: string;
      affiliatesActive: number;
      commissionsConfirmedThisMonth: number;
      totalClicksThisMonth: number;
      totalConversionsThisMonth: number;
      commissionsFlagged: number;
    }> = [];

    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const results = await ctx.db
        .query("tenants")
        .withIndex("by_status")
        .paginate({ numItems: 100, cursor: (cursor ?? undefined) as string });

      for (const tenant of results.page) {
        if (tenant.status === "deleted" || tenant.status === "cancelled") continue;
        activeTenantCount++;

        const ns = { namespace: tenant._id };

        const [
          activeAffiliates,
          pendingCommissionSum,
          approvedCommissionSum,
          paidOutSum,
          clicks,
          conversions,
          flaggedCount,
          approvedThisMonthCount,
          clicksThisMonth,
          conversionsThisMonth,
        ] = await Promise.all([
          affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["active"] } } as any),
          commissionByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
          commissionByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["approved"] } } as any),
          payoutByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["paid"] } } as any),
          clicksAggregate.count(ctx, ns as any),
          conversionsAggregate.count(ctx, ns as any),
          commissionByFlagAggregate.count(ctx, { ...ns, bounds: { prefix: [true] } } as any),
          commissionByStatusAggregate.count(ctx, {
            ...ns,
            bounds: {
              lower: { key: ["approved", monthStart] as [string, number], inclusive: true },
              upper: { key: ["approved", nextMonthStart] as [string, number], inclusive: false },
            },
          } as any),
          clicksAggregate.count(ctx, {
            ...ns,
            bounds: {
              lower: { key: monthStart, inclusive: true },
              upper: { key: nextMonthStart, inclusive: false },
            },
          } as any),
          conversionsAggregate.count(ctx, {
            ...ns,
            bounds: {
              lower: { key: monthStart, inclusive: true },
              upper: { key: nextMonthStart, inclusive: false },
            },
          } as any),
        ]);

        totalActiveAffiliates += activeAffiliates;
        totalPendingCommissions += pendingCommissionSum;
        totalApprovedCommissions += approvedCommissionSum;
        totalPaidOut += paidOutSum;
        totalClicks += clicks;
        totalConversions += conversions;
        totalFraudSignals += flaggedCount;

        leaderboardRows.push({
          tenantId: tenant._id,
          tenantName: tenant.name,
          plan: tenant.plan,
          status: tenant.status,
          affiliatesActive: activeAffiliates,
          commissionsConfirmedThisMonth: approvedThisMonthCount,
          totalClicksThisMonth: clicksThisMonth,
          totalConversionsThisMonth: conversionsThisMonth,
          commissionsFlagged: flaggedCount,
        });
      }

      isDone = results.isDone;
      cursor = results.continueCursor;
    }

    const totalCommissions = totalPendingCommissions + totalApprovedCommissions;

    // Upsert platformStats singleton
    const platformData = {
      totalMRR: 0,
      totalActiveAffiliates,
      totalCommissions,
      totalClicks,
      totalConversions,
      totalFraudSignals,
      activeTenantCount,
      totalPendingCommissions,
      totalApprovedCommissions,
      totalPaidOut,
      lastUpdatedAt: now,
    };

    const existing = await ctx.db
      .query("platformStats")
      .withIndex("by_key", (q) => q.eq("key", "platform"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, platformData);
    } else {
      await ctx.db.insert("platformStats", { key: "platform", ...platformData });
    }

    // Rebuild tenantLeaderboard: delete all existing rows, re-insert sorted
    const existingRows = await ctx.db.query("tenantLeaderboard").take(500);
    for (const row of existingRows) {
      await ctx.db.delete(row._id);
    }

    // Sort by commissionsConfirmedThisMonth descending (default leaderboard metric)
    leaderboardRows.sort((a, b) => b.commissionsConfirmedThisMonth - a.commissionsConfirmedThisMonth);

    for (const row of leaderboardRows) {
      await ctx.db.insert("tenantLeaderboard", { ...row, computedAt: now });
    }

    return null;
  },
});

// =============================================================================
// Tenant Leaderboard — Materialized, true global sort via cursor pagination
// =============================================================================

/**
 * Get tenant leaderboard for platform analytics.
 * Reads from the materialized tenantLeaderboard table (rebuilt every 5 min by cron).
 * Rows are pre-sorted by commissionsConfirmedThisMonth descending.
 * Cursor-based pagination provides correct cross-page ordering.
 */
export const getTenantLeaderboard = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.object({
      tenantId: v.id("tenants"),
      tenantName: v.string(),
      plan: v.string(),
      status: v.string(),
      affiliatesActive: v.number(),
      commissionsConfirmedThisMonth: v.number(),
      totalClicksThisMonth: v.number(),
      totalConversionsThisMonth: v.number(),
      commissionsFlagged: v.number(),
      computedAt: v.number(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const results = await ctx.db
      .query("tenantLeaderboard")
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: results.page,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
      pageStatus: results.pageStatus,
      splitCursor: results.splitCursor,
    };
  },
});
