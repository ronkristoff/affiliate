"use client";

import { useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { DateRangeSelector } from "@/app/(auth)/dashboard/components";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Download, Users, Loader2, TrendingUp, MousePointerClick, Target, DollarSign } from "lucide-react";
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

  // Fetch summary metrics
  const summaryMetrics = useQuery(
    api.reports.getProgramSummaryMetrics,
    tenantId ? { tenantId, dateRange: queryDateRange, campaignId: selectedCampaignId as Id<"campaigns"> | undefined } : "skip"
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

  // Calculate deltas for display
  const clicksDelta = summaryMetrics && summaryMetrics.previousTotalClicks > 0
    ? {
        value: Math.round(((summaryMetrics.totalClicks - summaryMetrics.previousTotalClicks) / summaryMetrics.previousTotalClicks) * 100),
        isPositive: summaryMetrics.totalClicks >= summaryMetrics.previousTotalClicks,
      }
    : undefined;

  const conversionsDelta = summaryMetrics && summaryMetrics.previousTotalConversions > 0
    ? {
        value: Math.round(((summaryMetrics.totalConversions - summaryMetrics.previousTotalConversions) / summaryMetrics.previousTotalConversions) * 100),
        isPositive: summaryMetrics.totalConversions >= summaryMetrics.previousTotalConversions,
      }
    : undefined;

  const commissionsDelta = summaryMetrics && summaryMetrics.previousTotalCommissions > 0
    ? {
        value: Math.round(((summaryMetrics.totalCommissions - summaryMetrics.previousTotalCommissions) / summaryMetrics.previousTotalCommissions) * 100),
        isPositive: summaryMetrics.totalCommissions >= summaryMetrics.previousTotalCommissions,
      }
    : undefined;

  const conversionRateDelta = summaryMetrics && summaryMetrics.previousAvgConversionRate > 0
    ? {
        value: Math.round(((summaryMetrics.avgConversionRate - summaryMetrics.previousAvgConversionRate) / summaryMetrics.previousAvgConversionRate) * 100),
        isPositive: summaryMetrics.avgConversionRate >= summaryMetrics.previousAvgConversionRate,
      }
    : undefined;

  return (
    <>
      {/* Sticky Top Bar */}
      <PageTopbar description="Overview of your affiliate program performance">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Reports</h1>
        <div className="flex items-center gap-2">
          <CampaignFilterDropdown
            selectedCampaignId={selectedCampaignId}
            onCampaignSelect={setSelectedCampaignId}
          />
          <DateRangeSelector onChange={handleDateRangeChange} />
          {canExport && (
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
          )}
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8 space-y-6">

      {/* Summary Metrics */}
      <FadeIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="MRR Influenced"
          numericValue={summaryMetrics?.mrrInfluenced ?? 0}
          formatValue={(n) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          delta={commissionsDelta}
          variant="blue"
          isLoading={isLoading}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Clicks"
          numericValue={summaryMetrics?.totalClicks ?? 0}
          delta={clicksDelta}
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
          delta={conversionsDelta}
          variant="yellow"
          isLoading={isLoading}
          icon={<Target className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Commissions"
          numericValue={summaryMetrics?.totalCommissions ?? 0}
          formatValue={(n) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          delta={commissionsDelta}
          variant="gray"
          isLoading={isLoading}
          icon={<DollarSign className="w-4 h-4" />}
        />
      </FadeIn>

      {/* Top Affiliates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top Affiliates by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Affiliate</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Clicks</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Conversions</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {topAffiliates.map((affiliate: { _id: Id<"affiliates">; name: string; email: string; clicks: number; conversions: number; commissions: number }) => (
                    <tr key={affiliate._id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="font-medium">{affiliate.name}</div>
                        <div className="text-xs text-muted-foreground">{affiliate.email}</div>
                      </td>
                      <td className="text-right py-3 px-2">{affiliate.clicks.toLocaleString()}</td>
                      <td className="text-right py-3 px-2">{affiliate.conversions.toLocaleString()}</td>
                      <td className="text-right py-3 px-2">
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
            <div className="text-center py-8 text-muted-foreground">
              No affiliate data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}
