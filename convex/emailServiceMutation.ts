/**
 * sendEmailFromMutation — Resend-only inline sends from mutation context.
 *
 * Lives in a separate file WITHOUT "use node" because Convex only allows
 * actions (not mutations) in Node.js files.
 *
 * Throws if EMAIL_PROVIDER=postmark (Postmark SDK requires Node.js).
 * Callers using Postmark must use `sendEmail` action via
 * ctx.scheduler.runAfter(0, internal.emailService.sendEmail, ...) instead.
 */

import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";

export const sendEmailFromMutation = internalMutation({
  args: {
    from: v.string(),
    to: v.union(v.string(), v.array(v.string())),
    subject: v.string(),
    html: v.string(),
    replyTo: v.optional(v.string()),
    tracking: v.optional(
      v.object({
        tenantId: v.id("tenants"),
        type: v.string(),
        affiliateId: v.optional(v.id("affiliates")),
        broadcastId: v.optional(v.id("broadcastEmails")),
      })
    ),
  },
  returns: v.object({
    success: v.boolean(),
    provider: v.string(),
    messageId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const provider = process.env.EMAIL_PROVIDER;
    const recipientStr = Array.isArray(args.to) ? args.to.join(",") : args.to;

    console.log(`[emailService] sendEmailFromMutation called`);
    console.log(`[emailService]   provider: ${provider ?? "(not set)"}`);
    console.log(`[emailService]   from: ${args.from}`);
    console.log(`[emailService]   to: ${recipientStr}`);
    console.log(`[emailService]   subject: ${args.subject}`);
    console.log(`[emailService]   EMAIL_TEST_MODE: ${process.env.EMAIL_TEST_MODE ?? "(not set)"}`);

    if (provider === "postmark") {
      console.error(`[emailService] ❌ BLOCKED: Postmark cannot send from mutation context. Caller must use sendEmail action via scheduler.`);
      throw new Error(
        "Postmark emails cannot be sent from mutation context. " +
          "Use sendEmail action via ctx.scheduler.runAfter(0, internal.emailService.sendEmail, ...) instead."
      );
    }

    // Resend component works in mutation context
    const resend = new Resend(components.resend, {
      testMode: process.env.EMAIL_TEST_MODE === "true",
    });

    try {
      console.log(`[emailService] Calling Resend from mutation context...`);
      const result = await resend.sendEmail(ctx, {
        from: args.from,
        to: recipientStr,
        subject: args.subject,
        html: args.html,
        replyTo: args.replyTo ? [args.replyTo] : undefined,
      });
      const messageId = (result as unknown as { id?: string })?.id;
      console.log(`[emailService] Resend (mutation) response:`, JSON.stringify(result, null, 2));
      console.log(`[emailService] Resend (mutation) messageId: ${messageId ?? "(none)"}`);

      // Track successful send
      if (args.tracking) {
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId: args.tracking.tenantId,
          type: args.tracking.type,
          recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
          subject: args.subject,
          status: "sent",
          broadcastId: args.tracking.broadcastId,
          affiliateId: args.tracking.affiliateId,
          provider: "resend",
          resendMessageId: messageId,
        });
      }

      console.log(`[emailService] ✅ Email sent successfully via Resend (mutation), messageId=${messageId ?? "(none)"}`);
      return { success: true, provider: "resend", messageId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[emailService] ❌ Resend send from mutation FAILED`);
      console.error(`[emailService]   Error message: ${errorMsg}`);
      console.error(`[emailService]   Error stack:`, error instanceof Error ? error.stack : "(no stack)");
      console.error(`[emailService]   Full error:`, error);

      // Track failed send
      if (args.tracking) {
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId: args.tracking.tenantId,
          type: args.tracking.type,
          recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
          subject: args.subject,
          status: "failed",
          errorMessage: errorMsg,
          broadcastId: args.tracking.broadcastId,
          affiliateId: args.tracking.affiliateId,
          provider: "resend",
        });
      }

      return { success: false, provider: "resend", messageId: undefined };
    }
  },
});
