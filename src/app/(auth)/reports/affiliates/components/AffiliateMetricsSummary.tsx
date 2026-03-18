"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MetricCard } from "@/app/(auth)/dashboard/components/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";

interface AffiliateMetricsSummaryProps {
  tenantId: Id<"tenants">;
  dateRange?: { start: number; end: number };
  campaignId?: Id<"campaigns">;
}

export function AffiliateMetricsSummary({
  tenantId,
  dateRange,
  campaignId,
}: AffiliateMetricsSummaryProps) {
  const metrics = useQuery(
    api.reports.getAffiliateSummaryMetrics,
    {
      tenantId,
      dateRange,
      campaignId,
    }
  );

  const isLoading = metrics === undefined;

  // Calculate deltas
  const clicksDelta = metrics && metrics.previousTotalClicks > 0
    ? {
        value: Math.round(((metrics.totalClicks - metrics.previousTotalClicks) / metrics.previousTotalClicks) * 100),
        isPositive: metrics.totalClicks >= metrics.previousTotalClicks,
      }
    : undefined;

  const commissionsDelta = metrics && metrics.previousTotalCommissions > 0
    ? {
        value: Math.round(((metrics.totalCommissions - metrics.previousTotalCommissions) / metrics.previousTotalCommissions) * 100),
        isPositive: metrics.totalCommissions >= metrics.previousTotalCommissions,
      }
    : undefined;

  const affiliatesDelta = metrics && metrics.previousTotalAffiliates > 0
    ? {
        value: Math.round(((metrics.totalAffiliates - metrics.previousTotalAffiliates) / metrics.previousTotalAffiliates) * 100),
        isPositive: metrics.totalAffiliates >= metrics.previousTotalAffiliates,
      }
    : undefined;

  const activeAffiliatesDelta = metrics && metrics.previousActiveAffiliates > 0
    ? {
        value: Math.round(((metrics.activeAffiliates - metrics.previousActiveAffiliates) / metrics.previousActiveAffiliates) * 100),
        isPositive: metrics.activeAffiliates >= metrics.previousActiveAffiliates,
      }
    : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Affiliates"
        value={metrics?.totalAffiliates ?? 0}
        delta={affiliatesDelta}
        variant="blue"
        isLoading={isLoading}
      />
      <MetricCard
        label="Active Affiliates"
        value={metrics?.activeAffiliates ?? 0}
        delta={activeAffiliatesDelta}
        variant="green"
        isLoading={isLoading}
      />
      <MetricCard
        label="Total Clicks"
        value={metrics?.totalClicks ?? 0}
        delta={clicksDelta}
        variant="yellow"
        isLoading={isLoading}
      />
      <MetricCard
        label="Total Commissions"
        value={metrics?.totalCommissions?.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) ?? "0.00"}
        prefix="₱"
        delta={commissionsDelta}
        variant="gray"
        isLoading={isLoading}
      />
    </div>
  );
}
