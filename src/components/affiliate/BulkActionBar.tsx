"use client";

import { CheckCircle, XCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  onApproveAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onClearSelection: () => void;
  isProcessing: boolean;
}

export function BulkActionBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onClearSelection,
  isProcessing,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bg-[#10409a] text-white px-5 py-2.5 flex items-center gap-4 rounded-t-xl">
      <span className="text-[13px] font-semibold">
        {selectedCount} selected
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={onApproveAll}
        disabled={isProcessing}
        className="rounded-md text-[12px] font-bold bg-white/20 hover:bg-white/30 text-white"
      >
        Approve All ({selectedCount})
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRejectAll}
        disabled={isProcessing}
        className="rounded-md text-[12px] font-bold bg-red-500/30 hover:bg-red-500/40 text-white"
      >
        Reject All ({selectedCount})
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="ml-auto text-[12px] opacity-70 hover:opacity-100 text-white"
      >
        Clear selection ×
      </Button>
    </div>
  );
}
