"use client";

import { DollarSign, Users, UserPlus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  isLoading?: boolean;
}

function SummaryCard({ label, value, icon, iconBg, isLoading }: SummaryCardProps) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-xl p-6 shadow-sm border border-[var(--border-light)] flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-muted)] mb-1 truncate">{label}</p>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-[28px] font-bold text-[var(--text-heading)] leading-none truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

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
      <SummaryCard
        label="Revenue generated"
        value={formatCurrency(stats?.revenue ?? 0)}
        icon={<DollarSign className="w-6 h-6 text-blue-600" />}
        iconBg="bg-blue-50"
        isLoading={isLoading}
      />
      <SummaryCard
        label="Referrals"
        value={stats?.referrals ?? 0}
        icon={<Users className="w-6 h-6 text-green-600" />}
        iconBg="bg-green-50"
        isLoading={isLoading}
      />
      <SummaryCard
        label="Paying customers"
        value={stats?.payingCustomers ?? 0}
        icon={<TrendingUp className="w-6 h-6 text-red-600" />}
        iconBg="bg-red-50"
        isLoading={isLoading}
      />
      <SummaryCard
        label="Promoters"
        value={stats?.promoters ?? 1}
        icon={<UserPlus className="w-6 h-6 text-gray-600" />}
        iconBg="bg-gray-50"
        isLoading={isLoading}
      />
    </div>
  );
}
