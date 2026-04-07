"use client";

import { useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { ExportButton } from "@/components/ui/ExportButton";
import { DateRangeSelector } from "@/app/(auth)/dashboard/components";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Users, TrendingUp, MousePointerClick, Target, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import { CampaignFilterDropdown } from "./campaigns/components";
import { downloadCsv } from "@/lib/utils";

export default function ReportsIndexPage() {
  // Use shared date range hook for global consistency
  const { dateRange, setDateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  // Get current user to determine tenant and role
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  // RBAC: Determine if user can export
  const userRole = user?.role;
  const canExport = userRole === "owner" || userRole === "manager";

  // Fetch summary metrics - getProgramSummaryMetrics uses 'window' preset (thisMonth/lastMonth/last3Months)
  const summaryMetrics = useQuery(
    api.reports.getProgramSummaryMetrics,
    tenantId ? { tenantId } : "skip"
  );

  // Fetch top affiliates for the period
  const topAffiliates = useQuery(
    api.reports.getTopAffiliatesByRevenue,
    tenantId ? { tenantId, dateRange: queryDateRange, limit: 10 } : "skip"
  );

  // Export CSV action
  const exportCSV = useAction(api.reportsExport.exportProgramReportCSV);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: { start: number; end: number; label: string; isCustom: boolean; preset?: string }) => {
    setDateRange({
      start: range.start,
      end: range.end,
      label: range.label,
      isCustom: range.isCustom,
      preset: range.preset,
    });
  }, [setDateRange]);

  // Handle export
  const handleExport = async () => {
    if (!tenantId) return;

    setIsExporting(true);
    try {
      const base64Data = await exportCSV({
        tenantId,
        dateRange: queryDateRange,
        campaignId: selectedCampaignId as Id<"campaigns"> | undefined,
      });

      // Use shared utility for download
      downloadCsv(base64Data, "program-report");

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = !summaryMetrics || !topAffiliates;

  return (
    <>
      {/* Sticky Top Bar */}
      <PageTopbar
        description="Overview of your affiliate program performance"
        breadcrumbs={[{ label: "Insights", href: "/reports" }, { label: "Overview" }]}
      >
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Reports</h1>
        <div className="flex items-center gap-2">
          <CampaignFilterDropdown
            selectedCampaignId={selectedCampaignId}
            onCampaignSelect={setSelectedCampaignId}
          />
          <DateRangeSelector value={dateRange?.isCustom ? "custom" : (dateRange?.preset ?? "thisMonth")} onChange={handleDateRangeChange} />
          {canExport && (
            <ExportButton onClick={handleExport} isExporting={isExporting} />
          )}
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="page-content space-y-6">

      {/* Summary Metrics */}
      <FadeIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="MRR Influenced"
          numericValue={summaryMetrics?.mrrInfluenced ?? 0}
          formatValue={(n) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          variant="blue"
          isLoading={isLoading}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Clicks"
          numericValue={summaryMetrics?.totalClicks ?? 0}
          variant="green"
          isLoading={isLoading}
          icon={<MousePointerClick className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Conversions"
          numericValue={summaryMetrics?.totalConversions ?? 0}
          subtext={
            summaryMetrics && summaryMetrics.totalConversions > 0
              ? `${summaryMetrics.organicConversions} organic · ${Math.max(0, summaryMetrics.totalConversions - summaryMetrics.organicConversions)} attributed`
              : `${summaryMetrics?.avgConversionRate?.toFixed(1) ?? 0}% conversion rate`
          }
          variant="yellow"
          isLoading={isLoading}
          icon={<Target className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Commissions"
          numericValue={summaryMetrics?.totalCommissions ?? 0}
          formatValue={(n) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          variant="gray"
          isLoading={isLoading}
          icon={<DollarSign className="w-4 h-4" />}
        />
      </FadeIn>

      {/* Top Affiliates Table */}
      <div className="table-card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--text-muted)]" />
            Top Affiliates by Revenue
          </h3>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : topAffiliates && topAffiliates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-light)]">
                    <th className="text-left py-3 px-2 font-medium text-[var(--text-muted)] text-[12px]">Affiliate</th>
                    <th className="text-right py-3 px-2 font-medium text-[var(--text-muted)] text-[12px]">Clicks</th>
                    <th className="text-right py-3 px-2 font-medium text-[var(--text-muted)] text-[12px]">Conversions</th>
                    <th className="text-right py-3 px-2 font-medium text-[var(--text-muted)] text-[12px]">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {topAffiliates.map((affiliate: { _id: Id<"affiliates">; name: string; email: string; clicks: number; conversions: number; commissions: number }) => (
                    <tr key={affiliate._id} className="border-b last:border-0 border-[var(--border-light)] hover:bg-[var(--bg-page)] transition-colors">
                      <td className="py-3 px-2">
                        <div className="font-medium text-[13px]">{affiliate.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">{affiliate.email}</div>
                      </td>
                      <td className="text-right py-3 px-2 text-[13px] tabular-nums">{affiliate.clicks.toLocaleString()}</td>
                      <td className="text-right py-3 px-2 text-[13px] tabular-nums">{affiliate.conversions.toLocaleString()}</td>
                      <td className="text-right py-3 px-2 text-[13px] font-medium tabular-nums">
                        ₱{affiliate.commissions.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)] text-[13px]">
              No affiliate data available for the selected period
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
