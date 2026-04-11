"use client";

import { useMemo } from "react";
import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

interface EarningsTrendChartProps {
  data: Array<{ date: string; amount: number; count: number }> | undefined;
  prevData: Array<{ date: string; amount: number; count: number }> | undefined;
  compare: boolean;
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="font-semibold text-gray-900">
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export const EarningsTrendChart = React.memo(function EarningsTrendChart({
  data,
  prevData,
  compare,
  isLoading,
}: EarningsTrendChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];

    if (!compare || !prevData) {
      return data.map((d) => {
        const date = new Date(d.date);
        return {
          label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          current: d.amount,
          previous: 0,
        };
      });
    }

    const currentMap = new Map(data.map((d) => [d.date, d.amount]));
    const prevMap = new Map(prevData.map((d) => [d.date, d.amount]));
    const allDates = Array.from(new Set([...data.map((d) => d.date), ...prevData.map((d) => d.date)])).sort();

    return allDates.map((date) => {
      const d = new Date(date);
      return {
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        current: currentMap.get(date) ?? 0,
        previous: prevMap.get(date) ?? 0,
      };
    });
  }, [data, prevData, compare]);

  const hasData = chartData.some((d) => d.current > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Earnings Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--portal-primary, #1c2260)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--portal-primary, #1c2260)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={70}
                tickFormatter={(val: number) => `₱${(val / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {compare && (
                <Area
                  type="monotone"
                  dataKey="previous"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  fill="none"
                  name="Previous"
                />
              )}
              <Area
                type="monotone"
                dataKey="current"
                stroke="var(--portal-primary, #1c2260)"
                strokeWidth={2}
                fill="url(#earningsGradient)"
                name="Current"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-sm text-muted-foreground">No earnings data for this period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
