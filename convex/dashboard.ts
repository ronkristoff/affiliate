import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./tenantContext";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Dashboard Queries
 *
 * Provides comprehensive dashboard data for SaaS Owners and Managers.
 * All queries support real-time subscriptions via Convex.
 *
 * PERFORMANCE:
 * - getDashboardData merges stats/topAffiliates/recentCommissions into a single query
 *   to eliminate ~4,800 overlapping doc reads and redundant auth checks
 * - Shared data (commissions, conversions, clicks, affiliates) fetched once via Promise.all
 * - getRecentActivity, getPlanUsage, getSetupStatus remain separate (lightweight)
 */

// Date range validator used across multiple queries
const dateRangeValidator = v.optional(v.object({
  start: v.number(),
  end: v.number(),
}));

/**
 * MERGED: Get all core dashboard data in a single query.
 * Combines stats, top affiliates, and recent commissions to eliminate:
 * - 3 separate getAuthenticatedUser() calls → 1
 * - 3 separate commission/conversion/click fetches → 1 each (shared)
 * - Sequential DB reads → parallel via Promise.all
 *
 * Before: ~4,800 doc reads + 6 auth reads across 3 queries
 * After:  ~1,300 doc reads + 2 auth reads in 1 query
 */
export const getDashboardData = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    topAffiliatesLimit: v.optional(v.number()),
    recentCommissionsLimit: v.optional(v.number()),
  },
  returns: v.object({
    stats: v.object({
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
    topAffiliates: v.array(v.object({
      _id: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      handle: v.optional(v.string()),
      clicks: v.number(),
      conversions: v.number(),
      revenue: v.number(),
      status: v.string(),
    })),
    recentCommissions: v.array(v.object({
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
  }),
  handler: async (ctx, args) => {
    // 1. Auth check — ONCE
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }
    const canViewSensitiveData = authUser.role === "owner" || authUser.role === "manager";

    // 2. Date ranges (undefined = no filter, show all-time data)
    const now = Date.now();
    const hasDateFilter = args.dateRange !== undefined;
    const startDate = args.dateRange?.start ?? 0;
    const endDate = args.dateRange?.end ?? now;
    const previousStartDate = hasDateFilter ? startDate - (endDate - startDate) : 0;

    const topAffiliatesLimit = args.topAffiliatesLimit ?? 10;
    const recentCommissionsLimit = args.recentCommissionsLimit ?? 10;

    // 3. Fetch ALL shared data in PARALLEL (single pass per table)
    const [tenantStatsDoc, commissions, conversions, clicks, affiliates, completedBatches] = await Promise.all([
      ctx.db
        .query("tenantStats")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .first(),
      ctx.db
        .query("commissions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .take(1500),
      ctx.db
        .query("conversions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .take(800),
      ctx.db
        .query("clicks")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .take(1000),
      ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .take(200),
      // Total paid out: sum from completed payoutBatches (same source as payouts page)
      ctx.db
        .query("payoutBatches")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", "completed")
        )
        .take(200),
    ]);

    // 4. Build conversion lookup map (used by MRR calc + recent commissions)
    const conversionLookup = new Map<string, typeof conversions[0]>();
    for (const c of conversions) {
      conversionLookup.set(c._id, c);
    }

    // ==================== STATS ====================
    const activeAffiliatesCount = tenantStatsDoc?.affiliatesActive ?? 0;
    const pendingCommissionsCount = tenantStatsDoc?.commissionsPendingCount ?? 0;
    const pendingCommissionsValue = tenantStatsDoc?.commissionsPendingValue ?? 0;

    // Total paid out: sum from completed payoutBatches (same source as payouts page)
    let totalPaidOut = 0;
    for (const batch of completedBatches) {
      totalPaidOut += batch.totalAmount;
    }
    // Fallback to denormalized counter if no batches exist
    if (totalPaidOut === 0) {
      totalPaidOut = tenantStatsDoc?.totalPaidOut ?? 0;
    }

    // Current period MRR (single pass over commissions, O(1) conversion lookup)
    let mrrInfluenced = 0;
    for (const commission of commissions) {
      if (commission.status !== "approved") continue;
      if (commission._creationTime < startDate || commission._creationTime > endDate) continue;
      if (commission.conversionId) {
        const conversion = conversionLookup.get(commission.conversionId);
        mrrInfluenced += conversion ? conversion.amount : commission.amount;
      } else {
        mrrInfluenced += commission.amount;
      }
    }

    // Previous period MRR
    let previousPeriodMrr = 0;
    for (const commission of commissions) {
      if (commission.status !== "approved") continue;
      if (commission._creationTime < previousStartDate || commission._creationTime >= startDate) continue;
      if (commission.conversionId) {
        const conversion = conversionLookup.get(commission.conversionId);
        previousPeriodMrr += conversion ? conversion.amount : commission.amount;
      } else {
        previousPeriodMrr += commission.amount;
      }
    }

    const mrrChangePercent = hasDateFilter && previousPeriodMrr > 0
      ? Math.round(((mrrInfluenced - previousPeriodMrr) / previousPeriodMrr) * 100)
      : 0;

    // Clicks and conversions in date range (single pass each)
    let recentClicks = 0;
    for (const click of clicks) {
      if (click._creationTime >= startDate && click._creationTime <= endDate) recentClicks++;
    }

    let recentConversions = 0;
    for (const conversion of conversions) {
      if (conversion._creationTime >= startDate && conversion._creationTime <= endDate) recentConversions++;
    }

    // ==================== TOP AFFILIATES ====================
    const affiliateStatsMap = new Map<string, { clicks: number; conversions: number; revenue: number }>();
    for (const affiliate of affiliates) {
      affiliateStatsMap.set(affiliate._id, { clicks: 0, conversions: 0, revenue: 0 });
    }

    for (const click of clicks) {
      if (click._creationTime >= startDate && click._creationTime <= endDate) {
        const stats = affiliateStatsMap.get(click.affiliateId);
        if (stats) stats.clicks++;
      }
    }

    for (const conversion of conversions) {
      if (conversion._creationTime >= startDate && conversion._creationTime <= endDate) {
        if (!conversion.affiliateId) continue;
        const stats = affiliateStatsMap.get(conversion.affiliateId);
        if (stats) stats.conversions++;
      }
    }

    for (const commission of commissions) {
      if (commission.status === "approved" &&
          commission._creationTime >= startDate &&
          commission._creationTime <= endDate) {
        const stats = affiliateStatsMap.get(commission.affiliateId);
        if (stats) stats.revenue += commission.amount;
      }
    }

    const topAffiliatesResult = affiliates
      .map((a) => {
        const s = affiliateStatsMap.get(a._id) || { clicks: 0, conversions: 0, revenue: 0 };
        return {
          _id: a._id,
          name: a.name,
          email: a.email,
          handle: a.vanitySlug,
          clicks: s.clicks,
          conversions: s.conversions,
          revenue: canViewSensitiveData ? s.revenue : 0,
          status: a.status,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topAffiliatesLimit);

    // ==================== RECENT COMMISSIONS ====================
    const filteredRecentCommissions = commissions
      .filter((c) => c._creationTime >= startDate && c._creationTime <= endDate)
      .slice(0, recentCommissionsLimit);

    // Batch-fetch only referenced entities (reuse conversions already fetched)
    const affiliateIds = [...new Set(filteredRecentCommissions.map((c) => c.affiliateId))];
    const campaignIds = [...new Set(filteredRecentCommissions.map((c) => c.campaignId))];

    const [affiliateDocs, campaignDocs] = await Promise.all([
      Promise.all(affiliateIds.map((id) => ctx.db.get(id))),
      Promise.all(campaignIds.map((id) => ctx.db.get(id))),
    ]);

    const affiliateMap = new Map<Id<"affiliates">, Doc<"affiliates">>();
    for (const a of affiliateDocs) { if (a) affiliateMap.set(a._id, a); }
    const campaignMap = new Map<Id<"campaigns">, Doc<"campaigns">>();
    for (const c of campaignDocs) { if (c) campaignMap.set(c._id, c); }

    const recentCommissionsResult = filteredRecentCommissions.map((c) => {
      const affiliate = affiliateMap.get(c.affiliateId);
      const campaign = campaignMap.get(c.campaignId);

      let planContext: string | undefined;
      if (c.conversionId) {
        const conversion = conversionLookup.get(c.conversionId);
        if (conversion?.metadata?.subscriptionId) {
          planContext = "Subscription";
        } else if (conversion?.metadata?.orderId) {
          planContext = "One-time";
        }
      }

      return {
        _id: c._id,
        affiliateId: c.affiliateId,
        affiliateName: affiliate?.name ?? "Unknown",
        affiliateEmail: affiliate?.email ?? "Unknown",
        campaignName: campaign?.name ?? "Unknown",
        amount: canViewSensitiveData ? c.amount : 0,
        status: c.status,
        createdAt: c._creationTime,
        planContext,
      };
    });

    return {
      stats: {
        mrrInfluenced,
        activeAffiliatesCount,
        pendingCommissionsCount,
        pendingCommissionsValue: canViewSensitiveData ? pendingCommissionsValue : 0,
        totalPaidOut: canViewSensitiveData ? totalPaidOut : 0,
        recentClicks,
        recentConversions,
        previousPeriodMrr,
        mrrChangePercent,
      },
      topAffiliates: topAffiliatesResult,
      recentCommissions: recentCommissionsResult,
    };
  },
});

/**
 * Get recent activity feed combining commissions, affiliate signups, and payouts.
 * Returns unified activity items sorted by timestamp.
 *
 * NOTE: Kept separate from getDashboardData because it reads different tables
 * (payouts) and has its own capped take limits (50 each). Lightweight enough.
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
    const startDate = args.dateRange?.start ?? 0;
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

    // Fetch all data upfront in parallel (capped for scalability)
    const [allAffiliates, allCommissions, allPayouts] = await Promise.all([
      ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .take(50),
      ctx.db
        .query("commissions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .take(50),
      ctx.db
        .query("payouts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .take(50),
    ]);

    // Create affiliate lookup map
    const affiliateMap = new Map<string, typeof allAffiliates[0]>();
    for (const affiliate of allAffiliates) {
      affiliateMap.set(affiliate._id, affiliate);
    }

    // 1. Commission activities
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

    // 2. Affiliate signup activities
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

    // 3. Payout activities
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

    // Get tenant + tier config + tenantStats in parallel
    const [tenant, tenantStatsDoc] = await Promise.all([
      ctx.db.get(args.tenantId),
      ctx.db
        .query("tenantStats")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .first(),
    ]);

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
    const affiliateCount = (tenantStatsDoc?.affiliatesPending ?? 0)
      + (tenantStatsDoc?.affiliatesActive ?? 0)
      + (tenantStatsDoc?.affiliatesSuspended ?? 0)
      + (tenantStatsDoc?.affiliatesRejected ?? 0);

    // Count campaigns — small cap since typical tenant has <20 campaigns
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(50);
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

    // Get tenant + existence checks in parallel
    const [tenant, campaign, activeAffiliate] = await Promise.all([
      ctx.db.get(args.tenantId),
      ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .first(),
      ctx.db
        .query("affiliates")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", "active")
        )
        .first(),
    ]);

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    return {
      trackingSnippetInstalled: !!tenant.trackingVerifiedAt,
      saligPayConnected: !!tenant.saligPayCredentials?.connectedAt,
      firstCampaignCreated: !!campaign,
      firstAffiliateApproved: !!activeAffiliate,
    };
  },
});


