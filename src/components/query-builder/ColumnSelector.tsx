"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Columns3, Search, Info, Pencil, Check, X } from "lucide-react";

interface ColumnMetadata {
  name: string;
  label: string;
  columns: Array<{ name: string; type: string; label?: string }>;
}

interface ColumnSelectorProps {
  selectedTables: string[];
  selectedColumns: Array<{ table: string; column: string; alias?: string }>;
  onSelectionChange: (columns: Array<{ table: string; column: string; alias?: string }>) => void;
  onUpdateAlias?: (table: string, column: string, alias: string | undefined) => void;
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

// ─── Column Stats Tooltip (hover-activated, single query at a time) ───
function ColumnStatsTooltip({
  tableName,
  columnName,
  active,
}: {
  tableName: string;
  columnName: string;
  active: boolean;
}) {
  const stats = useQuery(
    api.queryBuilder.getColumnStats,
    active ? { tableName, columnName } : "skip"
  );

  if (!active || !stats) return null;

  const lines = [`Total rows: ${stats.totalRows.toLocaleString()}`];
  lines.push(`Distinct values: ${stats.distinctValues}`);
  if (stats.nullCount > 0) lines.push(`Empty: ${stats.nullCount}`);
  if (stats.numericStats) {
    lines.push(`Range: ${stats.numericStats.min.toLocaleString()} — ${stats.numericStats.max.toLocaleString()}`);
    lines.push(`Average: ${stats.numericStats.avg.toLocaleString()}`);
  }
  if (stats.sampleValues.length > 0) {
    lines.push(`Examples: ${stats.sampleValues.map((v) => String(v)).join(", ")}`);
  }

  return (
    <div className="absolute left-0 top-full mt-1 z-50 pointer-events-none rounded-lg border border-[var(--border)] bg-white p-2.5 shadow-lg min-w-[220px]">
      <div className="space-y-0.5 text-[11px] text-[var(--text-body)]">
        <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          {tableName}.{columnName}
        </div>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

export function ColumnSelector({
  selectedTables,
  selectedColumns,
  onSelectionChange,
  onUpdateAlias,
}: ColumnSelectorProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredColumn, setHoveredColumn] = useState<{ table: string; column: string } | null>(null);
  const [editingAlias, setEditingAlias] = useState<{ table: string; column: string } | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((table: string, column: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    // Small delay to avoid firing queries on fast scrollovers
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredColumn({ table, column });
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredColumn(null);
  }, []);

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

  const totalColumns = relevantTables.reduce((sum, t) => sum + t.columns.length, 0);

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

  // Filter columns by search query
  const query = searchQuery.toLowerCase().trim();
  const filteredTables = useMemo(() => {
    if (!query) return relevantTables;
    return relevantTables
      .map((table) => ({
        ...table,
        columns: table.columns.filter(
          (col) =>
            col.name.toLowerCase().includes(query) ||
            (col.label ?? "").toLowerCase().includes(query) ||
            table.name.toLowerCase().includes(query) ||
            table.label.toLowerCase().includes(query)
        ),
      }))
      .filter((t) => t.columns.length > 0);
  }, [relevantTables, query]);

  return (
    <div className="space-y-4">
      {/* Search */}
      {totalColumns > 8 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <Input
            size={undefined}
            placeholder="Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-[13px] pl-8"
          />
        </div>
      )}

      {filteredTables.length === 0 && query ? (
        <div className="text-center py-4 text-[var(--text-muted)] text-sm">
          No columns match &quot;{searchQuery}&quot;
        </div>
      ) : (
        <div className="space-y-5">
          {filteredTables.map((table) => {
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
                    className="text-xs font-medium text-[#1fb5a5] hover:text-[#1c2260] transition-colors"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="space-y-1">
                  {table.columns.map((col) => {
                    const checked = isSelected(table.name, col.name);
                    const isHovered = hoveredColumn?.table === table.name && hoveredColumn?.column === col.name;
                    const isEditing = editingAlias?.table === table.name && editingAlias?.column === col.name;
                    const currentAlias = selectedColumns.find(
                      (c) => c.table === table.name && c.column === col.name
                    )?.alias;

                    return (
                      <div
                        key={col.name}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150",
                          checked
                            ? "bg-[#eff6ff] border border-[#1c2260]/20"
                            : "hover:bg-[var(--hover)] border border-transparent"
                        )}
                        onMouseEnter={() => handleMouseEnter(table.name, col.name)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            handleToggle(table.name, col.name)
                          }
                        />
                        <label
                          className="text-[13px] text-[var(--text-body)] flex-1 cursor-pointer"
                          onClick={() => handleToggle(table.name, col.name)}
                        >
                          {col.label ?? col.name}
                        </label>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono mr-1">
                          {col.name}
                        </span>
                        <ColumnTypeBadge type={col.type} />
                        {/* Alias display + edit */}
                        {checked && onUpdateAlias && (
                          isEditing ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                size={undefined}
                                value={aliasDraft}
                                onChange={(e) => setAliasDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    onUpdateAlias(table.name, col.name, aliasDraft.trim() || undefined);
                                    setEditingAlias(null);
                                  }
                                  if (e.key === "Escape") setEditingAlias(null);
                                }}
                                className="h-6 w-24 text-[11px] px-1.5 py-0"
                                placeholder="alias"
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-emerald-600 hover:text-emerald-700 shrink-0"
                                onClick={() => {
                                  onUpdateAlias(table.name, col.name, aliasDraft.trim() || undefined);
                                  setEditingAlias(null);
                                }}
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-[var(--text-muted)] shrink-0"
                                onClick={() => setEditingAlias(null)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {currentAlias && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                                  → {currentAlias}
                                </Badge>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAlias({ table: table.name, column: col.name });
                                  setAliasDraft(currentAlias ?? "");
                                }}
                                className="p-0.5 text-[var(--text-muted)] hover:text-[#1fb5a5] opacity-0 hover:opacity-100 transition-opacity"
                                title="Set column alias"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        )}
                        {/* Info icon — subtle hint that stats are available on hover */}
                        <Info className="w-3 h-3 text-[var(--text-muted)] opacity-30 shrink-0" />
                        {/* Stats tooltip */}
                        {isHovered && (
                          <ColumnStatsTooltip
                            tableName={table.name}
                            columnName={col.name}
                            active={isHovered}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
