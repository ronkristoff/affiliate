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

/** Extended template type for admin query builder with PII warning support. */
export interface AdminTemplate {
  name: string;
  description: string;
  config: string; // JSON-serialized QueryConfig
  piiWarning?: boolean; // Show PII warning when template is selected
}
