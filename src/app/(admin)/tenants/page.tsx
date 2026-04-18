"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import { StatsRow } from "./_components/StatsRow";
import { SearchInput } from "./_components/SearchInput";
import { FilterPills, type Filter } from "./_components/FilterPills";
import { TenantTable, type TenantSortField } from "./_components/TenantTable";
import { EmptyState } from "./_components/EmptyState";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { FilterChips } from "@/components/ui/FilterChips";
import { MetricCard } from "@/components/ui/MetricCard";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import type { ColumnFilter, TableColumn } from "@/components/ui/DataTable";
import { Loader2, Users, DollarSign, CreditCard, Target, AlertTriangle, Shield } from "lucide-react";
import { dateToStartTimestamp, dateToTimestamp, timestampToDateInput } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tenant {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  domain: string | undefined;
  plan: string;
  status: string;
  subscriptionStatus?: string;
  ownerEmail: string;
  affiliateCount: number;
  mrr: number;
  isFlagged: boolean;
}

type ViewMode = "tenants" | "analytics";

// ---------------------------------------------------------------------------
// View Toggle
// ---------------------------------------------------------------------------

function ViewToggle({ activeView, onViewChange }: { activeView: ViewMode; onViewChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] p-1 border border-[var(--border-light)]">
      {([
        { key: "tenants" as const, label: "Tenant List" },
        { key: "analytics" as const, label: "Platform Analytics" },
      ]).map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onViewChange(key)}
          className={cn(
            "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
            activeView === key
              ? "bg-white text-[var(--text-heading)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform Analytics Content (lazy-loaded via conditional rendering)
// ---------------------------------------------------------------------------

function PlatformAnalyticsContent() {
  const kpis = usePlatformStats();
  const leaderboardResult = useQuery(api.admin.platformStats.getTenantLeaderboard, {
    paginationOpts: { numItems: 20, cursor: null },
  });

  const isLoading = kpis === undefined || leaderboardResult === undefined;

  const isStale = kpis ? (Date.now() - kpis.lastUpdatedAt > 2 * 60 * 60 * 1000) : false;

  return (
    <div className="space-y-6">
      {isStale && (
        <FadeIn delay={0}>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              Platform stats were last updated {kpis ? new Date(kpis.lastUpdatedAt).toLocaleString() : "unknown"}. Data may be stale.
            </span>
          </div>
        </FadeIn>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Active Tenants"
          numericValue={kpis?.activeTenantCount ?? 0}
          subtext="Non-deleted accounts"
          isLoading={isLoading}
          variant="blue"
          icon={<Shield className="w-4 h-4" />}
        />
        <MetricCard
          label="Active Affiliates"
          numericValue={kpis?.totalActiveAffiliates ?? 0}
          subtext="Across all tenants"
          isLoading={isLoading}
          variant="green"
          icon={<Users className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Commissions"
          numericValue={kpis?.totalCommissions ?? 0}
          subtext="All-time across platform"
          isLoading={isLoading}
          variant="blue"
          icon={<CreditCard className="w-4 h-4" />}
        />
        <MetricCard
          label="Total Conversions"
          numericValue={kpis?.totalConversions ?? 0}
          subtext="Platform-wide"
          isLoading={isLoading}
          variant="green"
          icon={<Target className="w-4 h-4" />}
        />
        <MetricCard
          label="Fraud Signals"
          numericValue={kpis?.totalFraudSignals ?? 0}
          subtext={kpis && kpis.totalFraudSignals > 0 ? "Requires investigation" : "No signals detected"}
          isLoading={isLoading}
          variant={kpis && kpis.totalFraudSignals > 0 ? "red" : "green"}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {/* Tenant Leaderboard */}
      <FadeIn delay={120}>
        <div className="bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm">
          <div className="px-5 py-4 border-b border-[var(--border-light)]">
            <h2 className="text-sm font-semibold text-[var(--text-heading)]">Tenant Leaderboard</h2>
            <p className="text-[12px] text-[var(--text-muted)]">Ranked by commissions confirmed this month</p>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/20 to-transparent" />

          {isLoading ? (
            <div className="divide-y divide-[var(--border-light)]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4">
                  <div className="h-4 w-8 bg-[var(--border-light)] rounded" />
                  <div className="h-4 w-32 bg-[var(--border-light)] rounded" />
                  <div className="h-4 w-16 bg-[var(--border-light)] rounded" />
                  <div className="h-4 w-16 bg-[var(--border-light)] rounded" />
                  <div className="h-4 w-16 bg-[var(--border-light)] rounded" />
                </div>
              ))}
            </div>
          ) : leaderboardResult && leaderboardResult.page.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[12px] text-[var(--text-muted)] border-b border-[var(--border-light)]">
                    <th className="text-left px-5 py-2.5 font-medium">#</th>
                    <th className="text-left px-2 py-2.5 font-medium">Tenant</th>
                    <th className="text-right px-2 py-2.5 font-medium">Plan</th>
                    <th className="text-right px-2 py-2.5 font-medium">Affiliates</th>
                    <th className="text-right px-2 py-2.5 font-medium">Confirmed</th>
                    <th className="text-right px-2 py-2.5 font-medium">Clicks</th>
                    <th className="text-right px-2 py-2.5 font-medium">Conversions</th>
                    <th className="text-right px-5 py-2.5 font-medium">Flagged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {leaderboardResult.page.map((tenant, index) => (
                    <tr key={tenant.tenantId} className="hover:bg-[var(--brand-light)]/20 transition-colors">
                      <td className="px-5 py-2.5 text-[12px] text-[var(--text-muted)]">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="text-sm font-medium text-[var(--text-heading)]">
                          {tenant.tenantName}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] text-[var(--text-muted)] capitalize">
                        {tenant.plan}
                      </td>
                      <td className="px-2 py-2.5 text-right text-sm font-medium text-[var(--text-heading)]">
                        {tenant.affiliatesActive}
                      </td>
                      <td className="px-2 py-2.5 text-right text-sm font-medium text-[var(--text-heading)]">
                        {tenant.commissionsConfirmedThisMonth}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] text-[var(--text-muted)]">
                        {tenant.totalClicksThisMonth}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] text-[var(--text-muted)]">
                        {tenant.totalConversionsThisMonth}
                      </td>
                      <td className={cn(
                        "px-5 py-2.5 text-right text-sm font-medium",
                        tenant.commissionsFlagged > 0 ? "text-red-600" : "text-[var(--text-muted)]"
                      )}>
                        {tenant.commissionsFlagged}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-12 text-center text-[var(--text-muted)]">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tenant data available yet</p>
              <p className="text-[12px] mt-1">Platform stats will populate as tenants generate activity</p>
            </div>
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/10 to-transparent" />
        </div>
      </FadeIn>
    </div>
  );
}

function PlatformAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-24 bg-[var(--border-light)] rounded" />
              <div className="h-4 w-4 bg-[var(--border-light)] rounded" />
            </div>
            <div className="h-7 w-20 bg-[var(--border-light)] rounded" />
            <div className="h-3 w-36 bg-[var(--border-light)] rounded mt-2" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-[var(--border-light)] p-5">
        <div className="h-4 w-40 bg-[var(--border-light)] rounded mb-1" />
        <div className="h-3 w-60 bg-[var(--border-light)] rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-6 bg-[var(--border-light)] rounded" />
              <div className="h-4 w-32 bg-[var(--border-light)] rounded" />
              <div className="h-4 w-16 bg-[var(--border-light)] rounded" />
              <div className="h-4 w-16 bg-[var(--border-light)] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenant List Content (extracted from original AdminTenantsContent)
// ---------------------------------------------------------------------------

function TenantListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL-persisted state ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [activeFilter, setActiveFilter] = useState<Filter>(
    (searchParams.get("filter") as Filter) || "all"
  );
  const [page, setPage] = useState(
    Number(searchParams.get("page")) || 1
  );
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE
  );
  const [sortField, setSortField] = useState<TenantSortField>(
    (searchParams.get("sort") as TenantSortField) || "_creationTime"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("order") as "asc" | "desc") || "desc"
  );

  // ── Column-level filter state ────────────────────────────────────────────
  const [tenantNameFilter, setTenantNameFilter] = useState(
    searchParams.get("name") || ""
  );
  const [planFilter, setPlanFilter] = useState(
    searchParams.get("plan") || ""
  );
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState(
    searchParams.get("subscriptionStatus") || ""
  );
  const [statusColFilter, setStatusColFilter] = useState(
    searchParams.get("col_status") || ""
  );
  const [affiliateMin, setAffiliateMin] = useState(
    searchParams.get("aff_min") || ""
  );
  const [affiliateMax, setAffiliateMax] = useState(
    searchParams.get("aff_max") || ""
  );
  const [mrrMin, setMrrMin] = useState(
    searchParams.get("mrr_min") || ""
  );
  const [mrrMax, setMrrMax] = useState(
    searchParams.get("mrr_max") || ""
  );
  const [createdAfter, setCreatedAfter] = useState(
    searchParams.get("created_after") || ""
  );
  const [createdBefore, setCreatedBefore] = useState(
    searchParams.get("created_before") || ""
  );

  // Debounced search (500ms)
  const debouncedSearch = useDebounce(searchQuery, 500);

  // ── Convex cursor state (opaque string from Convex pagination) ─────────
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // ── Convex query ─────────────────────────────────────────────────────────
  const stats = useQuery(api.admin.tenants.getPlatformStats);
  const result = useQuery(
    api.admin.tenants.searchTenants,
    {
      searchQuery: debouncedSearch || undefined,
      statusFilter: activeFilter === "all" ? undefined : activeFilter,
      cursor: page > 1 ? cursor : undefined,
      numItems: pageSize,
    }
  );

  // ── Sync state to URL query params ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (activeFilter !== "all") params.set("filter", activeFilter);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
    if (sortField !== "_creationTime") params.set("sort", sortField);
    if (sortOrder !== "desc") params.set("order", sortOrder);
    if (tenantNameFilter) params.set("name", tenantNameFilter);
    if (planFilter) params.set("plan", planFilter);
    if (subscriptionStatusFilter) params.set("subscriptionStatus", subscriptionStatusFilter);
    if (subscriptionStatusFilter) params.set("subscriptionStatus", subscriptionStatusFilter);
    if (statusColFilter) params.set("col_status", statusColFilter);
    if (affiliateMin) params.set("aff_min", affiliateMin);
    if (affiliateMax) params.set("aff_max", affiliateMax);
    if (mrrMin) params.set("mrr_min", mrrMin);
    if (mrrMax) params.set("mrr_max", mrrMax);
    if (createdAfter) params.set("created_after", createdAfter);
    if (createdBefore) params.set("created_before", createdBefore);

    const queryString = params.toString();
    router.replace(
      `/tenants${queryString ? `?${queryString}` : ""}`,
      { scroll: false }
    );
  }, [
    debouncedSearch,
    activeFilter,
    page,
    pageSize,
    sortField,
    sortOrder,
    tenantNameFilter,
    planFilter,
    subscriptionStatusFilter,
    statusColFilter,
    affiliateMin,
    affiliateMax,
    mrrMin,
    mrrMax,
    createdAfter,
    createdBefore,
    router,
  ]);

  // ── Sync cursor from Convex response ────────────────────────────────────
  useEffect(() => {
    if (result?.nextCursor) {
      setCursor(result.nextCursor);
    }
  }, [result?.nextCursor]);

  // ── Reset page and cursor when filter/search changes ────────────────────
  useEffect(() => {
    setPage(1);
    setCursor(undefined);
  }, [debouncedSearch, activeFilter, tenantNameFilter, planFilter, subscriptionStatusFilter, statusColFilter, affiliateMin, affiliateMax, mrrMin, mrrMax, createdAfter, createdBefore]);

  // ── Build activeFilters for DataTable & FilterChips ──────────────────────
  const activeFilters = useMemo<ColumnFilter[]>(() => {
    const filters: ColumnFilter[] = [];
    if (tenantNameFilter.trim()) {
      filters.push({ columnKey: "name", type: "text", value: tenantNameFilter.trim() });
    }
    if (planFilter) {
      filters.push({ columnKey: "plan", type: "select", values: planFilter.split(",") });
    }
    if (subscriptionStatusFilter) {
      filters.push({ columnKey: "subscriptionStatus", type: "select", values: subscriptionStatusFilter.split(",") });
    }
    if (statusColFilter) {
      filters.push({ columnKey: "status", type: "select", values: statusColFilter.split(",") });
    }
    const parsedAffMin = affiliateMin ? parseFloat(affiliateMin) : undefined;
    const parsedAffMax = affiliateMax ? parseFloat(affiliateMax) : undefined;
    if (parsedAffMin != null || parsedAffMax != null) {
      filters.push({
        columnKey: "affiliateCount",
        type: "number-range",
        min: parsedAffMin ?? null,
        max: parsedAffMax ?? null,
      });
    }
    const parsedMrrMin = mrrMin ? parseFloat(mrrMin) : undefined;
    const parsedMrrMax = mrrMax ? parseFloat(mrrMax) : undefined;
    if (parsedMrrMin != null || parsedMrrMax != null) {
      filters.push({
        columnKey: "mrr",
        type: "number-range",
        min: parsedMrrMin ?? null,
        max: parsedMrrMax ?? null,
      });
    }
    const parsedCreatedAfter = createdAfter ? dateToStartTimestamp(createdAfter) : undefined;
    const parsedCreatedBefore = createdBefore ? dateToTimestamp(createdBefore) : undefined;
    if (parsedCreatedAfter != null || parsedCreatedBefore != null) {
      filters.push({
        columnKey: "created",
        type: "date-range",
        after: parsedCreatedAfter ?? null,
        before: parsedCreatedBefore ?? null,
      });
    }
    return filters;
  }, [tenantNameFilter, planFilter, subscriptionStatusFilter, statusColFilter, affiliateMin, affiliateMax, mrrMin, mrrMax, createdAfter, createdBefore]);

  // ── Column definitions (for FilterChips label resolution) ────────────────
  // Only header + filterLabel needed for chip display; cell is required by type.
  const columns = useMemo<TableColumn<Tenant>[]>(
    () => [
      { key: "name", header: "Tenant", filterLabel: "Tenant", cell: () => null },
      { key: "plan", header: "Plan", filterLabel: "Plan", cell: () => null },
      { key: "subscriptionStatus", header: "Subscription", filterLabel: "Subscription", cell: () => null },
      { key: "status", header: "Status", filterLabel: "Status", cell: () => null },
      { key: "affiliateCount", header: "Affiliates", filterLabel: "Affiliates", cell: () => null },
      { key: "mrr", header: "MRR", filterLabel: "MRR", cell: () => null },
      { key: "created", header: "Created", filterLabel: "Created", cell: () => null },
    ],
    []
  );

  // ── Column filter change handler ─────────────────────────────────────────
  const handleColumnFilterChange = useCallback(
    (filters: ColumnFilter[]) => {
      const activeKeys = new Set(filters.map((f) => f.columnKey));

      for (const filter of filters) {
        switch (filter.columnKey) {
          case "name":
            setTenantNameFilter((filter as any).value ?? "");
            break;
          case "plan":
            setPlanFilter(filter.values?.length ? filter.values.join(",") : "");
            break;
          case "subscriptionStatus":
            setSubscriptionStatusFilter(filter.values?.length ? filter.values.join(",") : "");
            break;
          case "status":
            setStatusColFilter(filter.values?.length ? filter.values.join(",") : "");
            break;
          case "affiliateCount":
            setAffiliateMin(filter.min != null ? String(filter.min) : "");
            setAffiliateMax(filter.max != null ? String(filter.max) : "");
            break;
          case "mrr":
            setMrrMin(filter.min != null ? String(filter.min) : "");
            setMrrMax(filter.max != null ? String(filter.max) : "");
            break;
          case "created":
            setCreatedAfter(
              filter.after != null ? timestampToDateInput(filter.after) : ""
            );
            setCreatedBefore(
              filter.before != null ? timestampToDateInput(filter.before) : ""
            );
            break;
        }
      }

      // Clear any filters that were removed
      if (!activeKeys.has("name")) setTenantNameFilter("");
      if (!activeKeys.has("plan")) setPlanFilter("");
      if (!activeKeys.has("subscriptionStatus")) setSubscriptionStatusFilter("");
      if (!activeKeys.has("status")) setStatusColFilter("");
      if (!activeKeys.has("affiliateCount")) {
        setAffiliateMin("");
        setAffiliateMax("");
      }
      if (!activeKeys.has("mrr")) {
        setMrrMin("");
        setMrrMax("");
      }
      if (!activeKeys.has("created")) {
        setCreatedAfter("");
        setCreatedBefore("");
      }
    },
    []
  );

  // ── Handle individual filter removal (from FilterChips) ──────────────────
  const handleRemoveFilter = useCallback((key: string) => {
    switch (key) {
      case "name": setTenantNameFilter(""); break;
      case "plan": setPlanFilter(""); break;
      case "subscriptionStatus": setSubscriptionStatusFilter(""); break;
      case "status": setStatusColFilter(""); break;
      case "affiliateCount": setAffiliateMin(""); setAffiliateMax(""); break;
      case "mrr": setMrrMin(""); setMrrMax(""); break;
      case "created": setCreatedAfter(""); setCreatedBefore(""); break;
    }
  }, []);

  // ── Handle sort change ───────────────────────────────────────────────────
  const handleSortChange = useCallback(
    (sortBy: string, order: "asc" | "desc") => {
      setSortField(sortBy as TenantSortField);
      setSortOrder(order);
      setPage(1);
    },
    []
  );

  // ── Clear all filters ────────────────────────────────────────────────────
  const handleClearAllFilters = useCallback(() => {
    setSearchQuery("");
    setActiveFilter("all");
    setPage(1);
    setSortField("_creationTime");
    setSortOrder("desc");
    setTenantNameFilter("");
    setPlanFilter("");
    setSubscriptionStatusFilter("");
    setStatusColFilter("");
    setAffiliateMin("");
    setAffiliateMax("");
    setMrrMin("");
    setMrrMax("");
    setCreatedAfter("");
    setCreatedBefore("");
  }, []);

  // ── Navigate to tenant detail ────────────────────────────────────────────
  const handleViewTenant = useCallback(
    (tenantId: string) => {
      router.push(`/tenants/${tenantId}`);
    },
    [router]
  );

  // ── Pagination change ────────────────────────────────────────────────────
  const handlePaginationChange = useCallback(
    ({ page: newPage, pageSize: newPageSize }: { page: number; pageSize: number }) => {
      setPage(newPage);
      if (newPageSize !== pageSize) {
        setPageSize(newPageSize);
      }
    },
    [pageSize]
  );

  // ── Derived data ─────────────────────────────────────────────────────────
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    activeFilter !== "all" ||
    activeFilters.length > 0;

  const isLoading = result === undefined;
  const tenants = result?.tenants ?? [];
  const totalResults = result?.total ?? 0;

  // ── Client-side filtering (column-level filters applied on top of API data) ──
  const filteredTenants = useMemo(() => {
    let data = tenants;

    // Tenant name filter
    if (tenantNameFilter.trim()) {
      const q = tenantNameFilter.toLowerCase().trim();
      data = data.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          t.domain?.toLowerCase().includes(q) ||
          t.ownerEmail.toLowerCase().includes(q)
      );
    }

    // Plan filter
    if (planFilter) {
      const plans = planFilter.toLowerCase().split(",");
      data = data.filter((t) => plans.includes(t.plan.toLowerCase()));
    }

    // Subscription status filter
    if (subscriptionStatusFilter) {
      const statuses = subscriptionStatusFilter.toLowerCase().split(",");
      data = data.filter((t) => {
        const status = (t.subscriptionStatus ?? "").toLowerCase();
        return statuses.includes(status);
      });
    }

    // Status column filter
    if (statusColFilter) {
      const statuses = statusColFilter.toLowerCase().split(",");
      data = data.filter((t) => statuses.includes(t.status.toLowerCase()));
    }

    // Affiliate count range filter
    const parsedAffMin = affiliateMin ? parseFloat(affiliateMin) : undefined;
    const parsedAffMax = affiliateMax ? parseFloat(affiliateMax) : undefined;
    if (parsedAffMin != null) {
      data = data.filter((t) => t.affiliateCount >= parsedAffMin!);
    }
    if (parsedAffMax != null) {
      data = data.filter((t) => t.affiliateCount <= parsedAffMax!);
    }

    // MRR range filter
    const parsedMrrMin = mrrMin ? parseFloat(mrrMin) : undefined;
    const parsedMrrMax = mrrMax ? parseFloat(mrrMax) : undefined;
    if (parsedMrrMin != null) {
      data = data.filter((t) => t.mrr >= parsedMrrMin!);
    }
    if (parsedMrrMax != null) {
      data = data.filter((t) => t.mrr <= parsedMrrMax!);
    }

    // Created date range filter
    const parsedCreatedAfter = createdAfter
      ? dateToStartTimestamp(createdAfter)
      : undefined;
    const parsedCreatedBefore = createdBefore
      ? dateToTimestamp(createdBefore)
      : undefined;
    if (parsedCreatedAfter != null) {
      data = data.filter((t) => t._creationTime >= parsedCreatedAfter!);
    }
    if (parsedCreatedBefore != null) {
      data = data.filter((t) => t._creationTime <= parsedCreatedBefore!);
    }

    return data;
  }, [
    tenants,
    tenantNameFilter,
    planFilter,
    subscriptionStatusFilter,
    statusColFilter,
    affiliateMin,
    affiliateMax,
    mrrMin,
    mrrMax,
    createdAfter,
    createdBefore,
  ]);

  // ── Client-side sorting ──────────────────────────────────────────────────
  const sortedTenants = useMemo(() => {
    return [...filteredTenants].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "plan":
          comparison = a.plan.localeCompare(b.plan);
          break;
        case "subscriptionStatus":
          comparison = (a.subscriptionStatus ?? "").localeCompare(b.subscriptionStatus ?? "");
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "affiliateCount":
          comparison = a.affiliateCount - b.affiliateCount;
          break;
        case "mrr":
          comparison = a.mrr - b.mrr;
          break;
        case "_creationTime":
        default:
          comparison = a._creationTime - b._creationTime;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredTenants, sortField, sortOrder]);

  return (
    <>
      {/* Stats Row */}
      <FadeIn delay={0}>
        <StatsRow stats={stats} isLoading={stats === undefined} />
      </FadeIn>

      {/* Search + Filter Controls */}
      <FadeIn delay={80}>
        <div className="space-y-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, email, or domain..."
          />
          <FilterPills
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={stats}
            isLoading={stats === undefined}
          />
        </div>
      </FadeIn>

      {/* Filter Chips (column-level filters) */}
      {activeFilters.length > 0 && (
        <FadeIn delay={120}>
          <FilterChips<Tenant>
            filters={activeFilters}
            columns={columns}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        </FadeIn>
      )}

      {/* Results */}
      {!isLoading && sortedTenants.length === 0 ? (
        <FadeIn delay={160}>
          <EmptyState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearAllFilters}
            searchQuery={searchQuery}
            activeFilter={activeFilter}
          />
        </FadeIn>
      ) : (
        <FadeIn delay={160}>
          <TenantTable
            tenants={sortedTenants}
            isLoading={isLoading}
            total={totalResults}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onViewTenant={handleViewTenant}
            activeFilters={activeFilters}
            onFilterChange={handleColumnFilterChange}
            pagination={{ page, pageSize }}
            totalItems={filteredTenants.length}
            onPaginationChange={handlePaginationChange}
          />
        </FadeIn>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Content (manages view toggle, wraps in Suspense)
// ---------------------------------------------------------------------------

function AdminTenantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── View mode from URL ───────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) || "tenants"
  );

  // Sync view to URL (only when activeView changes — avoid searchParams in deps)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeView === "analytics") {
      params.set("view", "analytics");
    } else {
      params.delete("view");
    }
    const queryString = params.toString();
    router.replace(
      `/tenants${queryString ? `?${queryString}` : ""}`,
      { scroll: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description="Manage and monitor all tenant accounts">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Tenants
        </h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        {/* View Toggle */}
        <div className="mb-6">
          <ViewToggle activeView={activeView} onViewChange={setActiveView} />
        </div>

        <div className="space-y-6">
          {activeView === "tenants" ? (
            <TenantListContent />
          ) : (
            <Suspense fallback={<PlatformAnalyticsSkeleton />}>
              <PlatformAnalyticsContent />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (wrapped in Suspense)
// ---------------------------------------------------------------------------

export default function AdminTenantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminTenantsContent />
    </Suspense>
  );
}
