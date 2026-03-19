"use client";

import { Button } from "@/components/ui/button";
import { Download, UserPlus } from "lucide-react";
import Link from "next/link";

interface AffiliateTopbarProps {
  onExport?: () => void;
}

export function AffiliateTopbar({ onExport }: AffiliateTopbarProps) {
  return (
    <div className="flex items-center justify-between py-5 px-8 border-b border-[#e5e7eb] bg-white sticky top-0 z-40">
      <h1 className="text-[17px] font-bold text-[#333]">Affiliates</h1>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="h-8 px-3 text-[13px] font-semibold gap-1.5 border-[#e5e7eb]"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
        <Button
          size="sm"
          className="h-8 px-3 text-[13px] font-semibold gap-1.5 bg-[#10409a] hover:bg-[#1659d6]"
          asChild
        >
          <Link href="/affiliates/invite">
            <UserPlus className="h-3.5 w-3.5" />
            Invite Affiliate
          </Link>
        </Button>
      </div>
    </div>
  );
}
