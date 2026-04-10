import { query, mutation, internalMutation, internalAction, type QueryCtx, type ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { requireAdmin } from "./_helpers";
import { internal } from "../_generated/api";
import {
  type TableDef,
  OPERATORS_BY_TYPE,
  filterValidator,
  joinValidator,
  aggregationValidator,
  projectToColumns,
  applyFilters,
  applyAggregations,
  applyGroupBy,
  paginateRows,
} from "../queryBuilder/_utils";

// =============================================================================
// Admin Table Whitelist (16 tables)
// =============================================================================

export const ADMIN_QUERY_TABLES: Record<string, TableDef> = {
  // Admin-only tables (7)
  tenants: {
    name: "tenants",
    label: "Tenants",
    description: "Platform tenant accounts",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "name", type: "string", label: "Name", filterable: true, aggregatable: false, groupable: true },
      { name: "slug", type: "string", label: "Slug", filterable: true, aggregatable: false, groupable: true },
      { name: "domain", type: "string", label: "Domain", filterable: true, aggregatable: false, groupable: false },
      { name: "plan", type: "string", label: "Plan", filterable: true, aggregatable: false, groupable: true },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  tenantStats: {
    name: "tenantStats",
    label: "Tenant Stats",
    description: "Denormalized tenant statistics",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "affiliatesActive", type: "number", label: "Active Affiliates", filterable: true, aggregatable: true, groupable: false },
      { name: "commissionsPendingCount", type: "number", label: "Pending Commissions", filterable: true, aggregatable: true, groupable: false },
      { name: "commissionsConfirmedThisMonth", type: "number", label: "Confirmed This Month", filterable: true, aggregatable: true, groupable: false },
      { name: "commissionsFlagged", type: "number", label: "Flagged", filterable: true, aggregatable: true, groupable: false },
      { name: "totalPaidOut", type: "number", label: "Total Paid Out", filterable: true, aggregatable: true, groupable: false },
      { name: "totalClicksThisMonth", type: "number", label: "Clicks This Month", filterable: true, aggregatable: true, groupable: false },
      { name: "totalConversionsThisMonth", type: "number", label: "Conversions This Month", filterable: true, aggregatable: true, groupable: false },
    ],
  },
  billingHistory: {
    name: "billingHistory",
    label: "Billing History",
    description: "Subscription billing events",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "event", type: "string", label: "Event", filterable: true, aggregatable: false, groupable: true },
      { name: "plan", type: "string", label: "Plan", filterable: true, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "timestamp", type: "date", label: "Timestamp", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  tierConfigs: {
    name: "tierConfigs",
    label: "Tier Configs",
    description: "Platform tier configuration",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tier", type: "string", label: "Tier", filterable: true, aggregatable: false, groupable: true },
      { name: "price", type: "number", label: "Price", filterable: true, aggregatable: true, groupable: false },
      { name: "maxAffiliates", type: "number", label: "Max Affiliates", filterable: true, aggregatable: false, groupable: false },
      { name: "maxCampaigns", type: "number", label: "Max Campaigns", filterable: true, aggregatable: false, groupable: false },
    ],
  },
  tierOverrides: {
    name: "tierOverrides",
    label: "Tier Overrides",
    description: "Enterprise tier overrides",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "reason", type: "string", label: "Reason", filterable: true, aggregatable: false, groupable: false },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  adminNotes: {
    name: "adminNotes",
    label: "Admin Notes",
    description: "Internal admin notes on tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "authorId", type: "id", label: "Author ID", filterable: true, aggregatable: false, groupable: true },
      { name: "content", type: "string", label: "Content", filterable: true, aggregatable: false, groupable: false },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },

  // Shared with tenant QB but expanded (1) — auditLogs with extra admin columns
  auditLogs: {
    name: "auditLogs",
    label: "Audit Logs",
    description: "Full platform audit trail (admin view includes tenantId, actorId, metadata)",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "action", type: "string", label: "Action", filterable: true, aggregatable: false, groupable: true },
      { name: "entityType", type: "string", label: "Entity Type", filterable: true, aggregatable: false, groupable: true },
      { name: "entityId", type: "string", label: "Entity ID", filterable: true, aggregatable: false, groupable: false },
      { name: "actorId", type: "string", label: "Actor ID", filterable: true, aggregatable: false, groupable: true },
      { name: "actorType", type: "string", label: "Actor Type", filterable: true, aggregatable: false, groupable: true },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },

  // Tenant-scoped tables (8) — admin can query across ALL tenants
  affiliates: {
    name: "affiliates",
    label: "Affiliates",
    description: "All affiliates across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
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
    description: "All campaigns across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "name", type: "string", label: "Name", filterable: true, aggregatable: false, groupable: true },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "commissionType", type: "string", label: "Commission Type", filterable: true, aggregatable: false, groupable: true },
      { name: "commissionValue", type: "number", label: "Commission Value", filterable: true, aggregatable: true, groupable: false },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  clicks: {
    name: "clicks",
    label: "Clicks",
    description: "All clicks across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "campaignId", type: "id", label: "Campaign ID", filterable: false, aggregatable: false, groupable: true },
      { name: "ipAddress", type: "string", label: "IP Address", filterable: true, aggregatable: false, groupable: false },
      { name: "createdAt", type: "date", label: "Clicked At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  conversions: {
    name: "conversions",
    label: "Conversions",
    description: "All conversions across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Converted At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  commissions: {
    name: "commissions",
    label: "Commissions",
    description: "All commissions across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "isSelfReferral", type: "boolean", label: "Self Referral", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  payouts: {
    name: "payouts",
    label: "Payouts",
    description: "All payouts across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "affiliateId", type: "id", label: "Affiliate ID", filterable: false, aggregatable: false, groupable: true },
      { name: "amount", type: "number", label: "Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
  payoutBatches: {
    name: "payoutBatches",
    label: "Payout Batches",
    description: "All payout batches across tenants",
    columns: [
      { name: "_id", type: "id", label: "ID", filterable: false, aggregatable: false, groupable: false },
      { name: "tenantId", type: "id", label: "Tenant ID", filterable: true, aggregatable: false, groupable: true },
      { name: "totalAmount", type: "number", label: "Total Amount", filterable: true, aggregatable: true, groupable: false },
      { name: "affiliateCount", type: "number", label: "Affiliate Count", filterable: true, aggregatable: true, groupable: false },
      { name: "status", type: "string", label: "Status", filterable: true, aggregatable: false, groupable: true },
      { name: "createdAt", type: "date", label: "Created At", filterable: true, aggregatable: false, groupable: true },
    ],
  },
};

// Admin-specific suggested joins
const ADMIN_SUGGESTED_JOINS = [
  { leftTable: "tenantStats", leftField: "tenantId", rightTable: "tenants", rightField: "_id", label: "Tenant Stats → Tenant (by ID)" },
  { leftTable: "billingHistory", leftField: "tenantId", rightTable: "tenants", rightField: "_id", label: "Billing → Tenant (by ID)" },
  { leftTable: "commissions", leftField: "affiliateId", rightTable: "affiliates", rightField: "_id", label: "Commissions → Affiliate (by ID)" },
  { leftTable: "commissions", leftField: "campaignId", rightTable: "campaigns", rightField: "_id", label: "Commissions → Campaign (by ID)" },
  { leftTable: "clicks", leftField: "affiliateId", rightTable: "affiliates", rightField: "_id", label: "Clicks → Affiliate (by ID)" },
  { leftTable: "payouts", leftField: "batchId", rightTable: "payoutBatches", rightField: "_id", label: "Payouts → Batch (by ID)" },
];

const ADMIN_MAX_ROWS = 500;

// =============================================================================
// Table Metadata
// =============================================================================

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
    await requireAdmin(ctx);

    return {
      tables: Object.values(ADMIN_QUERY_TABLES).map((table) => ({
        name: table.name,
        label: table.label,
        description: table.description,
        columns: table.columns,
      })),
      suggestedJoins: ADMIN_SUGGESTED_JOINS,
    };
  },
});

// =============================================================================
// Execute Query
// =============================================================================

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
    const admin = await requireAdmin(ctx);

    // 1. Validate tables
    for (const tableName of args.tables) {
      if (!(tableName in ADMIN_QUERY_TABLES)) {
        throw new Error(`Table "${tableName}" is not available for admin querying`);
      }
    }

    // 2. Validate columns
    for (const col of args.columns) {
      const tableDef = ADMIN_QUERY_TABLES[col.table];
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
        const tableDef = ADMIN_QUERY_TABLES[filter.table];
        if (!tableDef) {
          throw new Error(`Filter table "${filter.table}" is not available`);
        }
        const columnDef = tableDef.columns.find((c) => c.name === filter.column);
        if (!columnDef) {
          throw new Error(`Filter column "${filter.column}" does not exist in table "${filter.table}"`);
        }
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
        if (!ADMIN_QUERY_TABLES[join.leftTable] || !ADMIN_QUERY_TABLES[join.rightTable]) {
          throw new Error(`Join references unavailable table`);
        }
      }
    }

    // 5. Validate aggregations
    if (args.aggregations) {
      for (const agg of args.aggregations) {
        const tableDef = ADMIN_QUERY_TABLES[agg.table];
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

    // 6. Execute on primary table (admin: NO tenant filter by default)
    const primaryTable = args.tables[0];
    const allRows = await fetchAdminTableRows(ctx, primaryTable, ADMIN_MAX_ROWS);

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

    // Handle joins
    if (args.joins && args.joins.length > 0) {
      filteredRows = await applyAdminJoins(ctx, filteredRows, args.joins);
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

// =============================================================================
// Distinct Column Values
// =============================================================================

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
    await requireAdmin(ctx);

    const tableDef = ADMIN_QUERY_TABLES[args.tableName];
    if (!tableDef) {
      throw new Error(`Table "${args.tableName}" is not available`);
    }

    const columnDef = tableDef.columns.find((c) => c.name === args.columnName);
    if (!columnDef || !columnDef.filterable) {
      return [];
    }

    const rows = await fetchAdminTableRows(ctx, args.tableName, ADMIN_MAX_ROWS);

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

    return [...freqMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  },
});

// =============================================================================
// Saved Queries (Admin-isolated)
// =============================================================================

export const saveQuery = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    queryConfig: v.string(),
  },
  returns: v.id("adminSavedQueries"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    try {
      JSON.parse(args.queryConfig);
    } catch {
      throw new Error("Invalid query configuration JSON");
    }

    const now = Date.now();
    return await ctx.db.insert("adminSavedQueries", {
      name: args.name,
      description: args.description,
      queryConfig: args.queryConfig,
      createdBy: admin._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listSavedQueries = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("adminSavedQueries"),
    name: v.string(),
    description: v.optional(v.string()),
    queryConfig: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    canEdit: v.boolean(),
  })),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);

    const queries = await ctx.db
      .query("adminSavedQueries")
      .withIndex("by_created_by", (q) => q.eq("createdBy", admin._id))
      .collect();

    return queries.map((q) => ({
      _id: q._id,
      name: q.name,
      description: q.description,
      queryConfig: q.queryConfig,
      createdBy: q.createdBy,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      canEdit: q.createdBy === admin._id,
    }));
  },
});

export const updateSavedQuery = mutation({
  args: {
    queryId: v.id("adminSavedQueries"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    queryConfig: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const query = await ctx.db.get(args.queryId);
    if (!query || query.createdBy !== admin._id) {
      throw new Error("Query not found or you don't have permission to edit it");
    }

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

    await ctx.db.patch(args.queryId, updates);
    return null;
  },
});

export const deleteSavedQuery = mutation({
  args: {
    queryId: v.id("adminSavedQueries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const query = await ctx.db.get(args.queryId);
    if (!query || query.createdBy !== admin._id) {
      throw new Error("Query not found or you don't have permission to delete it");
    }

    await ctx.db.delete(args.queryId);
    return null;
  },
});

// =============================================================================
// Query Complexity (with auth check — fixing tenant QB's auth-less version)
// =============================================================================

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
    await requireAdmin(ctx);

    let score = 0;
    const warnings: string[] = [];
    const MAX_SCORE = 100;

    score += args.tables.length * 10;

    if (args.filters && args.filters.length > 0) {
      score -= args.filters.length * 3;
    }

    if (args.joins) {
      score += args.joins.length * 20;
      if (args.joins.length >= 3) {
        warnings.push("3 or more joins may impact query performance");
      }
    }

    if (args.aggregations) {
      score += args.aggregations.length * 5;
    }

    if (args.groupBy) {
      score += args.groupBy.length * 5;
    }

    if (score > 70) {
      warnings.push("Query complexity is high. Consider adding more filters to reduce result set.");
    }
    if (score > 90) {
      warnings.push("Query may timeout. Simplify the query or reduce the number of joins.");
    }

    return { score: Math.min(score, MAX_SCORE), warnings, maxScore: MAX_SCORE };
  },
});

// =============================================================================
// Export Cleanup
// =============================================================================

export const cleanupExpiredAdminExports = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const expiredExports = await ctx.db
      .query("adminQueryExports")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", sevenDaysAgo))
      .take(100);

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

// =============================================================================
// Internal Helpers (ctx-dependent)
// =============================================================================

async function fetchAdminTableRows(
  ctx: QueryCtx,
  tableName: string,
  maxRows: number
): Promise<Record<string, unknown>[]> {
  switch (tableName) {
    case "tenants":
      return await ctx.db.query("tenants").withIndex("by_status").take(maxRows);
    case "tenantStats":
      return await ctx.db.query("tenantStats").withIndex("by_tenant").take(maxRows);
    case "billingHistory":
      return await ctx.db.query("billingHistory").withIndex("by_tenant").take(maxRows);
    case "tierConfigs":
      return await ctx.db.query("tierConfigs").withIndex("by_tier").take(maxRows);
    case "tierOverrides":
      return await ctx.db.query("tierOverrides").withIndex("by_tenant").take(maxRows);
    case "adminNotes":
      return await ctx.db.query("adminNotes").withIndex("by_tenant").take(maxRows);
    case "auditLogs":
      return await ctx.db.query("auditLogs").withIndex("by_action").take(maxRows);
    case "affiliates":
      return await ctx.db.query("affiliates").withIndex("by_tenant").take(maxRows);
    case "campaigns":
      return await ctx.db.query("campaigns").withIndex("by_tenant").take(maxRows);
    case "clicks":
      return await ctx.db.query("clicks").withIndex("by_tenant").take(maxRows);
    case "conversions":
      return await ctx.db.query("conversions").withIndex("by_tenant").take(maxRows);
    case "commissions":
      return await ctx.db.query("commissions").withIndex("by_tenant").take(maxRows);
    case "payouts":
      return await ctx.db.query("payouts").withIndex("by_tenant").take(maxRows);
    case "payoutBatches":
      return await ctx.db.query("payoutBatches").withIndex("by_tenant").take(maxRows);
    default:
      throw new Error(`Table "${tableName}" is not available for admin querying`);
  }
}

async function applyAdminJoins(
  ctx: QueryCtx,
  rows: Record<string, unknown>[],
  joins: Array<{
    leftTable: string;
    rightTable: string;
    leftField: string;
    rightField: string;
  }>
): Promise<Record<string, unknown>[]> {
  let result = rows;

  for (const join of joins) {
    const rightRows = await fetchAdminTableRows(ctx, join.rightTable, ADMIN_MAX_ROWS);

    const isForeignKeyRef = /Id$/.test(join.leftField) && join.leftField !== "_id";

    result = result.map((row) => {
      const leftValue = row[join.leftField];

      let matchingRightRows: Record<string, unknown>[];
      if (isForeignKeyRef) {
        matchingRightRows = rightRows.filter(
          (r: Record<string, unknown>) => r._id === leftValue
        );
      } else {
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
