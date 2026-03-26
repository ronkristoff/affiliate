import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";
import { dateRangeValidator } from "./summary";

/**
 * Get conversion funnel metrics — click → conversion → confirmed commission pipeline.
 * Uses capped .take(5000) on high-volume tables with post-filter on date range.
 * RBAC: Non-owners/non-managers see commissions: 0 and funnelRate: 0.
 */
export const getConversionFunnel = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    clickToConversionRate: v.number(),
    conversionToCommissionRate: v.number(),
    overallRate: v.number(),
    topAffiliates: v.array(v.object({
      affiliateId: v.id("affiliates"),
      name: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
      funnelRate: v.number(),
    })),
    byCampaign: v.array(v.object({
      campaignId: v.id("campaigns"),
      name: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
      funnelRate: v.number(),
    })),
    totalEstimated: v.number(),
  }),
  handler: async (ctx, args) => {
    // 1. Authenticate
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // 2. RBAC
    const canViewSensitiveData = authUser.role === "owner" || authUser.role === "manager";

    // 3. Default date range to last 30 days
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const CAP = 5000;

    // 4. Query clicks — capped, post-filter by date range and campaign
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    const filteredClicks = allClicks.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    // 5. Query conversions — same pattern
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    const filteredConversions = allConversions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    // 6. Query commissions — ONLY approved (status equivalence)
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    const filteredCommissions = allCommissions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      c.status === "approved" &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    // 10. Compute totalEstimated for truncation warning
    const totalClicks = filteredClicks.length;
    const totalConversions = filteredConversions.length;
    const totalCommissions = canViewSensitiveData
      ? filteredCommissions.reduce((sum, c) => sum + c.amount, 0)
      : 0;

    const totalEstimated = allClicks.length > 0
      ? Math.round(allClicks.length * (allClicks.length / Math.max(1, filteredClicks.length)))
      : allClicks.length;

    // 7. Compute rates
    const clickToConversionRate = totalClicks > 0
      ? Math.round((totalConversions / totalClicks) * 10000) / 100
      : 0;
    const conversionToCommissionRate = totalConversions > 0
      ? Math.round((filteredCommissions.length / totalConversions) * 10000) / 100
      : 0;
    const overallRate = totalClicks > 0
      ? Math.round((filteredCommissions.length / totalClicks) * 10000) / 100
      : 0;

    // 8. Group by affiliate — topAffiliates
    const affiliateStats = new Map<string, {
      affiliateId: Id<"affiliates">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
      commissionCount: number;
    }>();

    // Collect unique affiliate IDs from all records
    const affiliateIds = new Set<string>();
    for (const click of filteredClicks) affiliateIds.add(click.affiliateId);
    for (const conv of filteredConversions) { if (conv.affiliateId) affiliateIds.add(conv.affiliateId); }
    for (const comm of filteredCommissions) affiliateIds.add(comm.affiliateId);

    // Fetch affiliate names
    for (const affiliateId of affiliateIds) {
      const affiliate = await ctx.db.get(affiliateId as Id<"affiliates">);
      if (affiliate) {
        affiliateStats.set(affiliateId, {
          affiliateId: affiliate._id,
          name: affiliate.name,
          clicks: 0,
          conversions: 0,
          commissions: 0,
          commissionCount: 0,
        });
      }
    }

    for (const click of filteredClicks) {
      const stats = affiliateStats.get(click.affiliateId);
      if (stats) stats.clicks++;
    }

    for (const conv of filteredConversions) {
      if (!conv.affiliateId) continue;
      const stats = affiliateStats.get(conv.affiliateId);
      if (stats) stats.conversions++;
    }

    for (const comm of filteredCommissions) {
      const stats = affiliateStats.get(comm.affiliateId);
      if (stats) {
        stats.commissions += comm.amount;
        stats.commissionCount++;
      }
    }

    // Build topAffiliates — sort by funnelRate desc, take top 10
    const topAffiliates: Array<{
      affiliateId: Id<"affiliates">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
      funnelRate: number;
    }> = [];

    for (const stats of affiliateStats.values()) {
      if (stats.clicks > 0) {
        const funnelRate = canViewSensitiveData
          ? Math.round((stats.commissionCount / stats.clicks) * 10000) / 100
          : 0;
        topAffiliates.push({
          affiliateId: stats.affiliateId,
          name: stats.name,
          clicks: stats.clicks,
          conversions: stats.conversions,
          commissions: stats.commissions,
          funnelRate,
        });
      }
    }

    topAffiliates.sort((a, b) => b.funnelRate - a.funnelRate);
    const topAffiliatesResult = topAffiliates.slice(0, 10);

    // 9. Group by campaign — byCampaign
    const campaignStats = new Map<string, {
      campaignId: Id<"campaigns">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
      commissionCount: number;
    }>();

    const campaignIds = new Set<string>();
    for (const click of filteredClicks) { if (click.campaignId) campaignIds.add(click.campaignId); }
    for (const conv of filteredConversions) { if (conv.campaignId) campaignIds.add(conv.campaignId); }
    for (const comm of filteredCommissions) { if (comm.campaignId) campaignIds.add(comm.campaignId); }

    for (const campaignId of campaignIds) {
      const campaign = await ctx.db.get(campaignId as Id<"campaigns">);
      if (campaign) {
        campaignStats.set(campaignId, {
          campaignId: campaign._id,
          name: campaign.name,
          clicks: 0,
          conversions: 0,
          commissions: 0,
          commissionCount: 0,
        });
      }
    }

    for (const click of filteredClicks) {
      if (click.campaignId) {
        const stats = campaignStats.get(click.campaignId);
        if (stats) stats.clicks++;
      }
    }

    for (const conv of filteredConversions) {
      if (conv.campaignId) {
        const stats = campaignStats.get(conv.campaignId);
        if (stats) stats.conversions++;
      }
    }

    for (const comm of filteredCommissions) {
      if (comm.campaignId) {
        const stats = campaignStats.get(comm.campaignId);
        if (stats) {
          stats.commissions += comm.amount;
          stats.commissionCount++;
        }
      }
    }

    // Build byCampaign — sort by clicks desc
    const byCampaign: Array<{
      campaignId: Id<"campaigns">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
      funnelRate: number;
    }> = [];

    for (const stats of campaignStats.values()) {
      if (stats.clicks > 0) {
        const funnelRate = canViewSensitiveData
          ? Math.round((stats.commissionCount / stats.clicks) * 10000) / 100
          : 0;
        byCampaign.push({
          campaignId: stats.campaignId,
          name: stats.name,
          clicks: stats.clicks,
          conversions: stats.conversions,
          commissions: stats.commissions,
          funnelRate,
        });
      }
    }

    byCampaign.sort((a, b) => b.clicks - a.clicks);

    return {
      totalClicks,
      totalConversions,
      totalCommissions,
      clickToConversionRate,
      conversionToCommissionRate,
      overallRate,
      topAffiliates: topAffiliatesResult,
      byCampaign,
      totalEstimated,
    };
  },
});

/**
 * Get funnel export data for CSV download.
 * Same logic as getConversionFunnel but returns flat list.
 * Capped at 10,000 rows.
 */
export const getFunnelExportData = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    data: v.array(v.object({
      affiliateId: v.id("affiliates"),
      name: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
      funnelRate: v.number(),
    })),
    totalEstimated: v.number(),
  }),
  handler: async (ctx, args) => {
    // Authenticate
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const canViewSensitiveData = authUser.role === "owner" || authUser.role === "manager";

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const CAP = 5000;

    // Query capped data
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    const filteredClicks = allClicks.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    const filteredConversions = allConversions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    const filteredCommissions = allCommissions.filter(c =>
      c._creationTime >= startDate &&
      c._creationTime <= endDate &&
      c.status === "approved" &&
      (!args.campaignId || c.campaignId === args.campaignId)
    );

    const totalEstimated = allClicks.length > 0
      ? Math.round(allClicks.length * (allClicks.length / Math.max(1, filteredClicks.length)))
      : allClicks.length;

    // Group by affiliate
    const affiliateStats = new Map<string, {
      affiliateId: Id<"affiliates">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
      commissionCount: number;
    }>();

    const affiliateIds = new Set<string>();
    for (const click of filteredClicks) affiliateIds.add(click.affiliateId);
    for (const conv of filteredConversions) { if (conv.affiliateId) affiliateIds.add(conv.affiliateId); }
    for (const comm of filteredCommissions) affiliateIds.add(comm.affiliateId);

    for (const affiliateId of affiliateIds) {
      const affiliate = await ctx.db.get(affiliateId as Id<"affiliates">);
      if (affiliate) {
        affiliateStats.set(affiliateId, {
          affiliateId: affiliate._id,
          name: affiliate.name,
          clicks: 0,
          conversions: 0,
          commissions: 0,
          commissionCount: 0,
        });
      }
    }

    for (const click of filteredClicks) {
      const stats = affiliateStats.get(click.affiliateId);
      if (stats) stats.clicks++;
    }

    for (const conv of filteredConversions) {
      if (!conv.affiliateId) continue;
      const stats = affiliateStats.get(conv.affiliateId);
      if (stats) stats.conversions++;
    }

    for (const comm of filteredCommissions) {
      const stats = affiliateStats.get(comm.affiliateId);
      if (stats) {
        stats.commissions += comm.amount;
        stats.commissionCount++;
      }
    }

    // Build flat list, capped at 10,000
    const data: Array<{
      affiliateId: Id<"affiliates">;
      name: string;
      clicks: number;
      conversions: number;
      commissions: number;
      funnelRate: number;
    }> = [];

    for (const stats of affiliateStats.values()) {
      if (stats.clicks > 0) {
        const funnelRate = canViewSensitiveData
          ? Math.round((stats.commissionCount / stats.clicks) * 10000) / 100
          : 0;
        data.push({
          affiliateId: stats.affiliateId,
          name: stats.name,
          clicks: stats.clicks,
          conversions: stats.conversions,
          commissions: stats.commissions,
          funnelRate,
        });
      }
    }

    // Sort by funnelRate desc for export
    data.sort((a, b) => b.funnelRate - a.funnelRate);

    return {
      data: data.slice(0, 10000),
      totalEstimated,
    };
  },
});
