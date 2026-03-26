"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
    ...(canViewSensitiveData && { "Cost/Conv": d.costPerConversion }),
  }));

  const categories = canViewSensitiveData
    ? ["Clicks", "Conversions", "Cost/Conv"]
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
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={60} />
                <Tooltip />
                {canViewSensitiveData && <Legend />}
                <Bar dataKey="Clicks" fill={colors[0]} />
                <Bar dataKey="Conversions" fill={colors[1]} />
                {canViewSensitiveData && <Bar dataKey="Cost/Conv" fill={colors[2]} />}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
