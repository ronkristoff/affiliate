"use client";

import { Suspense, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/MetricCard";
import { ExportButton } from "@/components/ui/ExportButton";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldAlert, Users, Flag, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, shouldShowTruncationWarning } from "@/lib/affiliate-segments";
import { escapeCsvField, downloadCsvFromString } from "@/lib/csv-utils";
import {
  FraudSeverityChart,
  FraudSeverityChartSkeleton,
  FraudTypeChart,
  FraudTypeChartSkeleton,
  FraudTrendChart,
  FraudTrendChartSkeleton,
  FlaggedCommissionsTable,
} from "./components";

// ── Skeleton ──────────────────────────────────────────────────
function FraudDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

// ── Needs Attention Alert ──────────────────────────────────────
function NeedsAttentionAlert({
  unreviewedHighSeverity,
}: {
  unreviewedHighSeverity: number;
}) {
  if (unreviewedHighSeverity <= 0) return null;

  return (
    <FadeIn>
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">
            {unreviewedHighSeverity} unreviewed high-severity signal{unreviewedHighSeverity !== 1 ? "s" : ""} need attention
          </p>
          <p className="text-sm text-red-700 mt-0.5">
            Review these signals immediately to assess potential fraud risk.
          </p>
        </div>
      </div>
    </FadeIn>
  );
}

// ── Main Content ─────────────────────────────────────────────────
function FraudDashboardContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;
  const userRole = user?.role;
  const canViewSensitiveData = userRole === "owner" || userRole === "manager";
  const canExport = canViewSensitiveData;

  // Queries
  const metrics = useQuery(
    api.reports.fraud.getFraudReportMetrics,
    tenantId ? { tenantId } : "skip"
  );

  const flaggedData = useQuery(
    api.reports.fraud.getFlaggedCommissions,
    tenantId ? { tenantId } : "skip"
  );

  const trendData = useQuery(
    api.reports.fraud.getFraudTrendData,
    tenantId ? { tenantId } : "skip"
  );

  const fraudExportData = useQuery(
    api.reports.fraud.getFraudExportData,
    tenantId ? { tenantId } : "skip"
  );

  const isLoading = !metrics || !flaggedData || !trendData;
  const [isExporting, setIsExporting] = useState(false);

  // Chart data transformations
  const severityChartData = metrics
    ? [
        { name: "Low", count: metrics.signalsBySeverity.low },
        { name: "Medium", count: metrics.signalsBySeverity.medium },
        { name: "High", count: metrics.signalsBySeverity.high },
      ]
    : [];

  const typeChartData = metrics
    ? [
        { name: "Self-Referral", count: metrics.signalsByType.selfReferral },
        { name: "Bot Traffic", count: metrics.signalsByType.botTraffic },
        { name: "IP Anomaly", count: metrics.signalsByType.ipAnomaly },
      ]
    : [];

  // Compute unreviewed high-severity signals count for the alert
  const unreviewedHighSeverity =
    metrics?.signalsBySeverity.high && metrics?.reviewedVsUnreviewed
      ? // Estimate: total high minus a rough ratio based on overall review rate
        // Actually we can't compute exact unreviewed high from the aggregated metrics.
        // Use a simpler heuristic: if there are high severity signals and unreviewed signals,
        // show the alert with unreviewed count (conservative approach).
        metrics.reviewedVsUnreviewed.unreviewed > 0 && metrics.signalsBySeverity.high > 0
          ? Math.min(metrics.signalsBySeverity.high, metrics.reviewedVsUnreviewed.unreviewed)
          : 0
      : 0;

  // CSV Export handler
  const handleExport = async () => {
    if (!fraudExportData || fraudExportData.data.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);
    try {
      const headers = [
        "Commission ID",
        "Affiliate Name",
        "Amount",
        "Status",
        "Self-Referral",
        "Date",
      ];
      const rows = fraudExportData.data.map((row) => [
        escapeCsvField(row.commissionId),
        escapeCsvField(row.affiliateName ?? "Unknown"),
        row.amount.toFixed(2),
        escapeCsvField(row.status),
        row.isSelfReferral ? "Yes" : "No",
        new Date(row.createdAt).toISOString(),
      ]);

      const csvContent =
        "\uFEFF" +
        headers.join(",") +
        "\n" +
        rows.map((row) => row.join(",")).join("\n");

      const date = new Date().toISOString().split("T")[0];
      downloadCsvFromString(csvContent, `fraud-report-${date}`);
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Sticky Top Bar */}
      <PageTopbar
        description="Monitor fraud signals, risk trends, and flagged commissions"
        actions={
          canExport && (
            <ExportButton
              onClick={handleExport}
              isExporting={isExporting}
              disabled={!fraudExportData || fraudExportData.data.length === 0}
            />
          )
        }
      >
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Fraud & Risk</h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8 space-y-6">

      {/* Needs Attention Alert */}
      <NeedsAttentionAlert unreviewedHighSeverity={unreviewedHighSeverity} />

      {/* Truncation Warning */}
      {flaggedData &&
        shouldShowTruncationWarning(
          flaggedData.commissions.length,
          flaggedData.totalEstimated
        ) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Showing {flaggedData.commissions.length} of ~
              {flaggedData.totalEstimated.toLocaleString()} flagged commissions.
              Some results may be truncated.
            </p>
          </div>
        )}

      {/* Metric Cards */}
      <FadeIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Flagged Commissions"
          numericValue={metrics?.flaggedCommissions ?? 0}
          icon={<Flag className="w-4 h-4" />}
          variant="yellow"
          isLoading={isLoading}
        />
        <MetricCard
          label="Affiliates with Signals"
          numericValue={metrics?.affiliatesWithSignals ?? 0}
          icon={<Users className="w-4 h-4" />}
          variant="blue"
          isLoading={isLoading}
        />
        <MetricCard
          label="Unreviewed Signals"
          numericValue={metrics?.reviewedVsUnreviewed.unreviewed ?? 0}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant="yellow"
          isLoading={isLoading}
        />
        <MetricCard
          label="High Severity"
          numericValue={metrics?.signalsBySeverity.high ?? 0}
          icon={<AlertOctagon className="w-4 h-4" />}
          variant="yellow"
          isLoading={isLoading}
        />
      </FadeIn>

      {/* Charts Row: Severity + Type */}
      <div className="grid gap-6 lg:grid-cols-2">
        {isLoading ? (
          <>
            <FraudSeverityChartSkeleton />
            <FraudTypeChartSkeleton />
          </>
        ) : (
          <>
            <FraudSeverityChart data={severityChartData} />
            <FraudTypeChart data={typeChartData} />
          </>
        )}
      </div>

      {/* Fraud Trend */}
      {isLoading ? (
        <FraudTrendChartSkeleton />
      ) : (
        <FraudTrendChart data={trendData ?? []} />
      )}

      {/* Flagged Commissions Table */}
      <FlaggedCommissionsTable
        commissions={flaggedData?.commissions ?? []}
        canViewSensitiveData={canViewSensitiveData}
        isLoading={isLoading}
      />
      </div>
    </>
  );
}

// ── Page (Suspense wrapper) ─────────────────────────────────────
export default function FraudPage() {
  return (
    <Suspense fallback={<FraudDashboardSkeleton />}>
      <FraudDashboardContent />
    </Suspense>
  );
}
