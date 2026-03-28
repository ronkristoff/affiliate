"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export interface DateRange {
  start: number;
  end: number;
  label: string;
  isCustom: boolean;
  preset?: string;
}

export interface UseDateRangeReturn {
  dateRange: DateRange | undefined;
  isCustomRange: boolean;
  preset: string | null;
  customStart: number | null;
  customEnd: number | null;
  setDateRange: (range: DateRange) => void;
  refreshFromUrl: () => void;
}

/**
 * Default date range: This Month
 */
const DEFAULT_THIS_MONTH = () => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    end: Date.now(),
  };
};

/**
 * Parse date range from URL search params
 */
function parseDateRangeFromParams(searchParams: URLSearchParams): DateRange {
  const rangeParam = searchParams.get("range");
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const now = Date.now();

  // Check for custom range first (start and end params)
  if (startParam && endParam) {
    const start = parseInt(startParam, 10);
    const end = parseInt(endParam, 10);
    
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const options: Intl.DateTimeFormatOptions = { 
        month: "short", 
        day: "numeric", 
        year: "numeric" 
      };
      
      return {
        start,
        end,
        label: `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`,
        isCustom: true,
      };
    }
  }

  // Parse preset ranges
  switch (rangeParam) {
    case "today": {
      const nowDate = new Date();
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
      return {
        start,
        end: now,
        label: "Today",
        isCustom: false,
        preset: "today",
      };
    }
    case "thisWeek": {
      const nowDate = new Date();
      const dayOfWeek = nowDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - mondayOffset).getTime();
      return {
        start,
        end: now,
        label: "This Week",
        isCustom: false,
        preset: "thisWeek",
      };
    }
    case "thisMonth": {
      const nowDate = new Date();
      return {
        start: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime(),
        end: now,
        label: "This Month",
        isCustom: false,
        preset: "thisMonth",
      };
    }
    case "lastMonth": {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
      start.setDate(1); // First day of prev month
      const end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
      return {
        start: start.getTime(),
        end: end.getTime(),
        label: "Last Month",
        isCustom: false,
        preset: "lastMonth",
      };
    }
    case "allTime": {
      return {
        start: 1,
        end: now,
        label: "All Time",
        isCustom: false,
        preset: "allTime",
      };
    }
    default:
      // Default to this month
      const defaultRange = DEFAULT_THIS_MONTH();
      return {
        start: defaultRange.start,
        end: defaultRange.end,
        label: "This Month",
        isCustom: false,
        preset: "thisMonth",
      };
  }
}

/**
 * Helper function: Update URL with date range parameters
 */
function updateUrlWithDateRange(
  router: ReturnType<typeof useRouter>,
  searchParams: URLSearchParams,
  range: DateRange
) {
  const params = new URLSearchParams(searchParams.toString());
  
  if (range.isCustom) {
    // Custom range: use start/end params
    params.delete("range");
    params.set("start", range.start.toString());
    params.set("end", range.end.toString());
  } else if (range.preset) {
    // Preset range: use range param
    params.set("range", range.preset);
    params.delete("start");
    params.delete("end");
  }
  
  router.push(`?${params.toString()}`, { scroll: false });
}

/**
 * Custom hook for managing date range state from URL params
 * Provides consistent date range state across all reports pages
 */
export function useDateRange(): UseDateRangeReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse initial date range from URL
  const [dateRange, setDateRangeState] = useState<DateRange>(() => 
    parseDateRangeFromParams(searchParams)
  );

  // Refresh from URL when params change
  useEffect(() => {
    setDateRangeState(parseDateRangeFromParams(searchParams));
  }, [searchParams]);

  // Update date range state AND URL
  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range);
    updateUrlWithDateRange(router, searchParams, range);
  }, [router, searchParams]);

  // Manual refresh from URL (useful after programmatic URL changes)
  const refreshFromUrl = useCallback(() => {
    setDateRangeState(parseDateRangeFromParams(searchParams));
  }, [searchParams]);

  // Memoized values for performance
  const isCustomRange = useMemo(() => dateRange?.isCustom ?? false, [dateRange?.isCustom]);
  const preset = useMemo(() => dateRange?.preset ?? null, [dateRange?.preset]);
  const customStart = useMemo(() => 
    dateRange?.isCustom ? dateRange.start : null, 
    [dateRange?.isCustom, dateRange?.start]
  );
  const customEnd = useMemo(() => 
    dateRange?.isCustom ? dateRange.end : null, 
    [dateRange?.isCustom, dateRange?.end]
  );

  return {
    dateRange,
    isCustomRange,
    preset,
    customStart,
    customEnd,
    setDateRange,
    refreshFromUrl,
  };
}

/**
 * Helper function: Get date range object suitable for backend queries
 * Returns { start, end } or undefined for default behavior
 */
export function getQueryDateRange(dateRange: DateRange | undefined): { start: number; end: number } | undefined {
  if (!dateRange) return undefined;
  return {
    start: dateRange.start,
    end: dateRange.end,
  };
}

/**
 * Helper function: Format date range for display
 */
export function formatDateRangeLabel(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  };
  
  return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
}

/**
 * Helper function: Convert date input (YYYY-MM-DD) to timestamp
 */
export function dateInputToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Helper function: Convert timestamp to date input format (YYYY-MM-DD)
 */
export function timestampToDateInput(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

/**
 * Helper function: Get max date for date picker (today)
 */
export function getMaxDateInput(): string {
  return timestampToDateInput(Date.now());
}
