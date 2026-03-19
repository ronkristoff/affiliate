"use client";

import { useState, Suspense } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn, downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Users, Loader2 } from "lucide-react";
import { DateRangeSelector } from "@/app/(auth)/dashboard/components/DateRangeSelector";
import { CampaignFilterDropdown } from "@/app/(auth)/reports/campaigns/components/CampaignFilterDropdown";
import {
  AffiliateMetricsSummary,
  AffiliatePerformanceTable,
  AffiliateDetailView,
} from "./components";
import { toast } from "sonner";
import { useDateRange, getQueryDateRange } from "@/hooks/useDateRange";
import { useQueryState, parseAsString } from "nuqs";

export default function AffiliatePerformancePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AffiliatePerformancePage />
    </Suspense>
  );
}

function AffiliatePerformancePage() {
  // URL state via nuqs for campaign filter
  const [selectedCampaignId, setSelectedCampaignId] = useQueryState(
    "campaign",
    parseAsString.withDefault("")
  );
  
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<Id<"affiliates"> | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Use shared date range hook for global consistency
  const { dateRange, setDateRange } = useDateRange();
  const queryDateRange = getQueryDateRange(dateRange);

  // Get current user for RBAC
  const user = useQuery(api.auth.getCurrentUser, {});
  
  // Export action
  const exportCSV = useAction(api.reports.exportAffiliatePerformanceCSV);
  
  // Get tenant ID from user
  const tenantId = user?.tenantId;
  
  // RBAC check
  const userRole = user?.role;
  const canViewSensitiveData = userRole === "owner" || userRole === "manager";
  const canExport = userRole === "owner" || userRole === "manager";
  const isViewer = userRole === "viewer";

  // Handle date range change
  const handleDateRangeChange = (range: { start: number; end: number; label: string; isCustom: boolean; preset?: string }) => {
    setDateRange({
      start: range.start,
      end: range.end,
      label: range.label,
      isCustom: range.isCustom,
      preset: range.preset,
    });
  };

  // Handle campaign filter change — nuqs handles URL sync automatically
  const handleCampaignChange = (campaignId?: string) => {
    setSelectedCampaignId(campaignId || null);
  };

  // Handle affiliate selection
  const handleAffiliateSelect = (affiliateId: Id<"affiliates">) => {
    setSelectedAffiliateId(affiliateId);
  };

  // Handle export using Convex mutation
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
      downloadCsv(base64Data, "affiliate-performance");

      toast.success("Affiliate performance data has been downloaded.");
    } catch (error) {
      toast.error("Failed to export affiliate performance data.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Performance</h1>
          <p className="text-sm text-gray-500 mt-1">
            View and analyze affiliate performance metrics
          </p>
          {/* Date range indicator */}
          {dateRange && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing data for: <span className="font-medium text-foreground">{dateRange.label}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isViewer && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              Read-only view
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!canExport || isExporting}
            className={cn(!canExport && "opacity-50 cursor-not-allowed")}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DateRangeSelector onChange={handleDateRangeChange} />
        <CampaignFilterDropdown
          selectedCampaignId={selectedCampaignId}
          onCampaignSelect={handleCampaignChange}
        />
      </div>

      {/* Summary Metrics */}
      <AffiliateMetricsSummary
        tenantId={tenantId}
        dateRange={queryDateRange}
        campaignId={selectedCampaignId as Id<"campaigns"> | undefined}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Affiliate List */}
        <div className={cn("lg:col-span-3", selectedAffiliateId && "lg:col-span-2")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Affiliate Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AffiliatePerformanceTable
                tenantId={tenantId}
                dateRange={queryDateRange}
                campaignId={selectedCampaignId as Id<"campaigns"> | undefined}
                onAffiliateSelect={handleAffiliateSelect}
                canViewSensitiveData={canViewSensitiveData}
              />
            </CardContent>
          </Card>
        </div>

        {/* Affiliate Detail */}
        {selectedAffiliateId && (
          <div className="lg:col-span-1">
            <AffiliateDetailView
              affiliateId={selectedAffiliateId}
              dateRange={queryDateRange}
              onClose={() => setSelectedAffiliateId(null)}
              canViewSensitiveData={canViewSensitiveData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
