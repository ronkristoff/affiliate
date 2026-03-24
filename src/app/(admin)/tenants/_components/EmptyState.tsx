"use client";

import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  searchQuery?: string;
  activeFilter?: string;
}

export function EmptyState({
  hasActiveFilters,
  onClearFilters,
  searchQuery,
  activeFilter,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] py-16">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
        <SearchX className="h-6 w-6 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-heading)]">No tenants found</h3>
      <p className="mt-1 max-w-sm text-center text-sm text-[var(--text-muted)]">
        {hasActiveFilters
          ? `No tenants match your current filters${
              searchQuery ? ` for "${searchQuery}"` : ""
            }${activeFilter && activeFilter !== "all" ? ` with status "${activeFilter}"` : ""}.`
          : "No tenant accounts have been created yet."}
      </p>
      {hasActiveFilters && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={onClearFilters}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
