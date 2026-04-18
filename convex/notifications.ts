/**
 * Notification Service Layer
 *
 * Central service for all in-app notifications. Called via
 * ctx.runMutation(internal.notifications.createNotification, ...) from any mutation.
 *
 * Features:
 * - Aggregation: same-type + same-day notifications are merged
 * - Email: best-effort (try/catch, never throws from email failure)
 * - Unread count: real-time via @convex-dev/aggregate (notificationsByReadAggregate)
 * - Retention: 90-day auto-expire via expiresAt field
 * - Cleanup cron: daily batch delete of expired notifications
 * - Pagination: native Convex .paginate() for scale
 */

import { query } from "./_generated/server";
import { mutation, internalMutation } from "./triggers";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { getFromAddress } from "./emailService";
import { requireWriteAccess } from "./tenantContext";
import { notificationsByReadAggregate } from "./aggregates";

// 90 days in milliseconds
const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// =============================================================================
// Internal: Create Notification (central entry point)
// =============================================================================

/**
 * Create a single notification for a user.
 * Called via ctx.runMutation(internal.notifications.createNotification, ...) from any mutation.
 *
 * Email is best-effort — if email fails, the in-app notification still exists.
 */
export const createNotification = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("success"),
      v.literal("critical"),
    ),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    emailSubject: v.optional(v.string()),
    emailHtml: v.optional(v.string()),
    metadata: v.optional(v.any()),
    shouldAggregate: v.optional(v.boolean()),
    aggregateExtraCount: v.optional(v.number()),
    aggregateTotalMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayBoundary = Math.floor(now / 86400000); // UTC day boundary

    // Aggregation: check for existing same-type + same-day + same-user notification
    if (args.shouldAggregate) {
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q) =>
          q.eq("userId", args.userId).eq("isRead", false)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("type"), args.type),
            q.eq(q.field("aggregationDate"), todayBoundary)
          )
        )
        .first();

      if (existing) {
        const newCount = existing.aggregatedCount + (args.aggregateExtraCount ?? 1);
        await ctx.db.patch(existing._id, {
          aggregatedCount: newCount,
          title: args.aggregateTotalMessage ?? args.title,
          message: args.aggregateTotalMessage ?? args.message,
        });
        return null;
      }
    }

    // Insert notification
    await ctx.db.insert("notifications", {
      tenantId: args.tenantId,
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      severity: args.severity,
      actionUrl: args.actionUrl,
      actionLabel: args.actionLabel,
      isRead: false,
      expiresAt: now + NOTIFICATION_RETENTION_MS,
      metadata: args.metadata,
      aggregatedCount: 1,
      aggregationDate: todayBoundary,
    });

    // Send email (best-effort — never throws)
    if (args.emailSubject && args.emailHtml) {
      try {
        const user = await ctx.db.get(args.userId);
        const userEmail = user?.email;
        if (userEmail) {
          await ctx.scheduler.runAfter(0, internal.emailService.sendEmail, {
            from: getFromAddress("billing"),
            to: userEmail,
            subject: args.emailSubject,
            html: args.emailHtml,
            tracking: {
              tenantId: args.tenantId,
              type: args.type,
            },
          });
        }
      } catch (emailError) {
        // Email failure is non-fatal — in-app notification still exists
        console.error(
          `[notifications] Email delivery failed (non-fatal) for type="${args.type}" userId="${args.userId}":`,
          emailError instanceof Error ? emailError.message : String(emailError)
        );
      }
    }

    return null;
  },
});

// =============================================================================
// Internal: Create Bulk Notifications (broadcast to multiple users)
// =============================================================================

/**
 * Create notifications for multiple users.
 * Each user gets an individual notification (dual-write pattern).
 * Partial delivery is accepted — if one user fails, others still get theirs.
 */
export const createBulkNotifications = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    userIds: v.array(v.id("users")),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("success"),
      v.literal("critical"),
    ),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayBoundary = Math.floor(now / 86400000);

    for (const userId of args.userIds) {
      try {
        await ctx.db.insert("notifications", {
          tenantId: args.tenantId,
          userId,
          type: args.type,
          title: args.title,
          message: args.message,
          severity: args.severity,
          actionUrl: args.actionUrl,
          actionLabel: args.actionLabel,
          isRead: false,
          expiresAt: now + NOTIFICATION_RETENTION_MS,
          metadata: args.metadata,
          aggregatedCount: 1,
          aggregationDate: todayBoundary,
        });
      } catch (error) {
        // Accept partial delivery — log but continue
        console.error(
          `[notifications] Failed to create notification for userId="${userId}":`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    return null;
  },
});

// =============================================================================
// Queries: Read Notifications (native .paginate() for scale)
// =============================================================================

/**
 * Get notifications for a user without pagination.
 * Uses .take(50) to avoid InvalidCursor issues with paginated queries.
 * Ordered by creation time descending (newest first).
 * Supports optional type and read-status filters.
 */
export const listNotifications = query({
  args: {
    userId: v.id("users"),
    typeFilter: v.optional(v.string()),
    unreadOnly: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("notifications"),
    _creationTime: v.number(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("success"),
      v.literal("critical"),
    ),
    actionUrl: v.optional(v.string()),
    actionLabel: v.optional(v.string()),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    aggregatedCount: v.number(),
    aggregationDate: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const now = Date.now();

    let query = ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId));

    const results = await query.filter((q) => {
      const conditions = [q.gte(q.field("expiresAt") as any, now)];
      if (args.typeFilter) {
        conditions.push(q.eq(q.field("type") as any, args.typeFilter));
      }
      if (args.unreadOnly) {
        conditions.push(q.eq(q.field("isRead") as any, false));
      }
      return q.and(...conditions);
    }).order("desc").take(50);

    return results;
  },
});

/**
 * Get notifications for a user with native Convex pagination.
 * DEPRECATED: Use listNotifications instead to avoid InvalidCursor errors.
 * Ordered by creation time descending (newest first).
 * Supports optional type and read-status filters.
 */
export const getNotifications = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
    typeFilter: v.optional(v.string()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const queryBuilder = ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId));

    // Always use a single filter shape so pagination cursors remain valid
    // across filter changes. Conditionals inside the filter don't change
    // the query shape — only the structure of chained .filter() calls does.
    return ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .filter((q) => {
        const conditions = [q.gte(q.field("expiresAt") as any, now)];
        if (args.typeFilter) {
          conditions.push(q.eq(q.field("type") as any, args.typeFilter));
        }
        if (args.unreadOnly) {
          conditions.push(q.eq(q.field("isRead") as any, false));
        }
        return q.and(...conditions);
      })
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get unread notification count for a user.
 * Uses O(log n) aggregate query instead of denormalized counter.
 */
export const getUnreadNotificationCount = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const count = await notificationsByReadAggregate.count(ctx, {
      namespace: args.userId,
      bounds: { prefix: [false] },
    } as any);
    return { total: count };
  },
});

// =============================================================================
// Mutations: Mark Read / Delete (with auth checks)
// =============================================================================

/**
 * Mark a single notification as read.
 * Atomic: patches notification + decrements unread count in same transaction.
 * Verifies the notification belongs to the authenticated user.
 */
export const markNotificationRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Auth check: verify the caller is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    await requireWriteAccess(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.isRead) {
      return null; // Already read — idempotent
    }

    // Auth check: verify the notification belongs to the caller
    // Look up the user by email to find their Convex userId
    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    if (!callerUser || callerUser._id !== notification.userId) {
      throw new Error("Cannot mark another user's notification as read");
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });

    return null;
  },
});

/**
 * Mark all notifications as read for a user.
 * Caps at 200 per run for safety.
 */
export const markAllNotificationsRead = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Auth check: verify the caller is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    await requireWriteAccess(ctx);

    // Auth check: verify the caller is the user whose notifications are being marked
    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
    if (!callerUser || callerUser._id !== args.userId) {
      throw new Error("Cannot mark another user's notifications as read");
    }

    const now = Date.now();

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", args.userId).eq("isRead", false)
      )
      .filter((q) => q.gte(q.field("expiresAt") as any, now))
      .take(200);

    // Batch patch all as read
    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
      });
    }

    return null;
  },
});

// =============================================================================
// Internal: Cleanup & Reconciliation (cron targets)
// =============================================================================

/**
 * Clear expired notifications.
 * Runs daily, iterates through users and deletes their expired notifications.
 * Processes up to 100 users per run, 50 expired notifications per user.
 */
export const clearExpiredNotifications = internalMutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    usersProcessed: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let deletedCount = 0;
    let usersProcessed = 0;

    // Iterate through users and delete their expired notifications
    const users = await ctx.db.query("users").take(100);

    for (const user of users) {
      try {
        const expired = await ctx.db
          .query("notifications")
          .withIndex("by_user_created", (q) => q.eq("userId", user._id))
          .filter((q) => q.lt(q.field("expiresAt") as any, now))
          .take(50);

        for (const notification of expired) {
          try {
            await ctx.db.delete(notification._id);
            deletedCount++;
          } catch {
            // Already deleted or race condition — skip
          }
        }
        usersProcessed++;
      } catch (error) {
        console.error(
          `[notifications] Cleanup failed for userId="${user._id}":`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return { deletedCount, usersProcessed };
  },
});
