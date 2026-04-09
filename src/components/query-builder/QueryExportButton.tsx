"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { escapeCsvField, downloadCsvFromString } from "@/lib/csv-utils";

interface QueryExportButtonProps {
  hasResults: boolean;
  columns: Array<{ table: string; column: string; alias?: string }>;
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  tenantId: string;
}

export function QueryExportButton({
  hasResults,
  columns,
  rows,
  totalRows,
  tenantId,
}: QueryExportButtonProps) {
  const exportAction = useAction(api.queryBuilderExport.exportQueryBuilderCSV);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!hasResults || rows.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);
    try {
      if (totalRows <= 5000) {
        const headers = columns.map((col) => col.alias || `${col.table}.${col.column}`);
        const csvRows = rows.map((row) =>
          columns.map((col) => {
            const key = col.alias || `${col.table}.${col.column}`;
            const value = row[key];
            if (value === null || value === undefined) return "";
            if (typeof value === "number") return value.toFixed(2);
            return escapeCsvField(String(value));
          })
        );

        const csvContent =
          "\uFEFF" +
          headers.join(",") +
          "\n" +
          csvRows.map((row) => row.join(",")).join("\n");

        const date = new Date().toISOString().split("T")[0];
        downloadCsvFromString(csvContent, `query-export-${date}`);
        toast.success(`Exported ${rows.length} rows`);
      } else {
        const result = await exportAction({
          tenantId: tenantId as Id<"tenants">,
          columns,
          rows,
        });

        if (result.csvBase64) {
          const csvContent = atob(result.csvBase64);
          const date = new Date().toISOString().split("T")[0];
          downloadCsvFromString(csvContent, `query-export-${date}`);
          toast.success(`Exported ${result.totalRows} rows`);
        } else if (result.storageFileId) {
          toast.success(`Export ready (${result.totalRows} rows). Download will start shortly.`);
        }
      }
    } catch {
      toast.error("Failed to export query results");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting || !hasResults || rows.length === 0}
      className="gap-1.5"
    >
      {isExporting ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Download className="w-3 h-3" />
      )}
      Export CSV
    </Button>
  );
}
