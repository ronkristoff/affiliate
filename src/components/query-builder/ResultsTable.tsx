"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Inbox,
  ChevronsUpDown,
} from "lucide-react";

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

interface ResultsTableProps {
  results: Array<Record<string, unknown>> | null | undefined;
  columns: string[];
  isLoading: boolean;
  totalRows?: number;
  pageSize?: number;
  /** First GROUP BY column name — when provided, rows are visually grouped */
  groupByColumn?: string;
}

// ─── Grouped Row Structure ──────────────────────────────────────
interface RowGroup {
  /** Display value for the group header */
  label: string;
  /** Raw value used for stable identity */
  value: string;
  /** Rows belonging to this group */
  rows: Array<Record<string, unknown>>;
}

export function ResultsTable({
  results,
  columns,
  isLoading,
  totalRows,
  pageSize = 50,
  groupByColumn,
}: ResultsTableProps) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);

  const displayColumns = columns.length > 0
    ? columns
    : results && results.length > 0
      ? Object.keys(results[0])
      : [];

  const totalPages = totalRows ? Math.ceil(totalRows / pageSize) : 0;
  const isGrouped = !!groupByColumn && results && results.length > 0;

  // Reset to page 0 and collapse state when results change
  useEffect(() => {
    setPage(0);
    setSort({ column: "", direction: null });
    setCollapsedGroups(new Set());
    setAllCollapsed(false);
  }, [results]);

  const handleSort = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column !== column) {
        return { column, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column, direction: "desc" };
      }
      return { column: "", direction: null };
    });
  }, []);

  const sortedResults = useMemo(() => {
    if (!results || !sort.column || !sort.direction) return results ?? [];
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...(results ?? [])].sort((a, b) => {
      const aVal = a[sort.column];
      const bVal = b[sort.column];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Number comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }

      // String comparison (case-insensitive)
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return aStr.localeCompare(bStr) * dir;
    });
  }, [results, sort]);

  // ─── Group rows by the first GROUP BY column ──────────────────
  const rowGroups = useMemo((): RowGroup[] => {
    if (!isGrouped || !groupByColumn) return [];

    const groupMap = new Map<string, RowGroup>();
    for (const row of sortedResults) {
      const rawValue = row[groupByColumn];
      const value = rawValue == null ? "__null__" : String(rawValue);
      const label = rawValue == null ? "— (empty)" : formatCellValue(rawValue);

      const existing = groupMap.get(value);
      if (existing) {
        existing.rows.push(row);
      } else {
        groupMap.set(value, { label, value, rows: [row] });
      }
    }

    return [...groupMap.values()];
  }, [isGrouped, groupByColumn, sortedResults]);

  // ─── Collapse / Expand All ────────────────────────────────────
  const toggleAllGroups = useCallback(() => {
    if (allCollapsed) {
      setCollapsedGroups(new Set());
      setAllCollapsed(false);
    } else {
      setCollapsedGroups(new Set(rowGroups.map((g) => g.value)));
      setAllCollapsed(true);
    }
  }, [allCollapsed, rowGroups]);

  const toggleGroup = useCallback((value: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      setAllCollapsed(next.size === rowGroups.length);
      return next;
    });
  }, [rowGroups.length]);

  // ─── Loading State ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-16">
        <Inbox className="w-12 h-12 mx-auto text-[var(--text-muted)]/30 mb-3" />
        <p className="text-sm font-medium text-[var(--text-muted)]">No results</p>
        <p className="text-xs text-[var(--text-muted)]/70 mt-1">
          Configure your query and click &quot;Run Query&quot; to see results.
        </p>
      </div>
    );
  }

  const safeColumns = displayColumns.length > 0 ? displayColumns : Object.keys(results[0]);

  // Find the index of the groupBy column for visual alignment.
  // Fall back to 0 if the column key isn't found in safeColumns (alias mismatch).
  const groupColIndex = groupByColumn ? Math.max(0, safeColumns.indexOf(groupByColumn)) : -1;

  return (
    <div className="space-y-3">
      {/* ─── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-muted)]">
          {totalRows !== undefined ? (
            <>
              Showing <span className="font-semibold text-[var(--text-heading)]">{results.length}</span> of{" "}
              <span className="font-semibold text-[var(--text-heading)]">{totalRows.toLocaleString()}</span> rows
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--text-heading)]">{results.length}</span> rows
            </>
          )}
          {isGrouped && (
            <span className="ml-2 text-[11px]">
              — grouped by <span className="font-medium text-[var(--text-heading)]">{groupByColumn}</span>
              {" "}({rowGroups.length} {rowGroups.length === 1 ? "group" : "groups"})
            </span>
          )}
          {!isGrouped && sort.column && sort.direction && (
            <span className="ml-2 text-[11px]">
              — sorted by <span className="font-medium text-[var(--text-heading)]">{sort.column}</span>{" "}
              {sort.direction === "asc" ? "ascending" : "descending"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Expand / Collapse All toggle — only in grouped mode */}
          {isGrouped && rowGroups.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllGroups}
              className="h-7 gap-1.5 text-[12px] text-[var(--text-muted)]"
            >
              <ChevronsUpDown className="w-3 h-3" />
              {allCollapsed ? "Expand all" : "Collapse all"}
            </Button>
          )}

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-[var(--text-muted)] px-2">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Table ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {safeColumns.map((col) => (
                <TableHead key={col}>
                  <button
                    type="button"
                    onClick={() => handleSort(col)}
                    className="flex items-center gap-1.5 hover:text-[var(--text-heading)] transition-colors cursor-pointer group"
                  >
                    <span>{col}</span>
                    {sort.column === col && sort.direction ? (
                      sort.direction === "asc" ? (
                        <ChevronUp className="w-3 h-3 text-[#1c2260]" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-[#1c2260]" />
                      )
                    ) : (
                      <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />
                    )}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isGrouped
              ? rowGroups.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.value);
                  return (
                    <GroupedRows
                      key={group.value}
                      group={group}
                      columns={safeColumns}
                      groupColIndex={groupColIndex}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleGroup(group.value)}
                    />
                  );
                })
              : sortedResults.map((row, i) => (
                  <TableRow key={i}>
                    {safeColumns.map((col) => (
                      <TableCell key={col}>
                        {formatCellValue(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Grouped Rows Sub-component ─────────────────────────────────
function GroupedRows({
  group,
  columns,
  groupColIndex,
  isCollapsed,
  onToggle,
}: {
  group: RowGroup;
  columns: string[];
  groupColIndex: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  // Compute subtotals for numeric columns within this group
  const subtotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of columns) {
      let sum = 0;
      let hasNumbers = false;
      for (const row of group.rows) {
        const val = row[col];
        if (typeof val === "number") {
          sum += val;
          hasNumbers = true;
        }
      }
      if (hasNumbers) {
        totals[col] = sum;
      }
    }
    return totals;
  }, [group.rows, columns]);

  const hasSubtotals = Object.keys(subtotals).length > 0;

  return (
    <>
      {/* ─── Group Header Row ─────────────────────────────── */}
      <TableRow
        className="bg-[#1c2260]/[0.04] hover:bg-[#1c2260]/[0.06] cursor-pointer select-none border-b-[var(--border)]"
        onClick={onToggle}
      >
        {columns.map((col, colIdx) => {
          if (colIdx === groupColIndex) {
            // This is the group-by column — show label + count + chevron
            return (
              <TableCell key={col} className="font-semibold text-[var(--text-heading)]">
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "w-3.5 h-3.5 text-[#1c2260] transition-transform duration-200 shrink-0",
                      !isCollapsed && "rotate-90"
                    )}
                  />
                  <span>{group.label}</span>
                  <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#1c2260]/10 text-[10px] font-bold text-[#1c2260] tabular-nums">
                    {group.rows.length}
                  </span>
                </div>
              </TableCell>
            );
          }
          // Other columns in header row — leave blank
          return (
            <TableCell key={col} className="text-[var(--text-muted)]/30 text-[11px]">
              {colIdx === 0 ? null : null}
            </TableCell>
          );
        })}
      </TableRow>

      {/* ─── Data Rows (hidden when collapsed) ────────────── */}
      {!isCollapsed &&
        group.rows.map((row, rowIdx) => (
          <TableRow key={`${group.value}-${rowIdx}`} className="group/row">
            {columns.map((col) => (
              <TableCell key={col}>{formatCellValue(row[col])}</TableCell>
            ))}
          </TableRow>
        ))}

      {/* ─── Group Subtotal Footer ────────────────────────── */}
      {!isCollapsed && hasSubtotals && group.rows.length > 1 && (
        <TableRow className="border-t-2 border-[var(--border)] bg-[var(--muted)]/50 font-medium text-[13px]">
          {columns.map((col, colIdx) => {
            if (colIdx === groupColIndex) {
              return (
                <TableCell key={col} className="text-[var(--text-muted)] text-[11px] italic">
                  Subtotal ({group.rows.length} rows)
                </TableCell>
              );
            }
            if (col in subtotals) {
              return (
                <TableCell key={col} className="text-[var(--text-heading)] tabular-nums">
                  {formatCellValue(subtotals[col])}
                </TableCell>
              );
            }
            return <TableCell key={col} />;
          })}
        </TableRow>
      )}
    </>
  );
}

// ─── Value Formatter ─────────────────────────────────────────────
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
