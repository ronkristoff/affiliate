"use client";

import { useMemo, useCallback } from "react";import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  Table2,
  Unplug,
  Route,
} from "lucide-react";
import type { SuggestedJoin } from "./types";

interface TableMetadata {
  name: string;
  label: string;
  description: string;
  columns: Array<{ name: string; type: string; label?: string }>;
}

interface TableSelectorProps {
  selectedTables: string[];
  onSelectionChange: (tables: string[]) => void;
  /** Admin mode: shows "Platform Admin" badge */
  isAdminMode?: boolean;
  /** Override available tables (for admin QB with expanded whitelist) */
  availableTables?: string[];
}

/**
 * Build an adjacency graph from suggestedJoins and check if a target table
 * is reachable from any of the already-selected tables via BFS.
 * Returns "direct" if there's a direct join, "transitive" if reachable
 * through intermediate tables, or "none" if no path exists.
 */
function getJoinReachability(
  selectedTables: string[],
  targetTable: string,
  suggestedJoins: SuggestedJoin[]
): "direct" | "transitive" | "none" {
  // Already selected — always reachable
  if (selectedTables.includes(targetTable)) return "direct";
  if (selectedTables.length === 0) return "direct"; // Nothing selected yet, everything is fair game
  if (suggestedJoins.length === 0) return "direct"; // No join metadata, allow all

  // Build undirected adjacency graph
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  for (const join of suggestedJoins) {
    addEdge(join.leftTable, join.rightTable);
  }

  // Check for direct join with any selected table
  const directConnected = selectedTables.some((sel) => {
    const neighbors = adjacency.get(sel);
    return neighbors?.has(targetTable) ?? false;
  });
  if (directConnected) return "direct";

  // BFS from all selected tables to find transitive paths
  const visited = new Set<string>(selectedTables);
  const queue = [...selectedTables];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      if (neighbor === targetTable) return "transitive";
      queue.push(neighbor);
    }
  }

  return "none";
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

export function TableSelector({ selectedTables, onSelectionChange, isAdminMode, availableTables }: TableSelectorProps) {
  const metadata = useQuery(api.queryBuilder.getTableMetadata);

  const filteredTables = useMemo(() => {
    if (!metadata) return [];
    if (availableTables) {
      return metadata.tables.filter((t) => availableTables.includes(t.name));
    }
    return metadata.tables;
  }, [metadata, availableTables]);

  if (!metadata) {
    return <TableSelectorSkeleton />;
  }

  // Handle both old (flat array) and new ({ tables, suggestedJoins }) return shape
  const tables = Array.isArray(metadata)
    ? (metadata as unknown as TableMetadata[])
    : ((metadata.tables ?? []) as unknown as TableMetadata[]);
  const suggestedJoins = Array.isArray(metadata)
    ? ([] as SuggestedJoin[])
    : ((metadata.suggestedJoins ?? []) as unknown as SuggestedJoin[]);

  const displayTables = availableTables
    ? tables.filter((t) => availableTables.includes(t.name))
    : tables;

  if (displayTables.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)] text-sm">
        No tables available.
      </div>
    );
  }

  const sortedAndAnnotated = useMemo(() => {
    const reachabilityMap = new Map<string, string>();
    for (const table of displayTables) {
      reachabilityMap.set(table.name, getJoinReachability(selectedTables, table.name, suggestedJoins));
    }

    return displayTables
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((table) => ({
        ...table,
        connectivity: (reachabilityMap.get(table.name) ?? "direct") as "selected" | "direct" | "transitive" | "none",
      }));
  }, [displayTables, selectedTables, suggestedJoins]);

  const handleToggle = useCallback((tableName: string) => {
    if (selectedTables.includes(tableName)) {
      onSelectionChange(selectedTables.filter((t) => t !== tableName));
    } else {
      onSelectionChange([...selectedTables, tableName]);
    }
  }, [selectedTables, onSelectionChange]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sortedAndAnnotated.map((table) => {
        const isSelected = selectedTables.includes(table.name);
        const reachability = table.connectivity;
        const isDisabled = reachability === "none";
        const isTransitive = reachability === "transitive";

        return (
          <div
            key={table.name}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            onClick={() => !isDisabled && handleToggle(table.name)}
            onKeyDown={(e) => {
              if (isDisabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggle(table.name);
              }
            }}
            title={isDisabled
              ? "No join path to selected tables — select an intermediate table first"
              : isTransitive
                ? "Connected via an intermediate table"
                : undefined
            }
            className={cn(
              "relative flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-all duration-200 shadow-sm",
              isSelected
                ? "bg-[#eff6ff] shadow-md ring-1 ring-[#1c2260]/20"
                : isDisabled
                  ? "bg-[var(--muted)]/40 opacity-50 cursor-not-allowed"
                  : "bg-white hover:shadow-md hover:bg-[#fafbfe]"
            )}
          >
            <div className="flex items-start gap-3 w-full">
              <Checkbox
                checked={isSelected}
                disabled={isDisabled}
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
              {isDisabled && !isSelected && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-500 border-red-200 bg-red-50">
                  <Unplug className="w-2.5 h-2.5 mr-1" />
                  No join path
                </Badge>
              )}
              {isTransitive && !isSelected && selectedTables.length >= 2 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200 bg-amber-50">
                  <Route className="w-2.5 h-2.5 mr-1" />
                  Indirect
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
