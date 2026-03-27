"use client";

import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  onClick: () => void;
  isExporting: boolean;
  label?: string;
  className?: string;
}

/**
 * Reusable Export CSV button with consistent loading state styling.
 */
export function ExportButton({
  onClick,
  isExporting,
  label = "Export CSV",
  className,
}: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isExporting}
      className={className}
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
