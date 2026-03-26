"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { CopyableId } from "@/components/shared/CopyableId";
import {
  formatCurrency,
  formatDate,
} from "@/lib/format";
import {
  DataTable,
  type TableColumn,
  AvatarCell,
  CurrencyCell,
  DateCell,
  NumberCell,
} from "@/components/ui/DataTable";
import { FadeIn } from "@/components/ui/FadeIn";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  generatePayoutCsv,
  downloadCsvFromString,
} from "@/lib/csv-utils";

// =============================================================================
// Batch Detail Client — Full page view for a single payout batch
// =============================================================================

export function BatchDetailContent() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = params.batchId as Id<"payoutBatches">;

  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [isMarkingAllPaid, setIsMarkingAllPaid] = useState(false);

  // Single payout mark-as-paid dialog state
  const [markPaidDialogPayout, setMarkPaidDialogPayout] = useState<{
    payoutId: Id<"payouts">;
    affiliateName: string;
    amount: number;
  } | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [singlePaymentRef, setSinglePaymentRef] = useState("");

  // Queries
  const batch = useQuery(api.payouts.getPayoutBatchById, { batchId });
  const payouts = useQuery(api.payouts.getBatchPayouts, { batchId });
  const status = useQuery(api.payouts.getBatchPayoutStatus, { batchId });

  // Mutations
  const markBatchAsPaid = useMutation(api.payouts.markBatchAsPaid);
  const markPayoutAsPaid = useMutation(api.payouts.markPayoutAsPaid);

  // ── CSV download handler ──────────────────────────────────────────────
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

  // ── Mark All as Paid handler ──────────────────────────────────────────
  const handleMarkAllPaid = async () => {
    if (!paymentReference.trim()) {
      toast.error("Please enter a payment reference");
      return;
    }
    setIsMarkingAllPaid(true);
    try {
      const result = await markBatchAsPaid({
        batchId,
        paymentReference,
      });
      toast.success(
        `Marked ${result.payoutsMarked} payouts as paid`
      );
      setShowMarkAllConfirm(false);
      setPaymentReference("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to mark payouts as paid"
      );
    } finally {
      setIsMarkingAllPaid(false);
    }
  };

  // ── Mark Single Payout as Paid handler ────────────────────────────────
  const handleMarkSinglePaid = async () => {
    if (!markPaidDialogPayout) return;
    setIsMarkingPaid(true);
    try {
      await markPayoutAsPaid({
        payoutId: markPaidDialogPayout.payoutId,
        paymentReference: singlePaymentRef.trim() || undefined,
      });
      toast.success("Payout marked as paid", {
        description: `${markPaidDialogPayout.affiliateName} — ${formatCurrency(markPaidDialogPayout.amount)}`,
      });
      setMarkPaidDialogPayout(null);
      setSinglePaymentRef("");
    } catch (error) {
      toast.error("Failed to mark payout as paid", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────
  const paidCount = status?.paid || 0;
  const totalCount = status?.total || 0;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
  const hasPending = paidCount < totalCount;

  // ── Loading / error states ────────────────────────────────────────────
  if (batch === undefined || payouts === undefined || status === undefined) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-full max-w-md" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (batch === null) {
    return (
      <div className="rounded-xl border border-dashed border-[#e5e7eb] p-12 text-center">
        <p className="text-[var(--text-muted)]">
          Batch not found. It may have been deleted.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/payouts")}>
          Back to Payouts
        </Button>
      </div>
    );
  }

  // ── Table columns ─────────────────────────────────────────────────────
  const payoutColumns: TableColumn<any>[] = [
    {
      key: "payoutId",
      header: "Payout ID",
      cell: (row: any) => <CopyableId id={row.payoutId} />,
      width: 180,
    },
    {
      key: "affiliate",
      header: "Affiliate",
      cell: (row: any) => (
        <AvatarCell name={row.name} email={row.email} />
      ),
    },
    {
      key: "payoutMethod",
      header: "Payout Method",
      cell: (row: any) =>
        row.payoutMethod ? (
          <div>
            <p className="text-[12px] capitalize">{row.payoutMethod.type}</p>
            <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">
              {row.payoutMethod.details}
            </p>
          </div>
        ) : (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 font-normal text-amber-700 text-[12px]"
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Not configured
          </Badge>
        ),
    },
    {
      key: "commissions",
      header: "Commissions",
      align: "right",
      cell: (row: any) => <NumberCell value={row.commissionCount} />,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row: any) => <CurrencyCell amount={row.amount} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (row: any) => {
        // If the batch is completed, treat all payouts as paid regardless of
        // individual record state (guards against stale data inconsistency).
        const isPaid = batch.status === "completed" || row.status === "paid";
        return isPaid ? (
          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-[12px]">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[12px]">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      },
    },
    {
      key: "paymentReference",
      header: "Payment Ref",
      cell: (row: any) =>
        row.paymentReference ? (
          <span className="font-mono text-[11px]">{row.paymentReference}</span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: "paidAt",
      header: "Paid Date",
      cell: (row: any) =>
        row.paidAt ? (
          <DateCell value={row.paidAt} format="short" />
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      cell: (row: any) =>
        batch.status !== "completed" && row.status === "pending" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600 hover:text-green-700 hover:bg-green-50 text-[12px]"
            onClick={() =>
              setMarkPaidDialogPayout({
                payoutId: row.payoutId,
                affiliateName: row.name,
                amount: row.amount,
              })
            }
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Mark Paid
          </Button>
        ) : null,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[12px] text-[var(--text-muted)] -ml-2.5 mb-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-bold text-[var(--text-heading)]">
              Batch Details
            </h2>
            <code className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {batch.batchCode}
            </code>
            <BatchStatusBadge status={batch.status} />
          </div>
          <p className="text-[12px] text-[var(--text-muted)]">
            Generated on {formatDate(batch.generatedAt)} &middot; {batch.affiliateCount} affiliate{batch.affiliateCount !== 1 ? "s" : ""} &middot;{" "}
            {formatCurrency(batch.totalAmount)}
          </p>
        </div>
      </FadeIn>

      {/* Progress Bar */}
      <FadeIn delay={50}>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-[var(--text-muted)]">
              Payment Progress: {paidCount} of {totalCount} paid
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </FadeIn>

      {/* Actions */}
      <FadeIn delay={100}>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={!payouts || payouts.length === 0}
            className="text-[12px]"
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          {hasPending && batch.status !== "completed" && !showMarkAllConfirm && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowMarkAllConfirm(true)}
              className="text-[12px]"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark All as Paid
            </Button>
          )}
        </div>
      </FadeIn>

      {/* Mark All Confirmation */}
      {showMarkAllConfirm && (
        <FadeIn>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-2 mb-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-[13px] text-amber-800">
                This will mark all {totalCount - paidCount} pending payouts as paid.
                Please enter a payment reference for the bulk transaction.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Payment Reference (e.g., Bank Transfer Ref #)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="default"
                onClick={handleMarkAllPaid}
                disabled={isMarkingAllPaid || !paymentReference.trim()}
                className="text-[12px]"
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
                onClick={() => {
                  setShowMarkAllConfirm(false);
                  setPaymentReference("");
                }}
                disabled={isMarkingAllPaid}
                className="text-[12px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Payouts Table */}
      <FadeIn delay={150}>
        <div className="rounded-xl border bg-white">
          {payouts.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] py-12 text-[13px]">
              No payouts in this batch
            </p>
          ) : (
            <DataTable
              columns={payoutColumns}
              data={payouts}
              getRowId={(row: any) => row.payoutId}
              isLoading={false}
              emptyMessage="No payouts in this batch"
            />
          )}
        </div>
      </FadeIn>

      {/* Mark Single Payout as Paid Dialog */}
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
              <div className="rounded-lg bg-muted p-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Affiliate</span>
                  <span className="font-bold">{markPaidDialogPayout.affiliateName}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[var(--text-muted)]">Amount</span>
                  <span className="font-bold text-[var(--brand-primary)]">{formatCurrency(markPaidDialogPayout.amount)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  This marks the payout as paid. Ensure you&apos;ve transferred funds externally.
                  This action cannot be undone.
                </p>
              </div>

              <div>
                <label htmlFor="payment-ref-single" className="text-[12px] font-medium">Payment Reference (optional)</label>
                <Input
                  id="payment-ref-single"
                  placeholder="e.g., BPI Transfer #12345"
                  value={singlePaymentRef}
                  onChange={(e) => setSinglePaymentRef(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setMarkPaidDialogPayout(null)} className="text-[12px]">
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700 text-[12px]"
              disabled={isMarkingPaid}
              onClick={handleMarkSinglePaid}
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
    </div>
  );
}
