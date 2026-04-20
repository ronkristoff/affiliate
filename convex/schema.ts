import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Task 2: Core Tables
  tenants: defineTable({
    name: v.string(),
    slug: v.string(),
    domain: v.string(), // Tenant's website domain (verified via tracking snippet)
    plan: v.string(),
    status: v.string(),
    subscriptionStatus: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    billingStartDate: v.optional(v.number()),
    billingEndDate: v.optional(v.number()),
    cancellationDate: v.optional(v.number()),
    deletionScheduledDate: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    trackingPublicKey: v.optional(v.string()),
    trackingVerifiedAt: v.optional(v.number()),
    // Universal billing provider: "saligpay" | "stripe" | undefined (no provider)
    // Billing lifecycle enforcement fields
    cancelledReason: v.optional(v.union(
      v.literal("grace_expired"),
      v.literal("trial_expired"),
      v.literal("admin_cancelled"),
      v.literal("owner_cancelled"),
    )),
    pastDueSince: v.optional(v.number()),
    billingProvider: v.optional(v.union(
      v.literal("saligpay"),
      v.literal("stripe"),
    )),
    // Top-level field for Stripe tenant resolution via webhook (indexed for lookup)
    stripeAccountId: v.optional(v.string()),
    payoutSchedule: v.optional(v.object({
      payoutDayOfMonth: v.optional(v.number()),
      minimumPayoutAmount: v.optional(v.number()),
      payoutProcessingDays: v.optional(v.number()),
      payoutScheduleNote: v.optional(v.string()),
    })),
    saligPayCredentials: v.optional(v.object({
      clientId: v.string(),
      clientSecret: v.string(),
      mode: v.optional(v.string()),
      connectedAt: v.optional(v.number()),
      mockMerchantId: v.optional(v.string()),
      realMerchantId: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      mockAccessToken: v.optional(v.string()),
      mockRefreshToken: v.optional(v.string()),
    })),
    stripeCredentials: v.optional(v.object({
      signingSecret: v.string(),       // Webhook signing secret (manual fallback)
      mode: v.optional(v.string()),     // "test" or "live"
      connectedAt: v.optional(v.number()),
      connectedVia: v.optional(v.string()), // "oauth" or "manual"
      livemode: v.optional(v.boolean()),    // Whether OAuth connection is in live mode
      accessToken: v.optional(v.string()),  // OAuth access token (obfuscated)
      refreshToken: v.optional(v.string()), // OAuth refresh token (obfuscated)
    })),
    branding: v.optional(v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      portalName: v.optional(v.string()),
      assetGuidelines: v.optional(v.string()),
      // Custom domain fields (Story 8.8)
      customDomain: v.optional(v.string()),
      domainStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("dns_verification"),
        v.literal("ssl_provisioning"),
        v.literal("active"),
        v.literal("failed")
      )),
      domainVerifiedAt: v.optional(v.number()),
      sslProvisionedAt: v.optional(v.number()),
    })),
    // Onboarding state
    onboardingCompleted: v.optional(v.boolean()), // true once user finishes the onboarding wizard
    onboardingCompletedAt: v.optional(v.number()), // timestamp of completion
    // Platform billing provider (how tenant pays the salig-affiliate platform)
    // Distinct from billingProvider which is merchant Connect (how tenants receive payments)
    platformPaymentProvider: v.optional(v.union(
      v.literal("stripe"),
      v.literal("saligpay"),
    )),
    stripeSubscriptionId: v.optional(v.string()), // Stripe subscription ID for platform billing
    stripeCustomerId: v.optional(v.string()),      // Stripe customer ID for platform billing
  }).index("by_slug", ["slug"])
    .index("by_domain", ["domain"])
    .index("by_tracking_key", ["trackingPublicKey"])
    .index("by_status", ["status"])
    .index("by_plan", ["plan"])
    .index("by_stripe_account_id", ["stripeAccountId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  // Brand Asset Library table (Story 8.6)
  // Stores marketing assets uploaded by SaaS Owner for affiliates to access
  brandAssets: defineTable({
    tenantId: v.id("tenants"),
    type: v.union(
      v.literal("logo"),
      v.literal("banner"),
      v.literal("product-image"),
      v.literal("copy-text"),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    // For file-based assets (images)
    fileUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    format: v.optional(v.string()),
    dimensions: v.optional(v.object({
      width: v.number(),
      height: v.number(),
    })),
    // For text assets
    textContent: v.optional(v.string()),
    // Common fields
    category: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_type", ["tenantId", "type"])
    .index("by_tenant_and_active", ["tenantId", "isActive"])
    .index("by_tenant_and_category", ["tenantId", "category"]),

  // Billing history table
  billingHistory: defineTable({
    tenantId: v.id("tenants"),
    event: v.string(),
    plan: v.optional(v.string()),
    amount: v.optional(v.number()),
    timestamp: v.number(),
    transactionId: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    newPlan: v.optional(v.string()),
    previousPlan: v.optional(v.string()),
    proratedAmount: v.optional(v.number()),
    mockTransaction: v.optional(v.boolean()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_time", ["tenantId", "timestamp"]),

  users: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.string(),
    status: v.optional(v.string()),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    permissionOverrides: v.optional(v.object({
      canManageAffiliates: v.boolean(),
      canManageCampaigns: v.boolean(),
      canViewCommissions: v.boolean(),
    })),
    authId: v.optional(v.string()),
    // Denormalized notification unread count for O(1) reads
    notificationUnreadCount: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_email", ["tenantId", "email"])
    .index("by_tenant_and_role", ["tenantId", "role"])
    .index("by_email", ["email"])
    .index("by_auth_id", ["authId"]),

  teamInvitations: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    role: v.string(),
    token: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"])
    .index("by_token", ["token"])
    .index("by_tenant_and_email", ["tenantId", "email"]),

  tierConfigs: defineTable({
    tier: v.string(),
    price: v.number(),
    maxAffiliates: v.number(),
    maxCampaigns: v.number(),
    maxTeamMembers: v.number(),
    maxPayoutsPerMonth: v.number(),
    maxApiCalls: v.number(),
    features: v.object({
      customDomain: v.boolean(),
      advancedAnalytics: v.boolean(),
      prioritySupport: v.boolean(),
    }),
    isDefault: v.boolean(),
    displayOrder: v.number(),
    isActive: v.boolean(),
    stripeProductId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
  }).index("by_tier", ["tier"])
    .index("by_default", ["isDefault"])
    .index("by_display_order", ["displayOrder"]),

  // Task 3: Campaign & Affiliate Tables
  campaigns: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    slug: v.optional(v.string()), // URL-safe slug for public signup page (e.g., /portal/register?tenant=X&campaign=summer-sale)
    description: v.optional(v.string()),
    commissionType: v.string(),
    commissionValue: v.number(),
    recurringCommission: v.boolean(),
    recurringRate: v.optional(v.number()),
    recurringRateType: v.optional(v.string()),
    cookieDuration: v.optional(v.number()),
    autoApproveCommissions: v.optional(v.boolean()),
    approvalThreshold: v.optional(v.number()),
    status: v.string(),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_tenant_and_slug", ["tenantId", "slug"]),
    // Note: _creationTime is auto-appended by Convex to all indexes.
    // Use by_tenant with .order("desc") for newest-first paginated queries.

  // Affiliate-Campaign enrollment join table
  // Tracks which affiliates are enrolled in which campaigns
  affiliateCampaigns: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    status: v.string(), // "active", "paused", "removed"
    enrolledAt: v.number(),
    enrolledVia: v.string(), // "signup" (self-registered via campaign page), "invite" (added by owner)
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_campaign", ["campaignId"])
    .index("by_affiliate_and_campaign", ["affiliateId", "campaignId"])
    .index("by_tenant_and_campaign", ["tenantId", "campaignId"])
    .index("by_affiliate_and_status", ["affiliateId", "status"]), // Coupon-only campaign resolution

  affiliates: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    name: v.string(), // Full name for backward compatibility (computed from firstName + lastName)
    uniqueCode: v.string(),
    status: v.string(),
    vanitySlug: v.optional(v.string()),
    promotionChannel: v.optional(v.string()),
    note: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    payoutMethod: v.optional(v.object({
      type: v.string(),
      details: v.string(),
    })),
    // Self-referral detection fields (Story 5.6)
    lastLoginIp: v.optional(v.string()),
    lastDeviceFingerprint: v.optional(v.string()),
    payoutMethodLastDigits: v.optional(v.string()),
    payoutMethodProcessorId: v.optional(v.string()),
    // Fraud signals with review tracking (Story 5.7)
    fraudSignals: v.optional(v.array(v.object({
      type: v.string(),
      severity: v.string(),
      timestamp: v.number(),
      details: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
      reviewedBy: v.optional(v.string()),
      reviewNote: v.optional(v.string()),
      commissionId: v.optional(v.id("commissions")),  // Link to related commission (Story 7.4)
      signalId: v.optional(v.string()),  // Stable ID for signal lookup (fraud engine hardening)
    }))),
    commissionOverrides: v.optional(v.array(v.object({
      campaignId: v.id("campaigns"),
      rate: v.number(),
      status: v.optional(v.union(
        v.literal("active"),
        v.literal("paused"),
      )),
    }))),
    // Coupon code fields (Attribution Resilience — Phase 2)
    couponCode: v.optional(v.string()),                  // Vanity coupon code for attribution
    couponAttributionEnabled: v.optional(v.boolean()),   // Toggle coupon attribution per affiliate (default: true)
    defaultCouponCampaignId: v.optional(v.id("campaigns")), // Campaign for coupon-only conversions
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_email", ["tenantId", "email"])
    .index("by_email", ["email"])
    .index("by_tenant_and_code", ["tenantId", "uniqueCode"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_tenant_coupon_code", ["tenantId", "couponCode"]), // Coupon code lookup index

  // Affiliate sessions table for server-side session management
  affiliateSessions: defineTable({
    affiliateId: v.id("affiliates"),
    tenantId: v.id("tenants"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  }).index("by_token", ["token"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_expires", ["expiresAt"]),

  referralLinks: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    code: v.string(),
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_code", ["code"])
    .index("by_tenant_and_campaign", ["tenantId", "campaignId"]),

  // Task 4: Tracking Tables
  clicks: defineTable({
    tenantId: v.id("tenants"),
    referralLinkId: v.id("referralLinks"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    referrer: v.optional(v.string()),
    dedupeKey: v.string(),
  }).index("by_tenant", ["tenantId"])
    .index("by_referral_link", ["referralLinkId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_dedupe_key", ["dedupeKey"]),

  // Tracking pings table for tracking pixel verification
  trackingPings: defineTable({
    tenantId: v.id("tenants"),
    trackingKey: v.string(),
    timestamp: v.number(),
    domain: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tracking_key", ["trackingKey"])
    .index("by_tenant_and_time", ["tenantId", "timestamp"]),

  // Referral pings table for referral health monitoring
  // Mirrors trackingPings — fired when Affilio.referral() is called on merchant's site
  referralPings: defineTable({
    tenantId: v.id("tenants"),
    trackingKey: v.string(),
    timestamp: v.number(),
    domain: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    pingType: v.optional(v.string()), // "referral" distinguishes from snippet pings
    email: v.optional(v.string()),    // Customer email from referral() call
  }).index("by_tenant", ["tenantId"])
    .index("by_tracking_key", ["trackingKey"])
    .index("by_tenant_and_time", ["tenantId", "timestamp"]),

  // Referral leads table for universal lead matching
  // Created when Affilio.referral({email}) is called on merchant's signup form
  // Used by webhook handlers to match customer email → affiliate attribution
  referralLeads: defineTable({
    tenantId: v.id("tenants"),           // Which merchant this lead belongs to
    email: v.string(),                    // Customer email (primary lookup key)
    uid: v.optional(v.string()),          // Optional stable customer ID (e.g., Stripe customer ID)
    affiliateId: v.id("affiliates"),      // Which affiliate referred this customer
    referralLinkId: v.optional(v.id("referralLinks")), // Which referral link was clicked (optional: coupon-only leads have no click)
    campaignId: v.optional(v.id("campaigns")), // Which campaign (if any)
    clickId: v.optional(v.id("clicks")),  // Which click record (if tracked)
    status: v.union(                      // Lead lifecycle
      v.literal("active"),                // Signup recorded, no conversion yet
      v.literal("converted"),             // Conversion created and linked
      v.literal("expired"),               // Past attribution window, no conversion
    ),
    convertedAt: v.optional(v.number()),  // Timestamp when conversion was linked
    conversionId: v.optional(v.id("conversions")), // Linked conversion record
  })
    .index("by_tenant_email", ["tenantId", "email"])         // UNIQUE: upsert + webhook lookup
    .index("by_tenant_affiliate", ["tenantId", "affiliateId"]) // Query affiliate's leads
    .index("by_tenant_uid", ["tenantId", "uid"])              // UID-based lookup fallback
    .index("by_tenant", ["tenantId"])                         // General tenant queries
    .index("by_tenant_and_status", ["tenantId", "status"]),   // Status-based queries (cleanup cron)

  conversions: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.optional(v.id("affiliates")),
    referralLinkId: v.optional(v.id("referralLinks")),
    clickId: v.optional(v.id("clicks")),
    campaignId: v.optional(v.id("campaigns")),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    status: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
    paymentMethodLastDigits: v.optional(v.string()),
    paymentMethodProcessorId: v.optional(v.string()),
    // Attribution tracking (Story 6.3)
    attributionSource: v.optional(v.union(
      v.literal("cookie"),
      v.literal("webhook"),
      v.literal("organic"),
      v.literal("body"),
      v.literal("coupon"),       // Coupon code-based attribution
      v.literal("lead_email")    // Email-based lead matching from webhook
    )),
    couponCode: v.optional(v.string()), // First-class coupon code field for queryable reporting
    isSelfReferral: v.optional(v.boolean()),
    metadata: v.optional(v.object({
      orderId: v.optional(v.string()),
      products: v.optional(v.array(v.string())),
      subscriptionId: v.optional(v.string()),
      planId: v.optional(v.string()),
      subscriptionStatus: v.optional(v.string()),
      previousPlanId: v.optional(v.string()),
      previousAmount: v.optional(v.number()),
    })),
  }).index("by_tenant", ["tenantId"])
    .index("by_click", ["clickId"])
    .index("by_campaign", ["campaignId"])
    .index("by_affiliate_created", ["affiliateId"]),

  // Task 5: Commission & Payout Tables
  commissions: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    conversionId: v.optional(v.id("conversions")),
    amount: v.number(),
    status: v.string(),
    isSelfReferral: v.optional(v.boolean()),
    fraudIndicators: v.optional(v.array(v.string())),
    eventMetadata: v.optional(v.object({
      source: v.string(),
      transactionId: v.optional(v.string()),
      timestamp: v.number(),
      subscriptionId: v.optional(v.string()),
    })),
    reversalReason: v.optional(v.string()),
    transactionId: v.optional(v.string()),  // Payment/transaction ID from SaligPay for efficient lookup
    batchId: v.optional(v.id("payoutBatches")),  // Link to payout batch when commission is paid
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_campaign", ["campaignId"])
    .index("by_conversion", ["conversionId"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_tenant_and_transaction", ["tenantId", "transactionId"])
    .index("by_batch", ["batchId"])
    .index("by_tenant_and_isSelfReferral", ["tenantId", "isSelfReferral"]),

  payouts: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    batchId: v.id("payoutBatches"),
    amount: v.number(),
    status: v.string(),
    paymentReference: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    paymentSource: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_batch", ["batchId"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  payoutBatches: defineTable({
    tenantId: v.id("tenants"),
    totalAmount: v.number(),
    affiliateCount: v.number(),
    status: v.string(),
    generatedAt: v.number(),
    completedAt: v.optional(v.number()),
    manualCount: v.optional(v.number()),
    saligPayCount: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  // Error/Exception Logging Table (Platform-wide)
  errorLogs: defineTable({
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
    source: v.string(), // e.g., "platformBilling", "stripeWebhook", "auth", "conversion"
    message: v.string(),
    stackTrace: v.optional(v.string()),
    metadata: v.optional(v.any()), // Additional context: tenantId, userId, requestId, etc.
    resolved: v.optional(v.boolean()), // Marked as resolved by admin
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  }).index("by_severity", ["severity"])
    .index("by_source", ["source"])
    .index("by_resolved", ["resolved"]),

  // Task 6: System Tables
  auditLogs: defineTable({
    tenantId: v.optional(v.id("tenants")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    targetId: v.optional(v.string()),
    actorId: v.optional(v.string()),
    actorType: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    // Flexible metadata for various audit event types
    // Can include amount, campaignId, reason, transactionId, etc.
    metadata: v.optional(v.any()),
    // Reference to affiliate for commission-related audits
    affiliateId: v.optional(v.id("affiliates")),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_entity", ["tenantId", "entityType"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"])
    // Index for security events by action type
    .index("by_action", ["action"])
    .index("by_affiliate", ["affiliateId"])
    // Index for tenant+affiliate filtering (Activity Log per-affiliate view)
    .index("by_tenant_affiliate", ["tenantId", "affiliateId"])
    // Index for user timeline: chronological events per actor (Story 15.4)
    // _creationTime is auto-appended by Convex to all indexes, so by_actor
    // already provides chronological ordering within each actorId.
    // Index for tenant+action filtering with time range (Story 15.4)
    // _creationTime auto-appended, enabling chronological ordering within tenant+action.
    .index("by_tenant_action_time", ["tenantId", "action"]),

  // Raw webhooks table for storing incoming webhook events
  // Story 7.5: Event Deduplication
  // The by_event_id index provides uniqueness enforcement for eventId
  // Deduplication is performed atomically via ensureEventNotProcessed mutation
  // which attempts insert and catches unique constraint violations
  rawWebhooks: defineTable({
    tenantId: v.optional(v.id("tenants")),
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    signatureValid: v.boolean(),
    status: v.string(),
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_event_id", ["eventId"])
    .index("by_status", ["status"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  emails: defineTable({
    tenantId: v.id("tenants"),
    type: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    status: v.string(),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // Email tracking fields (Story 10.6)
    broadcastId: v.optional(v.id("broadcastEmails")), // Link to broadcast for recipient queries
    affiliateId: v.optional(v.id("affiliates")), // Link to affiliate for name resolution
    resendMessageId: v.optional(v.string()), // Resend message ID for webhook matching
    // Multi-provider email support (PR: multi-provider-email-postmark)
    provider: v.optional(v.union(v.literal("resend"), v.literal("postmark"))),
    postmarkMessageId: v.optional(v.string()), // Postmark message ID for webhook matching
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
    complaintReason: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_recipient", ["recipientEmail"])
    .index("by_broadcast", ["broadcastId"]) // Recipient list queries (Story 10.6)
    .index("by_resend_message_id", ["resendMessageId"]) // Webhook matching (Story 10.6)
    .index("by_postmark_message_id", ["postmarkMessageId"]), // Postmark webhook matching

  // Broadcast emails table (Story 10.5)
  // Tracks broadcast email campaigns sent by SaaS Owners to all active affiliates
  broadcastEmails: defineTable({
    tenantId: v.id("tenants"),
    subject: v.string(),
    body: v.string(), // HTML or markdown content
    recipientCount: v.number(), // Total intended recipients
    sentCount: v.number(), // Successfully sent
    failedCount: v.number(), // Failed after retries
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("partial"),
      v.literal("failed")
    ),
    createdBy: v.id("users"), // SaaS Owner who sent it
    sentAt: v.optional(v.number()),
    // Aggregate tracking fields (Story 10.6)
    openedCount: v.optional(v.number()),
    clickedCount: v.optional(v.number()),
    bounceCount: v.optional(v.number()),
    complaintCount: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_sent_at", ["tenantId", "sentAt"]),

  // Email template customization table (Story 10.7)
  // Stores custom subject/body per tenant per template type for affiliate-facing emails
  emailTemplates: defineTable({
    tenantId: v.id("tenants"),
    templateType: v.string(), // "commission_confirmed", "payout_sent", "affiliate_welcome", etc.
    customSubject: v.string(),
    customBody: v.string(), // HTML content
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenant_and_type", ["tenantId", "templateType"]),

  // Platform email template customization (admin-only)
  // Stores custom subject/body per template type for platform billing emails sent to SaaS owners
  platformEmailTemplates: defineTable({
    templateType: v.string(),
    customSubject: v.string(),
    customBody: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_template_type", ["templateType"]),

  // Rate limiting for failed login attempts
  loginAttempts: defineTable({
    email: v.string(),
    ipAddress: v.optional(v.string()),
    failedAt: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_email", ["email"])
    .index("by_email_and_locked", ["email", "lockedUntil"]),

  // Circuit breaker state for external services (API Resilience Layer)
  // Tracks per-service failure state: closed → open → half-open → probing
  // See docs/scalability-guidelines.md Rule 6 for usage patterns
  circuitBreakers: defineTable({
    serviceId: v.string(),        // e.g. "postmark", "resend", "dns-google", "stripe"
    state: v.union(                // F17: discriminated union prevents typos like "opne"
      v.literal("closed"),
      v.literal("open"),
      v.literal("half-open"),
      v.literal("probing"),
    ),
    failureCount: v.number(),      // consecutive failures in current window
    lastFailureAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),        // when state went to "open"
    lastProbeAt: v.optional(v.number()),     // when last half-open probe ran
    config: v.object({                       // per-service overrides
      failureThreshold: v.optional(v.number()),
      resetTimeoutMs: v.optional(v.number()),
      maxOpenDurationMs: v.optional(v.number()),
    }),
  }).index("by_serviceId", ["serviceId"]),

  // Rate limiter state for API endpoints (API Resilience Layer)
  // Two-tier design: query for read check, mutation for increment
  // See docs/scalability-guidelines.md Rule 6 for usage patterns
  rateLimits: defineTable({
    key: v.string(),             // composite key: "endpoint:identifier" (e.g. "click:ABC123")
    count: v.number(),           // current count in window
    windowStart: v.number(),     // window start timestamp (ms)
    windowDurationMs: v.number(), // window duration (ms)
    expiresAt: v.number(),       // absolute expiry for cleanup cron
  }).index("by_key", ["key"])
    .index("by_expiresAt", ["expiresAt"]),

  // Performance metrics table (Story 6.6)
  performanceMetrics: defineTable({
    tenantId: v.optional(v.id("tenants")),
    metricType: v.string(), // "click_response_time", "conversion_response_time", "error_rate", etc.
    value: v.number(), // Response time in ms or count
    timestamp: v.number(),
    metadata: v.optional(v.object({
      endpoint: v.optional(v.string()),
      statusCode: v.optional(v.number()),
      errorType: v.optional(v.string()),
      responseTime: v.optional(v.number()),
    })),
  }).index("by_tenant", ["tenantId"])
    .index("by_type", ["metricType"])
    .index("by_type_and_time", ["metricType", "timestamp"]),

  // Admin notes table (Story 11.2)
  // Platform Admin notes about tenants for internal visibility
  adminNotes: defineTable({
    tenantId: v.id("tenants"),
    authorId: v.id("users"),
    content: v.string(),
  }).index("by_tenant", ["tenantId"]),

  // Impersonation sessions table (Story 11.3)
  // Platform Admin impersonation sessions with full audit trail
  impersonationSessions: defineTable({
    adminId: v.id("users"),
    targetTenantId: v.id("tenants"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    mutationsPerformed: v.array(v.object({
      action: v.string(),
      timestamp: v.number(),
      details: v.optional(v.string()),
    })),
    ipAddress: v.optional(v.string()),
  }).index("by_admin", ["adminId"])
    .index("by_tenant", ["targetTenantId"])
    .index("active_by_admin", ["adminId", "endedAt"]),

  // Performance alerting configuration (Story 6.6)
  performanceAlertConfig: defineTable({
    tenantId: v.optional(v.id("tenants")),
    alertType: v.string(), // "error_rate", "response_time_p99", "timeout_rate"
    threshold: v.number(), // Threshold value (e.g., 0.01 for 1%)
    enabled: v.boolean(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  }).index("by_tenant", ["tenantId"])
    .index("by_alert_type", ["alertType"])
    .index("by_tenant_and_alert_type", ["tenantId", "alertType"]),

  // Tier overrides table (Story 11.5)
  // Platform Admin overrides for tenant tier limits (enterprise exceptions)
  tierOverrides: defineTable({
    tenantId: v.id("tenants"),
    adminId: v.id("users"), // Admin who created the override
    overrides: v.object({
      maxAffiliates: v.optional(v.number()),
      maxCampaigns: v.optional(v.number()),
      maxTeamMembers: v.optional(v.number()),
      maxPayoutsPerMonth: v.optional(v.number()),
    }),
    reason: v.string(), // Required explanation for audit compliance
    expiresAt: v.optional(v.number()), // Optional expiration timestamp (ms)
    createdAt: v.number(), // Creation timestamp (ms)
    removedAt: v.optional(v.number()), // When override was removed/expired (ms)
    removedBy: v.optional(v.id("users")), // Admin who removed it
    removalReason: v.optional(v.string()), // "expired", "manual_removal"
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_active", ["tenantId", "removedAt"]),

  // Denormalized tenant statistics for dashboard performance
  // See docs/denormalized-counters.md for full documentation
  tenantStats: defineTable({
    tenantId: v.id("tenants"),
    // Affiliate counters
    affiliatesPending: v.number(),
    affiliatesActive: v.number(),
    affiliatesSuspended: v.number(),
    affiliatesRejected: v.number(),
    // Commission counters
    commissionsPendingCount: v.number(),
    commissionsPendingValue: v.number(),
    commissionsConfirmedThisMonth: v.number(),
    commissionsConfirmedValueThisMonth: v.number(),
    commissionsReversedThisMonth: v.number(),
    commissionsReversedValueThisMonth: v.number(),
    commissionsFlagged: v.number(),
    // Payout counter
    totalPaidOut: v.number(),
    // Pending payout totals (confirmed commissions awaiting payment — non-monthly)
    pendingPayoutTotal: v.optional(v.number()),
    pendingPayoutCount: v.optional(v.number()),
    // Month tracking
    currentMonthStart: v.number(),
    // Last month counters (copied from *ThisMonth on month boundary)
    commissionsConfirmedLastMonth: v.optional(v.number()),
    commissionsConfirmedValueLastMonth: v.optional(v.number()),
    totalClicksLastMonth: v.optional(v.number()),
    totalConversionsLastMonth: v.optional(v.number()),
    // Rolling 3-month counters
    commissionsConfirmedLast3Months: v.optional(v.number()),
    commissionsConfirmedValueLast3Months: v.optional(v.number()),
    totalClicksLast3Months: v.optional(v.number()),
    totalConversionsLast3Months: v.optional(v.number()),
    // Current month click/conversion counters
    totalClicksThisMonth: v.optional(v.number()),
    totalConversionsThisMonth: v.optional(v.number()),
    // Organic conversion counters (sales with no affiliate attribution)
    organicConversionsThisMonth: v.optional(v.number()),
    organicConversionsLastMonth: v.optional(v.number()),
    organicConversionsLast3Months: v.optional(v.number()),
    // Last month lead counters (copied from leadsCreatedThisMonth on month boundary)
    leadsCreatedLastMonth: v.optional(v.number()),
    // Current month API call counter (for tier limit enforcement)
    apiCallsThisMonth: v.optional(v.number()),
    // Referral lead counters (universal billing provider integration)
    leadsCreatedThisMonth: v.optional(v.number()),
    leadsConvertedThisMonth: v.optional(v.number()),
    // Staleness detection for admin dashboard (admin-reports-query-builder)
    lastSyncedAt: v.optional(v.number()),
    // API Resilience Layer — degradation counters (backward compatible via v.optional)
    degradationCount: v.optional(v.number()),
    lastDegradedAt: v.optional(v.number()),
    circuitBreakerTrips: v.optional(v.number()),
  }).index("by_tenant", ["tenantId"]),

  // Saved queries for Query Builder (custom reports)
  // Stores user-created report configurations for reuse and sharing
  savedQueries: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.optional(v.string()),
    queryConfig: v.string(), // JSON-serialized query configuration
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    isShared: v.boolean(), // Whether query is shared with team
    sharedWithRoles: v.array(v.string()), // Roles that can view: ["owner", "manager"]
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_created_by", ["tenantId", "createdBy"])
    .index("by_tenant_and_shared", ["tenantId", "isShared"]),

  // Query Builder async export tracking
  queryExports: defineTable({
    tenantId: v.id("tenants"),
    createdBy: v.id("users"),
    storageFileId: v.id("_storage"),
    fileName: v.string(),
    totalRows: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    expiresAt: v.number(), // Auto-expire after 7 days
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_expires_at", ["expiresAt"]),

  // In-app notifications table
  // Centralized notification system for all platform events
  // See docs/billing-lifecycle-enforcement-notifications.md for event catalog
  notifications: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.string(), // Category.type key, e.g. "billing.past_due"
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
    expiresAt: v.optional(v.number()), // 90 days from creation
    metadata: v.optional(v.any()),
    aggregatedCount: v.number(), // Number of aggregated events (default 1)
    aggregationDate: v.optional(v.number()), // UTC day boundary for grouping
  }).index("by_user_created", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_tenant", ["tenantId"]),

  // Platform-wide settings (singleton document keyed by "platform")
  // Configurable by Platform Admin — no code deploy needed to change defaults
  platformSettings: defineTable({
    key: v.string(),                  // Singleton key: "platform"
    defaultTrialDays: v.number(),     // Free trial duration in days (default: 14)
    enabledPlatformProviders: v.optional(v.array(v.union(
      v.literal("stripe"),
      v.literal("saligpay"),
    ))),
    stripePriceIds: v.optional(v.record(v.string(), v.string())), // plan name → Stripe Price ID
  }).index("by_key", ["key"]),

  // Materialized tenant leaderboard for platform analytics.
  // Rebuilt every 5 minutes by refreshPlatformStats cron.
  // Enables true global sort + cursor-based pagination without N+1 aggregate queries.
  // Admin-only access via requireAdmin(ctx).
  tenantLeaderboard: defineTable({
    tenantId: v.id("tenants"),
    tenantName: v.string(),
    plan: v.string(),
    status: v.string(),
    affiliatesActive: v.number(),
    commissionsConfirmedThisMonth: v.number(),
    totalClicksThisMonth: v.number(),
    totalConversionsThisMonth: v.number(),
    commissionsFlagged: v.number(),
    computedAt: v.number(),
  }).index("by_tenant", ["tenantId"]),

  // Pre-aggregated platform-wide KPIs (singleton document keyed by "platform")
  // Recalculated every 5 minutes by refreshPlatformStats cron from aggregates.
  // Admin-only access via requireAdmin(ctx)
  platformStats: defineTable({
    key: v.string(),
    totalMRR: v.number(),
    totalActiveAffiliates: v.number(),
    totalCommissions: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalFraudSignals: v.number(),
    activeTenantCount: v.number(),
    totalPendingCommissions: v.number(),
    totalApprovedCommissions: v.number(),
    totalPaidOut: v.number(),
    lastUpdatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Admin-only saved queries for Admin Query Builder
  // No tenantId — queries span all tenants
  adminSavedQueries: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    queryConfig: v.string(), // JSON-serialized query configuration
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_created_by", ["createdBy"])
    .index("by_name_and_creator", ["name", "createdBy"]),

  // Admin Query Builder export tracking
  // Unlike tenant queryExports, this table is actually written to by export actions
  adminQueryExports: defineTable({
    createdBy: v.id("users"),
    storageFileId: v.id("_storage"),
    fileName: v.string(),
    totalRows: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_created_by", ["createdBy"])
    .index("by_expires_at", ["expiresAt"]),

  cronConfigs: defineTable({
    name: v.string(),
    handlerRef: v.string(),
    enabled: v.boolean(),
    intervalHours: v.number(),
    description: v.string(),
    lastFinishedAt: v.optional(v.number()),
    lastScheduledAt: v.optional(v.number()),
    extraArgs: v.optional(v.any()),
  }).index("by_name", ["name"]),

  cronExecutions: defineTable({
    jobName: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    finishedAt: v.number(),
    durationMs: v.number(),
    resultSummary: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("by_jobName_and_startedAt", ["jobName", "startedAt"])
    .index("by_status_and_startedAt", ["status", "startedAt"])
    .index("by_startedAt", ["startedAt"]),
});