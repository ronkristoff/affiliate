"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DataTable,
  AvatarCell,
  NumberCell,
  CurrencyCell,
  StatusBadgeCell,
  type TableColumn,
} from "@/components/ui/DataTable";
import {
  useQueryState,
  parseAsStringLiteral,
} from "nuqs";

interface AffiliatePerformance {
  _id: Id<"affiliates">;
  name: string;
  email: string;
  uniqueCode: string;
  status: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalCommissions: number;
}

interface AffiliatePerformanceTableProps {
  tenantId: Id<"tenants">;
  dateRange?: { start: number; end: number };
  campaignId?: Id<"campaigns">;
  onAffiliateSelect?: (affiliateId: Id<"affiliates">) => void;
  canViewSensitiveData: boolean;
}

const rankColors: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-700 border-yellow-200",
  1: "bg-gray-200 text-gray-700 border-gray-300",
  2: "bg-orange-100 text-orange-700 border-orange-200",
};

export function AffiliatePerformanceTable({
  tenantId,
  dateRange,
  campaignId,
  onAffiliateSelect,
  canViewSensitiveData,
}: AffiliatePerformanceTableProps) {
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsStringLiteral(["clicks", "conversions", "conversionRate", "commissions", "name"] as const).withDefault("name")
  );
  const [sortOrder, setSortOrder] = useQueryState(
    "order",
    parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc")
  );

  const affiliates = useQuery(
    api.reports.getAffiliatePerformanceList,
    {
      tenantId,
      dateRange,
      campaignId,
      sortBy,
      sortOrder,
    }
  );

  const isLoading = affiliates === undefined;

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column as typeof sortBy);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  // Sort by commissions descending to identify top performers
  const sortedByCommissions = [...(affiliates || [])].sort(
    (a, b) => b.totalCommissions - a.totalCommissions
  );

  const columns: TableColumn<AffiliatePerformance>[] = [
    {
      key: "rank",
      header: "Rank",
      cell: (row) => {
        const rank = sortedByCommissions.findIndex((a) => a._id === row._id);
        if (rank < 3) {
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
      width: 60,
    },
    {
      key: "affiliate",
      header: (
        <button
          onClick={() => handleSort("name")}
          className="flex items-center hover:text-[#10409a]"
        >
          Affiliate {getSortIcon("name")}
        </button>
      ),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarCell name={row.name} email={row.email} size="sm" />
          <span className="text-xs text-muted-foreground">({row.uniqueCode})</span>
        </div>
      ),
    },
    {
      key: "clicks",
      header: (
        <button
          onClick={() => handleSort("clicks")}
          className="flex items-center justify-end hover:text-[#10409a] w-full"
        >
          Clicks {getSortIcon("clicks")}
        </button>
      ),
      align: "right",
      cell: (row) => <NumberCell value={row.clicks} />,
      width: 80,
    },
    {
      key: "conversions",
      header: (
        <button
          onClick={() => handleSort("conversions")}
          className="flex items-center justify-end hover:text-[#10409a] w-full"
        >
          Conversions {getSortIcon("conversions")}
        </button>
      ),
      align: "right",
      cell: (row) => <NumberCell value={row.conversions} />,
      width: 100,
    },
    {
      key: "conversionRate",
      header: (
        <button
          onClick={() => handleSort("conversionRate")}
          className="flex items-center justify-end hover:text-[#10409a] w-full"
        >
          Conv. Rate {getSortIcon("conversionRate")}
        </button>
      ),
      align: "right",
      cell: (row) => <NumberCell value={row.conversionRate} format="percent" />,
      width: 90,
    },
    {
      key: "commissions",
      header: (
        <button
          onClick={() => handleSort("commissions")}
          className="flex items-center justify-end hover:text-[#10409a] w-full"
        >
          Commissions {getSortIcon("commissions")}
        </button>
      ),
      align: "right",
      cell: (row) =>
        canViewSensitiveData ? (
          <CurrencyCell amount={row.totalCommissions} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: 110,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadgeCell status={row.status} />,
      width: 100,
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white">
        <div className="p-4">
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={affiliates || []}
      getRowId={(row) => row._id}
      onRowClick={onAffiliateSelect ? (row) => onAffiliateSelect(row._id) : undefined}
      emptyMessage="No affiliates found for the selected period."
    />
  );
}
