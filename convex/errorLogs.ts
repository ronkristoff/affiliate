import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin/_helpers";

export const logError = internalMutation({
  args: {
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
    source: v.string(),
    message: v.string(),
    stackTrace: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("errorLogs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("errorLogs", {
      severity: args.severity,
      source: args.source,
      message: args.message,
      stackTrace: args.stackTrace,
      metadata: args.metadata,
      resolved: false,
    });
  },
});

export const resolveError = internalMutation({
  args: {
    errorLogId: v.id("errorLogs"),
    resolvedBy: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorLogId, {
      resolved: true,
      resolvedAt: Date.now(),
      resolvedBy: args.resolvedBy,
    });
    return null;
  },
});

export const getErrorLogs = query({
  args: {
    severity: v.optional(v.union(v.literal("error"), v.literal("warning"), v.literal("info"))),
    source: v.optional(v.string()),
    resolved: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("errorLogs"),
    _creationTime: v.number(),
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
    source: v.string(),
    message: v.string(),
    stackTrace: v.optional(v.string()),
    metadata: v.optional(v.any()),
    resolved: v.optional(v.boolean()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let q = ctx.db.query("errorLogs").order("desc");

    if (args.severity) {
      q = q.filter((q) => q.eq(q.field("severity"), args.severity));
    }
    if (args.source) {
      q = q.filter((q) => q.eq(q.field("source"), args.source));
    }
    if (args.resolved !== undefined) {
      q = q.filter((q) => q.eq(q.field("resolved"), args.resolved));
    }

    const limit = args.limit ?? 100;
    return await q.take(limit);
  },
});

export const getErrorLogById = query({
  args: {
    errorLogId: v.id("errorLogs"),
  },
  returns: v.object({
    _id: v.id("errorLogs"),
    _creationTime: v.number(),
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
    source: v.string(),
    message: v.string(),
    stackTrace: v.optional(v.string()),
    metadata: v.optional(v.any()),
    resolved: v.optional(v.boolean()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const log = await ctx.db.get(args.errorLogId);
    if (!log) {
      throw new Error("Error log not found");
    }
    return log;
  },
});

export const getErrorStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    unresolved: v.number(),
    bySeverity: v.record(v.string(), v.number()),
    bySource: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const allLogs = await ctx.db.query("errorLogs").collect();

    const bySeverity: Record<string, number> = { error: 0, warning: 0, info: 0 };
    const bySource: Record<string, number> = {};

    let unresolved = 0;

    for (const log of allLogs) {
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      bySource[log.source] = (bySource[log.source] || 0) + 1;
      if (!log.resolved) unresolved++;
    }

    return {
      total: allLogs.length,
      unresolved,
      bySeverity,
      bySource,
    };
  },
});
