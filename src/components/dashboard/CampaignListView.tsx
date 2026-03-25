"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CampaignCard } from "./CampaignCard";
import { type FilterState, type ViewMode } from "./CampaignFilters";
import {
  DataTable,
  CurrencyCell,
  NumberCell,
  DateCell,
} from "@/components/ui/DataTable";
import { DataTablePagination, type PaginationState } from "@/components/ui/DataTablePagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { usePaginationUrlState } from "@/hooks/useDataTableUrlState";

interface CampaignListViewProps {
  viewMode?: ViewMode;
  filterState?: FilterState;
  onCreateCampaign?: () => void;
}

/**
 * CampaignListView — paginated listing using page-based pagination.
 * Handles card grid and table view, client-side search, and server-side filters.
 */
export function CampaignListView({ viewMode = "cards", filterState, onCreateCampaign }: CampaignListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // URL-based pagination state
  const { pagination, setPagination } = usePaginationUrlState(20);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination({ ...pagination, page: 1 });
  }, [filterState?.statusFilter, filterState?.commissionTypeFilter, filterState?.recurringFilter, filterState?.createdAfter, filterState?.createdBefore]);

  // Build server-side filter args
  const serverFilters = useMemo(
    () => ({
      statusFilter: filterState?.statusFilter,
      commissionTypeFilter: filterState?.commissionTypeFilter,
      recurringFilter: filterState?.recurringFilter,
      createdAfter: filterState?.createdAfter,
      createdBefore: filterState?.createdBefore,
    }),
    [filterState?.statusFilter, filterState?.commissionTypeFilter, filterState?.recurringFilter, filterState?.createdAfter, filterState?.createdBefore]
  );

  // Determine whether to include archived
  const includeArchived = serverFilters.statusFilter === "archived" ? true : undefined;

  // Card stats for table view columns
  const cardStats = useQuery(api.campaigns.getCampaignCardStats);

  // Use page-based query
  const result = useQuery(
    api.campaigns.listCampaignsPageBased,
    {
      page: pagination.page,
      pageSize: pagination.pageSize,
      statusFilter: serverFilters.statusFilter,
      commissionTypeFilter: serverFilters.commissionTypeFilter,
      recurringFilter: serverFilters.recurringFilter,
      createdAfter: serverFilters.createdAfter,
      createdBefore: serverFilters.createdBefore,
      includeArchived,
    }
  );

  const isLoading = result === undefined;
  const results = result?.page ?? [];
  const total = result?.total ?? 0;

  // Client-side search filter (applied after pagination)
  const displayItems = useMemo(() => {
    if (!debouncedSearch) return results;
    const q = debouncedSearch.toLowerCase();
    return results.filter(
      (c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [results, debouncedSearch]);

  // Build contextual empty state message (AC 21)
  const emptyMessage = useMemo(() => {
    if (debouncedSearch) {
      return `No campaigns matching "${debouncedSearch}"`;
    }
    const parts: string[] = [];
    if (filterState?.statusFilter) parts.push(filterState.statusFilter);
    if (filterState?.commissionTypeFilter) {
      parts.push(filterState.commissionTypeFilter === "percentage" ? "percentage" : "flat fee");
    }
    if (filterState?.recurringFilter !== undefined) {
      parts.push(filterState.recurringFilter ? "recurring" : "one-time");
    }
    if (parts.length > 0) {
      return `No ${parts.join(" ")} campaigns found`;
    }
    return "No campaigns yet — create your first campaign";
  }, [debouncedSearch, filterState]);

  // Table columns definition
  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        cell: (row: any) => (
          <Link
            href={`/campaigns/${row._id}`}
            className="text-[13px] font-semibold text-[#10409a] hover:text-[#1e40af] hover:underline transition-colors"
          >
            {row.name}
          </Link>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row: any) => {
          const colors: Record<string, string> = {
            active: "bg-emerald-100 text-emerald-700",
            paused: "bg-amber-100 text-amber-700",
            archived: "bg-gray-100 text-gray-600",
          };
          const dotColors: Record<string, string> = {
            active: "bg-emerald-500",
            paused: "bg-amber-500",
            archived: "bg-gray-400",
          };
          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[row.status] || colors.archived}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotColors[row.status] || dotColors.archived}`} />
              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </span>
          );
        },
      },
      {
        key: "commissionType",
        header: "Type",
        cell: (row: any) => (
          <span className="text-[13px] text-gray-600">
            {row.commissionType === "percentage" ? "Percentage" : "Flat Fee"}
          </span>
        ),
      },
      {
        key: "commissionRate",
        header: "Rate",
        align: "right" as const,
        cell: (row: any) => (
          <span className="text-[13px] text-gray-700 tabular-nums">
            {row.commissionType === "percentage"
              ? `${row.commissionRate}%`
              : `₱${row.commissionRate.toLocaleString()}`}
          </span>
        ),
      },
      {
        key: "affiliates",
        header: "Affiliates",
        align: "right" as const,
        cell: (row: any) => <NumberCell value={cardStats?.[row._id]?.affiliates ?? 0} />,
      },
      {
        key: "conversions",
        header: "Conversions",
        align: "right" as const,
        cell: (row: any) => <NumberCell value={cardStats?.[row._id]?.conversions ?? 0} />,
      },
      {
        key: "paidOut",
        header: "Paid Out",
        align: "right" as const,
        cell: (row: any) => <CurrencyCell amount={cardStats?.[row._id]?.paidOut ?? 0} />,
      },
      {
        key: "_creationTime",
        header: "Created",
        cell: (row: any) => <DateCell value={row._creationTime} format="short" />,
      },
      {
        key: "actions",
        header: "",
        align: "right" as const,
        cell: (row: any) => (
          <Link
            href={`/campaigns/${row._id}`}
            className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-[#1659d6] hover:text-[#10409a] hover:bg-blue-50 rounded-md transition-colors"
          >
            View
            <ExternalLink className="w-3 h-3" />
          </Link>
        ),
      },
    ],
    [cardStats]
  );

  // Loading skeleton
  if (isLoading && results.length === 0) {
    if (viewMode === "table") {
      return (
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#f3f4f6] last:border-b-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-xl" />
        ))}
      </div>
    );
  }

  const hasMore = (result?.pageNum ?? 1) < (result?.totalPages ?? 1);

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {displayItems.length === 0 ? (
        <div className="bg-white border border-[#e5e7eb] rounded-xl py-12 text-center">
          <p className="text-[14px] text-[#6b7280]">{emptyMessage}</p>
          {!filterState?.statusFilter && !debouncedSearch && (
            <div className="mt-4 flex justify-center">
              <Button onClick={onCreateCampaign}>
                <Plus className="w-3.5 h-3.5" />
                Create Campaign
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* Table view */
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          <DataTable
            columns={columns}
            data={displayItems}
            getRowId={(row: any) => row._id}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
            className="border-0 rounded-none"
            pagination={pagination}
            total={total}
            onPaginationChange={setPagination}
            hidePagination={total <= pagination.pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      ) : (
        /* Card grid view */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayItems.map((campaign: any) => (
              <CampaignCard
                key={campaign._id}
                campaign={campaign}
                stats={{
                  affiliates: cardStats?.[campaign._id]?.affiliates ?? 0,
                  conversions: cardStats?.[campaign._id]?.conversions ?? 0,
                  paidOut: cardStats?.[campaign._id]?.paidOut ?? 0,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination + count */}
      {displayItems.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[12px] text-[#9ca3af]">
            {total} campaign{total !== 1 ? "s" : ""} total
          </span>
          {total > pagination.pageSize && (
            <DataTablePagination
              pagination={pagination}
              total={total}
              onPaginationChange={setPagination}
              isLoading={isLoading}
              showPageSizeSelector={false}
              maxPageButtons={5}
            />
          )}
        </div>
      )}
    </div>
  );
}
