"use client";

import { Skeleton } from "@/components/ui/skeleton";
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
  pendingCount?: number;
  showPayAllButton?: boolean;
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
      cell: (row) => <DateCell value={row.createdAt} />,
      width: 100,
    },
  ];

  if (isLoading) {
    return (
      <div className="card-body">
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]"
                  >
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-[#f3f4f6]">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[200px]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

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
