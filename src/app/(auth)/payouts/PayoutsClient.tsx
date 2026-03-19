"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  getInitials,
} from "@/lib/format";
import {
  CreditCard,
  Wallet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Eye,
  History,
  PackagePlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  generatePayoutCsv,
  downloadCsvFromString,
} from "@/lib/csv-utils";
import { PAYOUT_AUDIT_ACTIONS } from "@/convex/audit";

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
// Components
// =============================================================================

function PayoutHeroSkeleton() {
  return (
    <div className="rounded-2xl p-7 text-white" style={{ background: "linear-gradient(135deg, #10409a, #1659d6)" }}>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-4 w-24 bg-white/20" />
          <Skeleton className="mb-2 h-11 w-48 bg-white/20" />
          <Skeleton className="h-4 w-64 bg-white/20" />
        </div>
        <div className="flex items-end gap-8">
          <Skeleton className="h-14 w-24 bg-white/20" />
        </div>
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="mb-3 h-3 w-32" />
            <Skeleton className="mb-2 h-7 w-28" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          No Pending Payouts
        </h3>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          There are no affiliates with confirmed, unpaid commissions at this time.
          New payouts will appear here once commissions are confirmed.
        </p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PayoutsClient() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [csvDownloadBatchId, setCsvDownloadBatchId] = useState<string | null>(null);
  const [csvDownloadDate, setCsvDownloadDate] = useState<number | null>(null);
  const [generatedBatch, setGeneratedBatch] = useState<{
    batchId: string;
    batchCode: string;
    affiliateCount: number;
    totalAmount: number;
    generatedAt: number;
    affiliates: Array<{
      affiliateId: string;
      name: string;
      email: string;
      payoutMethod?: { type: string; details: string };
      pendingAmount: number;
      commissionCount: number;
    }>;
  } | null>(null);

  // Story 13.3: Batch detail dialog state
  const [selectedBatchId, setSelectedBatchId] = useState<Id<"payoutBatches"> | null>(null);
  const [markPaidDialogPayout, setMarkPaidDialogPayout] = useState<{
    payoutId: Id<"payouts">;
    affiliateName: string;
    amount: number;
  } | null>(null);
  const [markAllPaidBatch, setMarkAllPaidBatch] = useState<{
    batchId: Id<"payoutBatches">;
    batchCode: string;
    totalAmount: number;
    affiliateCount: number;
    pendingCount: number;
  } | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Queries
  const pendingTotal = useQuery(api.payouts.getPendingPayoutTotal, {});
  const affiliates = useQuery(api.payouts.getAffiliatesWithPendingPayouts, {});
  const batchesResult = useQuery(api.payouts.getPayoutBatches, {
    paginationOpts: { numItems: 10, cursor: null },
  });

  // Extract batches array from paginated result
  const batches: Batch[] = batchesResult && "page" in batchesResult ? batchesResult.page : [];

  // Mutation
  const generateBatch = useMutation(api.payouts.generatePayoutBatch);

  // Story 13.3: Batch detail queries and mutations
  const batchPayoutDetails = useQuery(
    api.payouts.getBatchPayouts,
    selectedBatchId ? { batchId: selectedBatchId } : "skip"
  );
  const batchPayoutStatus = useQuery(
    api.payouts.getBatchPayoutStatus,
    selectedBatchId ? { batchId: selectedBatchId } : "skip"
  );
  const markPayoutAsPaid = useMutation(api.payouts.markPayoutAsPaid);
  const markBatchAsPaid = useMutation(api.payouts.markBatchAsPaid);

  // CSV download: use state-driven query pattern for dynamic batchId
  const [csvDownloadError, setCsvDownloadError] = useState<string | null>(null);
  const batchPayoutsForCsv = useQuery(
    api.payouts.getBatchPayouts,
    csvDownloadBatchId
      ? { batchId: csvDownloadBatchId as Id<"payoutBatches"> }
      : "skip"
  );

  // Story 13.6: Payout Audit Log state and query
  const [auditPaginationCursor, setAuditPaginationCursor] = useState<string | undefined>(undefined);
  const [auditActionFilter, setAuditActionFilter] = useState<string | undefined>(undefined);
  
  const auditLogsResult = useQuery(api.audit.listPayoutAuditLogs, {
    paginationOpts: { numItems: 20, cursor: auditPaginationCursor ?? null },
    action: auditActionFilter ?? undefined,
  });

  // When batchPayoutsForCsv resolves, generate CSV and trigger download
  useEffect(() => {
    if (batchPayoutsForCsv !== undefined && csvDownloadBatchId !== null && csvDownloadDate !== null) {
      try {
        // AC#4: Empty batch warning
        if (batchPayoutsForCsv.length === 0) {
          toast.warning("No payout records", {
            description: "This batch has no payout records. The CSV contains headers only.",
          });
        }

        const dateStr = new Date(csvDownloadDate).toISOString().split("T")[0];
        const csv = generatePayoutCsv(batchPayoutsForCsv);
        downloadCsvFromString(csv, `payout-batch-${dateStr}`);

        // Reset download state
        setCsvDownloadBatchId(null);
        setCsvDownloadDate(null);
        setCsvDownloadError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to generate CSV";
        toast.error("CSV Download Failed", {
          description: errorMessage,
        });
        setCsvDownloadError(errorMessage);
        setCsvDownloadBatchId(null);
        setCsvDownloadDate(null);
      }
    }
  }, [batchPayoutsForCsv, csvDownloadBatchId, csvDownloadDate]);

  // Derive downloading state from query loading
  const isDownloadingCsv = csvDownloadBatchId !== null && batchPayoutsForCsv === undefined;

  // Derived data
  const isLoading = pendingTotal === undefined || affiliates === undefined;
  const hasPendingPayouts = (pendingTotal?.affiliateCount ?? 0) > 0;

  // Calculate batch metrics from historical batches
  const totalPaidOut = (batches ?? [])
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + b.totalAmount, 0);
  const completedBatchCount = (batches ?? []).filter(
    (b) => b.status === "completed"
  ).length;
  const processingBatches = (batches ?? []).filter(
    (b) => b.status === "processing" || b.status === "pending"
  );
  const processingTotal = processingBatches.reduce(
    (sum, b) => sum + b.totalAmount,
    0
  );

  // Handle batch generation
  async function handleGenerateBatch() {
    setIsGenerating(true);
    try {
      const result = await generateBatch({});
      setGeneratedBatch({
        batchId: result.batchId,
        batchCode: `BATCH-${result.batchId.slice(-8).toUpperCase()}`,
        affiliateCount: result.affiliateCount,
        totalAmount: result.totalAmount,
        generatedAt: Date.now(),
        affiliates: result.affiliates,
      });
      setShowConfirmDialog(false);
      toast.success("Payout batch generated successfully", {
        description: `Batch ${result.batchId.slice(-8).toUpperCase()} created with ${result.affiliateCount} affiliates`,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NO_PENDING_PAYOUTS") {
        toast.info("No pending payouts", {
          description: "There are no confirmed commissions awaiting payout.",
        });
      } else {
        toast.error("Failed to generate batch", {
          description:
            error instanceof Error ? error.message : "An unexpected error occurred",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }

  // Determine affiliates without payout method
  const affiliatesWithoutMethod = (affiliates ?? []).filter(
    (a) => !a.payoutMethod
  );

  // Story 13.3: Handle marking a single payout as paid
  async function handleMarkPayoutAsPaid() {
    if (!markPaidDialogPayout) return;
    setIsMarkingPaid(true);
    try {
      await markPayoutAsPaid({
        payoutId: markPaidDialogPayout.payoutId,
        paymentReference: paymentReference.trim() || undefined,
      });
      toast.success("Payout marked as paid", {
        description: `${markPaidDialogPayout.affiliateName} — ${formatCurrency(markPaidDialogPayout.amount)}`,
      });
      setMarkPaidDialogPayout(null);
      setPaymentReference("");
    } catch (error) {
      toast.error("Failed to mark payout as paid", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  }

  // Story 13.3: Handle marking all batch payouts as paid
  async function handleMarkBatchAsPaid() {
    if (!markAllPaidBatch) return;
    setIsMarkingPaid(true);
    try {
      const result = await markBatchAsPaid({
        batchId: markAllPaidBatch.batchId,
        paymentReference: paymentReference.trim() || undefined,
      });
      toast.success("All payouts marked as paid", {
        description: `${result.payoutsMarked} payout${result.payoutsMarked !== 1 ? "s" : ""} in ${markAllPaidBatch.batchCode}`,
      });
      setMarkAllPaidBatch(null);
      setSelectedBatchId(null);
      setPaymentReference("");
    } catch (error) {
      if (error instanceof Error && error.message === "NO_PENDING_PAYOUTS") {
        toast.info("No pending payouts", {
          description: "All payouts in this batch are already paid.",
        });
        setMarkAllPaidBatch(null);
      } else {
        toast.error("Failed to mark batch as paid", {
          description: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      }
    } finally {
      setIsMarkingPaid(false);
    }
  }

  // Reset payment reference when dialogs open to prevent stale values
  useEffect(() => {
    if (markPaidDialogPayout || markAllPaidBatch) {
      setPaymentReference("");
    }
  }, [markPaidDialogPayout, markAllPaidBatch]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      {isLoading ? (
        <PayoutHeroSkeleton />
      ) : (
        <div
          className="rounded-2xl p-7 text-white"
          style={{
            background: "linear-gradient(135deg, #10409a, #1659d6)",
          }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
                Ready to Pay
              </h2>
              <div className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                {formatCurrencyCompact(pendingTotal?.totalAmount ?? 0)}
              </div>
              <p className="mt-1 text-sm opacity-70">
                {hasPendingPayouts
                  ? `Confirmed commissions awaiting payout — ${pendingTotal?.affiliateCount} affiliate${(pendingTotal?.affiliateCount ?? 0) > 1 ? "s" : ""}`
                  : "No confirmed commissions awaiting payout"}
              </p>
            </div>

            <div className="flex flex-col items-end gap-4">
              <Button
                size="lg"
                disabled={!hasPendingPayouts || isGenerating}
                onClick={() => setShowConfirmDialog(true)}
                className="bg-white text-[#10409a] font-bold shadow-lg hover:bg-white/90"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Generate Batch
              </Button>

              <div className="flex gap-8">
                <div className="text-center">
                  <div className="text-xl font-bold tabular-nums">
                    {pendingTotal?.affiliateCount ?? 0}
                  </div>
                  <div className="text-xs opacity-65">Affiliates</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold tabular-nums">
                    {pendingTotal?.commissionCount ?? 0}
                  </div>
                  <div className="text-xs opacity-65">Commissions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      {isLoading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total Paid Out (All Time)
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatCurrency(totalPaidOut)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {completedBatchCount} payout batch
                {completedBatchCount !== 1 ? "es" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pending Batches
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatCurrency(pendingTotal?.totalAmount ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {processingBatches.length} batch
                {processingBatches.length !== 1 ? "es" : ""} awaiting processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Processing
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-blue-600">
                {formatCurrency(processingTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {processingBatches.filter((b) => b.status === "processing").length}{" "}
                batch{processingBatches.filter((b) => b.status === "processing").length !== 1 ? "es" : ""} in progress
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Affiliates Pending Payout Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : !hasPendingPayouts ? (
        <EmptyState />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">
              Affiliates Pending Payout
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {affiliates?.length ?? 0} affiliate{(affiliates?.length ?? 0) !== 1 ? "s" : ""} ·{" "}
                {formatCurrency(pendingTotal?.totalAmount ?? 0)} total
              </span>
              <Button
                size="sm"
                disabled={isGenerating}
                onClick={() => setShowConfirmDialog(true)}
              >
                {isGenerating ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <CreditCard className="mr-1 h-3 w-3" />
                )}
                Generate Batch
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Affiliate</TableHead>
                  <TableHead>Payout Method</TableHead>
                  <TableHead>Confirmed Commissions</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates?.map((affiliate) => (
                  <TableRow key={affiliate.affiliateId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#10409a]">
                          {getInitials(affiliate.name)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">
                            {affiliate.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {affiliate.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {affiliate.payoutMethod ? (
                        <Badge variant="outline" className="font-normal">
                          {affiliate.payoutMethod.type}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 font-normal text-amber-700"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Not configured
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {affiliate.commissionCount} commission
                      {affiliate.commissionCount !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatCurrency(affiliate.pendingAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Batch History */}
      {batches && batches.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Recent Batches</CardTitle>
            <Link href="/payouts/history">
              <Button variant="ghost" size="sm">
                <History className="mr-2 h-4 w-4" />
                View Full History
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Affiliates</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow
                    key={batch._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedBatchId(batch._id)}
                  >
                    <TableCell className="font-mono text-xs">
                      {batch.batchCode}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(batch.generatedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {batch.affiliateCount} affiliate
                      {batch.affiliateCount !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatCurrency(batch.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <BatchStatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Details"
                          onClick={() => setSelectedBatchId(batch._id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(batch.status === "pending" || batch.status === "processing") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isMarkingPaid}
                            title="Mark All as Paid"
                            onClick={() =>
                              setMarkAllPaidBatch({
                                batchId: batch._id,
                                batchCode: batch.batchCode,
                                totalAmount: batch.totalAmount,
                                affiliateCount: batch.affiliateCount,
                                pendingCount: batch.affiliateCount,
                              })
                            }
                          >
                            {isMarkingPaid && markAllPaidBatch?.batchId === batch._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDownloadingCsv}
                          onClick={() => {
                            setCsvDownloadBatchId(batch._id);
                            setCsvDownloadDate(batch.generatedAt);
                          }}
                          title="Download CSV"
                        >
                          {isDownloadingCsv && csvDownloadBatchId === batch._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* =============================================================================
           Story 13.6: Payout Audit Log Section (Stripe-style event timeline)
           ============================================================================= */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">Payout Audit Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Tabs - Using PAYOUT_AUDIT_ACTIONS constants */}
          <div className="flex items-center gap-2 border-b pb-3">
            <button
              onClick={() => setAuditActionFilter(undefined)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                auditActionFilter === undefined
                  ? "bg-[#10409a] text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAuditActionFilter(PAYOUT_AUDIT_ACTIONS.BATCH_GENERATED)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                auditActionFilter === PAYOUT_AUDIT_ACTIONS.BATCH_GENERATED
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <PackagePlus className="h-3 w-3" />
              Batch Generated
            </button>
            <button
              onClick={() => setAuditActionFilter(PAYOUT_AUDIT_ACTIONS.PAYOUT_MARKED_PAID)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                auditActionFilter === PAYOUT_AUDIT_ACTIONS.PAYOUT_MARKED_PAID
                  ? "bg-green-600 text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              Payout Paid
            </button>
            <button
              onClick={() => setAuditActionFilter(PAYOUT_AUDIT_ACTIONS.BATCH_MARKED_PAID)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                auditActionFilter === PAYOUT_AUDIT_ACTIONS.BATCH_MARKED_PAID
                  ? "bg-green-600 text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <CheckCheck className="h-3 w-3" />
              Batch Completed
            </button>
          </div>

          {/* Loading State */}
          {auditLogsResult === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : auditLogsResult.page.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 rounded-full bg-muted p-3">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No audit log entries yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Payout actions will appear here as they're performed
              </p>
            </div>
          ) : (
            /* Audit Log Entries */
            <div className="space-y-2">
              {auditLogsResult.page.map((log: any) => {
                // Get action display info - Using PAYOUT_AUDIT_ACTIONS constants
                type ActionConfig = {
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                  color: string;
                };
                const actionConfigs: Record<string, ActionConfig> = {
                  [PAYOUT_AUDIT_ACTIONS.BATCH_GENERATED]: {
                    label: "Batch Generated",
                    icon: PackagePlus,
                    color: "text-blue-600 bg-blue-50",
                  },
                  [PAYOUT_AUDIT_ACTIONS.PAYOUT_MARKED_PAID]: {
                    label: "Payout Paid",
                    icon: CheckCircle2,
                    color: "text-green-600 bg-green-50",
                  },
                  [PAYOUT_AUDIT_ACTIONS.BATCH_MARKED_PAID]: {
                    label: "Batch Completed",
                    icon: CheckCheck,
                    color: "text-green-600 bg-green-50",
                  },
                };
                const actionConfig = actionConfigs[log.action] ?? {
                  label: log.action,
                  icon: History,
                  color: "text-gray-600 bg-gray-50",
                };

                const ActionIcon = actionConfig.icon;

                return (
                  <div
                    key={log._id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className={`flex-shrink-0 rounded-full p-2 ${actionConfig.color}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {actionConfig.label}
                          </span>
                          {log.entityType === "payouts" && (
                            <Badge variant="outline" className="text-xs">
                              Single Payout
                            </Badge>
                          )}
                          {log.entityType === "payoutBatches" && (
                            <Badge variant="outline" className="text-xs">
                              Batch
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(log._creationTime)}
                        </span>
                      </div>
                      
                      {/* Actor Name - AC #3 requirement */}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {log.actorName ? (
                          <span>by <span className="font-medium text-foreground">{log.actorName}</span></span>
                        ) : log.actorId ? (
                          <span>by System</span>
                        ) : (
                          <span>by Unknown</span>
                        )}
                      </div>
                      
                      {/* Metadata Preview */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {log.metadata?.totalAmount !== undefined && (
                          <span className="font-medium text-foreground">
                            {formatCurrency(log.metadata.totalAmount)}
                          </span>
                        )}
                        {log.metadata?.amount !== undefined && (
                          <span className="font-medium text-foreground">
                            {formatCurrency(log.metadata.amount)}
                          </span>
                        )}
                        {log.metadata?.affiliateCount !== undefined && (
                          <span>{log.metadata.affiliateCount} affiliate{log.metadata.affiliateCount !== 1 ? "s" : ""}</span>
                        )}
                        {log.metadata?.payoutsMarked !== undefined && (
                          <span>{log.metadata.payoutsMarked} payout{log.metadata.payoutsMarked !== 1 ? "s" : ""}</span>
                        )}
                        {log.metadata?.paymentReference && (
                          <span className="font-mono">{log.metadata.paymentReference}</span>
                        )}
                        {log.metadata?.emailScheduled !== undefined && (
                          <span className={log.metadata.emailScheduled ? "text-green-600" : "text-amber-600"}>
                            {log.metadata.emailScheduled ? "Email sent" : "Email failed"}
                          </span>
                        )}
                      </div>

                      {/* Expandable Details */}
                      <details className="mt-2 group">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View details
                        </summary>
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(log.metadata || {}, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPaginationCursor === undefined}
                  onClick={() => setAuditPaginationCursor(undefined)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Newest
                </Button>
                <span className="text-xs text-muted-foreground">
                  {auditLogsResult.page.length} entries
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditLogsResult.isDone}
                  onClick={() => setAuditPaginationCursor(auditLogsResult.continueCursor ?? undefined)}
                >
                  Older
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Generated Success Dialog */}
      <Dialog open={!!generatedBatch} onOpenChange={(open) => !open && setGeneratedBatch(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center">Batch Generated</DialogTitle>
            <DialogDescription className="text-center">
              Payout batch created successfully
            </DialogDescription>
          </DialogHeader>

          {generatedBatch && (
            <div className="space-y-4">
              {/* Batch Info */}
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Batch ID
                    </p>
                    <p className="font-mono text-sm font-bold">
                      {generatedBatch.batchCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground">
                      Total Amount
                    </p>
                    <p className="text-xl font-bold text-[#10409a]">
                      {formatCurrency(generatedBatch.totalAmount)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {generatedBatch.affiliateCount} affiliate
                    {generatedBatch.affiliateCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(generatedBatch.generatedAt)}
                  </span>
                </div>
              </div>

              {/* Affiliate Summary */}
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {generatedBatch.affiliates.map((affiliate) => (
                  <div
                    key={affiliate.affiliateId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#10409a]">
                        {getInitials(affiliate.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{affiliate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {affiliate.commissionCount} commission
                          {affiliate.commissionCount !== 1 ? "s" : ""}{" "}
                          {affiliate.payoutMethod
                            ? `· ${affiliate.payoutMethod.type}`
                            : "· No payout method"}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold tabular-nums">
                      {formatCurrency(affiliate.pendingAmount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isDownloadingCsv}
              onClick={() => {
                if (generatedBatch) {
                  setCsvDownloadBatchId(generatedBatch.batchId);
                  setCsvDownloadDate(generatedBatch.generatedAt);
                }
              }}
            >
              {isDownloadingCsv ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download CSV
            </Button>
            <Button onClick={() => setGeneratedBatch(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Payout Batch</DialogTitle>
            <DialogDescription>
              Create a payout batch for all affiliates with confirmed, unpaid
              commissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Affiliates</span>
                <span className="font-bold">
                  {pendingTotal?.affiliateCount ?? 0}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-bold text-[#10409a]">
                  {formatCurrency(pendingTotal?.totalAmount ?? 0)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Commissions</span>
                <span className="font-bold">
                  {pendingTotal?.commissionCount ?? 0}
                </span>
              </div>
            </div>

            {affiliatesWithoutMethod.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  <strong>{affiliatesWithoutMethod.length}</strong> affiliate
                  {affiliatesWithoutMethod.length !== 1 ? "s" : ""} do
                  {affiliatesWithoutMethod.length === 1 ? "es" : ""} not have a
                  payout method configured. They will still be included in the
                  batch.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isGenerating}
              onClick={handleGenerateBatch}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Generate Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Story 13.3: Batch Detail Dialog (AC#5) */}
      <Dialog open={!!selectedBatchId} onOpenChange={(open) => !open && setSelectedBatchId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Batch Payout Details</DialogTitle>
            <DialogDescription>
              Individual payouts for this batch
            </DialogDescription>
          </DialogHeader>

          {batchPayoutStatus && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <BatchStatusBadge status={batchPayoutStatus.batchStatus} />
              </div>
              <div className="text-sm text-muted-foreground">
                {batchPayoutStatus.paid} of {batchPayoutStatus.total} paid
              </div>
              {/* Progress bar */}
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${batchPayoutStatus.total > 0 ? (batchPayoutStatus.paid / batchPayoutStatus.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {batchPayoutDetails === undefined ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : batchPayoutDetails.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No payout records found for this batch.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Payout Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchPayoutDetails.map((payout) => (
                    <TableRow key={payout.payoutId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#10409a]">
                            {getInitials(payout.name)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{payout.name}</div>
                            <div className="text-xs text-muted-foreground">{payout.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payout.payoutMethod ? (
                          <Badge variant="outline" className="font-normal">
                            {payout.payoutMethod.type}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 font-normal text-amber-700">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Not set
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatCurrency(payout.amount)}
                      </TableCell>
                      <TableCell>
                        {payout.status === "paid" ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payout.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() =>
                              setMarkPaidDialogPayout({
                                payoutId: payout.payoutId,
                                affiliateName: payout.name,
                                amount: payout.amount,
                              })
                            }
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {batchPayoutStatus && batchPayoutStatus.pending > 0 && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedBatchId(null)}>
                Close
              </Button>
              <Button
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={isMarkingPaid}
                onClick={() => {
                  const batch = batches?.find((b: Batch) => b._id === selectedBatchId);
                  if (batch) {
                    setMarkAllPaidBatch({
                      batchId: batch._id,
                      batchCode: batch.batchCode,
                      totalAmount: batch.totalAmount,
                      affiliateCount: batch.affiliateCount,
                      pendingCount: batchPayoutStatus.pending,
                    });
                  }
                }}
              >
                {isMarkingPaid ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Mark All as Paid ({batchPayoutStatus.pending})
              </Button>
            </DialogFooter>
          )}

          {batchPayoutStatus && batchPayoutStatus.pending === 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedBatchId(null)}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* =============================================================================
           Story 13.3: Mark Single Payout as Paid Confirmation Dialog (AC#4)
           ============================================================================= */}
      <Dialog open={!!markPaidDialogPayout} onOpenChange={(open) => !open && setMarkPaidDialogPayout(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Confirm you have transferred funds to this affiliate.
            </DialogDescription>
          </DialogHeader>

          {markPaidDialogPayout && (
            <div className="space-y-4">
              {/* Affiliate Info */}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Affiliate</span>
                  <span className="font-bold">{markPaidDialogPayout.affiliateName}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-[#10409a]">{formatCurrency(markPaidDialogPayout.amount)}</span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  This marks the payout as paid. Ensure you've transferred funds externally.
                  This action cannot be undone.
                </p>
              </div>

              {/* Payment Reference */}
              <div>
                <label htmlFor="payment-ref-single" className="text-sm font-medium">Payment Reference (optional)</label>
                <Input
                  id="payment-ref-single"
                  placeholder="e.g., BPI Transfer #12345"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setMarkPaidDialogPayout(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={isMarkingPaid}
              onClick={handleMarkPayoutAsPaid}
            >
              {isMarkingPaid ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============================================================================
           Story 13.3: Mark All Batch Payouts as Paid Confirmation Dialog (AC#4)
           ============================================================================= */}
      <Dialog open={!!markAllPaidBatch} onOpenChange={(open) => !open && setMarkAllPaidBatch(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark All as Paid</DialogTitle>
            <DialogDescription>
              Confirm you have transferred funds to all affiliates in this batch.
            </DialogDescription>
          </DialogHeader>

          {markAllPaidBatch && (
            <div className="space-y-4">
              {/* Batch Summary */}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Batch</span>
                  <span className="font-bold font-mono">{markAllPaidBatch.batchCode}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Affiliates</span>
                  <span className="font-bold">{markAllPaidBatch.affiliateCount}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-bold text-[#10409a]">{formatCurrency(markAllPaidBatch.totalAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Pending Payouts</span>
                  <span className="font-bold">{markAllPaidBatch.pendingCount}</span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  This marks <strong>all payouts</strong> in this batch as paid. Ensure you've
                  transferred funds externally. This action cannot be undone.
                </p>
              </div>

              {/* Payment Reference */}
              <div>
                <label htmlFor="payment-ref-batch" className="text-sm font-medium">Payment Reference (optional)</label>
                <Input
                  id="payment-ref-batch"
                  placeholder="e.g., BPI Batch Transfer #12345"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setMarkAllPaidBatch(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={isMarkingPaid}
              onClick={handleMarkBatchAsPaid}
            >
              {isMarkingPaid ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Mark All as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


