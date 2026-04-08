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
import { type MutationCtx, action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/components";
import React from "react";
import ResetPasswordEmail from "./emails/resetPassword";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { sendEmailFromMutation as _sendEmailFromMutation } from "./emailServiceMutation";
import { sendEmail, getFromAddress } from "./emailService";

// Workaround: RegisteredMutation type doesn't expose callable signature to tsc,
// but Convex runtime supports calling internal mutations directly with (ctx, args).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendEmailFromMutation = _sendEmailFromMutation as any;

// Re-export getFromAddress for callers that need from-address construction
export { getFromAddress };

// ── Group A: Better Auth helpers (untracked) ────────────────────────────────

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
  await sendEmailFromMutation(ctx, {
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
    purpose,
  }: {
    to: string;
    code: string;
    purpose?: "email-verification" | "sign-in" | "forget-password";
  },
) => {
  const subject = purpose === "forget-password"
    ? "Reset your password"
    : "Verify your email address";
  await sendEmailFromMutation(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject,
    html: await render(<VerifyOTP code={code} purpose={purpose} />),
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
  await sendEmailFromMutation(ctx, {
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
  await sendEmailFromMutation(ctx, {
    from: getFromAddress("onboarding"),
    to,
    subject: "Reset your password",
    html: await render(<ResetPasswordEmail url={url} />),
  });
};

// ── Group B: Billing helpers (with tracking) ────────────────────────────────

export const sendUpgradeConfirmation = async (
  ctx: MutationCtx,
  {
    to,
    previousPlan,
    newPlan,
    proratedAmount,
    effectiveDate,
    newBillingAmount,
    tenantId,
  }: {
    to: string;
    previousPlan: string;
    newPlan: string;
    proratedAmount: number;
    effectiveDate: number;
    newBillingAmount: number;
    tenantId: Id<"tenants">;
  },
) => {
  await sendEmailFromMutation(ctx, {
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
    tracking: {
      tenantId,
      type: "billing_upgrade",
    },
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
    tenantId,
  }: {
    to: string;
    previousPlan: string;
    newPlan: string;
    effectiveDate: number;
    newBillingAmount: number;
    tenantId: Id<"tenants">;
  },
) => {
  await sendEmailFromMutation(ctx, {
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
    tracking: {
      tenantId,
      type: "billing_downgrade",
    },
  });
};

export const sendCancellationConfirmation = async (
  ctx: MutationCtx,
  {
    to,
    previousPlan,
    accessEndDate,
    deletionDate,
    tenantId,
  }: {
    to: string;
    previousPlan: string;
    accessEndDate: number;
    deletionDate: number;
    tenantId: Id<"tenants">;
  },
) => {
  await sendEmailFromMutation(ctx, {
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
    tracking: {
      tenantId,
      type: "billing_cancellation",
    },
  });
};

/**
 * Send subscription deletion reminder email.
 * Renamed from sendDeletionReminder to avoid collision with tenants.ts.
 */
export const sendSubscriptionDeletionReminder = async (
  ctx: MutationCtx,
  {
    to,
    deletionDate,
    daysUntilDeletion,
    tenantId,
  }: {
    to: string;
    deletionDate: number;
    daysUntilDeletion: number;
    tenantId: Id<"tenants">;
  },
) => {
  await sendEmailFromMutation(ctx, {
    from: getFromAddress("billing"),
    to,
    subject: "Urgent: Your account will be deleted soon",
    html: await render(
      <DeletionReminderEmail
        deletionDate={new Date(deletionDate).toLocaleDateString()}
        daysUntilDeletion={daysUntilDeletion}
      />
    ),
    tracking: {
      tenantId,
      type: "billing_deletion_reminder",
    },
  });
};

// Backward compatibility alias — callers that use the old name
export const sendDeletionReminder = sendSubscriptionDeletionReminder;

// ── Group C: Affiliate helpers ──────────────────────────────────────────────

/**
 * Send welcome email to new affiliate after registration.
 * Uses retry logic with exponential backoff and comprehensive error logging.
 */
export const sendAffiliateWelcomeEmail = async (
  ctx: MutationCtx,
  {
    to,
    affiliateName,
    affiliateEmail,
    uniqueCode,
    portalName,
    referralUrl,
    brandLogoUrl,
    brandPrimaryColor,
    approvalTimeframe,
    contactEmail,
    maxRetries,
    tenantId,
  }: {
    to: string;
    affiliateName: string;
    affiliateEmail: string;
    uniqueCode: string;
    portalName: string;
    referralUrl: string;
    brandLogoUrl?: string;
    brandPrimaryColor?: string;
    approvalTimeframe?: string;
    contactEmail?: string;
    maxRetries?: number;
    tenantId?: Id<"tenants">;
  },
) => {
  const subject = `Welcome to ${portalName}! Your application is pending approval`;
  const maxAttempts = maxRetries || 3;
  const baseDelay = 1000; // 1 second base delay

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      // Send via unified email service (Resend-only from mutation context)
      await sendEmailFromMutation(ctx, {
        from: getFromAddress("onboarding"),
        to,
        subject,
        html: await render(
          <AffiliateWelcomeEmail
            affiliateName={affiliateName}
            affiliateEmail={affiliateEmail}
            uniqueCode={uniqueCode}
            portalName={portalName}
            referralUrl={referralUrl}
            brandLogoUrl={brandLogoUrl}
            brandPrimaryColor={brandPrimaryColor}
            approvalTimeframe={approvalTimeframe}
            contactEmail={contactEmail}
          />
        ),
        tracking: tenantId ? {
          tenantId,
          type: "affiliate_welcome",
        } : undefined,
      });

      return; // Success, exit function
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw new Error(`Failed to send welcome email after ${maxAttempts + 1} attempts: ${errorMessage}`);
      }

      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt);

      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Action: Send welcome email with retry logic.
 * Uses exponential backoff for retry attempts.
 */
export const sendAffiliateWelcomeEmailWithRetry = internalAction({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    to: v.string(),
    affiliateName: v.string(),
    affiliateEmail: v.string(),
    uniqueCode: v.string(),
    portalName: v.string(),
    referralUrl: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    approvalTimeframe: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    maxRetries: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    retryCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    errorMessage?: string;
    retryCount: number;
  }> => {
    const maxRetries = args.maxRetries || 3;
    let retryCount = 0;
    const baseDelay = 1000; // 1 second base delay

    const subject = `Welcome to ${args.portalName}! Your application is pending approval`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Send via unified email service (full provider routing from action context)
        const result = await ctx.runAction(internal.emailService.sendEmail, {
          from: getFromAddress("onboarding"),
          to: args.to,
          subject,
          html: await render(
            <AffiliateWelcomeEmail
              affiliateName={args.affiliateName}
              affiliateEmail={args.affiliateEmail}
              uniqueCode={args.uniqueCode}
              portalName={args.portalName}
              referralUrl={args.referralUrl}
              brandLogoUrl={args.brandLogoUrl}
              brandPrimaryColor={args.brandPrimaryColor}
              approvalTimeframe={args.approvalTimeframe}
              contactEmail={args.contactEmail}
            />
          ),
          tracking: {
            tenantId: args.tenantId,
            type: "affiliate_welcome",
            affiliateId: args.affiliateId,
          },
        });

        return { success: result.success, retryCount: attempt };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        retryCount = attempt;

        // If this was the last attempt, return failure
        if (attempt === maxRetries) {
          return { success: false, errorMessage, retryCount };
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt);

        // Wait for the delay
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success: false, errorMessage: "Max retries exceeded", retryCount };
  },
});

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
    tenantId,
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
    tenantId?: Id<"tenants">;
  },
) => {
  await sendEmailFromMutation(ctx, {
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
    tracking: tenantId ? {
      tenantId,
      type: "new_affiliate_notification",
    } : undefined,
  });
};

// ── Group D: Action functions (fix pre-tracking bug) ───────────────────────

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
    const subject = `Your application to ${args.portalName} has been approved!`;
    try {
      await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject,
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
        tracking: {
          tenantId: args.tenantId,
          type: "affiliate_approved",
          affiliateId: args.affiliateId,
        },
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    const subject = `Update on your ${args.portalName} affiliate application`;
    try {
      await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject,
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
        tracking: {
          tenantId: args.tenantId,
          type: "affiliate_rejected",
          affiliateId: args.affiliateId,
        },
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    const subject = `Your ${args.portalName} affiliate account has been suspended`;
    try {
      await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject,
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
        tracking: {
          tenantId: args.tenantId,
          type: "affiliate_suspended",
          affiliateId: args.affiliateId,
        },
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    const subject = `Your ${args.portalName} affiliate account has been reactivated!`;
    try {
      await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("notifications"),
        to: args.affiliateEmail,
        subject,
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
        tracking: {
          tenantId: args.tenantId,
          type: "affiliate_reactivated",
          affiliateId: args.affiliateId,
        },
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },
});

// ── Group E: Internal action for Better Auth emails (works in any ctx) ───────
// Better Auth callbacks can run in mutation OR action context.
// `requireMutationCtx` throws when called from action context.
// This action uses the full sendEmail path (supports both Resend and Postmark).
// Called via ctx.runAction from auth callbacks.

export const sendAuthEmail = internalAction({
  args: {
    type: v.union(
      v.literal("verifyEmail"),
      v.literal("magicLink"),
      v.literal("resetPassword"),
      v.literal("otp")
    ),
    to: v.string(),
    url: v.optional(v.string()),
    otp: v.optional(v.string()),
    purpose: v.optional(v.union(
      v.literal("email-verification"),
      v.literal("sign-in"),
      v.literal("forget-password")
    )),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    console.log(`[emailService] sendAuthEmail called: type=${args.type}, purpose=${args.purpose ?? "(none)"}, to=${args.to}`);
    try {
      let subject: string;
      let html: string;

      switch (args.type) {
        case "verifyEmail":
          subject = "Verify your email address";
          html = await render(<VerifyEmail url={args.url!} />);
          break;
        case "magicLink":
          subject = "Sign in to your account";
          html = await render(<MagicLinkEmail url={args.url!} />);
          break;
        case "resetPassword":
          subject = "Reset your password";
          html = await render(<ResetPasswordEmail url={args.url!} />);
          break;
        case "otp":
          subject = args.purpose === "forget-password"
            ? "Reset your password"
            : args.purpose === "sign-in"
              ? "Sign in to your account"
              : "Verify your email address";
          html = await render(<VerifyOTP code={args.otp!} purpose={args.purpose} />);
          break;
      }

      const result: { success: boolean; messageId?: string } = await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("onboarding"),
        to: args.to,
        subject,
        html,
      });

      return { success: result.success, error: result.success ? undefined : "Email send failed" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[emailService] sendAuthEmail FAILED: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  },
});
