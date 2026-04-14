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
  variant?: "blue" | "green" | "yellow" | "gray" | "red";
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
  blue: "bg-white",
  green: "bg-white",
  yellow: "bg-white",
  gray: "bg-white",
  red: "bg-white",
};

const accentGradientMap: Record<string, string> = {
  blue: "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)",
  green: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  yellow: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  gray: "linear-gradient(135deg, #5a5f7a 0%, #4b5563 100%)",
  red: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
};

const iconBgMap: Record<string, string> = {
  blue: "bg-[#eff6ff] text-[#1c2260]",
  green: "bg-[#ecfdf5] text-[#059669]",
  yellow: "bg-[#fffbeb] text-[#d97706]",
  gray: "bg-[#f6f7fa] text-[#5a5f7a]",
  red: "bg-[#fef2f2] text-[#dc2626]",
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
  const accentGradient = accentGradientMap[variant] ?? accentGradientMap.blue;

  return (
    <div
      className={cn(
        "metric-card rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5",
        variantStyles[variant],
        className
      )}
    >
      {/* Dramatic gradient top accent bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
        style={{ background: accentGradient }}
      />
      
      {/* Decorative corner accent */}
      <div 
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.03] blur-2xl"
        style={{ background: accentGradient, transform: 'translate(30%, -30%)' }}
      />

      {/* Label row — icon sits top-right */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <p className="text-[11px] font-light text-[var(--text-muted)] uppercase tracking-[0.2em]">
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 icon-breathe shadow-lg",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value — animated if numericValue is provided */}
      <p className="text-[32px] font-semibold text-[var(--text-heading)] tabular-nums tracking-normal mb-2 relative z-10">
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

      {delta && <div className="mb-2 relative z-10">{getDeltaDisplay()}</div>}
      {subtext && (
        <p className="text-[11px] text-[var(--text-muted)] relative z-10">{subtext}</p>
      )}

      {/* Sparkline trend chart */}
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-3 relative z-10">
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
