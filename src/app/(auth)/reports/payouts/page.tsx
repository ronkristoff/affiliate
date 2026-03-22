"use client";

import { Suspense, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, AlertTriangle, Loader2, Wallet, Clock, Package, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, shouldShowTruncationWarning } from "@/lib/affiliate-segments";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import { PayoutTrendChart, PayoutBatchTable } from "./components";

// ── Skeleton ──────────────────────────────────────────────────
function PayoutHistorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ── Data Truncation Warning ─────────────────────────────────────
function DataTruncationWarning({
  resultsLength,
  totalEstimated,
}: {
  resultsLength: number;
  totalEstimated: number;
}) {
  if (!shouldShowTruncationWarning(resultsLength, totalEstimated)) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 mb-4">
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800">
        Showing {resultsLength} of ~{totalEstimated.toLocaleString()} records.
        Narrow the date range for more accurate data.
      </p>
    </div>
  );
}

// ── Main Content ─────────────────────────────────────────────────
function PayoutHistoryContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;
  const userRole = user?.role;
  const canViewSensitiveData = userRole === "owner" || userRole === "manager";
  const canExport = canViewSensitiveData;

  const { dateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  // Report metrics from tenantStats
  const metrics = useQuery(
    api.reports.payouts.getPayoutReportMetrics,
    tenantId ? { tenantId } : "skip"
  );

  // Monthly trend data for chart
  const trendData = useQuery(
    api.reports.payouts.getPayoutMonthlyTrend,
    tenantId ? { tenantId } : "skip"
  );

  // Export data for truncation warning
  const exportData = useQuery(
    api.reports.payouts.getPayoutExportData,
    tenantId ? { tenantId, dateRange: queryDateRange } : "skip"
  );

  const isLoading = !metrics || !trendData;
  const [isExporting, setIsExporting] = useState(false);

  const exportAction = useAction(api.reportsExport.exportPayoutReportCSV);

  // Compute avg batch size
  const avgBatchSize =
    metrics && metrics.batchesThisMonth > 0
      ? metrics.totalPaidOut / metrics.batchesThisMonth
      : 0;

  const handleExport = async () => {
    if (!tenantId) return;
    setIsExporting(true);
    try {
      const base64Data = await exportAction({
        tenantId,
        dateRange: queryDateRange,
      });
      downloadCsv(base64Data, "payout-history");
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">
            Payout History & Trends
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track payout batches, monthly trends, and export data.
          </p>
        </div>
        {canExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Truncation warning */}
      {exportData && (
        <DataTruncationWarning
          resultsLength={exportData.data.length}
          totalEstimated={exportData.totalEstimated}
        />
      )}

      {/* Metric Cards */}
      <FadeIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Paid Out"
          numericValue={metrics?.totalPaidOut ?? 0}
          formatValue={(n) => formatCurrency(n)}
          variant="green"
          isLoading={isLoading}
          icon={<Wallet className="w-4 h-4" />}
        />
        <MetricCard
          label="Pending Payouts"
          numericValue={metrics?.pendingPayoutTotal ?? 0}
          formatValue={(n) => formatCurrency(n)}
          subtext={`${metrics?.pendingPayoutCount ?? 0} payouts`}
          variant="yellow"
          isLoading={isLoading}
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          label="Batches This Month"
          numericValue={metrics?.batchesThisMonth ?? 0}
          variant="blue"
          isLoading={isLoading}
          icon={<Package className="w-4 h-4" />}
        />
        <MetricCard
          label="Avg Batch Size"
          numericValue={avgBatchSize}
          formatValue={(n) => formatCurrency(n)}
          variant="gray"
          isLoading={isLoading}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </FadeIn>

      {/* Trend Chart */}
      <PayoutTrendChart
        data={trendData ?? []}
        canViewSensitiveData={canViewSensitiveData}
        isLoading={isLoading}
      />

      {/* Batch Table */}
      {tenantId && (
        <div>
          <h2 className="text-base font-semibold text-[var(--text-heading)] mb-3">
            Payout Batches
          </h2>
          <PayoutBatchTable
            tenantId={tenantId}
            canViewSensitiveData={canViewSensitiveData}
          />
        </div>
      )}
    </div>
  );
}

// ── Page (Suspense wrapper) ─────────────────────────────────────
export default function PayoutHistoryPage() {
  return (
    <Suspense fallback={<PayoutHistorySkeleton />}>
      <PayoutHistoryContent />
    </Suspense>
  );
}
