"use client";

import { Suspense, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConversionFunnel,
  FunnelAffiliateTable,
} from "./components";
import { CampaignFilterDropdown } from "@/app/(auth)/reports/campaigns/components/CampaignFilterDropdown";
import { Download, AlertTriangle, Loader2, MousePointerClick, Target, BadgeCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, shouldShowTruncationWarning } from "@/lib/affiliate-segments";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import { downloadCsvFromString, escapeCsvField } from "@/lib/csv-utils";

// ── Skeleton ──────────────────────────────────────────────────
function FunnelPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

// ── Data Truncation Warning ─────────────────────────────────────
function DataTruncationWarning({
  totalEstimated,
}: {
  totalEstimated: number;
}) {
  if (totalEstimated <= 5000) return null;
  // Show warning if we collected the cap (5000) and estimate is higher
  const ratio = 5000 / totalEstimated;
  if (ratio >= 0.8) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800">
        Data may be incomplete — showing approximately {Math.round(ratio * 100)}% of ~
        {totalEstimated.toLocaleString()} total records. Narrow the date range or filter
        by campaign for more accurate results.
      </p>
    </div>
  );
}

// ── By-Campaign Summary Cards ──────────────────────────────────
function CampaignFunnelCards({
  byCampaign,
  canViewSensitiveData,
}: {
  byCampaign: Array<{
    campaignId: Id<"campaigns">;
    name: string;
    clicks: number;
    conversions: number;
    commissions: number;
    funnelRate: number;
  }>;
  canViewSensitiveData: boolean;
}) {
  if (byCampaign.length === 0) return null;

  return (
    <FadeIn delay={300}>
      <div>
        <h3 className="text-base font-semibold text-[var(--text-heading)] mb-4">
          Funnel by Campaign
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byCampaign.slice(0, 6).map((campaign) => {
            const conversionRate = campaign.clicks > 0
              ? ((campaign.conversions / campaign.clicks) * 100).toFixed(1)
              : "0.0";

            return (
              <div
                key={campaign.campaignId}
                className="rounded-xl border bg-[var(--bg-surface)] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text-heading)] truncate max-w-[60%]">
                    {campaign.name}
                  </p>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-full",
                    campaign.funnelRate >= 10
                      ? "bg-emerald-100 text-emerald-700"
                      : campaign.funnelRate >= 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                  )}>
                    {canViewSensitiveData ? `${campaign.funnelRate.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold tabular-nums">{campaign.clicks.toLocaleString()}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Clicks</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums">{campaign.conversions.toLocaleString()}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Conversions</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums">
                      {canViewSensitiveData
                        ? formatCurrency(campaign.commissions)
                        : "—"}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">Commissions</p>
                  </div>
                </div>
                {/* Mini funnel bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand-primary)]/70 transition-all"
                    style={{ width: `${Math.min(parseFloat(conversionRate), 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Conv. rate: {conversionRate}%
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </FadeIn>
  );
}

// ── Main Content ─────────────────────────────────────────────────
function FunnelPageContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;
  const userRole = user?.role;
  const canViewSensitiveData = userRole === "owner" || userRole === "manager";

  const { dateRange, setDateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);

  // Fetch funnel data
  const funnelData = useQuery(
    api.reports.funnel.getConversionFunnel,
    tenantId
      ? {
          tenantId,
          dateRange: queryDateRange,
          campaignId: selectedCampaignId as Id<"campaigns"> | undefined,
        }
      : "skip"
  );

  // Fetch export data
  const exportData = useQuery(
    api.reports.funnel.getFunnelExportData,
    tenantId && isExporting
      ? {
          tenantId,
          dateRange: queryDateRange,
          campaignId: selectedCampaignId as Id<"campaigns"> | undefined,
        }
      : "skip"
  );

  const isLoading = funnelData === undefined;

  // Handle export
  const handleExport = async () => {
    if (!tenantId) return;
    if (!canViewSensitiveData) {
      toast.error("Export requires owner or manager access");
      return;
    }

    setIsExporting(true);
    try {
      // We use the already-fetched exportData query result
      if (!exportData || exportData.data.length === 0) {
        toast.error("No data to export");
        return;
      }

      const headers = [
        "Affiliate Name",
        "Clicks",
        "Conversions",
        "Commissions",
        "Funnel Rate (%)",
      ];
      const rows = [headers.join(",")];

      for (const row of exportData.data) {
        rows.push([
          escapeCsvField(row.name),
          String(row.clicks),
          String(row.conversions),
          row.commissions.toFixed(2),
          row.funnelRate.toFixed(2),
        ].join(","));
      }

      const csv = "\uFEFF" + rows.join("\n");
      downloadCsvFromString(csv, `funnel-report-${new Date().toISOString().split("T")[0]}`);
      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Read-only indicator for viewers */}
      {!canViewSensitiveData && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            Read-only mode: Commission values are hidden. Contact your administrator for full access.
          </span>
        </div>
      )}

      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conversion Funnel</h1>
          <p className="text-muted-foreground">
            Track your click-to-commission conversion pipeline
          </p>
          {dateRange && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing data for:{" "}
              <span className="font-medium text-foreground">{dateRange.label}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CampaignFilterDropdown
            selectedCampaignId={selectedCampaignId}
            onCampaignSelect={setSelectedCampaignId}
          />
          {canViewSensitiveData && (
            <Button
              variant="outline"
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
      </div>

      {/* Truncation warning */}
      {funnelData && (
        <DataTruncationWarning totalEstimated={funnelData.totalEstimated} />
      )}

      {/* Metric Cards */}
      <FadeIn className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Clicks"
          numericValue={funnelData?.totalClicks ?? 0}
          icon={<MousePointerClick className="w-4 h-4" />}
          variant="blue"
          isLoading={isLoading}
        />
        <MetricCard
          label="Conversions"
          numericValue={funnelData?.totalConversions ?? 0}
          icon={<Target className="w-4 h-4" />}
          variant="green"
          isLoading={isLoading}
          subtext={
            funnelData && funnelData.totalClicks > 0
              ? `${funnelData.clickToConversionRate.toFixed(1)}% conversion rate`
              : undefined
          }
        />
        <MetricCard
          label="Confirmed Commissions"
          numericValue={canViewSensitiveData ? (funnelData?.totalCommissions ?? 0) : 0}
          formatValue={(n) => formatCurrency(n)}
          icon={<BadgeCheck className="w-4 h-4" />}
          variant={canViewSensitiveData ? "green" : "gray"}
          isLoading={isLoading}
          subtext={
            funnelData && funnelData.totalConversions > 0
              ? `${funnelData.conversionToCommissionRate.toFixed(1)}% confirmation rate`
              : undefined
          }
        />
      </FadeIn>

      {/* Funnel Visualization */}
      <ConversionFunnel
        totalClicks={funnelData?.totalClicks ?? 0}
        totalConversions={funnelData?.totalConversions ?? 0}
        totalCommissions={funnelData?.totalCommissions ?? 0}
        clickToConversionRate={funnelData?.clickToConversionRate ?? 0}
        conversionToCommissionRate={funnelData?.conversionToCommissionRate ?? 0}
        overallRate={funnelData?.overallRate ?? 0}
        isLoading={isLoading}
      />

      {/* By-Campaign Cards */}
      {funnelData && funnelData.byCampaign.length > 0 && (
        <CampaignFunnelCards
          byCampaign={funnelData.byCampaign}
          canViewSensitiveData={canViewSensitiveData}
        />
      )}

      {/* Per-Affiliate Table */}
      <FunnelAffiliateTable
        data={funnelData?.topAffiliates ?? []}
        canViewSensitiveData={canViewSensitiveData}
        isLoading={isLoading}
      />
    </div>
  );
}

// ── Page (Suspense wrapper) ─────────────────────────────────────
export default function FunnelPage() {
  return (
    <Suspense fallback={<FunnelPageSkeleton />}>
      <FunnelPageContent />
    </Suspense>
  );
}
