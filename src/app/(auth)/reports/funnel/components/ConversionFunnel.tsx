"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui/FadeIn";
import { MousePointerClick, Target, BadgeCheck, ArrowDown } from "lucide-react";

interface ConversionFunnelProps {
  totalClicks: number;
  totalConversions: number;
  totalCommissions: number;
  clickToConversionRate: number;
  conversionToCommissionRate: number;
  overallRate: number;
  isLoading?: boolean;
}

/**
 * Hand-rolled CSS/Tailwind funnel visualization.
 * 3 horizontal bars with decreasing widths showing click → conversion → commission flow.
 */
export function ConversionFunnel({
  totalClicks,
  totalConversions,
  totalCommissions,
  clickToConversionRate,
  conversionToCommissionRate,
  overallRate,
  isLoading = false,
}: ConversionFunnelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-[var(--bg-surface)] p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse bg-muted rounded" />
          <div className="h-4 w-64 animate-pulse bg-muted rounded" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div
              className="h-12 animate-pulse bg-muted rounded-lg"
              style={{ width: `${100 - (i - 1) * 25}%` }}
            />
            {i < 3 && (
              <div className="flex justify-center">
                <div className="h-6 w-20 animate-pulse bg-muted rounded" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Compute bar widths as percentages of clicks
  const clicksWidth = 100;
  const conversionsWidth = totalClicks > 0
    ? Math.max((totalConversions / totalClicks) * 100, 8)
    : 0;
  const commissionsWidth = totalClicks > 0
    ? Math.max((totalCommissions / totalClicks) * 100, 8)
    : 0;

  const steps = [
    {
      label: "Clicks",
      count: totalClicks,
      width: clicksWidth,
      icon: MousePointerClick,
      opacity: "bg-[var(--brand-primary)]",
      opacityBg: "bg-[var(--brand-primary)]/10",
      borderColor: "border-[var(--brand-primary)]/20",
    },
    {
      label: "Conversions",
      count: totalConversions,
      width: conversionsWidth,
      icon: Target,
      opacity: "bg-[var(--brand-primary)]/75",
      opacityBg: "bg-[var(--brand-primary)]/8",
      borderColor: "border-[var(--brand-primary)]/15",
    },
    {
      label: "Confirmed Commissions",
      count: totalCommissions,
      width: commissionsWidth,
      icon: BadgeCheck,
      opacity: "bg-[var(--brand-primary)]/50",
      opacityBg: "bg-[var(--brand-primary)]/5",
      borderColor: "border-[var(--brand-primary)]/10",
    },
  ];

  const rates = [
    { value: clickToConversionRate, label: "Click → Conversion" },
    { value: conversionToCommissionRate, label: "Conversion → Commission" },
  ];

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

      <div className="flex flex-col items-center gap-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isFirst = index === 0;

          return (
            <FadeIn key={step.label} delay={index * 120}>
              {/* Rate indicator between steps */}
              {!isFirst && (
                <div className="flex flex-col items-center my-2">
                  <div className="flex items-center gap-1.5">
                    <ArrowDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="text-sm font-bold text-[var(--brand-primary)]">
                      {rates[index - 1].value.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {rates[index - 1].label}
                  </span>
                </div>
              )}

              {/* Funnel bar */}
              <div
                className={cn(
                  "w-full flex items-center rounded-lg border transition-all duration-700 ease-out overflow-hidden",
                  step.opacityBg,
                  step.borderColor,
                  isFirst ? "h-14" : "h-12"
                )}
                style={{ maxWidth: `${step.width}%` }}
              >
                {/* Filled portion */}
                <div
                  className={cn(
                    "h-full flex items-center gap-3 px-4 transition-all duration-700 ease-out",
                    step.opacity
                  )}
                  style={{ width: "100%" }}
                >
                  <Icon className="w-4 h-4 text-white/90 shrink-0" />
                  <span className="text-sm font-medium text-white whitespace-nowrap">
                    {step.label}
                  </span>
                </div>

                {/* Count badge (positioned outside on narrow bars) */}
                <div className="ml-2 mr-3 shrink-0">
                  <span className="text-sm font-semibold text-[var(--text-heading)] tabular-nums">
                    {step.count.toLocaleString()}
                  </span>
                  {!isFirst && step.count > 0 && (
                    <span className="text-xs text-[var(--text-muted)] ml-1.5">
                      ({step.width.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </FadeIn>
          );
        })}
      </div>

      {/* Summary stats at bottom */}
      <FadeIn delay={450} className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
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
            <span className="font-semibold tabular-nums">{totalCommissions.toLocaleString()}</span>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
