"use client";

import { useState, useMemo, Suspense } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  DataTable,
  TableColumn,
  TableAction,
  AvatarCell,
  CurrencyCell,
  DateCell,
  StatusBadgeCell,
  type FilterOption,
} from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
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
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Eye,
  ChevronDown,
} from "lucide-react";
import { downloadCsv } from "@/lib/utils";

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
}

interface CommissionStats {
  pendingCount: number;
  pendingValue: number;
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
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[#fef3c7]", textClass: "text-[#92400e]" },
  approved: { label: "Approved", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  confirmed: { label: "Confirmed", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  reversed: { label: "Reversed", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  declined: { label: "Declined", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  paid: { label: "Paid", dotColor: "#6b7280", bgClass: "bg-[#f3f4f6]", textClass: "text-[#374151]" },
};

const statusFilterOptions: FilterOption[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "confirmed", label: "Confirmed" },
  { value: "reversed", label: "Reversed" },
  { value: "declined", label: "Declined" },
  { value: "paid", label: "Paid" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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

const PAGE_SIZE = 20;
type StatusFilter = "all" | "pending" | "approved" | "confirmed" | "reversed" | "declined" | "paid";

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

  const allCommissions = useQuery(
    api.commissions.listCommissionsEnriched,
    currentUser ? {} : "skip"
  );

  const allCampaigns = useQuery(api.campaigns.listCampaigns, {});

  // ── Mutations ───────────────────────────────────────────────────────────
  const approveCommission = useMutation(api.commissions.approveCommission);
  const declineCommission = useMutation(api.commissions.declineCommission);
  const exportCSV = useAction(api.commissions.exportCommissionsCSV);

  // ── Local UI state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<EnrichedCommission | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [commissionDetail, setCommissionDetail] = useState<CommissionDetail | null>(null);

  // Dialogs
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ── Campaign filter options ─────────────────────────────────────────────
  const campaignOptions: FilterOption[] = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.map((c) => ({ value: c._id, label: c.name }));
  }, [allCampaigns]);

  // ── Client-side filtering ───────────────────────────────────────────────
  const filteredCommissions = useMemo(() => {
    if (!allCommissions) return [];

    let data = allCommissions;

    // Status filter
    if (statusFilter !== "all") {
      data = data.filter((c) => c.status === statusFilter);
    }

    // Campaign filter
    if (campaignFilter !== "all") {
      data = data.filter((c) => c.campaignId === campaignFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter((c) => {
        return (
          c.affiliateName.toLowerCase().includes(q) ||
          c.affiliateEmail.toLowerCase().includes(q) ||
          (c.customerEmail ?? "").toLowerCase().includes(q) ||
          (c.eventMetadata?.transactionId ?? "").toLowerCase().includes(q)
        );
      });
    }

    return data;
  }, [allCommissions, statusFilter, campaignFilter, searchQuery]);

  // ── Visible slice (load more) ──────────────────────────────────────────
  const visibleCommissions = useMemo(
    () => filteredCommissions.slice(0, visibleCount),
    [filteredCommissions, visibleCount]
  );

  const remainingCount = filteredCommissions.length - visibleCount;

  // ── Reset visible count on filter change ───────────────────────────────
  const handleStatusFilterChange = (s: StatusFilter) => {
    setStatusFilter(s);
    setVisibleCount(PAGE_SIZE);
  };

  const handleCampaignFilterChange = (c: string) => {
    setCampaignFilter(c);
    setVisibleCount(PAGE_SIZE);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setVisibleCount(PAGE_SIZE);
  };

  // ── Active filter chips for FilterChips component ───────────────────────
  const activeFilters = useMemo(() => {
    const filters: { columnKey: string; values: string[] }[] = [];
    if (statusFilter !== "all") {
      filters.push({ columnKey: "status", values: [statusFilter] });
    }
    if (campaignFilter !== "all") {
      const campaignLabel = campaignOptions.find((o) => o.value === campaignFilter)?.label ?? campaignFilter;
      filters.push({ columnKey: "campaign", values: [campaignLabel] });
    }
    if (searchQuery.trim()) {
      filters.push({ columnKey: "search", values: [searchQuery.trim()] });
    }
    return filters;
  }, [statusFilter, campaignFilter, searchQuery, campaignOptions]);

  const handleRemoveFilter = (key: string) => {
    switch (key) {
      case "status": setStatusFilter("all"); break;
      case "campaign": setCampaignFilter("all"); break;
      case "search": setSearchQuery(""); break;
    }
  };

  const handleClearAllFilters = () => {
    setStatusFilter("all");
    setCampaignFilter("all");
    setSearchQuery("");
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
      toast.error(error instanceof Error ? error.message : "Failed to approve commission");
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
      toast.error(error instanceof Error ? error.message : "Failed to decline commission");
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
      toast.error(error instanceof Error ? error.message : "Failed to override commission");
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── Approve All Pending ─────────────────────────────────────────────────
  const pendingNonFlagged = useMemo(() => {
    if (!allCommissions) return [];
    return allCommissions.filter(
      (c) =>
        c.status === "pending" &&
        !c.isSelfReferral &&
        (!c.fraudIndicators || c.fraudIndicators.length === 0)
    );
  }, [allCommissions]);

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
      const base64Data = await exportCSV({});
      downloadCsv(base64Data, "commissions");
      toast.success("Commissions exported successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export commissions");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Status filter pills ────────────────────────────────────────────────
  const statusPills: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "reversed", label: "Reversed" },
    { value: "paid", label: "Paid" },
  ];

  // ── DataTable columns ───────────────────────────────────────────────────
  const columns: TableColumn<EnrichedCommission>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        sortable: true,
        sortField: "_creationTime",
        cell: (row) => <DateCell value={row._creationTime} format="short" />,
      },
      {
        key: "affiliate",
        header: "Affiliate",
        cell: (row) => <AvatarCell name={row.affiliateName} email={row.affiliateEmail} />,
      },
      {
        key: "customer",
        header: "Customer",
        cell: (row) => (
          <span className="text-[12px] text-[#474747]">{row.customerEmail || "—"}</span>
        ),
      },
      {
        key: "planEvent",
        header: "Plan / Event",
        cell: (row) => (
          <span className="text-[12px] text-[#474747]">{row.planEvent}</span>
        ),
      },
      {
        key: "campaign",
        header: "Campaign",
        filterable: true,
        filterType: "select",
        filterOptions: campaignOptions,
        filterLabel: "Campaign",
        cell: (row) => (
          <span className="text-[12px] text-[#474747]">{row.campaignName}</span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        align: "right" as const,
        sortable: true,
        sortField: "amount",
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

  // ── Sort handler ────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState("_creationTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const sortedCommissions = useMemo(() => {
    const data = [...visibleCommissions];
    data.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      }
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      return sortOrder === "desc"
        ? bStr.localeCompare(aStr)
        : aStr.localeCompare(bStr);
    });
    return data;
  }, [visibleCommissions, sortBy, sortOrder]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border)] h-[60px] flex items-center px-8">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Commissions</h1>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="px-3 py-1.5 text-[12px] font-semibold border border-[var(--border)] rounded-lg hover:bg-[var(--bg-page)] transition-colors bg-transparent flex items-center gap-1.5"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-3 h-3" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        {/* ── Metric Cards ─────────────────────────────────────────────── */}
        <FadeIn className="grid grid-cols-4 gap-4 mb-8">
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
            label="Confirmed (This Month)"
            numericValue={stats?.confirmedValueThisMonth ?? 0}
            formatValue={formatCurrency}
            subtext={stats ? `${stats.confirmedCountThisMonth} commissions` : "—"}
            variant="green"
            isLoading={!stats}
            icon={<CheckCircle2 className="w-4 h-4" />}
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
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Search affiliate, customer, or TX ID..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-[12px] border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)]"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Campaign Filter */}
            <div className="relative">
              <select
                value={campaignFilter}
                onChange={(e) => handleCampaignFilterChange(e.target.value)}
                className="h-9 pl-3 pr-8 text-[12px] border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
              >
                <option value="all">All Campaigns</option>
                {campaignOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af] pointer-events-none" />
            </div>

            {/* Approve All Pending */}
            {canManage && (stats?.pendingCount ?? 0) > 0 && (
              <button
                onClick={() => setShowApproveAllDialog(true)}
                className="px-3 py-1.5 text-[12px] font-semibold bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] transition-colors"
              >
                Approve All Pending
              </button>
            )}
          </div>
        </div>

        {/* ── Status Filter Pills ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          {statusPills.map((pill) => (
            <button
              key={pill.value}
              onClick={() => handleStatusFilterChange(pill.value)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                statusFilter === pill.value
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-page)]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* ── Filter Chips ─────────────────────────────────────────────── */}
        <FilterChips
          filters={activeFilters as any}
          columns={columns as any}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
        />

        {/* ── DataTable ────────────────────────────────────────────────── */}
        <DataTable<EnrichedCommission>
          columns={columns}
          actions={tableActions}
          data={sortedCommissions}
          getRowId={(row) => row._id}
          isLoading={!allCommissions}
          emptyMessage="No commissions found"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
          }}
          rowClassName={(row) =>
            isFlagged(row) ? "!bg-[#fffbeb]" : ""
          }
        />

        {/* ── Load More / Pagination ───────────────────────────────────── */}
        {!allCommissions && (
          <div className="mt-4">
            <Skeleton className="h-8 w-64" />
          </div>
        )}
        {allCommissions && filteredCommissions.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-[12px] text-[#6b7280]">
            <span>
              Showing {sortedCommissions.length} of {filteredCommissions.length} commissions
            </span>
            {remainingCount > 0 && (
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="px-3 py-1.5 text-[12px] font-semibold border border-[var(--border)] rounded-lg hover:bg-[var(--bg-page)] transition-colors bg-transparent"
              >
                Load {Math.min(PAGE_SIZE, remainingCount)} more ({remainingCount} remaining)
              </button>
            )}
          </div>
        )}
        {allCommissions && filteredCommissions.length <= PAGE_SIZE && filteredCommissions.length > 0 && (
          <div className="mt-4 text-[12px] text-[#6b7280]">
            Showing {filteredCommissions.length} commissions
          </div>
        )}
      </div>

      {/* ── Commission Detail Drawer ──────────────────────────────────── */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent
          className="sm:max-w-xl p-0"
          style={
            {
              "--vaul-drawer-direction": "right",
            } as React.CSSProperties
          }
        >
          {effectiveDetail && (
            <>
              <DrawerHeader className="px-6 pt-6 pb-0">
                <DrawerTitle className="text-lg font-bold">Commission Detail</DrawerTitle>
                <DrawerDescription className="text-[12px] text-[var(--text-muted)]">
                  {effectiveDetail.affiliateName} — {effectiveDetail.campaignName}
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-6 py-4 space-y-5 flex-1 overflow-y-auto">
                {/* Amount Hero */}
                <div className="bg-[var(--bg-page)] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Commission Amount
                    </span>
                    <StatusBadgeCell status={effectiveDetail.status} statusConfig={commissionStatusConfig} />
                  </div>
                  <span
                    className={`text-3xl font-bold ${
                      effectiveDetail.status === "reversed" || effectiveDetail.status === "declined"
                        ? "text-[#ef4444]"
                        : "text-[var(--text-heading)]"
                    }`}
                  >
                    {formatCurrency(effectiveDetail.amount)}
                  </span>
                </div>

                {/* Commission Details */}
                <div>
                  <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    Commission Details
                  </h4>
                  <div className="space-y-3">
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

                {/* Fraud Signals */}
                <div>
                  <h4 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
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
              </div>

              {/* Action Buttons — only for pending status */}
              <DrawerFooter className="px-6 pb-6 pt-2 border-t border-[var(--border)]">
                {effectiveDetail.status === "pending" && canManage && (
                  isFlagged(effectiveDetail) ? (
                    <>
                      <button
                        onClick={() => {
                          if (selectedCommission) handleOverrideLegitimate(selectedCommission._id);
                        }}
                        disabled={isActionLoading}
                        className="w-full px-4 py-2.5 text-[12px] font-semibold border border-[var(--border)] rounded-lg hover:bg-[var(--bg-page)] transition-colors bg-transparent flex items-center justify-center gap-2"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : null}
                        Override — Mark Legitimate
                      </button>
                      <button
                        onClick={() => setShowDeclineDialog(true)}
                        disabled={isActionLoading}
                        className="w-full px-4 py-2.5 text-[12px] font-semibold bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors flex items-center justify-center gap-2"
                      >
                        Decline Commission
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setShowDeclineDialog(true)}
                        disabled={isActionLoading}
                        className="w-full px-4 py-2.5 text-[12px] font-semibold border border-[#ef4444] text-[#ef4444] rounded-lg hover:bg-[#fee2e2] transition-colors bg-transparent flex items-center justify-center gap-2"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : null}
                        Decline
                      </button>
                      <button
                        onClick={() => {
                          if (selectedCommission) handleApprove(selectedCommission._id);
                        }}
                        disabled={isActionLoading}
                        className="w-full px-4 py-2.5 text-[12px] font-semibold bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-secondary)] transition-colors flex items-center justify-center gap-2"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : null}
                        Approve
                      </button>
                    </>
                  )
                )}
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

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
    <div className="flex items-start justify-between gap-4">
      <span className="text-[12px] text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-[12px] text-[var(--text-heading)] font-medium text-right break-all">
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
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border)] h-[60px] flex items-center px-8">
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="px-8 pt-6 pb-8">
        {/* Metric cards skeleton */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>

        {/* Toolbar skeleton */}
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-9 flex-1 max-w-xs rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>

        {/* Status pills skeleton */}
        <div className="flex items-center gap-2 mb-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="mt-4">
          <Skeleton className="h-5 w-48" />
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
