"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { QueryErrorBoundary } from "@/components/ui/QueryErrorBoundary";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Users, Zap, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCallback } from "react";

function formatPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CampaignStatsBar() {
  const cardStats = useQuery(api.campaigns.getCampaignCardStats);

  const handleRetry = useCallback(() => {
    // Convex useQuery is reactive — re-render triggers refetch
  }, []);

  // Aggregate stats across all campaigns
  const campaignEntries = cardStats ? Object.values(cardStats) : [];
  const campaignAffiliates = campaignEntries.reduce(
    (sum, c) => sum + c.affiliates,
    0
  );
  const totalConversions = campaignEntries.reduce(
    (sum, c) => sum + c.conversions,
    0
  );
  const totalCommissions = campaignEntries.reduce(
    (sum, c) => sum + c.paidOut,
    0
  );

  return (
    <QueryErrorBoundary
      onError={() => toast.error("Failed to load campaign stats")}
    >
      <FadeIn className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Campaign Affiliates"
          numericValue={campaignAffiliates}
          variant="blue"
          isLoading={!cardStats}
          icon={<Users className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Conversions"
          numericValue={totalConversions}
          variant="yellow"
          isLoading={!cardStats}
          icon={<Zap className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Commissions"
          numericValue={totalCommissions}
          formatValue={formatPeso}
          variant="green"
          isLoading={!cardStats}
          icon={<DollarSign className="w-4 h-4" />}
        />
      </FadeIn>
    </QueryErrorBoundary>
  );
}
