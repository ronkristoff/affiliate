"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  Table2,
} from "lucide-react";

interface TableMetadata {
  name: string;
  label: string;
  description: string;
  columns: Array<{ name: string; type: string; label?: string }>;
}

interface TableSelectorProps {
  selectedTables: string[];
  onSelectionChange: (tables: string[]) => void;
}

function TableSelectorSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export function TableSelector({ selectedTables, onSelectionChange }: TableSelectorProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);

  if (!metadata) {
    return <TableSelectorSkeleton />;
  }

  // Handle both old (flat array) and new ({ tables, suggestedJoins }) return shape
  const tables = Array.isArray(metadata)
    ? (metadata as unknown as TableMetadata[])
    : ((metadata.tables ?? []) as unknown as TableMetadata[]);

  if (tables.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)] text-sm">
        No tables available.
      </div>
    );
  }

  const sortedTables = [...tables].sort(
    (a, b) => a.label.localeCompare(b.label)
  );

  const handleToggle = (tableName: string) => {
    if (selectedTables.includes(tableName)) {
      onSelectionChange(selectedTables.filter((t) => t !== tableName));
    } else {
      onSelectionChange([...selectedTables, tableName]);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sortedTables.map((table) => {
        const isSelected = selectedTables.includes(table.name);
        return (
          <div
            key={table.name}
            role="button"
            tabIndex={0}
            onClick={() => handleToggle(table.name)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle(table.name); } }}
            className={cn(
              "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200",
              isSelected
                ? "border-[#1c2260] bg-[#eff6ff] shadow-sm ring-1 ring-[#1c2260]/20"
                : "border-[var(--border)] bg-white hover:border-[#1fb5a5]/40 hover:bg-[#fafbfe] hover:shadow-sm"
            )}
          >
            <div className="flex items-start gap-3 w-full">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(table.name)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Table2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--text-heading)] truncate">
                    {table.label}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                  {table.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-7">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Database className="w-2.5 h-2.5 mr-1" />
                {table.columns.length} columns
              </Badge>
              {isSelected && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  Selected
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
