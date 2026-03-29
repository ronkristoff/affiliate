"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Columns3 } from "lucide-react";

interface ColumnMetadata {
  name: string;
  label: string;
  columns: Array<{ name: string; type: string; label?: string }>;
}

interface ColumnSelectorProps {
  selectedTables: string[];
  selectedColumns: Array<{ table: string; column: string }>;
  onSelectionChange: (columns: Array<{ table: string; column: string; alias?: string }>) => void;
}

function ColumnTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    string: "bg-blue-50 text-blue-700 border-blue-200",
    number: "bg-emerald-50 text-emerald-700 border-emerald-200",
    date: "bg-amber-50 text-amber-700 border-amber-200",
    boolean: "bg-purple-50 text-purple-700 border-purple-200",
    id: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0 text-[10px] font-semibold rounded border",
        colorMap[type] ?? colorMap.string
      )}
    >
      {type}
    </span>
  );
}

function ColumnSelectorSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-1.5">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-8 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColumnSelector({
  selectedTables,
  selectedColumns,
  onSelectionChange,
}: ColumnSelectorProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);

  if (!metadata) {
    return <ColumnSelectorSkeleton />;
  }

  // Handle both old (flat array) and new ({ tables, suggestedJoins }) return shape
  const allTableMeta = Array.isArray(metadata)
    ? (metadata as unknown as ColumnMetadata[])
    : ((metadata.tables ?? []) as unknown as ColumnMetadata[]);
  const relevantTables = allTableMeta.filter((t) =>
    selectedTables.includes(t.name)
  );

  if (relevantTables.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)] text-sm">
        <Columns3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Select tables first to view columns.
      </div>
    );
  }

  const isSelected = (table: string, column: string) =>
    selectedColumns.some((c) => c.table === table && c.column === column);

  const handleToggle = (table: string, column: string) => {
    if (isSelected(table, column)) {
      onSelectionChange(
        selectedColumns.filter((c) => !(c.table === table && c.column === column))
      );
    } else {
      onSelectionChange([...selectedColumns, { table, column }]);
    }
  };

  const handleSelectAll = (name: string, columns: Array<{ name: string }>) => {
    const allSelected = columns.every((col) =>
      isSelected(name, col.name)
    );
    if (allSelected) {
      onSelectionChange(
        selectedColumns.filter((c) => c.table !== name)
      );
    } else {
      const existing = selectedColumns.filter((c) => c.table !== name);
      const newCols = columns.map((col) => ({
        table: name,
        column: col.name,
      }));
      onSelectionChange([...existing, ...newCols]);
    }
  };

  return (
    <div className="space-y-5">
      {relevantTables.map((table) => {
        const allSelected = table.columns.every((col) =>
          isSelected(table.name, col.name)
        );
        const selectedCount = table.columns.filter((col) =>
          isSelected(table.name, col.name)
        ).length;

        return (
          <div key={table.name}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-heading)]">
                  {table.label}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {selectedCount}/{table.columns.length}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => handleSelectAll(table.name, table.columns)}
                className="text-xs font-medium text-[#1659d6] hover:text-[#10409a] transition-colors"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="space-y-1">
              {table.columns.map((col) => {
                const checked = isSelected(table.name, col.name);
                return (
                  <label
                    key={col.name}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-all duration-150",
                      checked
                        ? "bg-[#eff6ff] border border-[#10409a]/20"
                        : "hover:bg-gray-50 border border-transparent"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        handleToggle(table.name, col.name)
                      }
                    />
                    <span className="text-[13px] text-[var(--text-body)] flex-1">
                      {col.label ?? col.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono mr-2">
                      {col.name}
                    </span>
                    <ColumnTypeBadge type={col.type} />
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
