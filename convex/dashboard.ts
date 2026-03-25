import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./tenantContext";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Dashboard Queries
 * 
 * Provides comprehensive dashboard data for SaaS Owners and Managers.
 * All queries support real-time subscriptions via Convex.
 * 
 * FIXED: 
 * - N+1 query issues by fetching all data upfront
 * - MRR calculation now uses subscription amounts from conversions
 * - Added RBAC role verification
 * - Database-level filtering where possible
 */

// Date range validator used across multiple queries
const dateRangeValidator = v.optional(v.object({
  start: v.number(),
  end: v.number(),
}));

/**
 * Get comprehensive dashboard statistics for the owner dashboard.
 * Includes MRR influenced, active affiliates, pending commissions, and more.
 */
export const getOwnerDashboardStats = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
  },
  returns: v.object({
    mrrInfluenced: v.number(),
    activeAffiliatesCount: v.number(),
    pendingCommissionsCount: v.number(),
    pendingCommissionsValue: v.number(),
    totalPaidOut: v.number(),
    recentClicks: v.number(),
    recentConversions: v.number(),
    previousPeriodMrr: v.number(),
    mrrChangePercent: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role (viewer can only see limited data)
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;
    const previousStartDate = startDate - (endDate - startDate);

    // Read from denormalized tenantStats — eliminates 2 table scans (affiliates, payouts)
    const tenantStatsDoc = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    const activeAffiliatesCount = tenantStatsDoc?.affiliatesActive ?? 0;
    const pendingCommissionsCount = tenantStatsDoc?.commissionsPendingCount ?? 0;
    const pendingCommissionsValue = tenantStatsDoc?.commissionsPendingValue ?? 0;
    const totalPaidOut = tenantStatsDoc?.totalPaidOut ?? 0;

    // 2. Get all commissions for this tenant once (capped for scalability)
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1500);

    // Get ALL conversions upfront (for MRR calculation) — capped
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(800);

    // Calculate MRR from approved commissions with subscription amounts (FIXED: AC1 requirement)
    // Filter approved commissions in date range first
    const approvedCommissions = allCommissions.filter(c => {
      const createdAt = c._creationTime;
      return c.status === "approved" && createdAt >= startDate && createdAt <= endDate;
    });

    // For each approved commission, get the subscription/conversion amount for MRR
    let mrrInfluenced = 0;
    for (const commission of approvedCommissions) {
      if (commission.conversionId) {
        const conversion = allConversions.find(c => c._id === commission.conversionId);
        if (conversion) {
          mrrInfluenced += conversion.amount;
        } else {
          mrrInfluenced += commission.amount;
        }
      } else {
        mrrInfluenced += commission.amount;
      }
    }

    // Calculate previous period MRR
    const previousPeriodCommissions = allCommissions.filter(c => {
      const createdAt = c._creationTime;
      return c.status === "approved" && createdAt >= previousStartDate && createdAt < startDate;
    });

    let previousPeriodMrr = 0;
    for (const commission of previousPeriodCommissions) {
      if (commission.conversionId) {
        const conversion = allConversions.find(c => c._id === commission.conversionId);
        if (conversion) {
          previousPeriodMrr += conversion.amount;
        } else {
          previousPeriodMrr += commission.amount;
        }
      } else {
        previousPeriodMrr += commission.amount;
      }
    }

    // Calculate MRR change percentage
    const mrrChangePercent = previousPeriodMrr > 0 
      ? Math.round(((mrrInfluenced - previousPeriodMrr) / previousPeriodMrr) * 100)
      : 0;

    // 4. Get recent clicks in date range — capped
    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(1000);
    const recentClicks = clicks.filter(c => {
      const createdAt = c._creationTime;
      return createdAt >= startDate && createdAt <= endDate;
    }).length;

    // 5. Get recent conversions in date range
    const recentConversions = allConversions.filter(c => {
      const createdAt = c._creationTime;
      return createdAt >= startDate && createdAt <= endDate;
    }).length;

    return {
      mrrInfluenced,
      activeAffiliatesCount,
      pendingCommissionsCount,
      pendingCommissionsValue: canViewSensitiveData ? pendingCommissionsValue : 0,
      totalPaidOut: canViewSensitiveData ? totalPaidOut : 0,
      recentClicks,
      recentConversions,
      previousPeriodMrr,
      mrrChangePercent,
    };
  },
});

/**
 * Get recent activity feed combining commissions, affiliate signups, and payouts.
 * Returns unified activity items sorted by timestamp.
 * 
 * FIXED: Eliminated N+1 by fetching all data upfront
 */
export const getRecentActivity = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.string(),
    type: v.string(),
    title: v.string(),
    description: v.string(),
    amount: v.optional(v.number()),
    status: v.optional(v.string()),
    timestamp: v.number(),
    iconType: v.string(),
  })),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const limit = args.limit ?? 20;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const activities: Array<{
      _id: string;
      type: string;
      title: string;
      description: string;
      amount?: number;
      status?: string;
      timestamp: number;
      iconType: string;
    }> = [];

    // FIXED: Fetch ALL data upfront to avoid N+1 queries
    // Fetch all affiliates once (capped for scalability)
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(50);

    // Create affiliate lookup map
    const affiliateMap = new Map<string, typeof allAffiliates[0]>();
    for (const affiliate of allAffiliates) {
      affiliateMap.set(affiliate._id, affiliate);
    }

    // Fetch all commissions (capped)
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(50);

    // Fetch all payouts (capped)
    const allPayouts = await ctx.db
      .query("payouts")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(50);

    // 1. Commission activities - use pre-fetched data
    for (const commission of allCommissions) {
      if (commission._creationTime < startDate || commission._creationTime > endDate) continue;

      const affiliate = affiliateMap.get(commission.affiliateId);
      
      let type: string;
      let iconType: string;
      
      switch (commission.status) {
        case "approved":
          type = "commission_confirmed";
          iconType = "green";
          break;
        case "pending":
          type = "commission_pending";
          iconType = "amber";
          break;
        case "reversed":
          type = "commission_reversed";
          iconType = "red";
          break;
        default:
          type = "commission";
          iconType = "blue";
      }

      activities.push({
        _id: `commission_${commission._id}`,
        type,
        title: commission.status === "reversed" ? "Commission Reversed" : 
               commission.status === "approved" ? "Commission Approved" : "Commission Pending",
        description: affiliate ? `${affiliate.name} earned a commission` : "Commission recorded",
        amount: canViewSensitiveData ? commission.amount : undefined,
        status: commission.status,
        timestamp: commission._creationTime,
        iconType,
      });
    }

    // 2. Affiliate signup activities - use pre-fetched data
    for (const affiliate of allAffiliates) {
      if (affiliate._creationTime < startDate || affiliate._creationTime > endDate) continue;

      activities.push({
        _id: `affiliate_${affiliate._id}`,
        type: "affiliate_signup",
        title: "New Affiliate",
        description: `${affiliate.name} (${affiliate.email}) ${affiliate.status === "pending" ? "applied" : "joined"}`,
        timestamp: affiliate._creationTime,
        iconType: "blue",
      });
    }

    // 3. Payout activities - use pre-fetched data
    for (const payout of allPayouts) {
      if (payout.status !== "paid") continue;
      if (!payout.paidAt || payout.paidAt < startDate || payout.paidAt > endDate) continue;

      const affiliate = affiliateMap.get(payout.affiliateId);

      activities.push({
        _id: `payout_${payout._id}`,
        type: "payout_sent",
        title: "Payout Sent",
        description: affiliate ? `Payment sent to ${affiliate.name}` : "Payout processed",
        amount: canViewSensitiveData ? payout.amount : undefined,
        status: "paid",
        timestamp: payout.paidAt,
        iconType: "green",
      });
    }

    // 4. Self-referral detection activities
    for (const affiliate of allAffiliates) {
      if (!affiliate.fraudSignals) continue;
      
      for (const signal of affiliate.fraudSignals) {
        if (signal.timestamp < startDate || signal.timestamp > endDate) continue;
        if (signal.type !== "selfReferral") continue;

        activities.push({
          _id: `fraud_${affiliate._id}_${signal.timestamp}`,
          type: "self_referral_detected",
          title: "Self-Referral Detected",
          description: `Potential self-referral by ${affiliate.name}`,
          timestamp: signal.timestamp,
          iconType: "red",
        });
      }
    }

    // Sort by timestamp descending and limit
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, limit);
  },
});

/**
 * Get top performing affiliates ranked by revenue.
 * Returns affiliate performance metrics including clicks, conversions, and revenue.
 * 
 * FIXED: Eliminated N+1 queries by fetching all data upfront
 */
export const getTopAffiliates = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    handle: v.optional(v.string()),
    clicks: v.number(),
    conversions: v.number(),
    revenue: v.number(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const limit = args.limit ?? 10;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // FIXED: Fetch ALL data upfront to avoid N+1 queries
    // Get all affiliates for this tenant (capped)
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(200);

    // Get all clicks for this tenant (capped)
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Get all conversions for this tenant (capped)
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Get all commissions for this tenant (capped)
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(300);

    // Build affiliate ID to stats mapping
    const affiliateStatsMap = new Map<string, {
      clicks: number;
      conversions: number;
      revenue: number;
    }>();

    // Initialize stats for all affiliates
    for (const affiliate of allAffiliates) {
      affiliateStatsMap.set(affiliate._id, { clicks: 0, conversions: 0, revenue: 0 });
    }

    // Count clicks per affiliate (filter in memory by date range)
    for (const click of allClicks) {
      if (click._creationTime >= startDate && click._creationTime <= endDate) {
        const stats = affiliateStatsMap.get(click.affiliateId);
        if (stats) {
          stats.clicks++;
        }
      }
    }

    // Count conversions per affiliate
    for (const conversion of allConversions) {
      if (conversion._creationTime >= startDate && conversion._creationTime <= endDate) {
        const stats = affiliateStatsMap.get(conversion.affiliateId);
        if (stats) {
          stats.conversions++;
        }
      }
    }

    // Sum revenue per affiliate (only approved commissions)
    for (const commission of allCommissions) {
      if (commission.status === "approved" && 
          commission._creationTime >= startDate && 
          commission._creationTime <= endDate) {
        const stats = affiliateStatsMap.get(commission.affiliateId);
        if (stats) {
          stats.revenue += commission.amount;
        }
      }
    }

    // Build result array with affiliate details
    const affiliateStats = [];
    for (const affiliate of allAffiliates) {
      const stats = affiliateStatsMap.get(affiliate._id) || { clicks: 0, conversions: 0, revenue: 0 };
      
      // Apply RBAC - hide sensitive data for viewers
      affiliateStats.push({
        _id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        handle: affiliate.vanitySlug,
        clicks: stats.clicks,
        conversions: stats.conversions,
        revenue: canViewSensitiveData ? stats.revenue : 0,
        status: affiliate.status,
      });
    }

    // Sort by revenue descending and limit
    affiliateStats.sort((a, b) => b.revenue - a.revenue);
    return affiliateStats.slice(0, limit);
  },
});

/**
 * Get recent commissions with affiliate and campaign details.
 * Returns enriched commission data for dashboard display.
 * 
 * FIXED: Added RBAC and eliminated N+1 queries
 */
export const getRecentCommissions = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("commissions"),
    affiliateId: v.id("affiliates"),
    affiliateName: v.string(),
    affiliateEmail: v.string(),
    campaignName: v.string(),
    amount: v.number(),
    status: v.string(),
    createdAt: v.number(),
    planContext: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // RBAC: Check role
    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const limit = args.limit ?? 10;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    // Get commissions for this tenant (capped), then filter by date range
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(200);

    // Filter by date range and sort
    const filteredCommissions = commissions
      .filter(c => c._creationTime >= startDate && c._creationTime <= endDate)
      .slice(0, limit);

    // Batch-fetch only the referenced affiliates, campaigns, and conversions
    // (avoids the capped .take(50) table scan that misses affiliates beyond the cap)
    const affiliateIds = [...new Set(filteredCommissions.map((c) => c.affiliateId))];
    const campaignIds = [...new Set(filteredCommissions.map((c) => c.campaignId))];
    const conversionIds = [...new Set(
      filteredCommissions.map((c) => c.conversionId).filter((id): id is Id<"conversions"> => id !== undefined)
    )];

    const [affiliates, campaigns, conversions] = await Promise.all([
      Promise.all(affiliateIds.map((id) => ctx.db.get(id))) as Promise<Array<Doc<"affiliates"> | null>>,
      Promise.all(campaignIds.map((id) => ctx.db.get(id))) as Promise<Array<Doc<"campaigns"> | null>>,
      Promise.all(conversionIds.map((id) => ctx.db.get(id))) as Promise<Array<Doc<"conversions"> | null>>,
    ]);

    const affiliateMap = new Map<Id<"affiliates">, Doc<"affiliates">>();
    for (const a of affiliates) {
      if (a) affiliateMap.set(a._id, a);
    }
    const campaignMap = new Map<Id<"campaigns">, Doc<"campaigns">>();
    for (const c of campaigns) {
      if (c) campaignMap.set(c._id, c);
    }
    const conversionMap = new Map<Id<"conversions">, Doc<"conversions">>();
    for (const c of conversions) {
      if (c) conversionMap.set(c._id, c);
    }

    const enrichedCommissions = [];

    for (const commission of filteredCommissions) {
      // Use pre-fetched affiliate data
      const affiliate = affiliateMap.get(commission.affiliateId);
      
      // Use pre-fetched campaign data
      const campaign = campaignMap.get(commission.campaignId);

      // Use pre-fetched conversion data for plan context
      let planContext: string | undefined;
      if (commission.conversionId) {
        const conversion = conversionMap.get(commission.conversionId);
        if (conversion?.metadata?.subscriptionId) {
          planContext = "Subscription";
        } else if (conversion?.metadata?.orderId) {
          planContext = "One-time";
        }
      }

      enrichedCommissions.push({
        _id: commission._id,
        affiliateId: commission.affiliateId,
        affiliateName: affiliate?.name ?? "Unknown",
        affiliateEmail: affiliate?.email ?? "Unknown",
        campaignName: campaign?.name ?? "Unknown",
        amount: canViewSensitiveData ? commission.amount : 0,
        status: commission.status,
        createdAt: commission._creationTime,
        planContext,
      });
    }

    return enrichedCommissions;
  },
});

/**
 * Get plan usage information for the current tenant.
 * Shows current usage vs tier limits with warning indicators.
 */
export const getPlanUsage = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    planName: v.string(),
    affiliateCount: v.number(),
    maxAffiliates: v.number(),
    campaignCount: v.number(),
    maxCampaigns: v.number(),
    affiliateUsagePercent: v.number(),
    campaignUsagePercent: v.number(),
    affiliateWarning: v.optional(v.boolean()),
    campaignWarning: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // Get tenant details
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Get tier config
    const planName = tenant.plan || "starter";
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", planName))
      .unique();

    const UNLIMITED = -1;
    const maxAffiliates = tierConfig?.maxAffiliates ?? 100;
    const maxCampaigns = tierConfig?.maxCampaigns ?? 3;

    // Read affiliate count from denormalized tenantStats
    const tenantStatsDoc = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    const affiliateCount = (tenantStatsDoc?.affiliatesPending ?? 0)
      + (tenantStatsDoc?.affiliatesActive ?? 0)
      + (tenantStatsDoc?.affiliatesSuspended ?? 0)
      + (tenantStatsDoc?.affiliatesRejected ?? 0);

    // Count campaigns (capped)
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);
    const campaignCount = campaigns.length;

    // Calculate usage percentages
    const affiliateUsagePercent = maxAffiliates === UNLIMITED 
      ? 0 
      : Math.round((affiliateCount / maxAffiliates) * 100);
    const campaignUsagePercent = maxCampaigns === UNLIMITED 
      ? 0 
      : Math.round((campaignCount / maxCampaigns) * 100);

    // Determine warning states (80% threshold)
    const affiliateWarning = maxAffiliates !== UNLIMITED && affiliateUsagePercent >= 80;
    const campaignWarning = maxCampaigns !== UNLIMITED && campaignUsagePercent >= 80;

    return {
      planName: planName.charAt(0).toUpperCase() + planName.slice(1),
      affiliateCount,
      maxAffiliates,
      campaignCount,
      maxCampaigns,
      affiliateUsagePercent,
      campaignUsagePercent,
      affiliateWarning,
      campaignWarning,
    };
  },
});

/**
 * Get setup status for the tenant.
 * Shows which onboarding/setup tasks are complete.
 */
export const getSetupStatus = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    trackingSnippetInstalled: v.boolean(),
    saligPayConnected: v.boolean(),
    firstCampaignCreated: v.boolean(),
    firstAffiliateApproved: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // Get tenant details
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Check tracking snippet installation
    const trackingSnippetInstalled = !!tenant.trackingVerifiedAt;

    // Check SaligPay connection
    const saligPayConnected = !!tenant.saligPayCredentials?.connectedAt;

    // Check for campaigns — existence check only, use .first()
    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    const firstCampaignCreated = !!campaign;

    // Check for approved affiliates — use tenantStats or .first()
    const activeAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_status", (q) => 
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .first();
    const firstAffiliateApproved = !!activeAffiliate;

    return {
      trackingSnippetInstalled,
      saligPayConnected,
      firstCampaignCreated,
      firstAffiliateApproved,
    };
  },
});


