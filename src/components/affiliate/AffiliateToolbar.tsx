"use client";

import { Search } from "lucide-react";

interface AffiliateToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function AffiliateToolbar({
  searchQuery,
  onSearchChange,
}: AffiliateToolbarProps) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      {/* Search Input */}
      <div className="flex-1 min-w-[200px] max-w-sm">
        <div className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-lg px-3.5 py-2">
          <Search className="h-3.5 w-3.5 text-[#6b7280]" />
          <input
            type="text"
            placeholder="Search by name, email, or referral code"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 border-none outline-none text-[13px] text-[#474747] placeholder:text-[#6b7280] bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
