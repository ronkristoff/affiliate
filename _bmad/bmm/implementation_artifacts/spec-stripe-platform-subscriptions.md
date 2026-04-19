---
title: 'Platform Subscription Payment Providers'
type: 'feature'
created: '2026-04-19'
status: 'in-progress'
context: ['AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Platform subscription payments are entirely mock — no real payment gateway collects fees from SaaS Owners. The platform needs real payment processing with support for multiple providers (Stripe, SaligPay) that can be configured.

**Approach:** Install the `@convex-dev/stripe` Convex component and build a provider-agnostic platform billing layer. A `platformSettings` configuration controls which payment providers are enabled (Stripe, SaligPay). The billing UI shows available providers and routes checkout accordingly. Mock payment is fully removed. This sprint implements Stripe; SaligPay platform billing is deferred (schema and config ready but SaligPay checkout flow not wired).

## Boundaries & Constraints

**Always:** Use `@convex-dev/stripe` component for Stripe (not raw Stripe API). Keep existing `billingProvider` field on tenants untouched — that is merchant Connect. Store Stripe price IDs per plan in `platformSettings`. Wire Stripe webhook at `/stripe/webhook` via component's `registerRoutes`. All existing billing lifecycle (cron, past_due, cancellation) must remain functional. Mock payment is fully removed. Provider configuration is platform-wide (admin sets which providers are enabled in `platformSettings`), not per-tenant.

**Ask First:** Stripe price IDs (needs Stripe Dashboard setup — use placeholder constants for now).

**Never:** Do not modify the existing Stripe Connect webhook handler at `/api/webhooks/stripe` (merchant webhooks). Do not change the commission engine or affiliate-facing code. Do not alter the `billingProvider` field semantics — existing `"stripe"` value means merchant Connect, not platform billing. Do not keep mock payment flow. Do not implement SaligPay platform checkout this sprint — only Stripe.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_NEW_SUB_STRIPE | User on starter/trial, selects Growth, picks Stripe | Stripe Checkout opens → payment succeeds → webhook fires → tenant updated to active/growth, platformPaymentProvider="stripe", stripeSubscriptionId set | Checkout cancelled → return to billing page, no changes |
| HAPPY_PATH_UPGRADE_STRIPE | User on Growth active (Stripe-paid), upgrades to Scale | Stripe Checkout opens → success → tenant plan updated | Same as above for cancellation |
| HAPPY_PATH_CANCEL | User on Stripe-paid plan, cancels | Stripe subscription cancelled via component → tenant marked cancelled, keeps access until period end | Component API error → show toast error |
| STRIPE_WEBHOOK_SUB_DELETED | Stripe sends `customer.subscription.deleted` | Tenant subscriptionStatus synced to cancelled, campaigns paused | Webhook signature mismatch → 400 response, logged |
| NO_PROVIDERS_ENABLED | platformSettings has no platform payment providers enabled | Billing page shows "No payment methods available" message, upgrade buttons disabled | N/A |
| PROVIDER_CONFIG_CHANGE | Admin enables/disables a provider in platformSettings | Billing page reflects updated available providers immediately | N/A |

</frozen-after-approval>

## Code Map

- `convex/convex.config.ts` -- Add stripe component registration
- `convex/http.ts` -- Register Stripe webhook route via `registerRoutes()`; existing routes untouched
- `convex/platformBilling.ts` -- NEW: Provider-agnostic platform billing actions (createCheckout, cancelSubscription) + provider config queries
- `convex/subscriptions.ts` -- Remove mock payment; wire into platformBilling for checkout/cancel
- `convex/billingLifecycle.ts` -- Skip date-based enforcement for Stripe-backed subs (Stripe manages cycles); sync from Stripe webhooks
- `convex/schema.ts` -- Add `platformPaymentProvider`, `stripeSubscriptionId`, `stripeCustomerId` to tenants; add `enabledPlatformProviders` and `stripePriceIds` to platformSettings
- `convex/platformSettings.ts` -- Add `enabledPlatformProviders` and `stripePriceIds` to get/update platformSettings; add `getPublicPlatformProviders` query (unauth, for billing page)
- `src/app/(admin)/admin-settings/_components/PlatformSettingsClient.tsx` -- Add "Platform Payment Providers" card with toggle switches for Stripe/SaligPay; replace the "More Settings Coming Soon" placeholder
- `src/app/(auth)/settings/billing/page.tsx` -- Show provider selection when multiple enabled; redirect to chosen provider's checkout
- `src/components/settings/CheckoutModal.tsx` -- NEW: Provider-aware checkout modal replacing MockCheckoutModal
- `convex/tierConfig.ts` -- Add `stripePriceId` optional field to tierConfigs
- `package.json` -- Add `@convex-dev/stripe` dependency

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- Install `@convex-dev/stripe`
- [ ] `convex/convex.config.ts` -- Register stripe component via `app.use(stripe)`
- [ ] `convex/schema.ts` -- Add `platformPaymentProvider` (optional `"stripe" | "saligpay"`), `stripeSubscriptionId`, `stripeCustomerId` to tenants; add `enabledPlatformProviders` (array) and `stripePriceIds` (record of plan→priceId) to platformSettings
- [ ] `convex/tierConfig.ts` -- Add `stripePriceId` optional field to tierConfigs (per-tier Stripe Price ID)
- [ ] `convex/platformSettings.ts` -- Add `enabledPlatformProviders` (array) and `stripePriceIds` (record) to settings; add `getPublicPlatformProviders` query (no auth — billing page needs it); extend `updatePlatformSettings` mutation to accept provider fields
- [ ] `src/app/(admin)/admin-settings/_components/PlatformSettingsClient.tsx` -- Add "Platform Payment Providers" card with Stripe/SaligPay toggle switches; replace "More Settings Coming Soon" placeholder; save toggles via `updatePlatformSettings`
- [ ] `convex/platformBilling.ts` -- NEW: `createPlatformCheckout` action (routes to Stripe via component), `cancelPlatformSubscription` action, `handleStripeWebhookSync` internalMutation (called from custom webhook handler)
- [ ] `convex/http.ts` -- Add `registerRoutes(http, components.stripe, { webhookPath: "/stripe/webhook" })` with custom `customer.subscription.deleted` handler that syncs tenant status
- [ ] `convex/subscriptions.ts` -- Remove `mockPayment` param from all mutations; `upgradeSubscription`, `convertTrialToPaid`, `upgradeTier` now delegate to `platformBilling.createPlatformCheckout`; `cancelSubscription` delegates to `platformBilling.cancelPlatformSubscription`
- [ ] `convex/billingLifecycle.ts` -- Skip date-based lifecycle enforcement for tenants with `platformPaymentProvider` set (external provider manages cycles)
- [ ] `src/app/(auth)/settings/billing/page.tsx` -- Query enabled providers; show provider picker when multiple; route to Stripe Checkout
- [ ] `src/components/settings/CheckoutModal.tsx` -- NEW: Replace MockCheckoutModal; show provider selection, redirect to Stripe Checkout URL
- [ ] Remove `src/components/settings/MockCheckoutModal.tsx` and `src/components/settings/MockPaymentForm.tsx`

**Acceptance Criteria:**
- Given a user on starter plan and Stripe is enabled, when they click "Upgrade to Growth", then Stripe Checkout opens and on success the tenant is active/growth with stripeSubscriptionId populated
- Given a user on a Stripe-paid plan, when they cancel, then both the Stripe subscription and tenant record are cancelled
- Given Stripe webhook `customer.subscription.deleted`, when the event fires, then the tenant is marked cancelled and campaigns paused
- Given the billing page and multiple providers enabled, when loaded, then the user sees a provider selection before checkout
- Given no providers enabled in platformSettings, when the billing page loads, then upgrade buttons are disabled with "No payment methods configured"
- Given the /admin-settings page, when an admin toggles Stripe on, then `enabledPlatformProviders` includes "stripe" and the change is audit logged
- Given `pnpm tsc --noEmit`, when run, then no new TypeScript errors are introduced

## Spec Change Log

## Design Notes

The `@convex-dev/stripe` component creates its own namespaced tables (`customers`, `subscriptions`, `payments`, `invoices`, `checkout_sessions`). We use the component's `StripeSubscriptions` client from actions to create checkouts and manage subscriptions, then sync relevant state to our `tenants` table which drives the billing lifecycle and UI.

**Provider abstraction:** `convex/platformBilling.ts` is the single entry point for all platform billing operations. Internally it routes to the correct provider based on `platformSettings.enabledPlatformProviders`. This sprint only implements the Stripe path; SaligPay will be added later by extending this module.

**Key distinction:** `tenants.billingProvider` = `"stripe"` means the SaaS Owner uses Stripe Connect to receive payments from their customers (merchant webhooks). The new `tenants.platformPaymentProvider` field tracks how the SaaS Owner pays the salig-affiliate platform itself. Separate routes, separate concerns.

**Webhook separation:** `/stripe/webhook` (component) = platform billing. `/api/webhooks/stripe` = merchant Connect. No collision.

## Verification

**Commands:**
- `pnpm tsc --noEmit` -- expected: no errors
- `pnpm lint` -- expected: no new errors
- `pnpm build` -- expected: successful build

**Manual checks:**
- Verify `convex/convex.config.ts` includes stripe component
- Verify `convex/http.ts` has `/stripe/webhook` route registered
- Verify schema has new tenant and platformSettings fields
- Verify `/admin-settings` shows provider toggle card
- Verify billing page shows provider selection
- Verify MockCheckoutModal and MockPaymentForm are deleted
