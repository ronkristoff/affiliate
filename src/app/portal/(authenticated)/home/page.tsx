"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroMetrics } from "./components/HeroMetrics";
import { ReferralLinkBar } from "./components/ReferralLinkBar";
import { QuickActions } from "./components/QuickActions";
import { PendingApprovalState } from "./components/PendingApprovalState";
import { RecentActivityFeed } from "./components/RecentActivityFeed";

function HomePageContent() {
  const [queryErrors, setQueryErrors] = useState<Record<string, string>>({});

  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  const dashboardStats = useQuery(
    api.affiliateAuth.getAffiliatePortalDashboardStats,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  const earningsSummary = useQuery(
    api.affiliateAuth.getAffiliateEarningsSummary,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  const recentActivity = useQuery(
    api.affiliateAuth.getAffiliateRecentActivity,
    affiliate ? { affiliateId: affiliate._id, limit: 5 } : "skip"
  );

  const affiliateLinks = useQuery(
    api.referralLinks.getAffiliatePortalLinks,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  useEffect(() => {
    const errors: Record<string, string> = {};

    if (dashboardStats === null && isAuthenticated) {
      errors.dashboardStats = "Failed to load dashboard statistics";
    }
    if (recentActivity === null && isAuthenticated) {
      errors.recentActivity = "Failed to load recent activity";
    }
    if (affiliateLinks === null && isAuthenticated) {
      errors.affiliateLinks = "Failed to load referral links";
    }

    setQueryErrors(errors);
  }, [dashboardStats, recentActivity, affiliateLinks, isAuthenticated]);

  if (!isAuthenticated || affiliate === undefined) {
    return null;
  }

  const primaryLink = affiliateLinks?.[0]?.shortUrl;
  const isDashboardLoading = dashboardStats === undefined;
  const isActivityLoading = recentActivity === undefined;
  const hasCriticalError = Object.keys(queryErrors).length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {hasCriticalError && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-800 flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5" />
              Some data failed to load
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-red-700 space-y-1">
              {Object.entries(queryErrors).map(([key, message]) => (
                <li key={key}>• {message}</li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {affiliate.status === "pending" && (
        <PendingApprovalState email={affiliate.email} />
      )}

      {affiliate.status !== "pending" && !isDashboardLoading && (
        <HeroMetrics
          affiliateName={affiliate.name}
          availableEarnings={earningsSummary?.confirmedBalance ?? 0}
          totalEarnings={dashboardStats?.totalEarnings ?? 0}
          pendingEarnings={dashboardStats?.pendingEarnings ?? 0}
          totalConversions={dashboardStats?.totalConversions ?? 0}
          totalClicks={dashboardStats?.totalClicks ?? 0}
        />
      )}

      {affiliate.status !== "pending" && isDashboardLoading && (
        <Skeleton className="h-56 w-full rounded-xl" />
      )}

      <ReferralLinkBar
        referralLink={primaryLink}
        affiliateId={affiliate._id}
      />

      {!isDashboardLoading && (
        <QuickActions
          referralLink={primaryLink}
          availableEarnings={earningsSummary?.confirmedBalance ?? 0}
        />
      )}

      <RecentActivityFeed
        activities={recentActivity || []}
        isLoading={isActivityLoading}
        affiliateStatus={affiliate.status}
      />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36 rounded" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PortalHomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
