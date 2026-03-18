"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "blue" | "green" | "yellow" | "gray";
  isLoading?: boolean;
  prefix?: string;
}

const variantStyles = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    iconBg: "bg-blue-100",
    text: "text-blue-900",
    subtext: "text-blue-600",
  },
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100",
    text: "text-emerald-900",
    subtext: "text-emerald-600",
  },
  yellow: {
    bg: "bg-amber-50",
    border: "border-amber-100",
    iconBg: "bg-amber-100",
    text: "text-amber-900",
    subtext: "text-amber-600",
  },
  gray: {
    bg: "bg-gray-50",
    border: "border-gray-100",
    iconBg: "bg-gray-100",
    text: "text-gray-900",
    subtext: "text-gray-600",
  },
};

export function MetricCard({
  label,
  value,
  subtext,
  delta,
  variant = "blue",
  isLoading = false,
  prefix = "",
}: MetricCardProps) {
  const styles = variantStyles[variant];

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border p-5", styles.bg, styles.border)}>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-5", styles.bg, styles.border)}>
      <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2", styles.subtext)}>
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className={cn("text-2xl font-bold tabular-nums", styles.text)}>
          {prefix}{value}
        </p>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium",
              delta.isPositive ? "text-emerald-600" : "text-red-600"
            )}
          >
            {delta.isPositive ? (
              <TrendingUp className="w-3 h-3 mr-0.5" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-0.5" />
            )}
            {Math.abs(delta.value)}%
          </span>
        )}
      </div>
      {subtext && (
        <p className={cn("text-xs mt-1", styles.subtext)}>
          {subtext}
        </p>
      )}
    </div>
  );
}
