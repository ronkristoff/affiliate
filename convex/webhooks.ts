import { internalMutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Store raw webhook for idempotency and debugging
 * Internal function called from HTTP action
 */
export const storeRawWebhook = internalMutation({
  args: {
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    signatureValid: v.boolean(),
  },
  returns: v.id("rawWebhooks"),
  handler: async (ctx, args) => {
    const webhookId = await ctx.db.insert("rawWebhooks", {
      source: args.source,
      eventId: args.eventId,
      eventType: args.eventType,
      rawPayload: args.rawPayload,
      signatureValid: args.signatureValid,
      status: "received",
    });

    return webhookId;
  },
});

/**
 * List recent webhooks for a tenant - used for debugging attribution issues
 */
export const listRecentWebhooks = query({
  args: {
    count: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("rawWebhooks"),
      _creationTime: v.number(),
      source: v.string(),
      eventId: v.string(),
      eventType: v.string(),
      status: v.string(),
      processedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const count = args.count ?? 10;
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant from users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    // Query webhooks for this tenant
    const webhooks = await ctx.db
      .query("rawWebhooks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .order("desc")
      .take(count);

    return webhooks;
  },
});

/**
 * Get raw webhook payload for debugging
 */
export const getWebhookPayload = query({
  args: {
    webhookId: v.id("rawWebhooks"),
  },
  returns: v.object({
    _id: v.id("rawWebhooks"),
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    status: v.string(),
    signatureValid: v.boolean(),
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant from users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get the webhook
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) {
      throw new Error("Webhook not found");
    }

    // Verify tenant access
    if (webhook.tenantId !== user.tenantId) {
      throw new Error("Unauthorized");
    }

    return webhook;
  },
});
