"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

interface SimplifiedHeroProps {
  affiliateId: string;
  hasPayoutMethod: boolean;
}

export function SimplifiedHero({ affiliateId, hasPayoutMethod }: SimplifiedHeroProps) {
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

  const handleWithdraw = () => {
    if (!hasPayoutMethod) {
      toast("Set up your payout method first to withdraw earnings.");
      window.location.href = "/portal/account#payout";
      return;
    }
    toast("Withdrawal initiated");
  };

  return (
    <div className="p-6 rounded-2xl bg-[var(--portal-primary)]/[0.07] border border-[var(--portal-primary)]/15">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-1">Available to Withdraw</p>
          <p className="text-3xl font-black text-[var(--portal-primary)]">
            {formatCurrency(earningsSummary.confirmedBalance)}
          </p>
          {earningsSummary.confirmedBalance > 0 && (
            <Button
              size="sm"
              className="mt-3 rounded-full"
              onClick={handleWithdraw}
            >
              <Wallet className="h-4 w-4 mr-1.5" />
              Withdraw
            </Button>
          )}
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
