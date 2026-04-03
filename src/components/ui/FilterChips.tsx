"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnFilter } from "@/components/ui/table-filters/types";
import type { TableColumn } from "@/components/ui/DataTable";

interface FilterChipsProps<T> {
  filters: ColumnFilter[];
  columns: TableColumn<T>[];
  onRemove: (columnKey: string) => void;
  onClearAll: () => void;
}

function formatFilterLabel<T>(filter: ColumnFilter, columns: TableColumn<T>[]): string {
  const col = columns.find((c) => c.key === filter.columnKey);
  const label = col?.filterLabel || (typeof col?.header === "string" ? col.header : filter.columnKey);

  switch (filter.type) {
    case "text":
      return `${label}: "${filter.value}"`;
    case "select": {
      const options = col?.filterOptions ?? [];
      const names = (filter.values ?? [])
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
      return `${label}: ${names}`;
    }
    case "number-range": {
      const parts: string[] = [];
      if (filter.min != null) parts.push(`\u2265 ${filter.min.toLocaleString()}`);
      if (filter.max != null) parts.push(`\u2264 ${filter.max.toLocaleString()}`);
      return `${label}: ${parts.join(" & ")}`;
    }
    case "date-range": {
      const parts: string[] = [];
      if (filter.after) parts.push(`After ${new Date(filter.after).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
      if (filter.before) parts.push(`Before ${new Date(filter.before).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
      return `${label}: ${parts.join(" & ")}`;
    }
    default:
      return `${label}: Active`;
  }
}

export function FilterChips<T>({ filters, columns, onRemove, onClearAll }: FilterChipsProps<T>) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {filters.map((filter) => (
        <span
          key={filter.columnKey}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-[#eff6ff] text-[#1c2260] border border-[#1c2260]/20"
        >
          {formatFilterLabel(filter, columns)}
          <button
            type="button"
            onClick={() => onRemove(filter.columnKey)}
            className="ml-0.5 hover:text-[#ef4444] transition-colors"
            aria-label={`Remove ${filter.columnKey} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] text-[#6b7280] hover:text-[#ef4444] cursor-pointer transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
