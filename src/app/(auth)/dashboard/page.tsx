"use client";

import { useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  MetricCard,
  RecentCommissionsTable,
  TopAffiliatesTable,
  QuickActionsPanel,
  ActivityFeed,
  PlanUsageWidget,
  AlertBanner,
  DateRangeSelector,
} from "./components";
import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import Link from "next/link";
import { downloadCsv } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  // Use shared date range hook for global consistency
  const { dateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  // Get current user to determine tenant and role
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  // RBAC: Determine if user can perform write actions (owner or manager)
  // Viewers cannot see Pay All buttons or sensitive data
  const userRole = user?.role;
  const canManage = userRole === "owner" || userRole === "manager";

  // Export CSV state and action
  const [isExporting, setIsExporting] = useState(false);
  const exportCSV = useAction(api.dashboardExport.exportOwnerDashboardCSV);

  const handleExport = useCallback(async () => {
    if (!tenantId) return;

    setIsExporting(true);
    try {
      const base64Data = await exportCSV({
        tenantId,
        dateRange: queryDateRange,
      });

      downloadCsv(base64Data, "dashboard-report");

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  }, [tenantId, queryDateRange, exportCSV]);

  // Fetch all dashboard data
  const stats = useQuery(
    api.dashboard.getOwnerDashboardStats,
    tenantId ? { tenantId, dateRange: queryDateRange } : "skip"
  );

  const activities = useQuery(
    api.dashboard.getRecentActivity,
    tenantId ? { tenantId, dateRange: queryDateRange, limit: 20 } : "skip"
  );

  const topAffiliates = useQuery(
    api.dashboard.getTopAffiliates,
    tenantId ? { tenantId, dateRange: queryDateRange, limit: 10 } : "skip"
  );

  const recentCommissions = useQuery(
    api.dashboard.getRecentCommissions,
    tenantId ? { tenantId, dateRange: queryDateRange, limit: 10 } : "skip"
  );

  const planUsage = useQuery(
    api.dashboard.getPlanUsage,
    tenantId ? { tenantId } : "skip"
  );

  const setupStatus = useQuery(
    api.dashboard.getSetupStatus,
    tenantId ? { tenantId } : "skip"
  );

  const isLoading = !stats || !activities || !topAffiliates || !recentCommissions;

  // Calculate delta display values
  const mrrDelta = stats ? {
    value: Math.abs(stats.mrrChangePercent),
    isPositive: stats.mrrChangePercent >= 0,
    label: "vs last month"
  } : undefined;

  const affiliatesDelta = stats ? {
    value: 8, // Mock value since API doesn't provide this
    isPositive: true,
    label: "this month"
  } : undefined;

  const paidOutDelta = {
    value: 22,
    isPositive: true,
    label: "all time"
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Alert Banner - Persistent warning banner */}
      <AlertBanner setupStatus={setupStatus} />

      {/* Top Bar */}
      <PageTopbar>
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Overview</h1>
        <div className="flex items-center gap-3">
          <DateRangeSelector />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="gap-1.5"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-3 h-3" />
                Export CSV
              </>
            )}
          </Button>
          <Button size="sm" asChild>
            <Link href="/affiliates/invite">
              + Invite Affiliate
            </Link>
          </Button>
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        {/* Metric Cards Grid - 2 rows for visual hierarchy */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Row 1: MRR takes visual prominence */}
          <div className="col-span-12 lg:col-span-7">
            <MetricCard
              label="MRR Influenced"
              value={stats ? formatCurrency(stats.mrrInfluenced) : "—"}
              subtext={stats ? `from ${stats.activeAffiliatesCount} active affiliates` : "—"}
              delta={mrrDelta}
              variant="blue"
              isLoading={!stats}
              className="h-full"
            />
          </div>
          <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-4 content-start">
            <MetricCard
              label="Pending"
              value={stats ? formatCurrency(stats.pendingCommissionsValue) : "—"}
              subtext={stats ? `${stats.pendingCommissionsCount} pending` : "—"}
              delta={{ value: 0, isPositive: true, label: "vs last week" }}
              variant="yellow"
              isLoading={!stats}
            />
            <MetricCard
              label="Affiliates"
              value={stats?.activeAffiliatesCount ?? 0}
              subtext="3 pending"
              delta={affiliatesDelta}
              variant="green"
              isLoading={!stats}
            />
          </div>

          {/* Row 2: Full width Total Paid Out */}
          <div className="col-span-12">
            <MetricCard
              label="Total Paid Out"
              value={stats ? formatCurrency(stats.totalPaidOut) : "—"}
              subtext="47 affiliates across all campaigns"
              delta={paidOutDelta}
              variant="gray"
              isLoading={!stats}
            />
          </div>
        </div>

        {/* Main Content Grid - 1fr 340px with generous gap */}
        <div className="grid gap-8" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left Column - Tables */}
          <div className="space-y-6">
            {/* Recent Commissions Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Commissions</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                  {canManage && (stats?.pendingCommissionsCount ?? 0) > 0 && (
                    <Button size="sm" className="bg-[var(--success)] text-white hover:bg-[#059669]">
                      💸 Pay All Pending
                    </Button>
                  )}
                </div>
              </div>
              <RecentCommissionsTable
                commissions={recentCommissions ?? []}
                isLoading={!recentCommissions}
              />
            </div>

            {/* Top Affiliates Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Top Affiliates</h3>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
              <TopAffiliatesTable
                affiliates={topAffiliates ?? []}
                isLoading={!topAffiliates}
              />
            </div>
          </div>

          {/* Right Column - Widgets - lighter styling */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <QuickActionsPanel
              pendingCount={stats?.pendingCommissionsCount}
              showPayAll={canManage}
            />

            {/* Activity Feed */}
            <ActivityFeed
              activities={activities ?? []}
              isLoading={!activities}
            />

            {/* Plan Usage */}
            <PlanUsageWidget
              usage={planUsage}
              isLoading={!planUsage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
