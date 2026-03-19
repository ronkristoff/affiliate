"use client";

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

export function RecentCommissionsTable({
  commissions,
  isLoading = false,
}: RecentCommissionsTableProps) {
  const columns: TableColumn<Commission>[] = [
    {
      key: "affiliate",
      header: "Affiliate",
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
      cell: (row) => <StatusBadgeCell status={row.status} />,
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
        data={commissions}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No commissions yet"
        className="rounded-none border-0"
      />
    </div>
  );
}
