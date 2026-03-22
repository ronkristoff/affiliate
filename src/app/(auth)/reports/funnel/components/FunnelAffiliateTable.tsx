"use client";

import { cn } from "@/lib/utils";
import {
  DataTable,
  AvatarCell,
  NumberCell,
  CurrencyCell,
  type TableColumn,
} from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/affiliate-segments";
import { Id } from "@/convex/_generated/dataModel";

interface FunnelAffiliateRow {
  affiliateId: Id<"affiliates">;
  name: string;
  clicks: number;
  conversions: number;
  commissions: number;
  funnelRate: number;
}

interface FunnelAffiliateTableProps {
  data: FunnelAffiliateRow[];
  canViewSensitiveData: boolean;
  isLoading: boolean;
}

const rankColors: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-700 border-yellow-200",
  1: "bg-gray-200 text-gray-700 border-gray-300",
  2: "bg-orange-100 text-orange-700 border-orange-200",
};

export function FunnelAffiliateTable({
  data,
  canViewSensitiveData,
  isLoading,
}: FunnelAffiliateTableProps) {
  // Sort by funnelRate descending for rank badges
  const ranked = [...data].sort((a, b) => b.funnelRate - a.funnelRate);

  const columns: TableColumn<FunnelAffiliateRow>[] = [
    {
      key: "rank",
      header: "#",
      cell: (row) => {
        const rank = ranked.findIndex((a) => a.affiliateId === row.affiliateId);
        if (rank < 3 && data.length > 3) {
          return (
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                rankColors[rank]
              )}
            >
              {rank + 1}
            </div>
          );
        }
        return (
          <span className="text-muted-foreground text-sm w-7 inline-block text-center">
            {rank + 1}
          </span>
        );
      },
      width: 48,
    },
    {
      key: "affiliate",
      header: "Affiliate",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarCell name={row.name} size="sm" />
        </div>
      ),
    },
    {
      key: "clicks",
      header: "Clicks",
      align: "right",
      cell: (row) => <NumberCell value={row.clicks} />,
      width: 80,
    },
    {
      key: "conversions",
      header: "Conversions",
      align: "right",
      cell: (row) => <NumberCell value={row.conversions} />,
      width: 100,
    },
    ...(canViewSensitiveData
      ? [
          {
            key: "commissions" as const,
            header: "Commissions",
            align: "right" as const,
            cell: (row: FunnelAffiliateRow) => <CurrencyCell amount={row.commissions} />,
            width: 120,
          },
        ]
      : []),
    {
      key: "funnelRate",
      header: "Funnel Rate",
      align: "right",
      cell: (row) => {
        const rate = row.funnelRate;
        return (
          <div className="flex items-center justify-end gap-2">
            <span className={cn(
              "text-sm font-semibold tabular-nums",
              rate >= 10 ? "text-emerald-600" : rate >= 5 ? "text-amber-600" : "text-[var(--text-muted)]"
            )}>
              {rate.toFixed(1)}%
            </span>
            {/* Mini bar indicator */}
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  rate >= 10 ? "bg-emerald-500" : rate >= 5 ? "bg-amber-500" : "bg-[var(--brand-primary)]/50"
                )}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>
        );
      },
      width: 140,
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-[var(--bg-surface)] p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-[var(--bg-surface)] p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--text-heading)]">
          Top Affiliates by Funnel Rate
        </h3>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {canViewSensitiveData
            ? "Affiliates ranked by click-to-commission conversion efficiency"
            : "Affiliates ranked by funnel performance. Commission data requires elevated access."}
        </p>
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.affiliateId}
        isLoading={false}
        emptyMessage="No affiliate funnel data for the selected period."
      />
    </div>
  );
}
