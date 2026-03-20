/**
 * Column-level filter types for DataTable.
 * These types define the contract between filter UI components and consumer pages.
 */

export type ColumnFilterType = "text" | "select" | "number-range" | "date-range";

export interface ColumnFilter {
  columnKey: string;
  type: ColumnFilterType;
  /** For "text" type — the search string */
  value?: string;
  /** For "select" type — array of selected option values */
  values?: string[];
  /** For "number-range" — minimum bound (null = unbounded) */
  min?: number | null;
  /** For "number-range" — maximum bound (null = unbounded) */
  max?: number | null;
  /** For "date-range" — start timestamp in unix ms (null = unbounded) */
  after?: number | null;
  /** For "date-range" — end timestamp in unix ms (null = unbounded) */
  before?: number | null;
}

export interface FilterOption {
  value: string;
  label: string;
}
