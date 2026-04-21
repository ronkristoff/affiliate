"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  useQueryState,
  parseAsStringLiteral,
  parseAsString,
  parseAsInteger,
} from "nuqs";

import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import {
  DataTable,
  TableColumn,
  CurrencyCell,
  DateCell,
  type ColumnFilter,
  type FilterOption,
} from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { ExportButton } from "@/components/ui/ExportButton";
import { SearchField } from "@/components/ui/SearchField";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/DataTablePagination";
import { downloadCsv, generateCsv } from "@/lib/utils";
import { dateToTimestamp, dateToStartTimestamp, timestampToDateInput } from "@/lib/date-utils";
import { ShoppingCart, User, Clock, CheckCircle2, RotateCcw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface Conversion {
  _id: Id<"conversions">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  affiliateId?: Id<"affiliates">;
  affiliateName?: string;
  campaignId?: Id<"campaigns">;
  campaignName?: string;
  customerEmail?: string;
  amount: number;
  status?: string;
  attributionSource?: string;
  isSelfReferral?: boolean;
}

type ConversionTabStatus = "all" | "pending" | "completed" | "refunded";

// ── Column builders ───────────────────────────────────────────────────────

function buildColumns(campaignOptions: FilterOption[]): TableColumn<Conversion>[] {
  return [
    {
      key: "customerEmail",
      header: "Customer",
      sortable: true,
      sortField: "customerEmail",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">{row.customerEmail || "—"}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortField: "amount",
      cell: (row) => <CurrencyCell amount={row.amount} />,
    },
    {
      key: "affiliateName",
      header: "Affiliate",
      sortable: true,
      sortField: "affiliateName",
      cell: (row) => (
        <span className="text-sm">
          {row.affiliateName || (
            <span className="text-muted-foreground italic">Organic</span>
          )}
        </span>
      ),
    },
    {
      key: "campaignName",
      header: "Campaign",
      sortable: true,
      sortField: "campaignName",
      filterable: true,
      filterType: "select",
      filterOptions: campaignOptions,
      filterLabel: "Campaign",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.campaignName || "—"}
        </span>
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
        { value: "pending", label: "Pending" },
        { value: "completed", label: "Completed" },
        { value: "refunded", label: "Refunded" },
      ],
      filterLabel: "Status",
      cell: (row) => {
        const config: Record<string, string> = {
          pending: "bg-amber-100 text-amber-700",
          completed: "bg-green-100 text-green-700",
          refunded: "bg-red-100 text-red-700",
        };
        const status = row.status || "pending";
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${config[status] || config.pending}`}>
            {status}
          </span>
        );
      },
    },
    {
      key: "attributionSource",
      header: "Source",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.attributionSource || "—"}
          {row.isSelfReferral && (
            <span className="ml-1 text-red-600 font-medium">(self-ref)</span>
          )}
        </span>
      ),
    },
    {
      key: "_creationTime",
      header: "Date",
      sortable: true,
      sortField: "_creationTime",
      filterable: true,
      filterType: "date-range",
      filterLabel: "Date",
      cell: (row) => <DateCell value={row._creationTime} format="short" />,
    },
  ];
}

function buildTabs(counts: { total: number; pending: number; completed: number; refunded: number }): FilterTabItem[] {
  return [
    { key: "all", label: "All", count: counts.total },
    { key: "pending", label: "Pending", count: counts.pending, icon: <Clock className="h-3.5 w-3.5" />, activeColor: "bg-amber-500" },
    { key: "completed", label: "Completed", count: counts.completed, icon: <CheckCircle2 className="h-3.5 w-3.5" />, activeColor: "bg-green-600" },
    { key: "refunded", label: "Refunded", count: counts.refunded, icon: <RotateCcw className="h-3.5 w-3.5" />, activeColor: "bg-red-600" },
  ];
}

// ── Main content ──────────────────────────────────────────────────────────

function ConversionsContent() {
  // ── URL state via nuqs ─────────────────────────────────────────────────
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["all", "pending", "completed", "refunded"] as const).withDefault("all")
  );

  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("pageSize", parseAsInteger.withDefault(DEFAULT_PAGE_SIZE));
  const [sortBy, setSortBy] = useQueryState("sortBy", parseAsString.withDefault(""));
  const [sortOrder, setSortOrder] = useQueryState(
    "order",
    parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc")
  );

  // Column-level filter state (URL-persisted)
  const [statuses, setStatuses] = useQueryState("status", parseAsString.withDefault(""));
  const [campaigns, setCampaigns] = useQueryState("campaign", parseAsString.withDefault(""));
  const [dateAfter, setDateAfter] = useQueryState("date_after", parseAsString.withDefault(""));
  const [dateBefore, setDateBefore] = useQueryState("date_before", parseAsString.withDefault(""));

  // Cursor state (NOT in URL — ephemeral)
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Record<number, string | null>>({});

  // ── Tab counts ─────────────────────────────────────────────────────────
  const counts = useQuery(api.conversions.getConversionCountByStatus, {}) || {
    total: 0,
    pending: 0,
    completed: 0,
    refunded: 0,
  };

  // ── Campaign data ──────────────────────────────────────────────────────
  const allCampaigns = useQuery(api.campaigns.listCampaigns, {});
  const campaignOptions = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.map((c) => ({ value: c._id, label: c.name }));
  }, [allCampaigns]);

  // ── Build query args ───────────────────────────────────────────────────
  const effectiveStatus: ConversionTabStatus = tab as ConversionTabStatus;
  const statusFilter = effectiveStatus === "all" ? undefined : effectiveStatus;

  const parsedDateAfter = dateAfter ? dateToStartTimestamp(dateAfter) : undefined;
  const parsedDateBefore = dateBefore ? dateToTimestamp(dateBefore) : undefined;

  const campaignIds = useMemo(() => {
    if (!campaigns) return undefined;
    return [campaigns as unknown as Id<"campaigns">];
  }, [campaigns]);

  const statusMulti = useMemo(() => {
    if (!statuses) return undefined;
    return [statuses as "pending" | "completed" | "refunded"];
  }, [statuses]);

  // ── Data query ─────────────────────────────────────────────────────────
  const conversionsData = useQuery(api.conversions.getConversions, {
    paginationOpts: { numItems: pageSize, cursor: cursor ?? null },
    status: statusFilter,
    statuses: statusMulti,
    search: search || undefined,
    campaignIds,
    startDate: parsedDateAfter,
    endDate: parsedDateBefore,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  });

  const conversions: Conversion[] = conversionsData?.page ?? [];
  const isLoading = conversionsData === undefined;

  // Use tab-specific count for pagination total
  const tabCount = useMemo(() => {
    switch (tab) {
      case "pending": return counts.pending;
      case "completed": return counts.completed;
      case "refunded": return counts.refunded;
      default: return counts.total;
    }
  }, [tab, counts]);

  // ── Column filters ─────────────────────────────────────────────────────
  const activeFilters: ColumnFilter[] = useMemo(() => {
    const filters: ColumnFilter[] = [];
    if (statuses) {
      filters.push({ columnKey: "status", type: "select", values: [statuses] });
    }
    if (campaigns) {
      filters.push({ columnKey: "campaignName", type: "select", values: [campaigns] });
    }
    if (parsedDateAfter != null || parsedDateBefore != null) {
      filters.push({
        columnKey: "_creationTime",
        type: "date-range",
        after: parsedDateAfter ?? null,
        before: parsedDateBefore ?? null,
      });
    }
    return filters;
  }, [statuses, campaigns, parsedDateAfter, parsedDateBefore]);

  const handleFilterChange = (filters: ColumnFilter[]) => {
    const currentKeys = new Set(activeFilters.map((f) => f.columnKey));
    const nextKeys = new Set(filters.map((f) => f.columnKey));

    for (const key of currentKeys) {
      if (!nextKeys.has(key)) clearFilterForColumn(key);
    }
    for (const filter of filters) applyFilter(filter);
    resetPagination();
  };

  const applyFilter = (filter: ColumnFilter) => {
    switch (filter.columnKey) {
      case "status":
        setStatuses(filter.values?.[0] ?? "");
        break;
      case "campaignName":
        setCampaigns(filter.values?.[0] ?? "");
        break;
      case "_creationTime":
        setDateAfter(filter.after != null ? timestampToDateInput(filter.after) : "");
        setDateBefore(filter.before != null ? timestampToDateInput(filter.before) : "");
        break;
    }
  };

  const clearFilterForColumn = (columnKey: string) => {
    switch (columnKey) {
      case "status": setStatuses(""); break;
      case "campaignName": setCampaigns(""); break;
      case "_creationTime": setDateAfter(""); setDateBefore(""); break;
    }
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setStatuses("");
    setCampaigns("");
    setDateAfter("");
    setDateBefore("");
    resetPagination();
  };

  // ── Pagination helpers ─────────────────────────────────────────────────
  const resetPagination = () => {
    setPage(1);
    setCursor(null);
    setCursorHistory({});
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    if (newPage === 1) {
      setCursor(null);
    } else if (cursorHistory[newPage - 1]) {
      setCursor(cursorHistory[newPage - 1]);
    } else if (conversionsData?.continueCursor) {
      setCursor(conversionsData.continueCursor);
    }
    setPage(newPage);
  };

  // Store cursor for current page when data loads
  useMemo(() => {
    if (conversionsData?.continueCursor && !isLoading) {
      setCursorHistory((prev) => ({
        ...prev,
        [page]: conversionsData.continueCursor,
      }));
    }
  }, [conversionsData?.continueCursor, isLoading, page]);

  // ── Export ─────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const rows = conversions.map((c) => ({
        Customer: c.customerEmail || "",
        Amount: (c.amount / 100).toFixed(2),
        Affiliate: c.affiliateName || "Organic",
        Campaign: c.campaignName || "",
        Status: c.status || "pending",
        Source: c.attributionSource || "",
        "Self Referral": c.isSelfReferral ? "Yes" : "No",
        Date: new Date(c._creationTime).toISOString(),
      }));
      const base64 = generateCsv(rows);
      downloadCsv(base64, `conversions-export-${new Date().toISOString().split("T")[0]}`);
      toast.success(`Exported ${rows.length} conversions to CSV`);
    } finally {
      setIsExporting(false);
    }
  }, [conversions]);

  // ── Columns ────────────────────────────────────────────────────────────
  const columns = useMemo(() => buildColumns(campaignOptions), [campaignOptions]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSearch = (value: string) => {
    setSearch(value);
    resetPagination();
  };

  const handleTabChange = (newTab: string) => {
    setTab(newTab as ConversionTabStatus);
    resetPagination();
  };

  const handleSortChange = (field: string, order: "asc" | "desc") => {
    setSortBy(field);
    setSortOrder(order);
    resetPagination();
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    resetPagination();
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <FilterTabs
        tabs={buildTabs(counts)}
        activeTab={tab}
        onTabChange={handleTabChange}
        size="md"
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <SearchField
          value={search}
          onChange={handleSearch}
          placeholder="Search by customer email..."
          className="w-full sm:w-[320px]"
        />
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} isExporting={isExporting} disabled={conversions.length === 0} />
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <FilterChips<Conversion>
          filters={activeFilters}
          columns={columns}
          onRemove={clearFilterForColumn}
          onClearAll={handleClearAllFilters}
        />
      )}

      {/* Table */}
      <DataTable<Conversion>
        data={conversions}
        columns={columns}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No conversions found. When a customer makes a purchase through an affiliate link, it will appear here."
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        pagination={{ page, pageSize }}
        total={tabCount}
        onPaginationChange={({ page: newPage, pageSize: newPageSize }) => {
          if (newPageSize !== pageSize) {
            handlePageSizeChange(newPageSize);
          } else {
            handlePageChange(newPage);
          }
        }}
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
}

function ConversionsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-[320px] rounded-lg" />
        <Skeleton className="h-10 w-[100px] ml-auto rounded-lg" />
      </div>
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConversionsPage() {
  return (
    <div className="animate-fade-in">
      <PageTopbar description="Track customer purchases and conversions attributed to your affiliates">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-[var(--brand-primary)]" />
          <h1 className="text-lg font-semibold text-heading">Conversions</h1>
        </div>
      </PageTopbar>
      <div className="px-8 py-6">
        <div className="max-w-6xl">
          <Suspense fallback={<ConversionsSkeleton />}>
            <ConversionsContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
