"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
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
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";

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

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your affiliate program</p>
          {/* Date range indicator */}
          {dateRange && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing data for: <span className="font-medium text-foreground">{dateRange.label}</span>
            </p>
          )}
        </div>
        <DateRangeSelector />
      </div>

      {/* Alert Banners for Setup Tasks */}
      <AlertBanner setupStatus={setupStatus} />

      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="MRR Influenced"
          value={stats ? formatCurrency(stats.mrrInfluenced) : "—"}
          subtext="From affiliate referrals"
          delta={stats ? { value: stats.mrrChangePercent, isPositive: stats.mrrChangePercent >= 0 } : undefined}
          variant="blue"
          isLoading={!stats}
        />
        <MetricCard
          label="Active Affiliates"
          value={stats?.activeAffiliatesCount ?? 0}
          subtext="Approved & promoting"
          variant="green"
          isLoading={!stats}
        />
        <MetricCard
          label="Pending Commissions"
          value={stats ? formatCurrency(stats.pendingCommissionsValue) : "—"}
          subtext={`${stats?.pendingCommissionsCount ?? 0} awaiting approval`}
          variant="yellow"
          isLoading={!stats}
        />
        <MetricCard
          label="Total Paid Out"
          value={stats ? formatCurrency(stats.totalPaidOut) : "—"}
          subtext="Lifetime payouts"
          variant="gray"
          isLoading={!stats}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Tables */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <RecentCommissionsTable
              commissions={recentCommissions ?? []}
              isLoading={!recentCommissions}
              pendingCount={stats?.pendingCommissionsCount}
              showPayAllButton={canManage}
            />
          </Card>

          <Card className="p-5">
            <TopAffiliatesTable
              affiliates={topAffiliates ?? []}
              isLoading={!topAffiliates}
            />
          </Card>
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          <Card className="p-5">
            <QuickActionsPanel
              pendingCount={stats?.pendingCommissionsCount}
              showPayAll={canManage}
            />
          </Card>

          <Card className="p-5">
            <ActivityFeed
              activities={activities ?? []}
              isLoading={!activities}
            />
          </Card>

          <Card className="p-5">
            <PlanUsageWidget
              usage={planUsage}
              isLoading={!planUsage}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
