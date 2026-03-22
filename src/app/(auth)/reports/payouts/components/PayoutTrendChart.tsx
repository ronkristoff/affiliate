"use client";

import { AreaChart } from "@tremor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/affiliate-segments";

interface PayoutTrendChartProps {
  data: Array<{
    month: string;
    monthLabel: string;
    totalAmount: number;
    batchCount: number;
  }>;
  canViewSensitiveData: boolean;
  isLoading?: boolean;
}

export function PayoutTrendChart({
  data,
  canViewSensitiveData,
  isLoading,
}: PayoutTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52" />
        </CardContent>
      </Card>
    );
  }

  // Use unique month key (e.g. "2026-03") as index to prevent Tremor duplicate key warnings.
  // Include monthLabel for tooltip display.
  const chartData = data.map((d) => ({
    month: d.month,
    monthLabel: d.monthLabel,
    "Total Paid": canViewSensitiveData ? d.totalAmount : 0,
  }));

  const hasData = data.some((d) => d.totalAmount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Payout Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <AreaChart
            className="h-52"
            data={chartData}
            index="month"
            categories={["Total Paid"]}
            colors={["#10409a"]}
            showGridLines
            showLegend
            showTooltip
            showYAxis
            showXAxis
            yAxisWidth={60}
            valueFormatter={(value) =>
              canViewSensitiveData ? formatCurrency(value) : "—"
            }
            noDataText="No payout data"
          />
        ) : (
          <div className="h-52 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              No payout data available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
