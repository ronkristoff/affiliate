import { query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";
import { dateRangeValidator, sortByValidator, sortOrderValidator } from "./summary";

/**
 * Get campaign performance list with aggregated metrics.
 * Uses capped .take() on by_tenant indexes for date-range filtering.
 */
export const getCampaignPerformanceList = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    sortBy: sortByValidator,
    sortOrder: sortOrderValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.array(v.object({
    _id: v.id("campaigns"),
    name: v.string(),
    status: v.string(),
    description: v.optional(v.string()),
    clicks: v.number(),
    conversions: v.number(),
    conversionRate: v.number(),
    totalCommissions: v.number(),
    activeAffiliates: v.number(),
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

    // 1. Fetch all campaigns for tenant (low-volume table)
    let allCampaigns;
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      allCampaigns = campaign && campaign.tenantId === args.tenantId ? [campaign] : [];
    } else {
      allCampaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    }

    // 2. Capped queries on high-volume tables
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
      c.campaignId &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    const filteredConversions = allConversions.filter(c =>
      c.campaignId &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    const filteredCommissions = allCommissions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    // Build aggregation maps
    const clickCountsByCampaign = new Map<Id<"campaigns">, number>();
    const conversionCountsByCampaign = new Map<Id<"campaigns">, number>();
    const commissionTotalsByCampaign = new Map<Id<"campaigns">, number>();
    const affiliateIdsByCampaign = new Map<Id<"campaigns">, Set<string>>();

    for (const campaign of allCampaigns) {
      clickCountsByCampaign.set(campaign._id, 0);
      conversionCountsByCampaign.set(campaign._id, 0);
      commissionTotalsByCampaign.set(campaign._id, 0);
      affiliateIdsByCampaign.set(campaign._id, new Set());
    }

    for (const click of filteredClicks) {
      if (!click.campaignId) continue;
      const count = clickCountsByCampaign.get(click.campaignId) ?? 0;
      clickCountsByCampaign.set(click.campaignId, count + 1);
      const affiliates = affiliateIdsByCampaign.get(click.campaignId);
      if (affiliates) affiliates.add(click.affiliateId);
    }

    for (const conversion of filteredConversions) {
      if (!conversion.campaignId) continue;
      const count = conversionCountsByCampaign.get(conversion.campaignId) ?? 0;
      conversionCountsByCampaign.set(conversion.campaignId, count + 1);
    }

    for (const commission of filteredCommissions) {
      if (!commission.campaignId) continue;
      const total = commissionTotalsByCampaign.get(commission.campaignId) ?? 0;
      commissionTotalsByCampaign.set(commission.campaignId, total + commission.amount);
    }

    // Build final results
    const results = allCampaigns.map(campaign => {
      const clicks = clickCountsByCampaign.get(campaign._id) ?? 0;
      const conversions = conversionCountsByCampaign.get(campaign._id) ?? 0;
      const commissions = commissionTotalsByCampaign.get(campaign._id) ?? 0;
      const activeAffiliates = affiliateIdsByCampaign.get(campaign._id)?.size ?? 0;

      const conversionRate = clicks > 0
        ? Math.round((conversions / clicks) * 10000) / 100
        : 0;

      return {
        _id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        description: campaign.description,
        clicks,
        conversions,
        conversionRate,
        totalCommissions: canViewSensitiveData ? commissions : 0,
        activeAffiliates,
      };
    });

    // Apply sorting
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
 * Get summary metrics across all campaigns.
 * Reads affiliate counts from tenantStats. Uses capped .take() for activity metrics.
 */
export const getCampaignSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
  },
  returns: v.object({
    totalCampaigns: v.number(),
    activeCampaigns: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    avgConversionRate: v.number(),
    previousTotalCampaigns: v.number(),
    previousActiveCampaigns: v.number(),
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

    // Fetch campaigns (low-volume table)
    const allCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const totalCampaigns = allCampaigns.length;
    const activeCampaigns = allCampaigns.filter(c => c.status === "active").length;

    const previousTotalCampaigns = allCampaigns.filter(c =>
      c._creationTime < startDate
    ).length;
    const previousActiveCampaigns = allCampaigns.filter(c =>
      c._creationTime < startDate && c.status === "active"
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
      c._creationTime >= startDate && c._creationTime <= endDate
    ).length;

    const currentConversions = allConversions.filter(c =>
      c._creationTime >= startDate && c._creationTime <= endDate
    ).length;

    const currentCommissions = allCommissions
      .filter(c => c._creationTime >= startDate && c._creationTime <= endDate)
      .reduce((sum, c) => sum + c.amount, 0);

    const previousClicks = allClicks.filter(c =>
      c._creationTime >= previousStartDate && c._creationTime < startDate
    ).length;

    const previousConversions = allConversions.filter(c =>
      c._creationTime >= previousStartDate && c._creationTime < startDate
    ).length;

    const previousCommissions = allCommissions
      .filter(c => c._creationTime >= previousStartDate && c._creationTime < startDate)
      .reduce((sum, c) => sum + c.amount, 0);

    const avgConversionRate = currentClicks > 0
      ? Math.round((currentConversions / currentClicks) * 10000) / 100
      : 0;

    return {
      totalCampaigns,
      activeCampaigns,
      totalClicks: currentClicks,
      totalConversions: currentConversions,
      totalCommissions: canViewSensitiveData ? currentCommissions : 0,
      avgConversionRate,
      previousTotalCampaigns,
      previousActiveCampaigns,
      previousTotalClicks: previousClicks,
      previousTotalConversions: previousConversions,
      previousTotalCommissions: canViewSensitiveData ? previousCommissions : 0,
    };
  },
});

/**
 * Get detailed performance metrics for a specific campaign.
 */
export const getCampaignPerformanceDetails = query({
  args: {
    campaignId: v.id("campaigns"),
    dateRange: dateRangeValidator,
  },
  returns: v.object({
    campaign: v.object({
      _id: v.id("campaigns"),
      name: v.string(),
      status: v.string(),
      description: v.optional(v.string()),
      commissionType: v.string(),
      commissionValue: v.number(),
    }),
    metrics: v.object({
      clicks: v.number(),
      conversions: v.number(),
      conversionRate: v.number(),
      totalCommissions: v.number(),
      activeAffiliates: v.number(),
      commissionBreakdown: v.object({
        confirmed: v.number(),
        pending: v.number(),
        reversed: v.number(),
      }),
    }),
    topAffiliates: v.array(v.object({
      _id: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      revenue: v.number(),
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

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.tenantId !== authUser.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // Capped queries on high-volume tables
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .order("desc")
      .take(5000);

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .order("desc")
      .take(5000);

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .order("desc")
      .take(5000);

    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .collect();

    // Post-filter for this campaign and date range
    const campaignClicks = allClicks.filter(c =>
      c.campaignId === args.campaignId &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    const campaignConversions = allConversions.filter(c =>
      c.campaignId === args.campaignId &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    const campaignCommissions = allCommissions.filter(c =>
      c.campaignId === args.campaignId &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    // Calculate metrics
    const clicks = campaignClicks.length;
    const conversions = campaignConversions.length;
    const conversionRate = clicks > 0
      ? Math.round((conversions / clicks) * 10000) / 100
      : 0;
    const totalCommissions = campaignCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Count unique affiliates
    const uniqueAffiliateIds = new Set<string>();
    for (const click of campaignClicks) {
      uniqueAffiliateIds.add(click.affiliateId);
    }
    const activeAffiliates = uniqueAffiliateIds.size;

    // Commission breakdown
    const commissionBreakdown = {
      confirmed: 0,
      pending: 0,
      reversed: 0,
    };

    for (const commission of campaignCommissions) {
      if (commission.status === "confirmed" || commission.status === "approved") {
        commissionBreakdown.confirmed += commission.amount;
      } else if (commission.status === "pending") {
        commissionBreakdown.pending += commission.amount;
      } else if (commission.status === "reversed" || commission.status === "declined") {
        commissionBreakdown.reversed += commission.amount;
      }
    }

    // Build top affiliates
    const affiliateStats = new Map<string, { clicks: number; conversions: number; revenue: number }>();

    for (const click of campaignClicks) {
      const stats = affiliateStats.get(click.affiliateId) ?? { clicks: 0, conversions: 0, revenue: 0 };
      stats.clicks++;
      affiliateStats.set(click.affiliateId, stats);
    }

    for (const conversion of campaignConversions) {
      const stats = affiliateStats.get(conversion.affiliateId);
      if (stats) stats.conversions++;
    }

    for (const commission of campaignCommissions) {
      if (commission.status === "confirmed" || commission.status === "approved") {
        const stats = affiliateStats.get(commission.affiliateId);
        if (stats) stats.revenue += commission.amount;
      }
    }

    const topAffiliates: Array<{
      _id: Id<"affiliates">;
      name: string;
      email: string;
      clicks: number;
      conversions: number;
      revenue: number;
    }> = [];

    for (const affiliate of allAffiliates) {
      const stats = affiliateStats.get(affiliate._id);
      if (stats && (stats.clicks > 0 || stats.conversions > 0)) {
        topAffiliates.push({
          _id: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          clicks: stats.clicks,
          conversions: stats.conversions,
          revenue: canViewSensitiveData ? stats.revenue : 0,
        });
      }
    }

    topAffiliates.sort((a, b) => b.revenue - a.revenue);

    // Generate trend data
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

    for (const click of campaignClicks) {
      const bucketKey = Math.floor(click._creationTime / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.clicks++;
    }

    for (const conversion of campaignConversions) {
      const bucketKey = Math.floor(conversion._creationTime / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.conversions++;
    }

    for (const commission of campaignCommissions) {
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
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        description: campaign.description,
        commissionType: campaign.commissionType,
        commissionValue: campaign.commissionValue,
      },
      metrics: {
        clicks,
        conversions,
        conversionRate,
        totalCommissions: canViewSensitiveData ? totalCommissions : 0,
        activeAffiliates,
        commissionBreakdown: canViewSensitiveData ? commissionBreakdown : { confirmed: 0, pending: 0, reversed: 0 },
      },
      topAffiliates: topAffiliates.slice(0, 10),
      trendData,
    };
  },
});

/**
 * Helper query to get export data - used by export action.
 * Capped at 10,000 rows.
 */
export const getCampaignExportData = query({
  args: {
    tenantId: v.id("tenants"),
    startDate: v.number(),
    endDate: v.number(),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.array(v.object({
    campaignId: v.id("campaigns"),
    name: v.string(),
    status: v.string(),
    clicks: v.number(),
    conversions: v.number(),
    commissions: v.number(),
    activeAffiliates: v.number(),
  })),
  handler: async (ctx, args) => {
    // Fetch campaigns
    let campaigns;
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      campaigns = campaign && campaign.tenantId === args.tenantId ? [campaign] : [];
    } else {
      campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .collect();
    }

    // Capped queries
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

    // Build aggregation maps
    const campaignData = new Map<string, {
      name: string;
      status: string;
      clicks: number;
      conversions: number;
      commissions: number;
      affiliateIds: Set<string>;
    }>();

    for (const campaign of campaigns) {
      campaignData.set(campaign._id, {
        name: campaign.name,
        status: campaign.status,
        clicks: 0,
        conversions: 0,
        commissions: 0,
        affiliateIds: new Set(),
      });
    }

    // Post-filter on date range
    for (const click of allClicks) {
      if (click.campaignId &&
          click._creationTime >= args.startDate &&
          click._creationTime <= args.endDate) {
        const data = campaignData.get(click.campaignId);
        if (data) {
          data.clicks++;
          data.affiliateIds.add(click.affiliateId);
        }
      }
    }

    for (const conversion of allConversions) {
      if (conversion.campaignId &&
          conversion._creationTime >= args.startDate &&
          conversion._creationTime <= args.endDate) {
        const data = campaignData.get(conversion.campaignId);
        if (data) data.conversions++;
      }
    }

    for (const commission of allCommissions) {
      if (commission._creationTime >= args.startDate &&
          commission._creationTime <= args.endDate) {
        const data = campaignData.get(commission.campaignId);
        if (data) data.commissions += commission.amount;
      }
    }

    return Array.from(campaignData.entries()).map(([campaignId, data]) => ({
      campaignId: campaignId as Id<"campaigns">,
      name: data.name,
      status: data.status,
      clicks: data.clicks,
      conversions: data.conversions,
      commissions: data.commissions,
      activeAffiliates: data.affiliateIds.size,
    }));
  },
});

/**
 * Get cost efficiency metrics for up to 3 campaigns.
 * Used for side-by-side campaign comparison in owner reports.
 * Non-owners/non-managers see totalCommissions and costPerConversion as 0.
 */
export const getCampaignCostEfficiency = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignIds: v.array(v.id("campaigns")),
  },
  returns: v.array(v.object({
    campaignId: v.id("campaigns"),
    name: v.string(),
    clicks: v.number(),
    conversions: v.number(),
    conversionRate: v.number(),
    totalCommissions: v.number(),
    costPerConversion: v.number(),
    convEfficiency: v.number(),
  })),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const canViewSensitiveData = authUser.role === "owner" || authUser.role === "manager";

    // Limit to 3 campaigns for comparison
    if (args.campaignIds.length > 3) {
      throw new ConvexError("Maximum 3 campaigns can be compared at once");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // Fetch campaign documents
    const campaignDocs = await Promise.all(
      args.campaignIds.map(id => ctx.db.get(id))
    );

    // Filter to only valid campaigns belonging to this tenant
    const validCampaigns = campaignDocs.filter(
      (doc): doc is NonNullable<typeof doc> =>
        doc !== null && doc.tenantId === args.tenantId
    );

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

    // Build a set of requested campaign IDs for fast lookup
    const campaignIdSet = new Set(args.campaignIds.map(id => id.toString()));

    // Post-filter: only records matching requested campaigns and within date range
    const filteredClicks = allClicks.filter(c =>
      c.campaignId &&
      campaignIdSet.has(c.campaignId.toString()) &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    const filteredConversions = allConversions.filter(c =>
      c.campaignId &&
      campaignIdSet.has(c.campaignId.toString()) &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate
    );

    // Only count confirmed/approved commissions (status equivalence)
    const filteredCommissions = allCommissions.filter(c =>
      c.campaignId &&
      campaignIdSet.has(c.campaignId.toString()) &&
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (c.status === "confirmed" || c.status === "approved")
    );

    // Build aggregation maps keyed by campaign ID
    const clickCounts = new Map<string, number>();
    const conversionCounts = new Map<string, number>();
    const commissionTotals = new Map<string, number>();

    for (const campaign of validCampaigns) {
      clickCounts.set(campaign._id, 0);
      conversionCounts.set(campaign._id, 0);
      commissionTotals.set(campaign._id, 0);
    }

    for (const click of filteredClicks) {
      if (!click.campaignId) continue;
      const count = clickCounts.get(click.campaignId) ?? 0;
      clickCounts.set(click.campaignId, count + 1);
    }

    for (const conversion of filteredConversions) {
      if (!conversion.campaignId) continue;
      const count = conversionCounts.get(conversion.campaignId) ?? 0;
      conversionCounts.set(conversion.campaignId, count + 1);
    }

    for (const commission of filteredCommissions) {
      if (!commission.campaignId) continue;
      const total = commissionTotals.get(commission.campaignId) ?? 0;
      commissionTotals.set(commission.campaignId, total + commission.amount);
    }

    // Build final results with calculated efficiency metrics
    return validCampaigns.map(campaign => {
      const clicks = clickCounts.get(campaign._id) ?? 0;
      const conversions = conversionCounts.get(campaign._id) ?? 0;
      const commissions = commissionTotals.get(campaign._id) ?? 0;

      const conversionRate = clicks > 0
        ? Math.round((conversions / clicks) * 10000) / 100
        : 0;

      const costPerConversion = conversions > 0
        ? Math.round((commissions / conversions) * 100) / 100
        : 0;

      // convEfficiency mirrors conversionRate but is labeled differently for UI clarity
      const convEfficiency = conversionRate;

      return {
        campaignId: campaign._id,
        name: campaign.name,
        clicks,
        conversions,
        conversionRate,
        totalCommissions: canViewSensitiveData ? commissions : 0,
        costPerConversion: canViewSensitiveData ? costPerConversion : 0,
        convEfficiency,
      };
    });
  },
});
