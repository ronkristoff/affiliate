import { internalMutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Currency conversion constant: 100 cents = 1 currency unit (PHP, USD, etc.)
const CENTS_PER_CURRENCY_UNIT = 100;

// ============================================
// BillingEvent Type Definitions
// ============================================

/**
 * Supported billing event types from SaligPay webhooks
 */
export type BillingEventType =
  | "payment.updated"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "refund.created";

/**
 * Payment status types
 */
export type PaymentStatus = "paid" | "pending" | "failed";

/**
 * Subscription status types
 */
export type SubscriptionStatus = "active" | "cancelled" | "past_due";

/**
 * Normalized BillingEvent interface
 */
export interface BillingEvent {
  eventId: string;
  eventType: BillingEventType;
  timestamp: number;
  tenantId?: string;
  attribution?: {
    affiliateCode?: string;
    clickId?: string;
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    customerEmail?: string;
  };
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    planId?: string;
  };
  rawPayload: string;
}

/**
 * Normalize a SaligPay webhook payload to BillingEvent format
 * Returns null if the payload structure is invalid
 */
export function normalizeToBillingEvent(payload: any): BillingEvent | null {
  try {
    // Validate basic structure
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const eventId = payload.id || `evt_${Date.now()}`;
    const eventType = payload.event;
    const timestamp = payload.created || Date.now();

    // Validate event type
    const validEventTypes: BillingEventType[] = [
      "payment.updated",
      "subscription.created",
      "subscription.updated",
      "subscription.cancelled",
      "refund.created",
    ];

    if (!eventType || !validEventTypes.includes(eventType)) {
      return null;
    }

    const dataObject = payload.data?.object;
    if (!dataObject) {
      return null;
    }

    // Extract metadata for attribution
    const metadata = dataObject.metadata || {};
    const tenantId = metadata._salig_aff_tenant;
    const attribution = {
      affiliateCode: metadata._salig_aff_ref,
      clickId: metadata._salig_aff_click_id,
    };

    // Extract payment data
    const payment = {
      id: dataObject.id || `pay_${Date.now()}`,
      amount: dataObject.amount || 0,
      currency: dataObject.currency || "PHP",
      status: (dataObject.status as PaymentStatus) || "pending",
      customerEmail: dataObject.customer?.email,
    };

    // Extract subscription data if applicable
    let subscription: BillingEvent["subscription"] | undefined;
    if (["subscription.created", "subscription.updated", "subscription.cancelled"].includes(eventType)) {
      subscription = {
        id: dataObject.subscription?.id || dataObject.id || `sub_${Date.now()}`,
        status: (dataObject.subscription?.status || dataObject.status) as SubscriptionStatus,
        planId: dataObject.subscription?.plan_id || dataObject.plan_id,
      };
    }

    return {
      eventId,
      eventType,
      timestamp,
      tenantId: tenantId || undefined,
      attribution: (attribution.affiliateCode || attribution.clickId) ? attribution : undefined,
      payment,
      subscription,
      rawPayload: JSON.stringify(payload),
    };
  } catch (error) {
    console.error("Error normalizing webhook payload:", error);
    return null;
  }
}

// ============================================
// Internal Query: Check for duplicate event ID
// ============================================

/**
 * Check if an event ID already exists in rawWebhooks
 * Used for deduplication
 */
export const checkEventIdExists = internalQuery({
  args: {
    eventId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rawWebhooks")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    return !!existing;
  },
});

/**
 * Log a duplicate webhook attempt for audit purposes
 * MEDIUM fix #9: Store duplicate attempts in rawWebhooks table
 */
export const logDuplicateWebhookAttempt = internalMutation({
  args: {
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    tenantId: v.optional(v.id("tenants")),
  },
  returns: v.id("rawWebhooks"),
  handler: async (ctx, args) => {
    const webhookId = await ctx.db.insert("rawWebhooks", {
      source: args.source,
      eventId: `${args.eventId}_duplicate_${Date.now()}`,
      eventType: args.eventType,
      rawPayload: args.rawPayload,
      signatureValid: false,
      tenantId: args.tenantId,
      status: "duplicate",
      processedAt: Date.now(),
      errorMessage: `Duplicate webhook attempt for eventId: ${args.eventId}`,
    });

    return webhookId;
  },
});

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
    tenantId: v.optional(v.id("tenants")),
    status: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("rawWebhooks"),
  handler: async (ctx, args) => {
    const webhookId = await ctx.db.insert("rawWebhooks", {
      source: args.source,
      eventId: args.eventId,
      eventType: args.eventType,
      rawPayload: args.rawPayload,
      signatureValid: args.signatureValid,
      tenantId: args.tenantId,
      status: args.status || "received",
      processedAt: args.status === "processed" ? Date.now() : undefined,
      errorMessage: args.errorMessage,
    });

    return webhookId;
  },
});

/**
 * Atomic deduplication mutation for webhooks (Story 7.5)
 * Attempts to insert a webhook and returns whether it was a duplicate
 * Uses unique constraint on eventId to detect duplicates atomically
 */
export const ensureEventNotProcessed = internalMutation({
  args: {
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    signatureValid: v.boolean(),
    tenantId: v.optional(v.id("tenants")),
  },
  returns: v.object({
    isDuplicate: v.boolean(),
    webhookId: v.optional(v.id("rawWebhooks")),
    existingWebhookId: v.optional(v.id("rawWebhooks")),
  }),
  handler: async (ctx, args) => {
    // First, check if a webhook with this eventId already exists
    const existingWebhook = await ctx.db
      .query("rawWebhooks")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existingWebhook) {
      // Duplicate detected
      return {
        isDuplicate: true,
        existingWebhookId: existingWebhook._id,
      };
    }

    // Not a duplicate - insert the webhook
    try {
      const webhookId = await ctx.db.insert("rawWebhooks", {
        source: args.source,
        eventId: args.eventId,
        eventType: args.eventType,
        rawPayload: args.rawPayload,
        signatureValid: args.signatureValid,
        tenantId: args.tenantId,
        status: "received",
      });

      return {
        isDuplicate: false,
        webhookId,
      };
    } catch (error) {
      // If insert fails due to unique constraint, it means another concurrent
      // request inserted it between our check and insert
      const concurrentWebhook = await ctx.db
        .query("rawWebhooks")
        .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
        .first();

      return {
        isDuplicate: true,
        existingWebhookId: concurrentWebhook?._id,
      };
    }
  },
});

/**
 * Update webhook processing status
 */
export const updateWebhookStatus = internalMutation({
  args: {
    webhookId: v.id("rawWebhooks"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookId, {
      status: args.status,
      processedAt: args.status === "processed" || args.status === "failed" ? Date.now() : undefined,
      errorMessage: args.errorMessage,
    });
    return null;
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
      return [];
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
      return {
        _id: args.webhookId,
        source: "unknown",
        eventId: "unknown",
        eventType: "unknown",
        rawPayload: "{}",
        status: "error",
        signatureValid: false,
        processedAt: undefined,
        errorMessage: "User not found",
      };
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

// ============================================
// Internal: Validate tenant ID exists
// ============================================

/**
 * Internal: Validate tenant ID and get tenant info
 */
export const validateTenantIdInternal = internalQuery({
  args: {
    tenantId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Try to parse as Id<"tenants">
    let tenantId: Id<"tenants">;
    try {
      tenantId = args.tenantId as Id<"tenants">;
    } catch {
      return null;
    }

    const tenant = await ctx.db.get(tenantId);
    if (!tenant) {
      return null;
    }

    return {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
    };
  },
});

/**
 * Internal: Get user by auth ID
 */
export const getUserByAuthIdInternal = internalQuery({
  args: {
    authId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      tenantId: v.id("tenants"),
      name: v.optional(v.string()),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
    };
  },
});

// ============================================
// Internal: Process webhook to conversion
// ============================================

/**
 * Internal: Process a BillingEvent to create a conversion
 * Returns conversion ID or null if no conversion created
 */
export const processWebhookToConversion = internalMutation({
  args: {
    webhookId: v.id("rawWebhooks"),
    billingEvent: v.object({
      eventId: v.string(),
      eventType: v.string(),
      timestamp: v.number(),
      tenantId: v.optional(v.string()),
      attribution: v.optional(v.object({
        affiliateCode: v.optional(v.string()),
        clickId: v.optional(v.string()),
      })),
      payment: v.object({
        id: v.string(),
        amount: v.number(),
        currency: v.string(),
        status: v.string(),
        customerEmail: v.optional(v.string()),
      }),
      subscription: v.optional(v.any()),
      rawPayload: v.string(),
    }),
  },
  returns: v.union(v.id("conversions"), v.null()),
  handler: async (ctx, args) => {
    const event = args.billingEvent as BillingEvent;

    // Support all billing event types (AC #1)
    const supportedEventTypes: BillingEventType[] = [
      "payment.updated",
      "subscription.created",
      "subscription.updated",
      "subscription.cancelled",
      "refund.created",
    ];

    if (!supportedEventTypes.includes(event.eventType)) {
      console.error(`Webhook ${event.eventId}: Unsupported event type ${event.eventType}`);
      await ctx.db.patch(args.webhookId, {
        status: "failed",
        processedAt: Date.now(),
        errorMessage: `Unsupported event type: ${event.eventType}`,
      });
      return null;
    }

    // Check if we have attribution data
    if (!event.attribution?.affiliateCode) {
      // No attribution - log event but don't create conversion (AC #3)
      console.error(`Webhook ${event.eventId}: No attribution data, skipping conversion creation`);
      await ctx.db.patch(args.webhookId, {
        status: "processed",
        processedAt: Date.now(),
        errorMessage: "No attribution data - logged only",
      });
      return null;
    }

    // Get tenant ID
    if (!event.tenantId) {
      console.error(`Webhook ${event.eventId}: No tenant ID in webhook, skipping conversion`);
      await ctx.db.patch(args.webhookId, {
        status: "failed",
        processedAt: Date.now(),
        errorMessage: "No tenant ID in webhook",
      });
      return null;
    }

    const tenantId = event.tenantId as Id<"tenants">;

    // Find affiliate by code - now includes status check for "active"
    const affiliate: {
      _id: Id<"affiliates">;
      email: string;
      name: string;
      uniqueCode: string;
      status: string;
    } | null = await ctx.runQuery(internal.conversions.findAffiliateByCodeInternal, {
      tenantId,
      code: event.attribution.affiliateCode,
    });

    // AC #5: Invalid affiliate OR inactive affiliate - create organic conversion
    if (!affiliate || affiliate.status !== "active") {
      const invalidReason = !affiliate ? "Invalid affiliate code" : `Affiliate status is ${affiliate.status}`;

      // Create organic conversion with invalid reference logged
      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / CENTS_PER_CURRENCY_UNIT, // Convert from cents
        status: event.payment.status === "paid" ? "completed" : "pending",
        metadata: {
          orderId: event.payment.id,
          products: undefined,
        },
      });

      // Update webhook status with detailed error message
      await ctx.db.patch(args.webhookId, {
        status: "processed",
        processedAt: Date.now(),
        errorMessage: `${invalidReason} (code: ${event.attribution.affiliateCode}) - created organic conversion`,
      });

      return conversionId;
    }

    // Only create conversions for "paid" status (HIGH severity fix #5)
    if (event.payment.status !== "paid") {
      console.error(`Webhook ${event.eventId}: Payment status is ${event.payment.status}, not creating conversion`);
      await ctx.db.patch(args.webhookId, {
        status: "processed",
        processedAt: Date.now(),
        errorMessage: `Payment status is ${event.payment.status} - no conversion created`,
      });
      return null;
    }

    // AC #2: Valid and active affiliate + paid status - create attributed conversion
    // Get referral link for attribution chain
    const referralLink: {
      _id: Id<"referralLinks">;
      affiliateId: Id<"affiliates">;
      campaignId?: Id<"campaigns">;
    } | null = await ctx.runQuery(internal.conversions.getReferralLinkByCodeInternal, {
      tenantId,
      code: event.attribution.affiliateCode,
    });

    // Find recent click for attribution chain
    const recentClick: {
      _id: Id<"clicks">;
      referralLinkId: Id<"referralLinks">;
    } | null = await ctx.runQuery(internal.conversions.findRecentClickInternal, {
      tenantId,
      affiliateId: affiliate._id,
      campaignId: referralLink?.campaignId,
    });

    // Extract products from metadata if available (MEDIUM fix #8)
    const rawPayload = JSON.parse(event.rawPayload);
    const products = rawPayload.data?.object?.metadata?._salig_aff_products || undefined;

    // Create conversion with webhook attribution
    const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
      tenantId,
      affiliateId: affiliate._id,
      referralLinkId: referralLink?._id,
      clickId: event.attribution.clickId ? (event.attribution.clickId as Id<"clicks">) : (recentClick?._id),
      campaignId: referralLink?.campaignId,
      customerEmail: event.payment.customerEmail,
      amount: event.payment.amount / CENTS_PER_CURRENCY_UNIT, // Convert from cents using constant
      status: "completed", // Only paid payments reach here
      attributionSource: "webhook",
      metadata: {
        orderId: event.payment.id,
        products,
      },
    });

    // Update webhook status
    await ctx.db.patch(args.webhookId, {
      status: "processed",
      processedAt: Date.now(),
    });

    return conversionId;
  },
});
