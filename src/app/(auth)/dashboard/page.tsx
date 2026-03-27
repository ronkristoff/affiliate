"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
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
import { DateRangeSelector, type DateRangeChange } from "./components/DateRangeSelector";
import { InviteAffiliateSheet } from "@/components/affiliate/InviteAffiliateSheet";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { downloadCsv } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { DATE_PRESETS, inferPeriodFromRange } from "@/lib/date-utils";
import {
  useQueryState,
  parseAsStringLiteral,
  parseAsInteger,
} from "nuqs";
import { toast } from "sonner";
import { Loader2, Download, TrendingUp, Clock, Users, Wallet, Leaf } from "lucide-react";
import Link from "next/link";

type Period = "daily" | "weekly" | "monthly";

// All preset values + "custom" for the nuqs literal parser
const PRESET_VALUES = [
  "today",
  "thisWeek",
  "thisMonth",
  "7d",
  "30d",
  "90d",
  "lastMonth",
  "custom",
] as const;

// ─── Skeleton fallback for Suspense boundary ─────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Alert Banner skeleton */}
      <div className="page-content pt-6">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Top Bar skeleton */}
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-5 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-36 rounded-md" />
          </div>
        </div>
      </div>

      {/* Metric Cards skeleton */}
      <div className="page-content">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-light)]">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Main Content Grid skeleton */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left column */}
          <div className="space-y-6">
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
              </div>
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-md" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-5">
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            </div>
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-5">
              <Skeleton className="h-4 w-28 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-32 mb-1" />
                      <Skeleton className="h-2 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-5">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-2 w-full mb-1" />
              <Skeleton className="h-2 w-3/4" />
            </div>
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
  const exportCSV = useAction(api.dashboardExport.exportOwnerDashboardCSV);

  // ─── URL state via nuqs ──────────────────────────────────────────────
  // `range` = preset key (e.g. "30d", "thisMonth", "custom")
  // `start` / `end` = epoch ms timestamps (only set when range=custom)
  // clearOnDefault is enabled globally in NuqsAdapter — default values won't appear in the URL
  const [range, setRange] = useQueryState(
    "range",
    parseAsStringLiteral(PRESET_VALUES).withDefault("30d"),
  );
  const [customStart, setCustomStart] = useQueryState("start", parseAsInteger.withDefault(0));
  const [customEnd, setCustomEnd] = useQueryState("end", parseAsInteger.withDefault(0));

  // Derive dateRange + period from URL state (no useEffect needed)
  const { dateRange, period } = useMemo(() => {
    if (range === "custom" && customStart > 0 && customEnd > 0) {
      return {
        dateRange: { start: customStart, end: customEnd },
        period: inferPeriodFromRange(customStart, customEnd) as Period,
      };
    }

    const preset = DATE_PRESETS.find((p) => p.value === range);
    const range_ = preset?.getRange();
    if (range_) {
      return {
        dateRange: range_,
        period: (preset?.period ?? "daily") as Period,
      };
    }

    // Fallback: 30d default
    const fallback = DATE_PRESETS.find((p) => p.value === "30d")!.getRange()!;
    return { dateRange: fallback, period: "daily" as Period };
  }, [range, customStart, customEnd]);

  // ─── Handler: DateRangeSelector → nuqs ──────────────────────────────
  const handleDateRangeChange = useCallback(
    (change: DateRangeChange) => {
      if (change.isCustom) {
        // Custom range: store timestamps in URL
        setRange("custom");
        setCustomStart(change.start);
        setCustomEnd(change.end);
      } else if (change.preset) {
        // Preset: clear custom timestamps, set preset key
        setRange(change.preset as (typeof PRESET_VALUES)[number]);
        setCustomStart(0);
        setCustomEnd(0);
      }
    },
    [setRange, setCustomStart, setCustomEnd],
  );

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
    tenantId && dateRange
      ? {
          tenantId,
          dateRange,
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
    value: 8,
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
      {/* Alert Banner */}
      <AlertBanner setupStatus={setupStatus} />

      {/* Top Bar */}
      <PageTopbar description="Track your affiliate program performance and key metrics at a glance">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Overview</h1>
        <div className="flex items-center">
          <DateRangeSelector value={range} onChange={handleDateRangeChange} />
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="page-content">
        {/* Metric Cards Grid */}
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

        {/* Main Content Grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left Column - Tables */}
          <div className="space-y-6">
            {/* Recent Commissions Table */}
            <div className="table-card animate-content-in-delay-1">
              <div className="card-header">
                <h3 className="card-title">Recent Commissions</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/reports/commissions">View All</Link>
                  </Button>
                  {canManage && (stats?.pendingCommissionsCount ?? 0) > 0 && (
                    <Button size="sm" className="bg-[var(--success)] text-white hover:bg-[#059669]" asChild>
                      <Link href="/payouts">Pay All Pending</Link>
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
            <div className="table-card animate-content-in-delay-2">
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

          {/* Right Column - Widgets */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="animate-content-in-delay-1">
              <QuickActionsPanel
                pendingCount={stats?.pendingCommissionsCount}
                showPayAll={canManage}
                onInvite={() => setIsInviteSheetOpen(true)}
                onCreateCampaign={() => setIsCreateCampaignOpen(true)}
              />
            </div>

            {/* Activity Feed */}
            <div className="animate-content-in-delay-2">
              <ActivityFeed
                activities={activities ?? []}
                isLoading={!activities}
              />
            </div>

            {/* Plan Usage */}
            <div className="animate-content-in-delay-3">
              <PlanUsageWidget
                usage={planUsage}
                isLoading={!planUsage}
              />
            </div>
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
