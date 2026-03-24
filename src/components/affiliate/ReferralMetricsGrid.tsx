"use client";

import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { MousePointerClick, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";

interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalCommissions: number;
  pendingCommissions: number;
  confirmedCommissions: number;
}

interface ReferralMetricsGridProps {
  stats: AffiliateStats | undefined;
}

export function ReferralMetricsGrid({ stats }: ReferralMetricsGridProps) {
  const isLoading = stats === undefined;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  // Calculate conversion rate
  const conversionRate = stats && stats.totalClicks > 0 
    ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
    : "0.0";

  return (
    <FadeIn className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Total Clicks"
        numericValue={stats?.totalClicks ?? 0}
        variant="blue"
        isLoading={isLoading}
        icon={<MousePointerClick className="w-4 h-4" />}
      />
      <MetricCard
        label="Conversions"
        numericValue={stats?.totalConversions ?? 0}
        variant="green"
        isLoading={isLoading}
        icon={<ShoppingCart className="w-4 h-4" />}
      />
      <MetricCard
        label="Conversion Rate"
        value={`${conversionRate}%`}
        variant="blue"
        isLoading={isLoading}
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <MetricCard
        label="Total Commissions"
        numericValue={stats?.totalCommissions ?? 0}
        formatValue={formatCurrency}
        variant="yellow"
        isLoading={isLoading}
        icon={<DollarSign className="w-4 h-4" />}
      />
    </FadeIn>
  );
}
