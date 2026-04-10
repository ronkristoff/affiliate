import { query, mutation, internalQuery, internalMutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";

// Shared pure-function utilities, types, validators, constants
// Re-exported for consumers that import from this file (backward compat)
export {
  type ColumnType,
  type ColumnDef,
  type TableDef,
  OPERATORS_BY_TYPE,
  filterOperatorValidator,
  filterValidator,
  joinValidator,
  aggregationValidator,
  projectToColumns,
  applyFilters,
  applyAggregations,
  applyGroupBy,
  paginateRows,
  buildGroupKey,
  carryForwardFields,
  computeAggregation,
} from "./queryBuilder/_utils";
export { VALID_OPERATORS, VALID_AGGREGATIONS } from "./queryBuilder/_utils";

import {
  OPERATORS_BY_TYPE,
  VALID_OPERATORS,
  VALID_AGGREGATIONS,
  filterOperatorValidator,
  filterValidator,
  joinValidator,
  aggregationValidator,
  projectToColumns,
  applyFilters,
  applyAggregations,
  applyGroupBy,
  paginateRows,
} from "./queryBuilder/_utils";

import type { ColumnType, ColumnDef, TableDef } from "./queryBuilder/_utils";

export const QUERY_TABLES: Record<string, TableDef> = {
  affiliates: {
    name: "affiliates",
    label: "Affiliates",
    description: "Affiliate partners and their status",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "name", type: "string", label: "Name", filterable: true, aggregatable: false, groupable: true },
      { name: "email", type: "string", label: "Email", filterable: true, aggregatable: false, groupable: true },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "uniqueCode", type: "string", label: "Referral Code", filterable: true, aggregatable: false, groupable: false },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  campaigns: {
    name: "campaigns",
    label: "Campaigns",
    description: "Affiliate campaigns and commission settings",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "name", type: "string", label: "Name", filterable: true, aggregatable: false, groupable: true },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "description", type: "string", label: "Description", filterable: true, aggregatable: false, groupable: false },
      { name: "commissionType", type: "string", label: "Commission Type", filterable: true, aggregatable: false, groupable: true },
      { name: "commissionValue", type: "number", label: "Commission Value", filterable: true, aggregatable: true, groupable: false },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  clicks: {
    name: "clicks",
    label: "Clicks",
    description: "Referral link click tracking data",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "campaignId", type: "id", label: "Campaign ID", filterable: false, aggregatable: false, groupable: true },
      { name: "ipAddress", type: "string", label: "IP Address", filterable: true, aggregatable: false, groupable: false },
      { name: "createdAt", type: "date", label: "Clicked At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  conversions: {
    name: "conversions",
    label: "Conversions",
    description: "Successful conversions attributed to affiliates",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "campaignId", type: "id", label: "Campaign ID", filterable: false, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Converted At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  commissions: {
    name: "commissions",
    label: "Commissions",
    description: "Commission earnings and status",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "campaignId", type: "id", label: "Campaign ID", filterable: false, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "isSelfReferral", type: "boolean", label: "Self Referral", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  payouts: {
    name: "payouts",
    label: "Payouts",
    description: "Payout transactions to affiliates",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "paymentSource", type: "string", label: "Payment Source", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
      { name: "paidAt", type: "date", label: "Paid At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  payoutBatches: {
    name: "payoutBatches",
    label: "Payout Batches",
    description: "Batch payout processing records",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "totalAmount", type: "number", label: "Total Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "affiliateCount", type: "number", label: "Affiliate Count", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  auditLogs: {
    name: "auditLogs",
    label: "Audit Logs",
    description: "System audit trail of actions",
    columns: [
      { name: "_id", type: "id", label: "ID (for joins)", filterable: false, aggregatable: false, groupable: false },
      { name: "action", type: "string", label: "Action", filterable: true, aggregatable: false, groupable: true },
      { name: "entityType", type: "string", label: "Entity Type", filterable: true, aggregatable: false, groupable: true },
      { name: "actorType", type: "string", label: "Actor Type", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
};

// Pre-defined common join relationships based on schema foreign keys.
// The JoinBuilder UI uses these to auto-suggest correct joins.
export const SUGGESTED_JOINS = [
  { leftTable: "commissions", leftField: "affiliateId", rightTable: "affiliates", rightField: "_id", label: "Commissions → Affiliate (by ID)" },
  { leftTable: "commissions", leftField: "campaignId", rightTable: "campaigns", rightField: "_id", label: "Commissions → Campaign (by ID)" },
  { leftTable: "clicks", leftField: "affiliateId", rightTable: "affiliates", rightField: "_id", label: "Clicks → Affiliate (by ID)" },
  { leftTable: "clicks", leftField: "campaignId", rightTable: "campaigns", rightField: "_id", label: "Clicks → Campaign (by ID)" },
  { leftTable: "conversions", leftField: "affiliateId", rightTable: "affiliates", rightField: "_id", label: "Conversions → Affiliate (by ID)" },
  { leftTable: "conversions", leftField: "campaignId", rightTable: "campaigns", rightField: "_id", label: "Conversions → Campaign (by ID)" },
  { leftTable: "payouts", leftField: "affiliateId", rightTable: "affiliates", rightField: "_id", label: "Payouts → Affiliate (by ID)" },
  { leftTable: "payoutBatches", leftField: "_id", rightTable: "payouts", rightField: "batchId", label: "Payout Batches → Payouts (by batch)" },
];

// ============================================
// Public Queries
// ============================================

/**
 * Get metadata for all whitelisted tables and their columns.
 */
export const getTableMetadata = query({
  args: {},
  returns: v.object({
    tables: v.array(v.object({
      name: v.string(),
      label: v.string(),
      description: v.string(),
      columns: v.array(v.object({
        name: v.string(),
        type: v.union(v.literal("string"), v.literal("number"), v.literal("boolean"), v.literal("date"), v.literal("id")),
        label: v.string(),
        filterable: v.boolean(),
        aggregatable: v.boolean(),
        groupable: v.boolean(),
      })),
    })),
    suggestedJoins: v.array(v.object({
      leftTable: v.string(),
      leftField: v.string(),
      rightTable: v.string(),
      rightField: v.string(),
      label: v.string(),
    })),
  }),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    return {
      tables: Object.values(QUERY_TABLES).map((table) => ({
        name: table.name,
        label: table.label,
        description: table.description,
        columns: table.columns,
      })),
      suggestedJoins: SUGGESTED_JOINS,
    };
  },
});

/**
 * Execute a dynamic query from a query configuration.
 * Validates all inputs server-side against whitelisted tables/columns.
 */
export const executeQuery = query({
  args: {
    tables: v.array(v.string()),
    columns: v.array(v.object({
      table: v.string(),
      column: v.string(),
      alias: v.optional(v.string()),
    })),
    filters: v.optional(v.array(filterValidator)),
    filterLogic: v.optional(v.union(v.literal("and"), v.literal("or"))),
    joins: v.optional(v.array(joinValidator)),
    aggregations: v.optional(v.array(aggregationValidator)),
    groupBy: v.optional(v.array(v.object({
      table: v.string(),
      column: v.string(),
    }))),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    rowLimit: v.optional(v.number()),
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  returns: v.object({
    rows: v.array(v.record(v.string(), v.any())),
    totalRows: v.number(),
    page: v.array(v.record(v.string(), v.any())),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    columns: v.array(v.object({
      table: v.string(),
      column: v.string(),
      alias: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // 1. Validate all tables are whitelisted
    for (const tableName of args.tables) {
      if (!(tableName in QUERY_TABLES)) {
        throw new Error(`Table "${tableName}" is not available for querying`);
      }
    }

    // 2. Validate all columns exist in their tables
    for (const col of args.columns) {
      const tableDef = QUERY_TABLES[col.table];
      if (!tableDef) {
        throw new Error(`Table "${col.table}" is not available`);
      }
      const columnDef = tableDef.columns.find((c) => c.name === col.column);
      if (!columnDef) {
        throw new Error(`Column "${col.column}" does not exist in table "${col.table}"`);
      }
    }

    // 3. Validate filters
    if (args.filters) {
      for (const filter of args.filters) {
        const tableDef = QUERY_TABLES[filter.table];
        if (!tableDef) {
          throw new Error(`Filter table "${filter.table}" is not available`);
        }
        const columnDef = tableDef.columns.find((c) => c.name === filter.column);
        if (!columnDef) {
          throw new Error(`Filter column "${filter.column}" does not exist in table "${filter.table}"`);
        }
        // Check operator is valid for column type
        const validOps = OPERATORS_BY_TYPE[columnDef.type];
        if (validOps && !validOps.includes(filter.operator) && !["is_null", "is_not_null"].includes(filter.operator)) {
          throw new Error(`Operator "${filter.operator}" is not valid for column "${filter.column}" of type "${columnDef.type}"`);
        }
      }
    }

    // 4. Validate joins
    if (args.joins && args.joins.length > 3) {
      throw new Error("Maximum 3 joins allowed per query");
    }
    if (args.joins) {
      for (const join of args.joins) {
        if (!QUERY_TABLES[join.leftTable] || !QUERY_TABLES[join.rightTable]) {
          throw new Error(`Join references unavailable table`);
        }
      }
    }

    // 5. Validate aggregations
    if (args.aggregations) {
      for (const agg of args.aggregations) {
        const tableDef = QUERY_TABLES[agg.table];
        if (!tableDef) {
          throw new Error(`Aggregation table "${agg.table}" is not available`);
        }
        const columnDef = tableDef.columns.find((c) => c.name === agg.column);
        if (!columnDef) {
          throw new Error(`Aggregation column "${agg.column}" does not exist in table "${agg.table}"`);
        }
        if (agg.function !== "COUNT" && !columnDef.aggregatable) {
          throw new Error(`Column "${agg.column}" cannot be aggregated with ${agg.function}`);
        }
      }
    }

    // 6. Execute query on primary table
    const primaryTable = args.tables[0];
    const effectiveRowLimit = args.rowLimit ?? 5000;
    const MAX_ROWS = Math.min(effectiveRowLimit, 5000); // Hard cap at 5000

    // Fetch data from primary table
    const allRows = await fetchTableRows(ctx, primaryTable, tenantId, MAX_ROWS);

    // Apply date range filter
    const startDate = args.dateRange?.start;
    const endDate = args.dateRange?.end;

    let filteredRows: Record<string, unknown>[] = allRows;
    if (startDate || endDate) {
      filteredRows = allRows.filter((row: Record<string, unknown>) => {
        const created = row._creationTime as number;
        if (startDate && created < startDate) return false;
        if (endDate && created > endDate) return false;
        return true;
      });
    }

    // Apply custom filters
    if (args.filters && args.filters.length > 0) {
      filteredRows = applyFilters(filteredRows, args.filters, args.filterLogic ?? "and");
    }

    // Handle joins (in-memory join for secondary tables)
    if (args.joins && args.joins.length > 0) {
      filteredRows = await applyJoins(ctx, filteredRows, args.joins, tenantId);
    }

    // Apply aggregations and groupBy
    if (args.aggregations && args.aggregations.length > 0) {
      const aggregated = applyAggregations(filteredRows, args.aggregations, args.groupBy);
      const projected = projectToColumns(aggregated, args.columns, args.aggregations, args.groupBy);
      const paginated = paginateRows(projected, args.paginationOpts);
      return {
        rows: projected,
        totalRows: projected.length,
        ...paginated,
        columns: args.columns,
      };
    }

    // Apply groupBy without aggregations
    if (args.groupBy && args.groupBy.length > 0) {
      const grouped = applyGroupBy(filteredRows, args.groupBy);
      const projected = projectToColumns(grouped, args.columns, undefined, args.groupBy);
      const paginated = paginateRows(projected, args.paginationOpts);
      return {
        rows: projected,
        totalRows: projected.length,
        ...paginated,
        columns: args.columns,
      };
    }

    // Select requested columns
    const selectedRows = filteredRows.map((row) => {
      const result: Record<string, unknown> = {};
      for (const col of args.columns) {
        const alias = col.alias || `${col.table}.${col.column}`;
        if (col.table === primaryTable) {
          result[alias] = (row as Record<string, unknown>)[col.column] ?? null;
        } else {
          // Joined data is nested
          const joinedData = (row as Record<string, unknown>)[`_joined_${col.table}`];
          if (joinedData && Array.isArray(joinedData) && joinedData.length > 0) {
            result[alias] = (joinedData[0] as Record<string, unknown>)[col.column] ?? null;
          } else {
            result[alias] = null;
          }
        }
      }
      return result;
    });

    const paginated = paginateRows(selectedRows, args.paginationOpts);
    return {
      rows: selectedRows,
      totalRows: selectedRows.length,
      ...paginated,
      columns: args.columns,
    };
  },
});

/**
 * Get distinct values for a specific column (for filter value suggestions).
 * Returns up to 50 unique values, sorted by frequency.
 * Only works on columns marked as `filterable: true` in the metadata.
 */
export const getDistinctColumnValues = query({
  args: {
    tableName: v.string(),
    columnName: v.string(),
  },
  returns: v.array(v.object({
    value: v.union(v.string(), v.number(), v.boolean()),
    count: v.number(),
  })),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tableDef = QUERY_TABLES[args.tableName];
    if (!tableDef) {
      throw new Error(`Table "${args.tableName}" is not available`);
    }

    const columnDef = tableDef.columns.find((c) => c.name === args.columnName);
    if (!columnDef || !columnDef.filterable) {
      return [];
    }

    const rows = await fetchTableRows(ctx, args.tableName, authUser.tenantId, 5000);

    // Count distinct values
    const freqMap = new Map<string, { value: string | number | boolean; count: number }>();
    for (const row of rows) {
      const val = row[args.columnName];
      if (val === null || val === undefined) continue;
      const key = String(val);
      const existing = freqMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        freqMap.set(key, { value: val as string | number | boolean, count: 1 });
      }
    }

    // Sort by frequency descending, take top 50
    return [...freqMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  },
});

/**
 * Get basic statistics for a column (for hover tooltips).
 */
export const getColumnStats = query({
  args: {
    tableName: v.string(),
    columnName: v.string(),
  },
  returns: v.object({
    totalRows: v.number(),
    distinctValues: v.number(),
    nullCount: v.number(),
    sampleValues: v.array(v.union(v.string(), v.number(), v.boolean())),
    numericStats: v.optional(v.object({
      min: v.number(),
      max: v.number(),
      avg: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tableDef = QUERY_TABLES[args.tableName];
    if (!tableDef) {
      throw new Error(`Table "${args.tableName}" is not available`);
    }

    const columnDef = tableDef.columns.find((c) => c.name === args.columnName);
    if (!columnDef) {
      throw new Error(`Column "${args.columnName}" does not exist in table "${args.tableName}"`);
    }

    const rows = await fetchTableRows(ctx, args.tableName, authUser.tenantId, 5000);
    const values = rows.map((r) => r[args.columnName]);

    const distinctValues = new Set(values.filter((v) => v !== null && v !== undefined));
    const nullCount = values.filter((v) => v === null || v === undefined).length;
    const sampleValues = [...distinctValues].slice(0, 5).map((v) => v as string | number | boolean);

    let numericStats: { min: number; max: number; avg: number } | undefined;
    if (columnDef.type === "number") {
      const nums = values.filter((v) => typeof v === "number") as number[];
      if (nums.length > 0) {
        numericStats = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100,
        };
      }
    }

    return {
      totalRows: values.length,
      distinctValues: distinctValues.size,
      nullCount,
      sampleValues,
      numericStats,
    };
  },
});

/**
 * List saved queries for the current tenant.
 */
export const listSavedQueries = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("savedQueries"),
    name: v.string(),
    description: v.optional(v.string()),
    queryConfig: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    isShared: v.boolean(),
    sharedWithRoles: v.array(v.string()),
    canEdit: v.boolean(),
  })),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const queries = await ctx.db
      .query("savedQueries")
      .withIndex("by_tenant", (q) => q.eq("tenantId", authUser.tenantId))
      .collect();

    return queries.map((q) => ({
      _id: q._id,
      name: q.name,
      description: q.description,
      queryConfig: q.queryConfig,
      createdBy: q.createdBy,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      isShared: q.isShared,
      sharedWithRoles: q.sharedWithRoles,
      canEdit: q.createdBy === authUser.userId || authUser.role === "owner",
    }));
  },
});

/**
 * Save a new query configuration.
 */
export const saveQuery = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    queryConfig: v.string(), // JSON string
    isShared: v.optional(v.boolean()),
    sharedWithRoles: v.optional(v.array(v.string())),
  },
  returns: v.id("savedQueries"),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Validate query config JSON
    try {
      JSON.parse(args.queryConfig);
    } catch {
      throw new Error("Invalid query configuration JSON");
    }

    const now = Date.now();
    return await ctx.db.insert("savedQueries", {
      tenantId: authUser.tenantId,
      name: args.name,
      description: args.description,
      queryConfig: args.queryConfig,
      createdBy: authUser.userId,
      createdAt: now,
      updatedAt: now,
      isShared: args.isShared ?? false,
      sharedWithRoles: args.sharedWithRoles ?? [],
    });
  },
});

/**
 * Update an existing saved query.
 */
export const updateSavedQuery = mutation({
  args: {
    queryId: v.id("savedQueries"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    queryConfig: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
    sharedWithRoles: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const query = await ctx.db.get(args.queryId);
    if (!query || query.tenantId !== authUser.tenantId) {
      throw new Error("Query not found");
    }

    // Only creator or owner can edit
    if (query.createdBy !== authUser.userId && authUser.role !== "owner") {
      throw new Error("You do not have permission to edit this query");
    }

    // Validate new config JSON if provided
    if (args.queryConfig) {
      try {
        JSON.parse(args.queryConfig);
      } catch {
        throw new Error("Invalid query configuration JSON");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.queryConfig !== undefined) updates.queryConfig = args.queryConfig;
    if (args.isShared !== undefined) updates.isShared = args.isShared;
    if (args.sharedWithRoles !== undefined) updates.sharedWithRoles = args.sharedWithRoles;

    await ctx.db.patch(args.queryId, updates);
    return null;
  },
});

/**
 * Delete a saved query.
 */
export const deleteSavedQuery = mutation({
  args: {
    queryId: v.id("savedQueries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const query = await ctx.db.get(args.queryId);
    if (!query || query.tenantId !== authUser.tenantId) {
      throw new Error("Query not found");
    }

    // Only creator or owner can delete
    if (query.createdBy !== authUser.userId && authUser.role !== "owner") {
      throw new Error("You do not have permission to delete this query");
    }

    await ctx.db.delete(args.queryId);
    return null;
  },
});

/**
 * Share/unshare a saved query with team members.
 */
export const shareSavedQuery = mutation({
  args: {
    queryId: v.id("savedQueries"),
    isShared: v.boolean(),
    sharedWithRoles: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const query = await ctx.db.get(args.queryId);
    if (!query || query.tenantId !== authUser.tenantId) {
      throw new Error("Query not found");
    }

    // Only creator or owner can share
    if (query.createdBy !== authUser.userId && authUser.role !== "owner") {
      throw new Error("You do not have permission to share this query");
    }

    // Validate roles
    const validRoles = ["owner", "manager", "viewer"];
    for (const role of args.sharedWithRoles) {
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role "${role}". Valid roles: ${validRoles.join(", ")}`);
      }
    }

    await ctx.db.patch(args.queryId, {
      isShared: args.isShared,
      sharedWithRoles: args.sharedWithRoles,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Get a single saved query by ID.
 */
export const getSavedQuery = query({
  args: {
    queryId: v.id("savedQueries"),
  },
  returns: v.union(
    v.object({
      _id: v.id("savedQueries"),
      name: v.string(),
      description: v.optional(v.string()),
      queryConfig: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      isShared: v.boolean(),
      sharedWithRoles: v.array(v.string()),
      canEdit: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const query = await ctx.db.get(args.queryId);
    if (!query || query.tenantId !== authUser.tenantId) {
      throw new Error("Query not found");
    }

    // Check access: creator, owner, or shared role
    if (
      query.createdBy !== authUser.userId &&
      authUser.role !== "owner" &&
      !(query.isShared && query.sharedWithRoles.includes(authUser.role))
    ) {
      throw new Error("You do not have permission to view this query");
    }

    return {
      _id: query._id,
      name: query.name,
      description: query.description,
      queryConfig: query.queryConfig,
      createdBy: query.createdBy,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
      isShared: query.isShared,
      sharedWithRoles: query.sharedWithRoles,
      canEdit: query.createdBy === authUser.userId || authUser.role === "owner",
    };
  },
});

// ============================================
// Query Complexity Estimator (Internal)
// ============================================

interface ComplexityScore {
  score: number;
  warnings: string[];
  maxScore: number;
}

/**
 * Estimate query complexity and return warnings if threshold exceeded.
 * Called client-side before executing a query.
 */
export const estimateQueryComplexity = query({
  args: {
    tables: v.array(v.string()),
    filters: v.optional(v.array(filterValidator)),
    joins: v.optional(v.array(joinValidator)),
    aggregations: v.optional(v.array(aggregationValidator)),
    groupBy: v.optional(v.array(v.object({
      table: v.string(),
      column: v.string(),
    }))),
  },
  returns: v.object({
    score: v.number(),
    warnings: v.array(v.string()),
    maxScore: v.number(),
  }),
  handler: async (ctx, args) => {
    let score = 0;
    const warnings: string[] = [];
    const MAX_SCORE = 100;

    // Table count (base cost)
    score += args.tables.length * 10;

    // Filters reduce cost
    if (args.filters && args.filters.length > 0) {
      score -= args.filters.length * 3;
    }

    // Joins increase cost significantly
    if (args.joins) {
      score += args.joins.length * 20;
      if (args.joins.length >= 3) {
        warnings.push("3 or more joins may impact query performance");
      }
    }

    // Aggregations add moderate cost
    if (args.aggregations) {
      score += args.aggregations.length * 5;
    }

    // GroupBy adds cost
    if (args.groupBy) {
      score += args.groupBy.length * 5;
    }

    // Warn if high complexity
    if (score > 70) {
      warnings.push("Query complexity is high. Consider adding more filters to reduce result set.");
    }
    if (score > 90) {
      warnings.push("Query may timeout. Simplify the query or reduce the number of joins.");
    }

    return {
      score: Math.min(score, MAX_SCORE),
      warnings,
      maxScore: MAX_SCORE,
    };
  },
});

// ============================================
// Helper Functions (ctx-dependent — stays here)
// ============================================

/**
 * Fetch rows from a whitelisted table for a given tenant.
 * Uses type-safe table name dispatch.
 */
async function fetchTableRows(
  ctx: QueryCtx,
  tableName: string,
  tenantId: Id<"tenants">,
  maxRows: number
): Promise<Record<string, unknown>[]> {
  switch (tableName) {
    case "affiliates":
      return await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "campaigns":
      return await ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "clicks":
      return await ctx.db
        .query("clicks")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "conversions":
      return await ctx.db
        .query("conversions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "commissions":
      return await ctx.db
        .query("commissions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "payouts":
      return await ctx.db
        .query("payouts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "payoutBatches":
      return await ctx.db
        .query("payoutBatches")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    case "auditLogs":
      return await ctx.db
        .query("auditLogs")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(maxRows);
    default:
      throw new Error(`Table "${tableName}" is not available for querying`);
  }
}

async function applyJoins(
  ctx: QueryCtx,
  rows: Record<string, unknown>[],
  joins: Array<{
    leftTable: string;
    rightTable: string;
    leftField: string;
    rightField: string;
  }>,
  tenantId: Id<"tenants">
): Promise<Record<string, unknown>[]> {
  let result = rows;

  for (const join of joins) {
    // Fetch all rows from the right table for this tenant
    const rightRows = await fetchTableRows(ctx, join.rightTable, tenantId, 5000);

    // Detect if leftField is a foreign-key reference (ends with "Id")
    // If so, the leftValue is a document ID and should match _id on the right table,
    // regardless of what rightField the user specified.
    const isForeignKeyRef = /Id$/.test(join.leftField) && join.leftField !== "_id";

    result = result.map((row) => {
      const leftValue = row[join.leftField];

      let matchingRightRows: Record<string, unknown>[];
      if (isForeignKeyRef) {
        // Foreign key → always match against _id of the right table
        matchingRightRows = rightRows.filter(
          (r: Record<string, unknown>) => r._id === leftValue
        );
      } else {
        // Regular field → match against the specified rightField
        matchingRightRows = rightRows.filter(
          (r: Record<string, unknown>) => r[join.rightField] === leftValue
        );
      }

      return {
        ...row,
        [`_joined_${join.rightTable}`]: matchingRightRows,
      };
    });
  }

  return result;
}

// ============================================
// Internal: Export Cleanup (Cron Job)
// ============================================

/**
 * Clean up expired query export files older than 7 days.
 * Called by cron job daily.
 */
export const cleanupExpiredExports = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Find expired exports
    const expiredExports = await ctx.db
      .query("queryExports")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", sevenDaysAgo))
      .take(100);

    // Delete files and records
    for (const exp of expiredExports) {
      try {
        await ctx.storage.delete(exp.storageFileId);
      } catch {
        // File may already be deleted
      }
      await ctx.db.delete(exp._id);
    }

    return null;
  },
});
