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
  /** Optional sparkline granularity. Used by dashboard to control chart bucketing. */
  period?: "daily" | "weekly" | "monthly";
  getRange: () => { start: number; end: number } | null;
}

/**
 * Preset date ranges for quick-select filtering.
 * Reused by DateRangeFilter (column filter) and DateRangeSelector (dashboard).
 *
 * Groups (by value):
 *   Quick:    today, thisWeek, thisMonth
 *   Calendar: lastMonth, allTime
 *   Custom:   custom
 */
export const DATE_PRESETS: DatePreset[] = [
  // ── Quick ranges ──────────────────────────────────────────────
  {
    label: "Today",
    value: "today",
    period: "daily",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { start, end: Date.now() };
    },
  },
  {
    label: "This Week",
    value: "thisWeek",
    period: "daily",
    getRange: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      // Monday start of week
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).getTime();
      return { start, end: Date.now() };
    },
  },
  {
    label: "This Month",
    value: "thisMonth",
    period: "weekly",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { start, end: Date.now() };
    },
  },

  // ── Calendar ranges ───────────────────────────────────────────
  {
    label: "Last Month",
    value: "lastMonth",
    period: "monthly",
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 0);
      start.setDate(1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: start.getTime(), end: end.getTime() };
    },
  },
  {
    label: "All Time",
    value: "allTime",
    period: "monthly",
    getRange: () => {
      // start=1 so sparkline bucketing works (epoch 0 edge case);
      // all real data will be captured since _creationTime is always > 1
      return { start: 1, end: Date.now() };
    },
  },

  // ── Custom range ──────────────────────────────────────────────
  {
    label: "Custom",
    value: "custom",
    getRange: () => null,
  },
];

/**
 * Infers sparkline period from a date range duration.
 * Used when the user picks a Custom date range (no preset period).
 */
export function inferPeriodFromRange(start: number, end: number): "daily" | "weekly" | "monthly" {
  const durationDays = (end - start) / (24 * 60 * 60 * 1000);
  if (durationDays <= 31) return "daily";
  if (durationDays <= 90) return "weekly";
  return "monthly";
}

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
