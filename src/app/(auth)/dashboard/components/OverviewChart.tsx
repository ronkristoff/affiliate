"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly";

interface OverviewChartProps {
  data?: {
    mrrSparkline: number[];
    clicksSparkline: number[];
    conversionsSparkline: number[];
  };
  period?: Period;
  dateRange?: { start: number; end: number };
  periodLabel?: string;
  isLoading?: boolean;
}

// ─── Label generation ──────────────────────────────────────────────────────

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Generate x-axis labels for each bucket based on the period and date range.
 * Bucket N covers [start + N * bucketMs, start + (N+1) * bucketMs).
 */
function generateBucketLabels(
  bucketCount: number,
  start: number,
  end: number,
  period: Period,
): string[] {
  const duration = end - start;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  let bucketMs: number;
  switch (period) {
    case "weekly":
      bucketMs = 7 * MS_PER_DAY;
      break;
    case "monthly":
      bucketMs = 30 * MS_PER_DAY;
      break;
    case "daily":
    default:
      bucketMs = MS_PER_DAY;
      break;
  }

  return Array.from({ length: bucketCount }, (_, i) => {
    const bucketStart = start + i * bucketMs;
    const date = new Date(bucketStart);

    switch (period) {
      case "monthly":
        // Show "Mar" for each monthly bucket
        return MONTH_LABELS[date.getMonth()];
      case "weekly":
        // Show "Mar 3" for each weekly bucket
        return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
      case "daily":
      default: {
        // For short ranges show "Mar 3", for longer ones show just "3"
        if (duration <= 14 * MS_PER_DAY) {
          return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`;
        }
        return `${date.getDate()}`;
      }
    }
  });
}

// ─── Component ─────────────────────────────────────────────────────────────

export function OverviewChart({ data, period = "daily", dateRange, periodLabel, isLoading }: OverviewChartProps) {
  const [activeTab, setActiveTab] = useState("mrr");

  // Source data per tab
  const sourceMap = useMemo(() => ({
    mrr: data?.mrrSparkline ?? [],
    conversions: data?.conversionsSparkline ?? [],
    clicks: data?.clicksSparkline ?? [],
  }), [data]);

  // Generate x-axis labels once (independent of active tab)
  const labels = useMemo(() => {
    if (!dateRange || !data) return [];
    const source = sourceMap.mrr;
    return generateBucketLabels(source.length, dateRange.start, dateRange.end, period);
  }, [dateRange, data, period, sourceMap]);

  // Chart data for active tab
  const chartData = useMemo(() => {
    const source = sourceMap[activeTab as keyof typeof sourceMap] ?? [];
    return source.map((value, index) => ({
      name: labels[index] ?? `${index + 1}`,
      value,
    }));
  }, [sourceMap, activeTab, labels]);

  const totalMrr = sourceMap.mrr.reduce((a, b) => a + b, 0);
  const totalClicks = sourceMap.clicks.reduce((a, b) => a + b, 0);
  const totalConversions = sourceMap.conversions.reduce((a, b) => a + b, 0);

  const tabs = useMemo(() => [
    { id: "mrr" as const, label: "MRR Influenced", value: formatCurrency(totalMrr) },
    { id: "conversions" as const, label: "Conversions", value: totalConversions },
    { id: "clicks" as const, label: "Clicks", value: totalClicks },
  ], [totalMrr, totalClicks, totalConversions]);

  // Determine how many x-axis ticks to show (avoid crowding)
  const tickInterval = useMemo(() => {
    const count = labels.length;
    if (count <= 7) return 0;
    if (count <= 12) return 1;
    return 2;
  }, [labels.length]);

  if (isLoading) {
    return (
      <Card className="border-[var(--border-light)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="p-10 flex items-center justify-center">
          <Skeleton className="h-[320px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border-light)] overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <CardTitle className="text-[15px] font-bold text-[var(--text-heading)]">Overview</CardTitle>
          <Info className="w-4 h-4 text-[var(--text-muted)] cursor-help" />
        </div>
        <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)] bg-[var(--bg-page)]/50 px-3 py-1.5 rounded-lg border border-[var(--border-light)]">
          {periodLabel ?? "This Month"}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col">
        <div className="h-[320px] w-full mt-4 px-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1c2260" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1c2260" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                interval={tickInterval}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                width={80}
                tickFormatter={(val) => activeTab === "mrr" ? formatCurrency(Number(val)) : String(val)}
              />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-md)" }}
                formatter={(value: any) => [activeTab === "mrr" ? formatCurrency(Number(value)) : value, tabs.find(t => t.id === activeTab)?.label]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1c2260"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorValue)"
                animationDuration={1000}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#1c2260" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex border-t border-[var(--border-light)] overflow-x-auto no-scrollbar bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-4 px-6 transition-all duration-200 border-r border-[var(--border-light)] last:border-r-0 min-w-[140px]",
                activeTab === tab.id
                  ? "bg-blue-50/30 border-b-2 border-b-[#1c2260]"
                  : "hover:bg-[var(--bg-page)]/30 border-b-2 border-b-transparent"
              )}
            >
              <span className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 px-2 py-0.5 rounded transition-colors",
                activeTab === tab.id ? "text-[#1c2260] bg-blue-50/50" : "text-[var(--text-muted)]")}>
                {tab.label}
              </span>
              <span className={cn("text-[20px] font-bold tabular-nums transition-colors",
                activeTab === tab.id ? "text-[var(--text-heading)]" : "text-[var(--text-muted)]/70")}>
                {isLoading ? "..." : tab.value}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
