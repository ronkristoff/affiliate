"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
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
}: {
  value: number | string | Date;
  format?: "short" | "long" | "relative";
}) {
  const date = value instanceof Date ? value : new Date(value);

  if (format === "relative") {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return <span className="text-[#6b7280]">{minutes}m ago</span>;
    if (hours < 24) return <span className="text-[#6b7280]">{hours}h ago</span>;
    if (days === 1) return <span className="text-[#6b7280]">1 day ago</span>;
    if (days < 7) return <span className="text-[#6b7280]">{days} days ago</span>;
  }

  const options: Intl.DateTimeFormatOptions =
    format === "long"
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };

  return <span className="text-[#6b7280]">{date.toLocaleDateString("en-US", options)}</span>;
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

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("bg-white border border-[#e5e7eb] rounded-xl overflow-hidden", className)}>
        <table className="w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb]">
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
                <th className="w-10 px-4 py-2.5 text-left bg-[#fafafa] border-b border-[#e5e7eb]">
                  <Checkbox
                    checked={someSelected ? "indeterminate" : allSelected ? true : false}
                    onCheckedChange={handleSelectAll}
                  />
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
                  {col.header}
                </th>
              ))}
              {actions.length > 0 && (
                <th className="w-12 px-4 py-2.5 bg-[#fafafa] border-b border-[#e5e7eb]" />
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const rowId = getRowId(row);
              const isSelected = selectedIds.has(rowId);
              const isClickable = !!onRowClick;

              return (
                <tr
                  key={rowId}
                  className={cn(
                    "border-b border-[#f3f4f6] transition-colors",
                    isClickable && "cursor-pointer",
                    isSelected && "bg-[#eff6ff]",
                    !isSelected && "hover:bg-[#f9fafb]"
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
// Compact Table Variant (no borders, lighter styling)
// ============================================================================

interface CompactTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function CompactTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  className,
}: CompactTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn("bg-white rounded-xl p-4", className)}>
        <p className="text-sm text-[#6b7280] text-center py-4">No data available</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-xl overflow-hidden", className)}>
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-2.5 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide bg-[#fafafa] border-b border-[#e5e7eb]",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={getRowId(row)}
              className={cn(
                "border-b border-[#f3f4f6] last:border-b-0 hover:bg-[#f9fafb] transition-colors",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-[13px]",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Status Badge Cell Helper
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
    <span
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
    </span>
  );
}
