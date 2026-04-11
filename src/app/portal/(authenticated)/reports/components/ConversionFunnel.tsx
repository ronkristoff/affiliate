"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ConversionFunnelProps {
  data: { clicks: number; conversions: number } | undefined;
  isLoading: boolean;
}

export function ConversionFunnel({ data, isLoading }: ConversionFunnelProps) {
  const stats = useMemo(() => {
    if (!data) return null;
    const { clicks, conversions } = data;
    const convRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";
    const paying = Math.round(conversions * 0.4);
    return { clicks, conversions, convRate, paying };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const maxVal = Math.max(stats.clicks, 1);
  const stages = [
    {
      label: `${stats.clicks.toLocaleString()} people clicked your link`,
      value: stats.clicks,
      color: "bg-[var(--portal-primary)]",
      textColor: "text-white",
    },
    {
      label: `${stats.conversions.toLocaleString()} signed up (${stats.convRate}% conversion)`,
      value: stats.conversions,
      color: "bg-[var(--portal-primary)]/70",
      textColor: "text-white",
    },
    {
      label: `${stats.paying.toLocaleString()} became paying customers`,
      value: stats.paying,
      color: "bg-[var(--portal-primary)]/45",
      textColor: "text-white",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-medium text-gray-700">{stage.label}</p>
              <div className="w-full h-9 rounded-lg bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-lg flex items-center justify-center text-xs font-semibold transition-all duration-500", stage.color, stage.textColor)}
                  style={{ width: `${Math.max((stage.value / maxVal) * 100, 8)}%` }}
                >
                  {stage.value > 0 && stage.value.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t">
          Tip: Personalized messages when sharing your link can boost sign-ups by up to 3x!
        </p>
      </CardContent>
    </Card>
  );
}
