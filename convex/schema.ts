import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Task 2: Core Tables
  tenants: defineTable({
    name: v.string(),
    slug: v.string(),
    plan: v.string(),
    trialEndsAt: v.optional(v.number()),
    saligPayCredentials: v.optional(v.object({
      clientId: v.string(),
      clientSecret: v.string(),
    })),
    branding: v.optional(v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      portalName: v.optional(v.string()),
    })),
    status: v.string(),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.string(),
    permissionOverrides: v.optional(v.object({
      canManageAffiliates: v.boolean(),
      canManageCampaigns: v.boolean(),
      canViewCommissions: v.boolean(),
    })),
    authId: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_email", ["tenantId", "email"])
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
  }).index("by_tier", ["tier"]),

  // Task 3: Campaign & Affiliate Tables
  campaigns: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.optional(v.string()),
    commissionType: v.string(),
    commissionValue: v.number(),
    recurringCommission: v.boolean(),
    recurringRate: v.optional(v.number()),
    approvalThreshold: v.optional(v.number()),
    status: v.string(),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  affiliates: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.string(),
    uniqueCode: v.string(),
    status: v.string(),
    passwordHash: v.optional(v.string()),
    payoutMethod: v.optional(v.object({
      type: v.string(),
      details: v.string(),
    })),
    fraudSignals: v.optional(v.array(v.object({
      type: v.string(),
      severity: v.string(),
      timestamp: v.number(),
      details: v.optional(v.string()),
    }))),
    commissionOverride: v.optional(v.object({
      campaignId: v.id("campaigns"),
      rate: v.number(),
    })),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_email", ["tenantId", "email"])
    .index("by_tenant_and_code", ["tenantId", "uniqueCode"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

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
    vanitySlug: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_code", ["code"])
    .index("by_vanity_slug", ["vanitySlug"]),

  // Task 4: Tracking Tables
  clicks: defineTable({
    tenantId: v.id("tenants"),
    referralLinkId: v.id("referralLinks"),
    affiliateId: v.id("affiliates"),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    referrer: v.optional(v.string()),
    dedupeKey: v.string(),
  }).index("by_tenant", ["tenantId"])
    .index("by_referral_link", ["referralLinkId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_dedupe_key", ["dedupeKey"]),

  conversions: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    referralLinkId: v.id("referralLinks"),
    clickId: v.id("clicks"),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    metadata: v.optional(v.object({
      orderId: v.optional(v.string()),
      products: v.optional(v.array(v.string())),
    })),
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_click", ["clickId"]),

  // Task 5: Commission & Payout Tables
  commissions: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    conversionId: v.optional(v.id("conversions")),
    amount: v.number(),
    status: v.string(),
    eventMetadata: v.optional(v.object({
      source: v.string(),
      transactionId: v.optional(v.string()),
      timestamp: v.number(),
    })),
    reversalReason: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_affiliate", ["affiliateId"])
    .index("by_campaign", ["campaignId"])
    .index("by_conversion", ["conversionId"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  payouts: defineTable({
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    batchId: v.id("payoutBatches"),
    amount: v.number(),
    status: v.string(),
    paymentReference: v.optional(v.string()),
    paidAt: v.optional(v.number()),
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
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"]),

  // Task 6: System Tables
  auditLogs: defineTable({
    tenantId: v.optional(v.id("tenants")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actorId: v.optional(v.string()),
    actorType: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    metadata: v.optional(v.object({
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      // Security audit fields
      attemptedTenantId: v.optional(v.id("tenants")),
      securityEvent: v.optional(v.boolean()),
      crossTenantAttempt: v.optional(v.boolean()),
      additionalInfo: v.optional(v.string()),
    })),
  }).index("by_tenant", ["tenantId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"])
    // Index for security events by action type
    .index("by_action", ["action"]),

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
    .index("by_status", ["status"]),

  emails: defineTable({
    tenantId: v.id("tenants"),
    type: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    status: v.string(),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"])
    .index("by_tenant_and_status", ["tenantId", "status"])
    .index("by_recipient", ["recipientEmail"]),

  // Rate limiting for failed login attempts
  loginAttempts: defineTable({
    email: v.string(),
    ipAddress: v.optional(v.string()),
    failedAt: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_email", ["email"])
    .index("by_email_and_locked", ["email", "lockedUntil"]),
});