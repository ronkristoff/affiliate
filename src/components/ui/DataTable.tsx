"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ReactNode } from "react";

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
}

export interface TableAction<T> {
  label: string;
  onClick: (row: T) => void;
  variant?: "default" | "outline" | "destructive";
  icon?: ReactNode;
  disabled?: (row: T) => boolean;
}

// ============================================================================
// Avatar Helper
// ============================================================================

export function getAvatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: "#dbeafe", text: "#10409a" },
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
        <div className="font-semibold text-[#333] text-[13px]">{name}</div>
        {email && <div className="text-[11px] text-[#6b7280]">{email}</div>}
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        muted ? "text-[#6b7280]" : "text-[#333]"
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

  return <span className="tabular-nums text-[#333]">{formatted}</span>;
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
      if (minutes < 60) return <span className={cn("text-[#6b7280]", sizeClass)}>{minutes} minutes ago</span>;
      if (hours < 24) return <span className={cn("text-[#6b7280]", sizeClass)}>{hours} hours ago</span>;
      if (days === 1) return <span className={cn("text-[#6b7280]", sizeClass)}>1 day ago</span>;
      if (days < 7) return <span className={cn("text-[#6b7280]", sizeClass)}>{days} days ago</span>;
      const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
      return <span className={cn("text-[#6b7280]", sizeClass)}>{date.toLocaleDateString("en-US", options)}</span>;
    }

    // "relative" — abbreviated format
    if (minutes < 60) return <span className={cn("text-[#6b7280]", sizeClass)}>{minutes}m ago</span>;
    if (hours < 24) return <span className={cn("text-[#6b7280]", sizeClass)}>{hours}h ago</span>;
    if (days === 1) return <span className={cn("text-[#6b7280]", sizeClass)}>1 day ago</span>;
    if (days < 7) return <span className={cn("text-[#6b7280]", sizeClass)}>{days} days ago</span>;
  }

  const options: Intl.DateTimeFormatOptions =
    format === "long"
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };

  return <span className={cn("text-[#6b7280]", sizeClass)}>{date.toLocaleDateString("en-US", options)}</span>;
}

// ============================================================================
// Sort Icon Helper
// ============================================================================

function SortIcon({ columnKey, activeSortBy, activeSortOrder }: {
  columnKey: string;
  activeSortBy?: string;
  activeSortOrder?: "asc" | "desc";
}) {
  if (!activeSortBy || activeSortBy !== columnKey) {
    return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 shrink-0" />;
  }
  if (activeSortOrder === "asc") {
    return <ArrowUp className="w-3 h-3 ml-1 shrink-0" />;
  }
  return <ArrowDown className="w-3 h-3 ml-1 shrink-0" />;
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
    if (sortBy === col.key) {
      // Toggle direction
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      onSortChange?.(field, newOrder);
    } else {
      // New column — default to desc
      onSortChange?.(field, "desc");
    }
  };

  // Client-side sort when onSortChange is NOT provided
  const sortedData = (() => {
    if (!sortBy || !sortOrder || onSortChange) return data;
    const sortCol = columns.find((c) => c.key === sortBy);
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
      <div className={cn("bg-white border border-[#e5e7eb] rounded-xl overflow-hidden", className)}>
        <table className="w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2.5 text-left">
                  <Skeleton className="h-4 w-4" />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]",
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
                <th className="w-12 px-4 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb]" />
              )}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-[#f3f4f6]">
                {selectable && (
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[200px]" />
                  </td>
                ))}
                {actions.length > 0 && <td className="px-4 py-3" />}
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
      <div className={cn("bg-white border border-[#e5e7eb] rounded-xl overflow-hidden", className)}>
        <div className="flex items-center justify-center h-32 text-[#6b7280] text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white border border-[#e5e7eb] rounded-xl overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2.5 text-left">
                  {/* Checkbox header: no bg/border per AffiliateTable styling reference */}
                  <Checkbox
                    checked={someSelected ? "indeterminate" : allSelected ? true : false}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSortable = col.sortable;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      isSortable && "cursor-pointer select-none hover:text-[#10409a] transition-colors"
                    )}
                    style={{ width: col.width }}
                    onClick={isSortable ? () => handleSort(col) : undefined}
                  >
                    <div className={cn("flex items-center", col.align === "right" && "justify-end", col.align === "center" && "justify-center", "min-h-[44px]")}>
                      {typeof col.header === "string" ? (
                        <span>{col.header}</span>
                      ) : (
                        col.header
                      )}
                      {isSortable && (
                        <SortIcon
                          columnKey={col.key}
                          activeSortBy={sortBy}
                          activeSortOrder={sortOrder}
                        />
                      )}
                    </div>
                  </th>
                );
              })}
              {actions.length > 0 && (
                <th className="w-12 px-4 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb]" />
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
                    "border-b border-[#f3f4f6] transition-colors",
                    isClickable && "cursor-pointer",
                    isSelected && !customRowClass && "bg-[#eff6ff]",
                    !isSelected && "hover:bg-[#f9fafb]",
                    customRowClass
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td
                      className="px-4 py-3"
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
                        "px-4 py-3",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center"
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {actions.map((action, i) => {
                          const isDisabled = action.disabled?.(row);
                          return (
                            <button
                              key={i}
                              onClick={() => !isDisabled && action.onClick(row)}
                              disabled={isDisabled}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors",
                                action.variant === "destructive" &&
                                  "text-[#ef4444] border border-[#ef4444] hover:bg-[#fef2f2]",
                                action.variant === "outline" &&
                                  "border border-[#e5e7eb] hover:bg-[#f9fafb]",
                                (!action.variant || action.variant === "default") &&
                                  "bg-[#10409a] text-white hover:bg-[#1659d6]",
                                isDisabled && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {action.icon && (
                                <span className="mr-1">{action.icon}</span>
                              )}
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
      bgClass: "bg-[#d1fae5]",
      textClass: "text-[#065f46]",
    },
    pending: {
      label: "Pending",
      dotColor: "#f59e0b",
      bgClass: "bg-[#fef3c7]",
      textClass: "text-[#92400e]",
    },
    suspended: {
      label: "Suspended",
      dotColor: "#6b7280",
      bgClass: "bg-[#f3f4f6]",
      textClass: "text-[#374151]",
    },
    rejected: {
      label: "Rejected",
      dotColor: "#ef4444",
      bgClass: "bg-[#fee2e2]",
      textClass: "text-[#991b1b]",
    },
  };

  const config = (statusConfig || defaultConfig)[status] || {
    label: status,
    dotColor: "#6b7280",
    bgClass: "bg-[#f3f4f6]",
    textClass: "text-[#374151]",
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
