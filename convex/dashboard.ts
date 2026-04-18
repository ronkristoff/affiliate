import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, checkWriteAccess } from "./tenantContext";
import { Doc, Id } from "./_generated/dataModel";
import { clicksAggregate, conversionsAggregate, commissionsAggregate } from "./aggregates";

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

// Period validator for sparkline granularity
const periodValidator = v.optional(v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly")
));

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
    period: periodValidator,
    topAffiliatesLimit: v.optional(v.number()),
    recentCommissionsLimit: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      stats: v.object({
        mrrInfluenced: v.number(),
        activeAffiliatesCount: v.number(),
        pendingCommissionsCount: v.number(),
        pendingCommissionsValue: v.number(),
        totalPaidOut: v.number(),
        recentClicks: v.number(),
        recentConversions: v.number(),
        recentOrganicConversions: v.number(),
        previousPeriodMrr: v.number(),
        mrrChangePercent: v.number(),
        // Sparkline data for trends
        mrrSparkline: v.array(v.number()),
        clicksSparkline: v.array(v.number()),
        conversionsSparkline: v.array(v.number()),
        // Approved conversions (unique paying customers via affiliate)
        approvedConversionsCount: v.number(),
        previousPeriodApprovedConversions: v.number(),
        // Conversion rate
        conversionRate: v.number(),
        // Pending items counts
        affiliatesPending: v.number(),
        pendingPayoutCount: v.number(),
        pendingPayoutTotal: v.number(),
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
      topCampaigns: v.array(v.object({
        _id: v.id("campaigns"),
        name: v.string(),
        conversions: v.number(),
        revenue: v.number(),
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
    v.null()
  ),
  handler: async (ctx, args) => {
    // 1. Auth check — ONCE
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      // Return null instead of throwing — the Convex client may not have
      // the session identity yet during page navigation/refresh. The query
      // will automatically re-execute once the session is established.
      return null;
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
      paginateAggregateDocs(ctx, commissionsAggregate, args.tenantId),
      paginateAggregateDocs(ctx, conversionsAggregate, args.tenantId),
      paginateAggregateDocs(ctx, clicksAggregate, args.tenantId),
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
    let recentOrganicConversions = 0;
    for (const conversion of conversions) {
      if (conversion._creationTime >= startDate && conversion._creationTime <= endDate) {
        recentConversions++;
        if (!conversion.affiliateId || conversion.attributionSource === "organic") recentOrganicConversions++;
      }
    }

    // Approved conversions count (unique conversions that led to approved commissions = paying customers)
    const approvedConversionIds = new Set<string>();
    for (const commission of commissions) {
      if (commission.status === "approved" &&
          commission._creationTime >= startDate &&
          commission._creationTime <= endDate &&
          commission.conversionId) {
        approvedConversionIds.add(commission.conversionId);
      }
    }
    const approvedConversionsCount = approvedConversionIds.size;

    // Previous period approved conversions (for delta)
    const previousApprovedConversionIds = new Set<string>();
    for (const commission of commissions) {
      if (commission.status === "approved" &&
          commission._creationTime >= previousStartDate &&
          commission._creationTime < startDate &&
          commission.conversionId) {
        previousApprovedConversionIds.add(commission.conversionId);
      }
    }
    const previousPeriodApprovedConversions = previousApprovedConversionIds.size;

    // Conversion rate (conversions / clicks, capped at 100%)
    const conversionRate = recentClicks > 0
      ? Math.round((recentConversions / recentClicks) * 100)
      : 0;

    // ==================== SPARKLINE DATA ====================
    // Calculate time-bucketed data for sparkline charts based on period
    const period = args.period ?? "daily";
    const duration = endDate - startDate;

    // Determine bucket size based on period
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    let bucketMs: number;
    let numBuckets: number;

    switch (period) {
      case "weekly":
        bucketMs = 7 * MS_PER_DAY;
        numBuckets = Math.min(Math.ceil(duration / bucketMs), 12); // Max 12 weeks
        break;
      case "monthly":
        bucketMs = 30 * MS_PER_DAY;
        numBuckets = Math.min(Math.ceil(duration / bucketMs), 12); // Max 12 months
        break;
      case "daily":
      default:
        bucketMs = MS_PER_DAY;
        numBuckets = Math.min(Math.ceil(duration / bucketMs), 30); // Max 30 days
        break;
    }

    // Initialize bucket arrays
    const mrrBuckets: number[] = new Array(numBuckets).fill(0);
    const clicksBuckets: number[] = new Array(numBuckets).fill(0);
    const conversionsBuckets: number[] = new Array(numBuckets).fill(0);

    // Populate MRR buckets from approved commissions
    for (const commission of commissions) {
      if (commission.status !== "approved") continue;
      if (commission._creationTime < startDate || commission._creationTime > endDate) continue;

      const bucketIndex = Math.min(
        Math.floor((commission._creationTime - startDate) / bucketMs),
        numBuckets - 1
      );
      const conversion = commission.conversionId
        ? conversionLookup.get(commission.conversionId)
        : null;
      mrrBuckets[bucketIndex] += conversion ? conversion.amount : commission.amount;
    }

    // Populate clicks buckets
    for (const click of clicks) {
      if (click._creationTime < startDate || click._creationTime > endDate) continue;

      const bucketIndex = Math.min(
        Math.floor((click._creationTime - startDate) / bucketMs),
        numBuckets - 1
      );
      clicksBuckets[bucketIndex]++;
    }

    // Populate conversions buckets
    for (const conversion of conversions) {
      if (conversion._creationTime < startDate || conversion._creationTime > endDate) continue;

      const bucketIndex = Math.min(
        Math.floor((conversion._creationTime - startDate) / bucketMs),
        numBuckets - 1
      );
      conversionsBuckets[bucketIndex]++;
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
      .filter((a) => a.clicks > 0 || a.conversions > 0 || a.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topAffiliatesLimit);

    // ==================== TOP CAMPAIGNS ====================
    // Aggregate approved commissions by campaignId (no extra DB reads)
    const campaignStatsMap = new Map<Id<"campaigns">, { conversions: number; revenue: number }>();
    for (const commission of commissions) {
      if (commission.status === "approved" &&
          commission._creationTime >= startDate &&
          commission._creationTime <= endDate) {
        const existing = campaignStatsMap.get(commission.campaignId);
        if (existing) {
          existing.conversions++;
          existing.revenue += commission.amount;
        } else {
          campaignStatsMap.set(commission.campaignId, { conversions: 1, revenue: commission.amount });
        }
      }
    }

    const topCampaignIds = [...campaignStatsMap.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([id]) => id as Id<"campaigns">);

    // Fetch campaign docs for top campaigns
    const topCampaignDocs = await Promise.all(topCampaignIds.map((id) => ctx.db.get(id)));

    const topCampaignsResult = topCampaignDocs
      .filter((c): c is Doc<"campaigns"> => c !== null)
      .map((c) => {
        const s = campaignStatsMap.get(c._id) ?? { conversions: 0, revenue: 0 };
        return {
          _id: c._id,
          name: c.name,
          conversions: s.conversions,
          revenue: canViewSensitiveData ? s.revenue : 0,
        };
      });

    // ==================== RECENT COMMISSIONS ====================
    const filteredRecentCommissions = commissions
      .filter((c) => c._creationTime >= startDate && c._creationTime <= endDate)
      .slice(0, recentCommissionsLimit);

    // Batch-fetch only referenced entities (reuse conversions already fetched)
    const affiliateIds = [...new Set(filteredRecentCommissions.map((c) => c.affiliateId as Id<"affiliates">))];
    const campaignIds = [...new Set(filteredRecentCommissions.map((c) => c.campaignId as Id<"campaigns">))];

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
        recentOrganicConversions,
        previousPeriodMrr,
        mrrChangePercent,
        mrrSparkline: mrrBuckets,
        clicksSparkline: clicksBuckets,
        conversionsSparkline: conversionsBuckets,
        approvedConversionsCount,
        previousPeriodApprovedConversions,
        conversionRate,
        affiliatesPending: tenantStatsDoc?.affiliatesPending ?? 0,
        pendingPayoutCount: tenantStatsDoc?.pendingPayoutCount ?? 0,
        pendingPayoutTotal: tenantStatsDoc?.pendingPayoutTotal ?? 0,
      },
      topAffiliates: topAffiliatesResult,
      topCampaigns: topCampaignsResult,
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
  returns: v.union(
    v.array(v.object({
      _id: v.string(),
      type: v.string(),
      title: v.string(),
      description: v.string(),
      amount: v.optional(v.number()),
      status: v.optional(v.string()),
      timestamp: v.number(),
      iconType: v.string(),
    })),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      // Return null instead of throwing — the Convex client may not have
      // the session identity yet during page navigation/refresh.
      return null;
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
  returns: v.union(
    v.object({
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
    v.null()
  ),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      // Return null instead of throwing — the Convex client may not have
      // the session identity yet during page navigation/refresh.
      return null;
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
  returns: v.union(
    v.object({
      trackingSnippetInstalled: v.boolean(),
      billingProviderConnected: v.boolean(),
      referralTrackingActive: v.boolean(),
      firstCampaignCreated: v.boolean(),
      firstAffiliateApproved: v.boolean(),
      subscriptionStatus: v.optional(v.string()),
      writeAccessBlocked: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Verify user has access to this tenant
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      // Return null instead of throwing — the Convex client may not have
      // the session identity yet during page navigation/refresh.
      return null;
    }

    // Get tenant + existence checks in parallel
    const [tenant, campaign, activeAffiliate, recentReferralPing] = await Promise.all([
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
      // Check for referral pings in the last 7 days (7 * 24 * 60 * 60 * 1000 ms)
      ctx.db
        .query("referralPings")
        .withIndex("by_tenant_and_time", (q) =>
          q.eq("tenantId", args.tenantId).gt("timestamp", Date.now() - 7 * 24 * 60 * 60 * 1000)
        )
        .first(),
    ]);

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Billing provider connected: Stripe (OAuth or manual) or SaligPay
    const isStripeConnected = !!tenant.stripeAccountId && !!tenant.stripeCredentials?.connectedAt;
    const isSaligPayConnected = !!tenant.saligPayCredentials?.connectedAt;

    return {
      trackingSnippetInstalled: !!tenant.trackingVerifiedAt,
      billingProviderConnected: isStripeConnected || isSaligPayConnected,
      referralTrackingActive: !!recentReferralPing,
      firstCampaignCreated: !!campaign,
      firstAffiliateApproved: !!activeAffiliate,
      subscriptionStatus: tenant.subscriptionStatus,
      writeAccessBlocked: !tenant ? false : !(await checkWriteAccess(ctx)).canWrite,
    };
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateAggregateDocs(
  ctx: any,
  aggregate: any,
  namespace: string,
  pageSize = 500,
): Promise<any[]> {
  const docs: any[] = [];
  let cursor: string | undefined;
  let done = false;

  while (!done) {
    const result = await aggregate.paginate(ctx, {
      namespace,
      pageSize,
      cursor,
      order: "desc",
    });
    const fetched = await Promise.all(
      result.page.map((item: any) => ctx.db.get(item.id))
    );
    for (const doc of fetched) {
      if (doc) docs.push(doc);
    }
    cursor = result.isDone ? undefined : result.cursor;
    done = !cursor;
  }

  return docs;
}

