"use client";

import { DollarSign, Users, Leaf, Wallet } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/format";

interface SummaryCardsProps {
  stats?: {
    // MRR influenced by affiliates
    mrr?: number;
    mrrDelta?: { value: number; isPositive: boolean; label: string };
    mrrSparkline?: number[];
    mrrSubtext?: string;
    // Active affiliate count
    affiliates?: number;
    affiliatesSubtext?: string;
    // Conversions without affiliate attribution
    organicSales?: number;
    organicSalesSubtext?: string;
    // Total paid to affiliates
    totalPaidOut?: number;
    totalPaidOutSubtext?: string;
  };
  isLoading?: boolean;
}

export function SummaryCards({ stats, isLoading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <MetricCard
        label="MRR Influenced"
        numericValue={stats?.mrr ?? 0}
        formatValue={formatCurrency}
        variant="blue"
        icon={<DollarSign className="w-5 h-5" />}
        delta={stats?.mrrDelta}
        sparklineData={stats?.mrrSparkline}
        subtext={stats?.mrrSubtext}
        isLoading={isLoading}
      />
      <MetricCard
        label="Affiliates"
        numericValue={stats?.affiliates ?? 0}
        variant="green"
        icon={<Users className="w-5 h-5" />}
        subtext={stats?.affiliatesSubtext}
        isLoading={isLoading}
      />
      <MetricCard
        label="Organic sales"
        numericValue={stats?.organicSales ?? 0}
        variant="yellow"
        icon={<Leaf className="w-5 h-5" />}
        subtext={stats?.organicSalesSubtext}
        isLoading={isLoading}
      />
      <MetricCard
        label="Total paid out"
        numericValue={stats?.totalPaidOut ?? 0}
        formatValue={formatCurrency}
        variant="gray"
        icon={<Wallet className="w-5 h-5" />}
        subtext={stats?.totalPaidOutSubtext}
        isLoading={isLoading}
      />
    </div>
  );
}
