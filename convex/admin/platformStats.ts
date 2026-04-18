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
} from "../aggregates";

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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
 * Recalculate platformStats from aggregate queries.
 * Called by a lightweight cron every 5 minutes.
 * Iterates all non-deleted/non-cancelled tenants and sums O(log n) aggregate calls.
 */
export const refreshPlatformStats = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let totalActiveAffiliates = 0;
    let totalCommissions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalFraudSignals = 0;
    let activeTenantCount = 0;
    let totalPendingCommissions = 0;
    let totalApprovedCommissions = 0;
    let totalPaidOut = 0;

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
        ] = await Promise.all([
          affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["active"] } } as any),
          commissionByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["pending"] } } as any),
          commissionByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["approved"] } } as any),
          payoutByStatusAggregate.sum(ctx, { ...ns, bounds: { prefix: ["paid"] } } as any),
          clicksAggregate.count(ctx, ns as any),
          conversionsAggregate.count(ctx, ns as any),
          commissionByFlagAggregate.count(ctx, { ...ns, bounds: { prefix: [true] } } as any),
        ]);

        totalActiveAffiliates += activeAffiliates;
        totalPendingCommissions += pendingCommissionSum;
        totalApprovedCommissions += approvedCommissionSum;
        totalPaidOut += paidOutSum;
        totalClicks += clicks;
        totalConversions += conversions;
        totalFraudSignals += flaggedCount;
      }

      isDone = results.isDone;
      cursor = results.continueCursor;
    }

    totalCommissions = totalPendingCommissions + totalApprovedCommissions;

    const now = Date.now();
    const data = {
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
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("platformStats", { key: "platform", ...data });
    }

    return null;
  },
});

/**
 * Get tenant leaderboard for platform analytics.
 * Reads all metrics from real-time aggregates.
 * Sorted by the specified metric (default: MRR → using commissions as proxy).
 * Paginated via tenants table, in-memory sort within page.
 */
export const getTenantLeaderboard = query({
  args: {
    paginationOpts: paginationOptsValidator,
    sortBy: v.optional(v.union(
      v.literal("mrr"),
      v.literal("affiliates"),
      v.literal("commissions"),
      v.literal("conversions"),
    )),
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
    })),
      isDone: v.boolean(),
      continueCursor: v.union(v.string(), v.null()),
      pageStatus: v.optional(v.union(v.string(), v.null())),
      splitCursor: v.optional(v.union(v.string(), v.null())),
    }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const monthStart = getMonthStart();
    const nextMonthStart = getNextMonthStart();

    let cursor: string | null = (args.paginationOpts.cursor ?? undefined) as string | null;
    let isDone = false;
    const MAX_EMPTY_PAGES = 3;
    let emptyPages = 0;

    const page = [];
    while (page.length < (args.paginationOpts.numItems ?? 20) && !isDone && emptyPages < MAX_EMPTY_PAGES) {
      const results = await ctx.db
        .query("tenants")
        .withIndex("by_status")
        .paginate({ numItems: args.paginationOpts.numItems ?? 20, cursor: (cursor ?? undefined) as string });

      isDone = results.isDone;
      cursor = results.continueCursor;

      for (const tenant of results.page) {
        if (tenant.status === "deleted" || tenant.status === "cancelled") continue;

        const ns = { namespace: tenant._id };

        const [
          affiliatesActive,
          commissionsConfirmedThisMonth,
          clicksThisMonth,
          conversionsThisMonth,
          commissionsFlagged,
        ] = await Promise.all([
          affiliateByStatusAggregate.count(ctx, { ...ns, bounds: { prefix: ["active"] } } as any),
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
          commissionByFlagAggregate.count(ctx, { ...ns, bounds: { prefix: [true] } } as any),
        ]);

        page.push({
          tenantId: tenant._id,
          tenantName: tenant.name,
          plan: tenant.plan,
          status: tenant.status,
          affiliatesActive,
          commissionsConfirmedThisMonth,
          totalClicksThisMonth: clicksThisMonth,
          totalConversionsThisMonth: conversionsThisMonth,
          commissionsFlagged,
        });
      }

      if (page.length === 0) emptyPages++;
    }

    const sortBy = args.sortBy ?? "mrr";
    const sortKey = {
      mrr: "commissionsConfirmedThisMonth",
      affiliates: "affiliatesActive",
      commissions: "commissionsConfirmedThisMonth",
      conversions: "totalConversionsThisMonth",
    }[sortBy] as keyof (typeof page)[0];

    page.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));

    return {
      page,
      isDone,
      continueCursor: cursor,
    };
  },
});
