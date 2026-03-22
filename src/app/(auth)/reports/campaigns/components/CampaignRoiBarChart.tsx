"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@tremor/react";
import { FadeIn } from "@/components/ui/FadeIn";

interface CampaignRoiBarChartProps {
  comparisonData: Array<{
    name: string;
    clicks: number;
    conversions: number;
    totalCommissions: number;
    costPerConversion: number;
  }>;
  canViewSensitiveData: boolean;
}

export function CampaignRoiBarChart({
  comparisonData,
  canViewSensitiveData,
}: CampaignRoiBarChartProps) {
  if (comparisonData.length === 0) return null;

  const allZero = comparisonData.every(
    (d) => d.clicks === 0 && d.conversions === 0
  );

  const chartData = comparisonData.map((d) => ({
    name: d.name,
    Clicks: d.clicks,
    Conversions: d.conversions,
    ...(canViewSensitiveData && { "Cost/Conversion": d.costPerConversion }),
  }));

  const categories = canViewSensitiveData
    ? ["Clicks", "Conversions", "Cost/Conversion"]
    : ["Clicks", "Conversions"];

  const colors = canViewSensitiveData
    ? ["#10409a", "#16a34a", "#f59e0b"]
    : ["#10409a", "#16a34a"];

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Metrics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {allZero ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No data to compare
            </div>
          ) : (
            <BarChart
              className="h-64"
              data={chartData}
              index="name"
              categories={categories}
              colors={colors}
              yAxisWidth={60}
              showGridLines
              showLegend
              showTooltip
              showYAxis
              showXAxis
              noDataText="No comparison data"
            />
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
