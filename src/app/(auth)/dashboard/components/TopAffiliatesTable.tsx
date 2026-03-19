"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTable,
  AvatarCell,
  CurrencyCell,
  NumberCell,
  StatusBadgeCell,
  type TableColumn,
} from "@/components/ui/DataTable";
import { TrendingUp } from "lucide-react";

interface Affiliate {
  _id: string;
  name: string;
  email: string;
  handle?: string;
  clicks: number;
  conversions: number;
  revenue: number;
  status: string;
}

interface TopAffiliatesTableProps {
  affiliates: Affiliate[];
  isLoading?: boolean;
}

export function TopAffiliatesTable({
  affiliates,
  isLoading = false,
}: TopAffiliatesTableProps) {
  const columns: TableColumn<Affiliate>[] = [
    {
      key: "affiliate",
      header: "Affiliate",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarCell name={row.name} email={row.handle ? `@${row.handle}` : row.email} size="sm" />
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
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <CurrencyCell amount={row.revenue} />
        </div>
      ),
      width: 100,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadgeCell status={row.status} />,
      width: 100,
    },
  ];

  return (
    <div className="card-body">
      <DataTable
        columns={columns}
        data={affiliates}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No affiliates yet"
        className="rounded-none border-0"
      />
    </div>
  );
}
