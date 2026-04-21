"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PayoutBanner } from "./components/PayoutBanner";
import { SimplifiedHero } from "./components/SimplifiedHero";
import { PayoutMethodInfo } from "./components/PayoutMethodInfo";
import { FilterChips } from "./components/FilterChips";
import { UnifiedFeed } from "./components/UnifiedFeed";
import { useQueryState } from "nuqs";
import { parseAsString } from "nuqs";

function EarningsPageContent() {
  const [selectedPeriod, setSelectedPeriod] = useQueryState(
    "period",
    parseAsString.withDefault("all")
  );
  const [selectedStatus, setSelectedStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all")
  );

  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  const earningsSummary = useQuery(
    api.affiliateAuth.getAffiliateEarningsSummary,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  const tenantPayoutSchedule = useQuery(
    api.tenants.getTenantPayoutSchedule,
    affiliate?.tenantId ? { tenantId: affiliate.tenantId } : "skip"
  );

  if (!isAuthenticated || affiliate === undefined) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PayoutBanner
        confirmedBalance={earningsSummary?.confirmedBalance || 0}
        nextPayoutDate={tenantPayoutSchedule?.nextPayoutDate}
        isLoading={earningsSummary === undefined}
      />

      <SimplifiedHero
        affiliateId={affiliate._id}
      />

      <PayoutMethodInfo
        payoutMethod={affiliate.payoutMethod}
        payoutMethodLastDigits={affiliate.payoutMethodLastDigits}
      />

      <FilterChips
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />

      <UnifiedFeed
        affiliateId={affiliate._id}
        period={selectedPeriod}
        status={selectedStatus}
      />
    </div>
  );
}

function EarningsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="space-y-2">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function PortalEarningsPage() {
  return (
    <Suspense fallback={<EarningsSkeleton />}>
      <EarningsPageContent />
    </Suspense>
  );
}
