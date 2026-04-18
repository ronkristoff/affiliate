"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageTopbar } from "@/components/ui/PageTopbar";
import {
  RevenueDashboard,
  RevenueDashboardSkeleton,
} from "./_components/RevenueDashboard";
import { usePlatformStats } from "@/hooks/usePlatformStats";

function RevenueContent() {
  const metrics = useQuery(api.admin.subscriptions.getPlatformRevenueMetrics, {});
  const recentActivity = useQuery(
    api.admin.subscriptions.getRecentSubscriptionActivity,
    {}
  );
  const platformStats = usePlatformStats();

  const isLoading = metrics === undefined;

  const affiliateMetrics = platformStats
    ? {
        totalCommissions: platformStats.totalCommissions,
        totalPaidOut: platformStats.totalPaidOut,
        pendingCommissions: platformStats.totalPendingCommissions,
        totalConversions: platformStats.totalConversions,
      }
    : null;

  return (
    <RevenueDashboard
      metrics={metrics}
      isLoading={isLoading}
      recentActivity={recentActivity}
      affiliateMetrics={affiliateMetrics}
    />
  );
}

// ---------------------------------------------------------------------------
// Page export (Suspense wrapper)
// ---------------------------------------------------------------------------

export default function RevenuePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar description="Platform revenue metrics and subscription activity">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Revenue Dashboard
        </h1>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <Suspense fallback={<RevenueDashboardSkeleton />}>
          <RevenueContent />
        </Suspense>
      </div>
    </div>
  );
}
