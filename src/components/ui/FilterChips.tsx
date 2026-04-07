"use client";

import type { ColumnFilter } from "@/components/ui/table-filters/types";
import type { TableColumn } from "@/components/ui/DataTable";
import { FilterPill, FilterPillBar } from "@/components/ui/FilterPill";

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
  const pills = filters.map((filter) => ({
    key: filter.columnKey,
    label: formatFilterLabel(filter, columns),
  }));

  return (
    <FilterPillBar
      pills={pills}
      onRemove={onRemove}
      onClearAll={onClearAll}
      className="mb-3"
    />
  );
}
