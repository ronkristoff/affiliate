"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DataTable,
  type TableColumn,
  DateCell,
  NumberCell,
  CurrencyCell,
} from "@/components/ui/DataTable";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { CopyableId } from "@/components/shared/CopyableId";
import { FadeIn } from "@/components/ui/FadeIn";
import type { PaginationState } from "@/components/ui/DataTablePagination";

interface Batch {
  _id: Id<"payoutBatches">;
  totalAmount: number;
  affiliateCount: number;
  status: string;
  generatedAt: number;
  completedAt?: number;
  batchCode: string;
}

interface PayoutBatchTableProps {
  tenantId: Id<"tenants">;
  canViewSensitiveData: boolean;
}

export function PayoutBatchTable({
  tenantId,
  canViewSensitiveData,
}: PayoutBatchTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
  });
  const [cursor, setCursor] = useState<string | null>(null);

  // Build pagination options for Convex cursor-based pagination
  const cursorForQuery: string | null = pagination.page <= 1 ? null : cursor;

  const paginationOpts = useMemo(
    () => ({
      numItems: pagination.pageSize,
      cursor: cursorForQuery,
    }),
    [pagination.pageSize, cursorForQuery]
  );

  const batchesResult = useQuery(
    api.payouts.getPayoutBatches,
    tenantId
      ? {
          paginationOpts,
        }
      : "skip"
  );

  // Sync cursor from Convex result when pages advance
  const prevCursorRef = useState(cursor);
  if (batchesResult?.continueCursor && batchesResult.continueCursor !== prevCursorRef[0]) {
    prevCursorRef[1](batchesResult.continueCursor);
    setCursor(batchesResult.continueCursor);
  }

  const columns: TableColumn<Batch>[] = useMemo(
    () => [
      {
        key: "_id",
        header: "ID",
        cell: (row) => <CopyableId id={row._id} />,
        width: 180,
      },
      {
        key: "batchCode",
        header: "Batch ID",
        cell: (row) => (
          <code className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {row.batchCode}
          </code>
        ),
      },
      {
        key: "generatedAt",
        header: "Date",
        cell: (row) => <DateCell value={row.generatedAt} format="short" />,
      },
      {
        key: "affiliateCount",
        header: "Affiliates",
        align: "right" as const,
        cell: (row) => <NumberCell value={row.affiliateCount} />,
      },
      {
        key: "totalAmount",
        header: "Total Amount",
        align: "right" as const,
        cell: (row) =>
          canViewSensitiveData ? (
            <CurrencyCell amount={row.totalAmount} />
          ) : (
            <span className="text-[12px] text-[#9ca3af]">—</span>
          ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <BatchStatusBadge status={row.status} />,
      },
    ],
    [canViewSensitiveData]
  );

  const handlePaginationChange = useCallback(
    (next: PaginationState) => {
      setPagination(next);
      if (next.page <= 1) {
        setCursor(null);
      }
    },
    []
  );

  return (
    <FadeIn delay={100}>
      <DataTable<Batch>
        columns={columns}
        data={batchesResult?.page ?? []}
        getRowId={(row) => row._id}
        isLoading={batchesResult === undefined}
        emptyMessage="No payout batches yet"
        pagination={pagination}
        total={batchesResult?.page?.length ?? 0}
        onPaginationChange={handlePaginationChange}
        hidePagination={batchesResult?.isDone ?? true}
      />
    </FadeIn>
  );
}
