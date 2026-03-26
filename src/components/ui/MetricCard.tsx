"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCount } from "@/components/ui/AnimatedCount";
import { SparklineChart } from "./charts/SparklineChart";

interface MetricCardProps {
  label: string;
  /** Static value — rendered as-is. Ignored when numericValue is set. */
  value?: string | number;
  subtext?: string;
  delta?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  variant?: "blue" | "green" | "yellow" | "gray";
  isLoading?: boolean;
  prefix?: string;
  className?: string;

  // ── Animated value support ──
  /** Raw numeric value — triggers count-up animation when provided. */
  numericValue?: number;
  /** Formatter for the animated number (e.g. formatCurrency). */
  formatValue?: (n: number) => string;

  // ── Icon support ──
  /** Lucide icon or any ReactNode rendered top-right with a subtle breathing animation. Required for visual consistency. */
  icon: React.ReactNode;

  // ── Sparkline trend support ──
  /** Optional trend data for sparkline chart display */
  sparklineData?: number[];
}

const variantStyles = {
  blue: "bg-[var(--bg-surface)]",
  green: "bg-[var(--bg-surface)]",
  yellow: "bg-[var(--bg-surface)]",
  gray: "bg-[var(--bg-surface)]",
};

const iconBgMap: Record<string, string> = {
  blue: "bg-[var(--brand-light)] text-[var(--brand-primary)]",
  green: "bg-[var(--success-bg)] text-[var(--success-text)]",
  yellow: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  gray: "bg-[var(--bg-page)] text-[var(--text-muted)]",
};

export function MetricCard({
  label,
  value,
  subtext,
  delta,
  variant = "blue",
  isLoading = false,
  prefix = "",
  className = "",
  numericValue,
  formatValue,
  icon,
  sparklineData,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "metric-card rounded-xl p-5 relative overflow-hidden",
          variantStyles[variant],
          className
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <Skeleton className="h-3 w-24" />
          {icon && <Skeleton className="h-9 w-9 rounded-full" />}
        </div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  // Format delta display text
  const getDeltaDisplay = () => {
    if (!delta) return null;
    if (delta.value === 0) {
      return (
        <span className="text-[12px] font-semibold text-[var(--text-muted)]">
          — {delta.label || "no change"}
        </span>
      );
    }
    const colorClass = delta.isPositive
      ? "text-[var(--success)]"
      : "text-[var(--danger)]";
    return (
      <span className={cn("text-[12px] font-semibold inline-flex items-center gap-0.5", colorClass)}>
        <span
          className={cn(
            "inline-block text-[13px] leading-none",
            delta.isPositive ? "animate-bounce-up" : "animate-bounce-down"
          )}
        >
          {delta.isPositive ? "▲" : "▼"}
        </span>
        {delta.value}%{delta.label && <span className="ml-0.5">{delta.label}</span>}
      </span>
    );
  };

  const iconBg = iconBgMap[variant] ?? iconBgMap.blue;

  return (
    <div
      className={cn(
        "metric-card rounded-xl p-5 relative overflow-hidden",
        variantStyles[variant],
        className
      )}
    >
      {/* Label row — icon sits top-right */}
      <div className="flex items-start justify-between mb-2.5">
        <p className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em]">
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center shrink-0 icon-breathe",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value — animated if numericValue is provided */}
      <p className="text-[28px] font-bold text-[var(--text-heading)] tabular-nums tracking-tight mb-1.5">
        {numericValue !== undefined ? (
          <AnimatedCount
            value={numericValue}
            format={formatValue}
            delay={200}
          />
        ) : (
          <>{prefix}&thinsp;{value}</>
        )}
      </p>

      {delta && <div className="mb-1">{getDeltaDisplay()}</div>}
      {subtext && (
        <p className="text-[11px] text-[var(--text-muted)]">{subtext}</p>
      )}

      {/* Sparkline trend chart */}
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-2">
          <SparklineChart
            data={sparklineData}
            color={
              delta?.isPositive === false
                ? "var(--danger)"
                : delta?.isPositive === true
                  ? "var(--success)"
                  : "var(--brand-primary)"
            }
            height={32}
            strokeWidth={1.5}
          />
        </div>
      )}
    </div>
  );
}
