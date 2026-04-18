import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./admin/_helpers";
import { cronExecutionsByStatusAggregate } from "./aggregates";

export const listCronConfigs = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("cronConfigs"),
      _creationTime: v.number(),
      name: v.string(),
      handlerRef: v.string(),
      enabled: v.boolean(),
      intervalHours: v.number(),
      description: v.string(),
      lastFinishedAt: v.optional(v.number()),
      lastScheduledAt: v.optional(v.number()),
      extraArgs: v.optional(v.any()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const configs = await ctx.db.query("cronConfigs").take(100);
    return configs.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listCronExecutions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    jobName: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("success"),
        v.literal("failed"),
        v.literal("running"),
      ),
    ),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("cronExecutions"),
        _creationTime: v.number(),
        jobName: v.string(),
        status: v.union(
          v.literal("success"),
          v.literal("failed"),
          v.literal("running"),
        ),
        startedAt: v.number(),
        finishedAt: v.number(),
        durationMs: v.number(),
        resultSummary: v.optional(v.string()),
        error: v.optional(v.string()),
      }),
    ),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let q;
    if (args.jobName && args.status) {
      q = ctx.db
        .query("cronExecutions")
        .withIndex("by_jobName_and_startedAt", (q2: any) => q2.eq("jobName", args.jobName))
        .order("desc");
      const result = await q.paginate(args.paginationOpts);
      return { page: result.page.filter((e) => e.status === args.status), continueCursor: result.continueCursor, isDone: result.isDone };
    } else if (args.jobName) {
      q = ctx.db
        .query("cronExecutions")
        .withIndex("by_jobName_and_startedAt", (q2: any) => q2.eq("jobName", args.jobName))
        .order("desc");
    } else if (args.status) {
      q = ctx.db
        .query("cronExecutions")
        .withIndex("by_status_and_startedAt", (q2: any) => q2.eq("status", args.status))
        .order("desc");
    } else {
      q = ctx.db
        .query("cronExecutions")
        .withIndex("by_startedAt")
        .order("desc");
    }

    const result = await q.paginate(args.paginationOpts);
    return { page: result.page, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

export const getCronStats = query({
  args: {},
  returns: v.object({
    totalExecutions: v.number(),
    successCount: v.number(),
    failedCount: v.number(),
    runningCount: v.number(),
    lastRunTime: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const aggregate = cronExecutionsByStatusAggregate;

    const successCount = await aggregate.count(ctx, {
      bounds: { lower: { key: ["success"], inclusive: true }, upper: { key: ["success\uffff"], inclusive: false } },
    } as any);

    const failedCount = await aggregate.count(ctx, {
      bounds: { lower: { key: ["failed"], inclusive: true }, upper: { key: ["failed\uffff"], inclusive: false } },
    } as any);

    const runningCount = await aggregate.count(ctx, {
      bounds: { lower: { key: ["running"], inclusive: true }, upper: { key: ["running\uffff"], inclusive: false } },
    } as any);

    const totalCount = successCount + failedCount + runningCount;

    const lastExecution = await ctx.db
      .query("cronExecutions")
      .withIndex("by_startedAt")
      .order("desc")
      .first();

    return {
      totalExecutions: totalCount,
      successCount,
      failedCount,
      runningCount,
      lastRunTime: lastExecution?.startedAt ?? undefined,
    };
  },
});

export const toggleCronEnabled = mutation({
  args: { jobName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.jobName))
      .first();

    if (!config) {
      throw new Error(`Cron config not found: ${args.jobName}`);
    }

    await ctx.db.patch(config._id, { enabled: !config.enabled });
    return null;
  },
});

export const updateCronInterval = mutation({
  args: { jobName: v.string(), intervalHours: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.intervalHours < 1) {
      throw new Error("intervalHours must be at least 1");
    }

    const config = await ctx.db
      .query("cronConfigs")
      .withIndex("by_name", (q: any) => q.eq("name", args.jobName))
      .first();

    if (!config) {
      throw new Error(`Cron config not found: ${args.jobName}`);
    }

    await ctx.db.patch(config._id, {
      intervalHours: args.intervalHours,
    });
    return null;
  },
});
