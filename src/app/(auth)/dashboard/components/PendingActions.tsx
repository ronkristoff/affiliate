"use client";

import { Clock, Users, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";

interface PendingActionsProps {
  pendingAffiliates?: number;
  pendingCommissions?: number;
  pendingPayouts?: number;
  isLoading?: boolean;
}

export function PendingActions({
  pendingAffiliates = 0,
  pendingCommissions = 0,
  pendingPayouts = 0,
  isLoading,
}: PendingActionsProps) {
  // Only show the section if there are actual pending items
  const hasPending = pendingAffiliates > 0 || pendingCommissions > 0 || pendingPayouts > 0;

  if (!isLoading && !hasPending) return null;

  return (
    <div className="mt-4">
      <h3 className="text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
        Pending actions
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Affiliates"
          numericValue={pendingAffiliates}
          variant="yellow"
          icon={<Users className="w-4 h-4" />}
          subtext="need approval"
          isLoading={isLoading}
        />
        <MetricCard
          label="Commissions"
          numericValue={pendingCommissions}
          variant="blue"
          icon={<DollarSign className="w-4 h-4" />}
          subtext="awaiting review"
          isLoading={isLoading}
        />
        <MetricCard
          label="Payouts"
          numericValue={pendingPayouts}
          variant="green"
          icon={<Clock className="w-4 h-4" />}
          subtext="ready to pay"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
