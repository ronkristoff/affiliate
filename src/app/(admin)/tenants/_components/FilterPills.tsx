"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const FILTERS = ["all", "active", "trial", "flagged", "suspended"] as const;
export type Filter = (typeof FILTERS)[number];

interface FilterPillsProps {
  activeFilter: Filter;
  onFilterChange: (filter: Filter) => void;
  counts?: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    flagged: number;
  };
  isLoading?: boolean;
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  active: "Active",
  trial: "Trial",
  flagged: "Flagged",
  suspended: "Suspended",
};

const FILTER_COUNTS: Record<Filter, keyof NonNullable<FilterPillsProps["counts"]>> = {
  all: "total",
  active: "active",
  trial: "trial",
  flagged: "flagged",
  suspended: "suspended",
};

export function FilterPills({
  activeFilter,
  onFilterChange,
  counts,
  isLoading,
}: FilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter;
        const count = counts?.[FILTER_COUNTS[filter]] ?? 0;

        return (
          <Button
            key={filter}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(filter)}
            className={cn(
              "rounded-full",
              isActive
                ? "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90"
                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:border-[var(--brand-primary)]"
            )}
          >
            {FILTER_LABELS[filter]}
            <span
              className={cn(
                "ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-[var(--bg-page)] text-[var(--text-muted)]"
              )}
            >
              {isLoading ? "…" : count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
