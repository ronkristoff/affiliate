"use client";

import { Suspense, useState, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  QuickActionsPanel,
  ActivityFeed,
  PlanUsageWidget,
  AlertBanner,
  SummaryCards,
  OverviewChart,
  TrendingSection,
  CommissionBreakdown,
  PendingActions,
} from "./components";
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
import { Loader2, Download, TrendingUp, Clock, Users, Wallet, Leaf, AlertTriangle } from "lucide-react";
import Link from "next/link";

type Period = "daily" | "weekly" | "monthly";

// All preset values + "custom" for the nuqs literal parser
const PRESET_VALUES = [
  "today",
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "allTime",
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
    parseAsStringLiteral(PRESET_VALUES).withDefault("thisMonth"),
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

    // Fallback: this month default
    const fallback = DATE_PRESETS.find((p) => p.value === "thisMonth")!.getRange()!;
    return { dateRange: fallback, period: "weekly" as Period };
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

  // ─── Queries ──────────────────────────────────────────────────────
  // All useQuery hooks called unconditionally (Rules of Hooks)
  // Convex useQuery throws on server error — caught by DashboardErrorBoundary
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

  const setupStatus = useQuery(
    api.dashboard.getSetupStatus,
    tenantId ? { tenantId } : "skip"
  );

   const stats = dashboardData?.stats;
   const topAffiliates = dashboardData?.topAffiliates;
   const topCampaigns = dashboardData?.topCampaigns;
   const recentCommissions = dashboardData?.recentCommissions;

  const isLoading = !dashboardData;

  // MRR delta from the query (compares current vs previous period)
  const mrrDelta = stats && stats.mrrChangePercent !== 0
    ? {
        value: Math.abs(stats.mrrChangePercent),
        isPositive: stats.mrrChangePercent >= 0,
        label: "vs last period",
      }
    : undefined;

  // Build contextual subtexts for each metric card
  const mrrSubtext = stats && stats.activeAffiliatesCount > 0
    ? `from ${stats.activeAffiliatesCount} active affiliate${stats.activeAffiliatesCount === 1 ? "" : "s"}`
    : undefined;

  const affiliatesSubtext = stats && stats.recentConversions > 0
    ? `${stats.recentConversions} referral${stats.recentConversions === 1 ? "" : "s"} this period`
    : undefined;

  const organicSalesSubtext = stats && stats.recentClicks > 0
    ? `${stats.conversionRate}% conversion rate`
    : undefined;

  const totalPaidOutSubtext = stats && stats.pendingCommissionsValue > 0
    ? `${formatCurrency(stats.pendingCommissionsValue)} pending`
    : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar
        description="Track your affiliate program performance and key metrics at a glance"
        actions={
          <DateRangeSelector value={range} onChange={handleDateRangeChange} />
        }
      >
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Overview</h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="page-content">
        {/* Alert Banner */}
        <AlertBanner setupStatus={setupStatus} />
        {/* Metric Cards Grid */}
        <FadeIn>
          <SummaryCards 
            stats={{
              mrr: stats?.mrrInfluenced,
              mrrDelta,
              mrrSparkline: stats?.mrrSparkline,
              mrrSubtext,
              affiliates: stats?.activeAffiliatesCount,
              affiliatesSubtext,
              organicSales: stats?.recentOrganicConversions,
              organicSalesSubtext,
              totalPaidOut: stats?.totalPaidOut,
              totalPaidOutSubtext,
            }}
            isLoading={!stats}
          />
        </FadeIn>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Large Chart */}
          <div className="lg:col-span-2 space-y-0">
            <FadeIn delay={100}>
              <OverviewChart 
                data={stats ? {
                  mrrSparkline: stats.mrrSparkline,
                  clicksSparkline: stats.clicksSparkline,
                  conversionsSparkline: stats.conversionsSparkline
                } : undefined}
                period={period}
                dateRange={dateRange}
                periodLabel={range === "custom" ? "Custom range" : DATE_PRESETS.find((p) => p.value === range)?.label}
                isLoading={!stats}
              />
            </FadeIn>
            <FadeIn delay={200}>
              <PendingActions 
                pendingAffiliates={stats?.affiliatesPending}
                pendingCommissions={stats?.pendingCommissionsCount}
                pendingPayouts={stats?.pendingPayoutCount}
                isLoading={!stats}
              />
            </FadeIn>
          </div>

          {/* Right Column - Trending & Commission Breakdown */}
          <div className="space-y-6">
            <FadeIn delay={300}>
              <TrendingSection 
                topAffiliates={topAffiliates}
                topCampaigns={topCampaigns}
                recentCommissions={recentCommissions}
                isLoading={!topAffiliates}
              />
            </FadeIn>
            <FadeIn delay={400}>
              <CommissionBreakdown 
                approvedCount={stats?.recentConversions ?? 0}
                approvedValue={stats?.mrrInfluenced ?? 0}
                pendingCount={stats?.pendingCommissionsCount}
                pendingValue={stats?.pendingCommissionsValue}
                totalPaidOut={stats?.totalPaidOut}
                isLoading={!stats}
              />
            </FadeIn>
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

// ─── Dashboard Error Boundary (graceful degradation) ────────────────────────
// F2 fix: Convex useQuery throws on server error — caught here.
// Falls back to a degraded view using tenantStats when the heavy
// dashboard query fails (infrastructure error, timeout, etc.).

interface DegradedDashboardProps {
  tenantId?: Id<"tenants">;
}

function DegradedDashboard({ tenantId }: DegradedDashboardProps) {
  // This component renders OUTSIDE the error boundary, so it only
  // uses the lightweight tenantStats query (O(1) read)
  const stats = useQuery(
    api.tenantStats.getStats,
    tenantId ? { tenantId } : "skip"
  );

  const mappedStats = stats ? {
    mrrInfluenced: stats.commissionsConfirmedValueThisMonth,
    activeAffiliatesCount: stats.affiliatesActive,
    pendingCommissionsCount: stats.commissionsPendingCount,
    pendingCommissionsValue: stats.commissionsPendingValue,
    totalPaidOut: stats.totalPaidOut,
    recentClicks: 0,
    recentConversions: stats.commissionsConfirmedThisMonth,
    recentOrganicConversions: 0,
    previousPeriodMrr: 0,
    mrrChangePercent: 0,
    mrrSparkline: [] as number[],
    clicksSparkline: [] as number[],
    conversionsSparkline: [] as number[],
    approvedConversionsCount: stats.commissionsConfirmedThisMonth,
    previousPeriodApprovedConversions: 0,
    conversionRate: 0,
    affiliatesPending: stats.affiliatesPending,
    pendingPayoutCount: stats.pendingPayoutCount,
    pendingPayoutTotal: stats.pendingPayoutTotal,
  } : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar description="Track your affiliate program performance and key metrics at a glance">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Overview</h1>
      </PageTopbar>
      <div className="page-content">
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Showing cached stats — live data temporarily unavailable. Some metrics may be delayed.</span>
        </div>
        <FadeIn>
          <SummaryCards 
            stats={{
              mrr: mappedStats?.mrrInfluenced,
              affiliates: mappedStats?.activeAffiliatesCount,
              organicSales: mappedStats?.recentOrganicConversions,
              totalPaidOut: mappedStats?.totalPaidOut,
            }}
            isLoading={!mappedStats}
          />
        </FadeIn>
        <FadeIn delay={100}>
          <PendingActions 
            pendingAffiliates={mappedStats?.affiliatesPending}
            pendingCommissions={mappedStats?.pendingCommissionsCount}
            pendingPayouts={mappedStats?.pendingPayoutCount}
            isLoading={!mappedStats}
          />
        </FadeIn>
      </div>
    </div>
  );
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  tenantId?: Id<"tenants">;
}

class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  DashboardErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): DashboardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Dashboard] Query error caught by error boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render degraded dashboard — uses tenantStats instead of heavy query
      // We pass tenantId via a wrapper so the degraded component can fetch it
      return <DegradedDashboardErrorFallback />;
    }
    return this.props.children;
  }
}

/**
 * Wrapper that extracts tenantId for the degraded fallback.
 * Uses a separate useQuery (tenantStats) which is lightweight and unlikely to fail.
 */
function DegradedDashboardErrorFallback() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;
  return <DegradedDashboard tenantId={tenantId} />;
}

// ─── Page export with Suspense + Error boundary ──────────────────────────

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
