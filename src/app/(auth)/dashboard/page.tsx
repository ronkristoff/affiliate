"use client";

import { Suspense, useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  RecentCommissionsTable,
  TopAffiliatesTable,
  QuickActionsPanel,
  ActivityFeed,
  PlanUsageWidget,
  AlertBanner,
} from "./components";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";

type Period = "daily" | "weekly" | "monthly";

const periodTabs: FilterTabItem[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];
import { DateRangeSelector } from "./components/DateRangeSelector";
import { InviteAffiliateSheet } from "@/components/affiliate/InviteAffiliateSheet";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { downloadCsv } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Download, TrendingUp, Clock, Users, Wallet, Leaf } from "lucide-react";
import Link from "next/link";

// ─── Skeleton fallback for Suspense boundary ─────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Alert Banner skeleton */}
      <div className="px-8 pt-6">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Top Bar skeleton */}
      <div className="px-8 pt-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>
      </div>

      {/* Metric Cards skeleton */}
      <div className="px-8 pt-6 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>

        {/* Main Content Grid skeleton */}
        <div className="grid gap-8" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left column */}
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inner content component (hooks live here) ───────────────────────────

function DashboardContent() {
  // Get current user to determine tenant and role
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  // RBAC: Determine if user can perform write actions (owner or manager)
  const userRole = user?.role;
  const canManage = userRole === "owner" || userRole === "manager";

  // Export CSV state and action
  const [isExporting, setIsExporting] = useState(false);
  const [isInviteSheetOpen, setIsInviteSheetOpen] = useState(false);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("daily");
  const exportCSV = useAction(api.dashboardExport.exportOwnerDashboardCSV);

  const handleExport = useCallback(async () => {
    if (!tenantId) return;

    setIsExporting(true);
    try {
      const base64Data = await exportCSV({
        tenantId,
      });

      downloadCsv(base64Data, "dashboard-report");

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  }, [tenantId, exportCSV]);

  // ─── MERGED: Single query replaces 3 separate queries ────────────────
  const dashboardData = useQuery(
    api.dashboard.getDashboardData,
    tenantId
      ? {
          tenantId,
          period,
          topAffiliatesLimit: 10,
          recentCommissionsLimit: 10,
        }
      : "skip"
  );

  const stats = dashboardData?.stats;
  const topAffiliates = dashboardData?.topAffiliates;
  const recentCommissions = dashboardData?.recentCommissions;

  // Remaining lightweight queries
  const activities = useQuery(
    api.dashboard.getRecentActivity,
    tenantId ? { tenantId, limit: 20 } : "skip"
  );

  const planUsage = useQuery(
    api.dashboard.getPlanUsage,
    tenantId ? { tenantId } : "skip"
  );

  const setupStatus = useQuery(
    api.dashboard.getSetupStatus,
    tenantId ? { tenantId } : "skip"
  );

  const isLoading = !dashboardData || !activities;

  // Calculate delta display values
  const mrrDelta = stats && stats.mrrChangePercent !== 0 ? {
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
      <PageTopbar description="Track your affiliate program performance and key metrics at a glance">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Overview</h1>
        <div className="flex items-center gap-3">
          <FilterTabs
            tabs={periodTabs}
            activeTab={period}
            onTabChange={(key) => setPeriod(key as Period)}
            size="sm"
          />
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
          <Button size="sm" onClick={() => setIsInviteSheetOpen(true)}>
            + Invite Affiliate
          </Button>
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        {/* Metric Cards Grid - 4 columns */}
        <FadeIn className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <MetricCard
            label="MRR Influenced"
            numericValue={stats?.mrrInfluenced ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `from ${stats.activeAffiliatesCount} active affiliates` : "—"}
            delta={mrrDelta}
            isLoading={!stats}
            variant="blue"
            icon={<TrendingUp className="w-4 h-4" />}
            sparklineData={stats?.mrrSparkline}
          />
          <MetricCard
            label="Pending"
            numericValue={stats?.pendingCommissionsValue ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `${stats.pendingCommissionsCount} pending` : "—"}
            delta={{ value: 0, isPositive: true, label: "vs last week" }}
            isLoading={!stats}
            variant="yellow"
            icon={<Clock className="w-4 h-4" />}
          />
          <MetricCard
            label="Affiliates"
            numericValue={stats?.activeAffiliatesCount ?? 0}
            subtext="3 pending"
            delta={affiliatesDelta}
            isLoading={!stats}
            variant="green"
            icon={<Users className="w-4 h-4" />}
          />
          <MetricCard
            label="Total Paid Out"
            numericValue={stats?.totalPaidOut ?? 0}
            formatValue={formatCurrency}
            subtext="47 affiliates across all campaigns"
            delta={paidOutDelta}
            isLoading={!stats}
            variant="gray"
            icon={<Wallet className="w-4 h-4" />}
          />
          <MetricCard
            label="Organic Sales"
            numericValue={stats?.recentOrganicConversions ?? 0}
            subtext={
              stats && stats.recentConversions > 0
                ? `${Math.round(((stats.recentOrganicConversions ?? 0) / stats.recentConversions) * 100)}% of all conversions`
                : undefined
            }
            isLoading={!stats}
            variant="blue"
            icon={<Leaf className="w-4 h-4" />}
            sparklineData={stats?.conversionsSparkline}
          />
        </FadeIn>

        {/* Main Content Grid - 1fr 340px with generous gap */}
        <div className="grid gap-8" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left Column - Tables */}
          <div className="space-y-6">
            {/* Recent Commissions Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Commissions</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/reports/commissions">View All</Link>
                  </Button>
                  {canManage && (stats?.pendingCommissionsCount ?? 0) > 0 && (
                    <Button size="sm" className="bg-[var(--success)] text-white hover:bg-[#059669]" asChild>
                      <Link href="/payouts">💸 Pay All Pending</Link>
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
                <Button variant="outline" size="sm" asChild>
                  <Link href="/affiliates">View All</Link>
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
              onInvite={() => setIsInviteSheetOpen(true)}
              onCreateCampaign={() => setIsCreateCampaignOpen(true)}
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
      {/* Invite Affiliate Sheet */}
      <InviteAffiliateSheet
        isOpen={isInviteSheetOpen}
        onClose={() => setIsInviteSheetOpen(false)}
      />

      {/* Create Campaign Side Sheet */}
      <CreateCampaignModal
        isOpen={isCreateCampaignOpen}
        onClose={() => setIsCreateCampaignOpen(false)}
      />
    </div>
  );
}

// ─── Page export with Suspense boundary ──────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
