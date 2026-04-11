"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Minus, DollarSign, MousePointerClick, UserPlus, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumberCompact } from "@/lib/format";

interface SummaryCardsProps {
  earningsData: Array<{ amount: number }> | undefined;
  clicksData: Array<{ count: number }> | undefined;
  funnelData: { clicks: number; conversions: number } | undefined;
  prevEarningsData: Array<{ amount: number }> | undefined;
  prevClicksData: Array<{ count: number }> | undefined;
  prevFunnelData: { clicks: number; conversions: number } | undefined;
  compare: boolean;
  isLoading: boolean;
}

interface MetricConfig {
  label: string;
  value: string;
  icon: React.ReactNode;
  changePercent: number;
  tip: string;
}

function computeChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function TrendIndicator({ percent }: { percent: number }) {
  if (Math.abs(percent) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  }
  const isUp = percent > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        isUp ? "text-green-700" : "text-red-700",
      )}
    >
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {isUp ? "+" : ""}
      {percent.toFixed(1)}%
    </span>
  );
}

function getInsightTip(label: string, changePercent: number, current: number): string {
  if (current === 0) return "No activity yet. Share your link to get started!";
  if (label === "Earnings" && changePercent > 10) return "Great momentum! Keep sharing to maintain growth.";
  if (label === "Earnings" && changePercent < -10) return "Earnings dipped. Try sharing on different channels.";
  if (label === "Clicks" && changePercent > 20) return "Traffic is up! Your audience is engaging.";
  if (label === "Clicks" && changePercent < -10) return "Fewer clicks this period. Consider refreshing your promo copy.";
  if (label === "Conversions" && changePercent > 10) return "More sign-ups! Your referrals are converting well.";
  if (label === "Conversions" && changePercent < -10) return "Conversion dip detected. Personalize your messages.";
  if (label === "Conversion Rate" && changePercent > 5) return "Improved conversion rate — great audience targeting!";
  if (label === "Conversion Rate" && changePercent < -5) return "Rate decreased. Focus on quality over quantity.";
  return "";
}

export function SummaryCards({
  earningsData,
  clicksData,
  funnelData,
  prevEarningsData,
  prevClicksData,
  prevFunnelData,
  compare,
  isLoading,
}: SummaryCardsProps) {
  const metrics: MetricConfig[] = useMemo(() => {
    const totalEarnings = earningsData?.reduce((s, d) => s + d.amount, 0) ?? 0;
    const totalClicks = clicksData?.reduce((s, d) => s + d.count, 0) ?? 0;
    const totalConversions = funnelData?.conversions ?? 0;
    const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    const prevEarnings = compare
      ? (prevEarningsData?.reduce((s, d) => s + d.amount, 0) ?? 0)
      : 0;
    const prevClicks = compare
      ? (prevClicksData?.reduce((s, d) => s + d.count, 0) ?? 0)
      : 0;
    const prevConversions = compare ? (prevFunnelData?.conversions ?? 0) : 0;
    const prevConvRate = prevClicks > 0 ? (prevConversions / prevClicks) * 100 : 0;

    return [
      {
        label: "Earnings",
        value: formatCurrency(totalEarnings),
        icon: <DollarSign className="w-4 h-4" />,
        changePercent: compare ? computeChange(totalEarnings, prevEarnings) : 0,
        tip: getInsightTip("Earnings", compare ? computeChange(totalEarnings, prevEarnings) : 0, totalEarnings),
      },
      {
        label: "Clicks",
        value: formatNumberCompact(totalClicks),
        icon: <MousePointerClick className="w-4 h-4" />,
        changePercent: compare ? computeChange(totalClicks, prevClicks) : 0,
        tip: getInsightTip("Clicks", compare ? computeChange(totalClicks, prevClicks) : 0, totalClicks),
      },
      {
        label: "Conversions",
        value: formatNumberCompact(totalConversions),
        icon: <UserPlus className="w-4 h-4" />,
        changePercent: compare ? computeChange(totalConversions, prevConversions) : 0,
        tip: getInsightTip("Conversions", compare ? computeChange(totalConversions, prevConversions) : 0, totalConversions),
      },
      {
        label: "Conversion Rate",
        value: `${convRate.toFixed(1)}%`,
        icon: <Percent className="w-4 h-4" />,
        changePercent: compare ? computeChange(convRate, prevConvRate) : 0,
        tip: getInsightTip("Conversion Rate", compare ? computeChange(convRate, prevConvRate) : 0, convRate),
      },
    ];
  }, [earningsData, clicksData, funnelData, prevEarningsData, prevClicksData, prevFunnelData, compare]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <Card key={m.label} className="flex flex-col">
          <CardContent className="pt-6 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {m.label}
              </span>
              <span className="text-muted-foreground">{m.icon}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{m.value}</p>
            <div className="flex items-center justify-between">
              {compare ? (
                <TrendIndicator percent={m.changePercent} />
              ) : (
                <span />
              )}
            </div>
            {m.tip && (
              <p className="text-[11px] text-muted-foreground leading-tight mt-auto">{m.tip}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
