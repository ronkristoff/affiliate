"use client";

import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";

interface CampaignMetricsSummaryProps {
  metrics?: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalClicks: number;
    totalConversions: number;
    totalCommissions: number;
    avgConversionRate: number;
    previousTotalCampaigns: number;
    previousActiveCampaigns: number;
    previousTotalClicks: number;
    previousTotalConversions: number;
    previousTotalCommissions: number;
  };
  isLoading?: boolean;
  canViewSensitiveData?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateDelta(current: number, previous: number): { value: number; isPositive: boolean } | undefined {
  if (previous === 0) return undefined;
  const delta = Math.round(((current - previous) / previous) * 100);
  return { value: Math.abs(delta), isPositive: delta >= 0 };
}

export function CampaignMetricsSummary({
  metrics,
  isLoading = false,
  canViewSensitiveData = true,
}: CampaignMetricsSummaryProps) {
  const campaignsDelta = metrics
    ? calculateDelta(metrics.totalCampaigns, metrics.previousTotalCampaigns)
    : undefined;
  const clicksDelta = metrics
    ? calculateDelta(metrics.totalClicks, metrics.previousTotalClicks)
    : undefined;
  const conversionsDelta = metrics
    ? calculateDelta(metrics.totalConversions, metrics.previousTotalConversions)
    : undefined;
  const commissionsDelta = metrics
    ? calculateDelta(metrics.totalCommissions, metrics.previousTotalCommissions)
    : undefined;

  return (
    <FadeIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Campaigns"
        numericValue={metrics?.totalCampaigns ?? 0}
        subtext={`${metrics?.activeCampaigns ?? 0} active`}
        delta={campaignsDelta}
        variant="blue"
        isLoading={isLoading}
      />
      <MetricCard
        label="Total Clicks"
        numericValue={metrics?.totalClicks ?? 0}
        delta={clicksDelta}
        variant="green"
        isLoading={isLoading}
      />
      <MetricCard
        label="Total Conversions"
        numericValue={metrics?.totalConversions ?? 0}
        subtext={`${metrics?.avgConversionRate ?? 0}% conversion rate`}
        delta={conversionsDelta}
        variant="yellow"
        isLoading={isLoading}
      />
      <MetricCard
        label="Total Commissions"
        numericValue={canViewSensitiveData && metrics ? metrics.totalCommissions : 0}
        formatValue={formatCurrency}
        delta={canViewSensitiveData ? commissionsDelta : undefined}
        variant="gray"
        isLoading={isLoading}
      />
    </FadeIn>
  );
}
