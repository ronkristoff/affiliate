"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DataTable,
  AvatarCell,
  CurrencyCell,
  NumberCell,
  DateCell,
  type ColumnFilter,
} from "@/components/ui/DataTable";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  type PaginationState,
} from "@/components/ui/DataTablePagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { escapeCsvField } from "@/lib/csv-utils";

interface AffiliateRow {
  affiliateId: Id<"affiliates">;
  name: string;
  email: string;
  joinedAt: number;
  clicks: number;
  conversions: number;
  totalRevenue: number;
  pendingCommission: number;
  confirmedCommission: number;
}

interface AffiliatesByCampaignTableProps {
  /** When provided, skip the campaign picker dropdown and use this ID directly. */
  campaignId?: Id<"campaigns">;
  /** Campaign name for CSV export filename (F34 fix). Required when campaignId is provided. */
  campaignName?: string;
}

export function AffiliatesByCampaignTable({
  campaignId: propCampaignId,
  campaignName: propCampaignName,
}: AffiliatesByCampaignTableProps) {
  // When campaignId is provided as prop, we're in embedded mode (detail page)
  const isEmbedded = !!propCampaignId;

  // Fetch all campaigns for the dropdown (only when not embedded)
  const campaigns = useQuery(
    api.campaigns.listCampaigns,
    isEmbedded ? "skip" : {}
  );

  // Selected campaign state
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    string | undefined
  >(() => propCampaignId as string | undefined);

  // AC-7: Auto-select first campaign when campaigns load (non-embedded mode only)
  useEffect(() => {
    if (!isEmbedded && campaigns && campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0]._id as string);
    }
  }, [isEmbedded, campaigns, selectedCampaignId]);

  // Column-level filters state
  const [activeFilters, setActiveFilters] = useState<ColumnFilter[]>([]);

  // Sort state
  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | undefined>();

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Effective campaign ID (prop takes precedence)
  const effectiveCampaignId = propCampaignId ?? (selectedCampaignId as Id<"campaigns"> | undefined);

  // Reset to page 1 when campaign changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [effectiveCampaignId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeFilters]);

  // Fetch affiliates for effective campaign — skip if no campaign selected
  const affiliateData = useQuery(
    api.campaigns.getAffiliatesByCampaign,
    effectiveCampaignId
      ? { campaignId: effectiveCampaignId }
      : "skip"
  );

  // ── Client-side filtering ──────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!affiliateData) return [];
    let rows = affiliateData;

    for (const filter of activeFilters) {
      switch (filter.type) {
        case "text": {
          const q = (filter.value ?? "").toLowerCase();
          if (!q) break;
          if (filter.columnKey === "affiliate") {
            rows = rows.filter(
              (r) =>
                r.name.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q)
            );
          } else {
            const field = filter.columnKey as keyof AffiliateRow;
            rows = rows.filter((r) =>
              String(r[field]).toLowerCase().includes(q)
            );
          }
          break;
        }
        case "number-range": {
          const field = filter.columnKey as keyof AffiliateRow;
          if (filter.min != null) {
            rows = rows.filter((r) => (r[field] as number) >= filter.min!);
          }
          if (filter.max != null) {
            rows = rows.filter((r) => (r[field] as number) <= filter.max!);
          }
          break;
        }
        case "date-range": {
          if (filter.after != null) {
            rows = rows.filter((r) => r.joinedAt >= filter.after!);
          }
          if (filter.before != null) {
            rows = rows.filter((r) => r.joinedAt <= filter.before!);
          }
          break;
        }
      }
    }

    return rows;
  }, [affiliateData, activeFilters]);

  // Column definitions — memoized to prevent unnecessary re-renders
  const columns = useMemo(() => [
    {
      key: "affiliate",
      header: "Affiliate",
      sortable: true,
      sortField: "name",
      filterable: true,
      filterType: "text" as const,
      filterLabel: "Name/Email",
      cell: (row: AffiliateRow) => (
        <AvatarCell name={row.name} email={row.email} />
      ),
    },
    {
      key: "joinedAt",
      header: "Joined",
      sortable: true,
      filterable: true,
      filterType: "date-range" as const,
      cell: (row: AffiliateRow) => (
        <DateCell value={row.joinedAt} format="short" />
      ),
    },
    {
      key: "clicks",
      header: "Clicks",
      sortable: true,
      align: "right" as const,
      filterable: true,
      filterType: "number-range" as const,
      filterStep: 1,
      cell: (row: AffiliateRow) => <NumberCell value={row.clicks} />,
    },
    {
      key: "conversions",
      header: "Conversions",
      sortable: true,
      align: "right" as const,
      filterable: true,
      filterType: "number-range" as const,
      filterStep: 1,
      cell: (row: AffiliateRow) => <NumberCell value={row.conversions} />,
    },
    {
      key: "totalRevenue",
      header: "Revenue",
      sortable: true,
      align: "right" as const,
      filterable: true,
      filterType: "number-range" as const,
      filterStep: 0.01,
      cell: (row: AffiliateRow) => (
        <CurrencyCell amount={row.totalRevenue} />
      ),
    },
    {
      key: "pendingCommission",
      header: "Pending",
      sortable: true,
      align: "right" as const,
      filterable: true,
      filterType: "number-range" as const,
      filterStep: 0.01,
      cell: (row: AffiliateRow) => (
        <CurrencyCell amount={row.pendingCommission} muted />
      ),
    },
    {
      key: "confirmedCommission",
      header: "Confirmed",
      sortable: true,
      align: "right" as const,
      filterable: true,
      filterType: "number-range" as const,
      filterStep: 0.01,
      cell: (row: AffiliateRow) => (
        <CurrencyCell amount={row.confirmedCommission} />
      ),
    },
  ], []);

  // ── Client-side sorting ────────────────────────────────────────────────
  const displayData = useMemo(() => {
    if (!sortBy || !sortOrder) return filteredData;

    const sortCol = columns.find(
      (c) => c.key === sortBy || c.sortField === sortBy
    );
    const field = ((sortCol?.sortField || sortCol?.key) || sortBy) as keyof AffiliateRow;
    const direction = sortOrder === "asc" ? 1 : -1;

    return [...filteredData].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal)) * direction;
    });
  }, [filteredData, sortBy, sortOrder, columns]);

  // ── Client-side pagination ─────────────────────────────────────────────
  const totalItems = displayData.length;
  const paginatedData = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return displayData.slice(start, start + pagination.pageSize);
  }, [displayData, pagination]);

  const handlePaginationChange = useCallback(
    (newPagination: PaginationState) => {
      setPagination(newPagination);
    },
    []
  );

  // CSV Export — uses campaignName prop when embedded (F34 fix)
  const handleExportCsv = useCallback(() => {
    if (displayData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const name = propCampaignName
      || campaigns?.find((c) => c._id === effectiveCampaignId)?.name
      || "campaign";

    const sanitizedName = name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const date = new Date().toISOString().split("T")[0];
    const filename = `campaign-affiliates-${sanitizedName}-${date}`;

    const headers = [
      "Affiliate Name",
      "Email",
      "Joined",
      "Clicks",
      "Conversions",
      "Revenue",
      "Pending Commission",
      "Confirmed Commission",
    ];

    const rows = displayData.map((row) => [
      escapeCsvField(row.name),
      escapeCsvField(row.email),
      new Date(row.joinedAt).toLocaleDateString("en-US"),
      String(row.clicks),
      String(row.conversions),
      row.totalRevenue.toFixed(2),
      row.pendingCommission.toFixed(2),
      row.confirmedCommission.toFixed(2),
    ]);

    const csvContent =
      "\uFEFF" +
      headers.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  }, [displayData, campaigns, effectiveCampaignId, propCampaignName]);

  const hasActiveFilters = activeFilters.length > 0;

  // No campaigns state (only in non-embedded mode)
  if (!isEmbedded && campaigns !== undefined && campaigns.length === 0) {
    return (
      <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">
            Affiliates by Campaign
          </h2>
        </div>
        <div className="flex items-center justify-center h-32 text-[#6b7280] text-sm">
          No campaigns yet — create your first campaign to see affiliate
          performance
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e5e7eb] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[#1a1a1a]">
          {isEmbedded ? "Affiliates" : "Affiliates by Campaign"}
        </h2>
        <div className="flex items-center gap-3">
          {/* Campaign Filter Dropdown — only shown in non-embedded mode */}
          {!isEmbedded && (
            <Select
              value={effectiveCampaignId}
              onValueChange={setSelectedCampaignId}
              disabled={!campaigns || campaigns.length === 0}
            >
              <SelectTrigger className="min-w-[200px]">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((campaign) => (
                  <SelectItem key={campaign._id} value={campaign._id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={displayData.length === 0}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="px-5 py-2 border-b border-[#f3f4f6] flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => {
            const label =
              filter.type === "text"
                ? `${filter.columnKey}: "${filter.value}"`
                : filter.type === "number-range"
                  ? `${filter.columnKey}: ${filter.min ?? "0"}–${filter.max ?? "∞"}`
                  : filter.type === "date-range"
                    ? `${filter.columnKey}: ${filter.after ? new Date(filter.after).toLocaleDateString() : "…"} – ${filter.before ? new Date(filter.before).toLocaleDateString() : "…"}`
                    : filter.columnKey;
            return (
              <span
                key={filter.columnKey}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eff6ff] text-[11px] font-medium text-[#1c2260]"
              >
                {label}
                <button
                  type="button"
                  onClick={() =>
                    setActiveFilters((prev) =>
                      prev.filter((f) => f.columnKey !== filter.columnKey)
                    )
                  }
                  className="hover:text-[#1e40af] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveFilters([])}
            className="text-[11px] font-medium text-[#6b7280] hover:text-[#374151] transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table Body */}
      <div className="p-0">
        <DataTable<AffiliateRow>
          key={effectiveCampaignId}
          columns={columns}
          data={paginatedData}
          getRowId={(row) => row.affiliateId}
          isLoading={!isEmbedded ? (campaigns === undefined || affiliateData === undefined) : (affiliateData === undefined)}
          emptyMessage={
            hasActiveFilters
              ? "No affiliates match the current filters"
              : "No affiliates in this campaign"
          }
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
          }}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          pagination={pagination}
          total={totalItems}
          onPaginationChange={handlePaginationChange}
          pageSizeOptions={DEFAULT_PAGE_SIZE_OPTIONS}
          className="border-0 rounded-none"
        />
      </div>
    </div>
  );
}
