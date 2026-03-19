"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
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
      header: "Affiliate",
      sortable: true,
      sortField: "name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarCell name={row.name} email={row.email} size="sm" />
          <span className="text-xs text-muted-foreground">({row.uniqueCode})</span>
        </div>
      ),
    },
    {
      key: "clicks",
      header: "Clicks",
      sortable: true,
      align: "right",
      cell: (row) => <NumberCell value={row.clicks} />,
      width: 80,
    },
    {
      key: "conversions",
      header: "Conversions",
      sortable: true,
      align: "right",
      cell: (row) => <NumberCell value={row.conversions} />,
      width: 100,
    },
    {
      key: "conversionRate",
      header: "Conv. Rate",
      sortable: true,
      align: "right",
      cell: (row) => <NumberCell value={row.conversionRate} format="percent" />,
      width: 90,
    },
    {
      key: "commissions",
      header: "Commissions",
      sortable: true,
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

  return (
    <DataTable
      columns={columns}
      data={affiliates || []}
      getRowId={(row) => row._id}
      isLoading={isLoading}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={(field, order) => {
        setSortBy(field as typeof sortBy);
        setSortOrder(order);
      }}
      onRowClick={onAffiliateSelect ? (row) => onAffiliateSelect(row._id) : undefined}
      emptyMessage="No affiliates found for the selected period."
    />
  );
}
