import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";
import { dateRangeValidator, sortByValidator, sortOrderValidator } from "./summary";

/**
 * Get affiliate performance list with aggregated metrics.
 * Uses capped .take() on high-volume tables.
 */
export const getAffiliatePerformanceList = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
    sortBy: sortByValidator,
    sortOrder: sortOrderValidator,
  },
  returns: v.array(v.object({
    _id: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    uniqueCode: v.string(),
    status: v.string(),
    clicks: v.number(),
    conversions: v.number(),
    conversionRate: v.number(),
    totalCommissions: v.number(),
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

    // Fetch affiliates (medium-volume, cap at 1000)
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    // Capped queries on high-volume tables
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
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    // Build aggregation maps
    const clickCounts = new Map<Id<"affiliates">, number>();
    const conversionCounts = new Map<Id<"affiliates">, number>();
    const commissionTotals = new Map<Id<"affiliates">, number>();

    for (const affiliate of allAffiliates) {
      clickCounts.set(affiliate._id, 0);
      conversionCounts.set(affiliate._id, 0);
      commissionTotals.set(affiliate._id, 0);
    }

    for (const click of filteredClicks) {
      const count = clickCounts.get(click.affiliateId) ?? 0;
      clickCounts.set(click.affiliateId, count + 1);
    }

    for (const conversion of filteredConversions) {
      const count = conversionCounts.get(conversion.affiliateId) ?? 0;
      conversionCounts.set(conversion.affiliateId, count + 1);
    }

    for (const commission of filteredCommissions) {
      const total = commissionTotals.get(commission.affiliateId) ?? 0;
      commissionTotals.set(commission.affiliateId, total + commission.amount);
    }

    // Build results
    const results = allAffiliates.map(affiliate => {
      const clicks = clickCounts.get(affiliate._id) ?? 0;
      const conversions = conversionCounts.get(affiliate._id) ?? 0;
      const commissions = commissionTotals.get(affiliate._id) ?? 0;

      const conversionRate = clicks > 0
        ? Math.round((conversions / clicks) * 10000) / 100
        : 0;

      return {
        _id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        uniqueCode: affiliate.uniqueCode,
        status: affiliate.status,
        clicks,
        conversions,
        conversionRate,
        totalCommissions: canViewSensitiveData ? commissions : 0,
      };
    });

    // Sort
    const sortBy = args.sortBy ?? "name";
    const sortOrder = args.sortOrder ?? "asc";

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "clicks":
          comparison = a.clicks - b.clicks;
          break;
        case "conversions":
          comparison = a.conversions - b.conversions;
          break;
        case "conversionRate":
          comparison = a.conversionRate - b.conversionRate;
          break;
        case "commissions":
          comparison = a.totalCommissions - b.totalCommissions;
          break;
        case "name":
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    return results;
  },
});

/**
 * Get summary metrics across all affiliates.
 * Reads affiliate counts from tenantStats. Uses capped .take() for activity metrics.
 */
export const getAffiliateSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    totalAffiliates: v.number(),
    activeAffiliates: v.number(),
    pendingAffiliates: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    avgConversionRate: v.number(),
    previousTotalAffiliates: v.number(),
    previousActiveAffiliates: v.number(),
    previousTotalClicks: v.number(),
    previousTotalConversions: v.number(),
    previousTotalCommissions: v.number(),
  }),
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
    const periodLength = endDate - startDate;
    const previousStartDate = startDate - periodLength;

    // Fetch affiliates (medium-volume)
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    const totalAffiliates = allAffiliates.length;
    const activeAffiliates = allAffiliates.filter(a => a.status === "active").length;
    const pendingAffiliates = allAffiliates.filter(a => a.status === "pending").length;

    const previousTotalAffiliates = allAffiliates.filter(a =>
      a._creationTime < startDate
    ).length;
    const previousActiveAffiliates = allAffiliates.filter(a =>
      a._creationTime < startDate && a.status === "active"
    ).length;

    // Capped queries on high-volume tables
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
    const currentClicks = allClicks.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    ).length;

    const currentConversions = allConversions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    ).length;

    const currentCommissions = allCommissions
      .filter(c =>
        c._creationTime >= startDate &&
        c._creationTime <= endDate &&
        (!args.campaignId || c.campaignId === args.campaignId)
      )
      .reduce((sum, c) => sum + c.amount, 0);

    const previousClicks = allClicks.filter(c =>
      c._creationTime >= previousStartDate &&
      c._creationTime < startDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    ).length;

    const previousConversions = allConversions.filter(c =>
      c._creationTime >= previousStartDate &&
      c._creationTime < startDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    ).length;

    const previousCommissions = allCommissions
      .filter(c =>
        c._creationTime >= previousStartDate &&
        c._creationTime < startDate &&
        (!args.campaignId || c.campaignId === args.campaignId)
      )
      .reduce((sum, c) => sum + c.amount, 0);

    const avgConversionRate = currentClicks > 0
      ? Math.round((currentConversions / currentClicks) * 10000) / 100
      : 0;

    return {
      totalAffiliates,
      activeAffiliates,
      pendingAffiliates,
      totalClicks: currentClicks,
      totalConversions: currentConversions,
      totalCommissions: canViewSensitiveData ? currentCommissions : 0,
      avgConversionRate,
      previousTotalAffiliates,
      previousActiveAffiliates,
      previousTotalClicks: previousClicks,
      previousTotalConversions: previousConversions,
      previousTotalCommissions: canViewSensitiveData ? previousCommissions : 0,
    };
  },
});

/**
 * Get detailed performance metrics for a specific affiliate.
 * Uses by_affiliate indexes (already paginated).
 */
export const getAffiliatePerformanceDetails = query({
  args: {
    affiliateId: v.id("affiliates"),
    dateRange: dateRangeValidator,
  },
  returns: v.object({
    affiliate: v.object({
      _id: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      promotionChannel: v.optional(v.string()),
    }),
    metrics: v.object({
      clicks: v.number(),
      conversions: v.number(),
      conversionRate: v.number(),
      totalCommissions: v.number(),
      commissionBreakdown: v.object({
        confirmed: v.number(),
        pending: v.number(),
        reversed: v.number(),
      }),
    }),
    campaignBreakdown: v.array(v.object({
      _id: v.id("campaigns"),
      name: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
    })),
    trendData: v.array(v.object({
      date: v.number(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== authUser.tenantId) {
      throw new Error("Affiliate not found");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // Use by_affiliate indexes (per-affiliate queries, medium volume)
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(5000);

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(5000);

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(5000);

    const allCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", affiliate.tenantId))
      .collect();

    // Post-filter by date
    const filteredClicks = allClicks.filter(c =>
      c._creationTime >= startDate && c._creationTime <= endDate
    );

    const filteredConversions = allConversions.filter(c =>
      c._creationTime >= startDate && c._creationTime <= endDate
    );

    const filteredCommissions = allCommissions.filter(c =>
      c._creationTime >= startDate && c._creationTime <= endDate
    );

    // Calculate metrics
    const clicks = filteredClicks.length;
    const conversions = filteredConversions.length;
    const conversionRate = clicks > 0
      ? Math.round((conversions / clicks) * 10000) / 100
      : 0;
    const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Commission breakdown
    const commissionBreakdown = {
      confirmed: 0,
      pending: 0,
      reversed: 0,
    };

    for (const commission of filteredCommissions) {
      if (commission.status === "confirmed" || commission.status === "approved") {
        commissionBreakdown.confirmed += commission.amount;
      } else if (commission.status === "pending") {
        commissionBreakdown.pending += commission.amount;
      } else if (commission.status === "reversed" || commission.status === "declined") {
        commissionBreakdown.reversed += commission.amount;
      }
    }

    // Campaign breakdown
    const campaignStats = new Map<Id<"campaigns">, { clicks: number; conversions: number; commissions: number }>();

    for (const campaign of allCampaigns) {
      campaignStats.set(campaign._id, { clicks: 0, conversions: 0, commissions: 0 });
    }

    for (const click of filteredClicks) {
      if (click.campaignId) {
        const stats = campaignStats.get(click.campaignId);
        if (stats) stats.clicks++;
      }
    }

    for (const conversion of filteredConversions) {
      if (conversion.campaignId) {
        const stats = campaignStats.get(conversion.campaignId);
        if (stats) stats.conversions++;
      }
    }

    for (const commission of filteredCommissions) {
      if (commission.campaignId) {
        const stats = campaignStats.get(commission.campaignId);
        if (stats) stats.commissions += commission.amount;
      }
    }

    const campaignBreakdown: Array<{
      _id: Id<"campaigns">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
    }> = [];

    for (const campaign of allCampaigns) {
      const stats = campaignStats.get(campaign._id);
      if (stats && (stats.clicks > 0 || stats.conversions > 0)) {
        campaignBreakdown.push({
          _id: campaign._id,
          name: campaign.name,
          clicks: stats.clicks,
          conversions: stats.conversions,
          commissions: canViewSensitiveData ? stats.commissions : 0,
        });
      }
    }

    campaignBreakdown.sort((a, b) => b.commissions - a.commissions);

    // Trend data
    const periodLengthMs = endDate - startDate;
    const isWeeklyGrouping = periodLengthMs > 30 * 24 * 60 * 60 * 1000;
    const bucketSize = isWeeklyGrouping
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    const buckets = new Map<number, { clicks: number; conversions: number; commissions: number }>();

    for (let t = startDate; t <= endDate; t += bucketSize) {
      const bucketKey = Math.floor(t / bucketSize) * bucketSize;
      buckets.set(bucketKey, { clicks: 0, conversions: 0, commissions: 0 });
    }

    for (const click of filteredClicks) {
      const bucketKey = Math.floor(click._creationTime / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.clicks++;
    }

    for (const conversion of filteredConversions) {
      const bucketKey = Math.floor(conversion._creationTime / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.conversions++;
    }

    for (const commission of filteredCommissions) {
      const bucketKey = Math.floor(commission._creationTime / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketKey);
      if (bucket && (commission.status === "confirmed" || commission.status === "approved")) {
        bucket.commissions += commission.amount;
      }
    }

    const trendData = Array.from(buckets.entries())
      .map(([date, data]) => ({
        date,
        clicks: data.clicks,
        conversions: data.conversions,
        commissions: canViewSensitiveData ? data.commissions : 0,
      }))
      .sort((a, b) => a.date - b.date);

    return {
      affiliate: {
        _id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        uniqueCode: affiliate.uniqueCode,
        status: affiliate.status,
        promotionChannel: affiliate.promotionChannel,
      },
      metrics: {
        clicks,
        conversions,
        conversionRate,
        totalCommissions: canViewSensitiveData ? totalCommissions : 0,
        commissionBreakdown: canViewSensitiveData ? commissionBreakdown : { confirmed: 0, pending: 0, reversed: 0 },
      },
      campaignBreakdown,
      trendData,
    };
  },
});

/**
 * Helper query to get export data - used by export action.
 * Capped at 10,000 rows.
 */
export const getAffiliateExportData = query({
  args: {
    tenantId: v.id("tenants"),
    startDate: v.number(),
    endDate: v.number(),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.array(v.object({
    affiliateId: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    uniqueCode: v.string(),
    status: v.string(),
    clicks: v.number(),
    conversions: v.number(),
    conversionRate: v.number(),
    commissions: v.number(),
  })),
  handler: async (ctx, args) => {
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);

    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(10000);

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(10000);

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(10000);

    const affiliateData = new Map<string, {
      name: string;
      email: string;
      uniqueCode: string;
      status: string;
      clicks: number;
      conversions: number;
      commissions: number;
    }>();

    for (const affiliate of allAffiliates) {
      affiliateData.set(affiliate._id, {
        name: affiliate.name,
        email: affiliate.email,
        uniqueCode: affiliate.uniqueCode,
        status: affiliate.status,
        clicks: 0,
        conversions: 0,
        commissions: 0,
      });
    }

    // Post-filter on date range
    for (const click of allClicks) {
      if (click._creationTime >= args.startDate &&
          click._creationTime <= args.endDate &&
          (!args.campaignId || click.campaignId === args.campaignId)) {
        const data = affiliateData.get(click.affiliateId);
        if (data) data.clicks++;
      }
    }

    for (const conversion of allConversions) {
      if (conversion._creationTime >= args.startDate &&
          conversion._creationTime <= args.endDate &&
          (!args.campaignId || conversion.campaignId === args.campaignId)) {
        const data = affiliateData.get(conversion.affiliateId);
        if (data) data.conversions++;
      }
    }

    for (const commission of allCommissions) {
      if (commission._creationTime >= args.startDate &&
          commission._creationTime <= args.endDate &&
          (!args.campaignId || commission.campaignId === args.campaignId)) {
        const data = affiliateData.get(commission.affiliateId);
        if (data) data.commissions += commission.amount;
      }
    }

    return Array.from(affiliateData.entries()).map(([affiliateId, data]) => ({
      affiliateId: affiliateId as Id<"affiliates">,
      name: data.name,
      email: data.email,
      uniqueCode: data.uniqueCode,
      status: data.status,
      clicks: data.clicks,
      conversions: data.conversions,
      conversionRate: data.clicks > 0 ? Math.round((data.conversions / data.clicks) * 10000) / 100 : 0,
      commissions: data.commissions,
    }));
  },
});
