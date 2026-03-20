"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorBoundary } from "@/components/ui/QueryErrorBoundary";
import { Users, Zap, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCallback } from "react";

function StatsBarSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-white border border-[#e5e7eb] rounded-xl p-5"
        >
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CampaignStatsBar() {
  const cardStats = useQuery(api.campaigns.getCampaignCardStats);

  const handleRetry = useCallback(() => {
    // Convex useQuery is reactive — re-render triggers refetch
  }, []);

  if (cardStats === undefined) {
    return <StatsBarSkeleton />;
  }

  // Aggregate stats across all campaigns
  const campaignEntries = Object.values(cardStats);
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

  const stats = [
    {
      label: "Campaign Affiliates",
      value: campaignAffiliates.toLocaleString(),
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-[#10409a]",
    },
    {
      label: "Total Conversions",
      value: totalConversions.toLocaleString(),
      icon: Zap,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: "Total Commissions",
      value: `₱${totalCommissions.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: DollarSign,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];

  return (
    <QueryErrorBoundary
      onError={() => toast.error("Failed to load campaign stats")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white border border-[#e5e7eb] rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-semibold text-[#6b7280] uppercase tracking-[0.04em]">
              {stat.label}
            </p>
            <div
              className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}
            >
              <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            </div>
          </div>
          <p className="text-[28px] font-bold text-[#1a1a1a] tabular-nums tracking-tight">
            {stat.value}
          </p>
        </div>
      ))}
      </div>
    </QueryErrorBoundary>
  );
}
