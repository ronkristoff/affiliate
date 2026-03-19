"use client";

import { AlertCircle } from "lucide-react";

interface PendingBannerProps {
  count: number;
}

export function PendingBanner({ count }: PendingBannerProps) {
  if (count === 0) return null;

  return (
    <div className="bg-[#fef3c7] border border-[#fcd34d] rounded-lg px-4 py-3 flex items-center gap-2.5 text-[13px] text-[#92400e] mb-4">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <strong>{count} affiliates</strong> are waiting for your approval. Review
      their applications below.
    </div>
  );
}
