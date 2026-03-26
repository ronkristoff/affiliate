"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Trophy, TrendingUp, AlertTriangle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeAffiliateSegments, type AffiliateRow } from "@/lib/affiliate-segments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/FadeIn";

interface AffiliateSegmentsOverviewProps {
  affiliates: AffiliateRow[];
}

const segmentConfig = [
  {
    key: "topPerformers" as const,
    label: "Top Performers",
    color: "#10b981",
    icon: Trophy,
    description: "≥5% conversion rate",
    iconBg: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "risingStars" as const,
    label: "Rising Stars",
    color: "#3b82f6",
    icon: TrendingUp,
    description: "2–5% conversion rate",
    iconBg: "bg-blue-50 text-blue-600",
  },
  {
    key: "needsAttention" as const,
    label: "Needs Attention",
    color: "#f59e0b",
    icon: AlertTriangle,
    description: "<1% rate, 100+ clicks",
    iconBg: "bg-amber-50 text-amber-600",
  },
  {
    key: "inactive" as const,
    label: "Inactive",
    color: "#6b7280",
    icon: UserX,
    description: "No clicks recorded",
    iconBg: "bg-gray-100 text-gray-600",
  },
];

export function AffiliateSegmentsOverview({ affiliates }: AffiliateSegmentsOverviewProps) {
  const segments = useMemo(() => computeAffiliateSegments(affiliates), [affiliates]);

  const donutData = useMemo(
    () =>
      segmentConfig.map((s) => ({
        name: s.label,
        value: segments[s.key],
        color: s.color,
      })),
    [segments]
  );

  const totalSegmented = segments.topPerformers + segments.risingStars + segments.needsAttention + segments.inactive;

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Affiliate Segments</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totalSegmented} of {affiliates.length} affiliates segmented
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Segment Cards */}
            <div className="grid grid-cols-2 gap-3">
              {segmentConfig.map((s) => {
                const Icon = s.icon;
                const count = segments[s.key];
                return (
                  <div
                    key={s.key}
                    className="p-4 rounded-xl border bg-[var(--bg-surface)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          s.iconBg
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                        {s.label}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[var(--text-heading)] tabular-nums">
                      {count}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {s.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Donut Chart */}
            <div className="flex flex-col items-center justify-center">
              {totalSegmented > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={192}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-4 mt-2">
                    {segmentConfig.map((s) => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  No segment data available
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
