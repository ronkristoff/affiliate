"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { BatchStatusBadge } from "@/components/shared/BatchStatusBadge";
import { CopyableId } from "@/components/shared/CopyableId";
import {
  DataTable,
  TableColumn,
  TableAction,
  AvatarCell,
  CurrencyCell,
  DateCell,
  NumberCell,
  type ColumnFilter,
} from "@/components/ui/DataTable";
import {
  type PaginationState,
  DEFAULT_PAGE_SIZE,
} from "@/components/ui/DataTablePagination";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import {
  formatCurrency,
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
  RefreshCw,
} from "lucide-react";
import {
  generatePayoutCsv,
  downloadCsvFromString,
} from "@/lib/csv-utils";
import { PAYOUT_AUDIT_ACTIONS } from "@/lib/audit-constants";
import { FilterChips } from "@/components/ui/FilterChips";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";

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

interface AffiliatePendingPayout {
  affiliateId: Id<"affiliates">;
  name: string;
  email: string;
  pendingAmount: number;
  commissionCount: number;
  payoutMethod?: { type: string; details: string };
}

// =============================================================================
// Main Content Component
// =============================================================================

export function PayoutsContent() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<Id<"affiliates">>>(new Set());
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

  // Batch detail state for mark-paid dialogs
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
  const totalPaidOutData = useQuery(api.payouts.getTotalPaidOut, {});
  const affiliates = useQuery(api.payouts.getAffiliatesWithPendingPayouts, {});
  const batchesResult = useQuery(api.payouts.getPayoutBatches, {
    paginationOpts: { numItems: 100, cursor: null },
  });

  // Extract batches array from paginated result
  const batches: Batch[] = batchesResult && "page" in batchesResult ? batchesResult.page : [];

  // Mutation
  const generateBatch = useMutation(api.payouts.generatePayoutBatch);
  const recalcStats = useMutation(api.payouts.recalcPendingPayoutStats);
  const [isRecalcing, setIsRecalcing] = useState(false);

  // Pagination state for Affiliates Pending Payout table
  const [affiliatesPagination, setAffiliatesPagination] = useState<PaginationState>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Pagination state for Recent Batches table
  const [batchesPagination, setBatchesPagination] = useState<PaginationState>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Sort state for Affiliates Pending Payout table
  const [affiliatesSortBy, setAffiliatesSortBy] = useState<string | undefined>(undefined);
  const [affiliatesSortOrder, setAffiliatesSortOrder] = useState<"asc" | "desc">("asc");

  // Sort state for Recent Batches table
  const [batchesSortBy, setBatchesSortBy] = useState<string | undefined>(undefined);
  const [batchesSortOrder, setBatchesSortOrder] = useState<"asc" | "desc">("desc");

  // Column-level filter state for Affiliates Pending Payout table
  const [affiliateFilters, setAffiliateFilters] = useState<ColumnFilter[]>([]);

  // Column-level filter state for Recent Batches table
  const [batchFilters, setBatchFilters] = useState<ColumnFilter[]>([]);

  // Reset page when affiliate filters change
  const handleAffiliateFilterChange = (filters: ColumnFilter[]) => {
    setAffiliateFilters(filters);
    setAffiliatesPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset page when batch filters change
  const handleBatchFilterChange = (filters: ColumnFilter[]) => {
    setBatchFilters(filters);
    setBatchesPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset page when affiliate sort changes
  const handleAffiliateSortChange = (sortBy: string, sortOrder: "asc" | "desc") => {
    setAffiliatesSortBy(sortBy);
    setAffiliatesSortOrder(sortOrder);
    setAffiliatesPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Reset page when batch sort changes
  const handleBatchSortChange = (sortBy: string, sortOrder: "asc" | "desc") => {
    setBatchesSortBy(sortBy);
    setBatchesSortOrder(sortOrder);
    setBatchesPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Remove a single affiliate filter
  const handleRemoveAffiliateFilter = (columnKey: string) => {
    handleAffiliateFilterChange(affiliateFilters.filter((f) => f.columnKey !== columnKey));
  };

  // Clear all affiliate filters
  const handleClearAllAffiliateFilters = () => {
    handleAffiliateFilterChange([]);
  };

  // Remove a single batch filter
  const handleRemoveBatchFilter = (columnKey: string) => {
    handleBatchFilterChange(batchFilters.filter((f) => f.columnKey !== columnKey));
  };

  // Clear all batch filters
  const handleClearAllBatchFilters = () => {
    handleBatchFilterChange([]);
  };

  // Mutations
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

  // Payout Audit Log state and query
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
        if (batchPayoutsForCsv.length === 0) {
          toast.warning("No payout records", {
            description: "This batch has no payout records. The CSV contains headers only.",
          });
        }

        const dateStr = new Date(csvDownloadDate).toISOString().split("T")[0];
        const csv = generatePayoutCsv(batchPayoutsForCsv);
        downloadCsvFromString(csv, `payout-batch-${dateStr}`);

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
  const hasPendingPayouts = (affiliates?.length ?? 0) > 0;

  // Computed totals for selected affiliates
  const selectedAffiliateList = (affiliates ?? []).filter((a) =>
    selectedAffiliates.has(a.affiliateId)
  );
  const selectedTotalAmount = selectedAffiliateList.reduce(
    (sum, a) => sum + a.pendingAmount,
    0
  );
  const selectedCommissionCount = selectedAffiliateList.reduce(
    (sum, a) => sum + a.commissionCount,
    0
  );
  const hasSelected = selectedAffiliates.size > 0;

  // Calculate batch metrics from historical batches
  const totalPaidOut = totalPaidOutData?.totalAmount ?? 0;
  const completedBatchCount = totalPaidOutData?.completedBatchCount ?? 0;
  const processingBatches = (batches ?? []).filter(
    (b) => b.status === "processing" || b.status === "pending"
  );
  const processingTotal = processingBatches.reduce(
    (sum, b) => sum + b.totalAmount,
    0
  );

  // Filtered + sorted + paginated data for Affiliates Pending Payout table
  const filteredAffiliates = useMemo(() => {
    let data = affiliates ?? [];
    for (const filter of affiliateFilters) {
      switch (filter.columnKey) {
        case "affiliate": {
          const search = (filter.value ?? "").toLowerCase();
          if (search) {
            data = data.filter(
              (a) =>
                a.name.toLowerCase().includes(search) ||
                (a.email && a.email.toLowerCase().includes(search))
            );
          }
          break;
        }
        case "payoutMethod": {
          const values = filter.values ?? [];
          if (values.length > 0) {
            if (values.includes("not_configured")) {
              if (!values.includes("configured")) {
                data = data.filter((a) => !a.payoutMethod);
              } else {
                // Both selected → show all
              }
            } else {
              data = data.filter((a) => !!a.payoutMethod);
            }
          }
          break;
        }
        case "commissions": {
          if (filter.min != null) data = data.filter((a) => a.commissionCount >= filter.min!);
          if (filter.max != null) data = data.filter((a) => a.commissionCount <= filter.max!);
          break;
        }
        case "amount": {
          if (filter.min != null) data = data.filter((a) => a.pendingAmount >= filter.min!);
          if (filter.max != null) data = data.filter((a) => a.pendingAmount <= filter.max!);
          break;
        }
      }
    }
    return data;
  }, [affiliates, affiliateFilters]);

  const sortedAffiliates = useMemo(() => {
    if (!affiliatesSortBy) return filteredAffiliates;
    const dir = affiliatesSortOrder === "asc" ? 1 : -1;
    const field = affiliatesSortBy as keyof AffiliatePendingPayout;
    return [...filteredAffiliates].sort((a, b) => {
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
  }, [filteredAffiliates, affiliatesSortBy, affiliatesSortOrder]);

  const affiliatesTotal = sortedAffiliates.length;
  const paginatedAffiliates = useMemo(
    () =>
      sortedAffiliates.slice(
        (affiliatesPagination.page - 1) * affiliatesPagination.pageSize,
        affiliatesPagination.page * affiliatesPagination.pageSize
      ),
    [sortedAffiliates, affiliatesPagination]
  );

  // Filtered + sorted + paginated data for Recent Batches table
  const filteredBatches = useMemo(() => {
    let data = batches ?? [];
    for (const filter of batchFilters) {
      switch (filter.columnKey) {
        case "batchCode": {
          const search = (filter.value ?? "").toLowerCase();
          if (search) {
            data = data.filter((b) => b.batchCode.toLowerCase().includes(search));
          }
          break;
        }
        case "generatedAt": {
          if (filter.after != null) data = data.filter((b) => b.generatedAt >= filter.after!);
          if (filter.before != null) data = data.filter((b) => b.generatedAt <= filter.before!);
          break;
        }
        case "affiliateCount": {
          if (filter.min != null) data = data.filter((b) => b.affiliateCount >= filter.min!);
          if (filter.max != null) data = data.filter((b) => b.affiliateCount <= filter.max!);
          break;
        }
        case "totalAmount": {
          if (filter.min != null) data = data.filter((b) => b.totalAmount >= filter.min!);
          if (filter.max != null) data = data.filter((b) => b.totalAmount <= filter.max!);
          break;
        }
        case "status": {
          const values = filter.values ?? [];
          if (values.length > 0) {
            data = data.filter((b) => values.includes(b.status));
          }
          break;
        }
      }
    }
    return data;
  }, [batches, batchFilters]);

  const sortedBatches = useMemo(() => {
    if (!batchesSortBy) return filteredBatches;
    const dir = batchesSortOrder === "asc" ? 1 : -1;
    const field = batchesSortBy as keyof Batch;
    return [...filteredBatches].sort((a, b) => {
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
  }, [filteredBatches, batchesSortBy, batchesSortOrder]);

  const batchesTotal = sortedBatches.length;
  const paginatedBatches = useMemo(
    () =>
      sortedBatches.slice(
        (batchesPagination.page - 1) * batchesPagination.pageSize,
        batchesPagination.page * batchesPagination.pageSize
      ),
    [sortedBatches, batchesPagination]
  );

  // Handle batch generation
  async function handleGenerateBatch() {
    setIsGenerating(true);
    try {
      const affiliateIdsArg =
        selectedAffiliates.size > 0
          ? Array.from(selectedAffiliates)
          : undefined;
      const result = await generateBatch({
        affiliateIds: affiliateIdsArg,
      });
      setGeneratedBatch({
        batchId: result.batchId,
        batchCode: `BATCH-${result.batchId.slice(-8).toUpperCase()}`,
        affiliateCount: result.affiliateCount,
        totalAmount: result.totalAmount,
        generatedAt: Date.now(),
        affiliates: result.affiliates,
      });
      setShowConfirmDialog(false);
      setSelectedAffiliates(new Set());
      toast.success("Payout batch generated successfully", {
        description: `Batch ${result.batchId.slice(-8).toUpperCase()} created with ${result.affiliateCount} affiliate${result.affiliateCount !== 1 ? "s" : ""}`,
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

  // Handle recalculating pending payout stats from actual commission data
  async function handleRecalcStats() {
    setIsRecalcing(true);
    try {
      const result = await recalcStats({});
      if (result.pendingPayoutCount > 0) {
        toast.success("Stats synced", {
          description: `Found ${result.pendingPayoutCount} pending payout(s) totaling ${formatCurrency(result.pendingPayoutTotal)}`,
        });
      } else {
        toast.info("Stats synced", {
          description: "No pending payouts found",
        });
      }
    } catch (error) {
      toast.error("Failed to sync stats", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsRecalcing(false);
    }
  }

  // Determine affiliates without payout method
  const affiliatesWithoutMethod = (affiliates ?? []).filter(
    (a) => !a.payoutMethod
  );

  // Handle marking a single payout as paid
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

  // Handle marking all batch payouts as paid
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

  // ── DataTable Columns ────────────────────────────────────────────────────

  const affiliateColumns: TableColumn<AffiliatePendingPayout>[] = useMemo(
    () => [
      {
        key: "affiliateId",
        header: "ID",
        cell: (row) => <CopyableId id={row.affiliateId} />,
        width: 180,
      },
      {
        key: "affiliate",
        header: "Affiliate",
        cell: (row) => <AvatarCell name={row.name} email={row.email} />,
        sortable: true,
        sortField: "name",
        filterable: true,
        filterType: "text" as const,
      },
      {
        key: "payoutMethod",
        header: "Payout Method",
        cell: (row) =>
          row.payoutMethod ? (
            <Badge variant="outline" className="font-normal text-[12px]">
              {row.payoutMethod.type}
            </Badge>
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
        header: "Confirmed Commissions",
        align: "right",
        cell: (row) => (
          <span className="text-[12px] text-[var(--text-body)]">
            {row.commissionCount} commission{row.commissionCount !== 1 ? "s" : ""}
          </span>
        ),
        sortable: true,
        sortField: "commissionCount",
        filterable: true,
        filterType: "number-range" as const,
      },
      {
        key: "amount",
        header: "Amount Due",
        align: "right",
        cell: (row) => <CurrencyCell amount={row.pendingAmount} />,
        sortable: true,
        sortField: "pendingAmount",
        filterable: true,
        filterType: "number-range" as const,
      },
    ],
    []
  );

  const batchColumns: TableColumn<Batch>[] = useMemo(
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
        sortable: true,
        filterable: true,
        filterType: "text" as const,
      },
      {
        key: "generatedAt",
        header: "Date",
        cell: (row) => <DateCell value={row.generatedAt} format="short" />,
        sortable: true,
        filterable: true,
        filterType: "date-range" as const,
      },
      {
        key: "affiliateCount",
        header: "Affiliates",
        align: "right",
        cell: (row) => <NumberCell value={row.affiliateCount} />,
        sortable: true,
        filterable: true,
        filterType: "number-range" as const,
      },
      {
        key: "totalAmount",
        header: "Amount",
        align: "right",
        cell: (row) => <CurrencyCell amount={row.totalAmount} />,
        sortable: true,
        filterable: true,
        filterType: "number-range" as const,
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <BatchStatusBadge status={row.status} />,
        sortable: true,
        filterable: true,
        filterType: "select" as const,
        filterOptions: [
          { value: "pending", label: "Pending" },
          { value: "processing", label: "Processing" },
          { value: "completed", label: "Completed" },
        ],
      },
    ],
    []
  );

  const batchActions: TableAction<Batch>[] = useMemo(
    () => [
      {
        label: "View Details",
        variant: "info",
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: (row) => router.push(`/payouts/batches/${row._id}`),
      },
      {
        label: "Mark All Paid",
        variant: "success",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        disabled: (row) => row.status !== "pending" && row.status !== "processing",
        onClick: (row) =>
          setMarkAllPaidBatch({
            batchId: row._id,
            batchCode: row.batchCode,
            totalAmount: row.totalAmount,
            affiliateCount: row.affiliateCount,
            pendingCount: row.affiliateCount,
          }),
      },
      {
        label: "Download CSV",
        variant: "outline",
        icon: <Download className="w-3.5 h-3.5" />,
        onClick: (row) => {
          setCsvDownloadBatchId(row._id);
          setCsvDownloadDate(row.generatedAt);
        },
      },
    ],
    []
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Metric Cards ─────────────────────────────────────────────── */}
      <FadeIn className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Paid Out (All Time)"
          numericValue={totalPaidOut}
          formatValue={formatCurrency}
          subtext={
            completedBatchCount > 0
              ? `Across ${completedBatchCount} batch${completedBatchCount !== 1 ? "es" : ""}`
              : "—"
          }
          variant="green"
          isLoading={isLoading}
          icon={<Wallet className="w-4 h-4" />}
        />
        <MetricCard
          label="Ready to Pay"
          numericValue={pendingTotal?.totalAmount ?? 0}
          formatValue={formatCurrency}
          subtext={
            pendingTotal
              ? `${affiliates?.length ?? 0} affiliate${(affiliates?.length ?? 0) !== 1 ? "s" : ""} · ${pendingTotal.commissionCount} commission${pendingTotal.commissionCount !== 1 ? "s" : ""}`
              : "—"
          }
          variant="yellow"
          isLoading={isLoading}
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          label="Processing"
          numericValue={processingTotal}
          formatValue={formatCurrency}
          subtext={
            processingBatches.length > 0
              ? `${processingBatches.filter((b) => b.status === "processing").length} batch${processingBatches.filter((b) => b.status === "processing").length !== 1 ? "es" : ""} in progress`
              : "—"
          }
          variant="blue"
          isLoading={isLoading}
          icon={<CreditCard className="w-4 h-4" />}
        />
      </FadeIn>

      {/* ── Generate Batch CTA (when there are pending payouts) ─────── */}
      {hasPendingPayouts && (
        <FadeIn delay={100}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--text-heading)]">
                Affiliates Pending Payout
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                {hasSelected ? (
                  <>
                    <span className="font-semibold text-[var(--text-heading)]">
                      {selectedAffiliates.size} of {affiliates?.length ?? 0}
                    </span>{" "}
                    selected · {formatCurrency(selectedTotalAmount)} total
                  </>
                ) : (
                  <>
                    {affiliates?.length ?? 0} affiliate
                    {(affiliates?.length ?? 0) !== 1 ? "s" : ""} ·{" "}
                    {formatCurrency(pendingTotal?.totalAmount ?? 0)} total
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasSelected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAffiliates(new Set())}
                  className="text-[12px] text-[var(--text-muted)]"
                >
                  Clear selection
                </Button>
              )}
              <Button
                size="sm"
                disabled={isGenerating || !hasSelected}
                onClick={() => setShowConfirmDialog(true)}
                className="gap-1.5 text-[12px]"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5" />
                )}
                Generate Batch
                {hasSelected && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                    {selectedAffiliates.size}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── Affiliates Pending Payout Table ──────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !hasPendingPayouts ? (
        <FadeIn>
          <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
              <Wallet className="h-6 w-6 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-[13px] font-semibold text-[var(--text-heading)]">
              No Pending Payouts
            </h3>
            <p className="mt-1 text-[12px] text-[var(--text-muted)] max-w-sm mx-auto">
              There are no affiliates with confirmed, unpaid commissions at this time.
              New payouts will appear here once commissions are confirmed.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRecalcStats}
              disabled={isRecalcing}
              className="mt-4 text-[12px] text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80"
            >
              {isRecalcing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Sync stats from commissions
            </Button>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={150}>
          <FilterChips<AffiliatePendingPayout>
            filters={affiliateFilters}
            columns={affiliateColumns}
            onRemove={handleRemoveAffiliateFilter}
            onClearAll={handleClearAllAffiliateFilters}
          />
          <DataTable<AffiliatePendingPayout>
            columns={affiliateColumns}
            data={paginatedAffiliates}
            getRowId={(row) => row.affiliateId}
            selectable
            selectedIds={selectedAffiliates as Set<string | number>}
            onSelectionChange={(ids) =>
              setSelectedAffiliates(new Set(ids as Set<Id<"affiliates">>))
            }
            rowClassName={(row) =>
              selectedAffiliates.has(row.affiliateId) ? "bg-[var(--brand-light)]" : ""
            }
            isLoading={false}
            emptyMessage="No affiliates match your filters"
            sortBy={affiliatesSortBy}
            sortOrder={affiliatesSortOrder}
            onSortChange={handleAffiliateSortChange}
            activeFilters={affiliateFilters}
            onFilterChange={handleAffiliateFilterChange}
            pagination={affiliatesPagination}
            total={affiliatesTotal}
            onPaginationChange={setAffiliatesPagination}
          />
        </FadeIn>
      )}

      {/* ── Recent Batch History ────────────────────────────────────── */}
      {batches && batches.length > 0 && (
        <FadeIn delay={200}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--text-heading)]">
                  Recent Batches
                </h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  {batchesTotal} total batch{batchesTotal !== 1 ? "es" : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[12px]"
                onClick={() => {
                  window.location.href = "/payouts/history";
                }}
              >
                <History className="w-3.5 h-3.5" />
                View Full History
              </Button>
            </div>

            <FilterChips<Batch>
              filters={batchFilters}
              columns={batchColumns}
              onRemove={handleRemoveBatchFilter}
              onClearAll={handleClearAllBatchFilters}
            />

            <DataTable<Batch>
              columns={batchColumns}
              actions={batchActions}
              data={paginatedBatches}
              getRowId={(row) => row._id}
              isLoading={false}
              emptyMessage="No batches match your filters"
              sortBy={batchesSortBy}
              sortOrder={batchesSortOrder}
              onSortChange={handleBatchSortChange}
              activeFilters={batchFilters}
              onFilterChange={handleBatchFilterChange}
              pagination={batchesPagination}
              total={batchesTotal}
              onPaginationChange={setBatchesPagination}
            />
          </div>
        </FadeIn>
      )}

      {/* =============================================================================
           Payout Audit Log Section
           ============================================================================= */}
      <FadeIn delay={300}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--text-heading)]">
                Payout Audit Log
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Track all payout actions and batch operations
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <FilterTabs
            tabs={[
              { key: "all", label: "All" },
              {
                key: PAYOUT_AUDIT_ACTIONS.BATCH_GENERATED,
                label: "Batch Generated",
                icon: <PackagePlus className="h-3 w-3" />,
              },
              {
                key: PAYOUT_AUDIT_ACTIONS.PAYOUT_MARKED_PAID,
                label: "Payout Paid",
                icon: <CheckCircle2 className="h-3 w-3" />,
                activeColor: "bg-green-600",
              },
              {
                key: PAYOUT_AUDIT_ACTIONS.BATCH_MARKED_PAID,
                label: "Batch Completed",
                icon: <CheckCheck className="h-3 w-3" />,
                activeColor: "bg-green-600",
              },
            ]}
            activeTab={auditActionFilter ?? "all"}
            onTabChange={(key) => {
              setAuditPaginationCursor(undefined);
              setAuditActionFilter(key === "all" ? undefined : key);
            }}
          />

          {/* Loading State */}
          {auditLogsResult === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : auditLogsResult.page.length === 0 ? (
            /* Empty State */
            <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-page)]">
                <History className="h-6 w-6 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-[13px] font-semibold text-[var(--text-heading)]">
                No Audit Log Entries
              </h3>
              <p className="mt-1 text-[12px] text-[var(--text-muted)] max-w-sm mx-auto">
                Payout actions will appear here as they're performed
              </p>
            </div>
          ) : (
            /* Audit Log Entries */
            <div className="space-y-2">
              {auditLogsResult.page.map((log: any) => {
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
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className={`flex-shrink-0 rounded-full p-2 ${actionConfig.color}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--text-heading)]">
                            {actionConfig.label}
                          </span>
                          {log.entityType === "payouts" && (
                            <Badge variant="outline" className="text-[10px]">
                              Single Payout
                            </Badge>
                          )}
                          {log.entityType === "payoutBatches" && (
                            <Badge variant="outline" className="text-[10px]">
                              Batch
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                          {formatDate(log._creationTime)}
                        </span>
                      </div>

                      {/* Actor Name */}
                      <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        {log.actorName ? (
                          <span>by <span className="font-medium text-[var(--text-heading)]">{log.actorName}</span></span>
                        ) : (
                          <span>by System</span>
                        )}
                      </div>

                      {/* Metadata Preview */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
                        {log.metadata?.totalAmount !== undefined && (
                          <span className="font-medium text-[var(--text-heading)]">
                            {formatCurrency(log.metadata.totalAmount)}
                          </span>
                        )}
                        {log.metadata?.amount !== undefined && (
                          <span className="font-medium text-[var(--text-heading)]">
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
                        <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-heading)]">
                          View details
                        </summary>
                        <div className="mt-2 p-2 bg-muted/50 rounded text-[11px] font-mono overflow-x-auto">
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
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPaginationCursor === undefined}
                  onClick={() => setAuditPaginationCursor(undefined)}
                  className="text-[12px]"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Newest
                </Button>
                <span className="text-[12px] text-[var(--text-muted)]">
                  {auditLogsResult.page.length} entries
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditLogsResult.isDone}
                  onClick={() => setAuditPaginationCursor(auditLogsResult.continueCursor ?? undefined)}
                  className="text-[12px]"
                >
                  Older
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      {/* =============================================================================
           Dialogs
           ============================================================================= */}

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
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">
                      Batch ID
                    </p>
                    <p className="font-mono text-[13px] font-bold">
                      {generatedBatch.batchCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">
                      Total Amount
                    </p>
                    <p className="text-xl font-bold text-[var(--brand-primary)]">
                      {formatCurrency(generatedBatch.totalAmount)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-[12px] text-[var(--text-muted)]">
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-[#10409a]">
                        {getInitials(affiliate.name)}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold">{affiliate.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {affiliate.commissionCount} commission
                          {affiliate.commissionCount !== 1 ? "s" : ""}{" "}
                          {affiliate.payoutMethod
                            ? `· ${affiliate.payoutMethod.type}`
                            : "· No payout method"}
                        </p>
                      </div>
                    </div>
                    <p className="text-[13px] font-bold tabular-nums">
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
              className="text-[12px]"
            >
              {isDownloadingCsv ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download CSV
            </Button>
            <Button onClick={() => setGeneratedBatch(null)} className="text-[12px]">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Batch Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Payout Batch</DialogTitle>
            <DialogDescription>
              {hasSelected
                ? `Create a payout batch for the ${selectedAffiliates.size} selected affiliate${selectedAffiliates.size !== 1 ? "s" : ""} with confirmed, unpaid commissions.`
                : "Create a payout batch for all affiliates with confirmed, unpaid commissions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Affiliates</span>
                <span className="font-bold">
                  {hasSelected ? selectedAffiliates.size : (pendingTotal?.affiliateCount ?? 0)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[var(--text-muted)]">Total Amount</span>
                <span className="font-bold text-[var(--brand-primary)]">
                  {hasSelected
                    ? formatCurrency(selectedTotalAmount)
                    : formatCurrency(pendingTotal?.totalAmount ?? 0)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-[var(--text-muted)]">Commissions</span>
                <span className="font-bold">
                  {hasSelected
                    ? selectedCommissionCount
                    : (pendingTotal?.commissionCount ?? 0)}
                </span>
              </div>
            </div>

            {hasSelected && selectedAffiliateList.some((a) => !a.payoutMethod) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  <strong>{selectedAffiliateList.filter((a) => !a.payoutMethod).length}</strong> of the selected affiliate
                  {selectedAffiliateList.filter((a) => !a.payoutMethod).length !== 1 ? "s" : ""} do
                  not have a payout method configured. They will still be included in the
                  batch.
                </p>
              </div>
            )}

            {!hasSelected && affiliatesWithoutMethod.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  <strong>{affiliatesWithoutMethod.length}</strong> affiliate
                  {affiliatesWithoutMethod.length !== 1 ? "s" : ""} do
                  not have a payout method configured. They will still be included in the
                  batch.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="text-[12px]"
            >
              Cancel
            </Button>
            <Button
              disabled={isGenerating}
              onClick={handleGenerateBatch}
              className="text-[12px]"
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

      {/* Mark Single Payout as Paid Confirmation Dialog */}
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

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  This marks the payout as paid. Ensure you've transferred funds externally.
                  This action cannot be undone.
                </p>
              </div>

              {/* Payment Reference */}
              <div>
                <label htmlFor="payment-ref-single" className="text-[12px] font-medium">Payment Reference (optional)</label>
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
            <Button variant="outline" onClick={() => setMarkPaidDialogPayout(null)} className="text-[12px]">
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700 text-[12px]"
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

      {/* Mark All Batch Payouts as Paid Confirmation Dialog */}
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
              <div className="rounded-lg bg-muted p-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Batch</span>
                  <span className="font-bold font-mono">{markAllPaidBatch.batchCode}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[var(--text-muted)]">Affiliates</span>
                  <span className="font-bold">{markAllPaidBatch.affiliateCount}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[var(--text-muted)]">Total Amount</span>
                  <span className="font-bold text-[var(--brand-primary)]">{formatCurrency(markAllPaidBatch.totalAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-[var(--text-muted)]">Pending Payouts</span>
                  <span className="font-bold">{markAllPaidBatch.pendingCount}</span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  This marks <strong>all payouts</strong> in this batch as paid. Ensure you've
                  transferred funds externally. This action cannot be undone.
                </p>
              </div>

              {/* Payment Reference */}
              <div>
                <label htmlFor="payment-ref-batch" className="text-[12px] font-medium">Payment Reference (optional)</label>
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
            <Button variant="outline" onClick={() => setMarkAllPaidBatch(null)} className="text-[12px]">
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700 text-[12px]"
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
