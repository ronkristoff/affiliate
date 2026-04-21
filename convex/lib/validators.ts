import { v } from "convex/values";

// =============================================================================
// Shared Return Validators
// =============================================================================
//
// When adding/removing a field from a table in schema.ts, update the
// corresponding validator HERE. All queries that return full documents
// from that table should import from this file.
//
// See AGENTS.md "Schema Change Checklist" for the full workflow.
// =============================================================================

// ── users ────────────────────────────────────────────────────────────────────

export const userFields = {
  _id: v.id("users"),
  _creationTime: v.number(),
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
  notificationUnreadCount: v.optional(v.number()),
} as const;

export const userValidator = v.object(userFields);

export const userArrayValidator = v.array(userValidator);

// ── tenants ──────────────────────────────────────────────────────────────────

export const tenantPublicFields = {
  _id: v.id("tenants"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  domain: v.string(),
  plan: v.string(),
  status: v.string(),
  trackingVerifiedAt: v.optional(v.number()),
} as const;

export const tenantPublicValidator = v.object(tenantPublicFields);

// ── commissions ──────────────────────────────────────────────────────────────

export const commissionFields = {
  _id: v.id("commissions"),
  _creationTime: v.number(),
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
    subscriptionId: v.optional(v.string()),
  })),
  reversalReason: v.optional(v.string()),
  transactionId: v.optional(v.string()),
  batchId: v.optional(v.id("payoutBatches")),
  isSelfReferral: v.optional(v.boolean()),
  fraudIndicators: v.optional(v.array(v.string())),
} as const;

export const commissionValidator = v.object(commissionFields);

export const commissionArrayValidator = v.array(commissionValidator);

export const commissionEnrichedFields = {
  ...commissionFields,
  affiliateName: v.string(),
  affiliateEmail: v.string(),
  campaignName: v.string(),
  customerEmail: v.optional(v.string()),
  planEvent: v.string(),
} as const;

export const commissionEnrichedValidator = v.object(commissionEnrichedFields);

export const commissionEnrichedArrayValidator = v.array(commissionEnrichedValidator);

// ── campaigns ────────────────────────────────────────────────────────────────

export const campaignPublicFields = {
  _id: v.id("campaigns"),
  _creationTime: v.number(),
  tenantId: v.id("tenants"),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  commissionType: v.string(),
  commissionRate: v.number(),
  cookieDuration: v.optional(v.number()),
  recurringCommissions: v.optional(v.boolean()),
  recurringRate: v.optional(v.number()),
  recurringRateType: v.optional(v.string()),
  autoApproveCommissions: v.optional(v.boolean()),
  approvalThreshold: v.optional(v.number()),
  status: v.string(),
} as const;

export const campaignPublicValidator = v.object(campaignPublicFields);

// ── affiliates ───────────────────────────────────────────────────────────────

export const affiliateFields = {
  _id: v.id("affiliates"),
  _creationTime: v.number(),
  tenantId: v.id("tenants"),
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  name: v.string(),
  uniqueCode: v.string(),
  status: v.string(),
  vanitySlug: v.optional(v.string()),
  promotionChannel: v.optional(v.string()),
  note: v.optional(v.string()),
  payoutMethod: v.optional(v.object({
    type: v.string(),
    details: v.string(),
  })),
  payoutMethodLastDigits: v.optional(v.string()),
  payoutMethodProcessorId: v.optional(v.string()),
  fraudSignals: v.optional(v.array(v.object({
    type: v.string(),
    severity: v.string(),
    timestamp: v.number(),
    details: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    commissionId: v.optional(v.id("commissions")),
    signalId: v.optional(v.string()),
  }))),
  commissionOverrides: v.optional(v.array(v.object({
    campaignId: v.id("campaigns"),
    rate: v.number(),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("paused"),
    )),
  }))),
  couponCode: v.optional(v.string()),
  couponAttributionEnabled: v.optional(v.boolean()),
  defaultCouponCampaignId: v.optional(v.id("campaigns")),
  payoutProviderType: v.optional(v.string()),
  payoutProviderAccountId: v.optional(v.string()),
  payoutProviderEnabled: v.optional(v.boolean()),
  payoutProviderStatus: v.optional(v.string()),
  payoutProviderStatusDetails: v.optional(v.any()),
} as const;

export const affiliateValidator = v.object(affiliateFields);

// ── teamInvitations ──────────────────────────────────────────────────────────

export const teamInvitationFields = {
  _id: v.id("teamInvitations"),
  _creationTime: v.number(),
  tenantId: v.id("tenants"),
  email: v.string(),
  role: v.string(),
  token: v.string(),
  expiresAt: v.number(),
  acceptedAt: v.optional(v.number()),
} as const;

export const teamInvitationValidator = v.object(teamInvitationFields);

export const teamInvitationArrayValidator = v.array(teamInvitationValidator);

// ── notifications ────────────────────────────────────────────────────────────

export const notificationFields = {
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
} as const;

export const notificationValidator = v.object(notificationFields);

export const notificationArrayValidator = v.array(notificationValidator);
