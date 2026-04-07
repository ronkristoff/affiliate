"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Search, LayoutGrid, List, SlidersHorizontal, Calendar } from "lucide-react";
import { FilterPill } from "@/components/ui/FilterPill";
import { MultiSelect } from "@/components/ui/MultiSelect";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
] as const;

type CampaignStatus = "active" | "paused" | "archived";

export interface FilterState {
  statusFilter?: CampaignStatus[];
  commissionTypeFilter?: "percentage" | "flatFee";
  recurringFilter?: boolean;
  createdAfter?: number;
  createdBefore?: number;
  searchQuery: string;
}

export type ViewMode = "cards" | "table";

interface CampaignFiltersProps {
  initialStatusFilter?: CampaignStatus | null;
  onFilterChange: (filters: FilterState) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function CampaignFilters({
  initialStatusFilter,
  onFilterChange,
  onViewModeChange,
}: CampaignFiltersProps) {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus[]>(
    initialStatusFilter ? [initialStatusFilter] : []
  );
  const [commissionTypeFilter, setCommissionTypeFilter] = useState<string>("all");
  const [recurringFilter, setRecurringFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDateRange, setShowDateRange] = useState(false);
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");

  // Get total campaign count for context-aware view toggle default
  const campaignStats = useQuery(api.campaigns.getCampaignStats);
  const totalCampaigns = campaignStats?.total ?? 0;

  // Context-aware default: cards for <10, table for 10+ (AC 19/20)
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const userManuallySetView = useRef(false);

  // Update view mode default when stats resolve — only if user hasn't manually chosen
  useEffect(() => {
    if (campaignStats !== undefined && !userManuallySetView.current) {
      const defaultMode: ViewMode = totalCampaigns >= 10 ? "table" : "cards";
      setViewMode(defaultMode);
      onViewModeChange(defaultMode);
    }
  }, [totalCampaigns, campaignStats, onViewModeChange]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filter state and notify parent
  const filterState = useMemo((): FilterState => ({
    statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
    commissionTypeFilter: commissionTypeFilter !== "all" ? (commissionTypeFilter as "percentage" | "flatFee") : undefined,
    recurringFilter: recurringFilter !== "all" ? (recurringFilter === "recurring" ? true : false) : undefined,
    createdAfter: createdAfter ? new Date(createdAfter + "T00:00:00").getTime() : undefined,
    createdBefore: createdBefore ? new Date(createdBefore + "T00:00:00").getTime() : undefined,
    searchQuery: debouncedSearch,
  }), [statusFilter, commissionTypeFilter, recurringFilter, createdAfter, createdBefore, debouncedSearch]);

  useEffect(() => {
    onFilterChange(filterState);
  }, [filterState, onFilterChange]);

  // Count active filters (excluding search)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter.length > 0) count++;
    if (commissionTypeFilter !== "all") count++;
    if (recurringFilter !== "all") count++;
    if (createdAfter) count++;
    if (createdBefore) count++;
    return count;
  }, [statusFilter, commissionTypeFilter, recurringFilter, createdAfter, createdBefore]);

  const clearAllFilters = useCallback(() => {
    setStatusFilter([]);
    setCommissionTypeFilter("all");
    setRecurringFilter("all");
    setSearchQuery("");
    setCreatedAfter("");
    setCreatedBefore("");
    setShowDateRange(false);
  }, []);

  const removeFilter = useCallback((filter: string) => {
    switch (filter) {
      case "status":
        setStatusFilter([]);
        break;
      case "commissionType":
        setCommissionTypeFilter("all");
        break;
      case "recurring":
        setRecurringFilter("all");
        break;
      case "dateRange":
        setCreatedAfter("");
        setCreatedBefore("");
        break;
    }
  }, []);

  // Build contextual empty state message (AC 21)
  const getEmptyContext = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter.length > 0) parts.push(...statusFilter);
    if (commissionTypeFilter !== "all") parts.push(commissionTypeFilter === "percentage" ? "percentage" : "flat fee");
    if (recurringFilter !== "all") parts.push(recurringFilter === "recurring" ? "recurring" : "one-time");
    return parts;
  }, [statusFilter, commissionTypeFilter, recurringFilter]);

  // Expose getEmptyContext via data attribute for CampaignListView to read
  // (simpler than prop drilling — both components share the same parent)

  return (
    <div className="space-y-3">
      {/* Primary Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" />
          <Input
            placeholder="Search within current page"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        {/* Status filter — multi-select */}
        <MultiSelect
          options={[...STATUS_OPTIONS]}
          selected={statusFilter}
          onChange={(values) => setStatusFilter(values as CampaignStatus[])}
          placeholder="All Status"
        />

        {/* Commission type filter */}
        <Select value={commissionTypeFilter} onValueChange={setCommissionTypeFilter}>
          <SelectTrigger className="w-[150px] h-9 text-[13px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="percentage">Percentage</SelectItem>
            <SelectItem value="flatFee">Flat Fee</SelectItem>
          </SelectContent>
        </Select>

        {/* Recurring filter */}
        <Select value={recurringFilter} onValueChange={setRecurringFilter}>
          <SelectTrigger className="w-[140px] h-9 text-[13px]">
            <SelectValue placeholder="Recurring" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="one-time">One-time</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range toggle (secondary) */}
        <Button
          variant={showDateRange ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDateRange(!showDateRange)}
          className={`h-9 gap-1.5 text-[13px] ${showDateRange ? "bg-[#1fb5a5] text-white" : ""}`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Date Range
        </Button>

        {/* View toggle */}
        <div className="flex items-center border border-[#d1d5db] rounded-lg overflow-hidden">
          <button
            onClick={() => {
              userManuallySetView.current = true;
              setViewMode("cards");
              onViewModeChange("cards");
            }}
            className={`flex items-center justify-center w-9 h-9 transition-colors ${
              viewMode === "cards"
                ? "bg-[#1fb5a5] text-white"
                : "bg-white text-[#6b7280] hover:bg-gray-50"
            }`}
            title="Card view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              userManuallySetView.current = true;
              setViewMode("table");
              onViewModeChange("table");
            }}
            className={`flex items-center justify-center w-9 h-9 transition-colors ${
              viewMode === "table"
                ? "bg-[#1fb5a5] text-white"
                : "bg-white text-[#6b7280] hover:bg-gray-50"
            }`}
            title="Table view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date Range (expandable) */}
      {showDateRange && (
        <div className="flex items-center gap-3 pl-1">
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-[#6b7280]">Created after</label>
            <input
              type="date"
              value={createdAfter}
              onChange={(e) => setCreatedAfter(e.target.value)}
              className="h-8 px-2 text-[13px] border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1fb5a5]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-[#6b7280]">Created before</label>
            <input
              type="date"
              value={createdBefore}
              onChange={(e) => setCreatedBefore(e.target.value)}
              className="h-8 px-2 text-[13px] border border-[#d1d5db] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1fb5a5]"
            />
          </div>
          {(createdAfter || createdBefore) && (
            <button
              onClick={() => {
                setCreatedAfter("");
                setCreatedBefore("");
              }}
              className="text-[11px] text-[#6b7280] hover:text-[#374151] flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear dates
            </button>
          )}
        </div>
      )}

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter.length > 0 && statusFilter.map((status) => (
            <FilterPill
              key={status}
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              onRemove={() => setStatusFilter(statusFilter.filter((s) => s !== status))}
            />
          ))}
          {commissionTypeFilter !== "all" && (
            <FilterPill
              label={commissionTypeFilter === "percentage" ? "Percentage" : "Flat Fee"}
              onRemove={() => removeFilter("commissionType")}
            />
          )}
          {recurringFilter !== "all" && (
            <FilterPill
              label={recurringFilter === "recurring" ? "Recurring" : "One-time"}
              onRemove={() => removeFilter("recurring")}
            />
          )}
          {(createdAfter || createdBefore) && (
            <FilterPill
              label="Date Range"
              onRemove={() => removeFilter("dateRange")}
            />
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-[11px] font-medium text-[#6b7280] hover:text-[#374151] transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Search helper text */}
      {debouncedSearch && (
        <p className="text-[11px] text-[#9ca3af] pl-1">
          For exact campaign lookup, use the status and type filters.
        </p>
      )}
    </div>
  );
}
