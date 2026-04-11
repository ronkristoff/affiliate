import { query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./_helpers";
import { internal } from "../_generated/api";

// =============================================================================
// Platform-wide Stats Singleton
// =============================================================================

/**
 * Read the pre-aggregated platform stats singleton.
 * If not found (first run / not yet recalculated), returns all zeros.
 */
export const getAggregatePlatformKPIs = query({
  args: {},
  returns: v.object({
    _id: v.optional(v.id("platformStats")),
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

    const stats = await ctx.db
      .query("platformStats")
      .withIndex("by_key", (q) => q.eq("key", "platform"))
      .first();

    if (!stats) {
      // Return zeros with epoch timestamp so staleness detection triggers
      return {
        _id: undefined,
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

    return stats;
  },
});

/**
 * Recalculate platformStats from all tenantStats rows.
 * Called by hourly cron. Iterates ALL tenantStats via paginate (batch size 100).
 * Skips orphaned stats (tenant deleted).
 */
export const recalculatePlatformStats = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();

    let totalMRR = 0;
    let totalActiveAffiliates = 0;
    let totalCommissions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalFraudSignals = 0;
    let activeTenantCount = 0;
    let totalPendingCommissions = 0;
    let totalApprovedCommissions = 0;
    let totalPaidOut = 0;

    // Paginate through ALL tenantStats
    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const results = await ctx.db
        .query("tenantStats")
        .withIndex("by_tenant")
        .paginate({ numItems: 100, cursor: (cursor ?? undefined) as string });

      for (const stats of results.page) {
        // Skip orphaned stats (tenant no longer exists)
        const tenant = await ctx.db.get(stats.tenantId);
        if (!tenant) continue;

        // Count active tenants (non-deleted)
        if (tenant.status !== "deleted" && tenant.status !== "cancelled") {
          activeTenantCount++;
        }

        totalMRR += 0; // MRR comes from billingHistory, not tenantStats (V1)
        totalActiveAffiliates += stats.affiliatesActive ?? 0;
        totalCommissions += (stats.commissionsPendingCount ?? 0) +
          (stats.commissionsConfirmedThisMonth ?? 0) +
          (stats.commissionsConfirmedLastMonth ?? 0);
        totalPendingCommissions += stats.commissionsPendingCount ?? 0;
        totalApprovedCommissions += (stats.commissionsConfirmedThisMonth ?? 0) +
          (stats.commissionsConfirmedLastMonth ?? 0);
        totalClicks += stats.totalClicksThisMonth ?? 0;
        totalConversions += (stats.totalConversionsThisMonth ?? 0) +
          (stats.organicConversionsThisMonth ?? 0);
        totalFraudSignals += stats.commissionsFlagged ?? 0;
        totalPaidOut += stats.totalPaidOut ?? 0;
      }

      isDone = results.isDone;
      cursor = results.continueCursor;
    }

    // Upsert the platformStats singleton
    const existing = await ctx.db
      .query("platformStats")
      .withIndex("by_key", (q) => q.eq("key", "platform"))
      .first();

    const data = {
      totalMRR,
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

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("platformStats", {
        key: "platform",
        ...data,
      });
    }

    return null;
  },
});

/**
 * Get tenant leaderboard for platform analytics.
 * Sorted by the specified metric (default: MRR → using commissions as proxy).
 * Paginated, max 100 rows.
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
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const results = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant")
      .order("desc")
      .paginate(args.paginationOpts);

    const page = [];
    for (const stats of results.page) {
      const tenant = await ctx.db.get(stats.tenantId);
      if (!tenant) continue;

      page.push({
        tenantId: stats.tenantId,
        tenantName: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        affiliatesActive: stats.affiliatesActive ?? 0,
        commissionsConfirmedThisMonth: stats.commissionsConfirmedThisMonth ?? 0,
        totalClicksThisMonth: stats.totalClicksThisMonth ?? 0,
        totalConversionsThisMonth: stats.totalConversionsThisMonth ?? 0,
        commissionsFlagged: stats.commissionsFlagged ?? 0,
      });
    }

    // Sort client-side by requested metric (in-memory, capped at pagination limit)
    const sortBy = args.sortBy ?? "mrr";
    const sortKey = {
      mrr: "commissionsConfirmedThisMonth", // Using confirmed commissions as MRR proxy for V1
      affiliates: "affiliatesActive",
      commissions: "commissionsConfirmedThisMonth",
      conversions: "totalConversionsThisMonth",
    }[sortBy] as keyof (typeof page)[0];

    page.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));

    return {
      page,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});
