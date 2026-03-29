"use client";

import { useState, useEffect } from "react";
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
import { ChevronLeft, ChevronRight, Inbox, ArrowUpDown } from "lucide-react";

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
  const displayColumns = columns.length > 0 ? columns : results && results.length > 0 ? Object.keys(results[0]) : [];

  const totalPages = totalRows ? Math.ceil(totalRows / pageSize) : 0;

  // Reset to page 0 when results change
  useEffect(() => {
    setPage(0);
  }, [results]);

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
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                    {col}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, i) => (
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
