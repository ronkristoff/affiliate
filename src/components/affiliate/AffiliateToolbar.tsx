"use client";

import { SearchField } from "@/components/ui/SearchField";

interface AffiliateToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function AffiliateToolbar({
  searchQuery,
  onSearchChange,
}: AffiliateToolbarProps) {
  return (
    <div className="mb-4">
      <SearchField
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search by name, email, or referral code"
      />
    </div>
  );
}
