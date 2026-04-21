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
import { User, Mail, Users, Clock, CheckCircle2, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface Lead {
  _id: Id<"referralLeads">;
  _creationTime: number;
  email: string;
  affiliateId: Id<"affiliates">;
  affiliateName?: string;
  campaignId?: Id<"campaigns">;
  campaignName?: string;
  status: "active" | "converted" | "expired";
  convertedAt?: number;
  conversionId?: Id<"conversions">;
}

type LeadTabStatus = "all" | "active" | "converted" | "expired";

// ── Column builders ───────────────────────────────────────────────────────

function buildColumns(campaignOptions: FilterOption[]): TableColumn<Lead>[] {
  return [
    {
      key: "email",
      header: "Customer Email",
      sortable: true,
      sortField: "email",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{row.email}</span>
        </div>
      ),
    },
    {
      key: "affiliateName",
      header: "Referred By",
      sortable: true,
      sortField: "affiliateName",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">{row.affiliateName || "—"}</span>
        </div>
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
        { value: "active", label: "Active" },
        { value: "converted", label: "Converted" },
        { value: "expired", label: "Expired" },
      ],
      filterLabel: "Status",
      cell: (row) => {
        const config = {
          active: { label: "Active", icon: <Clock className="w-3 h-3" />, className: "bg-amber-100 text-amber-700" },
          converted: { label: "Converted", icon: <CheckCircle2 className="w-3 h-3" />, className: "bg-green-100 text-green-700" },
          expired: { label: "Expired", icon: <AlertCircle className="w-3 h-3" />, className: "bg-red-100 text-red-700" },
        };
        const c = config[row.status];
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
            {c.icon}
            {c.label}
          </span>
        );
      },
    },
    {
      key: "convertedAt",
      header: "Converted",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.convertedAt ? new Date(row.convertedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "_creationTime",
      header: "Signed Up",
      sortable: true,
      sortField: "_creationTime",
      filterable: true,
      filterType: "date-range",
      filterLabel: "Signed Up",
      cell: (row) => <DateCell value={row._creationTime} format="short" />,
    },
  ];
}

function buildTabs(counts: { total: number; active: number; converted: number; expired: number }): FilterTabItem[] {
  return [
    { key: "all", label: "All", count: counts.total },
    { key: "active", label: "Active", count: counts.active, icon: <Clock className="h-3.5 w-3.5" />, activeColor: "bg-amber-500" },
    { key: "converted", label: "Converted", count: counts.converted, icon: <CheckCircle2 className="h-3.5 w-3.5" />, activeColor: "bg-green-600" },
    { key: "expired", label: "Expired", count: counts.expired, icon: <AlertCircle className="h-3.5 w-3.5" />, activeColor: "bg-red-600" },
  ];
}

// ── Main content ──────────────────────────────────────────────────────────

function LeadsContent() {
  // ── URL state via nuqs ─────────────────────────────────────────────────
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["all", "active", "converted", "expired"] as const).withDefault("all")
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
  const [signedUpAfter, setSignedUpAfter] = useQueryState("signedup_after", parseAsString.withDefault(""));
  const [signedUpBefore, setSignedUpBefore] = useQueryState("signedup_before", parseAsString.withDefault(""));

  // Cursor state (NOT in URL — ephemeral)
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Record<number, string | null>>({});

  // ── Tab counts via aggregate ───────────────────────────────────────────
  const counts = useQuery(api.referralLeads.getLeadCountByStatus, {}) || {
    total: 0,
    active: 0,
    converted: 0,
    expired: 0,
  };

  // ── Campaign data ──────────────────────────────────────────────────────
  const allCampaigns = useQuery(api.campaigns.listCampaigns, {});
  const campaignOptions = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.map((c) => ({ value: c._id, label: c.name }));
  }, [allCampaigns]);

  // ── Build query args ───────────────────────────────────────────────────
  const effectiveStatus: LeadTabStatus = tab as LeadTabStatus;
  const statusFilter = effectiveStatus === "all" ? undefined : effectiveStatus;

  const parsedSignedUpAfter = signedUpAfter ? dateToStartTimestamp(signedUpAfter) : undefined;
  const parsedSignedUpBefore = signedUpBefore ? dateToTimestamp(signedUpBefore) : undefined;

  const campaignIds = useMemo(() => {
    if (!campaigns) return undefined;
    return [campaigns as unknown as Id<"campaigns">];
  }, [campaigns]);

  const statusMulti = useMemo(() => {
    if (!statuses) return undefined;
    return [statuses as "active" | "converted" | "expired"];
  }, [statuses]);

  // ── Data query ─────────────────────────────────────────────────────────
  const leadsData = useQuery(api.referralLeads.getLeadsByTenant, {
    paginationOpts: { numItems: pageSize, cursor: cursor ?? null },
    status: statusFilter,
    statuses: statusMulti,
    search: search || undefined,
    campaignIds,
    startDate: parsedSignedUpAfter,
    endDate: parsedSignedUpBefore,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  });

  const leads: Lead[] = leadsData?.page ?? [];
  const isLoading = leadsData === undefined;

  // Use tab-specific count for pagination total
  const tabCount = useMemo(() => {
    switch (tab) {
      case "active": return counts.active;
      case "converted": return counts.converted;
      case "expired": return counts.expired;
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
    if (parsedSignedUpAfter != null || parsedSignedUpBefore != null) {
      filters.push({
        columnKey: "_creationTime",
        type: "date-range",
        after: parsedSignedUpAfter ?? null,
        before: parsedSignedUpBefore ?? null,
      });
    }
    return filters;
  }, [statuses, campaigns, parsedSignedUpAfter, parsedSignedUpBefore]);

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
        setSignedUpAfter(filter.after != null ? timestampToDateInput(filter.after) : "");
        setSignedUpBefore(filter.before != null ? timestampToDateInput(filter.before) : "");
        break;
    }
  };

  const clearFilterForColumn = (columnKey: string) => {
    switch (columnKey) {
      case "status": setStatuses(""); break;
      case "campaignName": setCampaigns(""); break;
      case "_creationTime": setSignedUpAfter(""); setSignedUpBefore(""); break;
    }
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setStatuses("");
    setCampaigns("");
    setSignedUpAfter("");
    setSignedUpBefore("");
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
    } else if (leadsData?.continueCursor) {
      setCursor(leadsData.continueCursor);
    }
    setPage(newPage);
  };

  // Store cursor for current page when data loads
  useMemo(() => {
    if (leadsData?.continueCursor && !isLoading) {
      setCursorHistory((prev) => ({
        ...prev,
        [page]: leadsData.continueCursor,
      }));
    }
  }, [leadsData?.continueCursor, isLoading, page]);

  // ── Export ─────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // Fetch all leads for export (up to 1000)
      const allLeadsData = await fetch(
        "/api/export-leads",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      // Note: Full export requires a server-side action. For now, export visible data.
      const rows = leads.map((l) => ({
        Email: l.email,
        "Referred By": l.affiliateName || "",
        Campaign: l.campaignName || "",
        Status: l.status,
        "Signed Up": new Date(l._creationTime).toISOString(),
        Converted: l.convertedAt ? new Date(l.convertedAt).toISOString() : "",
      }));
      const base64 = generateCsv(rows);
      downloadCsv(base64, `leads-export-${new Date().toISOString().split("T")[0]}`);
      toast.success(`Exported ${rows.length} leads to CSV`);
    } finally {
      setIsExporting(false);
    }
  }, [leads]);

  // ── Columns ────────────────────────────────────────────────────────────
  const columns = useMemo(() => buildColumns(campaignOptions), [campaignOptions]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSearch = (value: string) => {
    setSearch(value);
    resetPagination();
  };

  const handleTabChange = (newTab: string) => {
    setTab(newTab as LeadTabStatus);
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
          placeholder="Search by email..."
          className="w-full sm:w-[320px]"
        />
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} isExporting={isExporting} disabled={leads.length === 0} />
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <FilterChips<Lead>
          filters={activeFilters}
          columns={columns}
          onRemove={clearFilterForColumn}
          onClearAll={handleClearAllFilters}
        />
      )}

      {/* Table */}
      <DataTable<Lead>
        data={leads}
        columns={columns}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyMessage="No referral leads found. When customers sign up via affiliate referral links, they will appear here."
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

function LeadsSkeleton() {
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

export default function LeadsPage() {
  return (
    <div className="animate-fade-in">
      <PageTopbar description="Track customers who signed up through your affiliate referral links">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-[var(--brand-primary)]" />
          <h1 className="text-lg font-semibold text-heading">Referral Leads</h1>
        </div>
      </PageTopbar>
      <div className="px-8 py-6">
        <div className="max-w-6xl">
          <Suspense fallback={<LeadsSkeleton />}>
            <LeadsContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
