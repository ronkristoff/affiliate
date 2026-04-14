"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import type { ColumnFilterType, ColumnFilter, FilterOption } from "@/components/ui/table-filters/types";
import { TextFilter } from "@/components/ui/table-filters/TextFilter";
import { SelectFilter } from "@/components/ui/table-filters/SelectFilter";
import { NumberRangeFilter } from "@/components/ui/table-filters/NumberRangeFilter";
import { DateRangeFilter } from "@/components/ui/table-filters/DateRangeFilter";
import {
  DataTablePagination,
  type PaginationState,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
} from "@/components/ui/DataTablePagination";

// Re-export filter types for consumer convenience
export type { ColumnFilterType, ColumnFilter, FilterOption } from "@/components/ui/table-filters/types";

export type { ReactNode as TableCellValue };

// ============================================================================
// Column Definition Types
// ============================================================================

export interface TableColumn<T> {
  key: string;
  header: string | ReactNode;
  /** Render function for cell content */
  cell: (row: T) => ReactNode;
  /** Optional: make column sortable */
  sortable?: boolean;
  /** Optional: maps column key to actual data field name for sorting.
   *  When omitted, `key` is used. Example: key="affiliate" but data has "affiliateName" → sortField="affiliateName" */
  sortField?: string;
  /** Optional: align content */
  align?: "left" | "center" | "right";
  /** Optional: width in pixels or percentage */
  width?: string | number;
  /** Optional: hide on mobile */
  hideOnMobile?: boolean;
  // ── Column-level filter properties ──────────────────────────────────
  /** Enable column-level filter */
  filterable?: boolean;
  /** Filter control type */
  filterType?: ColumnFilterType;
  /** Options for "select" filter type */
  filterOptions?: FilterOption[];
  /** Human-readable label for filter chips (defaults to column header) */
  filterLabel?: string;
  /** Step increment for "number-range" type (e.g., 0.01 for currency) */
  filterStep?: number;
}

export interface TableAction<T> {
  label: string;
  onClick: (row: T) => void;
  variant?: "default" | "outline" | "destructive" | "success" | "warning" | "info";
  icon?: ReactNode;
  disabled?: (row: T) => boolean;
}

// ============================================================================
// Avatar Helper
// ============================================================================

export function getAvatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: "#dbeafe", text: "#1c2260" },
    { bg: "#fce7f3", text: "#9d174d" },
    { bg: "#ecfdf5", text: "#065f46" },
    { bg: "#ede9fe", text: "#5b21b6" },
    { bg: "#fff7ed", text: "#92400e" },
    { bg: "#f0fdf4", text: "#14532d" },
    { bg: "#fdf4ff", text: "#6b21a8" },
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Pre-built Cell Renderers
// ============================================================================

export function AvatarCell({
  name,
  email,
  size = "default",
}: {
  name: string;
  email?: string;
  size?: "sm" | "default" | "lg";
}) {
  const colors = getAvatarColor(name);
  const initials = getInitials(name);

  const sizeClasses = {
    sm: "w-7 h-7 text-[11px]",
    default: "w-8 h-8 text-[13px]",
    lg: "w-10 h-10 text-[15px]",
  };

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold shrink-0",
          sizeClasses[size]
        )}
        style={{ backgroundColor: colors.bg, color: colors.text }}
      >
        {initials}
      </div>
      <div>
        <div className="font-semibold text-[#1a1d2e] text-[13px]">{name}</div>
        {email && <div className="text-[11px] text-[#5a5f7a]">{email}</div>}
      </div>
    </div>
  );
}

export function CurrencyCell({
  amount,
  muted = false,
}: {
  amount: number;
  muted?: boolean;
}) {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

  return (
    <span
      className={cn(
        "text-[12px] tabular-nums",
        muted ? "text-[#9da1b4]" : "text-[#3f4462]"
      )}
    >
      {formatted}
    </span>
  );
}

export function NumberCell({
  value,
  format = "number",
}: {
  value: number;
  format?: "number" | "percent" | "compact";
}) {
  let formatted: string;
  if (format === "percent") {
    formatted = `${value.toFixed(2)}%`;
  } else if (format === "compact") {
    formatted = value >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : value.toString();
  } else {
    formatted = value.toLocaleString();
  }

  return <span className="text-[12px] tabular-nums text-[#3f4462]">{formatted}</span>;
}

export function DateCell({
  value,
  format = "short",
  size = "default",
}: {
  value: number | string | Date;
  format?: "short" | "long" | "relative" | "relative-full";
  /** Font size: "sm" → text-[11px], "default" → text-[12px] */
  size?: "sm" | "default";
}) {
  const date = value instanceof Date ? value : new Date(value);

  const sizeClass = size === "sm" ? "text-[11px]" : "text-[12px]";

  if (format === "relative" || format === "relative-full") {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (format === "relative-full") {
      if (minutes < 60) return <span className={cn("text-[#5a5f7a]", sizeClass)}>{minutes} minutes ago</span>;
      if (hours < 24) return <span className={cn("text-[#5a5f7a]", sizeClass)}>{hours} hours ago</span>;
      if (days === 1) return <span className={cn("text-[#5a5f7a]", sizeClass)}>1 day ago</span>;
      if (days < 7) return <span className={cn("text-[#5a5f7a]", sizeClass)}>{days} days ago</span>;
      const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
      return <span className={cn("text-[#5a5f7a]", sizeClass)}>{date.toLocaleDateString("en-US", options)}</span>;
    }

    // "relative" — abbreviated format
    if (minutes < 60) return <span className={cn("text-[#5a5f7a]", sizeClass)}>{minutes}m ago</span>;
    if (hours < 24) return <span className={cn("text-[#5a5f7a]", sizeClass)}>{hours}h ago</span>;
    if (days === 1) return <span className={cn("text-[#5a5f7a]", sizeClass)}>1 day ago</span>;
    if (days < 7) return <span className={cn("text-[#5a5f7a]", sizeClass)}>{days} days ago</span>;
  }

  const options: Intl.DateTimeFormatOptions =
    format === "long"
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };

  return <span className={cn("text-[#5a5f7a]", sizeClass)}>{date.toLocaleDateString("en-US", options)}</span>;
}

// ============================================================================
// Sort Icon Helper
// ============================================================================

function SortIcon({ columnKey, sortField, activeSortBy, activeSortOrder, onSort }: {
  columnKey: string;
  sortField?: string;
  activeSortBy?: string;
  activeSortOrder?: "asc" | "desc";
  onSort?: () => void;
}) {
  const isActive = !!activeSortBy && (activeSortBy === columnKey || activeSortBy === sortField);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSort?.();
      }}
      className="inline-flex items-center justify-center ml-1 rounded p-0.5 hover:bg-[#f3f4f6] transition-colors"
      aria-label={isActive ? `Sort ${activeSortOrder === "asc" ? "ascending" : "descending"}` : "Sort"}
    >
      {!isActive && <ArrowUpDown className="w-3.5 h-3.5 text-[#9ca3af]" />}
      {isActive && activeSortOrder === "asc" && <ArrowUp className="w-3.5 h-3.5 text-[#1c2260]" />}
      {isActive && activeSortOrder === "desc" && <ArrowDown className="w-3.5 h-3.5 text-[#1c2260]" />}
    </button>
  );
}

// ============================================================================
// Main DataTable Component
// ============================================================================

interface DataTableProps<T> {
  /** Array of column definitions */
  columns: TableColumn<T>[];
  /** Array of data rows */
  data: T[];
  /** Row key extractor (required for selection and hover) */
  getRowId: (row: T) => string | number;
  /** Optional: enable row selection */
  selectable?: boolean;
  /** Currently selected row IDs */
  selectedIds?: Set<string | number>;
  /** Callback when selection changes */
  onSelectionChange?: (ids: Set<string | number>) => void;
  /** Optional: render row actions (shown in last column) */
  actions?: TableAction<T>[];
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Currently sorted column key */
  sortBy?: string;
  /** Current sort order */
  sortOrder?: "asc" | "desc";
  /** Callback when sort changes. Receives the sortField (or column key if no sortField).
   *  When provided, DataTable does NOT sort data internally — consumer controls sorting. */
  onSortChange?: (sortBy: string, sortOrder: "asc" | "desc") => void;
  /** Optional: callback returning custom CSS classes per row.
   *  Comes LAST in cn() merge order, so it overrides built-in selection highlight. */
  rowClassName?: (row: T) => string;
  // ── Column-level filter props ───────────────────────────────────────
  /** Active column filters (owned by consumer) */
  activeFilters?: ColumnFilter[];
  /** Callback when a column filter changes. DataTable merges with existing filters and emits the full array. */
  onFilterChange?: (filters: ColumnFilter[]) => void;
  // ── Pagination props ────────────────────────────────────────────────
  /** Current pagination state (page number and page size) */
  pagination?: PaginationState;
  /** Total items count for pagination display */
  total?: number;
  /** Callback when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Hide the built-in pagination (use external pagination instead) */
  hidePagination?: boolean;
  /** Custom label for items per page */
  itemsPerPageLabel?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  actions = [],
  isLoading = false,
  emptyMessage = "No data available",
  className,
  onRowClick,
  sortBy,
  sortOrder,
  onSortChange,
  rowClassName,
  activeFilters = [],
  onFilterChange,
  pagination,
  total,
  onPaginationChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  hidePagination = false,
  itemsPerPageLabel,
}: DataTableProps<T>) {
  // Handle select all
  const allSelected =
    data.length > 0 && data.every((row) => selectedIds.has(getRowId(row)));
  const someSelected =
    data.some((row) => selectedIds.has(getRowId(row))) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const allIds = new Set(data.map(getRowId));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSelected = new Set(selectedIds);
    const id = getRowId(row);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    onSelectionChange(newSelected);
  };

  // Sort handler
  const handleSort = (col: TableColumn<T>) => {
    const field = col.sortField || col.key;
    // Check if this column is already sorted (match against both key and sortField
    // since onSortChange may have set sortBy to the field value)
    const isCurrentlySorted = sortBy === col.key || sortBy === col.sortField;
    if (isCurrentlySorted) {
      // Toggle direction
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      onSortChange?.(field, newOrder);
    } else {
      // New column — default to desc
      onSortChange?.(field, "desc");
    }
  };

  // Column filter handler — merges a single column filter update with existing filters
  const handleColumnFilterChange = (updatedFilter: ColumnFilter | null, columnKey: string) => {
    if (!onFilterChange) return;
    let next: ColumnFilter[];
    if (updatedFilter === null) {
      // Remove this column's filter
      next = activeFilters.filter((f) => f.columnKey !== columnKey);
    } else {
      // Replace filter for same columnKey, preserve others
      const exists = activeFilters.some((f) => f.columnKey === columnKey);
      if (exists) {
        next = activeFilters.map((f) => (f.columnKey === columnKey ? updatedFilter : f));
      } else {
        next = [...activeFilters, updatedFilter];
      }
    }
    onFilterChange(next);
  };

  // Client-side sort when onSortChange is NOT provided
  const sortedData = (() => {
    if (!sortBy || !sortOrder || onSortChange) return data;
    const sortCol = columns.find(
      (c) => c.key === sortBy || c.sortField === sortBy
    );
    if (!sortCol || !sortCol.sortable) return data;
    const field = (sortCol.sortField || sortCol.key) as keyof T;
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
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
  })();

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm", className)}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-light)]">
              {selectable && (
                <th className="w-10 px-4 py-2 text-left">
                  <Skeleton className="h-4 w-4" />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2 text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em] bg-gradient-to-r from-[var(--brand-light)]/50 to-transparent",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                  style={{ width: col.width }}
                >
                  {typeof col.header === "string" ? (
                    <Skeleton className="h-3 w-20" />
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {actions.length > 0 && (
                <th className="w-12 px-4 py-2 bg-gradient-to-r from-[var(--brand-light)]/50 to-transparent" />
              )}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="transition-colors hover:bg-[var(--brand-light)]/20">
                {selectable && (
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2">
                    <Skeleton className="h-4 w-full max-w-[200px]" />
                  </td>
                ))}
                {actions.length > 0 && <td className="px-4 py-2" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn("bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm", className)}>
        <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--brand-light)]/50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            {emptyMessage}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-xl overflow-hidden border border-[var(--border-light)] shadow-sm", className)}>
      {/* Subtle gradient overlay on top */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/20 to-transparent" />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-light)]">
              {selectable && (
                <th className="w-10 px-4 py-2 text-left">
                  {/* Checkbox header: no bg/border per AffiliateTable styling reference */}
                  <Checkbox
                    checked={someSelected ? "indeterminate" : allSelected ? true : false}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSortable = col.sortable;
                const isFilterable = col.filterable;
                const isActive = !!isFilterable && activeFilters.some((f) => f.columnKey === col.key);
                const activeFilter = isFilterable ? activeFilters.find((f) => f.columnKey === col.key) : undefined;

                // Render the appropriate filter component based on filterType
                const renderFilter = () => {
                  if (!isFilterable || !col.filterType) return null;
                  const filterProps = {
                    columnKey: col.key,
                    isActive,
                    activeFilter: activeFilter ?? null,
                    onFilterChange: (filter: ColumnFilter | null) =>
                      handleColumnFilterChange(filter, col.key),
                  };
                  switch (col.filterType) {
                    case "text":
                      return <TextFilter {...filterProps} />;
                    case "select":
                      return <SelectFilter {...filterProps} filterOptions={col.filterOptions ?? []} />;
                    case "number-range":
                      return <NumberRangeFilter {...filterProps} filterStep={col.filterStep} />;
                    case "date-range":
                      return <DateRangeFilter {...filterProps} />;
                    default:
                      return null;
                  }
                };

                return (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2 text-left text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em] bg-gradient-to-r from-[var(--brand-light)]/50 to-transparent",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                    style={{ width: col.width }}
                  >
                    <div className={cn("flex items-center", col.align === "right" && "justify-end", col.align === "center" && "justify-center", "min-h-[32px]")}>
                      {typeof col.header === "string" ? (
                        <span>{col.header}</span>
                      ) : (
                        col.header
                      )}
                      {isSortable && (
                        <SortIcon
                          columnKey={col.key}
                          sortField={col.sortField}
                          activeSortBy={sortBy}
                          activeSortOrder={sortOrder}
                          onSort={() => handleSort(col)}
                        />
                      )}
                      {isFilterable && renderFilter()}
                    </div>
                  </th>
                );
              })}
              {actions.length > 0 && (
                <th className="w-12 px-4 py-2 bg-gradient-to-r from-[var(--brand-light)]/50 to-transparent" />
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => {
              const rowId = getRowId(row);
              const isSelected = selectedIds.has(rowId);
              const isClickable = !!onRowClick;
              const customRowClass = rowClassName?.(row);

              return (
                <tr
                  key={rowId}
                  className={cn(
                    "transition-all duration-150 border-b border-[var(--border-light)] last:border-b-0",
                    isClickable && "cursor-pointer",
                    isSelected && !customRowClass && "bg-[var(--brand-light)]/50",
                    !isSelected && "hover:bg-[var(--brand-light)]/20",
                    customRowClass
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td
                      className="px-4 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSelectRow(row, checked as boolean)
                        }
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center"
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-primary)] transition-all duration-150"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="w-44 shadow-xl">
                          {actions.map((action, i) => {
                            const isDisabled = action.disabled?.(row);
                            return (
                              <DropdownMenuItem
                                key={i}
                                disabled={isDisabled}
                                onClick={() => !isDisabled && action.onClick(row)}
                                className={cn(
                                  "gap-2 text-[13px] cursor-pointer py-2",
                                  action.variant === "destructive" && "text-[var(--danger)] focus:text-[var(--danger)] focus:bg-[var(--danger-bg)]",
                                  action.variant === "warning" && "text-[var(--warning-text)] focus:bg-[var(--warning-bg)]",
                                  action.variant === "success" && "text-[var(--success-text)] focus:bg-[var(--success-bg)]",
                                  action.variant === "info" && "text-[var(--info-text)] focus:bg-[var(--info-bg)]"
                                )}
                              >
                                {action.icon && <span className="shrink-0">{action.icon}</span>}
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Pagination footer */}
        {pagination && total !== undefined && onPaginationChange && !hidePagination && (
          <DataTablePagination
            pagination={pagination}
            total={total}
            pageSizeOptions={pageSizeOptions}
            onPaginationChange={onPaginationChange}
            isLoading={isLoading}
            itemsPerPageLabel={itemsPerPageLabel}
          />
        )}
      </div>
      {/* Subtle gradient overlay on bottom */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--brand-primary)]/10 to-transparent" />
    </div>
  );
}

// ============================================================================
// Status Badge Cell Helper
// Uses shadcn Badge wrapper for visual parity with StatusBadge component
// ============================================================================

export function StatusBadgeCell({
  status,
  statusConfig,
}: {
  status: string;
  statusConfig?: Record<
    string,
    { label: string; dotColor: string; bgClass: string; textClass: string }
  >;
}) {
  const defaultConfig: Record<
    string,
    { label: string; dotColor: string; bgClass: string; textClass: string }
  > = {
    active: {
      label: "Active",
      dotColor: "#10b981",
      bgClass: "bg-[var(--success-bg)]",
      textClass: "text-[var(--success-text)]",
    },
    pending: {
      label: "Pending",
      dotColor: "#f59e0b",
      bgClass: "bg-[var(--warning-bg)]",
      textClass: "text-[var(--warning-text)]",
    },
    suspended: {
      label: "Suspended",
      dotColor: "#6b7280",
      bgClass: "bg-[var(--bg-page)]",
      textClass: "text-[var(--text-body)]",
    },
    rejected: {
      label: "Rejected",
      dotColor: "#ef4444",
      bgClass: "bg-[var(--danger-bg)]",
      textClass: "text-[var(--danger-text)]",
    },
  };

  const config = (statusConfig || defaultConfig)[status] || {
    label: status,
    dotColor: "#6b7280",
    bgClass: "bg-[var(--bg-page)]",
    textClass: "text-[var(--text-body)]",
  };

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        config.bgClass,
        config.textClass
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: config.dotColor }}
      />
      {config.label}
    </Badge>
  );
}
