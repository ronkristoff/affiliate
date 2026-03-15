import "./polyfills";
import VerifyEmail from "./emails/verifyEmail";
import MagicLinkEmail from "./emails/magicLink";
import VerifyOTP from "./emails/verifyOTP";
import UpgradeConfirmationEmail from "./emails/UpgradeConfirmationEmail";
import DowngradeConfirmationEmail from "./emails/DowngradeConfirmationEmail";
import CancellationConfirmationEmail from "./emails/CancellationConfirmationEmail";
import DeletionReminderEmail from "./emails/DeletionReminderEmail";
import AffiliateWelcomeEmail from "./emails/AffiliateWelcomeEmail";
import NewAffiliateNotificationEmail from "./emails/NewAffiliateNotificationEmail";
import AffiliateApprovalEmail from "./emails/AffiliateApprovalEmail";
import AffiliateRejectionEmail from "./emails/AffiliateRejectionEmail";
import AffiliateSuspensionEmail from "./emails/AffiliateSuspensionEmail";
import AffiliateReactivationEmail from "./emails/AffiliateReactivationEmail";
import { render } from "@react-email/components";
import React from "react";
import ResetPasswordEmail from "./emails/resetPassword";
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { type MutationCtx, action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

// Configurable email domain - should be set in Convex environment
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "boboddy.business";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Salig Affiliate";

const getFromAddress = (prefix: string) => `${FROM_NAME} <${prefix}@${EMAIL_DOMAIN}>`;

export const sendEmailVerification = async (
  ctx: MutationCtx,
  {
    to,
    url,
  }: {
    to: string;
    url: string;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject: "Verify your email address",
    html: await render(<VerifyEmail url={url} />),
  });
};

export const sendOTPVerification = async (
  ctx: MutationCtx,
  {
    to,
    code,
  }: {
    to: string;
    code: string;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject: "Verify your email address",
    html: await render(<VerifyOTP code={code} />),
  });
};

export const sendMagicLink = async (
  ctx: MutationCtx,
  {
    to,
    url,
  }: {
    to: string;
    url: string;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject: "Sign in to your account",
    html: await render(<MagicLinkEmail url={url} />),
  });
};

export const sendResetPassword = async (
  ctx: MutationCtx,
  {
    to,
    url,
  }: {
    to: string;
    url: string;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject: "Reset your password",
    html: await render(<ResetPasswordEmail url={url} />),
  });
};

export const sendUpgradeConfirmation = async (
  ctx: MutationCtx,
  {
    to,
    previousPlan,
    newPlan,
    proratedAmount,
    effectiveDate,
    newBillingAmount,
  }: {
    to: string;
    previousPlan: string;
    newPlan: string;
    proratedAmount: number;
    effectiveDate: number;
    newBillingAmount: number;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("billing"),
    to,
    subject: "Your subscription has been upgraded!",
    html: await render(
      <UpgradeConfirmationEmail
        previousPlan={previousPlan}
        newPlan={newPlan}
        proratedAmount={proratedAmount}
        effectiveDate={effectiveDate}
        newBillingAmount={newBillingAmount}
      />
    ),
  });
};

export const sendDowngradeConfirmation = async (
  ctx: MutationCtx,
  {
    to,
    previousPlan,
    newPlan,
    effectiveDate,
    newBillingAmount,
  }: {
    to: string;
    previousPlan: string;
    newPlan: string;
    effectiveDate: number;
    newBillingAmount: number;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("billing"),
    to,
    subject: "Your subscription plan has been changed",
    html: await render(
      <DowngradeConfirmationEmail
        previousPlan={previousPlan}
        newPlan={newPlan}
        effectiveDate={effectiveDate}
        newBillingAmount={newBillingAmount}
      />
    ),
  });
};

export const sendCancellationConfirmation = async (
  ctx: MutationCtx,
  {
    to,
    previousPlan,
    accessEndDate,
    deletionDate,
  }: {
    to: string;
    previousPlan: string;
    accessEndDate: number;
    deletionDate: number;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("billing"),
    to,
    subject: "Your Subscription Has Been Cancelled",
    html: await render(
      <CancellationConfirmationEmail
        previousPlan={previousPlan}
        accessEndDate={accessEndDate}
        deletionDate={deletionDate}
      />
    ),
  });
};

export const sendDeletionReminder = async (
  ctx: MutationCtx,
  {
    to,
    deletionDate,
    daysUntilDeletion,
  }: {
    to: string;
    deletionDate: number;
    daysUntilDeletion: number;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("billing"),
    to,
    subject: "Urgent: Your account will be deleted soon",
    html: await render(
      <DeletionReminderEmail
        deletionDate={new Date(deletionDate).toLocaleDateString()}
        daysUntilDeletion={daysUntilDeletion}
      />
    ),
  });
};

/**
 * Send welcome email to new affiliate after registration.
 */
export const sendAffiliateWelcomeEmail = async (
  ctx: MutationCtx,
  {
    to,
    affiliateName,
    affiliateEmail,
    uniqueCode,
    portalName,
    brandLogoUrl,
    brandPrimaryColor,
    approvalTimeframe,
    contactEmail,
  }: {
    to: string;
    affiliateName: string;
    affiliateEmail: string;
    uniqueCode: string;
    portalName: string;
    brandLogoUrl?: string;
    brandPrimaryColor?: string;
    approvalTimeframe?: string;
    contactEmail?: string;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject: `Welcome to ${portalName}! Your application is pending approval`,
    html: await render(
      <AffiliateWelcomeEmail
        affiliateName={affiliateName}
        affiliateEmail={affiliateEmail}
        uniqueCode={uniqueCode}
        portalName={portalName}
        brandLogoUrl={brandLogoUrl}
        brandPrimaryColor={brandPrimaryColor}
        approvalTimeframe={approvalTimeframe}
        contactEmail={contactEmail}
      />
    ),
  });
};

/**
 * Send notification to SaaS Owner when a new affiliate registers.
 */
export const sendNewAffiliateNotificationEmail = async (
  ctx: MutationCtx,
  {
    to,
    affiliateName,
    affiliateEmail,
    promotionChannel,
    uniqueCode,
    merchantName,
    portalName,
    brandLogoUrl,
    brandPrimaryColor,
    dashboardUrl,
  }: {
    to: string;
    affiliateName: string;
    affiliateEmail: string;
    promotionChannel?: string;
    uniqueCode: string;
    merchantName: string;
    portalName: string;
    brandLogoUrl?: string;
    brandPrimaryColor?: string;
    dashboardUrl?: string;
  },
) => {
  await resend.sendEmail(ctx, {
    from: getFromAddress("notifications"),
    to,
    subject: `New Affiliate Application from ${affiliateName}`,
    html: await render(
      <NewAffiliateNotificationEmail
        affiliateName={affiliateName}
        affiliateEmail={affiliateEmail}
        promotionChannel={promotionChannel}
        uniqueCode={uniqueCode}
        merchantName={merchantName}
        portalName={portalName}
        brandLogoUrl={brandLogoUrl}
        brandPrimaryColor={brandPrimaryColor}
        dashboardUrl={dashboardUrl}
      />
    ),
  });
};

/**
 * Action: Send approval email to affiliate.
 * Called from approveAffiliate mutation.
 */
export const sendApprovalEmail = action({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    portalLoginUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    try {
      // Track the email attempt
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_approved",
        recipientEmail: args.affiliateEmail,
        subject: `Your application to ${args.portalName} has been approved!`,
        status: "sent",
      });

      // Send the email via Resend
      await resend.sendEmail(ctx as unknown as MutationCtx, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject: `Your application to ${args.portalName} has been approved!`,
        html: await render(
          <AffiliateApprovalEmail
            affiliateName={args.affiliateName}
            affiliateEmail={args.affiliateEmail}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            portalLoginUrl={args.portalLoginUrl}
            contactEmail={args.contactEmail}
          />
        ),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track the failure
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_approved",
        recipientEmail: args.affiliateEmail,
        subject: `Your application to ${args.portalName} has been approved!`,
        status: "failed",
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Action: Send rejection email to affiliate.
 * Called from rejectAffiliate mutation.
 */
export const sendRejectionEmail = action({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    reason: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    try {
      // Track the email attempt
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_rejected",
        recipientEmail: args.affiliateEmail,
        subject: `Update on your ${args.portalName} affiliate application`,
        status: "sent",
      });

      // Send the email via Resend
      await resend.sendEmail(ctx as unknown as MutationCtx, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject: `Update on your ${args.portalName} affiliate application`,
        html: await render(
          <AffiliateRejectionEmail
            affiliateName={args.affiliateName}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            reason={args.reason}
            contactEmail={args.contactEmail}
          />
        ),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track the failure
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_rejected",
        recipientEmail: args.affiliateEmail,
        subject: `Update on your ${args.portalName} affiliate application`,
        status: "failed",
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Action: Send suspension email to affiliate.
 * Called from suspendAffiliate mutation.
 */
export const sendSuspensionEmail = action({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    reason: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    try {
      // Track the email attempt
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_suspended",
        recipientEmail: args.affiliateEmail,
        subject: `Your ${args.portalName} affiliate account has been suspended`,
        status: "sent",
      });

      // Send the email via Resend
      await resend.sendEmail(ctx as unknown as MutationCtx, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject: `Your ${args.portalName} affiliate account has been suspended`,
        html: await render(
          <AffiliateSuspensionEmail
            affiliateName={args.affiliateName}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            reason={args.reason}
            contactEmail={args.contactEmail}
          />
        ),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track the failure
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_suspended",
        recipientEmail: args.affiliateEmail,
        subject: `Your ${args.portalName} affiliate account has been suspended`,
        status: "failed",
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Action: Send reactivation email to affiliate.
 * Called from reactivateAffiliate mutation.
 */
export const sendReactivationEmail = action({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    portalLoginUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    try {
      // Track the email attempt
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_reactivated",
        recipientEmail: args.affiliateEmail,
        subject: `Your ${args.portalName} affiliate account has been reactivated!`,
        status: "sent",
      });

      // Send the email via Resend
      await resend.sendEmail(ctx as unknown as MutationCtx, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject: `Your ${args.portalName} affiliate account has been reactivated!`,
        html: await render(
          <AffiliateReactivationEmail
            affiliateName={args.affiliateName}
            portalName={args.portalName}
            brandLogoUrl={args.brandLogoUrl}
            brandPrimaryColor={args.brandPrimaryColor}
            portalLoginUrl={args.portalLoginUrl}
            contactEmail={args.contactEmail}
          />
        ),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Track the failure
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "affiliate_reactivated",
        recipientEmail: args.affiliateEmail,
        subject: `Your ${args.portalName} affiliate account has been reactivated!`,
        status: "failed",
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});
