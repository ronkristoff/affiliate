"use client";

import { Clock, Users, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";

interface PendingActionsProps {
  pendingPromoters?: number;
  pendingCommissions?: number;
  pendingReferrals?: number;
  isLoading?: boolean;
}

export function PendingActions({ 
  pendingPromoters = 0, 
  pendingCommissions = 0, 
  pendingReferrals = 0, 
  isLoading 
}: PendingActionsProps) {
  return (
    <div className="mt-4">
      <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
        Pending actions
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Promoters"
          numericValue={pendingPromoters}
          variant="yellow"
          icon={<Users className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          label="Commissions"
          numericValue={pendingCommissions}
          variant="yellow"
          icon={<DollarSign className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          label="Referrals"
          numericValue={pendingReferrals}
          variant="yellow"
          icon={<Clock className="w-4 h-4" />}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
