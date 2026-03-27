"use client";

import { DollarSign, Users, UserPlus, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatCurrency } from "@/lib/format";

interface SummaryCardsProps {
  stats?: {
    revenue?: number;
    referrals?: number;
    payingCustomers?: number;
    promoters?: number;
  };
  isLoading?: boolean;
}

export function SummaryCards({ stats, isLoading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <MetricCard
        label="Revenue generated"
        numericValue={stats?.revenue ?? 0}
        formatValue={formatCurrency}
        variant="blue"
        icon={<DollarSign className="w-5 h-5" />}
        isLoading={isLoading}
      />
      <MetricCard
        label="Referrals"
        numericValue={stats?.referrals ?? 0}
        variant="green"
        icon={<Users className="w-5 h-5" />}
        isLoading={isLoading}
      />
      <MetricCard
        label="Paying customers"
        numericValue={stats?.payingCustomers ?? 0}
        variant="blue"
        icon={<TrendingUp className="w-5 h-5" />}
        isLoading={isLoading}
      />
      <MetricCard
        label="Promoters"
        numericValue={stats?.promoters ?? 0}
        variant="gray"
        icon={<UserPlus className="w-5 h-5" />}
        isLoading={isLoading}
      />
    </div>
  );
}
