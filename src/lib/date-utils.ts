/**
 * Shared date utility functions for date-range filters and selectors.
 * Extracted from DateRangeSelector.tsx for reuse across the application.
 */

/**
 * Date preset definition used by date-range filters and selectors.
 */
export interface DatePreset {
  label: string;
  value: string;
  getRange: () => { start: number; end: number } | null;
}

/**
 * Preset date ranges for quick-select filtering.
 * Reused by DateRangeFilter (column filter) and DateRangeSelector (dashboard).
 */
export const DATE_PRESETS: DatePreset[] = [
  {
    label: "Last 7 days",
    value: "7d",
    getRange: () => {
      const end = Date.now();
      const start = end - 7 * 24 * 60 * 60 * 1000;
      return { start, end };
    },
  },
  {
    label: "Last 30 days",
    value: "30d",
    getRange: () => {
      const end = Date.now();
      const start = end - 30 * 24 * 60 * 60 * 1000;
      return { start, end };
    },
  },
  {
    label: "Last 90 days",
    value: "90d",
    getRange: () => {
      const end = Date.now();
      const start = end - 90 * 24 * 60 * 60 * 1000;
      return { start, end };
    },
  },
  {
    label: "This month",
    value: "thisMonth",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { start, end: Date.now() };
    },
  },
  {
    label: "Last month",
    value: "lastMonth",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 0);
      start.setDate(1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: start.getTime(), end: end.getTime() };
    },
  },
  {
    label: "Custom",
    value: "custom",
    getRange: () => null,
  },
];

/**
 * Converts a date string (YYYY-MM-DD) to timestamp at end of day.
 * Use for "before" / upper-bound date filters (captures the full day).
 */
export function dateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Converts a date string (YYYY-MM-DD) to timestamp at start of day.
 * Use for "after" / lower-bound date filters (captures from the start of the day).
 */
export function dateToStartTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Converts timestamp to YYYY-MM-DD format for input value.
 */
export function timestampToDateInput(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}
