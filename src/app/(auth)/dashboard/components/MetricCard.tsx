"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  label: string;
  value: string | number;
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
}

const variantStyles = {
  blue: "bg-[var(--bg-surface)] border-[var(--border)]",
  green: "bg-[var(--bg-surface)] border-[var(--border)]",
  yellow: "bg-[var(--bg-surface)] border-[var(--border)]",
  gray: "bg-[var(--bg-surface)] border-[var(--border)]",
};

  const accentColors = {
    blue: "blue",
    green: "green",
    yellow: "yellow",
    gray: "gray",
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
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div className={cn("metric-card", variant, "rounded-xl border p-5 relative overflow-hidden", variantStyles[variant], className)}>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  // Format delta display text
  const getDeltaDisplay = () => {
    if (!delta) return null;
    if (delta.value === 0) {
      return <span className="text-[12px] font-semibold text-[var(--text-muted)]">— {delta.label || "no change"}</span>;
    }
    const arrow = delta.isPositive ? "▲" : "▼";
    const colorClass = delta.isPositive ? "text-[var(--success)]" : "text-[var(--danger)]";
    return (
      <span className={cn("text-[12px] font-semibold", colorClass)}>
        {arrow} {delta.value}%{delta.label && ` ${delta.label}`}
      </span>
    );
  };

  return (
    <div className={cn("metric-card", variant, "rounded-xl border p-5", variantStyles[variant], className)}>
      <p className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-2.5">
        {label}
      </p>
      <p className="text-[28px] font-bold text-[var(--text-heading)] tabular-nums tracking-tight mb-1.5">
        {prefix}{value}
      </p>
      {delta && (
        <div className="mb-1">{getDeltaDisplay()}</div>
      )}
      {subtext && (
        <p className="text-[11px] text-[var(--text-muted)]">
          {subtext}
        </p>
      )}
    </div>
  );
}
