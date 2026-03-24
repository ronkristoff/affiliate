"use client";

import { MetricCard } from "@/components/ui/MetricCard";
import { Users, CreditCard, TrendingUp, Ban, AlertTriangle } from "lucide-react";

interface StatsRowProps {
  stats: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    flagged: number;
    deltaThisWeek: number;
  } | undefined;
  isLoading: boolean;
}

export function StatsRow({ stats, isLoading }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard
        label="Total Tenants"
        numericValue={stats?.total ?? 0}
        delta={
          stats && stats.deltaThisWeek > 0
            ? { value: stats.deltaThisWeek, isPositive: true, label: "this week" }
            : undefined
        }
        isLoading={isLoading}
        variant="blue"
        icon={<Users className="w-4 h-4" />}
      />
      <MetricCard
        label="Active"
        numericValue={stats?.active ?? 0}
        isLoading={isLoading}
        variant="green"
        icon={<CreditCard className="w-4 h-4" />}
      />
      <MetricCard
        label="On Trial"
        numericValue={stats?.trial ?? 0}
        isLoading={isLoading}
        variant="blue"
        icon={<TrendingUp className="w-4 h-4" />}
      />
      <MetricCard
        label="Suspended"
        numericValue={stats?.suspended ?? 0}
        isLoading={isLoading}
        variant="yellow"
        icon={<Ban className="w-4 h-4" />}
      />
      <MetricCard
        label="Flagged"
        numericValue={stats?.flagged ?? 0}
        isLoading={isLoading}
        variant="gray"
        icon={<AlertTriangle className="w-4 h-4" />}
      />
    </div>
  );
}
