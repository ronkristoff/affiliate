"use client";

import { useState } from "react";
import {
  DataTable,
  AvatarCell,
  CurrencyCell,
  DateCell,
  StatusBadgeCell,
  type TableColumn,
} from "@/components/ui/DataTable";

interface Commission {
  _id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  campaignName: string;
  amount: number;
  status: string;
  createdAt: number;
  planContext?: string;
}

interface RecentCommissionsTableProps {
  commissions: Commission[];
  isLoading?: boolean;
}

const commissionStatusConfig: Record<
  string,
  { label: string; dotColor: string; bgClass: string; textClass: string }
> = {
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[#fef3c7]", textClass: "text-[#92400e]" },
  approved: { label: "Approved", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  reversed: { label: "Reversed", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  declined: { label: "Declined", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  paid: { label: "Paid", dotColor: "#6b7280", bgClass: "bg-[#f3f4f6]", textClass: "text-[#374151]" },
};

export function RecentCommissionsTable({
  commissions,
  isLoading = false,
}: RecentCommissionsTableProps) {
  const [sortBy, setSortBy] = useState<string>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">();

  // Client-side sort — DataTable skips sorting when onSortChange is provided
  const sortedData = (() => {
    if (!sortBy || !sortOrder) return commissions;
    const field = sortBy as keyof Commission;
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...commissions].sort((a, b) => {
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

  const columns: TableColumn<Commission>[] = [
    {
      key: "affiliate",
      header: "Affiliate",
      sortable: true,
      sortField: "affiliateName",
      cell: (row) => (
        <AvatarCell
          name={row.affiliateName}
          email={row.campaignName || row.affiliateEmail}
          size="sm"
        />
      ),
    },
    {
      key: "amount",
      header: "Commission",
      sortable: true,
      cell: (row) => <CurrencyCell amount={row.amount} />,
      width: 120,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortField: "status",
      cell: (row) => <StatusBadgeCell status={row.status} statusConfig={commissionStatusConfig} />,
      width: 100,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortField: "createdAt",
      cell: (row) => <DateCell value={row.createdAt} />,
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
        emptyMessage="No commissions yet"
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
