import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { BillingEvent } from "./webhooks";

/**
 * Commission Engine - Payment Updated Event Processing
 * 
 * Story 7.1: Process payment.updated billing events and create commission records
 * for attributed affiliates.
 * 
 * Story 7.3: Failed/Pending Payment Rejection
 * - Reject commission creation for FAILED payment status
 * - Reject commission creation for PENDING payment status
 * - Create audit trail for all rejection decisions
 */

// =============================================================================
// STORY 7.3: Payment Status Constants
// =============================================================================

/**
 * Valid confirmed payment statuses that can generate commissions
 * Export for use by other modules
 */
export const CONFIRMED_PAYMENT_STATUSES = ["paid", "completed"] as const;

/**
 * Payment rejection reasons with specific messages
 * Export for use by other modules
 */
export const PAYMENT_REJECTION_REASONS = {
  FAILED: "Payment failed",
  PENDING: "Payment pending confirmation",
  UNKNOWN: (status: string) => `Payment status '${status}' not confirmed`,
} as const;

/**
 * Audit actions for payment rejection events
 * Export for use by other modules
 */
export const PAYMENT_REJECTION_AUDIT_ACTIONS = {
  FAILED: "commission_rejected_payment_failed",
  PENDING: "commission_rejected_payment_pending",
  UNKNOWN: "commission_rejected_payment_unknown",
} as const;

/**
 * Helper function to log payment rejection with audit trail (Story 7.3)
 * Used for consistent rejection logging across all payment processors
 */
async function logPaymentRejection(
  ctx: any,
  args: {
    webhookId: Id<"rawWebhooks">;
    tenantId: Id<"tenants">;
    paymentId: string;
    paymentStatus: string;
    paymentAmount: number;
    currency: string;
    eventId: string;
  }
): Promise<void> {
  let rejectionReason: string;
  let auditAction: string;
  
  if (args.paymentStatus === "failed") {
    rejectionReason = PAYMENT_REJECTION_REASONS.FAILED;
    auditAction = PAYMENT_REJECTION_AUDIT_ACTIONS.FAILED;
  } else if (args.paymentStatus === "pending") {
    rejectionReason = PAYMENT_REJECTION_REASONS.PENDING;
    auditAction = PAYMENT_REJECTION_AUDIT_ACTIONS.PENDING;
  } else {
    rejectionReason = PAYMENT_REJECTION_REASONS.UNKNOWN(args.paymentStatus);
    auditAction = PAYMENT_REJECTION_AUDIT_ACTIONS.UNKNOWN;
  }
  
  // Update webhook status with rejection reason (status = "processed" not "failed")
  await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
    webhookId: args.webhookId,
    status: "processed",
    errorMessage: rejectionReason,
  });
  
  // Create audit log entry
  await ctx.runMutation(internal.audit.logAuditEventInternal, {
    tenantId: args.tenantId,
    action: auditAction,
    entityType: "payment",
    entityId: args.paymentId,
    actorType: "system",
    metadata: {
      paymentStatus: args.paymentStatus,
      paymentAmount: args.paymentAmount,
      currency: args.currency,
      eventId: args.eventId,
      rejectionReason,
    },
  });
}

/**
 * Result type for processPaymentUpdatedToCommission
 */
interface PaymentUpdatedResult {
  conversionId: Id<"conversions"> | null;
  commissionId: Id<"commissions"> | null;
  processed: boolean;
  organic: boolean;
}

/**
 * Result type for subscription event processing
 */
interface SubscriptionEventResult {
  conversionId: Id<"conversions"> | null;
  commissionId: Id<"commissions"> | null;
  processed: boolean;
  organic: boolean;
}

/**
 * Internal action to process payment.updated webhook event and create commission.
 * This is the main entry point for Story 7.1 - called after webhook is received
 * and normalized to BillingEvent format.
 */
export const processPaymentUpdatedToCommission = internalAction({
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
        couponCode: v.optional(v.string()),
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
  returns: v.object({
    conversionId: v.union(v.id("conversions"), v.null()),
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    organic: v.boolean(),
  }),
  handler: async (ctx, args): Promise<PaymentUpdatedResult> => {
    const event: BillingEvent = args.billingEvent as BillingEvent;
    const rawWebhookId = args.webhookId;

    // Note: Raw webhook deduplication is now handled at HTTP handler level (Story 7.5)
    // Commission-level idempotency is maintained via findCommissionByTransactionIdInternal in createCommissionFromConversionInternal

    // AC #1: Normalize event to BillingEvent format (already done by caller)
    // AC #2: Handle no-attribution case — try coupon first, then lead matching
    let webhookAttributionSource: "webhook" | "coupon" | "lead_email" = "webhook";
    if (!event.attribution?.affiliateCode) {
      // Attribution Resilience: Check for coupon code in metadata BEFORE lead matching
      const rawPayload = JSON.parse(event.rawPayload);
      const couponCode = rawPayload.data?.object?.metadata?._salig_aff_coupon_code || event.attribution?.couponCode;

      if (couponCode && event.tenantId) {
        const couponValidation = await ctx.runQuery(api.couponCodes.validateCouponCode, {
          tenantId: event.tenantId as Id<"tenants">,
          couponCode,
        });
        if (couponValidation) {
          event.attribution = {
            affiliateCode: couponValidation.affiliateName, // Will be resolved by affiliate lookup
            clickId: couponValidation.referralLinkId as any,
          };
          webhookAttributionSource = "coupon";
          console.log(`Webhook ${event.eventId}: Attribution resolved via coupon code ${couponCode}`);
        }
      }

      // Attempt email-based lead matching (universal billing provider integration)
      if (!event.attribution?.affiliateCode && event.payment.customerEmail && event.tenantId) {
        const leadAttribution = await ctx.runQuery(internal.referralLeads.resolveLeadAttribution, {
          tenantId: event.tenantId as Id<"tenants">,
          email: event.payment.customerEmail,
        });
        if (leadAttribution) {
          event.attribution = {
            affiliateCode: leadAttribution.affiliateCode,
            clickId: leadAttribution.clickId ?? undefined,
          };
          webhookAttributionSource = "lead_email";
          console.log(`Webhook ${event.eventId}: Attribution resolved via lead matching for ${event.payment.customerEmail}`);
        }
      }

      // If still no attribution after coupon + lead matching, create organic conversion
      if (!event.attribution?.affiliateCode) {
        console.log(`Webhook ${event.eventId}: No attribution data, logging as organic`);

        // Create organic conversion
        const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
          tenantId: event.tenantId as Id<"tenants">,
          customerEmail: event.payment.customerEmail,
          amount: event.payment.amount / 100, // Convert from cents
          status: CONFIRMED_PAYMENT_STATUSES.includes(event.payment.status as any) ? "completed" : "pending",
          metadata: {
            orderId: event.payment.id,
          },
        });

        // Update webhook status
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "processed",
          errorMessage: "No attribution data - logged as organic",
        });

        return {
          conversionId,
          commissionId: null,
          processed: true,
          organic: true,
        };
      }
    } else if (event.attribution?.couponCode && event.tenantId) {
      // Attribution exists from cookie/body but coupon is also present — coupon wins (ADR-4)
      const couponValidation = await ctx.runQuery(api.couponCodes.validateCouponCode, {
        tenantId: event.tenantId as Id<"tenants">,
        couponCode: event.attribution.couponCode,
      });
      if (couponValidation) {
        event.attribution = {
          affiliateCode: couponValidation.affiliateName,
          clickId: couponValidation.referralLinkId as any,
        };
        webhookAttributionSource = "coupon";
        console.log(`Webhook ${event.eventId}: Coupon code overrides cookie/body attribution`);
      }
    }

    // AC #5: Validate affiliate status - get affiliate by code
    const affiliate: { _id: Id<"affiliates">; status: string; uniqueCode: string } | null = await ctx.runQuery(internal.conversions.findAffiliateByCodeInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      code: event.attribution.affiliateCode!,
    });

    // AC #5: If affiliate is invalid or inactive, create organic conversion
    if (!affiliate || affiliate.status !== "active") {
      const invalidReason = !affiliate ? "Invalid affiliate code" : `Affiliate status is ${affiliate.status}`;
      console.log(`Webhook ${event.eventId}: ${invalidReason}, creating organic conversion`);

      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId: event.tenantId as Id<"tenants">,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / 100,
        status: CONFIRMED_PAYMENT_STATUSES.includes(event.payment.status as any) ? "completed" : "pending",
        metadata: {
          orderId: event.payment.id,
        },
      });

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: `${invalidReason} - created organic conversion`,
      });

      return {
        conversionId,
        commissionId: null,
        processed: true,
        organic: true,
      };
    }

    // STORY 7.3: Explicit payment status validation with rejection logging
    // Only create conversions for confirmed payment statuses
    const paymentStatus = event.payment.status;
    const isConfirmedStatus = CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus as any);

    if (!isConfirmedStatus) {
      console.log(`Webhook ${event.eventId}: Payment status is ${paymentStatus}, rejecting commission creation`);

      // Use helper function for consistent rejection logging with audit trail
      await logPaymentRejection(ctx, {
        webhookId: rawWebhookId,
        tenantId: event.tenantId as Id<"tenants">,
        paymentId: event.payment.id,
        paymentStatus,
        paymentAmount: event.payment.amount,
        currency: event.payment.currency,
        eventId: event.eventId,
      });

      return {
        conversionId: null,
        commissionId: null,
        processed: true,
        organic: false,
      };
    }

    // For coupon-attributed conversions, validate coupon and get campaign directly
    if (webhookAttributionSource === "coupon" && event.attribution?.couponCode && event.tenantId) {
      const couponResult = await ctx.runQuery(api.couponCodes.validateCouponCode, {
        tenantId: event.tenantId as Id<"tenants">,
        couponCode: event.attribution.couponCode,
      });

      if (couponResult) {
        const parsedPayload = JSON.parse(event.rawPayload);
        const products = parsedPayload.data?.object?.metadata?._salig_aff_products || undefined;

        const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
          tenantId: event.tenantId as Id<"tenants">,
          affiliateId: couponResult.affiliateId,
          referralLinkId: couponResult.referralLinkId,
          clickId: undefined,
          campaignId: couponResult.campaignId,
          customerEmail: event.payment.customerEmail,
          amount: event.payment.amount / 100,
          status: "completed",
          attributionSource: "coupon",
          couponCode: event.attribution.couponCode,
          metadata: {
            orderId: event.payment.id,
            products,
          },
        });

        let commissionId: Id<"commissions"> | null = null;
        if (conversionId) {
          commissionId = await ctx.runMutation(internal.commissions.createCommissionFromConversionInternal, {
            tenantId: event.tenantId as Id<"tenants">,
            affiliateId: couponResult.affiliateId,
            campaignId: couponResult.campaignId,
            conversionId,
            saleAmount: event.payment.amount / 100,
            eventMetadata: {
              source: "webhook",
              transactionId: event.payment.id,
              timestamp: event.timestamp,
            },
          });
        }

        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "processed",
        });

        return {
          conversionId,
          commissionId,
          processed: true,
          organic: false,
        };
      }
    }

    // Get referral link for attribution chain (non-coupon path)
    const referralLink: { _id: Id<"referralLinks">; affiliateId: Id<"affiliates">; campaignId?: Id<"campaigns"> } | null = await ctx.runQuery(internal.conversions.getReferralLinkByCodeInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      code: event.attribution.affiliateCode!,
    });

    if (!referralLink) {
      console.log(`Webhook ${event.eventId}: Referral link not found, creating organic conversion`);

      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId: event.tenantId as Id<"tenants">,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / 100,
        status: "completed",
        metadata: {
          orderId: event.payment.id,
        },
      });

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "Referral link not found - created organic conversion",
      });

      return {
        conversionId,
        commissionId: null,
        processed: true,
        organic: true,
      };
    }

    // Find recent click for attribution chain
    const recentClick: { _id: Id<"clicks">; referralLinkId: Id<"referralLinks"> } | null = await ctx.runQuery(internal.conversions.findRecentClickInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      affiliateId: affiliate._id,
      campaignId: referralLink.campaignId,
    });

    // Parse products from metadata if available
    const convPayload = JSON.parse(event.rawPayload);
    const products = convPayload.data?.object?.metadata?._salig_aff_products || undefined;

    // Create conversion with correct attribution source
    const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
      tenantId: event.tenantId as Id<"tenants">,
      affiliateId: affiliate._id,
      referralLinkId: referralLink._id,
      clickId: event.attribution.clickId ? (event.attribution.clickId as Id<"clicks">) : (recentClick?._id),
      campaignId: referralLink.campaignId,
      customerEmail: event.payment.customerEmail,
      amount: event.payment.amount / 100, // Convert from cents
      status: "completed",
      attributionSource: webhookAttributionSource,
      metadata: {
        orderId: event.payment.id,
        products,
      },
    });

    // Story 7.1 Integration Point: Create commission from conversion
    // This is the NEW functionality for Story 7.1
    let commissionId: Id<"commissions"> | null = null;

    if (conversionId && referralLink.campaignId) {
      console.log(`Webhook ${event.eventId}: Creating commission for conversion ${conversionId}`);

      commissionId = await ctx.runMutation(internal.commissions.createCommissionFromConversionInternal, {
        tenantId: event.tenantId as Id<"tenants">,
        affiliateId: affiliate._id,
        campaignId: referralLink.campaignId,
        conversionId,
        saleAmount: event.payment.amount / 100, // Convert from cents
        eventMetadata: {
          source: "webhook",
          transactionId: event.payment.id,
          timestamp: event.timestamp,
        },
      });
    }

    // Update webhook status to processed
    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: rawWebhookId,
      status: "processed",
    });

    return {
      conversionId,
      commissionId,
      processed: true,
      organic: false,
    };
  },
});

/**
 * Internal action to process subscription.created webhook event
 * Creates conversion and initial commission if payment is paid
 */
export const processSubscriptionCreatedEvent = internalAction({
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
        couponCode: v.optional(v.string()),
      })),
      payment: v.object({
        id: v.string(),
        amount: v.number(),
        currency: v.string(),
        status: v.string(),
        customerEmail: v.optional(v.string()),
      }),
      subscription: v.optional(v.object({
        id: v.string(),
        status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due")),
        planId: v.optional(v.string()),
      })),
      rawPayload: v.string(),
    }),
  },
  returns: v.object({
    conversionId: v.union(v.id("conversions"), v.null()),
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    organic: v.boolean(),
  }),
  handler: async (ctx, args): Promise<SubscriptionEventResult> => {
    const event = args.billingEvent as BillingEvent;
    const rawWebhookId = args.webhookId;

    // Note: Raw webhook deduplication is now handled at HTTP handler level (Story 7.5)
    // Commission-level idempotency is maintained via findCommissionByTransactionIdInternal in createCommissionFromConversionInternal

    // AC #6: Handle no-attribution case — try coupon first, then lead matching
    let subAttributionSource: "webhook" | "coupon" | "lead_email" = "webhook";
    if (!event.attribution?.affiliateCode) {
      // Attribution Resilience: Check for coupon code first
      const subRawPayload = JSON.parse(event.rawPayload);
      const subCouponCode = subRawPayload.data?.object?.metadata?._salig_aff_coupon_code || event.attribution?.couponCode;

      if (subCouponCode && event.tenantId) {
        const subCouponValidation = await ctx.runQuery(api.couponCodes.validateCouponCode, {
          tenantId: event.tenantId as Id<"tenants">,
          couponCode: subCouponCode,
        });
        if (subCouponValidation) {
          event.attribution = {
            affiliateCode: subCouponValidation.affiliateName,
            clickId: subCouponValidation.referralLinkId as any,
            couponCode: subCouponCode,
          };
          subAttributionSource = "coupon";
          console.log(`Webhook ${event.eventId}: Attribution resolved via coupon code ${subCouponCode}`);
        }
      }

      // Attempt email-based lead matching
      if (!event.attribution?.affiliateCode && event.payment.customerEmail && event.tenantId) {
        const leadAttribution = await ctx.runQuery(internal.referralLeads.resolveLeadAttribution, {
          tenantId: event.tenantId as Id<"tenants">,
          email: event.payment.customerEmail,
        });
        if (leadAttribution) {
          event.attribution = {
            affiliateCode: leadAttribution.affiliateCode,
            clickId: leadAttribution.clickId ?? undefined,
          };
          subAttributionSource = "lead_email";
          console.log(`Webhook ${event.eventId}: Attribution resolved via lead matching for ${event.payment.customerEmail}`);
        }
      }

      if (!event.attribution?.affiliateCode) {
        console.log(`Webhook ${event.eventId}: No attribution data, logging as organic`);

        // Create organic conversion
        const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
          tenantId: event.tenantId as Id<"tenants">,
          customerEmail: event.payment.customerEmail,
          amount: event.payment.amount / 100,
          status: event.payment.status === "paid" ? "completed" : "pending",
          metadata: {
            orderId: event.payment.id,
            subscriptionId: event.subscription?.id,
            planId: event.subscription?.planId,
          },
        });

        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "processed",
          errorMessage: "No attribution data - logged as organic",
        });

        return {
          conversionId,
          commissionId: null,
          processed: true,
          organic: true,
        };
      }
    }

    // Validate affiliate
    const affiliate: { _id: Id<"affiliates">; status: string } | null = await ctx.runQuery(internal.conversions.findAffiliateByCodeInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      code: event.attribution.affiliateCode,
    });

    if (!affiliate || affiliate.status !== "active") {
      const invalidReason = !affiliate ? "Invalid affiliate code" : `Affiliate status is ${affiliate.status}`;
      
      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId: event.tenantId as Id<"tenants">,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / 100,
        status: event.payment.status === "paid" ? "completed" : "pending",
        metadata: {
          orderId: event.payment.id,
          subscriptionId: event.subscription?.id,
          planId: event.subscription?.planId,
        },
      });

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: `${invalidReason} - created organic conversion`,
      });

      return {
        conversionId,
        commissionId: null,
        processed: true,
        organic: true,
      };
    }

    // STORY 7.3: Explicit payment status validation with rejection logging
    // Only create conversions for confirmed payment statuses
    const paymentStatus = event.payment.status;
    const isConfirmedStatus = CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus as any);

    if (!isConfirmedStatus) {
      console.log(`Webhook ${event.eventId}: Payment status is ${paymentStatus}, rejecting commission creation`);

      // Use helper function for consistent rejection logging with audit trail
      await logPaymentRejection(ctx, {
        webhookId: rawWebhookId,
        tenantId: event.tenantId as Id<"tenants">,
        paymentId: event.payment.id,
        paymentStatus,
        paymentAmount: event.payment.amount,
        currency: event.payment.currency,
        eventId: event.eventId,
      });

      return {
        conversionId: null,
        commissionId: null,
        processed: true,
        organic: false,
      };
    }

    // Get referral link for attribution chain
    const referralLink: { _id: Id<"referralLinks">; affiliateId: Id<"affiliates">; campaignId?: Id<"campaigns"> } | null = await ctx.runQuery(internal.conversions.getReferralLinkByCodeInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      code: event.attribution.affiliateCode,
    });

    if (!referralLink) {
      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId: event.tenantId as Id<"tenants">,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / 100,
        status: CONFIRMED_PAYMENT_STATUSES.includes(event.payment.status as any) ? "completed" : "pending",
        metadata: {
          orderId: event.payment.id,
          subscriptionId: event.subscription?.id,
          planId: event.subscription?.planId,
        },
      });

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "Referral link not found - created organic conversion",
      });

      return {
        conversionId,
        commissionId: null,
        processed: true,
        organic: true,
      };
    }

    // Find recent click for attribution chain
    const recentClick: { _id: Id<"clicks">; referralLinkId: Id<"referralLinks"> } | null = await ctx.runQuery(internal.conversions.findRecentClickInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      affiliateId: affiliate._id,
      campaignId: referralLink.campaignId,
    });

    // Create conversion with subscription metadata
    const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
      tenantId: event.tenantId as Id<"tenants">,
      affiliateId: affiliate._id,
      referralLinkId: referralLink._id,
      clickId: event.attribution.clickId ? (event.attribution.clickId as Id<"clicks">) : (recentClick?._id),
      campaignId: referralLink.campaignId,
      customerEmail: event.payment.customerEmail,
      amount: event.payment.amount / 100,
      status: "completed",
      attributionSource: subAttributionSource,
      metadata: {
        orderId: event.payment.id,
        subscriptionId: event.subscription?.id,
        planId: event.subscription?.planId,
        subscriptionStatus: event.subscription?.status,
      },
    });

    // Create commission if campaign exists and payment is confirmed (paid or completed)
    let commissionId: Id<"commissions"> | null = null;

    if (conversionId && referralLink.campaignId && CONFIRMED_PAYMENT_STATUSES.includes(event.payment.status as any)) {
      console.log(`Webhook ${event.eventId}: Creating initial commission for subscription creation`);
      
      commissionId = await ctx.runMutation(internal.commissions.createCommissionFromConversionInternal, {
        tenantId: event.tenantId as Id<"tenants">,
        affiliateId: affiliate._id,
        campaignId: referralLink.campaignId,
        conversionId,
        saleAmount: event.payment.amount / 100,
        eventMetadata: {
          source: "subscription.created",
          transactionId: event.payment.id,
          timestamp: event.timestamp,
          subscriptionId: event.subscription?.id,
        },
      });
    }

    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: rawWebhookId,
      status: "processed",
    });

    return {
      conversionId,
      commissionId,
      processed: true,
      organic: false,
    };
  },
});

/**
 * Helper function to detect subscription event subtype
 */
function detectSubscriptionChangeType(
  event: BillingEvent,
  previousSubscription?: { planId: string; amount: number }
): "renewal" | "upgrade" | "downgrade" {
  // If no previous subscription, this is a renewal (recurring payment)
  if (!previousSubscription) {
    return "renewal";
  }
  
  // Compare plan values to determine upgrade/downgrade
  const currentAmount = event.payment.amount;
  const previousAmount = previousSubscription.amount;
  
  if (currentAmount > previousAmount) {
    return "upgrade";
  } else if (currentAmount < previousAmount) {
    return "downgrade";
  }
  
  // Same amount = renewal
  return "renewal";
}

/**
 * Helper function to calculate recurring commission amount
 */
function calculateRecurringCommissionAmount(
  saleAmount: number,
  campaign: { recurringCommission: boolean; recurringRate?: number; recurringRateType?: string; commissionType: string; commissionValue: number }
): number {
  if (!campaign.recurringCommission) {
    return 0; // No commission for non-recurring campaigns
  }
  
  let rate: number;
  
  switch (campaign.recurringRateType) {
    case "same":
      rate = campaign.commissionValue;
      break;
    case "reduced":
      // Default reduced rate is 50% of initial
      rate = campaign.recurringRate ?? (campaign.commissionValue * 0.5);
      break;
    case "custom":
      rate = campaign.recurringRate ?? campaign.commissionValue;
      break;
    default:
      rate = campaign.commissionValue;
  }
  
  if (campaign.commissionType === "percentage") {
    return saleAmount * (rate / 100);
  } else {
    return rate; // flatFee
  }
}

/**
 * Helper function to adjust commission for plan changes
 */
async function adjustCommissionForPlanChange(
  ctx: any,
  args: {
    commissionId: Id<"commissions">;
    newAmount: number;
    adjustmentType: "upgrade" | "downgrade";
    tenantId: Id<"tenants">;
  }
): Promise<void> {
  const existingCommission = await ctx.db.get(args.commissionId);
  
  if (!existingCommission || existingCommission.status !== "pending") {
    // Only adjust pending commissions
    return;
  }
  
  const previousAmount = existingCommission.amount;
  
  // Update commission amount
  await ctx.db.patch(args.commissionId, {
    amount: args.newAmount,
  });
  
  // Create audit log
  await ctx.db.insert("auditLogs", {
    tenantId: args.tenantId,
    action: "commission_adjusted",
    entityType: "commission",
    entityId: args.commissionId,
    actorType: "system",
    previousValue: { amount: previousAmount },
    newValue: { amount: args.newAmount },
    metadata: {
      adjustmentType: args.adjustmentType,
    },
  });
}

/**
 * Internal action to process subscription.updated webhook event
 * Handles renewals, upgrades, and downgrades
 */
export const processSubscriptionUpdatedEvent = internalAction({
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
        couponCode: v.optional(v.string()),
      })),
      payment: v.object({
        id: v.string(),
        amount: v.number(),
        currency: v.string(),
        status: v.string(),
        customerEmail: v.optional(v.string()),
      }),
      subscription: v.optional(v.object({
        id: v.string(),
        status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due")),
        planId: v.optional(v.string()),
      })),
      rawPayload: v.string(),
    }),
  },
  returns: v.object({
    conversionId: v.union(v.id("conversions"), v.null()),
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    organic: v.boolean(),
    adjustmentType: v.union(v.literal("renewal"), v.literal("upgrade"), v.literal("downgrade"), v.null()),
  }),
  handler: async (ctx, args): Promise<SubscriptionEventResult & { adjustmentType: "renewal" | "upgrade" | "downgrade" | null }> => {
    const event = args.billingEvent as BillingEvent;
    const rawWebhookId = args.webhookId;

    // Note: Raw webhook deduplication is now handled at HTTP handler level (Story 7.5)
    // Commission-level idempotency is maintained via findCommissionByTransactionIdInternal in createCommissionFromConversionInternal

    // Handle no-attribution case — try coupon first, then lead matching
    let updAttributionSource: "webhook" | "coupon" | "lead_email" = "webhook";
    if (!event.attribution?.affiliateCode) {
      // Attribution Resilience: Check for coupon code first
      const updRawPayload = JSON.parse(event.rawPayload);
      const updCouponCode = updRawPayload.data?.object?.metadata?._salig_aff_coupon_code || event.attribution?.couponCode;

      if (updCouponCode && event.tenantId) {
        const updCouponValidation = await ctx.runQuery(api.couponCodes.validateCouponCode, {
          tenantId: event.tenantId as Id<"tenants">,
          couponCode: updCouponCode,
        });
        if (updCouponValidation) {
          event.attribution = {
            affiliateCode: updCouponValidation.affiliateName,
            clickId: updCouponValidation.referralLinkId as any,
            couponCode: updCouponCode,
          };
          updAttributionSource = "coupon";
          console.log(`Webhook ${event.eventId}: Attribution resolved via coupon code ${updCouponCode}`);
        }
      }

      if (event.payment.customerEmail && event.tenantId) {
        const leadAttribution = await ctx.runQuery(internal.referralLeads.resolveLeadAttribution, {
          tenantId: event.tenantId as Id<"tenants">,
          email: event.payment.customerEmail,
        });
        if (leadAttribution) {
          event.attribution = {
            affiliateCode: leadAttribution.affiliateCode,
            clickId: leadAttribution.clickId ?? undefined,
          };
          updAttributionSource = "lead_email";
          console.log(`Webhook ${event.eventId}: Attribution resolved via lead matching for ${event.payment.customerEmail}`);
        }
      }

      if (!event.attribution?.affiliateCode) {
        console.log(`Webhook ${event.eventId}: No attribution data, logging as organic`);

        const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
          tenantId: event.tenantId as Id<"tenants">,
          customerEmail: event.payment.customerEmail,
          amount: event.payment.amount / 100,
          status: event.payment.status === "paid" ? "completed" : "pending",
          metadata: {
            orderId: event.payment.id,
            subscriptionId: event.subscription?.id,
            planId: event.subscription?.planId,
            subscriptionStatus: event.subscription?.status,
          },
        });

        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "processed",
          errorMessage: "No attribution data - logged as organic",
        });

        return {
          conversionId,
          commissionId: null,
          processed: true,
          organic: true,
          adjustmentType: null,
        };
      }
    }

    // Validate affiliate
    const affiliate: { _id: Id<"affiliates">; status: string } | null = await ctx.runQuery(internal.conversions.findAffiliateByCodeInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      code: event.attribution.affiliateCode,
    });

    if (!affiliate || affiliate.status !== "active") {
      const invalidReason = !affiliate ? "Invalid affiliate code" : `Affiliate status is ${affiliate.status}`;
      
      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId: event.tenantId as Id<"tenants">,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / 100,
        status: event.payment.status === "paid" ? "completed" : "pending",
        metadata: {
          orderId: event.payment.id,
          subscriptionId: event.subscription?.id,
          planId: event.subscription?.planId,
          subscriptionStatus: event.subscription?.status,
        },
      });

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: `${invalidReason} - created organic conversion`,
      });

      return {
        conversionId,
        commissionId: null,
        processed: true,
        organic: true,
        adjustmentType: null,
      };
    }

    // Get referral link for attribution chain
    const referralLink: { _id: Id<"referralLinks">; affiliateId: Id<"affiliates">; campaignId?: Id<"campaigns"> } | null = await ctx.runQuery(internal.conversions.getReferralLinkByCodeInternal, {
      tenantId: event.tenantId as Id<"tenants">,
      code: event.attribution.affiliateCode,
    });

    if (!referralLink) {
      const conversionId: Id<"conversions"> = await ctx.runMutation(internal.conversions.createOrganicConversion, {
        tenantId: event.tenantId as Id<"tenants">,
        customerEmail: event.payment.customerEmail,
        amount: event.payment.amount / 100,
        status: CONFIRMED_PAYMENT_STATUSES.includes(event.payment.status as any) ? "completed" : "pending",
        metadata: {
          orderId: event.payment.id,
          subscriptionId: event.subscription?.id,
          planId: event.subscription?.planId,
          subscriptionStatus: event.subscription?.status,
        },
      });

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "Referral link not found - created organic conversion",
      });

      return {
        conversionId,
        commissionId: null,
        processed: true,
        organic: true,
        adjustmentType: null,
      };
    }

    // Determine adjustment type based on previous conversion amount vs current amount
    // For subscription.updated events, we need to check if there's a previous subscription
    // We'll check the existing conversion's metadata for previous plan info
    let adjustmentType: "renewal" | "upgrade" | "downgrade" = "renewal";
    
    // Find existing conversion for this subscription to detect upgrade/downgrade
    let existingConversion: { _id: Id<"conversions">; amount: number; metadata?: { planId?: string } } | null = null;
    
    if (event.subscription?.id) {
      existingConversion = await ctx.runQuery(
        internal.conversions.findConversionBySubscriptionIdInternal,
        {
          subscriptionId: event.subscription.id,
          tenantId: event.tenantId as Id<"tenants">,
        }
      );
    }

    // Detect upgrade vs downgrade by comparing with previous conversion amount
    if (existingConversion) {
      const previousAmount = existingConversion.amount;
      const currentAmount = event.payment.amount / 100;
      
      if (currentAmount > previousAmount) {
        adjustmentType = "upgrade";
      } else if (currentAmount < previousAmount) {
        adjustmentType = "downgrade";
      } else {
        adjustmentType = "renewal";
      }
    }
    
    // STORY 7.3: Explicit payment status validation with rejection logging
    // Only create conversions for confirmed payment statuses
    const paymentStatus = event.payment.status;
    const isConfirmedStatus = CONFIRMED_PAYMENT_STATUSES.includes(paymentStatus as any);

    if (!isConfirmedStatus) {
      console.log(`Webhook ${event.eventId}: Payment status is ${paymentStatus}, rejecting commission creation`);

      // Use helper function for consistent rejection logging with audit trail
      await logPaymentRejection(ctx, {
        webhookId: rawWebhookId,
        tenantId: event.tenantId as Id<"tenants">,
        paymentId: event.payment.id,
        paymentStatus,
        paymentAmount: event.payment.amount,
        currency: event.payment.currency,
        eventId: event.eventId,
      });

      return {
        conversionId: null,
        commissionId: null,
        processed: true,
        organic: false,
        adjustmentType: null,
      };
    }

    let commissionId: Id<"commissions"> | null = null;
    let conversionId: Id<"conversions"> | null = null;

    // Create conversion for the renewal (paid/completed status)
    conversionId = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
      tenantId: event.tenantId as Id<"tenants">,
      affiliateId: affiliate._id,
      referralLinkId: referralLink._id,
      campaignId: referralLink.campaignId,
      customerEmail: event.payment.customerEmail,
      amount: event.payment.amount / 100,
      status: "completed",
      attributionSource: updAttributionSource,
      metadata: {
        orderId: event.payment.id,
        subscriptionId: event.subscription?.id,
        planId: event.subscription?.planId,
        subscriptionStatus: event.subscription?.status,
        previousPlanId: existingConversion?.metadata?.planId,
        previousAmount: existingConversion?.amount,
      },
    });

    // AC #1 & #2: Check campaign recurringCommission flag before creating renewal commission
    if (conversionId && referralLink.campaignId) {
        // Get campaign to check recurringCommission setting
        const campaignDoc = await ctx.runQuery(internal.campaigns.getCampaignByIdInternal, {
          campaignId: referralLink.campaignId,
        });
        
        if (campaignDoc && campaignDoc.recurringCommission) {
          // AC #1: Campaign has recurring commissions enabled - create commission
          console.log(`Webhook ${event.eventId}: Creating commission for subscription ${adjustmentType} (recurring enabled)`);
          
          // AC #3 & #4: Handle commission adjustment for plan changes
          if ((adjustmentType === "upgrade" || adjustmentType === "downgrade") && existingConversion) {
            // Find existing pending commission for this subscription
            const existingCommissions = await ctx.runQuery(
              internal.commissions.getCommissionsByConversionInternal,
              { conversionId: existingConversion._id }
            );
            
            const pendingCommission = existingCommissions.find((c: { status: string }) => c.status === "pending");
            
            if (pendingCommission) {
              // Adjust the existing pending commission amount
              await ctx.runMutation(internal.commissions.adjustCommissionAmountInternal, {
                commissionId: pendingCommission._id,
                newAmount: event.payment.amount / 100,
              });
              
              // Create audit log for adjustment
              await ctx.runMutation(internal.audit.logAuditEventInternal, {
                tenantId: event.tenantId as Id<"tenants">,
                action: `commission_adjusted_${adjustmentType}`,
                entityType: "commission",
                entityId: pendingCommission._id.toString(),
                actorType: "system",
                previousValue: { amount: pendingCommission.amount },
                newValue: { amount: event.payment.amount / 100 },
                metadata: {
                  subscriptionId: event.subscription?.id,
                  planId: event.subscription?.planId,
                  previousPlanId: existingConversion?.metadata?.planId,
                },
              });
            }
          }
          
          // Create new commission for renewal using recurring rate
          commissionId = await ctx.runMutation(internal.commissions.createCommissionFromConversionInternal, {
            tenantId: event.tenantId as Id<"tenants">,
            affiliateId: affiliate._id,
            campaignId: referralLink.campaignId,
            conversionId,
            saleAmount: event.payment.amount / 100,
            eventMetadata: {
              source: "subscription.updated",
              transactionId: event.payment.id,
              timestamp: event.timestamp,
              subscriptionId: event.subscription?.id,
            },
          });
        } else {
          // AC #2: Campaign has recurring commissions disabled - log reason, no commission
          console.log(`Webhook ${event.eventId}: No commission created - recurring commissions disabled for campaign`);
          
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
            errorMessage: "Recurring commissions disabled - no renewal commission created",
          });
        }
    }

    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: rawWebhookId,
      status: "processed",
    });

    return {
      conversionId,
      commissionId,
      processed: true,
      organic: false,
      adjustmentType,
    };
  },
});

/**
 * Internal action to process subscription.cancelled webhook event
 * Handles cancellations - preserves pending commissions
 */
export const processSubscriptionCancelledEvent = internalAction({
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
      subscription: v.optional(v.object({
        id: v.string(),
        status: v.union(v.literal("active"), v.literal("cancelled"), v.literal("past_due")),
        planId: v.optional(v.string()),
      })),
      rawPayload: v.string(),
    }),
  },
  returns: v.object({
    conversionId: v.union(v.id("conversions"), v.null()),
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    organic: v.boolean(),
  }),
  handler: async (ctx, args): Promise<SubscriptionEventResult> => {
    const event = args.billingEvent as BillingEvent;
    const rawWebhookId = args.webhookId;

    // Note: Raw webhook deduplication is now handled at HTTP handler level (Story 7.5)
    // Commission-level idempotency is maintained via findCommissionByTransactionIdInternal in createCommissionFromConversionInternal

    // AC #5: Mark subscription as cancelled and preserve existing pending commissions
    // No new commissions should be created for future renewals
    
    // Find and update the conversion for this subscription
    let conversionId: Id<"conversions"> | null = null;
    
    if (event.subscription?.id) {
      // Find existing conversion by subscription ID
      const existingConversion = await ctx.runQuery(
        internal.conversions.findConversionBySubscriptionIdInternal,
        {
          subscriptionId: event.subscription.id,
          tenantId: event.tenantId as Id<"tenants">,
        }
      );
      
      if (existingConversion) {
        conversionId = existingConversion._id;
        
        // Update the conversion's subscription status to cancelled
        await ctx.runMutation(internal.conversions.updateConversionSubscriptionStatusInternal, {
          conversionId: existingConversion._id,
          subscriptionStatus: "cancelled",
        });
        
        console.log(`Webhook ${event.eventId}: Subscription ${event.subscription.id} cancelled - conversion ${existingConversion._id} updated`);
        
        // Create audit log for cancellation
        await ctx.runMutation(internal.audit.logAuditEventInternal, {
          tenantId: event.tenantId as Id<"tenants">,
          action: "subscription_cancelled",
          entityType: "conversion",
          entityId: existingConversion._id.toString(),
          actorType: "system",
          metadata: {
            subscriptionId: event.subscription.id,
            planId: event.subscription.planId,
            preservedPendingCommissions: true,
          },
        });
      } else {
        console.log(`Webhook ${event.eventId}: No conversion found for subscription ${event.subscription.id}`);
      }
    }

    // Log cancellation for audit trail
    if (event.subscription?.id) {
      console.log(`Webhook ${event.eventId}: Subscription ${event.subscription.id} cancelled`);
    }

    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: rawWebhookId,
      status: "processed",
      errorMessage: "Subscription cancelled - pending commissions preserved",
    });

    return {
      conversionId,
      commissionId: null,
      processed: true,
      organic: false,
    };
  },
});

/**
 * Result type for refund/chargeback event processing
 */
interface ReversalEventResult {
  commissionId: Id<"commissions"> | null;
  processed: boolean;
  reversed: boolean;
  fraudSignalAdded?: boolean;
}

/**
 * Internal action to process refund.created webhook event.
 * Story 7.4 - Commission Reversal (AC1)
 */
export const processRefundCreatedEvent = internalAction({
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
  returns: v.object({
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    reversed: v.boolean(),
  }),
  handler: async (ctx, args): Promise<ReversalEventResult> => {
    const event = args.billingEvent;
    const rawWebhookId = args.webhookId;
    
    console.log(`Processing refund event: ${event.eventId}`);
    
    // Note: Raw webhook deduplication is now handled at HTTP handler level (Story 7.5)
    // Commission-level idempotency is maintained via findCommissionByTransactionIdInternal
    
    // Extract tenant ID from event metadata
    const rawPayload = JSON.parse(event.rawPayload);
    const metadata = rawPayload.data?.object?.metadata || {};
    const tenantIdStr = metadata._salig_aff_tenant || event.tenantId;
    
    if (!tenantIdStr) {
      console.log(`Webhook ${event.eventId}: No tenant ID found, logging as processed`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "No tenant ID found in event",
      });
      
      return {
        commissionId: null,
        processed: true,
        reversed: false,
      };
    }
    
    const tenantId = tenantIdStr as Id<"tenants">;
    
    // AC #3: Extract original transaction ID from refund event metadata
    // The original transaction ID is in the metadata of the refund event
    const originalTransactionId = metadata.original_transaction_id || 
                                   rawPayload.data?.object?.payment_intent ||
                                   rawPayload.data?.object?.charge;
    
    if (!originalTransactionId) {
      console.log(`Webhook ${event.eventId}: No original transaction ID found`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "No original transaction ID found",
      });
      
      return {
        commissionId: null,
        processed: true,
        reversed: false,
      };
    }
    
    console.log(`Webhook ${event.eventId}: Looking for commission with transaction ID: ${originalTransactionId}`);
    
    // AC #3: Find commission by transaction ID
    const commission = await ctx.runQuery(internal.commissions.findCommissionByTransactionIdInternal, {
      tenantId,
      transactionId: originalTransactionId,
    });
    
    // AC #4: No commission found handling
    if (!commission) {
      console.log(`Webhook ${event.eventId}: No commission found for transaction ${originalTransactionId}`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "No commission found for transaction",
      });
      
      // Log the event as processed even though no commission was found
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId,
        action: "refund_processed_no_commission",
        entityType: "webhook",
        entityId: event.eventId,
        actorType: "system",
        metadata: {
          transactionId: originalTransactionId,
          refundAmount: event.payment.amount,
        },
      });
      
      return {
        commissionId: null,
        processed: true,
        reversed: false,
      };
    }
    
    // AC #5: Already reversed commission handling
    if (commission.status === "reversed") {
      console.log(`Webhook ${event.eventId}: Commission ${commission._id} already reversed`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "Commission already reversed",
      });
      
      // Don't create duplicate audit log entry
      return {
        commissionId: commission._id,
        processed: true,
        reversed: false,
      };
    }
    
    // AC #3: Only allow reversal for commissions with specific statuses
    const validReversalStatuses = ["pending", "approved"];
    if (!validReversalStatuses.includes(commission.status)) {
      console.log(`Webhook ${event.eventId}: Commission ${commission._id} has invalid status for reversal: ${commission.status}`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: `Commission status ${commission.status} not reversible`,
      });
      
      return {
        commissionId: commission._id,
        processed: true,
        reversed: false,
      };
    }
    
    // AC #1: Update commission status to "reversed" with reversalReason "refund"
    await ctx.runMutation(internal.commissions.reverseCommissionInternal, {
      commissionId: commission._id,
      reversalReason: "refund",
    });
    
    // Note: Audit logging for reversal is now handled inside reverseCommissionInternal (Story 7.8)
    
    // Update webhook status to processed
    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: rawWebhookId,
      status: "processed",
    });
    
    return {
      commissionId: commission._id,
      processed: true,
      reversed: true,
    };
  },
});

/**
 * Internal action to process chargeback.created webhook event.
 * Story 7.4 - Commission Reversal (AC2)
 */
export const processChargebackCreatedEvent = internalAction({
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
  returns: v.object({
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    reversed: v.boolean(),
    fraudSignalAdded: v.boolean(),
  }),
  handler: async (ctx, args): Promise<ReversalEventResult & { fraudSignalAdded: boolean }> => {
    const event = args.billingEvent;
    const rawWebhookId = args.webhookId;
    
    console.log(`Processing chargeback event: ${event.eventId}`);
    
    // Note: Raw webhook deduplication is now handled at HTTP handler level (Story 7.5)
    // Commission-level idempotency is maintained via findCommissionByTransactionIdInternal
    
    // Extract tenant ID from event metadata
    
    // Extract tenant ID from event metadata
    const rawPayload = JSON.parse(event.rawPayload);
    const metadata = rawPayload.data?.object?.metadata || {};
    const tenantIdStr = metadata._salig_aff_tenant || event.tenantId;
    
    if (!tenantIdStr) {
      console.log(`Webhook ${event.eventId}: No tenant ID found, logging as processed`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "No tenant ID found in event",
      });
      
      return {
        commissionId: null,
        processed: true,
        reversed: false,
        fraudSignalAdded: false,
      };
    }
    
    const tenantId = tenantIdStr as Id<"tenants">;
    
    // AC #3: Extract original transaction ID from chargeback event metadata
    const originalTransactionId = metadata.original_transaction_id || 
                                   rawPayload.data?.object?.payment_intent ||
                                   rawPayload.data?.object?.charge;
    
    if (!originalTransactionId) {
      console.log(`Webhook ${event.eventId}: No original transaction ID found`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "No original transaction ID found",
      });
      
      return {
        commissionId: null,
        processed: true,
        reversed: false,
        fraudSignalAdded: false,
      };
    }
    
    console.log(`Webhook ${event.eventId}: Looking for commission with transaction ID: ${originalTransactionId}`);
    
    // AC #3: Find commission by transaction ID
    const commission = await ctx.runQuery(internal.commissions.findCommissionByTransactionIdInternal, {
      tenantId,
      transactionId: originalTransactionId,
    });
    
    // AC #4: No commission found handling
    if (!commission) {
      console.log(`Webhook ${event.eventId}: No commission found for transaction ${originalTransactionId}`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "No commission found for transaction",
      });
      
      // Log the event as processed even though no commission was found
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId,
        action: "chargeback_processed_no_commission",
        entityType: "webhook",
        entityId: event.eventId,
        actorType: "system",
        metadata: {
          transactionId: originalTransactionId,
          chargebackAmount: event.payment.amount,
        },
      });
      
      return {
        commissionId: null,
        processed: true,
        reversed: false,
        fraudSignalAdded: false,
      };
    }
    
    // AC #5: Already reversed commission handling
    if (commission.status === "reversed") {
      console.log(`Webhook ${event.eventId}: Commission ${commission._id} already reversed`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: "Commission already reversed",
      });
      
      // Don't create duplicate audit log entry
      return {
        commissionId: commission._id,
        processed: true,
        reversed: false,
        fraudSignalAdded: false,
      };
    }
    
    // AC #3: Only allow reversal for commissions with specific statuses
    const validReversalStatuses = ["pending", "approved"];
    if (!validReversalStatuses.includes(commission.status)) {
      console.log(`Webhook ${event.eventId}: Commission ${commission._id} has invalid status for reversal: ${commission.status}`);
      
      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
        errorMessage: `Commission status ${commission.status} not reversible`,
      });
      
      return {
        commissionId: commission._id,
        processed: true,
        reversed: false,
        fraudSignalAdded: false,
      };
    }
    
    // AC #2: Update commission status to "reversed" with reversalReason "chargeback"
    await ctx.runMutation(internal.commissions.reverseCommissionInternal, {
      commissionId: commission._id,
      reversalReason: "chargeback",
    });
    
    // AC #2: Add fraud signal to affiliate's record with type "chargeback" and severity "high"
    await ctx.runMutation(internal.affiliates.addFraudSignalInternal, {
      affiliateId: commission.affiliateId,
      type: "chargeback",
      severity: "high",
      details: `Chargeback for commission ${commission._id}`,
      commissionId: commission._id,
    });
    
    // Note: Audit logging for reversal is now handled inside reverseCommissionInternal (Story 7.8)
    
    // Update webhook status to processed
    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: rawWebhookId,
      status: "processed",
    });
    
    return {
      commissionId: commission._id,
      processed: true,
      reversed: true,
      fraudSignalAdded: true,
    };
  },
});

// =============================================================================
// Lead Matching Helper & Shared Routing
// =============================================================================

/**
 * Internal Query: Find commission by transaction ID for dedup
 * Used by Stripe webhook handler to prevent duplicate commissions from
 * out-of-order events with the same payment_intent_id
 */
export const findCommissionByTransactionId = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    transactionId: v.string(),
  },
  returns: v.nullable(v.id("commissions")),
  handler: async (ctx, args) => {
    const commission = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_transaction", (q) =>
        q.eq("tenantId", args.tenantId).eq("transactionId", args.transactionId)
      )
      .first();

    return commission ? commission._id : null;
  },
});

/**
 * Internal Action: Route a BillingEvent to the appropriate commission engine handler.
 * This is the shared routing layer used by both SaligPay and Stripe webhook handlers.
 * Must be an action (Node.js runtime) because it calls other internalActions.
 */
export const routeBillingEvent = internalAction({
  args: {
    webhookId: v.id("rawWebhooks"),
    billingEvent: v.any(),
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = args.billingEvent as BillingEvent;

    switch (event.eventType) {
      case "payment.updated":
        await ctx.runAction(internal.commissionEngine.processPaymentUpdatedToCommission, {
          webhookId: args.webhookId,
          billingEvent: event as any,
        });
        break;

      case "subscription.created":
        await ctx.runAction(internal.commissionEngine.processSubscriptionCreatedEvent, {
          webhookId: args.webhookId,
          billingEvent: event as any,
        });
        break;

      case "subscription.updated":
        await ctx.runAction(internal.commissionEngine.processSubscriptionUpdatedEvent, {
          webhookId: args.webhookId,
          billingEvent: event as any,
        });
        break;

      case "subscription.cancelled":
        // Subscription cancellations are currently a no-op for commission creation
        // (commissions already created are not affected by subscription cancellation)
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: args.webhookId,
          status: "processed",
          errorMessage: "Subscription cancelled — no commission action required",
        });
        break;

      case "refund.created":
        await ctx.runAction(internal.commissionEngine.processRefundCreatedEvent, {
          webhookId: args.webhookId,
          billingEvent: event as any,
        });
        break;

      case "chargeback.created":
        await ctx.runAction(internal.commissionEngine.processChargebackCreatedEvent, {
          webhookId: args.webhookId,
          billingEvent: event as any,
        });
        break;

      default:
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: args.webhookId,
          status: "failed",
          errorMessage: `Unhandled event type: ${event.eventType}`,
        });
    }

    return null;
  },
});
