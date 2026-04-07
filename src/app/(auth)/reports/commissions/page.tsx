"use client";

import { Suspense, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/MetricCard";
import { ExportButton } from "@/components/ui/ExportButton";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, CheckCircle2, RotateCcw, Wallet, CreditCard, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency, shouldShowTruncationWarning } from "@/lib/affiliate-segments";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import { downloadCsv } from "@/lib/utils";

// ── Skeleton ──────────────────────────────────────────────────
function CommissionSummarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
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

// ── Aging Chart ─────────────────────────────────────────────────
function CommissionAgingChart({
  buckets,
}: {
  buckets: Array<{
    ageRange: string;
    pending: number;
    confirmed: number;
    reversed: number;
    paid: number;
  }>;
}) {
  const chartData = buckets.map((b) => ({
    age: b.ageRange,
    Pending: b.pending,
    Confirmed: b.confirmed,
    Reversed: b.reversed,
    Paid: b.paid,
  }));

  const hasData = buckets.some((b) => b.pending + b.confirmed + b.reversed + b.paid > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Commission Aging</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No commission data for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} stackOffset="sign">
              <XAxis dataKey="age" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={60} tickFormatter={(value: number) => formatCurrency(value)} />
              <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
              <Bar dataKey="Pending" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Confirmed" stackId="a" fill="#22c55e" />
              <Bar dataKey="Reversed" stackId="a" fill="#ef4444" />
              <Bar dataKey="Paid" stackId="a" fill="#6b7280" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── Commission Status Table ──────────────────────────────────────
function CommissionStatusTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Commissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground text-center py-8">
          Commission detail table is available on the Commissions report page.
          Use the date range selector to filter by period.
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Content ─────────────────────────────────────────────────
function CommissionSummaryContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;
  const userRole = user?.role;
  const canExport = userRole === "owner" || userRole === "manager";

  const { dateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  // Summary metrics from tenantStats (no table scans)
  const metrics = useQuery(
    api.reports.commissions.getCommissionSummaryMetrics,
    tenantId ? { tenantId } : "skip"
  );

  // Aging buckets
  const agingData = useQuery(
    api.reports.commissions.getCommissionAgingBuckets,
    tenantId ? { tenantId, dateRange: queryDateRange } : "skip"
  );

  const isLoading = !metrics || !agingData;
  const [isExporting, setIsExporting] = useState(false);

  const exportAction = useAction(api.reportsExport.exportProgramReportCSV);

  const handleExport = async () => {
    if (!tenantId) return;
    setIsExporting(true);
    try {
      const base64Data = await exportAction({ tenantId });
      downloadCsv(base64Data, "commission-report");
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
      <PageTopbar description="Review commission status, aging, and distribution">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Commissions</h1>
        <div className="flex items-center gap-2">
          {canExport && (
            <ExportButton onClick={handleExport} isExporting={isExporting} />
          )}
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8 space-y-6">

      {/* Truncation warning */}
      {agingData && (
        <DataTruncationWarning
          resultsLength={agingData.buckets.reduce(
            (sum, b) => sum + b.pending + b.confirmed + b.reversed + b.paid,
            0
          )}
          totalEstimated={agingData.totalEstimated}
        />
      )}

      {/* Metric Cards */}
      <FadeIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Pending Amount"
          numericValue={metrics?.pendingValue ?? 0}
          formatValue={(n) => formatCurrency(n)}
          subtext={`${metrics?.pendingCount ?? 0} commissions`}
          variant="yellow"
          isLoading={isLoading}
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          label="Confirmed This Month"
          numericValue={metrics?.confirmedValueThisMonth ?? 0}
          formatValue={(n) => formatCurrency(n)}
          subtext={`${metrics?.confirmedThisMonth ?? 0} commissions`}
          variant="green"
          isLoading={isLoading}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <MetricCard
          label="Reversed This Month"
          numericValue={metrics?.reversedValueThisMonth ?? 0}
          formatValue={(n) => formatCurrency(n)}
          subtext={`${metrics?.reversedThisMonth ?? 0} commissions`}
          variant="yellow"
          isLoading={isLoading}
          icon={<RotateCcw className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Paid Out"
          numericValue={metrics?.totalPaidOut ?? 0}
          formatValue={(n) => formatCurrency(n)}
          variant="gray"
          isLoading={isLoading}
          icon={<Wallet className="w-4 h-4" />}
        />
        <MetricCard
          label="Pending Payouts"
          numericValue={metrics?.pendingPayoutTotal ?? 0}
          formatValue={(n) => formatCurrency(n)}
          subtext={`${metrics?.pendingPayoutCount ?? 0} payouts`}
          variant="blue"
          isLoading={isLoading}
          icon={<CreditCard className="w-4 h-4" />}
        />
        <MetricCard
          label="Fraud Flags"
          numericValue={metrics?.flagged ?? 0}
          variant="yellow"
          isLoading={isLoading}
          icon={<ShieldAlert className="w-4 h-4" />}
        />
      </FadeIn>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CommissionAgingChart buckets={agingData?.buckets ?? []} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : metrics ? (
              <div className="space-y-4 pt-2">
                {[
                  { label: "Pending", value: metrics.pendingValue, color: "bg-amber-500", pct: metrics.totalPaidOut > 0 ? Math.round((metrics.pendingValue / (metrics.totalPaidOut + metrics.pendingValue + metrics.confirmedValueThisMonth)) * 100) : 0 },
                  { label: "Confirmed", value: metrics.confirmedValueThisMonth, color: "bg-emerald-500", pct: metrics.totalPaidOut > 0 ? Math.round((metrics.confirmedValueThisMonth / (metrics.totalPaidOut + metrics.pendingValue + metrics.confirmedValueThisMonth)) * 100) : 0 },
                  { label: "Reversed", value: metrics.reversedValueThisMonth, color: "bg-red-500", pct: metrics.totalPaidOut > 0 ? Math.round((metrics.reversedValueThisMonth / (metrics.totalPaidOut + metrics.pendingValue + metrics.confirmedValueThisMonth)) * 100) : 0 },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", item.color)}
                        style={{ width: `${Math.min(item.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Commissions Table */}
      <CommissionStatusTable />
      </div>
    </>
  );
}

// ── Page (Suspense wrapper) ─────────────────────────────────────
export default function CommissionsPage() {
  return (
    <Suspense fallback={<CommissionSummarySkeleton />}>
      <CommissionSummaryContent />
    </Suspense>
  );
}

