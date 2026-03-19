"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
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
} from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, PauseCircle, CheckCircle2 } from "lucide-react";

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
  onReject: (affiliate: Affiliate) => void
): { columns: TableColumn<Affiliate>[]; actions: TableAction<Affiliate>[] } {
  const columns: TableColumn<Affiliate>[] = [
    {
      key: "applicant",
      header: "Applicant",
      cell: (row) => (
        <AvatarCell name={row.name} email={row.email} />
      ),
    },
    {
      key: "applied",
      header: "Applied",
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
  onViewDetails: (affiliate: Affiliate) => void
): { columns: TableColumn<Affiliate>[]; actions: TableAction<Affiliate>[] } {
  const columns: TableColumn<Affiliate>[] = [
    {
      key: "affiliate",
      header: "Affiliate",
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
      // TODO: Enable sortable: true once Convex query supports sorting
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadgeCell status={row.status} />,
      // TODO: Enable sortable: true once Convex query supports sorting
    },
    {
      key: "campaign",
      header: "Campaign",
      cell: (row) => (
        <span className="text-[12px] text-[#474747]">
          {row.campaignName || "Standard Program"}
        </span>
      ),
    },
    {
      key: "referrals",
      header: "Referrals",
      cell: (row) => <NumberCell value={row.referralCount || 0} />,
      // TODO: Enable sortable: true once Convex query supports sorting
    },
    {
      key: "clicks",
      header: "Clicks",
      cell: (row) => <NumberCell value={row.clickCount?.toLocaleString ? row.clickCount : 0} />,
      // TODO: Enable sortable: true once Convex query supports sorting
    },
    {
      key: "earnings",
      header: "Earnings",
      align: "right",
      cell: (row) => (
        <CurrencyCell
          amount={row.totalEarnings || 0}
          muted={row.status === "suspended"}
        />
      ),
      // TODO: Enable sortable: true once Convex query supports sorting
    },
    {
      key: "joined",
      header: "Joined",
      cell: (row) => <DateCell value={row._creationTime} format="short" />,
      // TODO: Enable sortable: true once Convex query supports sorting
    },
  ];

  const actions: TableAction<Affiliate>[] = [
    {
      label: "View",
      variant: "outline",
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: (row) => onViewDetails(row),
    },
    ...(canManage
      ? [
          {
            label: "Suspend",
            variant: "outline" as const,
            icon: <PauseCircle className="w-3.5 h-3.5" />,
            disabled: (row: Affiliate) => row.status !== "active",
            onClick: (row: Affiliate) => onSuspend(row),
          },
          {
            label: "Reactivate",
            variant: "default" as const,
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

type AffiliateTabStatus = "all" | "pending" | "active" | "suspended";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

// ---------------------------------------------------------------------------
// Inner content (hooks live here, wrapped by Suspense)
// ---------------------------------------------------------------------------

function AffiliatesContent() {
  // ── URL state via nuqs ──────────────────────────────────────────────────
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["all", "pending", "active", "suspended"] as const).withDefault("all")
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

  // ── Ephemeral UI state (NOT in URL) ─────────────────────────────────────
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<Id<"affiliates">>>(new Set());
  const [rejectingAffiliate, setRejectingAffiliate] = useState<Affiliate | null>(null);
  const [suspendingAffiliate, setSuspendingAffiliate] = useState<Affiliate | null>(null);
  const [reactivatingAffiliate, setReactivatingAffiliate] = useState<Affiliate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detailDrawerAffiliate, setDetailDrawerAffiliate] = useState<Affiliate | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ── Page reset on search / filter change ────────────────────────────────
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statuses, campaigns]);

  // ── RBAC ────────────────────────────────────────────────────────────────
  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManageAffiliates = currentUser?.role === "owner" || currentUser?.role === "manager";

  // ── Campaign data for dropdown ──────────────────────────────────────────
  const allCampaigns = useQuery(api.campaigns.listCampaigns, {});
  const campaignOptions = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.map((c) => ({
      value: c._id as unknown as string,
      label: c.name,
    }));
  }, [allCampaigns]);
  const isLoadingCampaigns = allCampaigns === undefined;

  // ── Build query args ────────────────────────────────────────────────────
  // Map the tab → status for the Convex query.
  // When status multi-select is active, combine with tab for backend filtering.
  const effectiveStatus: AffiliateTabStatus = tab as AffiliateTabStatus;

  // Campaign IDs for the Convex query (parse as Id<"campaigns">)
  const campaignIds = useMemo(() => {
    if (campaigns.length === 0) return undefined;
    return campaigns.map((c) => c as unknown as Id<"campaigns">);
  }, [campaigns]);

  // ── Main query (non-pending tabs use paginated filtered query) ──────────
  const isPendingTab = tab === "pending";

  // For pending tab, use legacy query (no pagination — keeps bulk action compatibility)
  const legacyResult = useQuery(
    api.affiliates.listAffiliatesByStatus,
    isPendingTab ? { status: "pending" as const } : "skip"
  );

  // For non-pending tabs, use paginated filtered query
  const paginatedResult = useQuery(
    api.affiliates.listAffiliatesFiltered,
    !isPendingTab
      ? {
          status: effectiveStatus,
          statuses: statuses.length > 0 ? statuses : undefined,
          campaignIds,
          page: page,
          numItems: PAGE_SIZE,
        }
      : "skip"
  );

  const isLoading = isPendingTab
    ? legacyResult === undefined
    : paginatedResult === undefined;

  const total = isPendingTab
    ? (legacyResult?.length ?? 0)
    : (paginatedResult?.total ?? 0);

  const hasMore = isPendingTab ? false : (paginatedResult?.hasMore ?? false);

  // Page clamping — if page exceeds max, clamp to last valid page
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (!isPendingTab && page > maxPage) {
      setPage(maxPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPage, isPendingTab]);

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

  // ── Client-side search filter (applied to current page results) ─────────
  const allAffiliates = isPendingTab ? (legacyResult ?? []) : (paginatedResult?.page ?? []);

  const filteredAffiliates = useMemo(() => {
    if (!search.trim()) return allAffiliates;
    const q = search.toLowerCase().trim();
    return allAffiliates.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.uniqueCode.toLowerCase().includes(q)
    );
  }, [allAffiliates, search]);

  // ── Determine which status filter options to show ──────────────────────
  // On "all" tab, show active + suspended. On specific tab, no status filter.
  const visibleStatusOptions = tab === "all" ? STATUS_OPTIONS : [];

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
    (affiliate) => setRejectingAffiliate(affiliate)
  );
  const activeCols = buildActiveColumns(
    canManageAffiliates,
    (affiliate) => setSuspendingAffiliate(affiliate),
    (affiliate) => setReactivatingAffiliate(affiliate),
    handleViewDetails
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
      <AffiliateTopbar />

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
              statusOptions={visibleStatusOptions}
              selectedStatuses={statuses}
              onStatusesChange={setStatuses}
              campaignOptions={campaignOptions}
              selectedCampaigns={campaigns}
              onCampaignsChange={setCampaigns}
              isLoadingCampaigns={isLoadingCampaigns}
            />

            <DataTable<Affiliate>
              columns={activeCols.columns}
              actions={activeCols.actions}
              data={filteredAffiliates}
              getRowId={(row) => row._id}
              isLoading={isLoading}
              emptyMessage="No affiliates found"
            />

            {/* Pagination */}
            {!isLoading && total > 0 && (
              <div className="mt-4 flex items-center justify-between text-[12px] text-[#6b7280]">
                <span>
                  Showing {filteredAffiliates.length} of {total} affiliates
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="p-1.5 border border-[#e5e7eb] rounded-md hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-3 py-1.5 text-[12px] font-medium">
                    Page {page} of {maxPage}
                  </span>
                  <button
                    disabled={page >= maxPage}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-1.5 border border-[#e5e7eb] rounded-md hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
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
            />
          </>
        )}

        {/* Active / Suspended Tab Content */}
        {(tab === "active" || tab === "suspended") && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[#333]">
                {tab === "active" ? "All Active Affiliates" : "Suspended Affiliates"}
              </h2>
            </div>

            <AffiliateToolbar
              searchQuery={search}
              onSearchChange={setSearch}
              statusOptions={visibleStatusOptions}
              selectedStatuses={statuses}
              onStatusesChange={setStatuses}
              campaignOptions={campaignOptions}
              selectedCampaigns={campaigns}
              onCampaignsChange={setCampaigns}
              isLoadingCampaigns={isLoadingCampaigns}
            />

            <DataTable<Affiliate>
              columns={activeCols.columns}
              actions={activeCols.actions}
              data={filteredAffiliates}
              getRowId={(row) => row._id}
              isLoading={isLoading}
              emptyMessage={`No ${tab} affiliates found`}
            />

            {/* Pagination */}
            {!isLoading && total > 0 && (
              <div className="mt-4 flex items-center justify-between text-[12px] text-[#6b7280]">
                <span>
                  Showing {filteredAffiliates.length} of {total} affiliates
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="p-1.5 border border-[#e5e7eb] rounded-md hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-3 py-1.5 text-[12px] font-medium">
                    Page {page} of {maxPage}
                  </span>
                  <button
                    disabled={page >= maxPage}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-1.5 border border-[#e5e7eb] rounded-md hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
