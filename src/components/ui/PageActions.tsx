"use client";

import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeSelector, type DateRangeChange } from "@/app/(auth)/dashboard/components/DateRangeSelector";

interface PageActionsProps {
  /** Current active preset value (e.g. "30d", "thisMonth", "custom") */
  dateRangeValue: string;
  /** Callback when user selects a new date range */
  onDateRangeChange: (change: DateRangeChange) => void;
  /** Callback when user clicks Export CSV */
  onExport: () => void;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Optional custom label for export button */
  exportLabel?: string;
  /** Optional additional className for the wrapper */
  className?: string;
}

/**
 * Reusable page actions component that combines a DateRangeSelector
 * and Export CSV button with consistent styling.
 */
export function PageActions({
  dateRangeValue,
  onDateRangeChange,
  onExport,
  isExporting,
  exportLabel = "Export CSV",
  className,
}: PageActionsProps) {
  return (
    <div className={className}>
      <DateRangeSelector value={dateRangeValue} onChange={onDateRangeChange} />
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        disabled={isExporting}
        className="gap-1.5"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-3 h-3" />
            {exportLabel}
          </>
        )}
      </Button>
    </div>
  );
}
