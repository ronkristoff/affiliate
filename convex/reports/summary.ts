import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";

// Date range validator used across multiple queries
export const dateRangeValidator = v.optional(v.object({
  start: v.number(),
  end: v.number(),
}));

// Sort options validator
export const sortByValidator = v.optional(v.union(
  v.literal("clicks"),
  v.literal("conversions"),
  v.literal("conversionRate"),
  v.literal("commissions"),
  v.literal("name")
));

export const sortOrderValidator = v.optional(v.union(v.literal("asc"), v.literal("desc")));

// Window selector for home page preset views
export const windowValidator = v.optional(v.union(
  v.literal("thisMonth"),
  v.literal("lastMonth"),
  v.literal("last3Months")
));

/**
 * Get program-level summary metrics.
 * Reads from tenantStats for zero table scans.
 * Uses fixed window presets (thisMonth, lastMonth, last3Months) instead of arbitrary date ranges.
 */
export const getProgramSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
    window: windowValidator,
  },
  returns: v.object({
    mrrInfluenced: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    avgConversionRate: v.number(),
    commissionsFlagged: v.number(),
    totalPaidOut: v.number(),
    pendingPayoutTotal: v.number(),
    pendingPayoutCount: v.number(),
    commissionsPendingCount: v.number(),
    commissionsPendingValue: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const window = args.window ?? "thisMonth";

    // Read from tenantStats
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!stats) {
      return {
        mrrInfluenced: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalCommissions: 0,
        avgConversionRate: 0,
        commissionsFlagged: 0,
        totalPaidOut: 0,
        pendingPayoutTotal: 0,
        pendingPayoutCount: 0,
        commissionsPendingCount: 0,
        commissionsPendingValue: 0,
      };
    }

    // Select counters based on window preset
    let commissionsConfirmedValue: number;
    let commissionsConfirmedCount: number;
    let totalClicks: number;
    let totalConversions: number;

    switch (window) {
      case "lastMonth":
        commissionsConfirmedValue = stats.commissionsConfirmedValueLastMonth ?? 0;
        commissionsConfirmedCount = stats.commissionsConfirmedLastMonth ?? 0;
        totalClicks = stats.totalClicksLastMonth ?? 0;
        totalConversions = stats.totalConversionsLastMonth ?? 0;
        break;
      case "last3Months":
        commissionsConfirmedValue = stats.commissionsConfirmedValueLast3Months ?? 0;
        commissionsConfirmedCount = stats.commissionsConfirmedLast3Months ?? 0;
        totalClicks = stats.totalClicksLast3Months ?? 0;
        totalConversions = stats.totalConversionsLast3Months ?? 0;
        break;
      case "thisMonth":
      default:
        commissionsConfirmedValue = stats.commissionsConfirmedValueThisMonth;
        commissionsConfirmedCount = stats.commissionsConfirmedThisMonth;
        totalClicks = stats.totalClicksThisMonth ?? 0;
        totalConversions = stats.totalConversionsThisMonth ?? 0;
        break;
    }

    const avgConversionRate = totalClicks > 0
      ? Math.round((totalConversions / totalClicks) * 10000) / 100
      : 0;

    return {
      mrrInfluenced: canViewSensitiveData ? commissionsConfirmedValue : 0,
      totalClicks,
      totalConversions,
      totalCommissions: canViewSensitiveData ? commissionsConfirmedValue : 0,
      avgConversionRate,
      commissionsFlagged: stats.commissionsFlagged,
      totalPaidOut: canViewSensitiveData ? stats.totalPaidOut : 0,
      pendingPayoutTotal: canViewSensitiveData ? (stats.pendingPayoutTotal ?? 0) : 0,
      pendingPayoutCount: stats.pendingPayoutCount ?? 0,
      commissionsPendingCount: canViewSensitiveData ? stats.commissionsPendingCount : 0,
      commissionsPendingValue: canViewSensitiveData ? stats.commissionsPendingValue : 0,
    };
  },
});

/**
 * Get top affiliates by revenue for the program.
 * Uses capped .take() queries on by_tenant index.
 */
export const getTopAffiliatesByRevenue = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    limit: v.optional(v.number()),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.array(v.object({
    _id: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    clicks: v.number(),
    conversions: v.number(),
    commissions: v.number(),
  })),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;
    const limit = args.limit ?? 10;

    // Fetch affiliates — medium-volume table, cap at 1000
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    // Capped queries on high-volume tables using by_tenant
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(5000);

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(5000);

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(5000);

    // Post-filter on date range
    const filteredClicks = allClicks.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    const filteredConversions = allConversions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    const filteredCommissions = allCommissions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      c.status === "approved" &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    // Build stats
    const affiliateStats = new Map<string, {
      name: string;
      email: string;
      clicks: number;
      conversions: number;
      commissions: number;
    }>();

    for (const affiliate of allAffiliates) {
      affiliateStats.set(affiliate._id, {
        name: affiliate.name,
        email: affiliate.email,
        clicks: 0,
        conversions: 0,
        commissions: 0,
      });
    }

    for (const click of filteredClicks) {
      const stats = affiliateStats.get(click.affiliateId);
      if (stats) stats.clicks++;
    }

    for (const conversion of filteredConversions) {
      const stats = affiliateStats.get(conversion.affiliateId);
      if (stats) stats.conversions++;
    }

    for (const commission of filteredCommissions) {
      const stats = affiliateStats.get(commission.affiliateId);
      if (stats) stats.commissions += commission.amount;
    }

    // Build results
    const results: Array<{
      _id: Id<"affiliates">;
      name: string;
      email: string;
      clicks: number;
      conversions: number;
      commissions: number;
    }> = [];

    for (const affiliate of allAffiliates) {
      const stats = affiliateStats.get(affiliate._id);
      if (stats && (stats.clicks > 0 || stats.conversions > 0)) {
        results.push({
          _id: affiliate._id,
          name: stats.name,
          email: stats.email,
          clicks: stats.clicks,
          conversions: stats.conversions,
          commissions: canViewSensitiveData ? stats.commissions : 0,
        });
      }
    }

    results.sort((a, b) => b.commissions - a.commissions);
    return results.slice(0, limit);
  },
});
