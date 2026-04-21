"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const runScheduledPayouts = internalAction({
  args: {},
  returns: v.object({
    tenantsChecked: v.number(),
    tenantsProcessed: v.number(),
    batchesCreated: v.number(),
    transfersSent: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const today = new Date();
    const dayOfMonth = today.getUTCDate();

    const allTenants: Array<any> = await ctx.runQuery(
      internal.scheduledPayoutsQueries._getStripeEnabledTenants as any,
      {},
    );

    const dueTenants = allTenants.filter((t: any) => {
      if (t.status !== "active") return false;
      const payoutDay = t.payoutSchedule?.payoutDayOfMonth;
      if (!payoutDay) return false;
      return payoutDay === dayOfMonth;
    });

    if (dueTenants.length === 0) {
      return {
        tenantsChecked: allTenants.length,
        tenantsProcessed: 0,
        batchesCreated: 0,
        transfersSent: 0,
        errors: [],
      };
    }

    let tenantsProcessed = 0;
    let batchesCreated = 0;
    let transfersSent = 0;
    const errors: string[] = [];

    for (const tenant of dueTenants) {
      try {
        const eligible: any[] = await ctx.runQuery(
          internal.scheduledPayoutsQueries._getEligibleCommissions as any,
          {
            tenantId: tenant._id,
            processingCutoff: Date.now() - (tenant.payoutSchedule?.payoutProcessingDays ?? 0) * 24 * 60 * 60 * 1000,
          },
        );

        if (eligible.length === 0) {
          tenantsProcessed++;
          continue;
        }

        const totalAmount = eligible.reduce((sum, e) => sum + e.amount, 0);

        const balanceCheckResult = await ctx.runAction(
          internal.scheduledPayouts._checkBalanceForBatch as any,
          {
            tenantId: tenant._id,
            stripeAccountId: tenant.stripeAccountId,
            totalAmount,
          },
        );

        if (!balanceCheckResult.sufficient) {
          try {
            await ctx.runMutation(internal.errorLogs.logError, {
              severity: "warning",
              source: "scheduledPayouts",
              message: `Scheduled auto-payout skipped: insufficient Stripe balance for tenant ${tenant._id}`,
              metadata: {
                tenantId: tenant._id,
                reason: "skipped_insufficient_balance",
                available: balanceCheckResult.available,
                needed: totalAmount,
                shortfall: balanceCheckResult.shortfall,
              },
            });
          } catch {
            // ignore
          }
          try {
            await ctx.runAction(internal.scheduledPayouts._sendInsufficientBalanceEmail as any, {
              tenantId: tenant._id,
              available: balanceCheckResult.available,
              needed: totalAmount,
              shortfall: balanceCheckResult.shortfall,
            });
          } catch {
            // email failure non-fatal
          }
          tenantsProcessed++;
          continue;
        }

        const batchResult: any = await ctx.runMutation(
          internal.scheduledPayoutsQueries._generateBatch as any,
          {
            tenantId: tenant._id,
            eligible,
            minimumPayoutAmount: tenant.payoutSchedule?.minimumPayoutAmount ?? 0,
          },
        );

        if (!batchResult.batchCreated) {
          tenantsProcessed++;
          continue;
        }

        batchesCreated++;
        const sentResult = await ctx.runAction(
          internal.scheduledPayouts._sendBatchTransfers as any,
          {
            tenantId: tenant._id,
            batchId: batchResult.batchId,
            stripeAccountId: tenant.stripeAccountId,
            payouts: batchResult.payouts,
          },
        );
        transfersSent += sentResult.transfersSent;
        if (sentResult.failedPayouts > 0 && sentResult.transfersSent > 0) {
          const remainingAmount = (batchResult.payouts as Array<{ amount: number }>)
            .slice(sentResult.transfersSent)
            .reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
          try {
            await ctx.runAction(internal.scheduledPayouts._sendPartialCompletionEmail as any, {
              tenantId: tenant._id,
              batchId: batchResult.batchId,
              sentCount: sentResult.transfersSent,
              totalCount: sentResult.totalPayouts,
              failedCount: sentResult.failedPayouts,
              remainingAmount,
              failureReason: sentResult.failureReason ?? "Unknown error",
            });
          } catch {
            // email failure non-fatal
          }
        } else if (sentResult.failedPayouts > 0 && sentResult.transfersSent === 0) {
          const totalAmount = (batchResult.payouts as Array<{ amount: number }>).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
          try {
            await ctx.runMutation(internal.errorLogs.logError, {
              severity: "warning",
              source: "scheduledPayouts",
              message: `All transfers failed for batch ${batchResult.batchId}`,
              metadata: {
                tenantId: tenant._id,
                batchId: batchResult.batchId,
                failureReason: sentResult.failureReason,
                totalAmount,
              },
            });
          } catch {
            // ignore
          }
        } else if (sentResult.failedPayouts === 0 && sentResult.transfersSent > 0) {
          const totalSent = (batchResult.payouts as Array<{ amount: number }>).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
          try {
            await ctx.runAction(internal.scheduledPayouts._sendCompletionEmail as any, {
              tenantId: tenant._id,
              batchId: batchResult.batchId,
              affiliatesPaid: sentResult.transfersSent,
              totalAmount: totalSent,
            });
          } catch {
            // email failure non-fatal
          }
        }
        tenantsProcessed++;
      } catch (err) {
        const msg = `Tenant ${tenant._id}: ${err instanceof Error ? err.message : "Unknown error"}`;
        errors.push(msg);
        try {
          await ctx.runMutation(internal.errorLogs.logError, {
            severity: "warning",
            source: "scheduledPayouts",
            message: `Scheduled payout failed for tenant ${tenant._id}`,
            metadata: {
              tenantId: tenant._id,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        } catch {
          // ignore
        }
      }
    }

    return {
      tenantsChecked: allTenants.length,
      tenantsProcessed,
      batchesCreated,
      transfersSent,
      errors,
    };
  },
});

export const _sendBatchTransfers = internalAction({
  args: {
    tenantId: v.id("tenants"),
    batchId: v.id("payoutBatches"),
    stripeAccountId: v.string(),
    payouts: v.array(
      v.object({
        payoutId: v.id("payouts"),
        affiliateId: v.id("affiliates"),
        amount: v.number(),
        providerAccountId: v.string(),
      }),
    ),
  },
  returns: v.object({
    transfersSent: v.number(),
    totalPayouts: v.number(),
    failedPayouts: v.number(),
    failureReason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    let sent = 0;
    let failed = 0;
    let failureReason: string | undefined;
    let stopOnFailure = false;

    try {
      const { getProvider } = await import("./lib/payoutProvider");
      const { withStripeCircuitBreaker } = await import("./lib/providers/stripeConnectAdapter");
      const provider = getProvider("stripe_connect");

      if (!provider) {
        return { transfersSent: 0, totalPayouts: args.payouts.length, failedPayouts: 0 };
      }

      const cbBalanceResult = await withStripeCircuitBreaker(
        ctx,
        async () => {
          return await provider.getBalance(args.stripeAccountId);
        },
        null as any,
      );

      if (!cbBalanceResult.ok) {
        return { transfersSent: 0, totalPayouts: args.payouts.length, failedPayouts: 0 };
      }

      const availableBalance = cbBalanceResult.data.available;
      const sorted = [...args.payouts].sort((a, b) => a.amount - b.amount);
      let runningTotal = 0;
      const toSend: typeof sorted[0][] = [];

      for (const p of sorted) {
        if (runningTotal + p.amount <= availableBalance) {
          toSend.push(p);
          runningTotal += p.amount;
        }
      }

      for (const item of toSend) {
        if (stopOnFailure) break;

        try {
          const cbResult = await withStripeCircuitBreaker(
            ctx,
            async () => {
              return await provider.createTransfer({
                payoutId: item.payoutId,
                batchId: args.batchId,
                tenantId: args.tenantId,
                affiliateId: item.affiliateId,
                amount: item.amount,
                currency: "php",
                destinationAccountId: item.providerAccountId,
                tenantProviderAccountId: args.stripeAccountId,
              });
            },
            null as any,
          );
          if (cbResult.ok) {
            await ctx.runMutation(internal.payouts._markPayoutProcessing as any, {
              payoutId: item.payoutId,
              paymentSource: "stripe",
              paymentReference: cbResult.data.transferId,
            });
            await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
              tenantId: args.tenantId,
              action: "payout_sent_provider",
              entityType: "payouts",
              entityId: item.payoutId,
              actorId: args.tenantId,
              actorType: "system",
              targetId: args.batchId,
              metadata: {
                affiliateId: item.affiliateId,
                transferId: cbResult.data.transferId,
                amount: item.amount,
                providerType: "stripe",
                trigger: "scheduled_cron",
              },
            });
            sent++;
          } else {
            failureReason = "Transfer rejected by provider";
            await ctx.runMutation(internal.payouts._markPayoutFailed as any, {
              payoutId: item.payoutId,
              failureReason,
            });
            await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
              tenantId: args.tenantId,
              action: "payout_failed_provider",
              entityType: "payouts",
              entityId: item.payoutId,
              actorId: args.tenantId,
              actorType: "system",
              targetId: args.batchId,
              metadata: {
                affiliateId: item.affiliateId,
                amount: item.amount,
                providerType: "stripe",
                trigger: "scheduled_cron",
                failureReason,
              },
            });
            failed++;
            stopOnFailure = true;
          }
        } catch (err) {
          failureReason = err instanceof Error ? err.message : "Unknown transfer error";
          try {
            await ctx.runMutation(internal.payouts._markPayoutFailed as any, {
              payoutId: item.payoutId,
              failureReason,
            });
            await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
              tenantId: args.tenantId,
              action: "payout_failed_provider",
              entityType: "payouts",
              entityId: item.payoutId,
              actorId: args.tenantId,
              actorType: "system",
              targetId: args.batchId,
              metadata: {
                affiliateId: item.affiliateId,
                amount: item.amount,
                providerType: "stripe",
                trigger: "scheduled_cron",
                failureReason,
              },
            });
          } catch {
            // mark failed best-effort
          }
          failed++;
          stopOnFailure = true;
        }
      }

      await ctx.runMutation(internal.payouts._incrementProviderCount as any, {
        batchId: args.batchId,
        providerType: "stripe",
        count: sent,
      });
    } catch {
      // Balance check or transfer initiation failed
    }

    return { transfersSent: sent, totalPayouts: args.payouts.length, failedPayouts: failed, failureReason };
  },
});

export const _checkBalanceForBatch = internalAction({
  args: {
    tenantId: v.id("tenants"),
    stripeAccountId: v.string(),
    totalAmount: v.number(),
  },
  returns: v.object({
    sufficient: v.boolean(),
    available: v.number(),
    needed: v.number(),
    shortfall: v.number(),
  }),
  handler: async (ctx, args) => {
    try {
      const { getProvider } = await import("./lib/payoutProvider");
      const { withStripeCircuitBreaker } = await import("./lib/providers/stripeConnectAdapter");
      const provider = getProvider("stripe_connect");

      if (!provider) {
        return { sufficient: false, available: 0, needed: args.totalAmount, shortfall: args.totalAmount };
      }

      const cbResult = await withStripeCircuitBreaker(
        ctx,
        async () => {
          return await provider.getBalance(args.stripeAccountId);
        },
        null as any,
      );

      if (!cbResult.ok) {
        return { sufficient: false, available: 0, needed: args.totalAmount, shortfall: args.totalAmount };
      }

      const available = cbResult.data.available;
      return {
        sufficient: available >= args.totalAmount,
        available,
        needed: args.totalAmount,
        shortfall: Math.max(0, args.totalAmount - available),
      };
    } catch {
      return { sufficient: false, available: 0, needed: args.totalAmount, shortfall: args.totalAmount };
    }
  },
});

export const _sendInsufficientBalanceEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    available: v.number(),
    needed: v.number(),
    shortfall: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const tenant: any = await ctx.runQuery(
        internal.scheduledPayoutsQueries._getTenantForEmail as any,
        { tenantId: args.tenantId },
      );

      if (!tenant || !tenant.ownerEmail) return null;

      await ctx.runAction(internal.emailService.sendEmail, {
        from: "salig-affiliate <noreply@salig-affiliate.com>",
        to: tenant.ownerEmail,
        subject: "Auto-Payout Skipped: Insufficient Balance",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; padding: 20px;">
            <h2 style="color: #1c2260; margin-bottom: 16px;">Auto-Payout Skipped</h2>
            <p style="color: #374151; margin-bottom: 12px;">
              Your scheduled auto-payout was skipped because your Stripe Connect balance is insufficient.
            </p>
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #92400e; font-size: 14px;">Available Balance</span>
                <span style="font-weight: bold; color: #92400e; font-size: 14px;">₱${args.available.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #92400e; font-size: 14px;">Total Needed</span>
                <span style="font-weight: bold; color: #92400e; font-size: 14px;">₱${args.needed.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #dc2626; font-weight: bold; font-size: 14px;">Shortfall</span>
                <span style="font-weight: bold; color: #dc2626; font-size: 14px;">₱${args.shortfall.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <p style="color: #6b7280; font-size: 13px;">
              Please top up your Stripe Connect balance and retry manually from the Payouts page.
            </p>
          </div>
        `,
      });
    } catch {
      // email failure non-fatal
    }
    return null;
  },
});

export const _sendPartialCompletionEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    batchId: v.id("payoutBatches"),
    sentCount: v.number(),
    totalCount: v.number(),
    failedCount: v.number(),
    remainingAmount: v.number(),
    failureReason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const tenant: any = await ctx.runQuery(
        internal.scheduledPayoutsQueries._getTenantForEmail as any,
        { tenantId: args.tenantId },
      );

      if (!tenant || !tenant.ownerEmail) return null;

      await ctx.runAction(internal.emailService.sendEmail, {
        from: "salig-affiliate <noreply@salig-affiliate.com>",
        to: tenant.ownerEmail,
        subject: "Auto-Payout Partially Completed: Action Required",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; padding: 20px;">
            <h2 style="color: #1c2260; margin-bottom: 16px;">Auto-Payout Partially Completed</h2>
            <p style="color: #374151; margin-bottom: 12px;">
              Your scheduled auto-payout was partially completed. Some transfers succeeded but the remaining payouts were skipped due to a failure.
            </p>
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #92400e; font-size: 14px;">Successfully Sent</span>
                <span style="font-weight: bold; color: #92400e; font-size: 14px;">${args.sentCount} of ${args.totalCount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #dc2626; font-size: 14px;">Failed</span>
                <span style="font-weight: bold; color: #dc2626; font-size: 14px;">${args.failedCount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #92400e; font-size: 14px;">Remaining Amount</span>
                <span style="font-weight: bold; color: #92400e; font-size: 14px;">₱${args.remainingAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6b7280; font-size: 13px;">Failure Reason</span>
                <span style="color: #6b7280; font-size: 13px;">${args.failureReason}</span>
              </div>
            </div>
            <p style="color: #6b7280; font-size: 13px;">
              The batch remains open. Failed payouts are still pending and will be eligible for the next scheduled cycle. Top up your Stripe Connect balance and retry manually from the Payouts page if needed.
            </p>
          </div>
        `,
      });
    } catch {
      // email failure non-fatal
    }
    return null;
  },
});

export const _sendCompletionEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    batchId: v.id("payoutBatches"),
    affiliatesPaid: v.number(),
    totalAmount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const tenant: any = await ctx.runQuery(
        internal.scheduledPayoutsQueries._getTenantForEmail as any,
        { tenantId: args.tenantId },
      );

      if (!tenant || !tenant.ownerEmail) return null;

      const batchDate = new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await ctx.runAction(internal.emailService.sendEmail, {
        from: "salig-affiliate <noreply@salig-affiliate.com>",
        to: tenant.ownerEmail,
        subject: "Auto-Payout Completed Successfully",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; padding: 20px;">
            <h2 style="color: #1c2260; margin-bottom: 16px;">Auto-Payout Completed</h2>
            <p style="color: #374151; margin-bottom: 12px;">
              Your scheduled auto-payout has been completed successfully.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #166534; font-size: 14px;">Batch ID</span>
                <span style="font-weight: bold; color: #166534; font-size: 14px;">${args.batchId.slice(-8)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #166534; font-size: 14px;">Date</span>
                <span style="font-weight: bold; color: #166534; font-size: 14px;">${batchDate}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #166534; font-size: 14px;">Affiliates Paid</span>
                <span style="font-weight: bold; color: #166534; font-size: 14px;">${args.affiliatesPaid}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #166534; font-size: 14px;">Total Amount</span>
                <span style="font-weight: bold; color: #166534; font-size: 14px;">₱${args.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #166534; font-size: 14px;">Payment Provider</span>
                <span style="font-weight: bold; color: #166534; font-size: 14px;">Stripe Connect</span>
              </div>
            </div>
            <p style="color: #6b7280; font-size: 13px;">
              All transfers have been initiated. Individual payout statuses will update as transfers settle.
            </p>
          </div>
        `,
      });
    } catch {
      // email failure non-fatal
    }
    return null;
  },
});
