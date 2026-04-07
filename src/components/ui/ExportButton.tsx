"use client";

import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportButtonProps {
  onClick: () => void;
  isExporting: boolean;
  label?: string;
  className?: string;
  /** Additional disabled condition beyond the exporting state. */
  disabled?: boolean;
}

/**
 * Reusable Export CSV button with consistent loading state styling.
 */
export function ExportButton({
  onClick,
  isExporting,
  label = "Export CSV",
  className,
  disabled,
}: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isExporting || disabled}
      className={cn("text-[12px]", className)}
    >
      {isExporting ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-3 h-3" />
          {label}
        </>
      )}
    </Button>
  );
}
