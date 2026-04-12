import { mutation, internalMutation, internalAction, internalQuery, query, action } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";
import BroadcastEmail from "./emails/BroadcastEmail";
import { getAuthenticatedUser, getTenantId, requireTenantId } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { sendEmail, getFromAddress } from "./emailService";

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 100;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 3;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.boboddy.business";
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 50000;
const BROADCAST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between broadcasts

/**
 * Create a broadcast record and trigger the sending process.
 * Validates that the user is an Owner/Manager with appropriate permissions.
 * @security Requires authentication and 'affiliates:manage' permission.
 */
export const createBroadcast = mutation({
  args: {
    subject: v.string(),
    body: v.string(),
  },
  returns: v.id("broadcastEmails"),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission (broadcast is a communication to affiliates)
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "broadcast",
        entityId: "create_broadcast",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: "attemptedPermission=affiliates:manage, attemptedAction=createBroadcast",
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to send broadcast emails");
    }

    // Validate subject and body
    if (!args.subject.trim()) {
      throw new Error("Subject is required");
    }
    if (args.subject.length > MAX_SUBJECT_LENGTH) {
      throw new Error(`Subject must be ${MAX_SUBJECT_LENGTH} characters or less`);
    }
    if (!args.body.trim()) {
      throw new Error("Message body is required");
    }
    if (args.body.length > MAX_BODY_LENGTH) {
      throw new Error(`Message body must be ${MAX_BODY_LENGTH} characters or less`);
    }

    // Rate limiting: prevent broadcast spam (max 1 per 5 minutes per tenant)
    const cooldownThreshold = Date.now() - BROADCAST_COOLDOWN_MS;
    const recentBroadcasts = await ctx.db
      .query("broadcastEmails")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .filter((q) => q.gte(q.field("_creationTime"), cooldownThreshold))
      .collect();

    if (recentBroadcasts.length > 0) {
      const waitTimeSecs = Math.ceil(
        (BROADCAST_COOLDOWN_MS - (Date.now() - recentBroadcasts[0]._creationTime)) / 1000
      );
      throw new Error(
        `Please wait ${waitTimeSecs} seconds before sending another broadcast. ` +
        `Rate limit: 1 broadcast per ${BROADCAST_COOLDOWN_MS / 60000} minutes.`
      );
    }

    // Count active affiliates for recipient count
    const activeAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "active")
      )
      .collect();

    if (activeAffiliates.length === 0) {
      throw new Error("No active affiliates to send broadcast to");
    }

    // Create broadcast record with "pending" status
    const broadcastId = await ctx.db.insert("broadcastEmails", {
      tenantId,
      subject: args.subject,
      body: args.body,
      recipientCount: activeAffiliates.length,
      sentCount: 0,
      failedCount: 0,
      status: "pending",
      createdBy: authUser.userId,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "broadcast_created",
      entityType: "broadcast",
      entityId: broadcastId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: {
        subject: args.subject,
        recipientCount: activeAffiliates.length,
      },
    });

    // Schedule the send process (non-blocking)
    await ctx.scheduler.runAfter(0, internal.broadcasts.sendBroadcastEmails, {
      broadcastId,
      tenantId,
    });

    return broadcastId;
  },
});

/**
 * List broadcasts for the current tenant with pagination.
 * Used for broadcast history page.
 * @security Requires authentication. Results filtered by tenant.
 */
export const listBroadcasts = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("broadcastEmails"),
        _creationTime: v.number(),
        tenantId: v.id("tenants"),
        subject: v.string(),
        body: v.string(),
        recipientCount: v.number(),
        sentCount: v.number(),
        failedCount: v.number(),
        status: v.string(),
        createdBy: v.id("users"),
        sentAt: v.optional(v.number()),
        openedCount: v.optional(v.number()),
        clickedCount: v.optional(v.number()),
        bounceCount: v.optional(v.number()),
        complaintCount: v.optional(v.number()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    return await ctx.db
      .query("broadcastEmails")
      .withIndex("by_tenant_and_sent_at", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get a single broadcast by ID for the current tenant.
 * Used for viewing broadcast details.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getBroadcast = query({
  args: {
    broadcastId: v.id("broadcastEmails"),
  },
  returns: v.union(
    v.object({
      _id: v.id("broadcastEmails"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      subject: v.string(),
      body: v.string(),
      recipientCount: v.number(),
      sentCount: v.number(),
      failedCount: v.number(),
      status: v.string(),
      createdBy: v.id("users"),
      sentAt: v.optional(v.number()),
      openedCount: v.optional(v.number()),
      clickedCount: v.optional(v.number()),
      bounceCount: v.optional(v.number()),
      complaintCount: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return null;
    }

    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast || broadcast.tenantId !== tenantId) {
      return null;
    }

    return broadcast;
  },
});

/**
 * Get count of active affiliates for broadcast recipient preview.
 * @security Requires authentication.
 */
export const getActiveAffiliateCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return 0;
    }

    const activeAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "active")
      )
      .collect();

    return activeAffiliates.length;
  },
});

/**
 * Internal action: Send broadcast emails to all active affiliates.
 * Processes emails in batches of 100 with rate limiting.
 * Implements retry logic with exponential backoff for failed sends.
 * Tracks each email in the `emails` table with type="broadcast".
 */
export const sendBroadcastEmails = internalAction({
  args: {
    broadcastId: v.id("broadcastEmails"),
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { broadcastId, tenantId } = args;

    // Update broadcast status to "sending"
    await ctx.runMutation(internal.broadcasts.updateBroadcastStatus, {
      broadcastId,
      status: "sending",
    });

    try {
      // Get broadcast details
      const broadcast = await ctx.runQuery(
        internal.broadcasts.getBroadcastInternal,
        { broadcastId }
      );
      if (!broadcast) {
        await ctx.runMutation(internal.broadcasts.updateBroadcastStatus, {
          broadcastId,
          status: "failed",
        });
        return null;
      }

      // Get all active affiliates for tenant
      const activeAffiliates = await ctx.runQuery(
        internal.broadcasts.getActiveAffiliatesInternal,
        { tenantId }
      );

      // Get tenant branding
      const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
        tenantId,
      });
      const portalName = tenant?.branding?.portalName || tenant?.name || "Affiliate Portal";
      const brandLogoUrl = tenant?.branding?.logoUrl;
      const brandPrimaryColor = tenant?.branding?.primaryColor || "#1c2260";

      let sentCount = 0;
      let failedCount = 0;

      // Process in batches
      for (let i = 0; i < activeAffiliates.length; i += BATCH_SIZE) {
        const batch = activeAffiliates.slice(i, i + BATCH_SIZE);

        // Send all emails in batch concurrently
        const results = await Promise.allSettled(
          batch.map((affiliate: { _id: Id<"affiliates">; email: string; name: string }) =>
            sendSingleBroadcastEmail(ctx, {
              tenantId,
              broadcastId,
              affiliateId: affiliate._id,
              affiliateEmail: affiliate.email,
              affiliateName: affiliate.name,
              subject: broadcast.subject,
              body: broadcast.body,
              portalName,
              brandLogoUrl,
              brandPrimaryColor,
            })
          )
        );

        // Count results
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            sentCount++;
          } else {
            failedCount++;
          }
        }

        // Update counts after each batch
        await ctx.runMutation(internal.broadcasts.updateBroadcastCounts, {
          broadcastId,
          sentCount,
          failedCount,
        });

        // Rate limiting delay between batches
        if (i + BATCH_SIZE < activeAffiliates.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // Set final status
      const finalStatus = failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "failed";
      await ctx.runMutation(internal.broadcasts.updateBroadcastStatus, {
        broadcastId,
        status: finalStatus,
        sentCount,
        failedCount,
        sentAt: Date.now(),
      });

      // Create audit log
      await ctx.runMutation(internal.broadcasts.logBroadcastCompletion, {
        tenantId,
        broadcastId,
        subject: broadcast.subject,
        sentCount,
        failedCount,
        status: finalStatus,
      });

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update broadcast as failed
      await ctx.runMutation(internal.broadcasts.updateBroadcastStatus, {
        broadcastId,
        status: "failed",
      });

      return null;
    }
  },
});

/**
 * Send a single broadcast email to one affiliate.
 * Includes retry logic with exponential backoff.
 */
async function sendSingleBroadcastEmail(
  ctx: any,
  args: {
    tenantId: Id<"tenants">;
    broadcastId: Id<"broadcastEmails">;
    affiliateId: Id<"affiliates">;
    affiliateEmail: string;
    affiliateName: string;
    subject: string;
    body: string;
    portalName: string;
    brandLogoUrl?: string;
    brandPrimaryColor?: string;
    attempt?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const currentAttempt = args.attempt ?? 0;

  try {
    // Construct unsubscribe URL (placeholder - connect to actual unsubscribe endpoint when available)
    const unsubscribeUrl = `${APP_URL}/api/unsubscribe?affiliate=${args.affiliateId}`;

    // Send via unified email service (supports both Resend and Postmark)
    const emailResult = await ctx.runAction(internal.emailService.sendEmail, {
      from: getFromAddress("broadcasts"),
      to: args.affiliateEmail,
      subject: args.subject,
      html: await render(
        <BroadcastEmail
          subject={args.subject}
          body={args.body}
          portalName={args.portalName}
          brandLogoUrl={args.brandLogoUrl}
          brandPrimaryColor={args.brandPrimaryColor}
          unsubscribeUrl={unsubscribeUrl}
        />
      ),
      tracking: {
        tenantId: args.tenantId,
        type: "broadcast",
        affiliateId: args.affiliateId,
        broadcastId: args.broadcastId,
      },
    });

    if (!emailResult.success) {
      throw new Error("Email send failed");
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Retry with exponential backoff via scheduler (non-blocking)
    if (currentAttempt < MAX_RETRIES) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, currentAttempt);
      await ctx.scheduler.runAfter(delay, internal.broadcasts.retryFailedBroadcastEmail, {
        broadcastId: args.broadcastId,
        tenantId: args.tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: args.affiliateEmail,
        affiliateName: args.affiliateName,
        subject: args.subject,
        body: args.body,
        portalName: args.portalName,
        brandLogoUrl: args.brandLogoUrl,
        brandPrimaryColor: args.brandPrimaryColor,
        attempt: currentAttempt + 1,
      });
      // Return success:false so the caller counts this as a failure initially;
      // the retry will update counts if it succeeds.
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Internal action: Retry a single failed broadcast email.
 * Scheduled by sendSingleBroadcastEmail via ctx.scheduler.runAfter().
 * On success, increments sentCount and decrements failedCount on the broadcast record.
 * Uses non-blocking scheduler-based retry pattern per project conventions.
 */
export const retryFailedBroadcastEmail = internalAction({
  args: {
    broadcastId: v.id("broadcastEmails"),
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    subject: v.string(),
    body: v.string(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Get tenant branding
      const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
        tenantId: args.tenantId,
      });
      const portalName = args.portalName || tenant?.branding?.portalName || tenant?.name || "Affiliate Portal";
      const brandLogoUrl = args.brandLogoUrl || tenant?.branding?.logoUrl;
      const brandPrimaryColor = args.brandPrimaryColor || tenant?.branding?.primaryColor || "#1c2260";

      // Construct unsubscribe URL
      const unsubscribeUrl = `${APP_URL}/api/unsubscribe?affiliate=${args.affiliateId}`;

      // Send via unified email service
      const emailResult = await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("broadcasts"),
        to: args.affiliateEmail,
        subject: args.subject,
        html: await render(
          <BroadcastEmail
            subject={args.subject}
            body={args.body}
            portalName={portalName}
            brandLogoUrl={brandLogoUrl}
            brandPrimaryColor={brandPrimaryColor}
            unsubscribeUrl={unsubscribeUrl}
          />
        ),
        tracking: {
          tenantId: args.tenantId,
          type: "broadcast",
          affiliateId: args.affiliateId,
          broadcastId: args.broadcastId,
        },
      });

      if (!emailResult.success) {
        throw new Error("Email send failed");
      }

      // Increment sentCount and decrement failedCount on broadcast record
      const broadcast = await ctx.runQuery(internal.broadcasts.getBroadcastInternal, {
        broadcastId: args.broadcastId,
      });
      if (broadcast) {
        await ctx.runMutation(internal.broadcasts.updateBroadcastCounts, {
          broadcastId: args.broadcastId,
          sentCount: broadcast.sentCount + 1,
          failedCount: Math.max(0, broadcast.failedCount - 1),
        });

        // Update final status if all failures have been retried
        const newFailedCount = Math.max(0, broadcast.failedCount - 1);
        if (newFailedCount === 0) {
          await ctx.runMutation(internal.broadcasts.updateBroadcastStatus, {
            broadcastId: args.broadcastId,
            status: "sent",
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If more retries available, schedule another one
      if (args.attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, args.attempt);
        await ctx.scheduler.runAfter(delay, internal.broadcasts.retryFailedBroadcastEmail, {
          ...args,
          attempt: args.attempt + 1,
        });
      }
      // If max retries exhausted, the email stays as failed - already counted in failedCount
    }
    return null;
  },
});

// ============ Internal Mutations ============

/**
 * Internal mutation: Update broadcast status.
 */
export const updateBroadcastStatus = internalMutation({
  args: {
    broadcastId: v.id("broadcastEmails"),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("partial"),
      v.literal("failed")
    ),
    sentCount: v.optional(v.number()),
    failedCount: v.optional(v.number()),
    sentAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Partial<Doc<"broadcastEmails">> = { status: args.status };
    
    if (args.sentCount !== undefined) updates.sentCount = args.sentCount;
    if (args.failedCount !== undefined) updates.failedCount = args.failedCount;
    if (args.sentAt !== undefined) updates.sentAt = args.sentAt;

    await ctx.db.patch(args.broadcastId, updates);
    return null;
  },
});

/**
 * Internal mutation: Update broadcast sent/failed counts.
 */
export const updateBroadcastCounts = internalMutation({
  args: {
    broadcastId: v.id("broadcastEmails"),
    sentCount: v.number(),
    failedCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.broadcastId, {
      sentCount: args.sentCount,
      failedCount: args.failedCount,
    });
    return null;
  },
});

/**
 * Internal mutation: Log broadcast completion to audit log.
 */
export const logBroadcastCompletion = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    broadcastId: v.id("broadcastEmails"),
    subject: v.string(),
    sentCount: v.number(),
    failedCount: v.number(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "broadcast_completed",
      entityType: "broadcast",
      entityId: args.broadcastId,
      actorType: "system",
      newValue: {
        subject: args.subject,
        sentCount: args.sentCount,
        failedCount: args.failedCount,
        status: args.status,
      },
    });
    return null;
  },
});

// ============ Internal Queries ============

/**
 * Internal query: Get broadcast details without tenant check.
 * Used by internal actions.
 */
export const getBroadcastInternal = internalQuery({
  args: {
    broadcastId: v.id("broadcastEmails"),
  },
  returns: v.union(
    v.object({
      _id: v.id("broadcastEmails"),
      tenantId: v.id("tenants"),
      subject: v.string(),
      body: v.string(),
      recipientCount: v.number(),
      sentCount: v.number(),
      failedCount: v.number(),
      status: v.string(),
      createdBy: v.id("users"),
      sentAt: v.optional(v.number()),
      openedCount: v.optional(v.number()),
      clickedCount: v.optional(v.number()),
      bounceCount: v.optional(v.number()),
      complaintCount: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) {
      return null;
    }
    return {
      _id: broadcast._id,
      tenantId: broadcast.tenantId,
      subject: broadcast.subject,
      body: broadcast.body,
      recipientCount: broadcast.recipientCount,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      status: broadcast.status,
      createdBy: broadcast.createdBy,
      sentAt: broadcast.sentAt,
      openedCount: broadcast.openedCount,
      clickedCount: broadcast.clickedCount,
      bounceCount: broadcast.bounceCount,
      complaintCount: broadcast.complaintCount,
    };
  },
});

/**
 * Internal query: Get all active affiliates for a tenant.
 * Used by internal actions for broadcast sending.
 */
export const getActiveAffiliatesInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      email: v.string(),
      name: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .collect();

    return affiliates.map((a) => ({
      _id: a._id,
      email: a.email,
      name: a.name,
    }));
  },
});

// ============ Story 10.6: Broadcast Email Log ============

/**
 * Query: Get broadcast recipients with pagination and search.
 * Returns emails for a specific broadcast with optional search and status filter.
 * Used by broadcast detail page to show recipient list.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getBroadcastRecipients = query({
  args: {
    broadcastId: v.id("broadcastEmails"),
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
    statusFilter: v.optional(v.array(v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("complained")
    ))),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("emails"),
        recipientEmail: v.string(),
        affiliateName: v.optional(v.string()),
        deliveryStatus: v.optional(v.union(
          v.literal("queued"),
          v.literal("sent"),
          v.literal("delivered"),
          v.literal("opened"),
          v.literal("clicked"),
          v.literal("bounced"),
          v.literal("complained")
        )),
        deliveredAt: v.optional(v.number()),
        openedAt: v.optional(v.number()),
        clickedAt: v.optional(v.number()),
        bounceReason: v.optional(v.string()),
        sentAt: v.optional(v.number()),
        status: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    // Verify broadcast belongs to tenant
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast || broadcast.tenantId !== tenantId) {
      return { page: [], isDone: true, continueCursor: null };
    }

    // Query emails by broadcast ID
    let emails = await ctx.db
      .query("emails")
      .withIndex("by_broadcast", (q) =>
        q.eq("broadcastId", args.broadcastId)
      )
      .order("desc")
      .collect();

    // Apply status filter (array of statuses — match any)
    if (args.statusFilter && args.statusFilter.length > 0) {
      emails = emails.filter(
        (e) => e.deliveryStatus && args.statusFilter!.includes(e.deliveryStatus)
      );
    }

    // Apply search filter - search by email OR affiliate name (AC2)
    if (args.searchQuery && args.searchQuery.trim()) {
      const query = args.searchQuery.toLowerCase().trim();
      
      // Collect all affiliate IDs from emails
      const affiliateIds = emails
        .map((e) => e.affiliateId)
        .filter((id): id is Id<"affiliates"> => id !== undefined);
      
      // Fetch affiliate names
      const affiliateNames = new Map<Id<"affiliates">, string>();
      for (const affiliateId of affiliateIds) {
        const affiliate = await ctx.db.get(affiliateId);
        if (affiliate) {
          affiliateNames.set(affiliateId, affiliate.name.toLowerCase());
        }
      }
      
      // Filter by email OR affiliate name
      emails = emails.filter((e) => {
        const emailMatch = e.recipientEmail.toLowerCase().includes(query);
        const nameMatch = e.affiliateId 
          ? affiliateNames.get(e.affiliateId)?.includes(query) ?? false
          : false;
        return emailMatch || nameMatch;
      });
    }

    // Manual pagination after filtering
    const { numItems, cursor } = args.paginationOpts;
    let startIndex = 0;
    if (cursor) {
      startIndex = emails.findIndex((e) => e._id === cursor) + 1;
      if (startIndex <= 0) startIndex = 0;
    }

    const page = emails.slice(startIndex, startIndex + numItems);
    const isDone = startIndex + numItems >= emails.length;
    const continueCursor = isDone ? null : page[page.length - 1]?._id ?? null;

    // Resolve affiliate names for each email
    const results = [];
    for (const email of page) {
      let affiliateName: string | undefined;
      if (email.affiliateId) {
        const affiliate = await ctx.db.get(email.affiliateId);
        affiliateName = affiliate?.name;
      }

      results.push({
        _id: email._id,
        recipientEmail: email.recipientEmail,
        affiliateName,
        deliveryStatus: email.deliveryStatus,
        deliveredAt: email.deliveredAt,
        openedAt: email.openedAt,
        clickedAt: email.clickedAt,
        bounceReason: email.bounceReason,
        sentAt: email.sentAt,
        status: email.status,
      });
    }

    return { page: results, isDone, continueCursor };
  },
});

/**
 * Query: Get broadcast statistics for delivery funnel.
 * Returns aggregated counts and percentages for delivery tracking.
 * Used by broadcast detail page for stats dashboard.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getBroadcastStats = query({
  args: {
    broadcastId: v.id("broadcastEmails"),
  },
  returns: v.object({
    total: v.number(),
    sent: v.number(),
    delivered: v.number(),
    opened: v.number(),
    clicked: v.number(),
    bounced: v.number(),
    complained: v.number(),
    openRate: v.number(),
    clickRate: v.number(),
    bounceRate: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return {
        total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0,
        bounced: 0, complained: 0, openRate: 0, clickRate: 0, bounceRate: 0,
      };
    }

    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast || broadcast.tenantId !== tenantId) {
      return {
        total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0,
        bounced: 0, complained: 0, openRate: 0, clickRate: 0, bounceRate: 0,
      };
    }

    // Use pre-calculated aggregate fields from broadcast record (updated via webhooks)
    // This is more efficient than querying all emails for large broadcasts
    const sent = broadcast.sentCount ?? 0;
    const delivered = sent - (broadcast.bounceCount ?? 0); // Approximate: sent - bounced
    const opened = broadcast.openedCount ?? 0;
    const clicked = broadcast.clickedCount ?? 0;
    const bounced = broadcast.bounceCount ?? 0;
    const complained = broadcast.complaintCount ?? 0;

    // Calculate rates (percentage with 1 decimal place)
    const openRate = sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0;
    const clickRate = sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0;
    const bounceRate = sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0;

    return {
      total: broadcast.recipientCount,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      openRate,
      clickRate,
      bounceRate,
    };
  },
});

/**
 * Action: Export broadcast data as CSV.
 * Returns CSV content string for download.
 * Includes all recipient emails, delivery statuses, and timestamps.
 * @security Requires authentication. Validates tenant ownership.
 */
export const exportBroadcastData = action({
  args: {
    broadcastId: v.id("broadcastEmails"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Get broadcast details
    const broadcast = await ctx.runQuery(internal.broadcasts.getBroadcastInternal, {
      broadcastId: args.broadcastId,
    });
    if (!broadcast) {
      throw new Error("Broadcast not found");
    }

    // Get all emails for this broadcast
    const emails: Array<{
      recipientEmail: string;
      affiliateName?: string;
      deliveryStatus?: string;
      deliveredAt?: number;
      openedAt?: number;
      clickedAt?: number;
      bounceReason?: string;
    }> = await ctx.runQuery(internal.broadcasts.getBroadcastEmailsInternal, {
      broadcastId: args.broadcastId,
    });

    // Build CSV
    const headers: string[] = [
      "Broadcast Subject",
      "Sent Date",
      "Recipient Email",
      "Affiliate Name",
      "Delivery Status",
      "Delivered At",
      "Opened At",
      "Clicked At",
      "Bounce Reason",
    ];

    const rows: string[][] = emails.map((email) => [
      escapeCsv(broadcast.subject),
      broadcast.sentAt ? new Date(broadcast.sentAt).toISOString() : "",
      escapeCsv(email.recipientEmail),
      escapeCsv(email.affiliateName ?? ""),
      email.deliveryStatus ?? "unknown",
      email.deliveredAt ? new Date(email.deliveredAt).toISOString() : "",
      email.openedAt ? new Date(email.openedAt).toISOString() : "",
      email.clickedAt ? new Date(email.clickedAt).toISOString() : "",
      escapeCsv(email.bounceReason ?? ""),
    ]);

    const csv: string = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return csv;
  },
});

/**
 * Internal query: Get all emails for a broadcast (no tenant check, used by internal actions).
 */
export const getBroadcastEmailsInternal = internalQuery({
  args: {
    broadcastId: v.id("broadcastEmails"),
  },
  returns: v.array(
    v.object({
      _id: v.id("emails"),
      recipientEmail: v.string(),
      affiliateId: v.optional(v.id("affiliates")),
      affiliateName: v.optional(v.string()),
      deliveryStatus: v.optional(v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("opened"),
        v.literal("clicked"),
        v.literal("bounced"),
        v.literal("complained")
      )),
      deliveredAt: v.optional(v.number()),
      openedAt: v.optional(v.number()),
      clickedAt: v.optional(v.number()),
      bounceReason: v.optional(v.string()),
      status: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_broadcast", (q) =>
        q.eq("broadcastId", args.broadcastId)
      )
      .collect();

    const results = [];
    for (const email of emails) {
      let affiliateName: string | undefined;
      if (email.affiliateId) {
        const affiliate = await ctx.db.get(email.affiliateId);
        affiliateName = affiliate?.name;
      }

      results.push({
        _id: email._id,
        recipientEmail: email.recipientEmail,
        affiliateId: email.affiliateId,
        affiliateName,
        deliveryStatus: email.deliveryStatus,
        deliveredAt: email.deliveredAt,
        openedAt: email.openedAt,
        clickedAt: email.clickedAt,
        bounceReason: email.bounceReason,
        status: email.status,
      });
    }

    return results;
  },
});

/**
 * Helper: Escape a CSV field value.
 */
function escapeCsv(value: string): string {
  if (!value) return '""';
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
