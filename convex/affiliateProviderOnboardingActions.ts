"use node";

import { action, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { SignJWT, jwtVerify } from "jose";
import { getProvider } from "./lib/payoutProvider";
import {
  requireStripeClient,
  withStripeCircuitBreaker,
} from "./lib/providers/stripeConnectAdapter";
import { betterAuthComponent } from "./auth";
import { internal } from "./_generated/api";

function getSigningSecret(): Uint8Array {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

async function createSignedOnboardingToken(
  affiliateId: string,
  tenantId: string,
): Promise<string> {
  const secret = getSigningSecret();
  return new SignJWT({ affiliateId, tenantId, typ: "onboarding" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .setIssuedAt()
    .sign(secret);
}

export const generateOnboardingLink = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx: ActionCtx) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required");
    }
    if (!betterAuthUser) {
      throw new Error("Authentication required");
    }

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const affiliate = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
      { email: cleanEmail },
    );
    if (!affiliate) {
      throw new Error("Affiliate account not found");
    }

    if (affiliate.payoutProviderEnabled === false) {
      throw new Error(
        "Payout provider is currently disabled for your account. Contact your account manager.",
      );
    }

    const tenant = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getTenantStripeConfigInternal as any,
      { tenantId: affiliate.tenantId },
    );
    if (!tenant) {
      throw new Error("Tenant not found");
    }
    if (!tenant.stripeAccountId) {
      throw new Error(
        "Payout provider is not configured for your account. Contact your account manager.",
      );
    }

    const provider = getProvider("stripe_connect");
    if (!provider) {
      throw new Error(
        "Stripe Connect is not available. Contact your account manager.",
      );
    }

    let connectAccountId: string = affiliate.payoutProviderAccountId;

    if (!connectAccountId) {
      const stripe = requireStripeClient();
      const cbResult = await withStripeCircuitBreaker(
        ctx,
        async () => {
          return await stripe.accounts.create({
            type: "express",
            metadata: {
              tenantId: affiliate.tenantId,
              affiliateId: affiliate._id,
            },
          });
        },
        null as any,
      );
      if (!cbResult.ok) {
        throw new Error(
          "Unable to create payout account. Please try again later.",
        );
      }
      connectAccountId = cbResult.data.id;
      await ctx.runMutation(
        internal.affiliateProviderOnboarding.setAffiliateProviderAccount as any,
        {
          affiliateId: affiliate._id,
          payoutProviderAccountId: connectAccountId,
          payoutProviderType: "stripe_connect",
          payoutProviderStatus: "pending",
          payoutProviderEnabled: false,
        },
      );
    } else {
      await ctx.runMutation(
        internal.affiliateProviderOnboarding.setAffiliateProviderStatusDetails as any,
        {
          affiliateId: affiliate._id,
          payoutProviderStatus: "pending",
          payoutProviderEnabled: false,
          payoutProviderStatusDetails: undefined,
        },
      );
    }

    const token = await createSignedOnboardingToken(
      affiliate._id,
      affiliate.tenantId,
    );

    const returnPath = `/portal/account?setup=return&token=${token}`;
    const refreshPath = `/portal/account?setup=refresh&token=${token}`;

    const cbLinkResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await provider.createOnboardingLink({
          affiliateId: connectAccountId,
          returnPath,
          refreshPath,
          tenantId: affiliate.tenantId,
        });
      },
      null as any,
    );
    if (!cbLinkResult.ok) {
      throw new Error(
        "Unable to generate payout setup link. Please try again later.",
      );
    }

    return { url: cbLinkResult.data.url };
  },
});

export const verifyOnboardingToken = action({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      affiliateId: v.string(),
      tenantId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx: ActionCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!betterAuthUser) {
      return null;
    }

    try {
      const secret = getSigningSecret();
      const { payload } = await jwtVerify(args.token, secret);
      if (payload.typ !== "onboarding") return null;
      const affiliateId = payload.affiliateId as string | undefined;
      const tenantId = payload.tenantId as string | undefined;
      if (!affiliateId || !tenantId) return null;

      const callerEmail = betterAuthUser.email.trim().toLowerCase();
      const tokenAffiliate: any = await ctx.runQuery(
        internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
        { email: callerEmail },
      );
      if (!tokenAffiliate || tokenAffiliate._id !== affiliateId) {
        return null;
      }

      return { affiliateId, tenantId };
    } catch {
      return null;
    }
  },
});

export const handleOnboardingReturn = action({
  args: { token: v.string() },
  returns: v.union(
    v.object({ status: v.string(), enabled: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx: ActionCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!betterAuthUser) {
      return null;
    }

    try {
      const secret = getSigningSecret();
      const { payload } = await jwtVerify(args.token, secret);
      if (payload.typ !== "onboarding") return null;
      const affiliateId = payload.affiliateId as string | undefined;
      const tenantId = payload.tenantId as string | undefined;
      if (!affiliateId || !tenantId) return null;

      const callerEmail = betterAuthUser.email.trim().toLowerCase();
      const affiliate: any = await ctx.runQuery(
        internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
        { email: callerEmail },
      );
      if (!affiliate || affiliate._id !== affiliateId) {
        return null;
      }

      if (!affiliate.payoutProviderAccountId) {
        return null;
      }

      const provider = getProvider("stripe_connect");
      if (!provider) {
        return null;
      }

      const cbResult = await withStripeCircuitBreaker(
        ctx,
        async () => {
          return await provider.getAccountStatus(
            affiliate.payoutProviderAccountId,
          );
        },
        null as any,
      );
      if (!cbResult.ok) {
        return null;
      }

      const accountStatus = cbResult.data;
      const statusDetails: Record<string, any> = {};
      if (accountStatus.details) {
        if (accountStatus.details.currentlyDue) {
          statusDetails.currentlyDue = accountStatus.details.currentlyDue;
        }
        if (accountStatus.details.eventuallyDue) {
          statusDetails.eventuallyDue = accountStatus.details.eventuallyDue;
        }
        if (accountStatus.details.pastDue) {
          statusDetails.pastDue = accountStatus.details.pastDue;
        }
        if (accountStatus.details.rejectionReason) {
          statusDetails.rejectionReason =
            accountStatus.details.rejectionReason;
        }
      }

      await ctx.runMutation(
        internal.affiliateProviderOnboarding.setAffiliateProviderStatusDetails as any,
        {
          affiliateId: affiliate._id,
          payoutProviderStatus: accountStatus.status,
          payoutProviderEnabled: accountStatus.enabled,
          payoutProviderStatusDetails:
            Object.keys(statusDetails).length > 0
              ? statusDetails
              : undefined,
        },
      );

      return { status: accountStatus.status, enabled: accountStatus.enabled };
    } catch {
      return null;
    }
  },
});

export const handleOnboardingRefresh = action({
  args: { token: v.string() },
  returns: v.union(
    v.object({ status: v.string() }),
    v.null(),
  ),
  handler: async (ctx: ActionCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!betterAuthUser) {
      return null;
    }

    try {
      const secret = getSigningSecret();
      const { payload } = await jwtVerify(args.token, secret);
      if (payload.typ !== "onboarding") return null;
      const affiliateId = payload.affiliateId as string | undefined;
      if (!affiliateId) return null;

      const callerEmail = betterAuthUser.email.trim().toLowerCase();
      const affiliate: any = await ctx.runQuery(
        internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
        { email: callerEmail },
      );
      if (!affiliate || affiliate._id !== affiliateId) {
        return null;
      }

      return { status: affiliate.payoutProviderStatus ?? "not_started" };
    } catch {
      return null;
    }
  },
});

export const refreshProviderStatus = action({
  args: {},
  returns: v.union(
    v.object({ status: v.string(), enabled: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx: ActionCtx) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!betterAuthUser) {
      return null;
    }

    try {
      const cleanEmail = betterAuthUser.email.trim().toLowerCase();
      const affiliate: any = await ctx.runQuery(
        internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
        { email: cleanEmail },
      );
      if (!affiliate || !affiliate.payoutProviderAccountId) {
        return null;
      }

      const provider = getProvider("stripe_connect");
      if (!provider) {
        return null;
      }

      const cbResult = await withStripeCircuitBreaker(
        ctx,
        async () => {
          return await provider.getAccountStatus(
            affiliate.payoutProviderAccountId,
          );
        },
        null as any,
      );
      if (!cbResult.ok) {
        return null;
      }

      const accountStatus = cbResult.data;
      const statusDetails: Record<string, any> = {};
      if (accountStatus.details) {
        if (accountStatus.details.currentlyDue) {
          statusDetails.currentlyDue = accountStatus.details.currentlyDue;
        }
        if (accountStatus.details.eventuallyDue) {
          statusDetails.eventuallyDue = accountStatus.details.eventuallyDue;
        }
        if (accountStatus.details.pastDue) {
          statusDetails.pastDue = accountStatus.details.pastDue;
        }
        if (accountStatus.details.rejectionReason) {
          statusDetails.rejectionReason =
            accountStatus.details.rejectionReason;
        }
      }

      await ctx.runMutation(
        internal.affiliateProviderOnboarding.setAffiliateProviderStatusDetails as any,
        {
          affiliateId: affiliate._id,
          payoutProviderStatus: accountStatus.status,
          payoutProviderEnabled: accountStatus.enabled,
          payoutProviderStatusDetails:
            Object.keys(statusDetails).length > 0
              ? statusDetails
              : undefined,
        },
      );

      return { status: accountStatus.status, enabled: accountStatus.enabled };
    } catch {
      return null;
    }
  },
});

export const handleRejectedRetry = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx: ActionCtx) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Authentication required");
    }
    if (!betterAuthUser) {
      throw new Error("Authentication required");
    }

    const cleanEmail = betterAuthUser.email.trim().toLowerCase();
    const affiliate: any = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getAffiliateByEmailInternal as any,
      { email: cleanEmail },
    );
    if (!affiliate) {
      throw new Error("Affiliate account not found");
    }

    if (affiliate.status !== "active") {
      throw new Error(
        "Only active affiliates can set up payouts. Contact your account manager.",
      );
    }

    if (!affiliate.payoutProviderAccountId) {
      throw new Error("No payout account found to retry. Please set up payouts instead.");
    }

    const tenant = await ctx.runQuery(
      internal.affiliateProviderOnboarding.getTenantStripeConfigInternal as any,
      { tenantId: affiliate.tenantId },
    );
    if (!tenant || !tenant.stripeAccountId) {
      throw new Error(
        "Payout provider is not configured for your account. Contact your account manager.",
      );
    }

    const provider = getProvider("stripe_connect");
    if (!provider) {
      throw new Error(
        "Stripe Connect is not available. Contact your account manager.",
      );
    }

    const stripe = requireStripeClient();
    const cbResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await stripe.accounts.create({
          type: "express",
          metadata: {
            tenantId: affiliate.tenantId,
            affiliateId: affiliate._id,
          },
        });
      },
      null as any,
    );
    if (!cbResult.ok) {
      throw new Error(
        "Unable to create payout account. Please try again later.",
      );
    }
    const connectAccountId = cbResult.data.id;

    await ctx.runMutation(
      internal.affiliateProviderOnboarding.clearProviderAccount as any,
      { affiliateId: affiliate._id },
    );

    await ctx.runMutation(
      internal.affiliateProviderOnboarding.setAffiliateProviderAccount as any,
      {
        affiliateId: affiliate._id,
        payoutProviderAccountId: connectAccountId,
        payoutProviderType: "stripe_connect",
        payoutProviderStatus: "pending",
        payoutProviderEnabled: false,
      },
    );

    const token = await createSignedOnboardingToken(
      affiliate._id,
      affiliate.tenantId,
    );

    const returnPath = `/portal/account?setup=return&token=${token}`;
    const refreshPath = `/portal/account?setup=refresh&token=${token}`;

    const cbLinkResult = await withStripeCircuitBreaker(
      ctx,
      async () => {
        return await provider.createOnboardingLink({
          affiliateId: connectAccountId,
          returnPath,
          refreshPath,
          tenantId: affiliate.tenantId,
        });
      },
      null as any,
    );
    if (!cbLinkResult.ok) {
      throw new Error(
        "Unable to generate payout setup link. Please try again later.",
      );
    }

    return { url: cbLinkResult.data.url };
  },
});
