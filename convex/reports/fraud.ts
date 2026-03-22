import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../tenantContext";

/**
 * Fraud & Risk Dashboard queries.
 *
 * NOTE: Fraud signals are embedded in the `affiliates` table as an array
 * (affiliate.fraudSignals). There is no standalone fraudSignals table.
 * These queries aggregate signals across all affiliates for a tenant.
 */

// ── Embedded fraud signal type (mirrors schema definition) ──────
interface EmbeddedFraudSignal {
  type: string;
  severity: string;
  timestamp: number;
  details?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
  commissionId?: Id<"commissions">;
}

/**
 * Get fraud report metrics for the dashboard MetricCards.
 * Reads commissionsFlagged from tenantStats. Aggregates fraud signals
 * from affiliate records for severity/type/reviewed counts.
 * RBAC: Non-owners/non-managers see flaggedCommissions: 0.
 */
export const getFraudReportMetrics = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    flaggedCommissions: v.number(),
    affiliatesWithSignals: v.number(),
    signalsBySeverity: v.object({
      low: v.number(),
      medium: v.number(),
      high: v.number(),
    }),
    signalsByType: v.object({
      selfReferral: v.number(),
      botTraffic: v.number(),
      ipAnomaly: v.number(),
    }),
    reviewedVsUnreviewed: v.object({
      reviewed: v.number(),
      unreviewed: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const userRole = authUser.role;
    const canViewSensitiveData = userRole === "owner" || userRole === "manager";

    // 1. Read commissionsFlagged from tenantStats
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();

    const flaggedCommissions = canViewSensitiveData
      ? stats?.commissionsFlagged ?? 0
      : 0;

    // 2. Query affiliates and extract fraud signals
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Flatten all fraud signals across affiliates
    const allSignals: Array<EmbeddedFraudSignal> = [];
    const affiliateIdsWithSignals = new Set<string>();

    for (const affiliate of affiliates) {
      const signals: Array<EmbeddedFraudSignal> = (affiliate.fraudSignals as Array<EmbeddedFraudSignal>) || [];
      if (signals.length > 0) {
        affiliateIdsWithSignals.add(affiliate._id);
        allSignals.push(...signals);
      }
    }

    // 3. Aggregate by severity
    let low = 0;
    let medium = 0;
    let high = 0;
    let reviewed = 0;
    let unreviewed = 0;
    let selfReferral = 0;
    let botTraffic = 0;
    let ipAnomaly = 0;

    for (const signal of allSignals) {
      // Severity
      if (signal.severity === "low") low++;
      else if (signal.severity === "medium") medium++;
      else if (signal.severity === "high") high++;

      // Type — only count known types
      if (signal.type === "selfReferral") selfReferral++;
      else if (signal.type === "botTraffic") botTraffic++;
      else if (signal.type === "ipAnomaly") ipAnomaly++;

      // Reviewed status
      if (signal.reviewedAt !== undefined) reviewed++;
      else unreviewed++;
    }

    return {
      flaggedCommissions,
      affiliatesWithSignals: affiliateIdsWithSignals.size,
      signalsBySeverity: { low, medium, high },
      signalsByType: { selfReferral, botTraffic, ipAnomaly },
      reviewedVsUnreviewed: { reviewed, unreviewed },
    };
  },
});

/**
 * Get flagged commissions (self-referral flagged) for the data table.
 * Uses the by_tenant_and_isSelfReferral index. Batch-fetches affiliate names.
 * RBAC: Non-owners/non-managers see amount: 0.
 */
export const getFlaggedCommissions = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    commissions: v.array(
      v.object({
        _id: v.id("commissions"),
        amount: v.number(),
        status: v.string(),
        affiliateId: v.id("affiliates"),
        affiliateName: v.optional(v.string()),
        isSelfReferral: v.boolean(),
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

    const CAP = 5000;

    // Query flagged commissions using the filtered index
    const flaggedCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_isSelfReferral", (q) =>
        q.eq("tenantId", args.tenantId).eq("isSelfReferral", true)
      )
      .order("desc")
      .take(CAP);

    // Batch-fetch affiliate names
    const uniqueAffiliateIds = [...new Set(flaggedCommissions.map((c) => c.affiliateId))];
    const affiliateMap = new Map<string, string>();
    for (const affiliateId of uniqueAffiliateIds) {
      const affiliate = await ctx.db.get(affiliateId);
      if (affiliate) {
        affiliateMap.set(affiliateId, affiliate.name);
      }
    }

    const commissions = flaggedCommissions.map((c) => ({
      _id: c._id,
      amount: canViewSensitiveData ? c.amount : 0,
      status: c.status,
      affiliateId: c.affiliateId,
      affiliateName: affiliateMap.get(c.affiliateId),
      isSelfReferral: c.isSelfReferral ?? false,
      createdAt: c._creationTime,
    }));

    // totalEstimated for truncation warning
    const totalEstimated =
      flaggedCommissions.length >= CAP ? CAP * 2 : flaggedCommissions.length;

    return {
      commissions,
      totalEstimated,
    };
  },
});

/**
 * Get fraud signal trend data grouped by date.
 * Used for the LineChart showing fraud signals over time.
 */
export const getFraudTrendData = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser || authUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    // Query affiliates and extract fraud signals
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Flatten all fraud signals with their timestamps
    const allSignals: Array<{ timestamp: number }> = [];
    for (const affiliate of affiliates) {
      const signals: Array<EmbeddedFraudSignal> = (affiliate.fraudSignals as Array<EmbeddedFraudSignal>) || [];
      for (const signal of signals) {
        allSignals.push({ timestamp: signal.timestamp });
      }
    }

    // Group by date (YYYY-MM-DD)
    const dateCounts = new Map<string, number>();
    for (const signal of allSignals) {
      const d = new Date(signal.timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dateCounts.set(dateStr, (dateCounts.get(dateStr) ?? 0) + 1);
    }

    // Sort ascending by date
    const sorted = Array.from(dateCounts.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    return sorted.map(([date, count]) => ({ date, count }));
  },
});

/**
 * Get fraud export data for CSV download.
 * Similar to getFlaggedCommissions but returns flat list for CSV, capped at 10,000.
 */
export const getFraudExportData = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    data: v.array(
      v.object({
        commissionId: v.id("commissions"),
        amount: v.number(),
        status: v.string(),
        affiliateName: v.optional(v.string()),
        isSelfReferral: v.boolean(),
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

    const CAP = 10000;

    // Query flagged commissions using the filtered index
    const flaggedCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_isSelfReferral", (q) =>
        q.eq("tenantId", args.tenantId).eq("isSelfReferral", true)
      )
      .order("desc")
      .take(CAP);

    // Batch-fetch affiliate names
    const uniqueAffiliateIds = [...new Set(flaggedCommissions.map((c) => c.affiliateId))];
    const affiliateMap = new Map<string, string>();
    for (const affiliateId of uniqueAffiliateIds) {
      const affiliate = await ctx.db.get(affiliateId);
      if (affiliate) {
        affiliateMap.set(affiliateId, affiliate.name);
      }
    }

    const data = flaggedCommissions.map((c) => ({
      commissionId: c._id,
      amount: c.amount,
      status: c.status,
      affiliateName: affiliateMap.get(c.affiliateId),
      isSelfReferral: c.isSelfReferral ?? false,
      createdAt: c._creationTime,
    }));

    const totalEstimated =
      flaggedCommissions.length >= CAP ? CAP * 2 : flaggedCommissions.length;

    return {
      data,
      totalEstimated,
    };
  },
});
