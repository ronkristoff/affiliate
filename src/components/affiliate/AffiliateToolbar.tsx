"use client";

import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/SearchField";
import { ExportButton } from "@/components/ui/ExportButton";
import { UserPlus } from "lucide-react";

interface AffiliateToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExport?: () => void;
  isExporting?: boolean;
  onInvite?: () => void;
}

export function AffiliateToolbar({
  searchQuery,
  onSearchChange,
  onExport,
  isExporting,
  onInvite,
}: AffiliateToolbarProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <SearchField
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search by name, email, or referral code"
        className="flex-1 min-w-0"
      />
      <div className="flex items-center gap-3 shrink-0">
        <ExportButton
          onClick={onExport ?? (() => {})}
          isExporting={!!isExporting}
        />
        <Button
          size="sm"
          onClick={onInvite}
          className="gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite Affiliate
        </Button>
      </div>
    </div>
  );
}
