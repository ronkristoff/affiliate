"use client";

import { LineChart } from "@tremor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FraudTrendChartProps {
  data: { date: string; count: number }[];
}

export function FraudTrendChart({ data }: FraudTrendChartProps) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fraud Signal Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <LineChart
            className="h-52"
            data={data}
            index="date"
            categories={["count"]}
            colors={["#ef4444"]}
            showGridLines
            showLegend={false}
            showTooltip
            showYAxis
            showXAxis
            startEndOnly
            yAxisWidth={48}
            valueFormatter={(value) => String(value)}
            connectNulls
          />
        ) : (
          <div className="h-52 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No fraud trend data available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FraudTrendChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-52" />
      </CardContent>
    </Card>
  );
}
