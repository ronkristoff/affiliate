import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";
import { dateRangeValidator } from "./summary";

/**
 * Get commission summary metrics for the Commission & Payout Summary page.
 * Reads from tenantStats for accuracy (MetricCards). No deltas.
 * RBAC: Non-owners/non-managers see 0 for monetary values.
 */
export const getCommissionSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    pendingCount: v.number(),
    pendingValue: v.number(),
    confirmedThisMonth: v.number(),
    confirmedValueThisMonth: v.number(),
    reversedThisMonth: v.number(),
    reversedValueThisMonth: v.number(),
    flagged: v.number(),
    totalPaidOut: v.number(),
    pendingPayoutTotal: v.number(),
    pendingPayoutCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!stats) {
      return {
        pendingCount: 0,
        pendingValue: 0,
        confirmedThisMonth: 0,
        confirmedValueThisMonth: 0,
        reversedThisMonth: 0,
        reversedValueThisMonth: 0,
        flagged: 0,
        totalPaidOut: 0,
        pendingPayoutTotal: 0,
        pendingPayoutCount: 0,
      };
    }

    return {
      pendingCount: stats.commissionsPendingCount,
      pendingValue: canViewSensitiveData ? stats.commissionsPendingValue : 0,
      confirmedThisMonth: stats.commissionsConfirmedThisMonth,
      confirmedValueThisMonth: canViewSensitiveData ? stats.commissionsConfirmedValueThisMonth : 0,
      reversedThisMonth: stats.commissionsReversedThisMonth,
      reversedValueThisMonth: canViewSensitiveData ? stats.commissionsReversedValueThisMonth : 0,
      flagged: stats.commissionsFlagged,
      totalPaidOut: canViewSensitiveData ? stats.totalPaidOut : 0,
      pendingPayoutTotal: canViewSensitiveData ? (stats.pendingPayoutTotal ?? 0) : 0,
      pendingPayoutCount: stats.pendingPayoutCount ?? 0,
    };
  },
});

/**
 * Get commission aging buckets for the aging chart.
 * Uses capped .take(5000) on by_tenant index with post-filter on date range.
 * Returns totalEstimated for truncation warning.
 */
export const getCommissionAgingBuckets = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
  },
  returns: v.object({
    buckets: v.array(v.object({
      ageRange: v.string(),
      pending: v.number(),
      confirmed: v.number(),
      reversed: v.number(),
      paid: v.number(),
    })),
    totalEstimated: v.number(),
    collectedCount: v.number(),
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

    const CAP = 5000;

    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    // Post-filter on date range
    const filtered = allCommissions.filter(c =>
      c._creationTime >= startDate && c._creationTime <= endDate
    );

    // Compute totalEstimated for truncation warning
    const totalEstimated = filtered.length > 0
      ? Math.round(allCommissions.length * (allCommissions.length / Math.max(1, filtered.length)))
      : allCommissions.length;

    // Age bucket calculation
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    const buckets = [
      { ageRange: "0-7 days", pending: 0, confirmed: 0, reversed: 0, paid: 0 },
      { ageRange: "8-30 days", pending: 0, confirmed: 0, reversed: 0, paid: 0 },
      { ageRange: "31-90 days", pending: 0, confirmed: 0, reversed: 0, paid: 0 },
      { ageRange: "90+ days", pending: 0, confirmed: 0, reversed: 0, paid: 0 },
    ];

    for (const c of filtered) {
      const age = now - c._creationTime;
      const amount = canViewSensitiveData ? c.amount : 0;
      const status = c.status;

      let bucketIndex: number;
      if (age <= SEVEN_DAYS) bucketIndex = 0;
      else if (age <= THIRTY_DAYS) bucketIndex = 1;
      else if (age <= NINETY_DAYS) bucketIndex = 2;
      else bucketIndex = 3;

      if (status === "pending") buckets[bucketIndex].pending += amount;
      else if (status === "confirmed" || status === "approved") buckets[bucketIndex].confirmed += amount;
      else if (status === "reversed" || status === "declined") buckets[bucketIndex].reversed += amount;
      else if (status === "paid") buckets[bucketIndex].paid += amount;
    }

    return {
      buckets,
      totalEstimated,
      collectedCount: allCommissions.length,
    };
  },
});

/**
 * Get commission export data for CSV.
 * Capped at 10,000 rows.
 */
export const getCommissionExportData = query({
  args: {
    tenantId: v.id("tenants"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(v.object({
    commissionId: v.id("commissions"),
    affiliateEmail: v.string(),
    campaignName: v.string(),
    amount: v.number(),
    status: v.string(),
    createdAt: v.number(),
    isSelfReferral: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(10000);

    const filtered = allCommissions.filter(c =>
      c._creationTime >= args.startDate && c._creationTime <= args.endDate
    );

    const results: Array<{
      commissionId: Id<"commissions">;
      affiliateEmail: string;
      campaignName: string;
      amount: number;
      status: string;
      createdAt: number;
      isSelfReferral: boolean;
    }> = [];

    for (const c of filtered.slice(0, 10000)) {
      const affiliate = await ctx.db.get(c.affiliateId);
      const campaign = await ctx.db.get(c.campaignId);

      results.push({
        commissionId: c._id,
        affiliateEmail: affiliate?.email ?? "Unknown",
        campaignName: campaign?.name ?? "Unknown",
        amount: c.amount,
        status: c.status,
        createdAt: c._creationTime,
        isSelfReferral: c.isSelfReferral ?? false,
      });
    }

    return results;
  },
});
