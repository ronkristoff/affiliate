"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { betterAuthComponent } from "./auth";

// Date range validator (mirrored from reports.ts)
const dateRangeValidator = v.optional(v.object({
  start: v.number(),
  end: v.number(),
}));

// ============================================
// Export Actions
// ============================================

/**
 * Export affiliate performance data as CSV.
 */
export const exportAffiliatePerformanceCSV = action({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type UserResult = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> } | null;
    const user: UserResult = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!user || user.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can export data");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const affiliateData = await ctx.runQuery(
      api.reports.getAffiliateExportData,
      {
        tenantId: args.tenantId,
        startDate,
        endDate,
        campaignId: args.campaignId,
      }
    );

    const headers = ["Affiliate Name", "Email", "Unique Code", "Status", "Clicks", "Conversions", "Conversion Rate", "Total Commissions"];
    const rows = [headers.join(",")];

    for (const data of affiliateData) {
      const conversionRate = data.clicks > 0
        ? ((data.conversions / data.clicks) * 100).toFixed(2) + "%"
        : "0.00%";

      rows.push([
        `"${data.name.replace(/"/g, '""')}"`,
        `"${data.email.replace(/"/g, '""')}"`,
        data.uniqueCode,
        data.status,
        data.clicks,
        data.conversions,
        conversionRate,
        data.commissions.toFixed(2),
      ].join(","));
    }

    const csv = rows.join("\n");
    return Buffer.from(csv).toString("base64");
  },
});

/**
 * Export campaign performance data as CSV.
 */
export const exportCampaignPerformanceCSV = action({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type UserResult = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> } | null;
    const user: UserResult = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!user || user.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can export data");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const campaignData = await ctx.runQuery(
      api.reports.getCampaignExportData,
      {
        tenantId: args.tenantId,
        startDate,
        endDate,
        campaignId: args.campaignId,
      }
    );

    const headers = ["Campaign Name", "Status", "Clicks", "Conversions", "Conversion Rate", "Total Commissions", "Active Affiliates"];
    const rows = [headers.join(",")];

    for (const data of campaignData) {
      const conversionRate = data.clicks > 0
        ? ((data.conversions / data.clicks) * 100).toFixed(2) + "%"
        : "0.00%";

      rows.push([
        `"${data.name.replace(/"/g, '""')}"`,
        data.status,
        data.clicks,
        data.conversions,
        conversionRate,
        data.commissions.toFixed(2),
        data.activeAffiliates,
      ].join(","));
    }

    const csv = rows.join("\n");
    return Buffer.from(csv).toString("base64");
  },
});

/**
 * Export payout report data as CSV.
 */
export const exportPayoutReportCSV = action({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type UserResult = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> } | null;
    const user: UserResult = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!user || user.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can export data");
    }

    const payoutData = await ctx.runQuery(
      api.reports.payouts.getPayoutExportData,
      {
        tenantId: args.tenantId,
        dateRange: args.dateRange,
      }
    );

    const formatDate = (timestamp: number) =>
      new Date(timestamp).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

    const headers = ["Batch ID", "Batch Date", "Status", "Total Amount", "Payout Count", "Created At"];
    const rows = [headers.join(",")];

    for (const data of payoutData.data) {
      rows.push([
        data.batchId,
        formatDate(data.batchDate),
        data.status,
        data.totalAmount.toFixed(2),
        data.payoutCount,
        formatDate(data.createdAt),
      ].join(","));
    }

    const csv = rows.join("\n");
    return Buffer.from(csv).toString("base64");
  },
});

/**
 * Export program report data as CSV.
 */
export const exportProgramReportCSV = action({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type UserResult = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> } | null;
    const user: UserResult = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!user || user.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can export data");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toISOString().split("T")[0];
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    const generatedDate = formatDate(now);

    // Get data
    const summaryMetrics = await ctx.runQuery(
      api.reports.getProgramSummaryMetrics,
      {
        tenantId: args.tenantId,
        dateRange: { start: startDate, end: endDate },
        campaignId: args.campaignId,
      }
    );

    const topAffiliates = await ctx.runQuery(
      api.reports.getTopAffiliatesByRevenue,
      {
        tenantId: args.tenantId,
        dateRange: { start: startDate, end: endDate },
        limit: 20,
        campaignId: args.campaignId,
      }
    );

    const campaignData = await ctx.runQuery(
      api.reports.getCampaignExportData,
      {
        tenantId: args.tenantId,
        startDate,
        endDate,
        campaignId: args.campaignId,
      }
    );

    // Build CSV
    const rows: string[] = [];

    rows.push("# Program Performance Report");
    rows.push(`# Generated: ${generatedDate}`);
    rows.push(`# Date Range: ${startDateStr} to ${endDateStr}`);
    if (args.campaignId) {
      rows.push(`# Campaign ID: ${args.campaignId}`);
    }
    rows.push("");

    rows.push("Summary Metrics");
    rows.push("Metric,Value");
    rows.push(`MRR Influenced,${summaryMetrics.mrrInfluenced.toFixed(2)}`);
    rows.push(`Total Clicks,${summaryMetrics.totalClicks}`);
    rows.push(`Total Conversions,${summaryMetrics.totalConversions}`);
    rows.push(`Conversion Rate,${summaryMetrics.avgConversionRate.toFixed(2)}%`);
    rows.push(`Total Commissions,${summaryMetrics.totalCommissions.toFixed(2)}`);
    rows.push("");

    rows.push("Top Affiliates");
    rows.push("Name,Email,Clicks,Conversions,Commission");
    for (const affiliate of topAffiliates) {
      rows.push([
        `"${affiliate.name.replace(/"/g, '""')}"`,
        `"${affiliate.email.replace(/"/g, '""')}"`,
        affiliate.clicks,
        affiliate.conversions,
        affiliate.commissions.toFixed(2),
      ].join(","));
    }
    rows.push("");

    rows.push("Campaign Performance");
    rows.push("Campaign,Clicks,Conversions,Commission");
    for (const campaign of campaignData) {
      rows.push([
        `"${campaign.name.replace(/"/g, '""')}"`,
        campaign.clicks,
        campaign.conversions,
        campaign.commissions.toFixed(2),
      ].join(","));
    }

    const csv = rows.join("\n");
    return Buffer.from(csv).toString("base64");
  },
});
