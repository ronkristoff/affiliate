/**
 * Internal queries and mutations for platform billing — runs in V8 context.
 * Actions cannot define queries/mutations, so these live in a separate file.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const getTenantById = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      _creationTime: v.number(),
      plan: v.string(),
      platformPaymentProvider: v.optional(v.union(v.literal("stripe"), v.literal("saligpay"))),
      stripeSubscriptionId: v.optional(v.string()),
      billingStartDate: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;
    return {
      _id: tenant._id,
      _creationTime: tenant._creationTime,
      plan: tenant.plan,
      platformPaymentProvider: tenant.platformPaymentProvider,
      stripeSubscriptionId: tenant.stripeSubscriptionId,
      billingStartDate: tenant.billingStartDate,
    };
  },
});

export const getUserBasic = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      tenantId: v.optional(v.id("tenants")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
    };
  },
});

export const logBillingEventInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    event: v.string(),
    plan: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: args.event,
      plan: args.plan,
      timestamp: Date.now(),
      actorId: args.actorId,
    });
    return null;
  },
});

export const markTenantCancelled = internalMutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "cancelled",
      cancellationDate: Date.now(),
      cancelledReason: "owner_cancelled" as const,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "cancel",
      previousPlan: tenant.plan,
      newPlan: "cancelled",
      mockTransaction: false,
      timestamp: Date.now(),
      actorId: undefined,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "SUBSCRIPTION_CANCELLATION",
      entityType: "tenant",
      entityId: args.tenantId,
      actorType: "system",
      previousValue: { subscriptionStatus: "active" },
      newValue: {
        subscriptionStatus: "cancelled",
        cancelledReason: "owner_cancelled",
        provider: "stripe",
      },
    });
  },
});

export const getTenantByStripeSubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      plan: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    if (!tenant) return null;
    return { _id: tenant._id, plan: tenant.plan };
  },
});

export const syncStripeSubscriptionToTenant = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    userId: v.optional(v.string()),
    plan: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    amount: v.optional(v.number()),
    transactionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.tenantId) {
      console.warn("[syncStripeSubscriptionToTenant] Skipping: no tenantId provided");
      return null;
    }

    const tenant = await ctx.db.get(args.tenantId as any);
    if (!tenant) {
      return null;
    }

    const patchData: Record<string, unknown> = {
      stripeSubscriptionId: args.stripeSubscriptionId,
      platformPaymentProvider: "stripe" as const,
    };

    if (args.currentPeriodEnd) {
      patchData.billingEndDate = args.currentPeriodEnd;
    }

    const subscriptionStatusMap: Record<string, string> = {
      active: "active",
      trialing: "active",
      past_due: "past_due",
      canceled: "cancelled",
      unpaid: "past_due",
      incomplete: "past_due",
      incomplete_expired: "cancelled",
    };

    if (args.status in subscriptionStatusMap) {
      patchData.subscriptionStatus = subscriptionStatusMap[args.status];
    }

    if (args.cancelAtPeriodEnd && (args.status === "active" || args.status === "trialing")) {
      patchData.cancellationDate = Date.now();
      patchData.cancelledReason = "owner_cancelled" as const;
    }

    if (args.status === "canceled" || args.status === "incomplete_expired") {
      if (!args.cancelAtPeriodEnd) {
        patchData.subscriptionStatus = "cancelled";
      }
      patchData.cancellationDate = Date.now();
      patchData.cancelledReason = "owner_cancelled" as const;
    }

    if (args.plan && args.plan !== (tenant as any).plan) {
      patchData.plan = args.plan;
    }

    const isActiveSubscription = args.status === "active" || args.status === "trialing";
    const hasPayment = args.amount != null && args.amount > 0;
    if (isActiveSubscription && hasPayment && (tenant as any).trialEndsAt) {
      patchData.trialEndsAt = 0;
      if (!(tenant as any).billingStartDate) {
        patchData.billingStartDate = Date.now();
      }
    }

    if (args.currentPeriodEnd) {
      patchData.billingEndDate = args.currentPeriodEnd;
    }

    await ctx.db.patch(args.tenantId as any, patchData);

    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId as any,
      event: "stripe_webhook",
      plan: patchData.plan ?? (tenant as any).plan,
      timestamp: Date.now(),
      actorId: undefined,
    });

    // Log platform subscription change for admin audit trail
    try {
      const internal = (require("./_generated/api") as any).internal;
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: args.tenantId as any,
        action: `PLATFORM_SUBSCRIPTION_${args.status.toUpperCase()}`,
        entityType: "tenant",
        entityId: args.tenantId as any,
        actorId: undefined,
        actorType: "system",
        metadata: {
          stripeSubscriptionId: args.stripeSubscriptionId,
          plan: args.plan,
          priceId: args.priceId,
          reason: "stripe_webhook",
        },
      });
    } catch (logErr) {
      console.error("[Audit] Failed to log subscription change:", logErr);
    }

    // Send platform billing email on key subscription transitions
    try {
      const wasTrial = !!(tenant as any).trialEndsAt;
      const oldStatus = (tenant as any).subscriptionStatus;
      const newPlan = (patchData.plan ?? (tenant as any).plan) as string;
      const newStatus = patchData.subscriptionStatus as string | undefined;
      const internal = (require("./_generated/api") as any).internal;

      // Find tenant owner to get email/name
      const ownerUser = await ctx.db
        .query("users")
        .withIndex("by_tenant_and_role", (q: any) =>
          q.eq("tenantId", args.tenantId as any).eq("role", "owner")
        )
        .first();

      if (ownerUser?.email) {
        const siteUrl = process.env.SITE_URL || "http://localhost:3000";
        const platformName = "Salig Affiliate";
        const supportEmail = "support@affilio.com";

        const formatTimestamp = (ts: number) =>
          new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

        let templateType: string | null = null;
        let emailVariables: Record<string, string | number> = {};

        const effectiveBillingEnd = args.currentPeriodEnd ?? (tenant as any).billingEndDate ?? (patchData.billingEndDate as number);
        const effectiveBillingStart = (patchData.billingStartDate as number) ?? (tenant as any).billingStartDate;

        if (isActiveSubscription && wasTrial && hasPayment) {
          templateType = "platform_payment_success";
          const formattedAmount = args.amount != null && args.amount > 0
            ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(args.amount / 100)
            : "0.00";
          emailVariables = {
            owner_name: ownerUser.name ?? "User",
            plan: newPlan,
            amount: formattedAmount,
            currency: "PHP",
            transaction_id: args.transactionId ?? "",
            billing_start: effectiveBillingStart ? formatTimestamp(effectiveBillingStart) : "N/A",
            billing_end: effectiveBillingEnd ? formatTimestamp(effectiveBillingEnd) : "N/A",
            dashboard_url: `${siteUrl}/dashboard`,
            platform_name: platformName,
            support_email: supportEmail,
          };
        } else if (isActiveSubscription && oldStatus === "past_due") {
          templateType = "platform_subscription_active";
          emailVariables = {
            owner_name: ownerUser.name ?? "User",
            plan: newPlan,
            billing_start: effectiveBillingStart ? formatTimestamp(effectiveBillingStart) : "N/A",
            billing_end: effectiveBillingEnd ? formatTimestamp(effectiveBillingEnd) : "N/A",
            dashboard_url: `${siteUrl}/dashboard`,
            platform_name: platformName,
            support_email: supportEmail,
          };
        } else if (args.status === "active" && !wasTrial && oldStatus !== "past_due" && oldStatus !== "active") {
          templateType = "platform_subscription_active";
          emailVariables = {
            owner_name: ownerUser.name ?? "User",
            plan: newPlan,
            billing_start: effectiveBillingStart ? formatTimestamp(effectiveBillingStart) : "N/A",
            billing_end: effectiveBillingEnd ? formatTimestamp(effectiveBillingEnd) : "N/A",
            dashboard_url: `${siteUrl}/dashboard`,
            platform_name: platformName,
            support_email: supportEmail,
          };
        } else if (args.status === "past_due" && oldStatus !== "past_due") {
          templateType = "platform_past_due";
          const formattedAmount = args.amount != null
            ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(args.amount / 100)
            : "";
          emailVariables = {
            owner_name: ownerUser.name ?? "User",
            plan: newPlan,
            amount: formattedAmount,
            currency: "PHP",
            dashboard_url: `${siteUrl}/settings/billing`,
            platform_name: platformName,
            support_email: supportEmail,
          };
        } else if ((newStatus === "cancelled" || args.cancelAtPeriodEnd) && oldStatus !== "cancelled") {
          templateType = "platform_subscription_cancelled";
          emailVariables = {
            owner_name: ownerUser.name ?? "User",
            plan: newPlan,
            access_end_date: effectiveBillingEnd ? formatTimestamp(effectiveBillingEnd) : "N/A",
            dashboard_url: `${siteUrl}/settings/billing`,
            platform_name: platformName,
            support_email: supportEmail,
          };
        }

        if (templateType) {
          await ctx.scheduler.runAfter(0, internal.platformBilling.sendPlatformBillingEmail, {
            templateType,
            to: ownerUser.email,
            variables: emailVariables,
            tenantId: args.tenantId as any,
          });
        }
      }
    } catch (emailErr) {
      console.error("[PlatformEmail] Failed to schedule billing email:", emailErr);
    }

    return null;
  },
});
