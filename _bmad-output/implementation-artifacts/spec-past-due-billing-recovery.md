---
title: 'past-due-billing-recovery'
type: 'bugfix'
created: '2026-04-19'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Past-due users clicking "Update Payment" from the dashboard banner land on the billing page with no past-due-specific guidance. The only CTA visible is "Upgrade to Scale", which is the wrong action — they need to pay their overdue balance, not change plans.

**Approach:** Add a prominent "Overdue Payment" card with a "Pay Now" button to the billing page, hide plan-change CTAs for past-due users, add a `reactivateSubscription` mutation for self-service reactivation, and show correct copy in the checkout modal.

## Suggested Review Order

1. `convex/subscriptions.ts` — new `reactivateSubscription` mutation (backend)
2. `convex/platformBilling.ts` — same-plan checkout guard relaxed for past_due
3. `src/app/(auth)/settings/billing/page.tsx` — past-due banner + Pay Now handler + hidden CTAs
4. `src/components/settings/CheckoutModal.tsx` — `isPastDuePayment` prop for correct copy

## Code Map

- `convex/subscriptions.ts` — `reactivateSubscription` mutation for self-service past-due recovery
- `convex/platformBilling.ts` — relaxed same-plan guard for `subscriptionStatus === "past_due"`
- `src/app/(auth)/settings/billing/page.tsx` — past-due UI state, banner card, Pay Now handler, suppressed CTAs
- `src/components/settings/CheckoutModal.tsx` — `isPastDuePayment` prop for contextual title/description

## Tasks & Acceptance

**Execution:**
- [x] `convex/subscriptions.ts` -- add `reactivateSubscription` mutation -- sets subscriptionStatus to active, resets pastDueSince, extends billing cycle
- [x] `convex/platformBilling.ts` -- allow same-plan checkout when past_due -- enables Stripe flow for reactivation
- [x] `src/app/(auth)/settings/billing/page.tsx` -- add past-due banner, Pay Now button, hide upgrade/downgrade/cancel CTAs -- clear UX path for past-due users
- [x] `src/components/settings/CheckoutModal.tsx` -- add `isPastDuePayment` prop with "Reactivate Your Plan" copy -- avoids confusing "Upgrade" language

**Acceptance Criteria:**
- Given a tenant with `subscriptionStatus === "past_due"`, when the user visits `/settings/billing`, then an amber "Overdue Payment" card is displayed with a "Pay Now" button
- Given a past-due user, when upgrade/downgrade/cancel CTAs are rendered, then they are hidden
- Given a past-due non-Stripe tenant, when "Pay Now" is clicked, then `reactivateSubscription` is called with mockPayment and the tenant status becomes "active"
- Given a past-due Stripe tenant, when "Pay Now" is clicked, then the CheckoutModal opens with "Reactivate Your Plan" title
- Given a past-due Stripe tenant completing checkout, then `createPlatformCheckout` succeeds despite same plan (guard relaxed)

## Design Notes

For non-Stripe tenants (mock payment), `reactivateSubscription` directly patches the tenant to `"active"` status. For Stripe tenants, it opens the CheckoutModal which calls `createPlatformCheckout` — Stripe's webhook (`checkout.session.completed`) then sets status to `"active"` via `syncStripeSubscriptionToTenant`.

## Verification

**Commands:**
- `pnpm tsc --noEmit` -- expected: exit 0, no type errors
