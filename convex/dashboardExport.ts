"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { betterAuthComponent } from "./auth";

const dateRangeValidator = v.optional(v.object({
  start: v.number(),
  end: v.number(),
}));

export const exportOwnerDashboardCSV = action({
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

    type AppUser = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> };
    const appUser: AppUser | null = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!appUser || appUser.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    const canViewSensitiveData = appUser.role === "owner" || appUser.role === "manager";

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

    const stats = await ctx.runQuery(api.dashboard.getOwnerDashboardStats, {
      tenantId: args.tenantId,
      dateRange: { start: startDate, end: endDate },
    });

    const recentCommissions = await ctx.runQuery(api.dashboard.getRecentCommissions, {
      tenantId: args.tenantId,
      dateRange: { start: startDate, end: endDate },
      limit: 50,
    });

    const topAffiliates = await ctx.runQuery(api.dashboard.getTopAffiliates, {
      tenantId: args.tenantId,
      dateRange: { start: startDate, end: endDate },
      limit: 20,
    });

    const rows: string[] = [];

    rows.push("# Dashboard Performance Report");
    rows.push(`# Generated: ${generatedDate}`);
    rows.push(`# Date Range: ${startDateStr} to ${endDateStr}`);
    rows.push("");

    rows.push("Summary Metrics");
    rows.push("Metric,Value");
    rows.push(`MRR Influenced,${stats.mrrInfluenced.toFixed(2)}`);
    rows.push(`Active Affiliates,${stats.activeAffiliatesCount}`);
    rows.push(`Pending Commissions Count,${stats.pendingCommissionsCount}`);
    rows.push(`Pending Commissions Value,${stats.pendingCommissionsValue.toFixed(2)}`);
    rows.push(`Total Paid Out,${stats.totalPaidOut.toFixed(2)}`);
    rows.push(`Recent Clicks,${stats.recentClicks}`);
    rows.push(`Recent Conversions,${stats.recentConversions}`);
    rows.push("");

    rows.push("Recent Commissions");
    rows.push("Date,Affiliate,Campaign,Amount,Status,Plan Type");
    for (const commission of recentCommissions) {
      rows.push([
        formatDate(commission.createdAt),
        `"${commission.affiliateName.replace(/"/g, '""')}"`,
        `"${commission.campaignName.replace(/"/g, '""')}"`,
        commission.amount.toFixed(2),
        commission.status,
        commission.planContext ?? "N/A",
      ].join(","));
    }
    rows.push("");

    rows.push("Top Affiliates");
    rows.push("Name,Email,Handle,Clicks,Conversions,Revenue,Status");
    for (const affiliate of topAffiliates) {
      rows.push([
        `"${affiliate.name.replace(/"/g, '""')}"`,
        `"${affiliate.email.replace(/"/g, '""')}"`,
        affiliate.handle ? `"${affiliate.handle.replace(/"/g, '""')}"` : "",
        affiliate.clicks,
        affiliate.conversions,
        affiliate.revenue.toFixed(2),
        affiliate.status,
      ].join(","));
    }

    return btoa(rows.join("\n"));
  },
});
