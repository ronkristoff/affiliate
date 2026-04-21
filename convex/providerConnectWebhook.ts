"use node";

import { action, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { getProvider } from "./lib/payoutProvider";
import { withStripeCircuitBreaker } from "./lib/providers/stripeConnectAdapter";
import { betterAuthComponent } from "./auth";
import { internal } from "./_generated/api";

const CONSECUTIVE_FAILURE_THRESHOLD = 3;

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

export const handleProviderConnectWebhook = action({
  args: {
    rawPayload: v.string(),
    sigHeader: v.string(),
  },
  returns: v.object({
    status: v.number(),
    duplicate: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx: ActionCtx, args) => {
    const webhookSecret = getWebhookSecret();
    if (!webhookSecret) {
      console.error("[ProviderWebhook] STRIPE_WEBHOOK_SECRET is not configured");
      return { status: 500, error: "Webhook secret not configured" };
    }

    const stripe = getStripe();
    if (!stripe) {
      console.error("[ProviderWebhook] Stripe client not configured");
      return { status: 500, error: "Stripe not configured" };
    }

    let verifiedEvent: Stripe.Event;

    try {
      verifiedEvent = stripe.webhooks.constructEvent(
        args.rawPayload,
        args.sigHeader,
        webhookSecret,
      );
    } catch {
      const failureCount: number = await ctx.runQuery(
        internal.affiliateProviderOnboarding.getWebhookSignatureFailureCount as any,
        {},
      );
      await ctx.runMutation(
        internal.affiliateProviderOnboarding.recordWebhookSignatureFailure as any,
        {},
      );

      if (failureCount + 1 >= CONSECUTIVE_FAILURE_THRESHOLD) {
        await ctx.runMutation(internal.errorLogs.logError, {
          severity: "warning",
          source: "providerWebhook",
          message:
            `${CONSECUTIVE_FAILURE_THRESHOLD} consecutive Stripe Connect webhook signature failures — possible secret compromise or rotation needed`,
          metadata: { failureCount: failureCount + 1 },
        });
      }

      return { status: 401, error: "Invalid signature" };
    }

    await ctx.runMutation(
      internal.affiliateProviderOnboarding.resetWebhookSignatureFailures as any,
      {},
    );

    const eventId = verifiedEvent.id;
    const eventType = verifiedEvent.type;

    const dedupResult = await ctx.runMutation(
      internal.webhooks.ensureEventNotProcessed,
      {
        source: "stripe_connect",
        eventId,
        eventType,
        rawPayload: args.rawPayload,
        signatureValid: true,
      },
    );

    if (dedupResult.isDuplicate) {
      return { status: 200, duplicate: true };
    }

    const rawWebhookId = dedupResult.webhookId!;

    try {
      const provider = getProvider("stripe_connect");
      if (!provider) {
        console.error("[ProviderWebhook] stripe_connect provider not registered");
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "failed",
          errorMessage: "Provider not registered",
        });
        return { status: 200, error: "Provider not registered" };
      }

      const identifiedType = provider.getWebhookEventType(verifiedEvent);
      if (!identifiedType) {
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "processed",
        });
        return { status: 200 };
      }

      if (identifiedType === "account.updated") {
        const result = await provider.handleWebhook(verifiedEvent);

        if (!result.providerAccountId) {
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }

        const affiliate = await ctx.runQuery(
          internal.affiliateProviderOnboarding.getAffiliateByProviderAccountId as any,
          { payoutProviderAccountId: result.providerAccountId },
        );

        if (!affiliate) {
          await ctx.runMutation(internal.errorLogs.logError, {
            severity: "warning",
            source: "providerWebhook",
            message: `No affiliate found for provider account ${result.providerAccountId}`,
            metadata: {
              providerAccountId: result.providerAccountId,
              eventType: identifiedType,
              eventId,
            },
          });
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }

        const statusDetails: Record<string, any> = {};
        if (result.details) {
          if (result.details.currentlyDue) {
            statusDetails.currentlyDue = result.details.currentlyDue;
          }
          if (result.details.eventuallyDue) {
            statusDetails.eventuallyDue = result.details.eventuallyDue;
          }
          if (result.details.pastDue) {
            statusDetails.pastDue = result.details.pastDue;
          }
          if (result.details.rejectionReason) {
            statusDetails.rejectionReason = result.details.rejectionReason;
          }
        }

        await ctx.runMutation(
          internal.affiliateProviderOnboarding.setAffiliateProviderStatusDetails as any,
          {
            affiliateId: affiliate._id,
            payoutProviderStatus: result.status,
            payoutProviderEnabled: result.enabled ?? false,
            payoutProviderStatusDetails:
              Object.keys(statusDetails).length > 0 ? statusDetails : undefined,
          },
        );

        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "processed",
        });

        return { status: 200 };
      }

      if (
        identifiedType === "transfer.failed" ||
        identifiedType === "transfer.created" ||
        identifiedType === "payout.paid" ||
        identifiedType === "payout.failed"
      ) {
        const result = await provider.handleWebhook(verifiedEvent);

        if (!result.payoutId) {
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }

        const payout: any = await ctx.runQuery(
          internal.payouts._getPayoutByIdInternal as any,
          { payoutId: result.payoutId as any },
        );

        if (!payout) {
          await ctx.runMutation(internal.errorLogs.logError, {
            severity: "warning",
            source: "providerWebhook",
            message: `No payout found for provider payoutId ${result.payoutId}`,
            metadata: {
              payoutId: result.payoutId,
              eventType: identifiedType,
              eventId,
            },
          });
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }

        if (identifiedType === "transfer.created") {
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }

        if (identifiedType === "transfer.failed" || identifiedType === "payout.failed") {
          if (payout.status !== "processing") {
            await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
              webhookId: rawWebhookId,
              status: "processed",
            });
            return { status: 200 };
          }
          const eventObj = (verifiedEvent as any).data?.object ?? {};
          const failureReason =
            eventObj.failure_message ||
            eventObj.failure_code ||
            `Provider ${identifiedType.replace(".", " ")}`;
          await ctx.runMutation(internal.payouts._markPayoutFailed as any, {
            payoutId: payout._id,
            failureReason,
          });
          await ctx.runMutation(internal.payouts._checkAndCloseBatch as any, {
            batchId: payout.batchId,
          });
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }

        if (identifiedType === "payout.paid") {
          if (payout.status !== "processing") {
            await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
              webhookId: rawWebhookId,
              status: "processed",
            });
            return { status: 200 };
          }
          await ctx.runMutation(internal.payouts._markPayoutPaidByProvider as any, {
            payoutId: payout._id,
            providerPayoutId: result.paymentReference,
          });
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: rawWebhookId,
            status: "processed",
          });
          return { status: 200 };
        }
      }

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: rawWebhookId,
        status: "processed",
      });
      return { status: 200 };
    } catch (err) {
      console.error("[ProviderWebhook] Processing error:", err);
      try {
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        });
      } catch {
        // ignore — don't throw, always return 200
      }
      return { status: 200 };
    }
  },
});

export const getProviderBalance = action({
  args: {},
  returns: v.union(
    v.object({
      available: v.number(),
      pending: v.number(),
      currency: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx: ActionCtx) => {
    const provider = getProvider("stripe_connect");
    if (!provider) {
      return null;
    }

    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!betterAuthUser) {
      return null;
    }

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const user: any = await ctx.runQuery(
      internal.users._getUserByEmailInternal as any,
      { email: cleanEmail },
    );
    if (!user || !user.tenantId) {
      return null;
    }

    const tenant = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getTenantStripeConfigInternal as any,
      { tenantId: user.tenantId },
    );
    if (!tenant || !tenant.stripeAccountId) {
      return null;
    }

    const cbResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await provider.getBalance(tenant.stripeAccountId);
      },
      null as any,
    );
    if (!cbResult.ok) {
      return null;
    }

    return cbResult.data;
  },
});

export const sendPayoutViaProvider = action({
  args: {
    payoutId: v.id("payouts"),
  },
  returns: v.object({
    success: v.boolean(),
    transferId: v.optional(v.string()),
    payoutStatus: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx: ActionCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return { success: false, error: "Authentication required" };
    }
    if (!betterAuthUser) {
      return { success: false, error: "Authentication required" };
    }

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const user: any = await ctx.runQuery(
      internal.users._getUserByEmailInternal as any,
      { email: cleanEmail },
    );
    if (!user || !user.tenantId) {
      return { success: false, error: "User not found" };
    }
    const tenantId = user.tenantId;

    const payout: any = await ctx.runQuery(
      internal.payouts._getPayoutByIdInternal as any,
      { payoutId: args.payoutId },
    );
    if (!payout || payout.tenantId !== tenantId) {
      return { success: false, error: "Payout not found" };
    }
    if (payout.status !== "pending") {
      return { success: false, error: `Payout is already ${payout.status}` };
    }

    const affiliate: any = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
      { email: payout.affiliateEmail },
    );
    if (!affiliate) {
      return { success: false, error: "Affiliate not found" };
    }
    if (!affiliate.payoutProviderEnabled) {
      return { success: false, error: "Affiliate has not completed provider setup" };
    }
    if (!affiliate.payoutProviderAccountId) {
      return { success: false, error: "Affiliate has no provider account linked" };
    }

    const tenant: any = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getTenantStripeConfigInternal as any,
      { tenantId },
    );
    if (!tenant || !tenant.stripeAccountId) {
      return { success: false, error: "Provider not configured for your account" };
    }

    const provider = getProvider("stripe_connect");
    if (!provider) {
      return { success: false, error: "Provider not available" };
    }

    const cbResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await provider.createTransfer({
          payoutId: payout._id,
          batchId: payout.batchId,
          tenantId,
          affiliateId: affiliate._id,
          amount: payout.amount,
          currency: "php",
          destinationAccountId: affiliate.payoutProviderAccountId,
          tenantProviderAccountId: tenant.stripeAccountId,
        });
      },
      null as any,
    );
    if (!cbResult.ok) {
      return { success: false, error: "Transfer failed. Please try again later." };
    }
    const transferId = cbResult.data.transferId;

    await ctx.runMutation(
      internal.payouts._markPayoutProcessing as any,
      {
        payoutId: payout._id,
        paymentSource: "stripe",
        paymentReference: transferId,
      },
    );

    await ctx.runMutation(internal.payouts._incrementProviderCount as any, {
      batchId: payout.batchId,
      providerType: "stripe",
    });

    await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
      tenantId,
      action: "payout_sent_provider",
      entityType: "payouts",
      entityId: payout._id,
      actorId: user._id,
      actorType: "user",
      targetId: payout.batchId,
      metadata: {
        affiliateId: affiliate._id,
        transferId,
        amount: payout.amount,
        providerType: "stripe",
      },
    });

    return { success: true, transferId, payoutStatus: "processing" };
  },
});

export const sendAllEligibleViaProvider = action({
  args: { batchId: v.id("payoutBatches") },
  returns: v.object({
    sent: v.number(),
    skipped: v.number(),
    totalAmount: v.number(),
    sentAmount: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx: ActionCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return { sent: 0, skipped: 0, totalAmount: 0, sentAmount: 0, errors: ["Authentication required"] };
    }
    if (!betterAuthUser) {
      return { sent: 0, skipped: 0, totalAmount: 0, sentAmount: 0, errors: ["Authentication required"] };
    }

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const user: any = await ctx.runQuery(
      internal.users._getUserByEmailInternal as any,
      { email: cleanEmail },
    );
    if (!user || !user.tenantId) {
      return { sent: 0, skipped: 0, totalAmount: 0, sentAmount: 0, errors: ["User not found"] };
    }
    const tenantId = user.tenantId;

    const tenant: any = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getTenantStripeConfigInternal as any,
      { tenantId },
    );
    if (!tenant || !tenant.stripeAccountId) {
      return { sent: 0, skipped: 0, totalAmount: 0, sentAmount: 0, errors: ["Provider not configured"] };
    }

    const provider = getProvider("stripe_connect");
    if (!provider) {
      return { sent: 0, skipped: 0, totalAmount: 0, sentAmount: 0, errors: ["Provider not available"] };
    }

    const batchPayouts: any[] = await ctx.runQuery(
      internal.payouts._getEligibleProviderPayoutsInternal as any,
      { batchId: args.batchId },
    );
    if (!batchPayouts || batchPayouts.length === 0) {
      return { sent: 0, skipped: 0, totalAmount: 0, sentAmount: 0, errors: ["No eligible payouts found"] };
    }

    const cbBalanceResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await provider.getBalance(tenant.stripeAccountId);
      },
      null as any,
    );
    if (!cbBalanceResult.ok) {
      return { sent: 0, skipped: batchPayouts.length, totalAmount: batchPayouts.reduce((s, p) => s + p.amount, 0), sentAmount: 0, errors: ["Unable to fetch balance"] };
    }
    const availableBalance = cbBalanceResult.data.available;

    const sorted = [...batchPayouts].sort((a, b) => a.amount - b.amount);
    let runningTotal = 0;
    const toSend: typeof sorted[0][] = [];
    for (const p of sorted) {
      if (runningTotal + p.amount <= availableBalance) {
        toSend.push(p);
        runningTotal += p.amount;
      }
    }
    const toSkip = sorted.filter((p) => !toSend.includes(p));

    let sent = 0;
    let sentAmount = 0;
    const errors: string[] = [];

    for (const p of toSend) {
      try {
        const affiliate: any = await ctx.runQuery(
          internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
          { email: p.affiliateEmail },
        );
        if (!affiliate || !affiliate.payoutProviderEnabled || !affiliate.payoutProviderAccountId) {
          errors.push(`Affiliate ${p.affiliateEmail} not provider-enabled`);
          continue;
        }

        const cbResult = await withStripeCircuitBreaker(
          ctx,
          async () => {
            return await provider.createTransfer({
              payoutId: p._id,
              batchId: args.batchId,
              tenantId,
              affiliateId: affiliate._id,
              amount: p.amount,
              currency: "php",
              destinationAccountId: affiliate.payoutProviderAccountId,
              tenantProviderAccountId: tenant.stripeAccountId,
            });
          },
          null as any,
        );
        if (!cbResult.ok) {
          errors.push(`Transfer failed for ${p.affiliateEmail}`);
          continue;
        }

        await ctx.runMutation(
          internal.payouts._markPayoutProcessing as any,
          {
            payoutId: p._id,
            paymentSource: "stripe",
            paymentReference: cbResult.data.transferId,
          },
        );

        await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
          tenantId,
          action: "payout_sent_provider",
          entityType: "payouts",
          entityId: p._id,
          actorId: user._id,
          actorType: "user",
          targetId: args.batchId,
          metadata: {
            affiliateId: affiliate._id,
            transferId: cbResult.data.transferId,
            amount: p.amount,
            providerType: "stripe",
          },
        });

        sent++;
        sentAmount += p.amount;
      } catch (err) {
        errors.push(`Error sending to ${p.affiliateEmail}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    await ctx.runMutation(internal.payouts._incrementProviderCount as any, {
      batchId: args.batchId,
      providerType: "stripe",
      count: sent,
    });

    return { sent, skipped: toSkip.length, totalAmount: batchPayouts.reduce((s, p) => s + p.amount, 0), sentAmount, errors };
  },
});

export const retryPayoutViaProvider = action({
  args: {
    payoutId: v.id("payouts"),
  },
  returns: v.object({
    success: v.boolean(),
    transferId: v.optional(v.string()),
    payoutStatus: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx: ActionCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return { success: false, error: "Authentication required" };
    }
    if (!betterAuthUser) {
      return { success: false, error: "Authentication required" };
    }

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const user: any = await ctx.runQuery(
      internal.users._getUserByEmailInternal as any,
      { email: cleanEmail },
    );
    if (!user || !user.tenantId) {
      return { success: false, error: "User not found" };
    }
    const tenantId = user.tenantId;

    const payout: any = await ctx.runQuery(
      internal.payouts._getPayoutByIdInternal as any,
      { payoutId: args.payoutId },
    );
    if (!payout || payout.tenantId !== tenantId) {
      return { success: false, error: "Payout not found" };
    }
    if (payout.status !== "failed") {
      return { success: false, error: `Only failed payouts can be retried (current: ${payout.status})` };
    }

    const affiliate: any = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
      { email: payout.affiliateEmail },
    );
    if (!affiliate) {
      return { success: false, error: "Affiliate not found" };
    }
    if (!affiliate.payoutProviderEnabled) {
      return { success: false, error: "Affiliate has not completed provider setup" };
    }
    if (!affiliate.payoutProviderAccountId) {
      return { success: false, error: "Affiliate has no provider account linked" };
    }

    const tenant: any = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getTenantStripeConfigInternal as any,
      { tenantId },
    );
    if (!tenant || !tenant.stripeAccountId) {
      return { success: false, error: "Provider not configured for your account" };
    }

    const provider = getProvider("stripe_connect");
    if (!provider) {
      return { success: false, error: "Provider not available" };
    }

    const cbResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await provider.createTransfer({
          payoutId: payout._id,
          batchId: payout.batchId,
          tenantId,
          affiliateId: affiliate._id,
          amount: payout.amount,
          currency: "php",
          destinationAccountId: affiliate.payoutProviderAccountId,
          tenantProviderAccountId: tenant.stripeAccountId,
        });
      },
      null as any,
    );
    if (!cbResult.ok) {
      return { success: false, error: "Retry transfer failed. Please try again later." };
    }
    const transferId = cbResult.data.transferId;

    await ctx.runMutation(
      internal.payouts._markPayoutProcessing as any,
      {
        payoutId: payout._id,
        paymentSource: "stripe",
        paymentReference: transferId,
      },
    );

    await ctx.runMutation(internal.payouts._incrementProviderCount as any, {
      batchId: payout.batchId,
      providerType: "stripe",
    });

    await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
      tenantId,
      action: "payout_retry_provider",
      entityType: "payouts",
      entityId: payout._id,
      actorId: user._id,
      actorType: "user",
      targetId: payout.batchId,
      metadata: {
        affiliateId: affiliate._id,
        transferId,
        amount: payout.amount,
        providerType: "stripe",
      },
    });

    return { success: true, transferId, payoutStatus: "processing" };
  },
});
