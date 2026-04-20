"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const CRON_JOB_DEFINITIONS = [
  {
    name: "cleanup-old-login-attempts",
    handlerRef: "internal.rateLimit.cleanupOldAttempts",
    enabled: true,
    intervalHours: 1,
    description: "Clean up old login attempts to prevent table bloat",
    extraArgs: {},
  },
  {
    name: "cleanup-expired-rate-limits",
    handlerRef: "internal.rateLimits.cleanupExpiredLimits",
    enabled: true,
    intervalHours: 1,
    description: "Clean up expired rate limit documents",
    extraArgs: { batchSize: 500 },
  },
  {
    name: "check-deletion-reminders",
    handlerRef: "internal.tenants.checkAndSendDeletionReminders",
    enabled: true,
    intervalHours: 24,
    description: "Check for tenants needing deletion reminders",
    extraArgs: {},
  },
  {
    name: "cleanup-expired-query-exports",
    handlerRef: "internal.queryBuilder.cleanupExpiredExports",
    enabled: true,
    intervalHours: 24,
    description: "Clean up expired query builder export files",
    extraArgs: {},
  },
  {
    name: "expire-stale-referral-leads",
    handlerRef: "internal.referralLeads.expireStaleLeads",
    enabled: true,
    intervalHours: 24,
    description: "Expire stale referral leads older than 90 days",
    extraArgs: {},
  },
  {
    name: "billing-cycle-enforcer",
    handlerRef: "internal.billingLifecycle.enforceBillingLifecycle",
    enabled: true,
    intervalHours: 24,
    description: "Auto-transition subscription statuses based on billing dates",
    extraArgs: {},
  },
  {
    name: "notification-cleanup",
    handlerRef: "internal.notifications.clearExpiredNotifications",
    enabled: true,
    intervalHours: 24,
    description: "Delete expired notifications older than 90 days",
    extraArgs: {},
  },
  {
    name: "audit-log-retention",
    handlerRef: "internal.audit.runAuditLogRetention",
    enabled: true,
    intervalHours: 24,
    description: "Purge audit log entries older than 12 months",
    extraArgs: {},
  },
  {
    name: "error-log-cleanup",
    handlerRef: "internal.errorLogs.cleanupOldErrorLogs",
    enabled: true,
    intervalHours: 24,
    description: "Purge resolved error logs older than 90 days",
    extraArgs: {},
  },
] as const;

export const runDispatcher = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internal.cronDispatcher.seedCronConfigs, {});
    await ctx.runAction(internal.cronDispatcher.dispatchDueJobs, {});
    await ctx.runMutation(internal.cronDispatcherHelpers.cleanupOldExecutions, {});
    return null;
  },
});

export const seedCronConfigs = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const job of CRON_JOB_DEFINITIONS) {
      await ctx.runMutation(internal.cronDispatcherHelpers._upsertCronConfig, {
        name: job.name,
        handlerRef: job.handlerRef,
        enabled: job.enabled,
        intervalHours: job.intervalHours,
        description: job.description,
        extraArgs: job.extraArgs,
      });
    }
    return null;
  },
});

export const dispatchDueJobs = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const configs: Array<Record<string, any>> = await ctx.runQuery(
      internal.cronDispatcherHelpers._getAllCronConfigs,
      {},
    );

    for (const config of configs) {
      const shouldSchedule: boolean = await ctx.runMutation(
        internal.cronDispatcherHelpers._tryScheduleJob,
        { jobName: config.name, now },
      );

      if (shouldSchedule) {
        try {
          ctx.scheduler.runAfter(
            0,
            internal.cronDispatcher.executeJob,
            { jobName: config.name },
          );
        } catch (err) {
          console.error(
            `[cronDispatcher] Failed to schedule ${config.name}:`,
            err,
          );
          await ctx.runMutation(
            internal.cronDispatcherHelpers._resetStuckScheduled,
            { jobName: config.name },
          );
        }
      }
    }

    return null;
  },
});

export const executeJob = internalAction({
  args: { jobName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(
      internal.cronDispatcherHelpers._getCronConfig,
      { name: args.jobName },
    );

    if (!config) {
      console.error(`[cronDispatcher] Unknown job: ${args.jobName}`);
      return null;
    }

    if (!config.enabled) {
      await ctx.runMutation(
        internal.cronDispatcherHelpers._resetStuckScheduled,
        { jobName: args.jobName },
      );
      console.log(`[cronDispatcher] Skipping ${args.jobName} — disabled by admin`);
      return null;
    }

    const recentExecution: Record<string, any> | null = await ctx.runQuery(
      internal.cronDispatcherHelpers._getRecentExecution,
      { jobName: args.jobName, since: Date.now() - 5 * 60 * 1000 },
    );

    if (
      recentExecution &&
      (recentExecution.status === "success" || recentExecution.status === "failed")
    ) {
      console.log(
        `[cronDispatcher] Skipping ${args.jobName} — recent ${recentExecution.status} execution found`,
      );
      return null;
    }

    let executionId: Id<"cronExecutions"> | null = null;

    try {
      executionId = await ctx.runMutation(
        internal.cronDispatcherHelpers._createExecutionRecord,
        { jobName: args.jobName },
      );
    } catch (err) {
      console.error(
        `[cronDispatcher] Failed to create execution record for ${args.jobName}:`,
        err,
      );
      await ctx.runMutation(
        internal.cronDispatcherHelpers._resetStuckScheduled,
        { jobName: args.jobName },
      );
      return null;
    }

    const startedAt = Date.now();

    try {
      const result = await executeHandler(
        config.name,
        config.handlerRef,
        config.extraArgs,
        ctx,
      );

      const finishedAt = Date.now();
      const durationMs = finishedAt - startedAt;
      const resultSummary =
        typeof result === "object" && result !== null
          ? JSON.stringify(result)
          : result !== undefined
            ? String(result)
            : "OK";

      await ctx.runMutation(
        internal.cronDispatcherHelpers._completeExecutionRecord,
        {
          executionId,
          status: "success",
          finishedAt,
          durationMs,
          resultSummary,
          error: undefined,
        },
      );

      await ctx.runMutation(
        internal.cronDispatcherHelpers._updateConfigFinished,
        { name: args.jobName, finishedAt },
      );
    } catch (err) {
      const finishedAt = Date.now();
      const durationMs = finishedAt - startedAt;
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      try {
        await ctx.runMutation(
          internal.cronDispatcherHelpers._completeExecutionRecord,
          {
            executionId,
            status: "failed",
            finishedAt,
            durationMs,
            resultSummary: undefined,
            error: errorMessage,
          },
        );
      } catch (patchErr) {
        console.error(
          `[cronDispatcher] Failed to update execution record for ${args.jobName}:`,
          patchErr,
        );
      }

      try {
        await ctx.runMutation(
          internal.cronDispatcherHelpers._updateConfigFinished,
          { name: args.jobName, finishedAt },
        );
      } catch (patchErr) {
        console.error(
          `[cronDispatcher] Failed to update config finished for ${args.jobName}:`,
          patchErr,
        );
      }
    }

    return null;
  },
});

async function executeHandler(
  name: string,
  handlerRef: string,
  extraArgs: Record<string, unknown> | undefined,
  ctx: any,
): Promise<unknown> {
  switch (handlerRef) {
    case "internal.rateLimit.cleanupOldAttempts":
      return ctx.runMutation(internal.rateLimit.cleanupOldAttempts, {});

    case "internal.rateLimits.cleanupExpiredLimits":
      return ctx.runMutation(internal.rateLimits.cleanupExpiredLimits, {
        ...(extraArgs ?? {}),
      });

    case "internal.tenants.checkAndSendDeletionReminders":
      return ctx.runAction(
        internal.tenants.checkAndSendDeletionReminders,
        {},
      );

    case "internal.queryBuilder.cleanupExpiredExports":
      return ctx.runMutation(internal.queryBuilder.cleanupExpiredExports, {});

    case "internal.referralLeads.expireStaleLeads":
      return ctx.runMutation(internal.referralLeads.expireStaleLeads, {});

    case "internal.billingLifecycle.enforceBillingLifecycle":
      return ctx.runMutation(
        internal.billingLifecycle.enforceBillingLifecycle,
        {},
      );

    case "internal.notifications.clearExpiredNotifications":
      return ctx.runMutation(
        internal.notifications.clearExpiredNotifications,
        {},
      );

    case "internal.audit.runAuditLogRetention":
      return ctx.runAction(internal.audit.runAuditLogRetention, {});

    case "internal.errorLogs.cleanupOldErrorLogs":
      return ctx.runMutation(internal.errorLogs.cleanupOldErrorLogs, {});

    default:
      throw new Error(`Unknown handlerRef: ${handlerRef}`);
  }
}
