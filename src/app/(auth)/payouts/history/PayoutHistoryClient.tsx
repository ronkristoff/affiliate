"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import {
  formatCurrency,
  formatDate,
  getInitials,
} from "@/lib/format";
import {
  DataTable,
  type TableColumn,
  type TableAction,
  DateCell,
  NumberCell,
  CurrencyCell,
} from "@/components/ui/DataTable";
import {
  Eye,
  Download,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  generatePayoutCsv,
  downloadCsvFromString,
} from "@/lib/csv-utils";
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

interface Payout {
  payoutId: Id<"payouts">;
  affiliateId: Id<"affiliates">;
  name: string;
  email: string;
  amount: number;
  payoutMethod?: { type: string; details: string };
  status: string;
  commissionCount: number;
  paymentReference?: string;
  paidAt?: number;
}

// =============================================================================
// Column Config for Main Batches Table
// =============================================================================

const batchColumns: TableColumn<Batch>[] = [
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
// Batch Detail Dialog Component
// =============================================================================

interface BatchDetailDialogProps {
  batch: Batch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAllPaid: (batchId: Id<"payoutBatches">, paymentReference: string) => void;
  isMarkingAllPaid: boolean;
}

function BatchDetailDialog({
  batch,
  open,
  onOpenChange,
  onMarkAllPaid,
  isMarkingAllPaid,
}: BatchDetailDialogProps) {
  const [paymentReference, setPaymentReference] = useState("");
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  
  const payouts = useQuery(
    api.payouts.getBatchPayouts,
    batch ? { batchId: batch._id } : "skip"
  );
  
  const status = useQuery(
    api.payouts.getBatchPayoutStatus,
    batch ? { batchId: batch._id } : "skip"
  );

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setPaymentReference("");
      setShowMarkAllConfirm(false);
    }
  }, [open]);

  // CSV download handler
  const handleDownloadCsv = () => {
    if (!payouts || payouts.length === 0) return;
    
    const csvData = payouts.map((p) => ({
      name: p.name,
      email: p.email,
      payoutMethod: p.payoutMethod || null,
      commissionCount: p.commissionCount,
      amount: p.amount,
    }));
    
    const csv = generatePayoutCsv(csvData);
    downloadCsvFromString(csv, `${batch?.batchCode || "batch"}-payouts.csv`);
    toast.success("CSV downloaded successfully");
  };

  if (!batch) return null;

  const paidCount = status?.paid || 0;
  const totalCount = status?.total || 0;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
  const hasPending = paidCount < totalCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {batch.batchCode}
            </span>
            <BatchStatusBadge status={batch.status} />
          </DialogTitle>
          <DialogDescription>
            Generated on {formatDate(batch.generatedAt)} • {batch.affiliateCount} affiliates •{" "}
            {formatCurrency(batch.totalAmount)}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              Payment Progress: {paidCount} of {totalCount} paid
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={!payouts || payouts.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          {hasPending && !showMarkAllConfirm && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowMarkAllConfirm(true)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark All as Paid
            </Button>
          )}
        </div>

        {/* Mark All Confirmation */}
        {showMarkAllConfirm && (
          <Card className="mt-4 border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <p className="text-sm text-amber-800 mb-4">
                This will mark all {totalCount - paidCount} pending payouts as paid.
                Please enter a payment reference for the bulk transaction.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Payment Reference (e.g., Bank Transfer Ref #)"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="default"
                  onClick={() => {
                    if (!paymentReference.trim()) {
                      toast.error("Please enter a payment reference");
                      return;
                    }
                    onMarkAllPaid(batch._id, paymentReference);
                  }}
                  disabled={isMarkingAllPaid || !paymentReference.trim()}
                >
                  {isMarkingAllPaid ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowMarkAllConfirm(false)}
                  disabled={isMarkingAllPaid}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payouts Table */}
        <div className="mt-4 flex-1 overflow-auto">
          {payouts === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No payouts in this batch
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Payout Method</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Ref</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.payoutId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {getInitials(payout.name)}
                        </div>
                        <div>
                          <p className="font-medium">{payout.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {payout.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {payout.payoutMethod ? (
                        <div>
                          <p className="text-sm capitalize">{payout.payoutMethod.type}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {payout.payoutMethod.details}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Not configured
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {payout.commissionCount}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatCurrency(payout.amount)}
                    </TableCell>
                    <TableCell>
                      {payout.status === "paid" ? (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-700"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-700"
                        >
                          <Loader2 className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {payout.paymentReference ? (
                        <span className="font-mono text-xs">
                          {payout.paymentReference}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payout.paidAt ? (
                        <span className="text-sm">
                          {formatDate(payout.paidAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PayoutHistoryClient() {
  // URL state via nuqs
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(["all", "processing", "completed"]).withDefault("all")
  );
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [isMarkingAllPaid, setIsMarkingAllPaid] = useState(false);

  // Fetch batches with pagination
  const batchesResult = useQuery(api.payouts.getPayoutBatches, {
    paginationOpts: {
      numItems: 20,
      cursor,
    },
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
  });

  const markBatchAsPaid = useMutation(api.payouts.markBatchAsPaid);

  // Reset cursor when filter changes
  useEffect(() => {
    setCursor(null);
  }, [statusFilter]);

  const handleMarkAllPaid = async (
    batchId: Id<"payoutBatches">,
    paymentReference: string
  ) => {
    setIsMarkingAllPaid(true);
    try {
      const result = await markBatchAsPaid({
        batchId,
        paymentReference,
      });
      toast.success(
        `Marked ${result.payoutsMarked} payouts as paid`
      );
      setSelectedBatch(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to mark payouts as paid"
      );
    } finally {
      setIsMarkingAllPaid(false);
    }
  };

  const handleNextPage = () => {
    if (batchesResult && "continueCursor" in batchesResult && batchesResult.continueCursor) {
      setCursor(batchesResult.continueCursor);
    }
  };

  const handlePrevPage = () => {
    // For simplicity, we go back to the first page
    // In a more complex implementation, you'd maintain a cursor history
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
      variant: "outline",
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: (batch) => setSelectedBatch(batch),
    },
  ];

  if (hasError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Failed to load payout history. Please try again.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Filter Tabs */}
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

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {statusFilter === "all"
              ? "All Batches"
              : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Batches`
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-[12px] text-[#9ca3af]">
                {batches.length} batch{batches.length !== 1 ? "es" : ""} shown
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={cursor === null}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-[#e5e7eb] text-[12px] font-medium text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#374151] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={isDone}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-[#e5e7eb] text-[12px] font-medium text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#374151] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Batch Detail Dialog */}
      <BatchDetailDialog
        batch={selectedBatch}
        open={!!selectedBatch}
        onOpenChange={(open) => !open && setSelectedBatch(null)}
        onMarkAllPaid={handleMarkAllPaid}
        isMarkingAllPaid={isMarkingAllPaid}
      />
    </div>
  );
}
