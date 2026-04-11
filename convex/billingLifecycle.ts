/**
 * Billing Lifecycle Enforcement Cron
 *
 * Runs daily to enforce subscription status transitions based on billing dates.
 * - active → past_due when billingEndDate passes
 * - past_due → cancelled when 7-day grace period expires
 * - trial → cancelled when trialEndsAt passes (same day, no grace)
 *
 * All transitions are idempotent — re-reads tenant fresh each run.
 * Grace period is calendar-based via pastDueSince timestamp.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  sendPastDueEmail,
  sendGracePeriodWarningEmail,
  sendTrialExpiredEmail,
} from "./email";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_TENANTS_PER_RUN = 100;
const MAX_CAMPAIGNS_PER_BATCH = 500;

/**
 * Internal mutation: Pause all active campaigns for a tenant.
 * Called by billing lifecycle cron and admin actions.
 */
export const pauseAllActiveCampaignsForTenant = internalMutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activeCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .take(MAX_CAMPAIGNS_PER_BATCH);

    for (const campaign of activeCampaigns) {
      await ctx.db.patch(campaign._id, { status: "paused" });
    }

    return null;
  },
});

/**
 * Internal mutation: Resume all paused campaigns for a tenant.
 * Called by admin reactivation and recovery actions.
 */
export const resumeAllPausedCampaignsForTenant = internalMutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pausedCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "paused")
      )
      .take(MAX_CAMPAIGNS_PER_BATCH);

    for (const campaign of pausedCampaigns) {
      await ctx.db.patch(campaign._id, { status: "active" });
    }

    return null;
  },
});

/**
 * Internal mutation: Enforce billing lifecycle transitions.
 * Runs daily via cron to auto-transition tenant subscription statuses.
 *
 * State flow:
 *   active → past_due (when billingEndDate passes)
 *   past_due → cancelled (when 7-day grace expires)
 *   trial → cancelled (when trialEndsAt passes, same day, no grace)
 *
 * Recovery paths:
 *   past_due → active (payment received / admin extends)
 *   cancelled → active (admin reactivates)
 */
export const enforceBillingLifecycle = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    transitions: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let processed = 0;
    let transitions = 0;

    // Get all tenants (capped at 500 for safety)
    const allTenants = await ctx.db.query("tenants").take(500);

    for (const tenant of allTenants) {
      if (processed >= MAX_TENANTS_PER_RUN) break;

      // Re-read tenant fresh from DB for race condition protection
      const freshTenant = await ctx.db.get(tenant._id);
      if (!freshTenant) continue;

      const subStatus = freshTenant.subscriptionStatus;
      const billingEnd = freshTenant.billingEndDate;
      const trialEnd = freshTenant.trialEndsAt;
      const pastDueSince = freshTenant.pastDueSince;

      // ─── Check 1: Trial expiry ──────────────────────────────────
      // Trial → cancelled when trialEndsAt passes (no grace period)
      if (
        trialEnd &&
        trialEnd < now &&
        subStatus !== "active" &&
        subStatus !== "cancelled"
      ) {
        await ctx.db.patch(freshTenant._id, {
          subscriptionStatus: "cancelled",
          cancelledReason: "trial_expired",
          cancellationDate: now,
          trialEndsAt: undefined,
        });

        // Insert billing history
        await ctx.db.insert("billingHistory", {
          tenantId: freshTenant._id,
          event: "trial_expired",
          timestamp: now,
          actorId: undefined,
        });

        // Insert audit log
        await ctx.db.insert("auditLogs", {
          tenantId: freshTenant._id,
          action: "BILLING_TRIAL_EXPIRED",
          entityType: "tenant",
          entityId: freshTenant._id,
          actorId: undefined,
          actorType: "system",
          previousValue: { subscriptionStatus: subStatus },
          newValue: { subscriptionStatus: "cancelled", cancelledReason: "trial_expired" },
        });

        // Pause all active campaigns
        await ctx.runMutation(
          internal.billingLifecycle.pauseAllActiveCampaignsForTenant,
          { tenantId: freshTenant._id }
        );

        // Notify tenant owner
        await notifyTenantOwner(ctx, freshTenant._id, {
          type: "billing.trial_expired",
          title: "Trial Ended",
          message: "Your free trial has ended. Upgrade to a paid plan to continue using all features.",
          severity: "warning",
          actionUrl: "/settings/billing",
          actionLabel: "Upgrade Plan",
        });

        // Send trial expired email
        await sendBillingLifecycleEmail(ctx, freshTenant._id, freshTenant.name, "trial_expired");

        transitions++;
        processed++;
        continue; // Move to next tenant — don't double-process
      }

      // ─── Check 2: Past due detection ─────────────────────────────
      // active → past_due when billingEndDate passes
      if (
        subStatus === "active" &&
        billingEnd &&
        billingEnd < now &&
        (!trialEnd || trialEnd < now)
      ) {
        await ctx.db.patch(freshTenant._id, {
          subscriptionStatus: "past_due",
          pastDueSince: now,
        });

        // Insert billing history
        await ctx.db.insert("billingHistory", {
          tenantId: freshTenant._id,
          event: "past_due",
          timestamp: now,
          actorId: undefined,
        });

        // Insert audit log
        await ctx.db.insert("auditLogs", {
          tenantId: freshTenant._id,
          action: "BILLING_PAST_DUE",
          entityType: "tenant",
          entityId: freshTenant._id,
          actorId: undefined,
          actorType: "system",
          previousValue: { subscriptionStatus: "active" },
          newValue: { subscriptionStatus: "past_due", pastDueSince: now },
        });

        // Notify tenant owner
        await notifyTenantOwner(ctx, freshTenant._id, {
          type: "billing.past_due",
          title: "Payment Overdue",
          message: "Your subscription payment is overdue. Please update your payment method to avoid cancellation.",
          severity: "warning",
          actionUrl: "/settings/billing",
          actionLabel: "Update Payment",
        });

        // Send past due email
        await sendBillingLifecycleEmail(ctx, freshTenant._id, freshTenant.name, "past_due");

        transitions++;
        processed++;
        continue;
      }

      // ─── Check 3: Grace period expiry ────────────────────────────
      // past_due → cancelled when 7-day grace expires
      if (
        subStatus === "past_due" &&
        pastDueSince &&
        (now - pastDueSince) > GRACE_PERIOD_MS
      ) {
        await ctx.db.patch(freshTenant._id, {
          subscriptionStatus: "cancelled",
          cancelledReason: "grace_expired",
          cancellationDate: now,
        });

        // Insert billing history
        await ctx.db.insert("billingHistory", {
          tenantId: freshTenant._id,
          event: "grace_expired",
          timestamp: now,
          actorId: undefined,
        });

        // Insert audit log
        await ctx.db.insert("auditLogs", {
          tenantId: freshTenant._id,
          action: "BILLING_GRACE_EXPIRED",
          entityType: "tenant",
          entityId: freshTenant._id,
          actorId: undefined,
          actorType: "system",
          previousValue: { subscriptionStatus: "past_due" },
          newValue: { subscriptionStatus: "cancelled", cancelledReason: "grace_expired" },
        });

        // Pause all active campaigns
        await ctx.runMutation(
          internal.billingLifecycle.pauseAllActiveCampaignsForTenant,
          { tenantId: freshTenant._id }
        );

        // Notify tenant owner
        await notifyTenantOwner(ctx, freshTenant._id, {
          type: "billing.cancelled",
          title: "Subscription Cancelled",
          message: "Your subscription has been cancelled due to prolonged non-payment. Upgrade to a paid plan to restore full access.",
          severity: "critical",
          actionUrl: "/settings/billing",
          actionLabel: "Reactivate",
        });

        // Send grace period expired / cancelled email
        await sendBillingLifecycleEmail(ctx, freshTenant._id, freshTenant.name, "grace_expired");

        transitions++;
        processed++;
        continue;
      }

      // ─── Check 4: Grace period warning (3 days remaining) ───────
      // Only fires when exactly 3 days remain (within a 12-hour window)
      if (
        subStatus === "past_due" &&
        pastDueSince
      ) {
        const graceRemaining = GRACE_PERIOD_MS - (now - pastDueSince);
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        const twoAndHalfDays = 2.5 * 24 * 60 * 60 * 1000;

        if (graceRemaining <= threeDays && graceRemaining > twoAndHalfDays) {
          await notifyTenantOwner(ctx, freshTenant._id, {
            type: "billing.grace_warning",
            title: "Cancellation in 3 Days",
            message: "Your account will be cancelled in 3 days. Update your payment now to keep your data.",
            severity: "critical",
            actionUrl: "/settings/billing",
            actionLabel: "Update Payment",
            shouldAggregate: true,
          });

          // Send grace period warning email
          await sendBillingLifecycleEmail(ctx, freshTenant._id, freshTenant.name, "grace_warning");
        }
      }

      processed++;
    }

    return { processed, transitions };
  },
});

// =============================================================================
// Helper: Notify Tenant Owner
// =============================================================================

/**
 * Find the owner user for a tenant and send them a notification.
 * Non-fatal — if no owner found or notification fails, continues silently.
 */
async function notifyTenantOwner(
  ctx: any,
  tenantId: Id<"tenants">,
  notification: {
    type: string;
    title: string;
    message: string;
    severity: "info" | "warning" | "success" | "critical";
    actionUrl?: string;
    actionLabel?: string;
    shouldAggregate?: boolean;
  }
): Promise<void> {
  try {
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("role") as any, "owner"))
      .take(5);

    for (const owner of ownerUsers) {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId,
        userId: owner._id,
        ...notification,
      });
    }
  } catch (error) {
    console.error(
      `[billingLifecycle] Failed to notify owner for tenant="${tenantId}":`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// =============================================================================
// Helper: Send billing lifecycle email
// =============================================================================

type LifecycleEmailType = "past_due" | "grace_warning" | "trial_expired" | "grace_expired";

/**
 * Send the appropriate billing lifecycle email to the tenant owner.
 * Non-fatal — email send failure should not block the lifecycle transition.
 */
async function sendBillingLifecycleEmail(
  ctx: any,
  tenantId: Id<"tenants">,
  tenantName: string,
  emailType: LifecycleEmailType,
): Promise<void> {
  try {
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("role") as any, "owner"))
      .take(5);

    for (const owner of ownerUsers) {
      if (!owner.email) continue;

      const brandName = tenantName || "Salig Affiliate";

      switch (emailType) {
        case "past_due":
          await sendPastDueEmail(ctx, {
            to: owner.email,
            tenantName,
            brandName,
            tenantId,
          });
          break;
        case "grace_warning":
          await sendGracePeriodWarningEmail(ctx, {
            to: owner.email,
            tenantName,
            brandName,
            tenantId,
          });
          break;
        case "trial_expired":
          await sendTrialExpiredEmail(ctx, {
            to: owner.email,
            tenantName,
            brandName,
            tenantId,
          });
          break;
        case "grace_expired":
          await sendGracePeriodWarningEmail(ctx, {
            to: owner.email,
            tenantName,
            brandName,
            tenantId,
          });
          break;
      }
    }
  } catch (error) {
    console.error(
      `[billingLifecycle] Failed to send ${emailType} email for tenant="${tenantId}":`,
      error instanceof Error ? error.message : String(error)
    );
  }
}
