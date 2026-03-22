"use client";

import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Download, UserPlus, Loader2 } from "lucide-react";

interface AffiliateTopbarProps {
  onExport?: () => void;
  isExporting?: boolean;
  onInvite?: () => void;
}

export function AffiliateTopbar({ onExport, isExporting, onInvite }: AffiliateTopbarProps) {
  return (
    <PageTopbar description="Manage your affiliate partners, track performance, and handle applications">
      <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Affiliates</h1>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={!onExport || isExporting}
          className="h-8 px-3 text-[13px] font-semibold gap-1.5"
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </Button>
        <Button
          size="sm"
          onClick={onInvite}
          className="h-8 px-3 text-[13px] font-semibold gap-1.5 bg-[#10409a] hover:bg-[#1659d6]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite Affiliate
        </Button>
      </div>
    </PageTopbar>
  );
}
