"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, TrendingUp } from "lucide-react";

interface CommissionsSummaryProps {
  totalEarned?: number;
  isLoading?: boolean;
}

export function CommissionsSummary({ totalEarned, isLoading }: CommissionsSummaryProps) {
  if (isLoading) {
    return (
      <Card className="shadow-sm border-[var(--border-light)] overflow-hidden h-[200px]">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardHeader>
        <CardContent className="h-full flex flex-col items-center justify-center space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-[var(--border-light)] overflow-hidden transition-all duration-200 hover:shadow-md bg-white">
      <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <CardTitle className="text-[14px] font-bold text-[var(--text-heading)]">Commissions</CardTitle>
          <Info className="w-4 h-4 text-[var(--text-muted)] cursor-help" />
        </div>
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-page)]/50 px-2 py-0.5 rounded border border-[var(--border-light)] transition-colors group-hover:bg-[var(--bg-page)]">
          Last 6 Months
        </span>
      </CardHeader>
      <CardContent className="py-14 flex flex-col items-center justify-center space-y-3 relative group overflow-hidden">
        {/* Decorative breathing icon bg */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] scale-150 rotate-12 transition-transform duration-1000 group-hover:scale-[1.6]">
           <TrendingUp className="w-64 h-64 text-[var(--brand-primary)]" />
        </div>
        
        <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest relative z-10 transition-colors group-hover:text-[var(--text-heading)]">Total earned</p>
        <div className="flex items-baseline gap-1 relative z-10">
          <p className="text-[44px] font-black text-[var(--text-heading)] tabular-nums tracking-tight transition-transform duration-300 group-hover:scale-105">
            {formatCurrency(totalEarned ?? 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
