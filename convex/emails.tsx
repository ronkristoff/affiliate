import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";
import FraudAlertEmail from "./emails/FraudAlertEmail";

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
    });

    return null;
  },
});

/**
 * Get email history for a tenant.
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
        console.log("Cannot send fraud alert: Tenant not found");
        return { success: false, error: "Tenant not found" };
      }

      // Get affiliate info
      const affiliate = await ctx.runQuery(internal.affiliates.getAffiliateInternal, {
        affiliateId: args.affiliateId,
      });
      if (!affiliate) {
        console.log("Cannot send fraud alert: Affiliate not found");
        return { success: false, error: "Affiliate not found" };
      }

      // Get commission info
      const commission = await ctx.runQuery(internal.commissions.getCommissionInternal, {
        commissionId: args.commissionId,
      });
      if (!commission) {
        console.log("Cannot send fraud alert: Commission not found");
        return { success: false, error: "Commission not found" };
      }

      // Get SaaS Owner email from users table (role = "owner")
      const ownerUser = await ctx.runQuery(internal.users.getOwnerByTenantInternal, {
        tenantId: args.tenantId,
      });

      if (!ownerUser) {
        console.log("Cannot send fraud alert: Owner user not found");
        return { success: false, error: "Owner user not found" };
      }

      const ownerEmail = ownerUser.email;
      const brandName = tenant.branding?.portalName || tenant.name || "Your Portal";
      const brandLogo = tenant.branding?.logoUrl;
      const brandColor = tenant.branding?.primaryColor || "#10409a";

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

      console.log(`Fraud alert email sent successfully to ${ownerEmail}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to send fraud alert email:", errorMessage);

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
      } catch (trackError) {
        console.error("Failed to track email failure:", trackError);
      }

      return { success: false, error: errorMessage };
    }
  },
});
