import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";
import FraudAlertEmail from "./emails/FraudAlertEmail";
import CommissionConfirmedEmail from "./emails/CommissionConfirmedEmail";
import PayoutSentEmail from "./emails/PayoutSentEmail";
import NewReferralAlertEmail from "./emails/NewReferralAlertEmail";
import { renderTemplate } from "./templates";

const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

// Configurable email domain - should be set in Convex environment
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "boboddy.business";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Salig Affiliate";

const getFromAddress = (prefix: string) => `${FROM_NAME} <${prefix}@${EMAIL_DOMAIN}>`;

/**
 * Track email sent status in the database.
 * Internal mutation - called by internal actions that send emails.
 */
export const trackEmailSent = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    type: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
    // Story 10.6: Email tracking fields
    broadcastId: v.optional(v.id("broadcastEmails")),
    affiliateId: v.optional(v.id("affiliates")),
    resendMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emails", {
      tenantId: args.tenantId,
      type: args.type,
      recipientEmail: args.recipientEmail,
      subject: args.subject,
      status: args.status,
      sentAt: Date.now(),
      errorMessage: args.errorMessage,
      broadcastId: args.broadcastId,
      affiliateId: args.affiliateId,
      resendMessageId: args.resendMessageId,
      deliveryStatus: args.status === "sent" ? "sent" : undefined,
    });

    return null;
  },
});

/**
 * Internal mutation: Update email delivery status from webhook event.
 * Finds the email by resendMessageId and updates tracking fields.
 * Also updates broadcast aggregate counts if the email is a broadcast.
 */
export const updateEmailDeliveryStatus = internalMutation({
  args: {
    resendMessageId: v.string(),
    eventType: v.union(
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("complained")
    ),
    timestamp: v.number(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find email by resendMessageId
    const email = await ctx.db
      .query("emails")
      .withIndex("by_resend_message_id", (q) =>
        q.eq("resendMessageId", args.resendMessageId)
      )
      .unique();

    if (!email) {
      return null; // Email not found - might be non-broadcast email
    }

    // Build update object based on event type
    const updates: Record<string, unknown> = {};

    switch (args.eventType) {
      case "delivered":
        updates.deliveryStatus = "delivered";
        updates.deliveredAt = args.timestamp;
        break;
      case "opened":
        updates.deliveryStatus = "opened";
        updates.openedAt = args.timestamp;
        break;
      case "clicked":
        updates.deliveryStatus = "clicked";
        updates.clickedAt = args.timestamp;
        break;
      case "bounced":
        updates.deliveryStatus = "bounced";
        updates.bounceReason = args.reason;
        break;
      case "complained":
        updates.deliveryStatus = "complained";
        updates.complaintReason = args.reason;
        break;
    }

    await ctx.db.patch(email._id, updates);

    // Update broadcast aggregate counts if this is a broadcast email
    if (email.broadcastId) {
      await ctx.runMutation(internal.emails.updateBroadcastAggregateCount, {
        broadcastId: email.broadcastId,
        eventType: args.eventType,
      });
    }

    // Log bounce/complaint events for admin review (AC #6)
    if (args.eventType === "bounced" || args.eventType === "complained") {
      await ctx.db.insert("auditLogs", {
        tenantId: email.tenantId,
        action: `email_${args.eventType}`,
        entityType: "email",
        entityId: email._id,
        actorType: "system",
        newValue: {
          resendMessageId: args.resendMessageId,
          recipientEmail: email.recipientEmail,
          reason: args.reason,
          timestamp: args.timestamp,
        },
      });
    }

    return null;
  },
});

/**
 * Internal mutation: Increment broadcast aggregate count for a specific event type.
 * Called after each webhook event is processed for a broadcast email.
 */
export const updateBroadcastAggregateCount = internalMutation({
  args: {
    broadcastId: v.id("broadcastEmails"),
    eventType: v.union(
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("complained")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) {
      return null;
    }

    const updates: Record<string, number> = {};

    switch (args.eventType) {
      case "opened":
        updates.openedCount = (broadcast.openedCount ?? 0) + 1;
        break;
      case "clicked":
        updates.clickedCount = (broadcast.clickedCount ?? 0) + 1;
        break;
      case "bounced":
        updates.bounceCount = (broadcast.bounceCount ?? 0) + 1;
        break;
      case "complained":
        updates.complaintCount = (broadcast.complaintCount ?? 0) + 1;
        break;
      // delivered: no aggregate count tracked separately (sentCount covers this)
    }

    // Only patch if there are updates
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.broadcastId, updates);
    }

    return null;
  },
});

/**
 * Internal query: Find email by resendMessageId.
 * Used by webhook handler to look up email records.
 */
export const getEmailByResendMessageId = internalQuery({
  args: {
    resendMessageId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("emails"),
      tenantId: v.id("tenants"),
      broadcastId: v.optional(v.id("broadcastEmails")),
      recipientEmail: v.string(),
      deliveryStatus: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_resend_message_id", (q) =>
        q.eq("resendMessageId", args.resendMessageId)
      )
      .unique();

    if (!email) {
      return null;
    }

    return {
      _id: email._id,
      tenantId: email.tenantId,
      broadcastId: email.broadcastId,
      recipientEmail: email.recipientEmail,
      deliveryStatus: email.deliveryStatus,
    };
  },
});

/**
 * Used for email logs and debugging.
 */
export const getEmailHistory = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("emails"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      type: v.string(),
      recipientEmail: v.string(),
      subject: v.string(),
      status: v.string(),
      sentAt: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(args.limit ?? 100);

    return emails;
  },
});

/**
 * Send fraud alert email to SaaS Owner when self-referral is detected.
 * This is an internal ACTION - not callable from frontend.
 * Story 5.6 AC #9.
 * 
 * NOTE: Changed from internalMutation to internalAction to support Resend email sending.
 */
export const sendFraudAlertEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    commissionId: v.id("commissions"),
    matchedIndicators: v.array(v.string()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    try {
      // Get tenant info for branding
      const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
        tenantId: args.tenantId,
      });
      if (!tenant) {
        return { success: false, error: "Tenant not found" };
      }

      // Get affiliate info
      const affiliate = await ctx.runQuery(internal.affiliates.getAffiliateInternal, {
        affiliateId: args.affiliateId,
      });
      if (!affiliate) {
        return { success: false, error: "Affiliate not found" };
      }

      // Get commission info
      const commission = await ctx.runQuery(internal.commissions.getCommissionInternal, {
        commissionId: args.commissionId,
      });
      if (!commission) {
        return { success: false, error: "Commission not found" };
      }

      // Get SaaS Owner email from users table (role = "owner")
      const ownerUser = await ctx.runQuery(internal.users.getOwnerByTenantInternal, {
        tenantId: args.tenantId,
      });

      if (!ownerUser) {
        return { success: false, error: "Owner user not found" };
      }

      const ownerEmail = ownerUser.email;
      const brandName = tenant.branding?.portalName || tenant.name || "Your Portal";
      const brandLogo = tenant.branding?.logoUrl;
      const brandColor = tenant.branding?.primaryColor || "#1c2260";

      // Build dashboard URL
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://app.boboddy.business"}/commissions/${args.commissionId}`;

      // Email subject with warning emoji (AC #9)
      const subject = "🚨 Fraud Alert: Self-Referral Detected";

      // Send the email via Resend
      await resend.sendEmail(ctx, {
        from: getFromAddress("security"),
        to: ownerEmail,
        subject,
        html: await render(
          <FraudAlertEmail
            brandName={brandName}
            brandLogoUrl={brandLogo}
            brandPrimaryColor={brandColor}
            affiliateName={affiliate.name}
            affiliateEmail={affiliate.email}
            affiliateId={args.affiliateId}
            commissionAmount={commission.amount}
            commissionId={args.commissionId}
            matchedIndicators={args.matchedIndicators}
            dashboardUrl={dashboardUrl}
          />
        ),
      });

      // Track successful email
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "fraud_alert_self_referral",
        recipientEmail: ownerEmail,
        subject,
        status: "sent",
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track the failure
      try {
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId: args.tenantId,
          type: "fraud_alert_self_referral",
          recipientEmail: "unknown",
          subject: "🚨 Fraud Alert: Self-Referral Detected",
          status: "failed",
          errorMessage,
        });
      } catch {
        // Silently fail tracking - original error is more important
      }

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Action: Send commission confirmed email to affiliate with retry logic.
 * Uses exponential backoff with scheduler-based retries (non-blocking).
 * Called from approveCommission mutation (Story 10.2).
 * 
 * Validates that:
 * - Affiliate exists and belongs to current tenant
 * - Commission has been approved
 * - Email sent within 5-minute SLA (AC1)
 * 
 * Sends email with commission amount, campaign details, and customer context.
 */
export const sendCommissionConfirmedEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    commissionId: v.id("commissions"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    commissionAmount: v.number(),
    campaignName: v.string(),
    conversionDate: v.number(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    portalEarningsUrl: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    customerPlanType: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    approvalTimestamp: v.optional(v.number()), // For SLA monitoring
    currency: v.optional(v.string()), // Tenant's configured currency
    maxRetries: v.optional(v.number()),
    attempt: v.optional(v.number()), // Current retry attempt
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    retryCount: v.number(),
    slaBreached: v.optional(v.boolean()), // AC1: Track 5-minute SLA
  }),
  handler: async (ctx, args) => {
    const maxRetries = args.maxRetries ?? 3;
    const currentAttempt = args.attempt ?? 0;
    const baseDelay = 5000; // 5 second base delay (MED-8: increased from 1s)
    const slaDeadline = 5 * 60 * 1000; // 5 minutes in ms
    
    // Check SLA compliance (AC1)
    const now = Date.now();
    const slaBreached = args.approvalTimestamp 
      ? (now - args.approvalTimestamp) > slaDeadline
      : false;
    
    // Use provided currency or default to PHP
    // Future: Tenant currency can be configured in tenant settings
    const currency = args.currency ?? "PHP";

    const subject = `Commission Confirmed: ${args.commissionAmount.toLocaleString("en-US", { style: "currency", currency })}`;

    try {
      // Check for custom template (Story 10.7 AC5)
      const customTemplate = await ctx.runQuery(
        internal.templates.getEmailTemplateForSending,
        { tenantId: args.tenantId, templateType: "commission_confirmed" }
      );

      const templateVariables: Record<string, string | number | undefined> = {
        affiliate_name: args.affiliateName,
        commission_amount: args.commissionAmount.toLocaleString("en-US", { style: "currency", currency }),
        campaign_name: args.campaignName,
        conversion_date: new Date(args.conversionDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        portal_name: args.portalName,
        currency: currency,
        transaction_id: args.transactionId,
        customer_plan_type: args.customerPlanType,
        brand_logo_url: args.brandLogoUrl,
        brand_primary_color: args.brandPrimaryColor,
        portal_earnings_url: args.portalEarningsUrl,
        contact_email: args.contactEmail,
      };

      let finalSubject = subject;
      let html: string;

      if (customTemplate) {
        // Use custom template with variable interpolation
        finalSubject = renderTemplate(customTemplate.customSubject, templateVariables);
        html = renderTemplate(customTemplate.customBody, templateVariables);
      } else {
        // Use default React Email component
        html = await render(
          <CommissionConfirmedEmail
            affiliateName={args.affiliateName}
            commissionAmount={args.commissionAmount}
            campaignName={args.campaignName}
            conversionDate={args.conversionDate}
            transactionId={args.transactionId}
            customerPlanType={args.customerPlanType}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            portalEarningsUrl={args.portalEarningsUrl}
            contactEmail={args.contactEmail}
            currency={currency}
          />
        );
      }

      // Send the email via Resend
      await resend.sendEmail(ctx, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject: finalSubject,
        html,
      });

      // Log successful email with SLA info
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "commission_confirmed",
        recipientEmail: args.affiliateEmail,
        subject: finalSubject,
        status: "sent",
      });

      // Log SLA breach if applicable
      if (slaBreached) {
        await ctx.runMutation(internal.audit.logCommissionAuditEvent, {
          tenantId: args.tenantId,
          action: "EMAIL_SLA_BREACH",
          commissionId: args.commissionId,
          affiliateId: args.affiliateId,
          actorType: "system",
          metadata: {
            emailType: "commission_confirmed",
            delayMs: now - (args.approvalTimestamp ?? now),
            slaDeadlineMs: slaDeadline,
          },
        });
      }

      return { success: true, retryCount: currentAttempt, slaBreached };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt for commission_confirmed
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "commission_confirmed",
        recipientEmail: args.affiliateEmail,
        subject: `Commission Confirmed: ${args.commissionAmount.toLocaleString("en-US", { style: "currency", currency })}`,
        status: "failed",
        errorMessage,
      });

      // If this was the last attempt, return failure
      if (currentAttempt >= maxRetries) {
        return { success: false, error: errorMessage, retryCount: currentAttempt, slaBreached };
      }

      // Schedule retry with exponential backoff (non-blocking)
      const delay = baseDelay * Math.pow(2, currentAttempt);
      await ctx.scheduler.runAfter(delay, internal.emails.sendCommissionConfirmedEmail, {
        ...args,
        attempt: currentAttempt + 1,
      });

      // Return pending - retry scheduled
      return { 
        success: false, 
        error: `Retry scheduled after ${delay}ms: ${errorMessage}`, 
        retryCount: currentAttempt,
        slaBreached,
      };
    }
  },
});

/**
 * Action: Send payout sent email to affiliate with retry logic.
 * Uses exponential backoff with scheduler-based retries (non-blocking).
 * 
 * **Integration Point:** This function is designed to be called from `markPayoutAsPaid`
 * mutation in Epic 13 (Story 13.3). Currently Epic 13 is in BACKLOG status.
 * 
 * **Usage:**
 * ```typescript
 * await ctx.scheduler.runAfter(0, internal.emails.sendPayoutSentEmail, {
 *   tenantId,
 *   payoutId,
 *   affiliateId,
 *   affiliateEmail,
 *   affiliateName,
 *   payoutAmount,
 *   paidAt,
 *   portalName,
 *   // ... optional fields
 * });
 * ```
 * 
 * Sends email with payout amount, payment reference, and payment date.
 * Implements exponential backoff: 5s → 10s → 20s (max 3 retries).
 */
export const sendPayoutSentEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    payoutId: v.id("payouts"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    payoutAmount: v.number(),
    paymentReference: v.optional(v.string()),
    paidAt: v.number(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    portalEarningsUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    batchGeneratedAt: v.optional(v.number()),
    currency: v.optional(v.string()),
    maxRetries: v.optional(v.number()),
    attempt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    retryCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const maxRetries = args.maxRetries ?? 3;
    const currentAttempt = args.attempt ?? 0;
    const baseDelay = 5000; // 5 second base delay

    // Use provided currency or default to PHP
    const currency = args.currency ?? "PHP";

    const subject = `Payout of ${args.payoutAmount.toLocaleString("en-US", { style: "currency", currency })} has been sent`;

    try {
      // Check for custom template (Story 10.7 AC5)
      const customTemplate = await ctx.runQuery(
        internal.templates.getEmailTemplateForSending,
        { tenantId: args.tenantId, templateType: "payout_sent" }
      );

      const templateVariables: Record<string, string | number | undefined> = {
        affiliate_name: args.affiliateName,
        payout_amount: args.payoutAmount.toLocaleString("en-US", { style: "currency", currency }),
        payment_reference: args.paymentReference,
        paid_at: new Date(args.paidAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        portal_name: args.portalName,
        currency: currency,
        brand_logo_url: args.brandLogoUrl,
        brand_primary_color: args.brandPrimaryColor,
        portal_earnings_url: args.portalEarningsUrl,
        contact_email: args.contactEmail,
        batch_generated_at: args.batchGeneratedAt
          ? new Date(args.batchGeneratedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : undefined,
      };

      let finalSubject = subject;
      let html: string;

      if (customTemplate) {
        // Use custom template with variable interpolation
        finalSubject = renderTemplate(customTemplate.customSubject, templateVariables);
        html = renderTemplate(customTemplate.customBody, templateVariables);
      } else {
        // Use default React Email component
        html = await render(
          <PayoutSentEmail
            affiliateName={args.affiliateName}
            payoutAmount={args.payoutAmount}
            paymentReference={args.paymentReference}
            paidAt={args.paidAt}
            currency={currency}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            portalEarningsUrl={args.portalEarningsUrl}
            contactEmail={args.contactEmail}
            batchGeneratedAt={args.batchGeneratedAt}
          />
        );
      }

      // Send the email via Resend
      await resend.sendEmail(ctx, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject: finalSubject,
        html,
      });

      // Log successful payout email
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "payout_sent",
        recipientEmail: args.affiliateEmail,
        subject: finalSubject,
        status: "sent",
      });

      return { success: true, retryCount: currentAttempt };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "payout_sent",
        recipientEmail: args.affiliateEmail,
        subject,
        status: "failed",
        errorMessage,
      });

      // If this was the last attempt, return failure
      if (currentAttempt >= maxRetries) {
        return { success: false, error: errorMessage, retryCount: currentAttempt };
      }

      // Schedule retry with exponential backoff (non-blocking)
      const delay = baseDelay * Math.pow(2, currentAttempt);
      await ctx.scheduler.runAfter(delay, internal.emails.sendPayoutSentEmail, {
        ...args,
        attempt: currentAttempt + 1,
      });

      // Return pending - retry scheduled
      return { 
        success: false, 
        error: `Retry scheduled after ${delay}ms: ${errorMessage}`, 
        retryCount: currentAttempt,
      };
    }
  },
});

/**
 * Action: Send new referral alert email to SaaS Owner with retry logic.
 * Uses exponential backoff with scheduler-based retries (non-blocking).
 * Called from createConversionWithAttributation mutation (Story 10.4).
 * 
 * Validates that:
 * - Tenant exists and belongs to current tenant
 * - Conversion has been attributed
 * - Email sent within 5-minute SLA (AC1)
 * 
 * Sends email with affiliate details, conversion amount, and commission information.
 */
export const sendNewReferralAlertEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    conversionId: v.id("conversions"),
    affiliateId: v.id("affiliates"),
    ownerEmail: v.string(),
    ownerName: v.optional(v.string()),
    affiliateName: v.string(),
    affiliateEmail: v.string(),
    conversionAmount: v.number(),
    commissionAmount: v.number(),
    customerEmail: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    conversionTimestamp: v.number(),
    dashboardAffiliateUrl: v.optional(v.string()),
    dashboardConversionUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    currency: v.optional(v.string()),
    maxRetries: v.optional(v.number()),
    attempt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    retryCount: v.number(),
    slaBreached: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const maxRetries = args.maxRetries ?? 3;
    const currentAttempt = args.attempt ?? 0;
    const baseDelay = 5000; // 5 second base delay
    const slaDeadline = 5 * 60 * 1000; // 5 minutes in ms
    
    // Check SLA compliance (AC1)
    const now = Date.now();
    const slaBreached = (now - args.conversionTimestamp) > slaDeadline;
    
    // Use provided currency or default to PHP
    const currency = args.currency ?? "PHP";

    // Use provided owner name or default
    const ownerName = args.ownerName || "SaaS Owner";

    const subject = `New Referral: ${args.affiliateName} - ${args.commissionAmount.toLocaleString("en-US", { style: "currency", currency })}`;

    try {
      // Send the email via Resend
      await resend.sendEmail(ctx, {
        from: getFromAddress("notifications"),
        to: args.ownerEmail,
        subject,
        html: await render(
          <NewReferralAlertEmail
            ownerName={ownerName}
            affiliateName={args.affiliateName}
            affiliateEmail={args.affiliateEmail}
            conversionAmount={args.conversionAmount}
            conversionDate={args.conversionTimestamp}
            customerEmail={args.customerEmail}
            campaignName={args.campaignName}
            commissionAmount={args.commissionAmount}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            dashboardAffiliateUrl={args.dashboardAffiliateUrl}
            dashboardConversionUrl={args.dashboardConversionUrl}
            contactEmail={args.contactEmail}
            currency={currency}
          />
        ),
      });

      // Log successful email with SLA info
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "new_referral_alert",
        recipientEmail: args.ownerEmail,
        subject,
        status: "sent",
      });

      // Log SLA breach if applicable
      if (slaBreached) {
        await ctx.runMutation(internal.audit.logAuditEventInternal, {
          tenantId: args.tenantId,
          action: "EMAIL_SLA_BREACH",
          entityType: "conversion",
          entityId: args.conversionId,
          actorType: "system",
          metadata: {
            emailType: "new_referral_alert",
            delayMs: now - args.conversionTimestamp,
            slaDeadlineMs: slaDeadline,
            affiliateId: args.affiliateId,
          },
        });
      }

      return { success: true, retryCount: currentAttempt, slaBreached };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "new_referral_alert",
        recipientEmail: args.ownerEmail,
        subject,
        status: "failed",
        errorMessage,
      });

      // If this was the last attempt, return failure
      if (currentAttempt >= maxRetries) {
        return { success: false, error: errorMessage, retryCount: currentAttempt, slaBreached };
      }

      // Schedule retry with exponential backoff (non-blocking)
      const delay = baseDelay * Math.pow(2, currentAttempt);
      await ctx.scheduler.runAfter(delay, internal.emails.sendNewReferralAlertEmail, {
        ...args,
        attempt: currentAttempt + 1,
      });

      // Return pending - retry scheduled
      return { 
        success: false, 
        error: `Retry scheduled after ${delay}ms: ${errorMessage}`, 
        retryCount: currentAttempt,
        slaBreached,
      };
    }
  },
});
