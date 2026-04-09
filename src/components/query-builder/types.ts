/**
 * Shared types for the Query Builder feature.
 * Used by TableSelector, JoinBuilder, ColumnSelector, and page-level components.
 */

/** A suggested join relationship between two tables, returned by getTableMetadata. */
export interface SuggestedJoin {
  leftTable: string;
  leftField: string;
  rightTable: string;
  rightField: string;
  label: string;
}
