"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { StatsRow } from "./_components/StatsRow";
import { SearchInput } from "./_components/SearchInput";
import { FilterPills, type Filter } from "./_components/FilterPills";
import { TenantTable, type SortField, type SortOrder } from "./_components/TenantTable";
import { Pagination } from "./_components/Pagination";
import { EmptyState } from "./_components/EmptyState";
import { Loader2 } from "lucide-react";

const PAGE_SIZE = 10;

function AdminTenantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state — read initial values from URL params
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [activeFilter, setActiveFilter] = useState<Filter>(
    (searchParams.get("filter") as Filter) || "all"
  );
  const [page, setPage] = useState(
    Number(searchParams.get("page")) || 1
  );
  const [sortField, setSortField] = useState<SortField>(
    (searchParams.get("sort") as SortField) || "_creationTime"
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams.get("order") as SortOrder) || "desc"
  );

  // Debounced search (500ms)
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Queries
  const stats = useQuery(api.admin.tenants.getPlatformStats);
  const result = useQuery(
    api.admin.tenants.searchTenants,
    {
      searchQuery: debouncedSearch || undefined,
      statusFilter: activeFilter === "all" ? undefined : activeFilter,
      cursor: page > 1 ? String((page - 1) * PAGE_SIZE) : undefined,
      numItems: PAGE_SIZE,
    }
  );

  // Sync state to URL query params (Task 4)
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (activeFilter !== "all") params.set("filter", activeFilter);
    if (page > 1) params.set("page", String(page));
    if (sortField !== "_creationTime") params.set("sort", sortField);
    if (sortOrder !== "desc") params.set("order", sortOrder);

    const queryString = params.toString();
    router.replace(
      `/tenants${queryString ? `?${queryString}` : ""}`,
      { scroll: false }
    );
  }, [debouncedSearch, activeFilter, page, sortField, sortOrder, router]);

  // Reset page when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeFilter]);

  // Handle sort toggle
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      // New field, default to descending
      setSortField(field);
      setSortOrder("desc");
    }
  }, [sortField]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveFilter("all");
    setPage(1);
    setSortField("_creationTime");
    setSortOrder("desc");
  }, []);

  // Navigate to tenant detail
  const handleViewTenant = useCallback((tenantId: string) => {
    router.push(`/tenants/${tenantId}`);
  }, [router]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || activeFilter !== "all";

  const isLoading = result === undefined;
  const tenants = result?.tenants ?? [];
  const totalResults = result?.total ?? 0;
  const hasMore = result?.hasMore ?? false;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);

  // Client-side sorting (since backend returns unsorted for now)
  const sortedTenants = [...tenants].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "plan":
        comparison = a.plan.localeCompare(b.plan);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#333333]">Tenants</h1>
        <p className="text-sm text-[#6b7280]">
          Manage and monitor all tenant accounts
        </p>
      </div>

      {/* Stats Row */}
      <StatsRow stats={stats} isLoading={stats === undefined} />

      {/* Search + Filter Controls */}
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

      {/* Results */}
      {!isLoading && tenants.length === 0 ? (
        <EmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          searchQuery={searchQuery}
          activeFilter={activeFilter}
        />
      ) : (
        <>
          <TenantTable
            tenants={sortedTenants}
            isLoading={isLoading}
            total={totalResults}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onViewTenant={handleViewTenant}
          />

          {/* Pagination */}
          {!isLoading && tenants.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              total={totalResults}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

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
