/**
 * Shared pure-function utilities for Query Builder modules.
 *
 * Both tenant QB (convex/queryBuilder.ts) and admin QB (convex/admin/queryBuilder.ts)
 * import from this file. No Convex ctx required — these are pure data transformations.
 *
 * Extracted from queryBuilder.ts (v1) to eliminate duplication between tenant and admin QB.
 */

import { v } from "convex/values";

// ============================================
// Types
// ============================================

export type ColumnType = "string" | "number" | "boolean" | "date" | "id";

export interface ColumnDef {
  name: string;
  type: ColumnType;
  label: string;
  filterable: boolean;
  aggregatable: boolean;
  groupable: boolean;
}

export interface TableDef {
  name: string;
  label: string;
  description: string;
  columns: ColumnDef[];
}

// ============================================
// Metadata Constants
// ============================================

/** Valid filter operators per column type */
export const OPERATORS_BY_TYPE: Record<ColumnType, string[]> = {
  string: ["equals", "not_equals", "contains", "not_contains", "in_list"],
  number: ["equals", "not_equals", "gt", "gte", "lt", "lte", "between"],
  boolean: ["equals"],
  date: ["equals", "not_equals", "gt", "gte", "lt", "lte", "between"],
  id: ["equals", "in_list"],
};

export const VALID_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in_list",
  "is_null",
  "is_not_null",
] as const;

export const VALID_AGGREGATIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX"] as const;

// ============================================
// Validators
// ============================================

export const filterOperatorValidator = v.union(
  v.literal("equals"),
  v.literal("not_equals"),
  v.literal("contains"),
  v.literal("not_contains"),
  v.literal("gt"),
  v.literal("gte"),
  v.literal("lt"),
  v.literal("lte"),
  v.literal("between"),
  v.literal("in_list"),
  v.literal("is_null"),
  v.literal("is_not_null")
);

export const filterValidator = v.object({
  id: v.string(),
  table: v.string(),
  column: v.string(),
  operator: filterOperatorValidator,
  value: v.optional(v.union(v.string(), v.number(), v.boolean())),
  valueTo: v.optional(v.union(v.string(), v.number())), // for "between" operator
  values: v.optional(v.array(v.union(v.string(), v.number()))), // for "in_list" operator
});

export const joinValidator = v.object({
  id: v.string(),
  leftTable: v.string(),
  rightTable: v.string(),
  leftField: v.string(),
  rightField: v.string(),
  joinType: v.optional(v.union(v.literal("inner"), v.literal("left"))),
});

export const aggregationValidator = v.object({
  id: v.string(),
  table: v.string(),
  column: v.string(),
  function: v.union(
    v.literal("COUNT"),
    v.literal("SUM"),
    v.literal("AVG"),
    v.literal("MIN"),
    v.literal("MAX")
  ),
  alias: v.string(),
});

// ============================================
// Shared Sub-Pattern Helpers
// ============================================

/**
 * Build a deterministic group key from row values for the given groupBy columns.
 * Used identically in both applyAggregations and applyGroupBy.
 */
export function buildGroupKey(
  row: Record<string, unknown>,
  groupBy: Array<{ table: string; column: string }>
): string {
  return groupBy.map((g) => String(row[g.column] ?? "null")).join("|||");
}

/**
 * Carry forward non-grouped fields and flatten joined data from the first row
 * into the result object. Consolidates duplicated logic from applyAggregations
 * and applyGroupBy.
 */
export function carryForwardFields(
  firstRow: Record<string, unknown>,
  result: Record<string, unknown>,
  groupedColumnNames: Set<string>,
  aggregatedColumnNames?: Set<string>
): void {
  for (const [field, value] of Object.entries(firstRow)) {
    // Skip internal fields, already-grouped columns, and aggregation targets
    if (field.startsWith("_") && !field.startsWith("_joined_")) continue;
    if (groupedColumnNames.has(field)) continue;
    if (aggregatedColumnNames?.has(field)) continue;
    result[field] = value;
  }

  // Flatten joined data from first row into top-level fields
  for (const [field, value] of Object.entries(firstRow)) {
    if (field.startsWith("_joined_") && Array.isArray(value) && (value as unknown[]).length > 0) {
      const joinedRow = (value as Record<string, unknown>[])[0];
      for (const [jf, jv] of Object.entries(joinedRow)) {
        if (!groupedColumnNames.has(jf) && !aggregatedColumnNames?.has(jf)) {
          result[jf] = jv;
        }
      }
    }
  }
}

/**
 * Compute a single aggregation function over numeric values.
 * Consolidates the COUNT/SUM/AVG/MIN/MAX switch used in both
 * applyAggregations (with and without groupBy) and applyGroupBy count.
 */
export function computeAggregation(
  aggFn: string,
  values: number[],
  rowCount: number
): number {
  switch (aggFn) {
    case "COUNT":
      return rowCount;
    case "SUM":
      return values.reduce((sum, v) => sum + v, 0);
    case "AVG":
      return values.length > 0
        ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100
        : 0;
    case "MIN":
      return values.length > 0 ? Math.min(...values) : 0;
    case "MAX":
      return values.length > 0 ? Math.max(...values) : 0;
    default:
      return 0;
  }
}

// ============================================
// Core Pure Functions
// ============================================

/**
 * Project aggregated/grouped rows to only the columns the user selected,
 * plus aggregation aliases and groupBy columns.
 *
 * Mapping priority for each user-selected column:
 *   1. col.alias — if it matches a key in the row
 *   2. col.column — if it matches a key directly (e.g. "name" from a joined table)
 *   3. col.table + "." + col.column — compound key (fallback)
 */
export function projectToColumns(
  rows: Record<string, unknown>[],
  columns: Array<{ table: string; column: string; alias?: string }>,
  aggregations?: Array<{ alias: string }>,
  groupBy?: Array<{ table: string; column: string }>
): Record<string, unknown>[] {
  if (rows.length === 0) return rows;

  // If we have no explicit columns, keep all non-internal keys
  if (columns.length === 0 && !aggregations?.length && !groupBy?.length) {
    const allKeys = Object.keys(rows[0]).filter((k) => !k.startsWith("_"));
    return rows.map((row) => {
      const projected: Record<string, unknown> = {};
      for (const k of allKeys) {
        projected[k] = row[k];
      }
      return projected;
    });
  }

  // Build output spec: for each column, try multiple sources in priority order.
  const outputSpec: Array<{
    label: string;
    sources: string[];
  }> = [];

  const usedKeys = new Set<string>();

  // 1. User-selected columns
  for (const col of columns) {
    const label = col.alias || col.column;
    const sources = [col.alias, col.column].filter((s): s is string => !!s) as string[];
    outputSpec.push({ label, sources });
    if (col.alias) usedKeys.add(col.alias);
    usedKeys.add(col.column);
  }

  // 2. Aggregation aliases (if not already included by a user column)
  if (aggregations) {
    for (const agg of aggregations) {
      if (!usedKeys.has(agg.alias)) {
        outputSpec.push({ label: agg.alias, sources: [agg.alias] });
        usedKeys.add(agg.alias);
      }
    }
  }

  // 3. GroupBy columns (if not already included)
  if (groupBy) {
    for (const g of groupBy) {
      if (!usedKeys.has(g.column)) {
        outputSpec.push({ label: g.column, sources: [g.column] });
        usedKeys.add(g.column);
      }
    }
  }

  // Collect all actual row keys from the first row (for fallback matching)
  const sampleKeys = new Set(Object.keys(rows[0]).filter((k) => !k.startsWith("_")));

  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const { label, sources } of outputSpec) {
      let found = false;
      for (const source of sources) {
        if (source in row && row[source] !== undefined) {
          projected[label] = row[source];
          found = true;
          break;
        }
      }

      // Fallback: scan all row keys for a partial match
      if (!found) {
        for (const sampleKey of sampleKeys) {
          for (const source of sources) {
            const sLow = source.toLowerCase();
            const kLow = sampleKey.toLowerCase();
            if (kLow === sLow || kLow.endsWith(sLow) || sLow.endsWith(kLow)) {
              projected[label] = row[sampleKey];
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      if (!found) {
        projected[label] = null;
      }
    }
    return projected;
  });
}

/**
 * Apply filters to rows based on operator logic.
 * Supports AND/OR filter logic.
 */
export function applyFilters(
  rows: Record<string, unknown>[],
  filters: Array<{
    table: string;
    column: string;
    operator: string;
    value?: unknown;
    valueTo?: unknown;
    values?: unknown[];
  }>,
  filterLogic: "and" | "or" = "and"
): Record<string, unknown>[] {
  const matchesFilter = (row: Record<string, unknown>, filter: typeof filters[number]): boolean => {
    const fieldValue = row[filter.column];
    const value = filter.value;

    switch (filter.operator) {
      case "equals":
        return fieldValue === value;
      case "not_equals":
        return fieldValue !== value;
      case "contains":
        if (typeof fieldValue !== "string" || typeof value !== "string") return false;
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      case "not_contains":
        if (typeof fieldValue !== "string" || typeof value !== "string") return false;
        return !fieldValue.toLowerCase().includes(value.toLowerCase());
      case "gt":
        if (typeof fieldValue !== "number" || typeof value !== "number") return false;
        return fieldValue > value;
      case "gte":
        if (typeof fieldValue !== "number" || typeof value !== "number") return false;
        return fieldValue >= value;
      case "lt":
        if (typeof fieldValue !== "number" || typeof value !== "number") return false;
        return fieldValue < value;
      case "lte":
        if (typeof fieldValue !== "number" || typeof value !== "number") return false;
        return fieldValue <= value;
      case "between":
        if (typeof fieldValue !== "number") return false;
        if (typeof value !== "number" || typeof filter.valueTo !== "number") return false;
        return fieldValue >= value && fieldValue <= filter.valueTo;
      case "in_list":
        if (filter.values) return filter.values.includes(fieldValue);
        return false;
      case "is_null":
        return fieldValue === null || fieldValue === undefined;
      case "is_not_null":
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return true;
    }
  };

  if (filterLogic === "or") {
    return rows.filter((row) => filters.some((filter) => matchesFilter(row, filter)));
  }

  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

/**
 * Apply aggregations (COUNT/SUM/AVG/MIN/MAX) to rows.
 * Supports optional GROUP BY via buildGroupKey + carryForwardFields.
 */
export function applyAggregations(
  rows: Record<string, unknown>[],
  aggregations: Array<{
    table: string;
    column: string;
    function: string;
    alias: string;
  }>,
  groupBy?: Array<{ table: string; column: string }>
): Record<string, unknown>[] {
  if (!groupBy || groupBy.length === 0) {
    // No GROUP BY — return single row with totals
    const result: Record<string, unknown> = {};
    for (const agg of aggregations) {
      const values = rows.map((r) => r[agg.column]).filter((v) => typeof v === "number") as number[];
      result[agg.alias] = computeAggregation(agg.function, values, rows.length);
    }
    return [result];
  }

  // GROUP BY — group rows and aggregate per group
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const key = buildGroupKey(row, groupBy);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  const groupedColumnNames = new Set(groupBy.map((g) => g.column));
  const aggregatedColumnNames = new Set(aggregations.map((a) => a.alias));

  const results: Record<string, unknown>[] = [];
  for (const [key, groupRows] of groups) {
    const result: Record<string, unknown> = {};
    const keyParts = key.split("|||");

    // Add groupBy columns
    groupBy.forEach((g, i) => {
      result[g.column] = keyParts[i] === "null" ? null : keyParts[i];
    });

    // Carry forward non-grouped, non-aggregated fields from first row
    carryForwardFields(groupRows[0], result, groupedColumnNames, aggregatedColumnNames);

    // Add aggregations
    for (const agg of aggregations) {
      const values = groupRows.map((r) => r[agg.column]).filter((v) => typeof v === "number") as number[];
      result[agg.alias] = computeAggregation(agg.function, values, groupRows.length);
    }

    results.push(result);
  }

  return results;
}

/**
 * Apply GROUP BY without explicit aggregations (adds _count per group).
 */
export function applyGroupBy(
  rows: Record<string, unknown>[],
  groupBy: Array<{ table: string; column: string }>
): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const key = buildGroupKey(row, groupBy);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  const groupedColumnNames = new Set(groupBy.map((g) => g.column));

  const results: Record<string, unknown>[] = [];
  for (const [key, groupRows] of groups) {
    const result: Record<string, unknown> = { _count: groupRows.length };
    const keyParts = key.split("|||");
    groupBy.forEach((g, i) => {
      result[g.column] = keyParts[i] === "null" ? null : keyParts[i];
    });

    // Carry forward non-grouped fields and flatten joined data from first row
    carryForwardFields(groupRows[0], result, groupedColumnNames);

    results.push(result);
  }

  return results;
}

/**
 * Simple array-offset pagination for in-memory result sets.
 */
export function paginateRows(
  rows: Record<string, unknown>[],
  paginationOpts?: { numItems?: number; cursor?: string | null }
): { page: Record<string, unknown>[]; isDone: boolean; continueCursor: string | null } {
  if (!paginationOpts) {
    return {
      page: rows.slice(0, 100),
      isDone: rows.length <= 100,
      continueCursor: rows.length > 100 ? String(rows.length) : null,
    };
  }

  const numItems = paginationOpts.numItems ?? 100;
  let startIdx = 0;

  if (paginationOpts.cursor) {
    startIdx = parseInt(paginationOpts.cursor, 10) || 0;
  }

  const page = rows.slice(startIdx, startIdx + numItems);
  const isDone = startIdx + numItems >= rows.length;

  return {
    page,
    isDone,
    continueCursor: isDone ? null : String(startIdx + numItems),
  };
}
