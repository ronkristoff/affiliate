"use node";

/**
 * Dual-path email service abstraction.
 *
 * Two entry points to handle Convex's runtime constraints:
 * - `sendEmail` (internalAction): Full provider routing (Resend + Postmark).
 *   Used from action contexts or via `ctx.scheduler.runAfter(0, ...)`.
 * - `sendEmailFromMutation` (internalMutation): Resend-only inline sends.
 *   Throws if EMAIL_PROVIDER=postmark (Postmark SDK requires Node.js).
 *
 * Both paths include opt-in tracking, centralized from-address, and error handling.
 */

import Postmark from "postmark";
import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  ActionCtx,
  MutationCtx,
} from "./_generated/server";

// ── Centralized from-address ─────────────────────────────────────────────────

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;
if (!EMAIL_DOMAIN) {
  throw new Error("EMAIL_DOMAIN env var is required for email service");
}
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Salig Affiliate";

/** Build a from-address like "Salig Affiliate <prefix@domain.com>" */
export const getFromAddress = (prefix: string) =>
  `${FROM_NAME} <${prefix}@${EMAIL_DOMAIN}>`;

// ── Provider validation ──────────────────────────────────────────────────────

function getProvider(): "resend" | "postmark" {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider !== "resend" && provider !== "postmark") {
    throw new Error(
      `EMAIL_PROVIDER must be 'resend' or 'postmark', got '${provider ?? "(not set)"}'`
    );
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
    try {
      let messageId: string | undefined;

      if (provider === "postmark") {
        const token = process.env.POSTMARK_SERVER_TOKEN;
        if (!token) {
          throw new Error(
            "POSTMARK_SERVER_TOKEN env var is required when EMAIL_PROVIDER=postmark"
          );
        }
        const client = new Postmark.ServerClient(token);
        const result = await client.sendEmail({
          From: args.from,
          To: Array.isArray(args.to) ? args.to.join(",") : args.to,
          Subject: args.subject,
          HtmlBody: args.html,
          ReplyTo: args.replyTo,
          MessageStream: args.messageStream || "outbound",
        });
        messageId = result.MessageID;
      } else {
        // Resend path — @convex-dev/resend component requires MutationCtx type
        const resend = new Resend(components.resend, {
          testMode: process.env.EMAIL_TEST_MODE === "true",
        });
        const castCtx = ctx as unknown as MutationCtx;
        const result = await resend.sendEmail(castCtx, {
          from: args.from,
          to: Array.isArray(args.to) ? args.to.join(",") : args.to,
          subject: args.subject,
          html: args.html,
          replyTo: args.replyTo ? [args.replyTo] : undefined,
        });
        messageId = (result as unknown as { id?: string })?.id;
      }

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
          provider,
          resendMessageId: provider === "resend" ? messageId : undefined,
          postmarkMessageId: provider === "postmark" ? messageId : undefined,
        });
      }

      return { success: true, provider, messageId };
    } catch (error) {
      console.error(`[emailService] ${provider} send failed:`, error);

      // Track failed send
      if (args.tracking) {
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId: args.tracking.tenantId,
          type: args.tracking.type,
          recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
          subject: args.subject,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          broadcastId: args.tracking.broadcastId,
          affiliateId: args.tracking.affiliateId,
          provider,
        });
      }

      return { success: false, provider, messageId: undefined };
    }
  },
});

// ── sendEmailFromMutation (internalMutation) — Resend-only ───────────────────

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
    const provider = getProvider();

    if (provider === "postmark") {
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
      const result = await resend.sendEmail(ctx, {
        from: args.from,
        to: Array.isArray(args.to) ? args.to.join(",") : args.to,
        subject: args.subject,
        html: args.html,
        replyTo: args.replyTo ? [args.replyTo] : undefined,
      });
      const messageId = (result as unknown as { id?: string })?.id;

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
          provider,
          resendMessageId: messageId,
        });
      }

      return { success: true, provider, messageId };
    } catch (error) {
      console.error("[emailService] Resend send from mutation failed:", error);

      // Track failed send
      if (args.tracking) {
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId: args.tracking.tenantId,
          type: args.tracking.type,
          recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
          subject: args.subject,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          broadcastId: args.tracking.broadcastId,
          affiliateId: args.tracking.affiliateId,
          provider,
        });
      }

      return { success: false, provider, messageId: undefined };
    }
  },
});
