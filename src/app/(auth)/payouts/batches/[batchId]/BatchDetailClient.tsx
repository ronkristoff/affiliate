"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { CopyableId } from "@/components/shared/CopyableId";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import {
  DataTable,
  type TableColumn,
  type ColumnFilter,
  AvatarCell,
  CurrencyCell,
  DateCell,
  NumberCell,
  getAvatarColor,
  getInitials,
} from "@/components/ui/DataTable";
import {
  type PaginationState,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/DataTablePagination";
import { FilterChips } from "@/components/ui/FilterChips";
import { FadeIn } from "@/components/ui/FadeIn";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Wallet,
  User,
  FileText,
  CreditCard,
  CalendarClock,
  Hash,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  generatePayoutCsv,
  downloadCsvFromString,
} from "@/lib/csv-utils";

// =============================================================================
// Types
// =============================================================================

interface BatchPayout {
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

  // Payout detail sheet state
  const [detailPayout, setDetailPayout] = useState<BatchPayout | null>(null);
  const [showCommissions, setShowCommissions] = useState(false);

  // ── Sort state ────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ── Filter state ──────────────────────────────────────────────────────
  const [filters, setFilters] = useState<ColumnFilter[]>([]);

  // ── Pagination state ──────────────────────────────────────────────────
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Queries
  const batch = useQuery(api.payouts.getPayoutBatchById, { batchId });
  const payouts = useQuery(api.payouts.getBatchPayouts, { batchId });
  const status = useQuery(api.payouts.getBatchPayoutStatus, { batchId });

  // Commissions for the detail sheet (fetched only when sheet is open)
  const detailCommissions = useQuery(
    api.payouts.getBatchCommissionsForAffiliate,
    detailPayout
      ? { batchId, affiliateId: detailPayout.affiliateId }
      : "skip"
  );

  // Mutations
  const markBatchAsPaid = useMutation(api.payouts.markBatchAsPaid);
  const markPayoutAsPaid = useMutation(api.payouts.markPayoutAsPaid);

  // ── Filter / sort change handlers (reset page to 1) ──────────────────
  const handleFilterChange = (newFilters: ColumnFilter[]) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleRemoveFilter = (columnKey: string) => {
    handleFilterChange(filters.filter((f) => f.columnKey !== columnKey));
  };

  const handleClearAllFilters = () => {
    handleFilterChange([]);
  };

  const handleSortChange = (newSortBy: string, newSortOrder: "asc" | "desc") => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // ── Filtered data ─────────────────────────────────────────────────────
  const filteredPayouts = useMemo(() => {
    let data = payouts ?? [];
    for (const filter of filters) {
      switch (filter.columnKey) {
        case "affiliate": {
          const search = (filter.value ?? "").toLowerCase();
          if (search) {
            data = data.filter(
              (p) =>
                p.name.toLowerCase().includes(search) ||
                (p.email && p.email.toLowerCase().includes(search))
            );
          }
          break;
        }
        case "payoutMethod": {
          const values = filter.values ?? [];
          if (values.length > 0) {
            if (values.includes("not_configured")) {
              if (!values.includes("configured")) {
                data = data.filter((p) => !p.payoutMethod);
              }
              // Both selected → show all
            } else {
              data = data.filter((p) => !!p.payoutMethod);
            }
          }
          break;
        }
        case "commissions": {
          if (filter.min != null) data = data.filter((p) => p.commissionCount >= filter.min!);
          if (filter.max != null) data = data.filter((p) => p.commissionCount <= filter.max!);
          break;
        }
        case "amount": {
          if (filter.min != null) data = data.filter((p) => p.amount >= filter.min!);
          if (filter.max != null) data = data.filter((p) => p.amount <= filter.max!);
          break;
        }
        case "status": {
          const values = filter.values ?? [];
          if (values.length > 0) {
            data = data.filter((p) => values.includes(p.status));
          }
          break;
        }
        case "paymentReference": {
          const search = (filter.value ?? "").toLowerCase();
          if (search) {
            data = data.filter(
              (p) => p.paymentReference && p.paymentReference.toLowerCase().includes(search)
            );
          }
          break;
        }
        case "paidAt": {
          if (filter.after != null) data = data.filter((p) => p.paidAt != null && p.paidAt >= filter.after!);
          if (filter.before != null) data = data.filter((p) => p.paidAt != null && p.paidAt <= filter.before!);
          break;
        }
      }
    }
    return data;
  }, [payouts, filters]);

  // ── Sorted data ───────────────────────────────────────────────────────
  const sortedPayouts = useMemo(() => {
    if (!sortBy) return filteredPayouts;
    const dir = sortOrder === "asc" ? 1 : -1;

    // Map column keys to actual data fields
    const fieldMap: Record<string, keyof BatchPayout> = {
      affiliate: "name",
      commissions: "commissionCount",
      amount: "amount",
      status: "status",
      paidAt: "paidAt",
    };

    const field = fieldMap[sortBy] || (sortBy as keyof BatchPayout);
    return [...filteredPayouts].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [filteredPayouts, sortBy, sortOrder]);

  // ── Paginated data ────────────────────────────────────────────────────
  const payoutsTotal = sortedPayouts.length;
  const paginatedPayouts = useMemo(
    () =>
      sortedPayouts.slice(
        (pagination.page - 1) * pagination.pageSize,
        pagination.page * pagination.pageSize
      ),
    [sortedPayouts, pagination]
  );

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
  const payoutColumns: TableColumn<BatchPayout>[] = [
    {
      key: "payoutId",
      header: "Payout ID",
      cell: (row: BatchPayout) => <CopyableId id={row.payoutId} />,
      width: 180,
    },
    {
      key: "affiliate",
      header: "Affiliate",
      cell: (row: BatchPayout) => (
        <AvatarCell name={row.name} email={row.email} />
      ),
      sortable: true,
      filterable: true,
      filterType: "text" as const,
    },
    {
      key: "payoutMethod",
      header: "Payout Method",
      cell: (row: BatchPayout) =>
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
      filterable: true,
      filterType: "select" as const,
      filterOptions: [
        { value: "configured", label: "Configured" },
        { value: "not_configured", label: "Not configured" },
      ],
    },
    {
      key: "commissions",
      header: "Commissions",
      align: "right",
      cell: (row: BatchPayout) => <NumberCell value={row.commissionCount} />,
      sortable: true,
      filterable: true,
      filterType: "number-range" as const,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row: BatchPayout) => <CurrencyCell amount={row.amount} />,
      sortable: true,
      filterable: true,
      filterType: "number-range" as const,
      filterStep: 0.01,
    },
    {
      key: "status",
      header: "Status",
      cell: (row: BatchPayout) => {
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
      sortable: true,
      filterable: true,
      filterType: "select" as const,
      filterOptions: [
        { value: "pending", label: "Pending" },
        { value: "paid", label: "Paid" },
      ],
    },
    {
      key: "paymentReference",
      header: "Payment Ref",
      cell: (row: BatchPayout) =>
        row.paymentReference ? (
          <span className="font-mono text-[11px]">{row.paymentReference}</span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        ),
      filterable: true,
      filterType: "text" as const,
    },
    {
      key: "paidAt",
      header: "Paid Date",
      cell: (row: BatchPayout) =>
        row.paidAt ? (
          <DateCell value={row.paidAt} format="short" />
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        ),
      sortable: true,
      filterable: true,
      filterType: "date-range" as const,
    },
    {
      key: "action",
      header: "",
      align: "right",
      cell: (row: BatchPayout) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80 hover:bg-[#eff6ff] text-[12px]"
          onClick={(e) => {
            e.stopPropagation();
            setDetailPayout(row);
          }}
        >
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
      ),
    },
    {
      key: "viewCommissions",
      header: "",
      align: "right",
      cell: () => (
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-muted)] hover:text-[var(--text-heading)] text-[12px]"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/commissions?batchId=${batchId}`);
          }}
        >
          View Commissions
        </Button>
      ),
    },
  ];

  // ── Detail sheet helpers ──────────────────────────────────────────────
  const detailIsPaid = detailPayout
    ? batch.status === "completed" || detailPayout.status === "paid"
    : false;

  const avatarColors = detailPayout
    ? getAvatarColor(detailPayout.name)
    : { bg: "#dbeafe", text: "#1c2260" };

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
        <div className="space-y-3">
          {/* Active filter chips */}
          <FilterChips<BatchPayout>
            filters={filters}
            columns={payoutColumns}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />

          <div className="rounded-xl border bg-white">
            {payouts.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] py-12 text-[13px]">
                No payouts in this batch
              </p>
            ) : (
              <DataTable<BatchPayout>
                columns={payoutColumns}
                data={paginatedPayouts}
                getRowId={(row) => row.payoutId}
                isLoading={false}
                emptyMessage="No payouts match your filters"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                activeFilters={filters}
                onFilterChange={handleFilterChange}
                pagination={pagination}
                total={payoutsTotal}
                onPaginationChange={setPagination}
                onRowClick={(row) => setDetailPayout(row)}
              />
            )}
          </div>
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

      {/* ── Payout Detail Sheet ─────────────────────────────────────────── */}
      <Sheet open={!!detailPayout} onOpenChange={(open) => { if (!open) { setDetailPayout(null); setShowCommissions(false); } }}>
        <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
          {detailPayout && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-[15px]">Payout Details</SheetTitle>
                <SheetDescription className="text-[12px]">
                  View full details for this payout record
                </SheetDescription>
              </SheetHeader>

              {/* Affiliate card */}
              <div className="rounded-xl border bg-muted/50 p-4 mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                    style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
                  >
                    {getInitials(detailPayout.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] text-[var(--text-heading)] truncate">
                      {detailPayout.name}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)] truncate">
                      {detailPayout.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="mb-5">
                {detailIsPaid ? (
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-[12px] px-3 py-1">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[12px] px-3 py-1">
                    <Clock className="mr-1.5 h-3.5 w-3.5" />
                    Pending
                  </Badge>
                )}
              </div>

              {/* Detail rows */}
              <div className="space-y-0">
                {/* Payout ID */}
                <div className="flex items-start gap-3 py-3">
                  <Hash className="w-4 h-4 text-[#9ca3af] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Payout ID</p>
                    <CopyableId id={detailPayout.payoutId} />
                  </div>
                </div>

                <Separator />

                {/* Amount */}
                <div className="flex items-start gap-3 py-3">
                  <Wallet className="w-4 h-4 text-[#9ca3af] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Amount</p>
                    <p className="text-[16px] font-bold text-[var(--text-heading)] tabular-nums">
                      {formatCurrency(detailPayout.amount)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Commissions — expandable breakdown */}
                <div className="flex items-start gap-3 py-3">
                  <FileText className="w-4 h-4 text-[#9ca3af] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 group w-full text-left"
                      onClick={() => setShowCommissions((prev) => !prev)}
                    >
                      <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
                        Commissions
                      </span>
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        ({detailPayout.commissionCount})
                      </span>
                      {showCommissions ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#9ca3af] ml-auto shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#9ca3af] ml-auto shrink-0" />
                      )}
                    </button>

                    {/* Expanded commission list */}
                    {showCommissions && (
                      <div className="mt-3 space-y-2">
                        {detailCommissions === undefined ? (
                          <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-14 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : detailCommissions.length === 0 ? (
                          <p className="text-[12px] text-[var(--text-muted)] py-2">
                            No commissions found for this payout.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {detailCommissions.map((c) => (
                              <div
                                key={c._id}
                                className="rounded-lg border bg-muted/30 p-3 space-y-2"
                              >
                                {/* Campaign + date */}
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[12px] font-medium text-[var(--text-heading)] truncate">
                                    {c.campaignName}
                                  </p>
                                  <DateCell
                                    value={c._creationTime}
                                    format="short"
                                    size="sm"
                                  />
                                </div>

                                {/* Amount + status */}
                                <div className="flex items-center justify-between">
                                  <span className="text-[14px] font-bold text-[var(--text-heading)] tabular-nums">
                                    {formatCurrency(c.amount)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0",
                                      c.status === "paid"
                                        ? "border-green-200 bg-green-50 text-green-700"
                                        : "border-blue-200 bg-blue-50 text-blue-700"
                                    )}
                                  >
                                    {c.status}
                                  </Badge>
                                </div>

                                {/* Metadata row */}
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                                  {c.customerEmail && (
                                    <span className="truncate max-w-[200px]">
                                      {c.customerEmail}
                                    </span>
                                  )}
                                  {c.eventSource && (
                                    <span className="capitalize">
                                      via {c.eventSource}
                                    </span>
                                  )}
                                  {c.isSelfReferral && (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-200 bg-amber-50 text-amber-600 text-[9px] px-1 py-0"
                                    >
                                      Self-referral
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Commissions subtotal */}
                            {detailCommissions.length > 1 && (
                              <div className="flex items-center justify-between px-1 pt-1 border-t">
                                <span className="text-[11px] text-[var(--text-muted)] font-medium">
                                  Total ({detailCommissions.length})
                                </span>
                                <span className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">
                                  {formatCurrency(
                                    detailCommissions.reduce((sum, c) => sum + c.amount, 0)
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Payout Method */}
                <div className="flex items-start gap-3 py-3">
                  <CreditCard className="w-4 h-4 text-[#9ca3af] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Payout Method</p>
                    {detailPayout.payoutMethod ? (
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text-heading)] capitalize">
                          {detailPayout.payoutMethod.type}
                        </p>
                        <p className="text-[12px] text-[var(--text-muted)]">
                          {detailPayout.payoutMethod.details}
                        </p>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 font-normal text-amber-700 text-[11px] mt-0.5"
                      >
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Not configured
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Payment Reference */}
                <div className="flex items-start gap-3 py-3">
                  <Hash className="w-4 h-4 text-[#9ca3af] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Payment Reference</p>
                    {detailPayout.paymentReference ? (
                      <p className="font-mono text-[13px] text-[var(--text-heading)]">
                        {detailPayout.paymentReference}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[var(--text-muted)]">Not provided</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Paid Date */}
                <div className="flex items-start gap-3 py-3">
                  <CalendarClock className="w-4 h-4 text-[#9ca3af] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Paid Date</p>
                    {detailPayout.paidAt ? (
                      <p className="text-[13px] text-[var(--text-heading)]">
                        {formatDateTime(detailPayout.paidAt)}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[var(--text-muted)]">Not yet paid</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action: Mark as Paid (only for pending payouts) */}
              {!detailIsPaid && batch.status !== "completed" && (
                <>
                  <Separator className="my-4" />
                  <Button
                    className="w-full bg-green-600 text-white hover:bg-green-700 text-[13px]"
                    onClick={() => {
                      setMarkPaidDialogPayout({
                        payoutId: detailPayout.payoutId,
                        affiliateName: detailPayout.name,
                        amount: detailPayout.amount,
                      });
                      setDetailPayout(null);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark as Paid
                  </Button>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
