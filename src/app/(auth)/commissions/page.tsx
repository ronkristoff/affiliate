"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { getSanitizedErrorMessage, reportClientError } from "@/lib/utils";
import {
  useQueryState,
  parseAsStringLiteral,
  parseAsString,
  parseAsInteger,
} from "nuqs";
import {
  DataTable,
  TableColumn,
  TableAction,
  AvatarCell,
  CurrencyCell,
  DateCell,
  StatusBadgeCell,
  type FilterOption,
  type ColumnFilter,
} from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Eye,
  TrendingUp,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { ExportButton } from "@/components/ui/ExportButton";
import { SearchField } from "@/components/ui/SearchField";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import { dateToTimestamp, dateToStartTimestamp, timestampToDateInput } from "@/lib/date-utils";
import { CopyableId } from "@/components/shared/CopyableId";
import { CommissionComputationSection } from "@/components/shared/CommissionComputationSection";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichedCommission {
  _id: Id<"commissions">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  affiliateId: Id<"affiliates">;
  campaignId: Id<"campaigns">;
  conversionId?: Id<"conversions">;
  amount: number;
  status: string;
  eventMetadata?: {
    source: string;
    transactionId?: string;
    timestamp: number;
    subscriptionId?: string;
  };
  reversalReason?: string;
  transactionId?: string;
  batchId?: Id<"payoutBatches">;
  isSelfReferral?: boolean;
  fraudIndicators?: string[];
  affiliateName: string;
  affiliateEmail: string;
  campaignName: string;
  customerEmail?: string;
  planEvent: string;
}

interface CommissionDetail extends EnrichedCommission {
  planInfo?: string;
  // Computation fields from getCommissionDetail
  commissionType?: string;
  campaignDefaultRate?: number;
  effectiveRate?: number;
  isOverride?: boolean;
  saleAmount?: number | null;
  recurringCommission?: boolean;
  recurringRate?: number;
  recurringRateType?: string;
  // Audit trail
  auditTrail?: Array<{
    _id: string;
    _creationTime: number;
    action: string;
    actorId?: string;
    actorType: string;
    previousValue?: any;
    newValue?: any;
    metadata?: any;
  }>;
}

interface CommissionStats {
  pendingCount: number;
  pendingValue: number;
  approvedValue: number;
  approvedCount: number;
  confirmedCountThisMonth: number;
  confirmedValueThisMonth: number;
  reversedCountThisMonth: number;
  reversedValueThisMonth: number;
  flaggedCount: number;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const commissionStatusConfig: Record<
  string,
  { label: string; dotColor: string; bgClass: string; textClass: string }
> = {
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[var(--warning-bg)]", textClass: "text-[var(--warning-text)]" },
  approved: { label: "Approved", dotColor: "#10b981", bgClass: "bg-[var(--success-bg)]", textClass: "text-[var(--success-text)]" },
  reversed: { label: "Reversed", dotColor: "#ef4444", bgClass: "bg-[var(--danger-bg)]", textClass: "text-[var(--danger-text)]" },
  declined: { label: "Declined", dotColor: "#ef4444", bgClass: "bg-[var(--danger-bg)]", textClass: "text-[var(--danger-text)]" },
  paid: { label: "Paid", dotColor: "#6b7280", bgClass: "bg-[var(--bg-page)]", textClass: "text-[var(--text-body)]" },
};

const statusFilterOptions: FilterOption[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "reversed", label: "Reversed" },
  { value: "declined", label: "Declined" },
  { value: "paid", label: "Paid" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { formatCurrency } from "@/lib/format";

function formatDetailDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inner content (hooks live here, wrapped by Suspense)
// ---------------------------------------------------------------------------

function CommissionsContent() {
  // ── RBAC ────────────────────────────────────────────────────────────────
  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManage = currentUser?.role === "owner" || currentUser?.role === "manager";

  // ── Data queries ────────────────────────────────────────────────────────
  const stats = useQuery(
    api.commissions.getCommissionStats,
    currentUser ? {} : "skip"
  );

  const allCampaigns = useQuery(api.campaigns.listCampaigns, {});

  // ── URL-persisted state via nuqs ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );

  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all")
  );

  const [campaignFilter, setCampaignFilter] = useQueryState(
    "campaign",
    parseAsString.withDefault("all")
  );

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1)
  );

  const [pageSize, setPageSize] = useQueryState(
    "pageSize",
    parseAsInteger.withDefault(DEFAULT_PAGE_SIZE)
  );

  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault("_creationTime")
  );

  const [sortOrder, setSortOrder] = useQueryState(
    "order",
    parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc")
  );

  // ── Column-level filter params (URL-persisted) ──────────────────────────
  const [amountMin, setAmountMin] = useQueryState("amount_min", parseAsString.withDefault(""));
  const [amountMax, setAmountMax] = useQueryState("amount_max", parseAsString.withDefault(""));
  const [dateAfter, setDateAfter] = useQueryState("date_after", parseAsString.withDefault(""));
  const [dateBefore, setDateBefore] = useQueryState("date_before", parseAsString.withDefault(""));
  const [affiliateSearch, setAffiliateSearch] = useQueryState("affiliate", parseAsString.withDefault(""));
  const [customerSearch, setCustomerSearch] = useQueryState("customer", parseAsString.withDefault(""));
  const [planEventSearch, setPlanEventSearch] = useQueryState("planEvent", parseAsString.withDefault(""));
  const [batchIdFilter, setBatchIdFilter] = useQueryState("batchId", parseAsString.withDefault(""));

  // ── Mutations ───────────────────────────────────────────────────────────
  const approveCommission = useMutation(api.commissions.approveCommission);
  const declineCommission = useMutation(api.commissions.declineCommission);
  const exportCsv = useAction(api.commissions.exportCommissionsCSV);

  // ── Local UI state ──────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<EnrichedCommission | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [commissionDetail, setCommissionDetail] = useState<CommissionDetail | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showSourceEvent, setShowSourceEvent] = useState(false);

  // Reset collapsible sections when commission changes
  useEffect(() => {
    setShowAuditTrail(false);
    setShowSourceEvent(false);
  }, [selectedCommission?._id]);

  // Dialogs
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ── Server-side Paginated Query ─────────────────────────────────────────
  // Convert status filter to array for the query (supports comma-separated multi-select)
  const statusFilterArray = statusFilter !== "all" && statusFilter.length > 0
    ? statusFilter.split(",")
    : undefined;

  // Parse nuqs string params into typed values for Convex
  const parsedAmountMin = amountMin ? parseFloat(amountMin) : undefined;
  const parsedAmountMax = amountMax ? parseFloat(amountMax) : undefined;
  const parsedDateAfter = dateAfter ? dateToStartTimestamp(dateAfter) : undefined;
  const parsedDateBefore = dateBefore ? dateToTimestamp(dateBefore) : undefined;
  const safeBatchId = batchIdFilter && batchIdFilter.startsWith("j")
    ? (batchIdFilter as Id<"payoutBatches">)
    : undefined;

  const paginatedResult = useQuery(
    api.commissions.listCommissionsPaginated,
    currentUser ? {
      page,
      numItems: pageSize,
      statusFilter: statusFilterArray,
      campaignIdFilter: campaignFilter !== "all" ? campaignFilter : undefined,
      searchQuery: searchQuery.trim() || undefined,
      amountMin: parsedAmountMin,
      amountMax: parsedAmountMax,
      dateAfter: parsedDateAfter,
      dateBefore: parsedDateBefore,
      affiliateSearch: affiliateSearch.trim() || undefined,
      customerSearch: customerSearch.trim() || undefined,
      planEventSearch: planEventSearch.trim() || undefined,
      batchIdFilter: safeBatchId,
      sortBy: sortBy as "_creationTime" | "amount" | "affiliateName" | "campaignName" | "customerEmail" | "planEvent" | "status",
      sortOrder,
    } : "skip"
  );

  const commissions = paginatedResult?.page ?? [];
  const totalCount = paginatedResult?.total ?? 0;
  const isLoading = paginatedResult === undefined;

  // Stable maxPage — during loading, preserve the user's requested page so
  // pagination buttons stay enabled while data refetches.
  const rawMaxPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const maxPage = isLoading ? Math.max(page, rawMaxPage) : rawMaxPage;

  // ── Campaign filter options ─────────────────────────────────────────────
  const campaignOptions: FilterOption[] = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.map((c) => ({ value: c._id, label: c.name }));
  }, [allCampaigns]);

  // ── Page reset on filter / sort change ──────────────────────────────────
  // nuqs setters trigger re-renders; page resets inline via helpers below.

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  // ── Active filters for FilterChips ───────────────────────────────────────
  const activeFilters = useMemo<ColumnFilter[]>(() => {
    const filters: ColumnFilter[] = [];
    if (statusFilter !== "all" && statusFilter.length > 0) {
      filters.push({ columnKey: "status", type: "select", values: statusFilter.split(",") });
    }
    if (campaignFilter !== "all") {
      filters.push({ columnKey: "campaign", type: "select", values: campaignFilter.split(",") });
    }
    if (searchQuery.trim()) {
      filters.push({ columnKey: "search", type: "text", value: searchQuery.trim() });
    }
    if (parsedAmountMin != null || parsedAmountMax != null) {
      filters.push({
        columnKey: "amount",
        type: "number-range",
        min: parsedAmountMin ?? null,
        max: parsedAmountMax ?? null,
      });
    }
    if (parsedDateAfter != null || parsedDateBefore != null) {
      filters.push({
        columnKey: "date",
        type: "date-range",
        after: parsedDateAfter ?? null,
        before: parsedDateBefore ?? null,
      });
    }
    if (affiliateSearch.trim()) {
      filters.push({ columnKey: "affiliate", type: "text", value: affiliateSearch.trim() });
    }
    if (customerSearch.trim()) {
      filters.push({ columnKey: "customer", type: "text", value: customerSearch.trim() });
    }
    if (planEventSearch.trim()) {
      filters.push({ columnKey: "planEvent", type: "text", value: planEventSearch.trim() });
    }
    if (batchIdFilter) {
      filters.push({ columnKey: "batchId", label: "Batch Filter" } as any);
    }
    return filters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, campaignFilter, searchQuery, amountMin, amountMax, dateAfter, dateBefore, affiliateSearch, customerSearch, planEventSearch, batchIdFilter]);

  // ── Handle filter removal ────────────────────────────────────────────────
  const handleRemoveFilter = (key: string) => {
    switch (key) {
      case "status": setStatusFilter("all"); break;
      case "campaign": setCampaignFilter("all"); break;
      case "search": setSearchQuery(""); break;
      case "amount":
        setAmountMin("");
        setAmountMax("");
        break;
      case "date":
        setDateAfter("");
        setDateBefore("");
        break;
      case "affiliate": setAffiliateSearch(""); break;
      case "customer": setCustomerSearch(""); break;
      case "planEvent": setPlanEventSearch(""); break;
      case "batchId": setBatchIdFilter(""); break;
    }
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setStatusFilter("all");
    setCampaignFilter("all");
    setSearchQuery("");
    setAmountMin("");
    setAmountMax("");
    setDateAfter("");
    setDateBefore("");
    setAffiliateSearch("");
    setCustomerSearch("");
    setPlanEventSearch("");
    setBatchIdFilter("");
    setPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
  };

  // ── Column-level filter change handler (maps DataTable ColumnFilter → nuqs) ──
  const handleColumnFilterChange = (filters: ColumnFilter[]) => {
    const activeKeys = new Set(filters.map((f) => f.columnKey));

    for (const filter of filters) {
      switch (filter.columnKey) {
        case "status":
          setStatusFilter(filter.values?.length ? filter.values.join(",") : "all");
          break;
        case "campaign":
          setCampaignFilter(filter.values?.length ? filter.values.join(",") : "all");
          break;
        case "amount":
          setAmountMin(filter.min != null ? String(filter.min) : "");
          setAmountMax(filter.max != null ? String(filter.max) : "");
          break;
        case "date":
          setDateAfter(filter.after != null ? timestampToDateInput(filter.after) : "");
          setDateBefore(filter.before != null ? timestampToDateInput(filter.before) : "");
          break;
        case "affiliate":
          setAffiliateSearch((filter as any).value ?? "");
          break;
        case "customer":
          setCustomerSearch((filter as any).value ?? "");
          break;
        case "planEvent":
          setPlanEventSearch((filter as any).value ?? "");
          break;
        case "batchId":
          setBatchIdFilter((filter as any).value ?? "");
          break;
      }
    }

    // Clear any filters that were removed
    if (!activeKeys.has("status")) setStatusFilter("all");
    if (!activeKeys.has("campaign")) setCampaignFilter("all");
    if (!activeKeys.has("amount")) { setAmountMin(""); setAmountMax(""); }
    if (!activeKeys.has("date")) { setDateAfter(""); setDateBefore(""); }
    if (!activeKeys.has("affiliate")) setAffiliateSearch("");
    if (!activeKeys.has("customer")) setCustomerSearch("");
    if (!activeKeys.has("planEvent")) setPlanEventSearch("");
    if (!activeKeys.has("batchId")) setBatchIdFilter("");

    setPage(1);
  };

  // ── Commission detail drawer ────────────────────────────────────────────
  const handleViewDetail = (commission: EnrichedCommission) => {
    setSelectedCommission(commission);
    setIsDrawerOpen(true);
    // Reset local detail so loading state is clear while query resolves
    setCommissionDetail(null);
  };

  // Fetch commission detail reactively when drawer opens
  const commissionDetailQuery = useQuery(
    api.commissions.getCommissionDetail,
    selectedCommission ? { commissionId: selectedCommission._id } : "skip"
  );

  // Sync the query result into our local state
  const effectiveDetail = commissionDetailQuery ?? commissionDetail;

  // ── Approve / Decline / Override handlers ───────────────────────────────
  const handleApprove = async (commissionId: Id<"commissions">) => {
    setIsActionLoading(true);
    try {
      await approveCommission({ commissionId });
      toast.success("Commission approved successfully");
      setIsDrawerOpen(false);
      setSelectedCommission(null);
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to approve commission"));
      reportClientError({ source: "CommissionsPage", message: getSanitizedErrorMessage(error, "Failed to approve commission") });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedCommission || !declineReason.trim()) return;
    setIsActionLoading(true);
    try {
      await declineCommission({
        commissionId: selectedCommission._id,
        reason: declineReason.trim(),
      });
      toast.success("Commission declined");
      setIsDrawerOpen(false);
      setShowDeclineDialog(false);
      setSelectedCommission(null);
      setDeclineReason("");
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to decline commission"))
      reportClientError({ source: "CommissionsPage", message: getSanitizedErrorMessage(error, "Failed to decline commission") });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOverrideLegitimate = async (commissionId: Id<"commissions">) => {
    setIsActionLoading(true);
    try {
      await approveCommission({ commissionId });
      toast.success("Commission marked as legitimate and approved");
      setIsDrawerOpen(false);
      setSelectedCommission(null);
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to override commission"));
      reportClientError({ source: "CommissionsPage", message: getSanitizedErrorMessage(error, "Failed to override commission") });
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── Approve All Pending ─────────────────────────────────────────────────
  // Note: This is now based on stats instead of fetching all commissions
  // For bulk approve, we still need to know the pending commissions
  const pendingNonFlagged = useMemo(() => {
    if (!commissions || isLoading) return [];
    return commissions.filter(
      (c) =>
        c.status === "pending" &&
        !c.isSelfReferral &&
        (!c.fraudIndicators || c.fraudIndicators.length === 0)
    );
  }, [commissions, isLoading]);

  const pendingNonFlaggedValue = useMemo(
    () => pendingNonFlagged.reduce((sum, c) => sum + c.amount, 0),
    [pendingNonFlagged]
  );

  const handleApproveAll = async () => {
    if (pendingNonFlagged.length === 0) return;
    setIsApprovingAll(true);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const commission of pendingNonFlagged) {
      try {
        await approveCommission({ commissionId: commission._id });
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push(
          error instanceof Error ? error.message : `Failed for ${commission._id}`
        );
      }
    }

    setShowApproveAllDialog(false);

    if (failedCount === 0) {
      toast.success(`Approved all ${successCount} pending commissions`);
    } else {
      toast.error(
        `Approved ${successCount} of ${pendingNonFlagged.length} commissions. ${failedCount} failed.`,
        { description: errors.slice(0, 3).join("; ") }
      );
    }

    setIsApprovingAll(false);
  };

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const base64Data = await exportCsv({});
      downloadCsv(base64Data, "commissions");
      toast.success("Commissions exported successfully");
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to export commissions"));
      reportClientError({ source: "CommissionsPage", message: getSanitizedErrorMessage(error, "Failed to export commissions") });
    } finally {
      setIsExporting(false);
    }
  };

  // ── CSV Export ──────────────────────────────────────────────────────────
  const columns: TableColumn<EnrichedCommission>[] = useMemo(
    () => [
      {
        key: "_id",
        header: "ID",
        cell: (row) => (
          <CopyableId id={row._id} />
        ),
        width: 180,
      },
      {
        key: "date",
        header: "Date",
        sortable: true,
        sortField: "_creationTime",
        filterable: true,
        filterType: "date-range",
        filterLabel: "Date",
        cell: (row) => <DateCell value={row._creationTime} format="short" />,
      },
      {
        key: "affiliate",
        header: "Affiliate",
        sortable: true,
        sortField: "affiliateName",
        filterable: true,
        filterType: "text",
        filterLabel: "Affiliate",
        cell: (row) => <AvatarCell name={row.affiliateName} email={row.affiliateEmail} />,
      },
      {
        key: "customer",
        header: "Customer",
        sortable: true,
        sortField: "customerEmail",
        filterable: true,
        filterType: "text",
        filterLabel: "Customer",
        cell: (row) => (
          <span className="text-[12px] text-[var(--text-body)]">{row.customerEmail || "—"}</span>
        ),
      },
      {
        key: "planEvent",
        header: "Plan / Event",
        sortable: true,
        sortField: "planEvent",
        filterable: true,
        filterType: "text",
        filterLabel: "Plan / Event",
        cell: (row) => (
          <span className="text-[12px] text-[var(--text-body)]">{row.planEvent}</span>
        ),
      },
      {
        key: "campaign",
        header: "Campaign",
        sortable: true,
        sortField: "campaignName",
        filterable: true,
        filterType: "select",
        filterOptions: campaignOptions,
        filterLabel: "Campaign",
        cell: (row) => (
          <span className="text-[12px] text-[var(--text-body)]">{row.campaignName}</span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        align: "right" as const,
        sortable: true,
        sortField: "amount",
        filterable: true,
        filterType: "number-range",
        filterLabel: "Amount",
        filterStep: 0.01,
        cell: (row) => (
          <CurrencyCell
            amount={row.amount}
            muted={row.status === "reversed" || row.status === "declined"}
          />
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        sortField: "status",
        filterable: true,
        filterType: "select",
        filterOptions: statusFilterOptions,
        filterLabel: "Status",
        cell: (row) => <StatusBadgeCell status={row.status} statusConfig={commissionStatusConfig} />,
      },
    ],
    [campaignOptions]
  );

  const tableActions: TableAction<EnrichedCommission>[] = [
    {
      label: "View Detail",
      variant: "info",
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: (row) => handleViewDetail(row),
    },
  ];

  // ── Is commission flagged? ──────────────────────────────────────────────
  const isFlagged = (c: EnrichedCommission | CommissionDetail | null) =>
    c !== null && (c.isSelfReferral === true || (c.fraudIndicators != null && c.fraudIndicators.length > 0));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Sticky Top Bar */}
      <PageTopbar description="Review, approve, and manage all affiliate commission payouts">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Commissions</h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        {/* ── Metric Cards ─────────────────────────────────────────────── */}
        <FadeIn className="grid grid-cols-5 gap-4 mb-8">
          <MetricCard
            label="Pending Review"
            numericValue={stats?.pendingValue ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `${stats.pendingCount} commissions` : "—"}
            variant="yellow"
            isLoading={!stats}
            icon={<Clock className="w-4 h-4" />}
          />
          <MetricCard
            label="Approved (Ready to Pay)"
            numericValue={stats?.approvedValue ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `${stats.approvedCount} commissions` : "—"}
            variant="green"
            isLoading={!stats}
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <MetricCard
            label="Approved This Month"
            numericValue={stats?.confirmedValueThisMonth ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `${stats.confirmedCountThisMonth} commissions` : "—"}
            variant="green"
            isLoading={!stats}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <MetricCard
            label="Reversed (This Month)"
            numericValue={stats?.reversedValueThisMonth ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `${stats.reversedCountThisMonth} commissions` : "—"}
            variant="yellow"
            isLoading={!stats}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <MetricCard
            label="Flagged for Review"
            numericValue={stats?.flaggedCount ?? 0}
            subtext="Needs attention"
            variant="gray"
            isLoading={!stats}
            icon={<ShieldAlert className="w-4 h-4" />}
          />
        </FadeIn>

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Search */}
          <SearchField
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search affiliate, customer, or TX ID..."
            className="flex-1 min-w-0"
          />

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <ExportButton onClick={handleExportCSV} isExporting={isExporting} />
            {canManage && (stats?.pendingCount ?? 0) > 0 && (
              <Button
                size="sm"
                onClick={() => setShowApproveAllDialog(true)}
                className="text-[12px]"
              >
                Approve All Pending
              </Button>
            )}
          </div>
        </div>

        {/* ── Filter Chips ─────────────────────────────────────────────── */}
        <FilterChips
          filters={activeFilters as any}
          columns={columns as any}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
        />

        {/* ── DataTable with Server-side Pagination ────────────────────────────────────────────────── */}
        <DataTable<EnrichedCommission>
          columns={columns}
          actions={tableActions}
          data={commissions}
          getRowId={(row) => row._id}
          isLoading={isLoading}
          emptyMessage="No commissions found"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
            setPage(1);
          }}
          activeFilters={activeFilters}
          onFilterChange={handleColumnFilterChange}
          rowClassName={(row) =>
            isFlagged(row) ? "!bg-[var(--warning-bg)]" : ""
          }
          pagination={{ page, pageSize }}
          total={totalCount}
          onPaginationChange={({ page: newPage, pageSize: newPageSize }) => {
            setPage(newPage);
            if (newPageSize !== pageSize) {
              handlePageSizeChange(newPageSize);
            }
          }}
        />
      </div>

      {/* ── Commission Detail Sheet ──────────────────────────────────── */}
      <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && setIsDrawerOpen(false)}>
        <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="px-6 py-5 border-b border-[var(--border)]">
            <SheetTitle className="text-base font-bold text-[var(--text-heading)]">
              Commission Detail
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[var(--text-muted)]">
              {effectiveDetail
                ? `${effectiveDetail.affiliateName} — ${effectiveDetail.campaignName}`
                : "Loading…"}
            </SheetDescription>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {effectiveDetail ? (
              <div className="space-y-6">
                {/* Amount Hero */}
                <div className="bg-[var(--bg-page)] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                      Commission Amount
                    </span>
                    <StatusBadgeCell status={effectiveDetail.status} statusConfig={commissionStatusConfig} />
                  </div>
                  <span
                    className={`text-[28px] font-bold ${
                      effectiveDetail.status === "reversed" || effectiveDetail.status === "declined"
                        ? "text-[var(--danger)]"
                        : "text-[var(--text-heading)]"
                    }`}
                  >
                    {formatCurrency(effectiveDetail.amount)}
                  </span>
                </div>

                {/* Commission Computation Breakdown */}
                <CommissionComputationSection
                  variant="full"
                  commissionType={effectiveDetail.commissionType ?? "N/A"}
                  effectiveRate={effectiveDetail.effectiveRate ?? 0}
                  campaignDefaultRate={effectiveDetail.campaignDefaultRate}
                  isOverride={effectiveDetail.isOverride}
                  saleAmount={effectiveDetail.saleAmount ?? null}
                  amount={effectiveDetail.amount}
                  recurringCommission={effectiveDetail.recurringCommission}
                  recurringRate={effectiveDetail.recurringRate}
                  recurringRateType={effectiveDetail.recurringRateType}
                  currency="PHP"
                />

                {/* Commission Details */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
                    Commission Details
                  </h4>
                  <div className="space-y-0">
                    <DetailRow label="Affiliate" value={`${effectiveDetail.affiliateName} (${effectiveDetail.affiliateEmail})`} />
                    <DetailRow label="Customer Email" value={effectiveDetail.customerEmail || "—"} />
                    <DetailRow label="Campaign" value={effectiveDetail.campaignName} />
                    <DetailRow label="Plan / Event" value={effectiveDetail.planEvent} />
                    {effectiveDetail.planInfo && (
                      <DetailRow label="Plan Info" value={effectiveDetail.planInfo} />
                    )}
                    <DetailRow
                      label="SaligPay Tx ID"
                      value={effectiveDetail.eventMetadata?.transactionId || effectiveDetail.transactionId || "—"}
                    />
                    <DetailRow
                      label="Date Created"
                      value={formatDetailDate(effectiveDetail._creationTime)}
                    />
                    {effectiveDetail.reversalReason && (
                      <DetailRow label="Reversal Reason" value={effectiveDetail.reversalReason} />
                    )}
                  </div>
                </div>

                {/* Payout Batch Link */}
                {effectiveDetail.batchId && (
                  <div className="mt-4">
                    <Link
                      href={`/payouts/batches/${effectiveDetail.batchId}`}
                      className="flex items-center gap-2 text-[13px] text-[var(--primary)] hover:underline"
                    >
                      <Package className="h-4 w-4" />
                      View Payout Batch
                    </Link>
                  </div>
                )}

                {/* Fraud Signals */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
                    Fraud Signals
                  </h4>
                  {isFlagged(effectiveDetail) ? (
                    <div className="rounded-lg border border-[#f59e0b]/30 bg-[#fffbeb] p-4 space-y-2">
                      {effectiveDetail.isSelfReferral && (
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                          <p className="text-[12px] text-[#92400e]">
                            <span className="font-semibold">Self-referral detected</span> —
                            The affiliate may have referred themselves.
                          </p>
                        </div>
                      )}
                      {effectiveDetail.fraudIndicators && effectiveDetail.fraudIndicators.length > 0 && (
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[12px] font-semibold text-[#92400e] mb-1">Fraud indicators:</p>
                            <ul className="list-disc list-inside text-[12px] text-[#92400e] space-y-0.5">
                              {effectiveDetail.fraudIndicators.map((indicator, i) => (
                                <li key={i}>{indicator}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#10b981]/30 bg-[#ecfdf5] p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                        <p className="text-[12px] text-[#065f46] font-medium">No fraud signals detected</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Activity Timeline (collapsible) */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuditTrail(!showAuditTrail)}
                    className="flex w-full items-center justify-between h-auto px-0 hover:bg-transparent"
                  >
                    <span className="text-[13px] font-medium text-[var(--text-heading)]">
                      Activity Timeline
                    </span>
                    {showAuditTrail ? (
                      <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                  </Button>
                  {showAuditTrail && (
                    <div className="mt-3">
                      {(effectiveDetail.auditTrail?.length ?? 0) === 1 &&
                      effectiveDetail.auditTrail?.[0]?.action === "COMMISSION_CREATED" ? (
                        <div className="mb-3 rounded-md bg-blue-50 p-2 text-[11px] text-blue-700">
                          Auto-approved — no manual review events.
                        </div>
                      ) : null}
                      <ActivityTimeline activities={effectiveDetail.auditTrail ?? []} />
                    </div>
                  )}
                </div>

                {/* Source Event Metadata (collapsible) */}
                {effectiveDetail.eventMetadata && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSourceEvent(!showSourceEvent)}
                      className="flex w-full items-center justify-between h-auto px-0 hover:bg-transparent"
                    >
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        Source Event
                      </span>
                      {showSourceEvent ? (
                        <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                    </Button>
                    {showSourceEvent && (
                      <div className="mt-3 space-y-0">
                        <DetailRow label="Source" value={effectiveDetail.eventMetadata.source} />
                        <DetailRow
                          label="Transaction ID"
                          value={effectiveDetail.eventMetadata.transactionId ?? "N/A"}
                        />
                        <DetailRow
                          label="Timestamp"
                          value={formatDetailDate(new Date(effectiveDetail.eventMetadata.timestamp).getTime())}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Loading skeleton while detail query resolves */
              <div className="space-y-6">
                <div className="bg-[var(--bg-page)] rounded-xl p-5">
                  <Skeleton className="h-4 w-32 mb-3" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-3 w-28" />
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-[var(--border-light)]">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions — only for pending status */}
          {effectiveDetail && effectiveDetail.status === "pending" && canManage && (
            <div className="px-6 py-4 border-t border-[var(--border)] flex flex-col gap-2">
              {isFlagged(effectiveDetail) ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedCommission) handleOverrideLegitimate(selectedCommission._id);
                    }}
                    disabled={isActionLoading}
                    className="w-full h-8 gap-2 text-[12px]"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    Override — Mark Legitimate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowDeclineDialog(true)}
                    disabled={isActionLoading}
                    className="w-full h-8 gap-2 text-[12px] bg-[#ef4444] text-white hover:bg-[#dc2626]"
                  >
                    Decline Commission
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeclineDialog(true)}
                    disabled={isActionLoading}
                    className="w-full h-8 gap-2 text-[12px] border-[#ef4444] text-[#ef4444] hover:bg-[#fee2e2]"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedCommission) handleApprove(selectedCommission._id);
                    }}
                    disabled={isActionLoading}
                    className="w-full h-8 gap-2 text-[12px]"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    Approve
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Decline Dialog ─────────────────────────────────────────────── */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Commission</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for declining this commission. This reason is for internal records only and will not be shared with the affiliate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Enter decline reason..."
            rows={3}
            className="w-full px-3 py-2 text-[12px] border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeclineDialog(false); setDeclineReason(""); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              disabled={!declineReason.trim() || isActionLoading}
              className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
            >
              {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Decline Commission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Approve All Dialog ────────────────────────────────────────── */}
      <AlertDialog open={showApproveAllDialog} onOpenChange={setShowApproveAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve All Pending Commissions</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to approve <span className="font-semibold">{pendingNonFlagged.length} commissions</span> totaling{" "}
              <span className="font-semibold">{formatCurrency(pendingNonFlaggedValue)}</span>.
              {stats && stats.flaggedCount > 0 && (
                <span className="block mt-2 text-[#f59e0b] font-medium">
                  Note: {stats.flaggedCount} flagged commission{stats.flaggedCount === 1 ? "" : "s"} will be skipped.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApprovingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveAll}
              disabled={isApprovingAll}
            >
              {isApprovingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Approving...
                </>
              ) : (
                `Approve ${pendingNonFlagged.length} Commissions`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Row helper
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-light)]">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--text-heading)] text-right break-all max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

function CommissionsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top bar skeleton */}
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="page-content">
        {/* Metric cards skeleton */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-light)]">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Toolbar skeleton */}
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-9 flex-1 max-w-xs rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>

        {/* Table skeleton */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — wraps inner content in Suspense
// ---------------------------------------------------------------------------

export default function CommissionsPage() {
  return (
    <Suspense fallback={<CommissionsSkeleton />}>
      <CommissionsContent />
    </Suspense>
  );
}
