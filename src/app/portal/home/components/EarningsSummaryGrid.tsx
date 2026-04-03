"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface EarningsSummaryGridProps {
  thisMonthEarnings: number;
  thisMonthClicks: number;
  thisMonthConversions: number;
  pendingEarnings: number;
  conversionRate: number;
  earningsChangePercent: number;
  primaryColor?: string;
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-16" />
      </CardHeader>
      <CardContent className="flex-1 flex items-end">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-24" />
      </CardContent>
    </Card>
  );
}

function SkeletonFeaturedCard() {
  return (
    <Card className="col-span-2 md:col-span-2">
      <CardHeader className="pb-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse w-24 mb-2" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-32" />
      </CardHeader>
      <CardContent>
        <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
      </CardContent>
    </Card>
  );
}

export function EarningsSummaryGrid({
  thisMonthEarnings,
  thisMonthClicks,
  thisMonthConversions,
  pendingEarnings,
  conversionRate,
  earningsChangePercent,
  primaryColor = "#1c2260",
  isLoading = false,
}: EarningsSummaryGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-16" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SkeletonFeaturedCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          This Month
        </h3>
        <Link
          href="/portal/earnings"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View all
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Featured Card: Total Earnings */}
        <Card
          className={cn(
            "col-span-2 md:col-span-1 bg-gradient-to-br from-gray-50 to-gray-100 border-2",
            "md:col-span-2"
          )}
          style={{ borderColor: primaryColor }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Total Earnings
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              {earningsChangePercent !== 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                    earningsChangePercent >= 0
                      ? "text-green-700 bg-green-100"
                      : "text-red-700 bg-red-100"
                  )}
                >
                  {earningsChangePercent >= 0 ? (
                    <ArrowUp className="w-2.5 h-2.5" />
                  ) : (
                    <ArrowDown className="w-2.5 h-2.5" />
                  )}
                  {formatPercent(earningsChangePercent)} vs last month
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold text-gray-900">
              {formatCurrency(thisMonthEarnings)}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Clicks */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Clicks
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {thisMonthClicks.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">This month</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: New Referrals */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              New Referrals
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {thisMonthConversions.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Active subscribers</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Pending */}
        <Card className="flex flex-col border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div>
              <p className="text-xl font-bold text-amber-800">
                {formatCurrency(pendingEarnings)}
              </p>
              <p className="text-xs text-amber-600">Awaiting confirmation</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Conversion Rate */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div>
              <p className="text-xl font-bold text-gray-900">
                {conversionRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Clicks → trials</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}