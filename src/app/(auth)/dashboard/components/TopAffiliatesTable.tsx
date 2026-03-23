"use client";

import { useState } from "react";
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
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">();

  // Client-side sort — DataTable skips sorting when onSortChange is provided
  const sortedData = (() => {
    if (!sortBy || !sortOrder) return affiliates;
    const field = sortBy as keyof Affiliate;
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...affiliates].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal)) * direction;
    });
  })();

  const columns: TableColumn<Affiliate>[] = [
    {
      key: "affiliate",
      header: "Affiliate",
      sortable: true,
      sortField: "name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarCell name={row.name} email={row.handle ? `@${row.handle}` : row.email} size="sm" />
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
      key: "revenue",
      header: "Revenue",
      sortable: true,
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
      sortable: true,
      sortField: "status",
      cell: (row) => <StatusBadgeCell status={row.status} />,
      width: 100,
    },
  ];

  return (
    <div className="card-body">
      <DataTable
        columns={columns}
        data={sortedData}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No affiliates yet"
        className="rounded-none border-0"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(field, order) => {
          setSortBy(field);
          setSortOrder(order);
        }}
      />
    </div>
  );
}
