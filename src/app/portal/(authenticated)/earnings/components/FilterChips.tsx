"use client";

import { cn } from "@/lib/utils";

interface FilterChipsProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

const PERIOD_CHIPS = [
  { key: "all", label: "All Time" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "last_3_months", label: "Last 90 Days" },
] as const;

const STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Completed" },
  { key: "reversed", label: "Declined" },
] as const;

export function FilterChips({
  selectedPeriod,
  onPeriodChange,
  selectedStatus,
  onStatusChange,
}: FilterChipsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PERIOD_CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onPeriodChange(chip.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              selectedPeriod === chip.key
                ? "bg-[var(--portal-primary)] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onStatusChange(chip.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              selectedStatus === chip.key
                ? "bg-[var(--portal-primary)] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
