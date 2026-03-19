"use client";

import { CheckCircle, XCircle, Loader2, X } from "lucide-react";

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

      <button
        onClick={onApproveAll}
        disabled={isProcessing}
        className="px-3 py-1.5 rounded-md text-[12px] font-bold bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
      >
        Approve All ({selectedCount})
      </button>

      <button
        onClick={onRejectAll}
        disabled={isProcessing}
        className="px-3 py-1.5 rounded-md text-[12px] font-bold bg-red-500/30 hover:bg-red-500/40 transition-colors disabled:opacity-50"
      >
        Reject All ({selectedCount})
      </button>

      <button
        onClick={onClearSelection}
        className="ml-auto text-[12px] opacity-70 hover:opacity-100 transition-opacity"
      >
        Clear selection ×
      </button>
    </div>
  );
}
