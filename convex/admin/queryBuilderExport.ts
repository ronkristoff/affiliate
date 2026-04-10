"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { betterAuthComponent } from "../auth";

/**
 * Export admin query builder results as CSV.
 * - Auth: requireAdmin
 * - Inserts record into adminQueryExports table (fixing tenant QB's unused table pattern)
 * - Logs export to auditLogs with action "admin_query_export"
 * - Dual-path: <=5k base64, >5k Convex storage
 */
export const exportAdminQueryBuilderCSV = action({
  args: {
    columns: v.array(v.object({
      table: v.string(),
      column: v.string(),
      alias: v.optional(v.string()),
    })),
    rows: v.array(v.record(v.string(), v.any())),
    queryInfo: v.optional(v.object({
      tables: v.array(v.string()),
      totalRows: v.number(),
    })),
  },
  returns: v.object({
    csvBase64: v.optional(v.string()),
    storageFileId: v.optional(v.id("_storage")),
    downloadUrl: v.optional(v.string()),
    totalRows: v.number(),
    exportId: v.optional(v.id("adminQueryExports")),
  }),
  handler: async (ctx, args) => {
    // Verify admin auth
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const adminUser: { _id: Id<"users">; role: string } | null = await ctx.runQuery(
      internal.users._getUserByEmailInternal,
      { email: betterAuthUser.email }
    );

    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
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
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    const fileName = `admin-query-export-${now}.csv`;

    let storageFileId: Id<"_storage"> | undefined;
    let downloadUrl: string | undefined;
    let csvBase64: string | undefined;

    if (args.rows.length <= 5000) {
      // Small dataset: return base64 directly
      csvBase64 = Buffer.from(csv).toString("base64");
    } else {
      // Large dataset: store in Convex storage
      const csvBlob = new Blob([csv], { type: "text/csv" });
      const arrayBuffer = await csvBlob.arrayBuffer();
      storageFileId = await ctx.storage.store(csvBlob);
    }

    const exportId: Id<"adminQueryExports"> = await ctx.runMutation(
      internal.audit._createAdminExportRecord,
      {
      createdBy: adminUser._id,
      storageFileId: storageFileId!,
      fileName,
      totalRows: args.rows.length,
      status: "completed",
      createdAt: now,
      expiresAt,
    });

    // Audit log entry for PII tracking
    await ctx.runMutation(internal.audit.logAuditEventInternal, {
      action: "admin_query_export",
      entityType: "adminQueryExports",
      entityId: String(exportId),
      actorId: adminUser._id,
      actorType: "admin",
      metadata: {
        tables: args.queryInfo?.tables ?? [],
        columns: args.columns.map((c) => c.alias || c.column),
        totalRows: args.rows.length,
        fileName,
      },
    });

    return {
      csvBase64,
      storageFileId: storageFileId!,
      downloadUrl,
      totalRows: args.rows.length,
      exportId: exportId!,
    };
  },
});

/**
 * Get a download URL for a stored admin export file.
 */
export const getAdminExportDownloadUrl = action({
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
