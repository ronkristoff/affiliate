"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onApproveAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  isProcessing: boolean;
}

export function BulkActionBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  isProcessing,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-4 rounded-full border bg-background px-6 py-3 shadow-lg">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        
        <div className="h-4 w-px bg-border" />
        
        <Button
          size="sm"
          variant="default"
          onClick={onApproveAll}
          disabled={isProcessing}
          className="h-8 gap-1.5"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Approve All ({selectedCount})
        </Button>
        
        <Button
          size="sm"
          variant="destructive"
          onClick={onRejectAll}
          disabled={isProcessing}
          className="h-8 gap-1.5"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Reject All ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
