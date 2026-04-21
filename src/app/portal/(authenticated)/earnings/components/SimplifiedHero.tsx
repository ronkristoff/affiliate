"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface SimplifiedHeroProps {
  affiliateId: string;
}

export function SimplifiedHero({ affiliateId }: SimplifiedHeroProps) {
  const earningsSummary = useQuery(api.affiliateAuth.getAffiliateEarningsSummary, {
    affiliateId: affiliateId as Id<"affiliates">,
  });

  if (earningsSummary === undefined) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--portal-primary)]/10 border border-[var(--portal-primary)]/20">
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-36" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-[var(--portal-primary)]/[0.07] border border-[var(--portal-primary)]/15">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
          <p className="text-3xl font-black text-[var(--portal-primary)]">
            {formatCurrency(earningsSummary.confirmedBalance)}
          </p>
          {earningsSummary.confirmedCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {earningsSummary.confirmedCount} confirmed commission{earningsSummary.confirmedCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-1">Pending</p>
          <p className="text-xl font-semibold">
            {formatCurrency(earningsSummary.pendingBalance)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5" title="Commissions under review — typically takes 14-30 days">
            Under review
          </p>
          {earningsSummary.pendingCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {earningsSummary.pendingCount} pending
            </p>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-1">Paid Out</p>
          <p className="text-xl font-semibold">
            {formatCurrency(earningsSummary.paidOut)}
          </p>
          {earningsSummary.paidOutCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {earningsSummary.paidOutCount} payout{earningsSummary.paidOutCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
