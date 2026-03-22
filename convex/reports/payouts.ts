import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";
import { dateRangeValidator } from "./summary";

/**
 * Get payout summary metrics for the Payout History page.
 * Reads from tenantStats for accuracy (MetricCards).
 * RBAC: Non-owners/non-managers see 0 for all monetary values.
 */
export const getPayoutReportMetrics = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    totalPaidOut: v.number(),
    pendingPayoutTotal: v.number(),
    pendingPayoutCount: v.number(),
    batchesThisMonth: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    // Read from tenantStats
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    // Calculate month start for batchesThisMonth
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const batchesThisMonth = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);

    const batchesThisMonthCount = batchesThisMonth.filter(
      (b) => b._creationTime >= monthStart
    ).length;

    if (!stats) {
      return {
        totalPaidOut: 0,
        pendingPayoutTotal: 0,
        pendingPayoutCount: 0,
        batchesThisMonth: batchesThisMonthCount,
      };
    }

    return {
      totalPaidOut: canViewSensitiveData ? (stats.totalPaidOut ?? 0) : 0,
      pendingPayoutTotal: canViewSensitiveData ? (stats.pendingPayoutTotal ?? 0) : 0,
      pendingPayoutCount: stats.pendingPayoutCount ?? 0,
      batchesThisMonth: batchesThisMonthCount,
    };
  },
});

/**
 * Get payout monthly trend for the trend chart.
 * Aggregates payoutBatches by month.
 * RBAC: Non-owners see totalAmount: 0 for all months.
 */
export const getPayoutMonthlyTrend = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.array(
    v.object({
      month: v.string(),
      monthLabel: v.string(),
      totalAmount: v.number(),
      batchCount: v.number(),
      payoutCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    const batches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(500);

    // Group by month
    const monthMap = new Map<
      string,
      {
        monthLabel: string;
        totalAmount: number;
        batchCount: number;
        payoutCount: number;
      }
    >();

    const MONTH_LABELS = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    for (const batch of batches) {
      const date = new Date(batch._creationTime);
      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const monthLabel = `${MONTH_LABELS[monthIndex]} ${year}`;

      const existing = monthMap.get(monthKey);
      if (existing) {
        existing.totalAmount += batch.totalAmount;
        existing.batchCount += 1;
        existing.payoutCount += batch.affiliateCount;
      } else {
        monthMap.set(monthKey, {
          monthLabel,
          totalAmount: batch.totalAmount,
          batchCount: 1,
          payoutCount: batch.affiliateCount,
        });
      }
    }

    // Sort by month ascending (oldest first)
    const sortedMonths = Array.from(monthMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return sortedMonths.map(([month, data]) => ({
      month,
      monthLabel: data.monthLabel,
      totalAmount: canViewSensitiveData ? data.totalAmount : 0,
      batchCount: data.batchCount,
      payoutCount: data.payoutCount,
    }));
  },
});

/**
 * Get payout export data for CSV download.
 * Capped at 10,000 rows. Returns totalEstimated for truncation warning.
 * RBAC: Non-owners see totalAmount: 0.
 */
export const getPayoutExportData = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
  },
  returns: v.object({
    data: v.array(
      v.object({
        batchId: v.id("payoutBatches"),
        batchDate: v.number(),
        status: v.string(),
        totalAmount: v.number(),
        payoutCount: v.number(),
        createdAt: v.number(),
      }),
    ),
    totalEstimated: v.number(),
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

    const CAP = 10000;

    const allBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(CAP);

    // Post-filter on date range
    const filtered = allBatches.filter(
      (b) => b._creationTime >= startDate && b._creationTime <= endDate
    );

    // Compute totalEstimated for truncation warning
    const totalEstimated =
      filtered.length > 0
        ? Math.round(
            allBatches.length *
              (allBatches.length / Math.max(1, filtered.length))
          )
        : allBatches.length;

    const data: Array<{
      batchId: Id<"payoutBatches">;
      batchDate: number;
      status: string;
      totalAmount: number;
      payoutCount: number;
      createdAt: number;
    }> = filtered.slice(0, CAP).map((b) => ({
      batchId: b._id,
      batchDate: b.generatedAt,
      status: b.status,
      totalAmount: canViewSensitiveData ? b.totalAmount : 0,
      payoutCount: b.affiliateCount,
      createdAt: b._creationTime,
    }));

    return { data, totalEstimated };
  },
});
