"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  QuickActionsPanel,
  ActivityFeed,
  PlanUsageWidget,
  AlertBanner,
  SummaryCards,
  OverviewChart,
  TrendingSection,
  CommissionsSummary,
  PendingActions,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-light)] flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left column - Large Chart */}
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>

          {/* Right column - Trending & Commissions */}
          <div className="space-y-6">
            <Skeleton className="h-[300px] w-full rounded-xl" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>
        </div>

        {/* Bottom Section - Pending Actions */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
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

  const setupStatus = useQuery(
    api.dashboard.getSetupStatus,
    tenantId ? { tenantId } : "skip"
  );

  const isLoading = !dashboardData;

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
      <div className="page-content bg-[#f8fafc]">
        {/* Metric Cards Grid */}
        <FadeIn>
          <SummaryCards 
            stats={{
              revenue: stats?.mrrInfluenced,
              referrals: stats?.recentConversions,
              payingCustomers: stats?.recentConversions, // Example mapping
              promoters: stats?.activeAffiliatesCount,
            }}
            isLoading={!stats}
          />
        </FadeIn>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Large Chart */}
          <div className="lg:col-span-2">
            <FadeIn delay={100}>
              <OverviewChart 
                data={stats ? {
                  mrrSparkline: stats.mrrSparkline,
                  clicksSparkline: stats.clicksSparkline,
                  conversionsSparkline: stats.conversionsSparkline
                } : undefined}
                isLoading={!stats}
              />
            </FadeIn>
          </div>

          {/* Right Column - Trendings & Commissions */}
          <div className="space-y-6">
            <FadeIn delay={200}>
              <TrendingSection 
                topAffiliates={topAffiliates}
                isLoading={!topAffiliates}
              />
            </FadeIn>
            <FadeIn delay={300}>
              <CommissionsSummary 
                totalEarned={stats?.mrrInfluenced}
                isLoading={!stats}
              />
            </FadeIn>
          </div>
        </div>

        {/* Bottom Section - Pending Actions */}
        <FadeIn delay={400}>
          <PendingActions 
            pendingCommissions={stats?.pendingCommissionsCount}
            pendingPromoters={0} // Not available in stats yet
            pendingReferrals={0} // Not available in stats yet
            isLoading={!stats}
          />
        </FadeIn>
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
