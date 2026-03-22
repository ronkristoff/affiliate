"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginationResult {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface DataTablePaginationProps {
  /** Current pagination state */
  pagination: PaginationState;
  /** Total items count */
  total: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Callback when pagination changes */
  onPaginationChange: (pagination: PaginationState) => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom label for "items per page" */
  itemsPerPageLabel?: string;
  /** Custom label for "showing X to Y of Z" */
  showingLabel?: string;
  /** Custom label for "of X items" */
  ofLabel?: string;
  /** Show/hide items per page selector */
  showPageSizeSelector?: boolean;
  /** Maximum number of page buttons to show (default: 7) */
  maxPageButtons?: number;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Calculate page numbers to display with ellipsis for large page counts
 */
function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxButtons: number = 7
): (number | "ellipsis")[] {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const halfMax = Math.floor(maxButtons / 2);
  
  // Always show first page
  pages.push(1);
  
  if (currentPage > halfMax + 2) {
    pages.push("ellipsis");
  }
  
  // Calculate range around current page
  const start = Math.max(2, currentPage - halfMax);
  const end = Math.min(totalPages - 1, currentPage + halfMax);
  
  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }
  
  if (currentPage < totalPages - halfMax - 1) {
    pages.push("ellipsis");
  }
  
  // Always show last page
  if (!pages.includes(totalPages)) {
    pages.push(totalPages);
  }
  
  return pages;
}

export function DataTablePagination({
  pagination,
  total,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPaginationChange,
  isLoading = false,
  className,
  itemsPerPageLabel = "Items per page",
  showingLabel = "Showing",
  ofLabel = "of",
  showPageSizeSelector = true,
  maxPageButtons = 7,
}: DataTablePaginationProps) {
  const { page, pageSize } = pagination;
  const totalPages = Math.ceil(total / pageSize) || 1;
  
  // Calculate range for "Showing X to Y of Z"
  const startItem = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, total);
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    onPaginationChange({ ...pagination, page: newPage });
  };
  
  const handlePageSizeChange = (newPageSize: number) => {
    // Reset to page 1 when changing page size
    onPaginationChange({ page: 1, pageSize: newPageSize });
  };

  const pageNumbers = getPageNumbers(page, totalPages, maxPageButtons);
  
  // If there's no data or only one page, don't show pagination
  if (total === 0) {
    return null;
  }
  
  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4", className)}>
      {/* Left side: Items per page selector */}
      <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
        {showPageSizeSelector && (
          <>
            <span className="whitespace-nowrap">{itemsPerPageLabel}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 w-[70px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      
      {/* Center: Showing X to Y of Z */}
      <div className="text-[12px] text-[#6b7280]">
        {showingLabel} {startItem}–{endItem} {ofLabel} {total} {total === 1 ? "item" : "items"}
      </div>
      
      {/* Right side: Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page button */}
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={page <= 1 || isLoading}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#e5e7eb] transition-colors",
              "hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed",
              "text-[#6b7280] hover:text-[#374151]"
            )}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          
          {/* Previous page button */}
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#e5e7eb] transition-colors",
              "hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed",
              "text-[#6b7280] hover:text-[#374151]"
            )}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          
          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((pageNum, index) => {
              if (pageNum === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="inline-flex items-center justify-center h-8 w-8 text-[12px] text-[#6b7280]"
                  >
                    …
                  </span>
                );
              }
              
              const isActive = pageNum === page;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isLoading}
                  className={cn(
                    "inline-flex items-center justify-center h-8 w-8 rounded-md text-[12px] font-medium transition-colors",
                    isActive
                      ? "bg-[#10409a] text-white"
                      : "border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#374151]",
                    isLoading && "opacity-40 cursor-not-allowed"
                  )}
                  aria-label={`Go to page ${pageNum}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          {/* Next page button */}
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#e5e7eb] transition-colors",
              "hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed",
              "text-[#6b7280] hover:text-[#374151]"
            )}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          
          {/* Last page button */}
          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#e5e7eb] transition-colors",
              "hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed",
              "text-[#6b7280] hover:text-[#374151]"
            )}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact pagination variant for smaller tables
 */
export function DataTablePaginationCompact({
  pagination,
  total,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPaginationChange,
  isLoading = false,
  className,
}: Omit<DataTablePaginationProps, "showPageSizeSelector">) {
  const { page, pageSize } = pagination;
  const totalPages = Math.ceil(total / pageSize) || 1;
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || isLoading) return;
    onPaginationChange({ ...pagination, page: newPage });
  };
  
  if (total === 0 || totalPages <= 1) {
    return null;
  }
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => handlePageChange(page - 1)}
        disabled={page <= 1 || isLoading}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded border border-[#e5e7eb] transition-colors",
          "hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed",
          "text-[#6b7280]"
        )}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      
      <span className="px-2 text-[12px] text-[#6b7280]">
        {page} / {totalPages}
      </span>
      
      <button
        type="button"
        onClick={() => handlePageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded border border-[#e5e7eb] transition-colors",
          "hover:bg-[#f9fafb] disabled:opacity-40 disabled:cursor-not-allowed",
          "text-[#6b7280]"
        )}
        aria-label="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
