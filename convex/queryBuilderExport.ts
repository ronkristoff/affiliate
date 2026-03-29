"use node";

import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { betterAuthComponent } from "./auth";

// Export storage metadata table (for tracking async exports)
// Uses a simple approach: store export info in a table, file in Convex storage

/**
 * Export query builder results as CSV.
 * Small datasets (<=5000 rows): Returns base64 CSV directly.
 * Large datasets (>5000 rows): Stores in Convex storage and returns download URL.
 */
export const exportQueryBuilderCSV = action({
  args: {
    tenantId: v.id("tenants"),
    columns: v.array(v.object({
      table: v.string(),
      column: v.string(),
      alias: v.optional(v.string()),
    })),
    rows: v.array(v.record(v.string(), v.any())),
  },
  returns: v.object({
    csvBase64: v.optional(v.string()),
    storageFileId: v.optional(v.id("_storage")),
    downloadUrl: v.optional(v.string()),
    totalRows: v.number(),
  }),
  handler: async (ctx, args) => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type UserResult = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> } | null;
    const user: UserResult = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!user || user.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: Access denied");
    }

    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can export data");
    }

    // Generate CSV
    const headers = args.columns.map((col) => col.alias || `${col.table}.${col.column}`);
    const rows: string[] = [headers.join(",")];

    for (const row of args.rows) {
      const values = args.columns.map((col) => {
        const key = col.alias || `${col.table}.${col.column}`;
        const value = row[key];
        if (value === null || value === undefined) return "";
        if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
        if (typeof value === "number") return value.toString();
        if (typeof value === "boolean") return value ? "true" : "false";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      rows.push(values.join(","));
    }

    const csv = rows.join("\n");

    if (args.rows.length <= 5000) {
      // Small dataset: return base64 directly
      return {
        csvBase64: Buffer.from(csv).toString("base64"),
        storageFileId: undefined,
        downloadUrl: undefined,
        totalRows: args.rows.length,
      };
    }

    // Large dataset: store in Convex storage
    const csvBlob = new Blob([csv], { type: "text/csv" });
    const arrayBuffer = await csvBlob.arrayBuffer();
    const storageId = await ctx.storage.store(csvBlob);

    return {
      csvBase64: undefined,
      storageFileId: storageId,
      downloadUrl: undefined,
      totalRows: args.rows.length,
    };
  },
});

/**
 * Get a download URL for a stored export file.
 */
export const getExportDownloadUrl = action({
  args: {
    storageFileId: v.id("_storage"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    return await ctx.storage.getUrl(args.storageFileId);
  },
});
