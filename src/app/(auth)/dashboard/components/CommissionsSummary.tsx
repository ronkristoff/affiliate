"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface CommissionBreakdownProps {
  approvedCount?: number;
  approvedValue?: number;
  pendingCount?: number;
  pendingValue?: number;
  declinedCount?: number;
  declinedValue?: number;
  totalPaidOut?: number;
  isLoading?: boolean;
}

export function CommissionBreakdown({
  approvedCount = 0,
  approvedValue = 0,
  pendingCount = 0,
  pendingValue = 0,
  declinedCount = 0,
  declinedValue = 0,
  totalPaidOut = 0,
  isLoading,
}: CommissionBreakdownProps) {
  const totalValue = approvedValue + pendingValue + declinedValue;
  const approvedPct = totalValue > 0 ? Math.round((approvedValue / totalValue) * 100) : 0;
  const pendingPct = totalValue > 0 ? Math.round((pendingValue / totalValue) * 100) : 0;
  const declinedPct = totalValue > 0 ? Math.round((declinedValue / totalValue) * 100) : 0;

  if (isLoading) {
    return (
      <Card className="border-[var(--border-light)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          <Skeleton className="h-2 w-full rounded-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border-light)] overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <CardTitle className="text-[14px] font-bold text-[var(--text-heading)]">Commission Breakdown</CardTitle>
          <Info className="w-4 h-4 text-[var(--text-muted)] cursor-help" />
        </div>
        <span className="text-[12px] font-medium text-[var(--text-muted)]">
          {formatCurrency(totalPaidOut)} paid out
        </span>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Approved */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--success-bg)] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-heading)]">Approved</p>
              <p className="text-[11px] text-[var(--text-muted)]">{approvedCount} commission{approvedCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">{formatCurrency(approvedValue)}</p>
            <p className="text-[11px] text-[var(--success)] font-medium">{approvedPct}%</p>
          </div>
        </div>

        {/* Pending */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--warning-bg)] flex items-center justify-center">
              <Clock className="w-4 h-4 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-heading)]">Pending</p>
              <p className="text-[11px] text-[var(--text-muted)]">{pendingCount} commission{pendingCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">{formatCurrency(pendingValue)}</p>
            <p className="text-[11px] text-[var(--warning)] font-medium">{pendingPct}%</p>
          </div>
        </div>

        {/* Declined */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--danger-bg)] flex items-center justify-center">
              <XCircle className="w-4 h-4 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-heading)]">Declined</p>
              <p className="text-[11px] text-[var(--text-muted)]">{declinedCount} commission{declinedCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">{formatCurrency(declinedValue)}</p>
            <p className="text-[11px] text-[var(--danger)] font-medium">{declinedPct}%</p>
          </div>
        </div>

        {/* Proportion bar */}
        {totalValue > 0 && (
          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--bg-page)] mt-2">
            {approvedPct > 0 && (
              <div className="bg-[var(--success)]" style={{ width: `${approvedPct}%` }} />
            )}
            {pendingPct > 0 && (
              <div className="bg-[var(--warning)]" style={{ width: `${pendingPct}%` }} />
            )}
            {declinedPct > 0 && (
              <div className="bg-[var(--danger)]" style={{ width: `${declinedPct}%` }} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
