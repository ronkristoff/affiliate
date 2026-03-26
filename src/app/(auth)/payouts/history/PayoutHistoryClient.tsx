"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { CopyableId } from "@/components/shared/CopyableId";
import {
  DataTable,
  type TableColumn,
  type TableAction,
  DateCell,
  NumberCell,
  CurrencyCell,
} from "@/components/ui/DataTable";
import { FadeIn } from "@/components/ui/FadeIn";
import {
  Eye,
} from "lucide-react";
import {
  useQueryState,
  parseAsStringLiteral,
} from "nuqs";

// =============================================================================
// Types
// =============================================================================

interface Batch {
  _id: Id<"payoutBatches">;
  totalAmount: number;
  affiliateCount: number;
  status: string;
  generatedAt: number;
  completedAt?: number;
  batchCode: string;
}

// =============================================================================
// Column Config for Main Batches Table
// =============================================================================

const batchColumns: TableColumn<Batch>[] = [
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
    align: "right",
    cell: (row) => <NumberCell value={row.affiliateCount} />,
  },
  {
    key: "totalAmount",
    header: "Total Amount",
    align: "right",
    cell: (row) => <CurrencyCell amount={row.totalAmount} />,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <BatchStatusBadge status={row.status} />,
  },
];

// =============================================================================
// Main Component
// =============================================================================

export function PayoutHistoryClient() {
  const router = useRouter();

  // URL state via nuqs
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(["all", "processing", "completed"]).withDefault("all")
  );
  const [cursor, setCursor] = useState<string | null>(null);

  // Fetch batches with pagination
  const batchesResult = useQuery(api.payouts.getPayoutBatches, {
    paginationOpts: {
      numItems: 20,
      cursor,
    },
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
  });

  // Reset cursor when filter changes
  useEffect(() => {
    setCursor(null);
  }, [statusFilter]);

  const handleNextPage = () => {
    if (batchesResult && "continueCursor" in batchesResult && batchesResult.continueCursor) {
      setCursor(batchesResult.continueCursor);
    }
  };

  const handlePrevPage = () => {
    setCursor(null);
  };

  const isLoading = batchesResult === undefined;
  const hasError = batchesResult === null;

  const batches = batchesResult && "page" in batchesResult
    ? batchesResult.page
    : [];
  const isDone = batchesResult && "isDone" in batchesResult
    ? batchesResult.isDone
    : true;

  const batchActions: TableAction<Batch>[] = [
    {
      label: "View",
      variant: "info",
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: (batch) => router.push(`/payouts/batches/${batch._id}`),
    },
  ];

  if (hasError) {
    return (
      <div className="rounded-xl border border-dashed border-[#e5e7eb] p-12 text-center">
        <p className="text-[var(--text-muted)]">
          Failed to load payout history. Please try again.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Filter Tabs */}
      <FadeIn>
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as "all" | "processing" | "completed")}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </FadeIn>

      {/* Batches Table */}
      <FadeIn delay={100}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--text-heading)]">
                {statusFilter === "all"
                  ? "All Batches"
                  : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Batches`}
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                {batches.length} batch{batches.length !== 1 ? "es" : ""} shown
              </p>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={cursor === null}
                className="text-[12px] gap-1"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={isDone}
                className="text-[12px] gap-1"
              >
                Next
              </Button>
            </div>
          </div>

          <DataTable<Batch>
            columns={batchColumns}
            actions={batchActions}
            data={batches}
            getRowId={(row) => row._id}
            isLoading={isLoading}
            emptyMessage={
              statusFilter === "all"
                ? "No payout history yet"
                : `No ${statusFilter} batches found`
            }
          />
        </div>
      </FadeIn>
    </div>
  );
}
