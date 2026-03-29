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
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Inbox } from "lucide-react";

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
}

export function ResultsTable({
  results,
  columns,
  isLoading,
  totalRows,
  pageSize = 50,
}: ResultsTableProps) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });

  const displayColumns = columns.length > 0
    ? columns
    : results && results.length > 0
      ? Object.keys(results[0])
      : [];

  const totalPages = totalRows ? Math.ceil(totalRows / pageSize) : 0;

  // Reset to page 0 when results change
  useEffect(() => {
    setPage(0);
    setSort({ column: "", direction: null });
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

  return (
    <div className="space-y-3">
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
          {sort.column && sort.direction && (
            <span className="ml-2 text-[11px]">
              — sorted by <span className="font-medium text-[var(--text-heading)]">{sort.column}</span>{" "}
              {sort.direction === "asc" ? "ascending" : "descending"}
            </span>
          )}
        </div>
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
                        <ChevronUp className="w-3 h-3 text-[#10409a]" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-[#10409a]" />
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
            {sortedResults.map((row, i) => (
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
