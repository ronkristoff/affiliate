"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  useQueryState,
  parseAsStringLiteral,
  parseAsArrayOf,
  parseAsString,
  parseAsInteger,
} from "nuqs";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AffiliateTopbar } from "@/components/affiliate/AffiliateTopbar";
import { AffiliateTabs } from "@/components/affiliate/AffiliateTabs";
import { AffiliateToolbar } from "@/components/affiliate/AffiliateToolbar";
import { AffiliateDetailDrawer } from "@/components/affiliate/AffiliateDetailDrawer";
import { InviteAffiliateSheet } from "@/components/affiliate/InviteAffiliateSheet";
import { PendingBanner } from "@/components/affiliate/PendingBanner";
import { BulkActionBar } from "@/components/affiliate/BulkActionBar";
import { RejectionDialog } from "@/components/affiliate/RejectionDialog";
import { SuspendDialog } from "@/components/affiliate/SuspendDialog";
import { ReactivateDialog } from "@/components/affiliate/ReactivateDialog";
import {
  DataTable,
  TableColumn,
  TableAction,
  AvatarCell,
  CurrencyCell,
  NumberCell,
  DateCell,
  StatusBadgeCell,
  type ColumnFilter,
  type FilterOption,
} from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, PauseCircle, CheckCircle2, Loader2 } from "lucide-react";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import { downloadCsv } from "@/lib/utils";
import { dateToTimestamp, dateToStartTimestamp, timestampToDateInput } from "@/lib/date-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Affiliate {
  _id: Id<"affiliates">;
  _creationTime: number;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
  promotionChannel?: string;
  campaignName?: string;
  referralCount?: number;
  clickCount?: number;
  totalEarnings?: number;
  hasFraudSignals?: boolean;
}

// ---------------------------------------------------------------------------
// Column configs
// ---------------------------------------------------------------------------

function buildPendingColumns(
  canManage: boolean,
  onApprove: (id: Id<"affiliates">, name: string) => void,
  onReject: (affiliate: Affiliate) => void,
  campaignOptions: FilterOption[]
): { columns: TableColumn<Affiliate>[]; actions: TableAction<Affiliate>[] } {
  const columns: TableColumn<Affiliate>[] = [
    {
      key: "applicant",
      header: "Applicant",
      sortable: true,
      sortField: "name",
      cell: (row) => (
        <AvatarCell name={row.name} email={row.email} />
      ),
    },
    {
      key: "applied",
      header: "Applied",
      sortable: true,
      sortField: "_creationTime",
      filterable: true,
      filterType: "date-range",
      filterLabel: "Applied",
      cell: (row) => (
        <DateCell value={row._creationTime} format="relative-full" size="sm" />
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (row) => (
        <span className="text-[12px] text-[#474747]">
          {row.promotionChannel || "Direct invite"}
        </span>
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
        <span className="text-[12px] text-[#474747]">
          {row.campaignName || "Standard Program"}
        </span>
      ),
    },
  ];

  const actions: TableAction<Affiliate>[] = canManage
    ? [
        {
          label: "Approve",
          variant: "default",
          onClick: (row) => onApprove(row._id, row.name),
        },
        {
          label: "Reject",
          variant: "destructive",
          onClick: (row) => onReject(row),
        },
      ]
    : [];

  return { columns, actions };
}

function buildActiveColumns(
  canManage: boolean,
  onSuspend: (affiliate: Affiliate) => void,
  onReactivate: (affiliate: Affiliate) => void,
  onViewDetails: (affiliate: Affiliate) => void,
  campaignOptions: FilterOption[]
): { columns: TableColumn<Affiliate>[]; actions: TableAction<Affiliate>[] } {
  const columns: TableColumn<Affiliate>[] = [
    {
      key: "affiliate",
      header: "Affiliate",
      sortable: true,
      sortField: "name",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <AvatarCell name={row.name} />
          {row.hasFraudSignals && (
            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#f59e0b" }}
              />
              Flagged
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortField: "status",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "active", label: "Active" },
        { value: "suspended", label: "Suspended" },
      ],
      filterLabel: "Status",
      cell: (row) => <StatusBadgeCell status={row.status} />,
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
        <span className="text-[12px] text-[#474747]">
          {row.campaignName || "Standard Program"}
        </span>
      ),
    },
    {
      key: "referrals",
      header: "Referrals",
      sortable: true,
      sortField: "referralCount",
      filterable: true,
      filterType: "number-range",
      filterLabel: "Referrals",
      cell: (row) => <NumberCell value={row.referralCount || 0} />,
    },
    {
      key: "clicks",
      header: "Clicks",
      sortable: true,
      sortField: "clickCount",
      filterable: true,
      filterType: "number-range",
      filterLabel: "Clicks",
      cell: (row) => <NumberCell value={row.clickCount?.toLocaleString ? row.clickCount : 0} />,
    },
    {
      key: "earnings",
      header: "Earnings",
      sortable: true,
      sortField: "totalEarnings",
      filterable: true,
      filterType: "number-range",
      filterLabel: "Earnings",
      cell: (row) => (
        <CurrencyCell
          amount={row.totalEarnings || 0}
          muted={row.status === "suspended"}
        />
      ),
    },
    {
      key: "joined",
      header: "Joined",
      sortable: true,
      sortField: "_creationTime",
      filterable: true,
      filterType: "date-range",
      filterLabel: "Joined",
      cell: (row) => <DateCell value={row._creationTime} format="short" />,
    },
  ];

  const actions: TableAction<Affiliate>[] = [
    {
      label: "View",
      variant: "info",
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: (row) => onViewDetails(row),
    },
    ...(canManage
      ? [
          {
            label: "Suspend",
            variant: "warning" as const,
            icon: <PauseCircle className="w-3.5 h-3.5" />,
            disabled: (row: Affiliate) => row.status !== "active",
            onClick: (row: Affiliate) => onSuspend(row),
          },
          {
            label: "Reactivate",
            variant: "success" as const,
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            disabled: (row: Affiliate) => row.status !== "suspended",
            onClick: (row: Affiliate) => onReactivate(row),
          },
        ]
      : []),
  ];

  return { columns, actions };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

type AffiliateTabStatus = "all" | "pending" | "active" | "suspended" | "rejected";

// ---------------------------------------------------------------------------
// Inner content (hooks live here, wrapped by Suspense)
// ---------------------------------------------------------------------------

function AffiliatesContent() {
  // ── URL state via nuqs ──────────────────────────────────────────────────
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["all", "pending", "active", "suspended", "rejected"] as const).withDefault("all")
  );

  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );

  const [statuses, setStatuses] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const [campaigns, setCampaigns] = useQueryState(
    "campaign",
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1)
  );

  const [pageSize, setPageSize] = useQueryState(
    "pageSize",
    parseAsInteger.withDefault(DEFAULT_PAGE_SIZE)
  );

  // Client-side sort state — persisted in URL so back/forward and refresh work
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault("")
  );
  const [sortOrder, setSortOrder] = useQueryState(
    "order",
    parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc")
  );

  // ── Column-level filter state (URL-persisted via nuqs) ───────────────────
  const [referralMin, setReferralMin] = useQueryState("referral_min", parseAsString.withDefault(""));
  const [referralMax, setReferralMax] = useQueryState("referral_max", parseAsString.withDefault(""));
  const [clickMin, setClickMin] = useQueryState("click_min", parseAsString.withDefault(""));
  const [clickMax, setClickMax] = useQueryState("click_max", parseAsString.withDefault(""));
  const [earningsMin, setEarningsMin] = useQueryState("earnings_min", parseAsString.withDefault(""));
  const [earningsMax, setEarningsMax] = useQueryState("earnings_max", parseAsString.withDefault(""));
  const [joinedAfter, setJoinedAfter] = useQueryState("joined_after", parseAsString.withDefault(""));
  const [joinedBefore, setJoinedBefore] = useQueryState("joined_before", parseAsString.withDefault(""));

  // ── Ephemeral UI state (NOT in URL) ─────────────────────────────────────
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<Id<"affiliates">>>(new Set());
  const [rejectingAffiliate, setRejectingAffiliate] = useState<Affiliate | null>(null);
  const [suspendingAffiliate, setSuspendingAffiliate] = useState<Affiliate | null>(null);
  const [reactivatingAffiliate, setReactivatingAffiliate] = useState<Affiliate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detailDrawerAffiliate, setDetailDrawerAffiliate] = useState<Affiliate | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInviteSheetOpen, setIsInviteSheetOpen] = useState(false);

  // ── Page reset on search / filter / sort change ─────────────────────────
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statuses, campaigns, sortBy, sortOrder, referralMin, referralMax, clickMin, clickMax, earningsMin, earningsMax, joinedAfter, joinedBefore]);

  // ── Reset page to 1 when page size changes ───────────────────────────────
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  // ── RBAC ────────────────────────────────────────────────────────────────
  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManageAffiliates = currentUser?.role === "owner" || currentUser?.role === "manager";

  // ── Campaign data for dropdown ──────────────────────────────────────────
  const allCampaigns = useQuery(api.campaigns.listCampaigns, {});
  const campaignOptions = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.map((c) => ({ value: c._id, label: c.name }));
  }, [allCampaigns]);

  // ── Build query args ────────────────────────────────────────────────────
  // Map the tab → status for the Convex query.
  // When status multi-select is active, combine with tab for backend filtering.
  const effectiveStatus: AffiliateTabStatus = tab as AffiliateTabStatus;

  // Campaign IDs for the Convex query (parse as Id<"campaigns">)
  const campaignIds = useMemo(() => {
    if (campaigns.length === 0) return undefined;
    return campaigns.map((c) => c as unknown as Id<"campaigns">);
  }, [campaigns]);

  // ── Build filter query args ─────────────────────────────────────────────
  // Parse nuqs string params into typed values for Convex
  const parsedReferralMin = referralMin ? parseFloat(referralMin) : undefined;
  const parsedReferralMax = referralMax ? parseFloat(referralMax) : undefined;
  const parsedClickMin = clickMin ? parseFloat(clickMin) : undefined;
  const parsedClickMax = clickMax ? parseFloat(clickMax) : undefined;
  const parsedEarningsMin = earningsMin ? parseFloat(earningsMin) : undefined;
  const parsedEarningsMax = earningsMax ? parseFloat(earningsMax) : undefined;
  const parsedJoinedAfter = joinedAfter ? dateToStartTimestamp(joinedAfter) : undefined;
  const parsedJoinedBefore = joinedBefore ? dateToTimestamp(joinedBefore) : undefined;

  // ── Build activeFilters for DataTable ───────────────────────────────────
  const activeFilters: ColumnFilter[] = useMemo(() => {
    const filters: ColumnFilter[] = [];
    if (statuses.length > 0) {
      filters.push({ columnKey: "status", type: "select", values: statuses });
    }
    if (parsedReferralMin != null || parsedReferralMax != null) {
      filters.push({
        columnKey: "referrals",
        type: "number-range",
        min: parsedReferralMin ?? null,
        max: parsedReferralMax ?? null,
      });
    }
    if (parsedClickMin != null || parsedClickMax != null) {
      filters.push({
        columnKey: "clicks",
        type: "number-range",
        min: parsedClickMin ?? null,
        max: parsedClickMax ?? null,
      });
    }
    if (parsedEarningsMin != null || parsedEarningsMax != null) {
      filters.push({
        columnKey: "earnings",
        type: "number-range",
        min: parsedEarningsMin ?? null,
        max: parsedEarningsMax ?? null,
      });
    }
    if (parsedJoinedAfter != null || parsedJoinedBefore != null) {
      filters.push({
        columnKey: "joined",
        type: "date-range",
        after: parsedJoinedAfter ?? null,
        before: parsedJoinedBefore ?? null,
      });
    }
    if (campaigns.length > 0) {
      filters.push({ columnKey: "campaign", type: "select", values: campaigns });
    }
    return filters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statuses, referralMin, referralMax, clickMin, clickMax, earningsMin, earningsMax, joinedAfter, joinedBefore, campaigns]);

  // ── onFilterChange handler — maps ColumnFilter changes to nuqs params ───
  const handleFilterChange = (filters: ColumnFilter[]) => {
    // Find what changed by comparing with current activeFilters
    const currentKeys = new Set(activeFilters.map((f) => f.columnKey));
    const nextKeys = new Set(filters.map((f) => f.columnKey));

    // Handle removals (clear nuqs params for removed columns)
    for (const key of currentKeys) {
      if (!nextKeys.has(key)) {
        clearFilterForColumn(key);
      }
    }

    // Handle additions/updates
    for (const filter of filters) {
      applyFilter(filter);
    }
  };

  const applyFilter = (filter: ColumnFilter) => {
    switch (filter.columnKey) {
      case "status":
        setStatuses(filter.values ?? []);
        break;
      case "referrals":
        setReferralMin(filter.min != null ? String(filter.min) : "");
        setReferralMax(filter.max != null ? String(filter.max) : "");
        break;
      case "clicks":
        setClickMin(filter.min != null ? String(filter.min) : "");
        setClickMax(filter.max != null ? String(filter.max) : "");
        break;
      case "earnings":
        setEarningsMin(filter.min != null ? String(filter.min) : "");
        setEarningsMax(filter.max != null ? String(filter.max) : "");
        break;
      case "joined":
        setJoinedAfter(filter.after != null ? timestampToDateInput(filter.after) : "");
        setJoinedBefore(filter.before != null ? timestampToDateInput(filter.before) : "");
        break;
      case "campaign":
        setCampaigns(filter.values ?? []);
        break;
    }
  };

  const clearFilterForColumn = (columnKey: string) => {
    switch (columnKey) {
      case "status":
        setStatuses([]);
        break;
      case "referrals":
        setReferralMin("");
        setReferralMax("");
        break;
      case "clicks":
        setClickMin("");
        setClickMax("");
        break;
      case "earnings":
        setEarningsMin("");
        setEarningsMax("");
        break;
      case "joined":
        setJoinedAfter("");
        setJoinedBefore("");
        break;
      case "campaign":
        setCampaigns([]);
        break;
    }
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setStatuses([]);
    setReferralMin("");
    setReferralMax("");
    setClickMin("");
    setClickMax("");
    setEarningsMin("");
    setEarningsMax("");
    setJoinedAfter("");
    setJoinedBefore("");
    setCampaigns([]);
  };

  // ── Main query — all tabs use paginated filtered query ──────────────────
  // NOTE: On first render during loading, `page` is used directly. Once data loads,
  // maxPage stabilizes and pagination buttons work correctly.
  const paginatedResult = useQuery(
    api.affiliates.listAffiliatesFiltered,
    {
      status: effectiveStatus,
      statuses: statuses.length > 0 ? statuses : undefined,
      campaignIds,
      page,
      numItems: pageSize,
      // Server-side filters
      searchQuery: search.trim() || undefined,
      referralMin: parsedReferralMin,
      referralMax: parsedReferralMax,
      clickMin: parsedClickMin,
      clickMax: parsedClickMax,
      earningsMin: parsedEarningsMin,
      earningsMax: parsedEarningsMax,
      joinedAfter: parsedJoinedAfter,
      joinedBefore: parsedJoinedBefore,
      // Server-side sort
      sortBy: sortBy ? (sortBy as "name" | "status" | "campaignName" | "referralCount" | "clickCount" | "totalEarnings" | "_creationTime") : undefined,
      sortOrder: sortBy ? sortOrder : undefined,
    }
  );

  const isLoading = paginatedResult === undefined;

  const total = paginatedResult?.total ?? 0;

  const hasMore = paginatedResult?.hasMore ?? false;

  // Stable maxPage — during loading, preserve the user's requested page so
  // pagination buttons stay enabled while data refetches.
  const rawMaxPage = Math.max(1, Math.ceil(total / pageSize));
  const maxPage = isLoading ? Math.max(page, rawMaxPage) : rawMaxPage;

  // ── Tab counts ──────────────────────────────────────────────────────────
  const counts = useQuery(api.affiliates.getAffiliateCountByStatus, {}) || {
    pending: 0,
    active: 0,
    suspended: 0,
    rejected: 0,
    total: 0,
  };

  // ── Affiliate detail drawer stats ───────────────────────────────────────
  const affiliateStats = useQuery(
    api.affiliates.getAffiliateStats,
    detailDrawerAffiliate ? { affiliateId: detailDrawerAffiliate._id } : "skip"
  );
  const isStatsLoading = affiliateStats === undefined;

  // ── Mutations ───────────────────────────────────────────────────────────
  const approveAffiliate = useMutation(api.affiliates.approveAffiliate);
  const rejectAffiliate = useMutation(api.affiliates.rejectAffiliate);
  const suspendAffiliate = useMutation(api.affiliates.suspendAffiliate);
  const reactivateAffiliate = useMutation(api.affiliates.reactivateAffiliate);
  const bulkApproveAffiliates = useMutation(api.affiliates.bulkApproveAffiliates);
  const bulkRejectAffiliates = useMutation(api.affiliates.bulkRejectAffiliates);
  const updateNote = useMutation(api.affiliates.updateAffiliateNote);

  // ── CSV Export ─────────────────────────────────────────────────────────
  const exportCSV = useAction(api.reportsExport.exportAffiliatePerformanceCSV);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    const tenantId = currentUser?.tenantId;
    if (!tenantId) {
      toast.error("Unable to export: tenant not found.");
      return;
    }

    setIsExporting(true);
    try {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const base64Data = await exportCSV({
        tenantId,
        dateRange: { start: thirtyDaysAgo, end: now },
        campaignId: campaignIds?.[0], // use first selected campaign if any
      });

      downloadCsv(base64Data, "affiliates");
      toast.success("Affiliate data exported successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export affiliate data.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Use server-side filtered/sorted data directly ───────────────────────
  const allAffiliates = paginatedResult?.page ?? [];


  // ── Handlers ────────────────────────────────────────────────────────────
  const handleApprove = async (affiliateId: Id<"affiliates">, affiliateName: string) => {
    try {
      await approveAffiliate({ affiliateId });
      toast.success(`Approved ${affiliateName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve affiliate");
    }
  };

  const handleReject = async (affiliateId: Id<"affiliates">, reason: string) => {
    if (!rejectingAffiliate) return;
    try {
      await rejectAffiliate({ affiliateId, reason: reason || undefined });
      toast.success(`Rejected ${rejectingAffiliate.name}`);
      setRejectingAffiliate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject affiliate");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedAffiliates.size === 0) return;
    setIsProcessing(true);
    try {
      const result = await bulkApproveAffiliates({ affiliateIds: Array.from(selectedAffiliates) });
      toast.success(`Approved ${result.success} affiliates${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
      setSelectedAffiliates(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bulk approve affiliates");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedAffiliates.size === 0) return;
    setIsProcessing(true);
    try {
      const result = await bulkRejectAffiliates({ affiliateIds: Array.from(selectedAffiliates) });
      toast.success(`Rejected ${result.success} affiliates${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
      setSelectedAffiliates(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bulk reject affiliates");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuspend = async (affiliateId: Id<"affiliates">, reason: string) => {
    if (!suspendingAffiliate) return;
    try {
      await suspendAffiliate({ affiliateId, reason });
      toast.success(`${suspendingAffiliate.name} has been suspended`);
      setSuspendingAffiliate(null);
      setIsDrawerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend affiliate");
    }
  };

  const handleReactivate = async (affiliateId: Id<"affiliates">) => {
    if (!reactivatingAffiliate) return;
    try {
      await reactivateAffiliate({ affiliateId });
      toast.success(`${reactivatingAffiliate.name} has been reactivated`);
      setReactivatingAffiliate(null);
      setIsDrawerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reactivate affiliate");
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!detailDrawerAffiliate) return;
    try {
      await updateNote({ affiliateId: detailDrawerAffiliate._id, note });
      toast.success("Note saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save note");
    }
  };

  const handleViewDetails = (affiliate: Affiliate) => {
    setDetailDrawerAffiliate(affiliate);
    setIsDrawerOpen(true);
  };

  const handleClearSelection = () => setSelectedAffiliates(new Set());

  // ── Column configs ─────────────────────────────────────────────────────
  const pendingCols = buildPendingColumns(
    canManageAffiliates,
    handleApprove,
    (affiliate) => setRejectingAffiliate(affiliate),
    campaignOptions
  );
  const activeCols = buildActiveColumns(
    canManageAffiliates,
    (affiliate) => setSuspendingAffiliate(affiliate),
    (affiliate) => setReactivatingAffiliate(affiliate),
    handleViewDetails,
    campaignOptions
  );

  // Prepare drawer data
  const drawerAffiliate = detailDrawerAffiliate
    ? {
        ...detailDrawerAffiliate,
        joinDate: detailDrawerAffiliate._creationTime,
        referralCount: affiliateStats?.totalConversions,
        clickCount: affiliateStats?.totalClicks,
        totalEarnings: affiliateStats?.totalCommissions,
        pendingPayout: affiliateStats?.pendingCommissions,
        recentCommissions: [],
      }
    : null;

  // ── Pagination handler ─────────────────────────────────────────────────
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > maxPage) return;
    setPage(newPage);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      {/* Top Bar */}
      <AffiliateTopbar onExport={handleExportCSV} isExporting={isExporting} onInvite={() => setIsInviteSheetOpen(true)} />

      {/* Page Content */}
      <div className="px-8 py-7">
        {/* Tabs */}
        <AffiliateTabs
          activeTab={tab as AffiliateTabStatus}
          onTabChange={(t) => {
            setTab(t);
            setPage(1);
            // Clear status multi-select when switching tabs
            if (t !== "all") setStatuses([]);
          }}
          counts={counts}
        />

        {/* All Tab Content */}
        {tab === "all" && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[#333]">All Affiliates</h2>
            </div>

            <AffiliateToolbar
              searchQuery={search}
              onSearchChange={setSearch}
            />

            <FilterChips<Affiliate>
              filters={activeFilters}
              columns={activeCols.columns}
              onRemove={clearFilterForColumn}
              onClearAll={handleClearAllFilters}
            />

            <DataTable<Affiliate>
              columns={activeCols.columns}
              actions={activeCols.actions}
              data={allAffiliates}
              getRowId={(row) => row._id}
              isLoading={isLoading}
              emptyMessage="No affiliates found"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
              }}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              pagination={{ page, pageSize }}
              total={total}
              onPaginationChange={({ page: newPage, pageSize: newPageSize }) => {
                setPage(newPage);
                if (newPageSize !== pageSize) {
                  handlePageSizeChange(newPageSize);
                }
              }}
            />
          </div>
        )}

        {/* Pending Tab Content */}
        {tab === "pending" && (
          <>
            <PendingBanner count={counts.pending} />

            {canManageAffiliates && selectedAffiliates.size > 0 && (
              <div className="mb-4 -mt-4">
                <BulkActionBar
                  selectedCount={selectedAffiliates.size}
                  onApproveAll={handleBulkApprove}
                  onRejectAll={handleBulkReject}
                  onClearSelection={handleClearSelection}
                  isProcessing={isProcessing}
                />
              </div>
            )}

            <AffiliateToolbar
              searchQuery={search}
              onSearchChange={setSearch}
            />

            <FilterChips<Affiliate>
              filters={activeFilters}
              columns={pendingCols.columns}
              onRemove={clearFilterForColumn}
              onClearAll={handleClearAllFilters}
            />

            <DataTable<Affiliate>
              columns={pendingCols.columns}
              actions={pendingCols.actions}
              data={allAffiliates}
              getRowId={(row) => row._id}
              selectable={true}
              selectedIds={selectedAffiliates as Set<string | number>}
              onSelectionChange={(ids) => setSelectedAffiliates(new Set(ids as Set<Id<"affiliates">>))}
              isLoading={isLoading}
              emptyMessage="No pending affiliates found"
              rowClassName={(row) =>
                selectedAffiliates.has(row._id) ? "bg-[#fffbeb]" : ""
              }
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
              }}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              pagination={{ page, pageSize }}
              total={total}
              onPaginationChange={({ page: newPage, pageSize: newPageSize }) => {
                setPage(newPage);
                if (newPageSize !== pageSize) {
                  handlePageSizeChange(newPageSize);
                }
                // Clear selection when changing pages since bulk actions
                // only operate on currently visible rows
                setSelectedAffiliates(new Set());
              }}
            />
          </>
        )}

        {/* Active / Suspended / Rejected Tab Content */}
        {(tab === "active" || tab === "suspended" || tab === "rejected") && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[#333]">
                {tab === "active" ? "All Active Affiliates" : tab === "suspended" ? "Suspended Affiliates" : "Rejected Affiliates"}
              </h2>
            </div>

            <AffiliateToolbar
              searchQuery={search}
              onSearchChange={setSearch}
            />

            <FilterChips<Affiliate>
              filters={activeFilters}
              columns={activeCols.columns}
              onRemove={clearFilterForColumn}
              onClearAll={handleClearAllFilters}
            />

            <DataTable<Affiliate>
              columns={activeCols.columns}
              actions={activeCols.actions}
              data={allAffiliates}
              getRowId={(row) => row._id}
              isLoading={isLoading}
              emptyMessage={`No ${tab} affiliates found`}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
              }}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              pagination={{ page, pageSize }}
              total={total}
              onPaginationChange={({ page: newPage, pageSize: newPageSize }) => {
                setPage(newPage);
                if (newPageSize !== pageSize) {
                  handlePageSizeChange(newPageSize);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Invite Affiliate Sheet */}
      <InviteAffiliateSheet
        isOpen={isInviteSheetOpen}
        onClose={() => setIsInviteSheetOpen(false)}
      />

      {/* Affiliate Detail Drawer */}
      <AffiliateDetailDrawer
        affiliate={drawerAffiliate}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSaveNote={handleSaveNote}
        onSuspend={
          drawerAffiliate?.status === "active" && suspendingAffiliate
            ? () => {}
            : undefined
        }
        onReactivate={
          drawerAffiliate?.status === "suspended" && reactivatingAffiliate
            ? () => {}
            : undefined
        }
        isStatsLoading={isStatsLoading}
      />

      {/* Rejection Dialog */}
      <RejectionDialog
        isOpen={rejectingAffiliate !== null}
        onClose={() => setRejectingAffiliate(null)}
        onConfirm={async (reason) => {
          if (rejectingAffiliate) {
            await handleReject(rejectingAffiliate._id, reason);
          }
        }}
        affiliateName={rejectingAffiliate?.name || ""}
      />

      {/* Suspend Dialog */}
      <SuspendDialog
        isOpen={suspendingAffiliate !== null}
        onClose={() => setSuspendingAffiliate(null)}
        onConfirm={async (reason) => {
          if (suspendingAffiliate) {
            await handleSuspend(suspendingAffiliate._id, reason);
          }
        }}
        affiliateName={suspendingAffiliate?.name || ""}
      />

      {/* Reactivate Dialog */}
      <ReactivateDialog
        isOpen={reactivatingAffiliate !== null}
        onClose={() => setReactivatingAffiliate(null)}
        onConfirm={async () => {
          if (reactivatingAffiliate) {
            await handleReactivate(reactivatingAffiliate._id);
          }
        }}
        affiliateName={reactivatingAffiliate?.name || ""}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page skeleton (shown while nuqs Suspense boundary is resolving)
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      <AffiliateTopbar />
      <div className="px-8 py-7">
        <div className="border-b-2 border-[#e5e7eb] mb-6">
          <div className="flex gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        </div>
        <div className="mt-8 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — wraps inner content in Suspense for nuqs
// ---------------------------------------------------------------------------

export default function AffiliatesPageClient() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AffiliatesContent />
    </Suspense>
  );
}
