"use client";

import { BarChart } from "@tremor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface FraudSeverityChartProps {
  data: { name: string; count: number }[];
}

export function FraudSeverityChart({ data }: FraudSeverityChartProps) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Signals by Severity</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <BarChart
            className="mt-2 h-52"
            data={data}
            index="name"
            categories={["count"]}
            colors={["#16a34a", "#f59e0b", "#ef4444"]}
            showGridLines
            showLegend={false}
            showTooltip
            showYAxis
            showXAxis
            yAxisWidth={48}
            valueFormatter={(value) => String(value)}
          />
        ) : (
          <div className="h-52 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No fraud signals</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FraudSeverityChartSkeleton() {
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
