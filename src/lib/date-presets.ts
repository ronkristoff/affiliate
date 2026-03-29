/**
 * Date preset utilities for the Query Builder.
 * Extracted from FilterBuilder for shared use in toolbar.
 */

export interface DatePreset {
  label: string;
  start: () => number;
  end: () => number;
}

export interface DateRange {
  start: number;
  end: number;
  preset?: string;
}

// Helper functions
export function startOfDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function startOfMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfLastMonth(): number {
  const d = new Date();
  d.setDate(0);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfYear(): number {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const DATE_PRESETS: DatePreset[] = [
  { label: "Today", start: startOfDay, end: endOfDay },
  { label: "Yesterday", start: () => startOfDay() - 86400000, end: startOfDay },
  { label: "Last 7 days", start: () => Date.now() - 7 * 86400000, end: () => Date.now() },
  { label: "Last 30 days", start: () => Date.now() - 30 * 86400000, end: () => Date.now() },
  { label: "This month", start: startOfMonth, end: () => Date.now() },
  { label: "Last month", start: startOfLastMonth, end: startOfMonth },
  { label: "This year", start: startOfYear, end: () => Date.now() },
];
