"use client";

import React, { Suspense, useState } from "react";
import { useQuery } from "convex/react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodSelector, useReportPeriod } from "./components/PeriodSelector";
import { SummaryCards } from "./components/SummaryCards";
import { EarningsTrendChart } from "./components/EarningsTrendChart";
import { TopLinksRanking } from "./components/TopLinksRanking";
import { ConversionFunnel } from "./components/ConversionFunnel";
import { ReportsEmptyState } from "./components/ReportsEmptyState";

function SectionErrorBoundary({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  if (hasError) return <>{fallback}</>;
  return (
    <ErrorBoundary onError={() => setHasError(true)}>
      {children}
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Something went wrong loading this section.
        </div>
      );
    }
    return this.props.children;
  }
}

function ReportsPageContent() {
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  const { startDate, endDate, previousPeriodDates } = useReportPeriod();
  const [compare, setCompare] = useQueryState("compare", parseAsBoolean.withDefault(false));

  const earningsChartData = useQuery(
    api.affiliatePortalReports.getEarningsChartData,
    affiliate ? { affiliateId: affiliate._id, startDate, endDate } : "skip",
  );

  const clicksTrendData = useQuery(
    api.affiliatePortalReports.getClicksTrendData,
    affiliate ? { affiliateId: affiliate._id, startDate, endDate } : "skip",
  );

  const funnelData = useQuery(
    api.affiliatePortalReports.getConversionFunnelData,
    affiliate ? { affiliateId: affiliate._id, startDate, endDate } : "skip",
  );

  const topLinks = useQuery(
    api.affiliatePortalReports.getTopLinks,
    affiliate ? { affiliateId: affiliate._id, startDate, endDate } : "skip",
  );

  const prevEarningsChartData = useQuery(
    api.affiliatePortalReports.getEarningsChartData,
    compare && affiliate
      ? { affiliateId: affiliate._id, startDate: previousPeriodDates.startDate, endDate: previousPeriodDates.endDate }
      : "skip",
  );

  const prevClicksTrendData = useQuery(
    api.affiliatePortalReports.getClicksTrendData,
    compare && affiliate
      ? { affiliateId: affiliate._id, startDate: previousPeriodDates.startDate, endDate: previousPeriodDates.endDate }
      : "skip",
  );

  const prevFunnelData = useQuery(
    api.affiliatePortalReports.getConversionFunnelData,
    compare && affiliate
      ? { affiliateId: affiliate._id, startDate: previousPeriodDates.startDate, endDate: previousPeriodDates.endDate }
      : "skip",
  );

  if (!isAuthenticated || affiliate === undefined) {
    return null;
  }

  const isLoading =
    earningsChartData === undefined ||
    clicksTrendData === undefined ||
    funnelData === undefined;

  const totalEarnings = (earningsChartData ?? []).reduce<number>((s, d) => s + d.amount, 0);
  const totalClicks = (clicksTrendData ?? []).reduce<number>((s, d) => s + d.count, 0);
  const totalConversions = funnelData?.conversions ?? 0;

  const isEmpty = !isLoading && totalEarnings === 0 && totalClicks === 0 && totalConversions === 0;

  if (isEmpty) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PeriodSelector />
        <ReportsEmptyState />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PeriodSelector />
        <Button
          variant={compare ? "default" : "outline"}
          size="sm"
          onClick={() => setCompare(!compare)}
          className={cn(
            "shrink-0 gap-1.5",
            compare && "bg-[var(--portal-primary)] hover:bg-[var(--portal-primary)]/90 text-white",
          )}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Compare
        </Button>
      </div>

      <SectionErrorBoundary fallback={<Skeleton className="h-28 rounded-xl" />}>
        <SummaryCards
          earningsData={earningsChartData}
          clicksData={clicksTrendData}
          funnelData={funnelData}
          prevEarningsData={prevEarningsChartData}
          prevClicksData={prevClicksTrendData}
          prevFunnelData={prevFunnelData}
          compare={compare}
          isLoading={isLoading}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={<Skeleton className="h-72 rounded-xl" />}>
        <EarningsTrendChart
          data={earningsChartData}
          prevData={prevEarningsChartData}
          compare={compare}
          isLoading={isLoading}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={<Skeleton className="h-64 rounded-xl" />}>
        <TopLinksRanking links={topLinks} isLoading={topLinks === undefined} />
      </SectionErrorBoundary>

      <SectionErrorBoundary fallback={<Skeleton className="h-52 rounded-xl" />}>
        <ConversionFunnel data={funnelData} isLoading={funnelData === undefined} />
      </SectionErrorBoundary>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-52 rounded-xl" />
    </div>
  );
}

export default function PortalReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsPageContent />
    </Suspense>
  );
}
