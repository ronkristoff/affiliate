"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  total,
  pageSize = 10,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total ?? currentPage * pageSize);

  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-sm text-[#6b7280]">
        Showing {startItem}–{endItem}
        {total !== undefined && ` of ${total}`}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition-colors",
            "hover:bg-[#f9fafb] hover:text-[#333333]",
            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((page) => {
            // Show first, last, current, and adjacent pages
            return (
              page === 1 ||
              page === totalPages ||
              Math.abs(page - currentPage) <= 1
            );
          })
          .reduce<Array<number | "ellipsis">>((acc, page, idx, arr) => {
            if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
              acc.push("ellipsis");
            }
            acc.push(page);
            return acc;
          }, [])
          .map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="inline-flex h-8 w-8 items-center justify-center text-sm text-[#6b7280]"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                  currentPage === item
                    ? "border-[#10409a] bg-[#10409a] text-white"
                    : "border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#333333]"
                )}
              >
                {item}
              </button>
            )
          )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#6b7280] transition-colors",
            "hover:bg-[#f9fafb] hover:text-[#333333]",
            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
