"use node";

/**
 * Email service — Node.js runtime (required for Postmark SDK).
 *
 * - `sendEmail` (internalAction): Full provider routing (Resend + Postmark).
 *   Used from action contexts or via `ctx.scheduler.runAfter(0, ...)`.
 *
 * - `sendEmailFromMutation` lives in `emailServiceMutation.ts` (no "use node")
 *   because Convex only allows actions in Node.js files.
 *
 * Both paths include opt-in tracking, centralized from-address, and error handling.
 */

import * as Postmark from "postmark";
import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import {
  internalAction,
  MutationCtx,
} from "./_generated/server";

// ── Centralized from-address ─────────────────────────────────────────────────

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "developer@microsource.com.ph";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Microsource Support";

/** Returns the single verified from-address: "Microsource Support <developer@microsource.com.ph>" */
export const getFromAddress = (_prefix?: string) =>
  `${FROM_NAME} <${FROM_ADDRESS}>`;

// ── Provider validation ──────────────────────────────────────────────────────

function getProvider(): "resend" | "postmark" {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider !== "resend" && provider !== "postmark") {
    console.error(`[emailService] ❌ EMAIL_PROVIDER env var is invalid or missing: '${provider ?? "(not set)"}'`);
    console.error(`[emailService]   Set EMAIL_PROVIDER to 'resend' or 'postmark'`);
    throw new Error(
      `EMAIL_PROVIDER must be 'resend' or 'postmark', got '${provider ?? "(not set)"}'`
    );
  }
  console.log(`[emailService] Provider resolved: ${provider}`);
  if (provider === "postmark") {
    console.log(`[emailService]   POSTMARK_SERVER_TOKEN present: ${!!process.env.POSTMARK_SERVER_TOKEN}`);
  }
  return provider;
}

// ── sendEmail (internalAction) — Full provider routing ───────────────────────

export const sendEmail = internalAction({
  args: {
    from: v.string(),
    to: v.union(v.string(), v.array(v.string())),
    subject: v.string(),
    html: v.string(),
    replyTo: v.optional(v.string()),
    messageStream: v.optional(v.string()),
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
    const provider = getProvider();
    const recipientStr = Array.isArray(args.to) ? args.to.join(",") : args.to;

    console.log(`[emailService] sendEmail called`);
    console.log(`[emailService]   provider: ${provider}`);
    console.log(`[emailService]   from: ${args.from}`);
    console.log(`[emailService]   to: ${recipientStr}`);
    console.log(`[emailService]   subject: ${args.subject}`);
    console.log(`[emailService]   replyTo: ${args.replyTo ?? "(none)"}`);
    console.log(`[emailService]   messageStream: ${args.messageStream ?? "(default outbound)"}`);
    console.log(`[emailService]   hasTracking: ${!!args.tracking}`);
    console.log(`[emailService]   EMAIL_TEST_MODE: ${process.env.EMAIL_TEST_MODE ?? "(not set)"}`);

    try {
      let messageId: string | undefined;

      if (provider === "postmark") {
        const token = process.env.POSTMARK_SERVER_TOKEN;
        console.log(`[emailService] Postmark token present: ${!!token}`);
        if (!token) {
          throw new Error(
            "POSTMARK_SERVER_TOKEN env var is required when EMAIL_PROVIDER=postmark"
          );
        }
        const client = new Postmark.ServerClient(token);
        console.log(`[emailService] Calling Postmark API...`);
        const result = await client.sendEmail({
          From: args.from,
          To: recipientStr,
          Subject: args.subject,
          HtmlBody: args.html,
          ReplyTo: args.replyTo,
          MessageStream: args.messageStream || "outbound",
        });
        messageId = result.MessageID;
        console.log(`[emailService] Postmark response:`, JSON.stringify(result, null, 2));
        console.log(`[emailService] Postmark MessageID: ${messageId}`);
      } else {
        // Resend path — @convex-dev/resend component requires MutationCtx type
        console.log(`[emailService] Using Resend provider...`);
        const resend = new Resend(components.resend, {
          testMode: process.env.EMAIL_TEST_MODE === "true",
        });
        const castCtx = ctx as unknown as MutationCtx;
        const result = await resend.sendEmail(castCtx, {
          from: args.from,
          to: recipientStr,
          subject: args.subject,
          html: args.html,
          replyTo: args.replyTo ? [args.replyTo] : undefined,
        });
        messageId = (result as unknown as { id?: string })?.id;
        console.log(`[emailService] Resend response:`, JSON.stringify(result, null, 2));
        console.log(`[emailService] Resend messageId: ${messageId ?? "(none)"}`);
      }

      // Track successful send
      if (args.tracking) {
        console.log(`[emailService] Tracking email send in emails table...`);
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId: args.tracking.tenantId,
          type: args.tracking.type,
          recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
          subject: args.subject,
          status: "sent",
          broadcastId: args.tracking.broadcastId,
          affiliateId: args.tracking.affiliateId,
          provider,
          resendMessageId: provider === "resend" ? messageId : undefined,
          postmarkMessageId: provider === "postmark" ? messageId : undefined,
        });
        console.log(`[emailService] Email tracking recorded successfully`);
      }

      console.log(`[emailService] ✅ Email sent successfully via ${provider}, messageId=${messageId ?? "(none)"}`);
      return { success: true, provider, messageId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[emailService] ❌ ${provider} send FAILED`);
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
          provider,
        });
      }

      return { success: false, provider, messageId: undefined };
    }
  },
});


