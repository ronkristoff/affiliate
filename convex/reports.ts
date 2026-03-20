import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { internal, api } from "./_generated/api";

// Date range validator used across multiple queries
const dateRangeValidator = v.optional(v.object({
  start: v.number(),
  end: v.number(),
}));

// Sort options validator
const sortByValidator = v.optional(v.union(
  v.literal("clicks"),
  v.literal("conversions"),
  v.literal("conversionRate"),
  v.literal("commissions"),
  v.literal("name")
));

const sortOrderValidator = v.optional(v.union(v.literal("asc"), v.literal("desc")));

/**
 * Get campaign performance list with aggregated metrics.
 * Supports date range filtering, sorting, and RBAC for sensitive data.
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
    // Verify user access
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // 1. Fetch all campaigns for tenant (or specific campaign if filtered)
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

    // 2. Fetch all clicks for tenant
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // 3. Fetch all conversions for tenant
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // 4. Fetch all commissions for tenant
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // 5. Fetch all affiliates for active affiliate count
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_status", (q) => 
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .collect();

    // Build aggregation maps
    const clickCountsByCampaign = new Map<Id<"campaigns">, number>();
    const conversionCountsByCampaign = new Map<Id<"campaigns">, number>();
    const commissionTotalsByCampaign = new Map<Id<"campaigns">, number>();
    const affiliateIdsByCampaign = new Map<Id<"campaigns">, Set<string>>();

    // Initialize maps
    for (const campaign of allCampaigns) {
      clickCountsByCampaign.set(campaign._id, 0);
      conversionCountsByCampaign.set(campaign._id, 0);
      commissionTotalsByCampaign.set(campaign._id, 0);
      affiliateIdsByCampaign.set(campaign._id, new Set());
    }

    // Aggregate clicks (filter by date range)
    for (const click of allClicks) {
      if (click.campaignId && 
          click._creationTime >= startDate && 
          click._creationTime <= endDate) {
        const count = clickCountsByCampaign.get(click.campaignId) ?? 0;
        clickCountsByCampaign.set(click.campaignId, count + 1);
        
        // Track unique affiliates
        const affiliates = affiliateIdsByCampaign.get(click.campaignId);
        if (affiliates) {
          affiliates.add(click.affiliateId);
        }
      }
    }

    // Aggregate conversions (filter by date range)
    for (const conversion of allConversions) {
      if (conversion.campaignId && 
          conversion._creationTime >= startDate && 
          conversion._creationTime <= endDate) {
        const count = conversionCountsByCampaign.get(conversion.campaignId) ?? 0;
        conversionCountsByCampaign.set(conversion.campaignId, count + 1);
      }
    }

    // Aggregate commissions (filter by date range, only confirmed)
    for (const commission of allCommissions) {
      if (commission._creationTime >= startDate && 
          commission._creationTime <= endDate) {
        const total = commissionTotalsByCampaign.get(commission.campaignId) ?? 0;
        commissionTotalsByCampaign.set(commission.campaignId, total + commission.amount);
      }
    }

    // Build final results
    const results = allCampaigns.map(campaign => {
      const clicks = clickCountsByCampaign.get(campaign._id) ?? 0;
      const conversions = conversionCountsByCampaign.get(campaign._id) ?? 0;
      const commissions = commissionTotalsByCampaign.get(campaign._id) ?? 0;
      const activeAffiliates = affiliateIdsByCampaign.get(campaign._id)?.size ?? 0;
      
      // Calculate conversion rate
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
 * Includes period-over-period comparison for delta calculation.
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
    // Previous period for comparison
    previousTotalCampaigns: v.number(),
    previousActiveCampaigns: v.number(),
    previousTotalClicks: v.number(),
    previousTotalConversions: v.number(),
    previousTotalCommissions: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify access and RBAC
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;
    const periodLength = endDate - startDate;
    const previousStartDate = startDate - periodLength;

    // Fetch all campaigns
    const allCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const totalCampaigns = allCampaigns.length;
    const activeCampaigns = allCampaigns.filter(c => c.status === "active").length;

    // Calculate previous period campaign counts
    const previousTotalCampaigns = allCampaigns.filter(c => 
      c._creationTime < startDate
    ).length;
    const previousActiveCampaigns = allCampaigns.filter(c => 
      c._creationTime < startDate && c.status === "active"
    ).length;

    // Fetch all clicks
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Fetch all conversions
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Fetch all commissions
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Calculate current period metrics
    const currentClicks = allClicks.filter(c => 
      c._creationTime >= startDate && c._creationTime <= endDate
    ).length;

    const currentConversions = allConversions.filter(c => 
      c._creationTime >= startDate && c._creationTime <= endDate
    ).length;

    const currentCommissions = allCommissions
      .filter(c => c._creationTime >= startDate && c._creationTime <= endDate)
      .reduce((sum, c) => sum + c.amount, 0);

    // Calculate previous period metrics
    const previousClicks = allClicks.filter(c => 
      c._creationTime >= previousStartDate && c._creationTime < startDate
    ).length;

    const previousConversions = allConversions.filter(c => 
      c._creationTime >= previousStartDate && c._creationTime < startDate
    ).length;

    const previousCommissions = allCommissions
      .filter(c => c._creationTime >= previousStartDate && c._creationTime < startDate)
      .reduce((sum, c) => sum + c.amount, 0);

    // Calculate average conversion rate
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
    // Verify access
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    // Get campaign
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Verify tenant ownership
    if (campaign.tenantId !== authUser.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // Fetch data
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .collect();

    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", campaign.tenantId))
      .collect();

    // Filter data for this campaign
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
      if (commission.status === "confirmed") {
        commissionBreakdown.confirmed += commission.amount;
      } else if (commission.status === "pending") {
        commissionBreakdown.pending += commission.amount;
      } else if (commission.status === "reversed") {
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
      if (commission.status === "confirmed") {
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
      if (bucket && commission.status === "confirmed") {
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

    // Fetch data
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

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

    // Aggregate clicks
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

    // Aggregate conversions
    for (const conversion of allConversions) {
      if (conversion.campaignId && 
          conversion._creationTime >= args.startDate && 
          conversion._creationTime <= args.endDate) {
        const data = campaignData.get(conversion.campaignId);
        if (data) data.conversions++;
      }
    }

    // Aggregate commissions
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

// ============================================
// Affiliate Reports
// ============================================

/**
 * Get affiliate performance list with aggregated metrics.
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

    // Fetch data
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Build aggregation maps
    const clickCounts = new Map<Id<"affiliates">, number>();
    const conversionCounts = new Map<Id<"affiliates">, number>();
    const commissionTotals = new Map<Id<"affiliates">, number>();

    for (const affiliate of allAffiliates) {
      clickCounts.set(affiliate._id, 0);
      conversionCounts.set(affiliate._id, 0);
      commissionTotals.set(affiliate._id, 0);
    }

    // Aggregate
    for (const click of allClicks) {
      if (click._creationTime >= startDate && 
          click._creationTime <= endDate &&
          (!args.campaignId || click.campaignId === args.campaignId)) {
        const count = clickCounts.get(click.affiliateId) ?? 0;
        clickCounts.set(click.affiliateId, count + 1);
      }
    }

    for (const conversion of allConversions) {
      if (conversion._creationTime >= startDate && 
          conversion._creationTime <= endDate &&
          (!args.campaignId || conversion.campaignId === args.campaignId)) {
        const count = conversionCounts.get(conversion.affiliateId) ?? 0;
        conversionCounts.set(conversion.affiliateId, count + 1);
      }
    }

    for (const commission of allCommissions) {
      if (commission._creationTime >= startDate && 
          commission._creationTime <= endDate &&
          (!args.campaignId || commission.campaignId === args.campaignId)) {
        const total = commissionTotals.get(commission.affiliateId) ?? 0;
        commissionTotals.set(commission.affiliateId, total + commission.amount);
      }
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

    // Fetch affiliates
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const totalAffiliates = allAffiliates.length;
    const activeAffiliates = allAffiliates.filter(a => a.status === "active").length;
    const pendingAffiliates = allAffiliates.filter(a => a.status === "pending").length;

    const previousTotalAffiliates = allAffiliates.filter(a => 
      a._creationTime < startDate
    ).length;
    const previousActiveAffiliates = allAffiliates.filter(a => 
      a._creationTime < startDate && a.status === "active"
    ).length;

    // Fetch clicks, conversions, commissions
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Calculate current period
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

    // Calculate previous period
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

    // Fetch data
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    const allCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", affiliate.tenantId))
      .collect();

    // Filter by date
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
      if (commission.status === "confirmed") commissionBreakdown.confirmed += commission.amount;
      else if (commission.status === "pending") commissionBreakdown.pending += commission.amount;
      else if (commission.status === "reversed") commissionBreakdown.reversed += commission.amount;
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
      const stats = campaignStats.get(commission.campaignId);
      if (stats) stats.commissions += commission.amount;
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
      if (bucket && commission.status === "confirmed") {
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
      .collect();

    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

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

// ============================================
// Export Actions (moved to reportsExport.ts to allow "use node" runtime)
// ============================================

// ============================================
// NEW: Program Report Functions
// ============================================

/**
 * Get program-level summary metrics.
 * Includes aggregated data across all campaigns with period-over-period comparison.
 */
export const getProgramSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    mrrInfluenced: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    avgConversionRate: v.number(),
    previousTotalClicks: v.number(),
    previousTotalConversions: v.number(),
    previousTotalCommissions: v.number(),
    previousAvgConversionRate: v.number(),
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

    // Fetch data
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Calculate current period
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

    // Calculate previous period
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

    // Calculate conversion rates
    const avgConversionRate = currentClicks > 0 
      ? Math.round((currentConversions / currentClicks) * 10000) / 100 
      : 0;

    const previousAvgConversionRate = previousClicks > 0 
      ? Math.round((previousConversions / previousClicks) * 10000) / 100 
      : 0;

    const mrrInfluenced = canViewSensitiveData ? currentCommissions : 0;

    return {
      mrrInfluenced,
      totalClicks: currentClicks,
      totalConversions: currentConversions,
      totalCommissions: canViewSensitiveData ? currentCommissions : 0,
      avgConversionRate,
      previousTotalClicks: previousClicks,
      previousTotalConversions: previousConversions,
      previousTotalCommissions: canViewSensitiveData ? previousCommissions : 0,
      previousAvgConversionRate,
    };
  },
});

/**
 * Get top affiliates by revenue for the program.
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

    // Fetch data
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

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

    for (const click of allClicks) {
      if (click._creationTime >= startDate && 
          click._creationTime <= endDate &&
          (!args.campaignId || click.campaignId === args.campaignId)) {
        const stats = affiliateStats.get(click.affiliateId);
        if (stats) stats.clicks++;
      }
    }

    for (const conversion of allConversions) {
      if (conversion._creationTime >= startDate && 
          conversion._creationTime <= endDate &&
          (!args.campaignId || conversion.campaignId === args.campaignId)) {
        const stats = affiliateStats.get(conversion.affiliateId);
        if (stats) stats.conversions++;
      }
    }

    for (const commission of allCommissions) {
      if (commission._creationTime >= startDate && 
          commission._creationTime <= endDate &&
          commission.status === "confirmed" &&
          (!args.campaignId || commission.campaignId === args.campaignId)) {
        const stats = affiliateStats.get(commission.affiliateId);
        if (stats) stats.commissions += commission.amount;
      }
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
