"use client";

import { MetricCard } from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/format";
import { TrendingUp } from "lucide-react";

interface CommissionsSummaryProps {
  totalEarned?: number;
  isLoading?: boolean;
}

export function CommissionsSummary({ totalEarned, isLoading }: CommissionsSummaryProps) {
  return (
    <MetricCard
      label="Commissions"
      numericValue={totalEarned ?? 0}
      formatValue={formatCurrency}
      variant="blue"
      icon={<TrendingUp className="w-5 h-5" />}
      subtext="Last 6 months"
      isLoading={isLoading}
    />
  );
}
