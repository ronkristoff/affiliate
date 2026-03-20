"use client";

import { useState, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { DateRangeSelector } from "@/app/(auth)/dashboard/components";
import {
  CampaignMetricsSummary,
  CampaignPerformanceTable,
  CampaignDetailView,
  CampaignFilterDropdown,
} from "./components";
import { Download, FileSpreadsheet, Eye } from "lucide-react";
import { toast } from "sonner";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import { downloadCsv } from "@/lib/utils";

export default function CampaignReportsPage() {
  // Use shared date range hook for global consistency
  const { dateRange, setDateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>();
  const [showDetail, setShowDetail] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sortField, setSortField] = useState<"name" | "clicks" | "conversions" | "conversionRate" | "commissions" | "activeAffiliates">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Get current user to determine tenant and role
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  // RBAC: Determine if user can view sensitive data
  const userRole = user?.role;
  const canViewSensitiveData = userRole === "owner" || userRole === "manager";

  // Fetch summary metrics
  const summaryMetrics = useQuery(
    api.reports.getCampaignSummaryMetrics,
    tenantId ? { tenantId, dateRange: queryDateRange } : "skip"
  );

  // Fetch campaign performance list with optional campaign filter and sorting
  const campaignPerformance = useQuery(
    api.reports.getCampaignPerformanceList,
    tenantId ? { 
      tenantId, 
      dateRange: queryDateRange,
      campaignId: selectedCampaignId as Id<"campaigns"> | undefined,
      sortBy: sortField === "activeAffiliates" ? "name" : sortField,
      sortOrder
    } : "skip"
  );

  // Fetch campaign details when a campaign is selected
  const campaignDetails = useQuery(
    api.reports.getCampaignPerformanceDetails,
    selectedCampaignId && tenantId
      ? { campaignId: selectedCampaignId as Id<"campaigns">, dateRange: queryDateRange }
      : "skip"
  );

  // Export CSV action
  const exportCSV = useAction(api.reportsExport.exportCampaignPerformanceCSV);

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

  // Handle campaign click
  const handleCampaignClick = useCallback((campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setShowDetail(true);
  }, []);

  // Handle sort changes
  const handleSort = useCallback((field: "name" | "clicks" | "conversions" | "conversionRate" | "commissions" | "activeAffiliates") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }, [sortField, sortOrder]);

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
      downloadCsv(base64Data, "campaign-performance");

      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = !summaryMetrics || !campaignPerformance;

  return (
    <div className="space-y-6">
      {/* Read-only indicator for viewers */}
      {!canViewSensitiveData && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Eye className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            Read-only mode: Sensitive data hidden. Contact your administrator for full access.
          </span>
        </div>
      )}

      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaign Performance</h1>
          <p className="text-muted-foreground">Track and analyze your campaign metrics</p>
          {/* Date range indicator */}
          {dateRange && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing data for: <span className="font-medium text-foreground">{dateRange.label}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CampaignFilterDropdown
            selectedCampaignId={selectedCampaignId}
            onCampaignSelect={setSelectedCampaignId}
          />
          <DateRangeSelector onChange={handleDateRangeChange} />
          {canViewSensitiveData && (
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 animate-pulse" />
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

      {/* Summary Metrics */}
      <CampaignMetricsSummary
        metrics={summaryMetrics}
        isLoading={isLoading}
        canViewSensitiveData={canViewSensitiveData}
      />

      {/* Campaign Performance Table */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Campaigns</h2>
        <CampaignPerformanceTable
          campaigns={campaignPerformance ?? []}
          isLoading={isLoading}
          onCampaignClick={handleCampaignClick}
          canViewSensitiveData={canViewSensitiveData}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      {/* Campaign Detail Modal */}
      {showDetail && selectedCampaignId && (
        <CampaignDetailView
          data={campaignDetails}
          isLoading={!campaignDetails}
          onClose={() => {
            setShowDetail(false);
            setSelectedCampaignId(undefined);
          }}
          canViewSensitiveData={canViewSensitiveData}
        />
      )}
    </div>
  );
}
