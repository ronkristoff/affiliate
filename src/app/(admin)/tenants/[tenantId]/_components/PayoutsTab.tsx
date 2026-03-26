"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import {
  DataTable,
  type TableColumn,
  type TableAction,
  CurrencyCell,
  DateCell,
} from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PayoutBatch {
  _id: string;
  batchCode: string;
  affiliateCount: number;
  totalAmount: number;
  status: string;
  createdAt: number;
  completedAt?: number;
  stallDuration?: number;
}

interface PayoutsTabProps {
  tenantId: Id<"tenants">;
}

// ---------------------------------------------------------------------------
// Status config for payout batches
// ---------------------------------------------------------------------------

const batchStatusConfig: Record<
  string,
  { label: string; dotColor: string; bgClass: string; textClass: string }
> = {
  completed: { label: "Completed", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  processing: { label: "Processing", dotColor: "#3b82f6", bgClass: "bg-[#dbeafe]", textClass: "text-[#1e40af]" },
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[#fef3c7]", textClass: "text-[#92400e]" },
  failed: { label: "Failed", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayoutsTab({ tenantId }: PayoutsTabProps) {
  const batches = useQuery(api.admin.tenants.getTenantPayoutBatches, { tenantId });
  const isLoading = batches === undefined;

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: TableColumn<PayoutBatch>[] = useMemo(
    () => [
      {
        key: "batchCode",
        header: "Batch ID",
        sortable: true,
        sortField: "batchCode",
        cell: (row) => (
          <div>
            <span className="text-[13px] font-semibold text-[#333]">{row.batchCode}</span>
            {row.stallDuration !== undefined && (
              <div className="flex items-center gap-1 text-[10px] font-medium text-[#ef4444]">
                <AlertTriangle className="h-3 w-3" />
                Stalled: {row.stallDuration}h
              </div>
            )}
          </div>
        ),
      },
      {
        key: "affiliateCount",
        header: "Affiliates",
        sortable: true,
        sortField: "affiliateCount",
        align: "right",
        cell: (row) => (
          <span className="text-[12px] tabular-nums text-[#474747]">
            {row.affiliateCount}
          </span>
        ),
      },
      {
        key: "totalAmount",
        header: "Total Amount",
        sortable: true,
        sortField: "totalAmount",
        align: "right",
        cell: (row) => <CurrencyCell amount={row.totalAmount} />,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        sortField: "status",
        cell: (row) => {
          const config = batchStatusConfig[row.status] ?? batchStatusConfig.pending;
          return (
            <Badge
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                config.bgClass,
                config.textClass
              )}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: config.dotColor }}
              />
              {config.label}
            </Badge>
          );
        },
      },
      {
        key: "createdAt",
        header: "Created",
        sortable: true,
        sortField: "createdAt",
        cell: (row) => <DateCell value={row.createdAt * 1000} format="short" />,
      },
    ],
    []
  );

  // ── Row actions ──────────────────────────────────────────────────────────
  const actions: TableAction<PayoutBatch>[] = useMemo(
    () => [
      {
        label: "View",
        variant: "info",
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => {
          // TODO: Navigate to batch detail
        },
      },
    ],
    []
  );

  return (
    <DataTable<PayoutBatch>
      columns={columns}
      actions={actions}
      data={batches ?? []}
      getRowId={(row) => row._id}
      isLoading={isLoading}
      emptyMessage="No payout batches found."
      rowClassName={(row) =>
        row.stallDuration !== undefined ? "!bg-[#fef2f2] hover:!bg-[#fee2e2]" : ""
      }
    />
  );
}
