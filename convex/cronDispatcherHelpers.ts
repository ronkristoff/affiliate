import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const _getCronConfig = internalQuery({
  args: { name: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("cronConfigs"),
      name: v.string(),
      handlerRef: v.string(),
      enabled: v.boolean(),
      intervalHours: v.number(),
      description: v.string(),
      lastFinishedAt: v.optional(v.number()),
      lastScheduledAt: v.optional(v.number()),
      extraArgs: v.optional(v.any()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.name))
      .first();
    return config ?? null;
  },
});

export const _getAllCronConfigs = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("cronConfigs").collect();
  },
});

export const _insertCronConfig = internalMutation({
  args: {
    name: v.string(),
    handlerRef: v.string(),
    enabled: v.boolean(),
    intervalHours: v.number(),
    description: v.string(),
    extraArgs: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.name))
      .first();
    if (existing) return null;
    await ctx.db.insert("cronConfigs", {
      name: args.name,
      handlerRef: args.handlerRef,
      enabled: args.enabled,
      intervalHours: args.intervalHours,
      description: args.description,
      extraArgs: args.extraArgs,
    });
    return null;
  },
});

export const _upsertCronConfig = internalMutation({
  args: {
    name: v.string(),
    handlerRef: v.string(),
    enabled: v.boolean(),
    intervalHours: v.number(),
    description: v.string(),
    extraArgs: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.name))
      .first();

    if (!existing) {
      await ctx.db.insert("cronConfigs", { ...args });
      return null;
    }

    const updates: Record<string, unknown> = {};
    if (existing.handlerRef !== args.handlerRef) updates.handlerRef = args.handlerRef;
    if (existing.description !== args.description) updates.description = args.description;
    if (existing.intervalHours !== args.intervalHours) updates.intervalHours = args.intervalHours;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(existing._id, updates);
    }
    return null;
  },
});

export const cleanupOldExecutions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 3600_000;
    let deleted = 0;
    let cursor: string | undefined;

    while (deleted < 500) {
      const results = await ctx.db
        .query("cronExecutions")
        .withIndex("by_startedAt")
        .order("asc")
        .paginate({ numItems: 100, cursor: cursor ?? null });

      for (const doc of results.page) {
        if (doc.finishedAt < cutoff) {
          await ctx.db.delete(doc._id);
          deleted++;
        }
      }

      if (results.isDone) break;
      cursor = results.continueCursor;
    }

    return null;
  },
});

export const _tryScheduleJob = internalMutation({
  args: { jobName: v.string(), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.jobName))
      .first();

    if (!config || !config.enabled) return false;

    const intervalMs = config.intervalHours * 3600_000;
    const lastFinished = config.lastFinishedAt ?? null;
    const lastScheduled = config.lastScheduledAt ?? null;

    const isDue = lastFinished === null || lastFinished + intervalMs < args.now;
    const isInFlight =
      lastScheduled !== null &&
      (lastFinished === null || lastFinished < lastScheduled);

    if (!isDue || isInFlight) return false;

    const staleScheduled =
      lastScheduled !== null &&
      args.now - lastScheduled > 10 * 60 * 1000;

    if (staleScheduled) {
      await ctx.db.patch(config._id, {
        lastScheduledAt: undefined,
      });
      return false;
    }

    await ctx.db.patch(config._id, { lastScheduledAt: args.now });
    return true;
  },
});

export const _resetStuckScheduled = internalMutation({
  args: { jobName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.jobName))
      .first();

    if (!config) return null;

    if (
      config.lastScheduledAt &&
      (!config.lastFinishedAt || config.lastFinishedAt < config.lastScheduledAt)
    ) {
      await ctx.db.patch(config._id, {
        lastScheduledAt: undefined,
      });
    }
    return null;
  },
});

export const _createExecutionRecord = internalMutation({
  args: { jobName: v.string() },
  returns: v.id("cronExecutions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("cronExecutions", {
      jobName: args.jobName,
      status: "running",
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
    });
    return id;
  },
});

export const _completeExecutionRecord = internalMutation({
  args: {
    executionId: v.id("cronExecutions"),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
    ),
    finishedAt: v.number(),
    durationMs: v.number(),
    resultSummary: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, {
      status: args.status,
      finishedAt: args.finishedAt,
      durationMs: args.durationMs,
      resultSummary: args.resultSummary,
      error: args.error,
    });
    return null;
  },
});

export const _updateConfigFinished = internalMutation({
  args: { name: v.string(), finishedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.name))
      .first();

    if (config) {
      await ctx.db.patch(config._id, { lastFinishedAt: args.finishedAt });
    }
    return null;
  },
});

export const _getRecentExecution = internalQuery({
  args: { jobName: v.string(), since: v.number() },
  returns: v.union(
    v.object({
      _id: v.id("cronExecutions"),
      jobName: v.string(),
      status: v.union(
        v.literal("success"),
        v.literal("failed"),
        v.literal("running"),
      ),
      startedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const execution = await ctx.db
      .query("cronExecutions")
      .withIndex("by_jobName_and_startedAt", (q: any) => q.eq("jobName", args.jobName))
      .order("desc")
      .first();

    if (!execution || execution.startedAt < args.since) return null;
    return execution;
  },
});
