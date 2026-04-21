"use node";

import Stripe from "stripe";
import { SERVICE_IDS } from "../circuitBreaker";
import type { CircuitBreakerInternalRefs } from "../circuitBreaker";
import {
  registerProvider,
} from "../payoutProvider";
import type {
  PayoutProvider,
  OnboardingParams,
  TransferParams,
  ProviderAccountStatus,
  ProviderBalance,
  WebhookResult,
  PayoutProviderStatusDetails,
} from "../payoutProvider";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";

let _stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (_stripeClient) return _stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  _stripeClient = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
  return _stripeClient;
}

export function isStripeConnectAvailable(): boolean {
  return getStripeClient() !== null;
}

export const stripeCircuitBreakerRefs: CircuitBreakerInternalRefs = {
  getServiceState: internal.circuitBreakers.getServiceState as any,
  recordFailure: internal.circuitBreakers.recordFailure as any,
  recordSuccess: internal.circuitBreakers.recordSuccess as any,
  tryAcquireProbe: internal.circuitBreakers.tryAcquireProbe as any,
  forceHalfOpen: internal.circuitBreakers.forceHalfOpen as any,
};

export function requireStripeClient(): Stripe {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("Stripe Connect is not configured");
  return stripe;
}

function mapStripeStatus(account: Stripe.Account): {
  status: string;
  enabled: boolean;
  details: PayoutProviderStatusDetails;
} {
  const details: PayoutProviderStatusDetails = {};

  if (account.requirements?.currently_due?.length) {
    details.currentlyDue = account.requirements.currently_due;
  }
  if (account.requirements?.eventually_due?.length) {
    details.eventuallyDue = account.requirements.eventually_due;
  }
  if (account.requirements?.past_due?.length) {
    details.pastDue = account.requirements.past_due;
  }

  let status: string;
  let enabled: boolean;

  if (!account.details_submitted) {
    status = "not_started";
    enabled = false;
  } else if (account.charges_enabled && account.payouts_enabled) {
    status = "verified";
    enabled = true;
  } else if (account.requirements?.disabled_reason) {
    status = "rejected";
    enabled = false;
    details.rejectionReason = account.requirements.disabled_reason;
  } else {
    status = "pending";
    enabled = false;
  }

  return { status, enabled, details };
}

async function createOnboardingLinkRaw(
  params: OnboardingParams,
): Promise<string> {
  const stripe = requireStripeClient();
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: params.affiliateId,
    refresh_url: `${siteUrl}${params.refreshPath}`,
    return_url: `${siteUrl}${params.returnPath}`,
    type: "account_onboarding",
  });
  return accountLink.url;
}

async function getAccountStatusRaw(
  accountId: string,
): Promise<ProviderAccountStatus> {
  const stripe = requireStripeClient();
  const account = await stripe.accounts.retrieve(accountId);
  return mapStripeStatus(account);
}

async function createTransferRaw(
  params: TransferParams,
): Promise<string> {
  const stripe = requireStripeClient();
  const transfer = await stripe.transfers.create(
    {
      amount: Math.round(params.amount * 100),
      currency: params.currency,
      destination: params.destinationAccountId,
      metadata: {
        payoutId: params.payoutId,
        batchId: params.batchId,
        tenantId: params.tenantId,
        affiliateId: params.affiliateId,
      },
    },
    { idempotencyKey: params.payoutId },
  );
  return transfer.id;
}

async function getBalanceRaw(
  accountId: string,
): Promise<ProviderBalance> {
  const stripe = requireStripeClient();
  const balance = await stripe.balance.retrieve(
    {},
    { stripeAccount: accountId },
  );
  const available =
    balance.available && balance.available.length > 0
      ? balance.available[0].amount / 100
      : 0;
  const pending =
    balance.pending && balance.pending.length > 0
      ? balance.pending[0].amount / 100
      : 0;
  const currency =
    balance.available && balance.available.length > 0
      ? balance.available[0].currency
      : "php";
  return { available, pending, currency };
}

export async function withStripeCircuitBreaker<T>(
  ctx: ActionCtx,
  fn: () => Promise<T>,
  fallback: T,
): Promise<{ ok: true; data: T } | { ok: false; fallback: T }> {
  const { withCircuitBreaker } = await import("../circuitBreaker");
  return withCircuitBreaker(
    ctx,
    stripeCircuitBreakerRefs,
    SERVICE_IDS.STRIPE,
    fn,
    fallback,
  );
}

const stripeConnectAdapter: PayoutProvider = {
  async createOnboardingLink(
    params: OnboardingParams,
  ): Promise<{ url: string }> {
    const url = await createOnboardingLinkRaw(params);
    return { url };
  },

  async getAccountStatus(
    accountId: string,
  ): Promise<ProviderAccountStatus> {
    return getAccountStatusRaw(accountId);
  },

  async createTransfer(
    params: TransferParams,
  ): Promise<{ transferId: string }> {
    const transferId = await createTransferRaw(params);
    return { transferId };
  },

  async retryTransfer(
    payoutId: string,
  ): Promise<{ transferId: string }> {
    throw new Error(
      "retryTransfer requires TransferParams — call createTransfer directly from a Convex action with circuit breaker",
    );
  },

  async getBalance(accountId: string): Promise<ProviderBalance> {
    return getBalanceRaw(accountId);
  },

  getWebhookEventType(event: unknown): string | null {
    if (
      !event ||
      typeof event !== "object" ||
      !("type" in event) ||
      typeof (event as any).type !== "string"
    ) {
      return null;
    }
    return (event as any).type;
  },

  async handleWebhook(event: unknown): Promise<WebhookResult> {
    if (
      !event ||
      typeof event !== "object" ||
      !("type" in event) ||
      !("data" in event)
    ) {
      return { status: "unrecognized" };
    }

    const stripeEvent = event as { type: string; data: { object: any } };
    const obj = stripeEvent.data.object;

    switch (stripeEvent.type) {
      case "account.updated": {
        const mapped = mapStripeStatus(obj);
        return {
          providerAccountId: obj.id,
          status: mapped.status,
          enabled: mapped.enabled,
          details: mapped.details,
          affiliateId: undefined,
        };
      }
      case "transfer.failed":
      case "transfer.created": {
        const payoutId = obj.metadata?.payoutId;
        const status = stripeEvent.type === "transfer.failed" ? "failed" : "processing";
        return {
          payoutId,
          status,
          paymentReference: obj.id,
        };
      }
      case "payout.paid": {
        const payoutId = obj.metadata?.payoutId;
        return {
          payoutId,
          status: "paid",
          paymentReference: obj.id,
        };
      }
      case "payout.failed": {
        const payoutId = obj.metadata?.payoutId;
        return {
          payoutId,
          status: "failed",
          paymentReference: obj.id,
        };
      }
      default:
        return { status: "unrecognized" };
    }
  },
};

if (isStripeConnectAvailable()) {
  registerProvider("stripe_connect", stripeConnectAdapter);
}
