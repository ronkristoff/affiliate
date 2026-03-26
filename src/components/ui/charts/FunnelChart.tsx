"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { formatCurrency } from "@/lib/format";

interface FunnelChartProps {
  totalClicks: number;
  totalConversions: number;
  totalCommissions: number;
  clickToConversionRate: number;
  conversionToCommissionRate: number;
  overallRate: number;
  organicConversions?: number;
  isLoading?: boolean;
  canViewSensitiveData?: boolean;
}

/**
 * Recharts-based funnel visualization showing click → conversion → commission flow.
 * Replaces the hand-rolled CSS ConversionFunnel component.
 */
export function FunnelChart({
  totalClicks,
  totalConversions,
  totalCommissions,
  clickToConversionRate,
  conversionToCommissionRate,
  overallRate,
  organicConversions = 0,
  isLoading = false,
  canViewSensitiveData = true,
}: FunnelChartProps) {
  // Prepare data for the funnel chart
  const funnelData = [
    {
      name: "Clicks",
      value: totalClicks,
      fill: "var(--brand-primary)",
      fillOpacity: 1,
    },
    {
      name: "Conversions",
      value: totalConversions,
      fill: "var(--brand-primary)",
      fillOpacity: 0.75,
    },
    {
      name: "Commissions",
      value: totalCommissions,
      fill: "var(--brand-primary)",
      fillOpacity: 0.5,
    },
  ];

  // Find max value for scaling
  const maxValue = Math.max(totalClicks, totalConversions, totalCommissions);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-[var(--bg-surface)] p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse bg-muted rounded" />
          <div className="h-4 w-64 animate-pulse bg-muted rounded" />
        </div>
        <div className="h-64 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-[var(--bg-surface)] p-6">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-[var(--text-heading)]">
          Conversion Funnel
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Visualize your click-to-commission pipeline. Overall rate:{" "}
          <span className="font-semibold text-[var(--brand-primary)]">
            {overallRate.toFixed(1)}%
          </span>
        </p>
      </div>

      {/* Recharts Funnel Visualization */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={funnelData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" domain={[0, maxValue * 1.1]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--bg-page)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-md">
                      <p className="text-sm font-medium text-[var(--text-heading)]">
                        {data.name}
                      </p>
                      <p className="text-lg font-bold tabular-nums text-[var(--text-heading)]">
                        {data.name === "Commissions" && canViewSensitiveData
                          ? formatCurrency(data.value)
                          : data.value.toLocaleString()}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={entry.fillOpacity} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                style={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Conversion Rates */}
      <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]" />
            <span className="text-[var(--text-muted)]">Click → Conversion</span>
            <span className="font-semibold tabular-nums text-[var(--brand-primary)]">
              {clickToConversionRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]/75" />
            <span className="text-[var(--text-muted)]">Conversion → Commission</span>
            <span className="font-semibold tabular-nums text-[var(--brand-primary)]">
              {conversionToCommissionRate.toFixed(1)}%
            </span>
          </div>
        </div>
        {organicConversions > 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center mt-2">
            {organicConversions} organic conversions (no affiliate attribution)
          </p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]" />
            <span className="text-[var(--text-muted)]">Clicks</span>
            <span className="font-semibold tabular-nums">{totalClicks.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]/75" />
            <span className="text-[var(--text-muted)]">Conversions</span>
            <span className="font-semibold tabular-nums">{totalConversions.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--brand-primary)]/50" />
            <span className="text-[var(--text-muted)]">Commissions</span>
            <span className="font-semibold tabular-nums">
              {canViewSensitiveData ? formatCurrency(totalCommissions) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
