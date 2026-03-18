"use client";

import { cn } from "@/lib/utils";

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
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-transparent bg-[#10409a] text-white"
                : "border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#10409a] hover:text-[#10409a]"
            )}
          >
            {FILTER_LABELS[filter]}
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-[#f3f4f6] text-[#6b7280]"
              )}
            >
              {isLoading ? "…" : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
