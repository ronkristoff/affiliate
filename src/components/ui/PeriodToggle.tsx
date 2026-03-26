"use client";

import { cn } from "@/lib/utils";

export type Period = "daily" | "weekly" | "monthly";

interface PeriodToggleProps {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}

/**
 * Period toggle for switching between daily, weekly, and monthly data views.
 * Used on dashboard and reports pages to control data granularity.
 */
export function PeriodToggle({ value, onChange, className }: PeriodToggleProps) {
  const periods: { value: Period; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-page)] p-0.5",
        className
      )}
      role="group"
      aria-label="Select data period"
    >
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
            value === period.value
              ? "bg-[var(--brand-primary)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-surface)]"
          )}
          aria-pressed={value === period.value}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
