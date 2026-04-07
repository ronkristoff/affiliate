---
title: "Universal Billing Provider Integration with Unified Lead Matching"
slug: "universal-billing-provider-integration"
created: "2026-04-07"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16.1.0", "Convex 1.32.0", "TypeScript 5.9.3", "Stripe Webhooks (stripe SDK)", "Better Auth 1.4.9", "@convex-dev/better-auth 0.10.13", "Tailwind CSS 4.1.16", "React 19.2.3", "Radix UI", "React Hook Form 7.65.0", "Zod 4.1.12"]
files_to_modify: ["convex/schema.ts", "convex/http.ts", "convex/webhooks.ts", "convex/commissionEngine.ts", "convex/conversions.ts", "convex/tenants.ts", "convex/tenantStats.ts", "convex/clicks.ts", "public/track.js", "src/components/onboarding/OnboardingWizard.tsx", "src/components/onboarding/TrackingSnippetInstaller.tsx", "src/components/onboarding/CheckoutAttributionGuide.tsx", "src/components/onboarding/AttributionVerifier.tsx", "src/app/(auth)/onboarding/page.tsx", "src/app/(auth)/onboarding/layout.tsx"]
code_patterns: ["convex-new-function-syntax", "httpAction-webhooks", "billingEvent-normalizer", "denormalized-counters", "atomic-dedup-via-ensureEventNotProcessed", "iife-global-export", "suspense-boundaries", "internalMutation-hooks"]
test_patterns: ["vitest-configured-but-no-real-tests", "convex-test-via-cli", "stripe-cli-listen"]
---

# Tech-Spec: Universal Billing Provider Integration with Unified Lead Matching

**Created:** 2026-04-07

## Overview

### Problem Statement

Merchants using Stripe (or any payment provider other than SaligPay) currently have no native integration path. To use Affilio with Stripe, a merchant must manually implement the `/track/conversion` API call from their backend — requiring them to read cookies, extract attribution data, and make server-side API calls with proper authentication. Even existing SaligPay merchants must touch their checkout code to pass attribution metadata. Each new payment provider would require a new, provider-specific integration pattern. This friction limits adoption and makes the onboarding experience dependent on the merchant's technical ability.

Additionally, the project is rebranding from "SaligAffiliate" to **"Affilio"** — all references to `SaligAffiliate`, `window.SaligAffiliate`, `_salig_aff` cookie names, and related branding must be updated throughout the codebase.

### Solution

Introduce a **unified, provider-agnostic lead matching system** that requires the merchant to add only **one line of JavaScript** on their signup form: `Affilio.referral({email})`. This creates a "lead" record linking the customer's email to the affiliate, campaign, and click. When any payment webhook fires (Stripe, SaligPay, or future providers), the system matches the customer email against existing leads and auto-creates commissions through the existing pipeline.

**For Stripe:** Add Stripe as the first new billing provider with Stripe Connect (OAuth) for account linking and a dedicated Stripe webhook handler (`POST /api/webhooks/stripe`) with signature verification and event normalization.

**For SaligPay:** Refactor the existing webhook to use the same lead matching (email lookup) while keeping metadata-based attribution as an optional precision enhancer for backward compatibility. New SaligPay merchants no longer need to pass metadata in their checkout — they just need the one `Affilio.referral()` call.

**For future providers:** Adding Chargebee, Braintree, Paddle, etc. requires only a new webhook normalizer — the lead matching, commission engine, and everything downstream is shared.

### Scope

**In Scope:**

- **Rebranding:** Rename all `SaligAffiliate` / `window.SaligAffiliate` references to `Affilio` / `window.Affilio` throughout `track.js`, frontend components, documentation, and code comments
- **Schema changes:** Add `billingProvider` field to `tenants` table (`"saligpay" | "stripe" | null`); add `stripeAccountId` top-level field (for index lookup) and `stripeCredentials` field; create new `referralLeads` table with unique index on `(tenantId, email)` and upsert semantics
- **track.js enhancement:** Add `Affilio.referral({email, uid})` method; rename global from `window.SaligAffiliate` to `window.Affilio`; rename cookie from `_salig_aff` to `_affilio` (clean break, no dual cookie reading — old cookies expire within attribution window)
- **Lead tracking endpoint:** New `POST /track/referral` endpoint to create/upsert lead records with server-side email validation
- **Stripe webhook handler:** New `POST /api/webhooks/stripe` with Stripe webhook signature verification, event deduplication (by Stripe event ID + `payment_intent_id`), Stripe-to-`BillingEvent` normalization, and tenant resolution via stored `stripeAccountId` mapping (Stripe Account ID → tenant lookup, since Stripe events don't contain Affilio metadata)
- **Stripe event normalizer:** Normalize Stripe events (`checkout.session.completed`, `invoice.paid`, `customer.subscription.*`, `charge.refunded`, `charge.dispute.created`) into unified `BillingEvent` format
- **Refactor SaligPay webhook:** Update `POST /api/webhooks/saligpay` to use lead matching (email lookup) as primary attribution, with metadata as optional enhancement
- **Commission engine update:** Refactor `commissionEngine.ts` to accept email-based lead matching (via `referralLeads` lookup) alongside existing metadata-based attribution; lead lookup must filter by `affiliate.status === "active"`
- **Stripe connection flow (MVP):** Merchant pastes their Stripe webhook signing secret in the dashboard (manual input, no OAuth). Merchant manually creates webhook endpoint in their Stripe dashboard pointing to `/api/webhooks/stripe`. Full Stripe Connect OAuth with auto-webhook configuration is deferred to post-MVP.
- **Tenant onboarding overhaul:**
  - **Step 2 becomes billing provider choice** — two equal, side-by-side cards: "Connect Stripe" and "Connect SaligPay", each with a brief description. No hierarchy, no "recommended" badge. Below both: "I'll set this up later" (skip) with helper text: "You can still track clicks and use the API. Connect a provider anytime from Settings."
  - **Stripe connection sub-flow:** OAuth redirect → auto webhook configuration → connection confirmation
  - **SaligPay connection sub-flow:** Existing mock OAuth flow (unchanged)
  - **Step 3 (Invite Team):** Existing team invitation step (unchanged, skippable)
  - **Step 4 (Tracking Snippet):** Updated snippet code reflects Affilio branding + shows `Affilio.referral({email})` usage
  - **Step 5 (Referral Tracking Setup):** Dynamic content based on selected provider:
    - **Both providers (same simple page):** Single code snippet showing `Affilio.referral({email})` with copy button. Copy: "When a customer signs up on your website, add this line to capture their referral. That's it — we handle the rest."
    - **SaligPay only — advanced collapsible:** Below the simple approach, an expandable "Advanced: Metadata Enhancement" section showing the optional metadata-passing approach for click-level precision. Most merchants will never expand this.
    - **No provider connected:** Shows the referral() snippet still works, but notes that connecting a provider enables automatic commission tracking via webhooks.
    - **Step 5 not skippable when provider is connected.** Skip is only available when no provider is connected (API-only mode).
  - **Step 6 (Dashboard completion):** Summary showing connected provider + snippet status
- **Settings UI:** Dynamic billing connection status showing current provider; ability to **switch providers** (leads survive the switch, commission engine is provider-agnostic — UI messaging: "Your existing referral tracking will continue working with your new provider"); Stripe connection/disconnect; SaligPay connection/disconnect; rename all UI references from "SaligAffiliate" to "Affilio"
- **Referral health monitoring:** Add a referral ping to `track.js` that fires when `Affilio.referral()` is called (similar to existing `trackingPing` for snippet verification). Dashboard shows "Referral tracking: Active — last detected 2h ago" or "Not detected — check your signup form."
- **Dashboard setup completeness banner:** If a provider is connected but no referral pings have been received, show a persistent dashboard banner: "Referral tracking not configured — commissions won't be created until you add one line to your signup form."
- **Step 5 not skippable when provider is connected:** If the merchant has connected Stripe or SaligPay, Step 5 (referral tracking setup) cannot be skipped. Skip is only available when no provider is connected (API-only mode).
- **Stripe test mode handling:** Check Stripe `livemode` flag on incoming webhooks. If `livemode === false`, either reject or tag as test commission. Store `stripeCredentials.mode` to reflect test/live status. Show "Test Mode" badge in dashboard when in test mode.
- **Provider disconnect cleanup:** When disconnecting a provider, explicitly delete the webhook endpoint from the provider's dashboard via their API (Stripe: delete webhook endpoint). Prevents orphaned webhooks from firing into a disconnected state.
- **Provider switch warning:** Before disconnecting a provider, show a warning dialog with the count of active subscriptions that would lose renewal tracking: "You have X active subscriptions tracked via [Provider]. Switching means renewal commissions for those subscriptions won't be tracked."
- **Stripe OAuth token management:** ~~Store both `access_token` and `refresh_token`...~~ **Deferred to post-MVP.** MVP uses manual signing secret — no token lifecycle.
- **Onboarding guide best practices:** Explicitly tell merchants to add `Affilio.referral()` to **every** signup form on their site (not just one). Recommend calling `referral()` **after** email verification, not before, to ensure the email is correct.
- **Backward compatibility:** Existing SaligPay tenants with metadata passing continue working through the webhook's optional metadata enhancement path. No dual cookie reading — merchants update to new snippet which only sets `_affilio` cookies.
- **Known limitation documented:** If a customer signs up with one email but pays with a different email, attribution may fail. Document this in the merchant guide. Recommend calling `referral()` after email verification. The optional `uid` parameter provides a fallback for stable customer IDs.

**Out of Scope:**

- Chargebee / Braintree / Paddle / Recurly support (future, same pattern)
- Removing SaligPay as a payment option
- Stripe Connect destination payments / multi-party payouts
- Changes to payout system, fraud detection engine, or affiliate portal
- Changes to commission calculation logic, recurring commission rules, or tier overrides
- Marketing landing page rebranding (separate spec)
- Email template rebranding (separate spec)
- Allowing merchants to connect BOTH Stripe and SaligPay simultaneously (single provider per tenant for MVP — **first post-MVP enhancement**)
- **Stripe Connect OAuth with auto-webhook configuration** (deferred to post-MVP — MVP uses manual signing secret input)
- "Test Your Setup" flow per provider (post-MVP — simulates signup + payment to verify end-to-end)
- Auto-detecting merchant's payment provider from their page during verification ping (post-MVP)

## Context for Development

### Codebase Patterns

- **Convex function syntax:** All functions use `query({ args, returns, handler })` pattern with `v.*` validators
- **Internal functions:** `internalQuery`, `internalMutation`, `internalAction` for private functions; prefixed with `Internal` in name
- **Webhook pattern:** HTTP endpoints in `convex/http.ts` using `httpAction`; raw body read first for data loss prevention; atomic dedup via `ensureEventNotProcessed`; normalize to `BillingEvent` format; route to `commissionEngine`
- **Commission engine:** `commissionEngine.ts` processes `BillingEvent` objects and creates conversions + commissions through a shared pipeline
- **Lead tracking reference:** FirstPromoter's `fpr("referral", {email})` pattern — creates a "lead" record that links customer email to affiliate, enabling webhook matching without merchant checkout code
- **Cookie naming convention:** Currently `_salig_aff`; renaming to `_affilio`; Base64-encoded JSON with `{code, clickId, tenantId, timestamp}`
- **Metadata keys:** Currently `_salig_aff_ref`, `_salig_aff_click_id`, `_salig_aff_tenant`; renaming to `_affilio_ref`, `_affilio_click_id`, `_affilio_tenant`
- **Suspense boundaries:** All client components using `useQuery` must be wrapped in `<Suspense>` with skeleton fallbacks
- **Denormalized counters:** `tenantStats.ts` hooks must be called on every status-changing mutation (clicks, conversions, commissions)
- **No dynamic imports in queries/mutations:** Only `action` and `httpAction` support `await import()`

### Files to Reference

| File | Lines | Purpose | What to Change |
| ---- | ----- | ------- | -------------- |
| `convex/schema.ts` | 642 | Database schema | Add `billingProvider`, `stripeCredentials` to `tenants`; add `referralLeads` table; add index `by_stripe_account_id` to `tenants` |
| `convex/http.ts` | ~1800 | HTTP endpoints | Add `POST /api/webhooks/stripe` route (Stripe webhook handler with signature verification, tenant resolution via `stripeAccountId`, dedup, normalize, route to commissionEngine) |
| `convex/webhooks.ts` | ~285 | Webhook normalization | Add `normalizeStripeToBillingEvent` function (Stripe events → `BillingEvent` interface); extend `BillingEventType` to include `"chargeback.created"` (currently missing from type but handled in routing) |
| `convex/commissionEngine.ts` | 1504 | Commission pipeline | Add email-based lead matching fallback in `processPaymentUpdatedToCommission` (after line 166), `processSubscriptionCreatedEvent` (after line 399), `processSubscriptionUpdatedEvent` (after line 733). Pattern: if no `attribution.affiliateCode` but `payment.customerEmail` exists, look up `referralLeads` table |
| `convex/conversions.ts` | 1256 | Conversion creation | Add `findLeadByEmailInternal` query (lookup `referralLeads` by tenantId + email, filter by active affiliate); add lead `status` update to `"converted"` on conversion creation |
| `convex/clicks.ts` | 604 | Click tracking | Reference for dedup pattern (`by_dedupe_key` index); `validateAffiliateCodeInternal` validates affiliate is active |
| `convex/tenants.ts` | 1980 | Tenant management | Add `connectStripe`, `disconnectStripe`, `getStripeConnectionStatus` (mirrors `connectMockSaligPay` pattern at lines 807-878); add `billingProvider` field management; add Stripe OAuth token refresh |
| `convex/tenantStats.ts` | 696 | Denormalized counters | Add `onLeadCreated` hook; add `onLeadConverted` hook; add lead counters to `tenantStats` schema (e.g., `leadsThisMonth`, `leadsConvertedThisMonth`); update `seedStats` and `backfillStats` |
| `public/track.js` | 368 | Tracking library | Add `Affilio.referral({email, uid})` method; rename global `window.SaligAffiliate` → `window.Affilio` (lines 13, 17, 355, 366); rename cookie `_salig_aff` → `_affilio` (line 19); add referral health ping; update log prefix (lines 287, 289) |
| `src/components/onboarding/OnboardingWizard.tsx` | 476 | Onboarding flow | Replace Step 2 "Connect SaligPay" with provider choice UI (lines 23-38, 256-398); add Step 5 "Referral Tracking Setup" with dynamic content; make Step 5 non-skippable when provider connected |
| `src/components/onboarding/TrackingSnippetInstaller.tsx` | 407 | Snippet installer | Already uses "Affilio" branding; add `Affilio.referral({email})` usage example |
| `src/components/onboarding/CheckoutAttributionGuide.tsx` | 306 | Attribution guide | Replace 3 hardcoded SaligPay tabs (lines 28-131) with dynamic content per provider; add simple referral() snippet for both providers; add collapsible advanced section for SaligPay metadata; rename 26 brand references |
| `src/components/onboarding/AttributionVerifier.tsx` | 259 | Attribution verification | Rename `window.SaligAffiliate` references (lines 52, 53, 62); rename "SaligPay Integration" labels (lines 78, 80) |
| `src/app/(auth)/onboarding/page.tsx` | 43 | Onboarding page | Verify Suspense wrapper; no major changes expected |
| `src/app/(auth)/onboarding/layout.tsx` | 21 | Onboarding layout | No changes expected |
| `convex/fraudDetection.ts` | 295 | Fraud detection | No changes needed — already email/IP/device agnostic; `detectSelfReferral` works on conversion records which are unchanged |
| `docs/scalability-guidelines.md` | 130 | Scalability rules | Add `referralLeads` to `.take()` cap reference table (recommended: 500-800 for dashboard, 50-300 for list queries) |

### Technical Decisions

1. **Email-based lead matching as the universal attribution mechanism** — Matches FirstPromoter pattern; one line of merchant code for any provider; metadata becomes optional enhancement
2. **Clean cookie rename (no dual reading)** — `_salig_aff` → `_affilio` as a clean break. Merchants must update their snippet to get `Affilio.referral()`. Old cookies expire naturally within the attribution window (max 365 days). No backward compatibility shim needed.
3. **`referralLeads` as a new Convex table** — Not embedded in `conversions` because leads are created at signup time, not at conversion time; allows for future "lead-only" tracking (signup without purchase). **Unique index on `(tenantId, email)` with upsert semantics** to prevent duplicates from double-form-submits or SPA navigation.
4. **Stripe manual API key input for MVP** — Merchant pastes their Stripe webhook signing secret (from Stripe Dashboard > Developers > Webhooks). Full Stripe Connect OAuth with auto-webhook configuration is deferred to post-MVP alongside multi-provider support. This matches the existing SaligPay mock pattern and eliminates OAuth complexity (token lifecycle, refresh, redirect handling).
5. **Unified `BillingEvent` normalizer pattern** — Each provider has its own normalizer but all output the same `BillingEvent` type; `commissionEngine` is completely provider-agnostic. **The normalizer is the only provider-specific component** — adding future providers requires only a new webhook normalizer.
6. **Project rebrand to "Affilio"** — Global rename of `SaligAffiliate` → `Affilio`, `_salig_aff` → `_affilio`, and all related metadata keys (`_salig_aff_ref` → `_affilio_ref`, etc.)
7. **Core pipeline is provider-agnostic by design** — The `billingProvider` field on `tenants` is a UX/config concern, not an architectural dependency. The lead table, commission engine, fraud detection, and payout system don't care which provider is used.
8. **Explicit `referral()` call is the right minimum** — Automatic email interception (e.g., intercepting form submissions) was considered and rejected as too fragile, invasive, and privacy-concerning. The merchant must explicitly call `Affilio.referral({email})` to maintain control and trust.
9. **`uid` matching alongside email** — `Affilio.referral({email, uid})` accepts an optional uid (e.g., Stripe customer ID). Webhook handlers try uid match first, then email fallback. Handles the case where customers use different emails at signup vs payment.
10. **Webhook-before-lead race condition handling** — If a Stripe instant payment webhook arrives before the lead record is written, the webhook handler creates an organic conversion. This is acceptable behavior — the merchant's signup form should fire `referral()` before the payment completes in virtually all real-world flows.
11. **Lead lookup filters by active affiliate status** — Even if a lead exists, the commission engine must verify the linked affiliate is still `active` before creating a commission. Prevents payouts to suspended affiliates.
12. **Stripe dedup by `payment_intent_id`** — In addition to event ID dedup, add Stripe-specific dedup using `payment_intent_id` to prevent double commissions from out-of-order events.
13. **Single billing provider per tenant (MVP)** — A tenant chooses either Stripe or SaligPay, not both. Switching providers disconnects the old one. **Leads survive a provider switch** — a lead is just `{email → affiliateId}`, it doesn't know which provider the customer will pay through. UI messaging when switching: "Your existing referral tracking will continue working with your new provider." Future: support multiple simultaneous providers.
14. **Equal provider presentation in onboarding** — Stripe and SaligPay presented as two equal, side-by-side cards with no hierarchy or "recommended" badge. The merchant picks what works for their business.
15. **Step 5 is provider-equal for the simple path** — Both Stripe and SaligPay tenants see the same simple page: one `Affilio.referral({email})` snippet with a copy button. SaligPay-only: collapsible advanced metadata section below. No provider-specific tabs or options for the basic setup.
16. **Merchant-facing language uses "referral tracking" not "lead matching"** — The `referralLeads` table name is developer-only terminology. Merchants see: "When a customer signs up, we remember which affiliate sent them." The "address book" mental model should inform all onboarding copy.
17. **Provider switching from Settings** — Supported. Disconnect current provider → connect new one. Leads, click history, and affiliate relationships are unaffected. Only the webhook normalizer changes.
18. **Step 5 mandatory when provider connected** — If a billing provider is connected, Step 5 (referral tracking setup) cannot be skipped. Skip is only available in API-only mode (no provider connected). Prevents the "connected provider but no attribution" failure mode.
19. **Referral health ping** — `Affilio.referral()` sends a verification ping (similar to existing `trackingPing`) when called. Dashboard shows referral tracking status: "Active — last detected 2h ago" or "Not detected." This gives merchants confidence that their setup is working before the first real conversion.
20. **Provider disconnect cleanup** — When disconnecting Stripe, explicitly delete the webhook endpoint from the merchant's Stripe dashboard via Stripe API. Prevents orphaned webhooks.
21. **Provider switch warning dialog** — Before disconnecting, warn the merchant with count of active subscriptions that would lose renewal tracking. Merchants must explicitly confirm.
22. **Stripe webhook signing secret for MVP** — Merchant pastes their signing secret manually (no OAuth token lifecycle to manage). Deferred to post-MVP: full Stripe Connect OAuth with auto-webhook configuration.
23. **Stripe test mode isolation** — Check `livemode` flag on webhooks. Reject or tag as test commission. Store mode in `stripeCredentials.mode`. Show "Test Mode" badge in dashboard.
24. **Stripe webhook tenant resolution via Stripe Account ID** — When a merchant connects Stripe via OAuth, we store their `stripeAccountId` in `stripeCredentials`. When a Stripe webhook arrives, we extract the account from the event payload and look up the tenant by `stripeAccountId`. This is how the webhook knows which tenant to attribute to — unlike SaligPay (where tenant ID comes from metadata), Stripe events must be resolved via the stored account mapping.
25. **Known limitation: email mismatch** — If customer uses different email at signup vs payment, attribution may fail. Document in merchant guide. Mitigations: (a) recommend calling `referral()` after email verification, (b) optional `uid` parameter for stable customer ID matching.

### Schema: referralLeads Table

```typescript
referralLeads: defineTable({
  tenantId: v.id("tenants"),           // Which merchant this lead belongs to
  email: v.string(),                    // Customer email (primary lookup key)
  uid: v.optional(v.string()),          // Optional stable customer ID (e.g., Stripe customer ID)
  affiliateId: v.id("affiliates"),      // Which affiliate referred this customer
  referralLinkId: v.id("referralLinks"), // Which referral link was clicked
  campaignId: v.optional(v.id("campaigns")), // Which campaign (if any)
  clickId: v.optional(v.id("clicks")),  // Which click record (if tracked)
  status: v.union(                      // Lead lifecycle
    v.literal("active"),                // Signup recorded, no conversion yet
    v.literal("converted"),             // Conversion created and linked
    v.literal("expired"),               // Past attribution window, no conversion
  ),
  convertedAt: v.optional(v.number()),  // Timestamp when conversion was linked
  conversionId: v.optional(v.id("conversions")), // Linked conversion record
})
  .index("by_tenant_email", ["tenantId", "email"])         // UNIQUE: upsert + webhook lookup
  .index("by_tenant_affiliate", ["tenantId", "affiliateId"]) // Query affiliate's leads
  .index("by_tenant_uid", ["tenantId", "uid"])             // UID-based lookup fallback
```

**Design notes:**
- `by_tenant_email` is the primary index — used by webhook handlers for email-based lookup and by `POST /track/referral` for upsert (find existing by tenantId + email, update or insert)
- `by_tenant_affiliate` enables "leads per affiliate" reporting in the dashboard
- `by_tenant_uid` enables uid-based matching as a fallback when email doesn't match
- `status` tracks the lead lifecycle: `active` → `converted` (when webhook creates a commission) or `active` → `expired` (when archival cron runs)
- `conversionId` links the lead to the conversion record, preventing double-commission if the same customer pays multiple times

### Schema: Stripe Credentials on Tenants

```typescript
// New fields on existing tenants table
billingProvider: v.optional(v.union(
  v.literal("saligpay"),
  v.literal("stripe"),
)),

stripeAccountId: v.optional(v.string()),    // Top-level for index (tenant resolution via webhook)

stripeCredentials: v.optional(v.object({
  signingSecret: v.string(),               // Webhook signing secret (manual input for MVP)
  mode: v.optional(v.string()),           // "test" or "live"
  connectedAt: v.optional(v.number()),    // When the merchant connected
})),
// NOTE: OAuth fields (accessToken, refreshToken, tokenExpiresAt, webhookEndpointId)
// are deferred to post-MVP. MVP uses manual signing secret input.
```

## Implementation Plan

### Tasks

#### Phase 1: Schema & Foundation

- [x] **Task 1: Add `referralLeads` table and update `tenants` table in `convex/schema.ts`**
  - File: `convex/schema.ts`
  - Action:
    1. Add `referralLeads` table (fields, indexes as defined in Schema section above)
    2. Add `billingProvider: v.optional(v.union(v.literal("saligpay"), v.literal("stripe")))` to `tenants`
    3. Add `stripeCredentials: v.optional(v.object({...}))` to `tenants` (fields as defined in Schema section above)
    4. Add index `by_stripe_account_id: ["stripeCredentials.stripeAccountId"]` to `tenants` — **NOTE:** Convex does not support indexes on nested object fields. Alternative: add top-level `stripeAccountId: v.optional(v.string())` field on `tenants` and index that separately.
    5. Add lead counter fields to `tenantStats` table: `leadsCreatedThisMonth: v.number()`, `leadsConvertedThisMonth: v.number()`
    6. Add `referralPings` table (mirrors `trackingPings` structure) for referral health monitoring: `{ tenantId, trackingKey, timestamp, domain, userAgent, ipAddress }`
    7. Add `referralPings` to `deleteTenantData` cascade in `convex/tenants.ts` line 966+
  - Notes: Convex schema changes are backward-compatible. No migration needed — new optional fields don't affect existing data. `stripeAccountId` as a top-level field with index is required because Convex doesn't index nested objects.

- [x] **Task 2: Update `seedStats` and `backfillStats` in `convex/tenantStats.ts` for new counters**
  - File: `convex/tenantStats.ts`
  - Action:
    1. Add `leadsCreatedThisMonth: 0` and `leadsConvertedThisMonth: 0` to `seedStats` mutation (line 177+)
    2. Add lead counter backfill logic to `backfillStats` mutation (line 209+) — count leads per tenant from `referralLeads` table using `.take(1000)` cap
    3. Ensure monthly boundary reset copies `leadsCreatedThisMonth` to a `leadsCreatedLastMonth` field and zeroes it

- [x] **Task 3: Add `referralLeads` to scalability guidelines**
  - File: `docs/scalability-guidelines.md`
  - Action: Add row to `.take()` cap reference table: `findLeadByEmail | referralLeads | 1 | ~800B | 800B | 1250x` (single lookup via `by_tenant_email` index). Add note: "referralLeads queries MUST use index-based lookup, never `.collect()` on the full table."

#### Phase 2: Backend — Lead Tracking

- [x] **Task 4: Create `convex/referralLeads.ts` with core lead management functions**
  - File: `convex/referralLeads.ts` (NEW)
  - Action:
    1. Create `createOrUpdateLead` internalMutation — upsert logic with **first-affiliate preservation**: query `by_tenant_email` index, if exists and `status === "active"`, **do NOT overwrite** `affiliateId/referralLinkId/campaignId` (first affiliate wins — consistent with cookie precedence policy). Only update `uid` if provided. If lead exists but `status !== "active"` (e.g., expired), treat as new insert. If no existing lead, insert with `status: "active"`. Call `onLeadCreated` tenantStats hook on insert only.
    2. Create `findLeadByEmail` internalQuery — lookup by `tenantId` + `email` via `by_tenant_email` index, return lead where `status === "active"` and linked affiliate is still active (join check)
    3. Create `findLeadByUid` internalQuery — lookup by `tenantId` + `uid` via `by_tenant_uid` index, same active affiliate filter
    4. Create `markLeadConverted` internalMutation — update lead `status` to `"converted"`, set `convertedAt`, `conversionId`. Call `onLeadConverted` tenantStats hook.
    5. Create `markLeadReversed` internalMutation — when a commission is reversed (refund/chargeback), update lead `status` back to `"active"`, clear `convertedAt` and `conversionId`. This allows future payments from the same customer to create new commissions. Only reverse if the lead's current `conversionId` matches the reversed commission.
    6. Create `expireStaleLeads` internalMutation — find leads where `status === "active"`, `_creationTime` > 90 days (or tenant's longest campaign attribution window), and no `conversionId`. Set `status: "expired"`. Cap at 100 per run to avoid write hotspots.
    7. Create `getLeadsByAffiliate` query — paginated leads for affiliate dashboard, using `by_tenant_affiliate` index with `.paginate()`

- [x] **Task 5: Add `POST /track/referral` endpoint in `convex/http.ts`**
  - File: `convex/http.ts`
  - Action:
    1. Add `POST /track/referral` route using `httpAction`
    2. Parse body: `{ tenantId, email, uid?, affiliateCode? }` — affiliateCode optional (inferred from cookie if not provided)
    3. Validate: tenant exists, email format is valid (regex or Zod-style), email is not empty
    4. If no `affiliateCode` in body, attempt to read `_affilio` cookie and extract `code` from it (same Base64 JSON parsing as `track.js`)
    5. Look up `referralLinks` by code to get `affiliateId`, `referralLinkId`, `campaignId`
    6. Validate affiliate is `active` (via `validateAffiliateCodeInternal` from `clicks.ts`)
    7. Call `internal.referralLeads.createOrUpdateLead` with all resolved fields
    8. Fire referral health ping (similar to `sendPing` in track.js — `POST /api/tracking/referral-ping` or reuse existing ping mechanism)
    9. Return `{ success: true, leadId }` with HTTP 200 (never fail loudly — always return 200 to not break merchant's signup)

#### Phase 3: track.js Rebrand & Enhancement

- [x] **Task 6a: Rename `public/track.js` from SaligAffiliate to Affilio (rebrand only)**
  - File: `public/track.js`
  - Action:
    1. Rename `var SaligAffiliate` → `var Affilio` (line 17)
    2. Rename double-init guard `window.SaligAffiliate` → `window.Affilio` (line 13)
    3. Rename cookie `cookieName: '_salig_aff'` → `'_affilio'` (line 19)
    4. Rename log prefix `'[SaligAffiliate]'` → `'[Affilio]'` (lines 287, 289)
    5. Rename auto-init call `SaligAffiliate.init()` → `Affilio.init()` (line 355)
    6. Rename global export `window.SaligAffiliate = SaligAffiliate` → `window.Affilio = Affilio` (line 366)
    7. Update `getAttributionData` (line 297) to read `_affilio` cookie instead of `_salig_aff`
    8. Update `getCookie` (line 214) to look for `_affilio` cookie name
    9. Update `setCookie` / `clearCookie` to use `_affilio` name
    10. Update `handleReferralPath` cookie write to use new name
  - Notes: This task is the **clean rename** — no new functionality. Verify by loading track.js in a browser and confirming `window.Affilio` is defined and `window.SaligAffiliate` is undefined. All existing click tracking must still work identically.

- [x] **Task 6b: Add `Affilio.referral()` method and health ping to `public/track.js`**
  - File: `public/track.js`
  - Action: **Depends on T6a (rename complete).**
    1. Add `referral` method to the `Affilio` object (before the closing `};` around line 351):
       ```js
       referral: function(data) {
         if (!data || !data.email) { self.log('referral() requires an email address'); return; }
         var attributionData = self.getAttributionData() || {};
         var body = { email: data.email };
         if (data.uid) body.uid = data.uid;
         if (attributionData.code) body.affiliateCode = attributionData.code;
         if (attributionData.tenantId) body.tenantId = attributionData.tenantId;
         fetch('/track/referral', {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(body), keepalive: true,
         }).catch(function(e) { self.log('referral() failed: ' + e.message); });
         // Fire health ping
         self.sendReferralPing(data.email);
       },
       ```
    2. Add `sendReferralPing` method (similar to existing `sendPing` at lines 128-156): `POST /api/tracking/ping` with extra field `type: "referral"` and `email` to distinguish from snippet pings
  - Notes: Verify by calling `Affilio.referral({email: "test@test.com"})` in browser console and confirming a POST request to `/track/referral` fires and a ping is sent.

#### Phase 4: Stripe Webhook Handler

- [x] **Task 7a: Install Stripe SDK and update webhook type definitions**
  - File: `package.json`, `convex/webhooks.ts`
  - Action:
    1. Add `stripe` to dependencies: `pnpm add stripe`
    2. In `convex/webhooks.ts`, extend `BillingEventType` to include `"chargeback.created"` (currently missing from type definition at line 16-21 but handled in routing)
  - Notes: This is a setup task — no new logic, just dependency + type fix.

- [x] **Task 7b: Create Stripe webhook event normalizer**
  - File: `convex/webhooks.ts`
  - Action: **Depends on T7a (Stripe SDK installed).**
    1. Create `normalizeStripeToBillingEvent(payload: any): BillingEvent | null` function:
       - Extract Stripe event type from `payload.type`
       - Map Stripe events to BillingEvent types:
         - `checkout.session.completed` → `"payment.updated"` (one-time payment)
         - `invoice.paid` → `"payment.updated"` (subscription payment)
         - `customer.subscription.created` → `"subscription.created"`
         - `customer.subscription.updated` → `"subscription.updated"`
         - `customer.subscription.deleted` → `"subscription.cancelled"`
         - `charge.refunded` → `"refund.created"`
         - `charge.dispute.created` → `"chargeback.created"`
       - Extract `customerEmail` from `payload.data.object.customer_details.email` or `payload.data.object.customer_email`
       - Extract `amount` from `payload.data.object.amount_total` or `payload.data.object.amount` (Stripe uses cents, same as BillingEvent)
       - Extract `currency` from `payload.data.object.currency`
       - Extract `payment.id` from `payload.data.object.payment_intent` or `payload.data.object.id`
       - Set `payment.status` based on Stripe status
       - Extract `livemode` from `payload` for test mode detection
       - Return null for unhandled event types

- [x] **Task 8: Add `POST /api/webhooks/stripe` route in `convex/http.ts`**
  - File: `convex/http.ts`
  - Action:
    1. Add `POST /api/webhooks/stripe` route using `httpAction` (after the SaligPay webhook handler, around line 915)
    2. Add `OPTIONS` preflight handler for CORS (mirror lines 904-914)
    3. **Signature verification:** Read `Stripe-Signature` header, use `stripe.webhooks.constructEvent()` to verify payload authenticity. Extract signing secret from tenant's `stripeCredentials`. If verification fails, return 200 (don't break merchant) but log error.
    4. **Tenant resolution:** Extract `account` from `payload.account` (Stripe Connect account ID). Query tenants table for matching `stripeAccountId`. If not found, return 200 with warning log (orphaned webhook).
    5. **Test mode check:** If `payload.livemode === false`, skip processing and return 200 with test mode indicator.
    6. **Deduplication:** Call `internal.webhooks.ensureEventNotProcessed` with `source: "stripe"`, `eventId: payload.id`, extract `tenantId` from resolved tenant, raw payload as string
    7. **Normalize:** Call `normalizeStripeToBillingEvent(payload)` — if null, update webhook status to "failed", return 200
    8. **Stripe-specific dedup:** If `billingEvent.eventType` is `"payment.updated"`, check for existing commission with `transactionId` matching the Stripe `payment_intent_id`. If found, skip (out-of-order event).
    9. **Email-based attribution:** Before routing to commission engine, if `billingEvent.attribution` is undefined and `billingEvent.payment.customerEmail` exists, look up `referralLeads` by email. If lead found, populate `billingEvent.attribution` with `affiliateCode` from the lead's linked affiliate. If no lead found, leave attribution undefined (organic).
    10. **Route to commission engine:** Same routing pattern as SaligPay handler (lines 839-874) — dispatch to appropriate `internal.commissionEngine.*` function based on `billingEvent.eventType`
    11. **Always return 200** — never return error status codes
  - Notes: To enable local testing without Stripe CLI, add a companion mock endpoint `POST /api/mock/stripe-webhook` (mirroring the existing `POST /api/mock/trigger-payment` pattern) that accepts a test event payload and processes it through the same pipeline.

#### Phase 4.5: Mock Stripe Webhook (Local Testing)

- [x] **Task 7c: Add mock Stripe webhook trigger endpoint for local development**
  - File: `convex/http.ts`
  - Action: **Depends on T7b (normalizer exists) and T8 (real webhook handler exists).**
    1. Add `POST /api/mock/stripe-webhook` route using `httpAction`
    2. Accept a JSON body mimicking a Stripe webhook payload (at minimum: `type`, `data.object.amount_total`, `data.object.customer_details.email`, `data.object.payment_intent`, `livemode`)
    3. Construct a mock raw payload string for the dedup system
    4. Route through the same normalization and commission engine pipeline as the real Stripe handler
    5. Require auth (only works in dev mode)
  - Notes: This mirrors the existing `POST /api/mock/trigger-payment` pattern for SaligPay. Enables end-to-end testing of the Stripe pipeline without Stripe CLI or a real Stripe account.

#### Phase 5: Commission Engine — Email-Based Lead Matching

- [x] **Task 9: Add email-based lead matching fallback to `convex/commissionEngine.ts`**
  - File: `convex/commissionEngine.ts`
  - Action:
    1. Create a shared helper function `resolveAttributionFromLead(ctx, tenantId, billingEvent)` that:
       - If `billingEvent.attribution?.affiliateCode` exists → return it (existing metadata path)
       - If `billingEvent.payment.customerEmail` exists → call `internal.referralLeads.findLeadByEmail({ tenantId, email })`
       - If lead found → return `{ affiliateCode: lead.affiliateCode, referralLinkId: lead.referralLinkId, campaignId: lead.campaignId, clickId: lead.clickId, attributionSource: "lead" }`
       - If no lead found → return null (organic)
       - Also try `findLeadByUid` if `billingEvent.payment.uid` exists (or Stripe customer ID is available)
    2. In `processPaymentUpdatedToCommission` (line 128): After the no-attribution early-return check (line 166), add call to `resolveAttributionFromLead`. If it returns attribution, populate `affiliateCode` and proceed with existing flow. If null, create organic conversion.
    3. In `processSubscriptionCreatedEvent` (line 358): Same pattern after line 399.
    4. In `processSubscriptionUpdatedEvent` (line 691): Same pattern after line 733.
    5. After successful commission creation, call `internal.referralLeads.markLeadConverted` with the lead ID and conversion ID to update lead status.
  - Notes: This is the **minimum viable change** — extract a shared helper, inject it in the 3 primary handlers. The existing code-based attribution (metadata from SaligPay) continues to work as the primary path; lead matching is the fallback. **Important runtime boundary:** The commission engine handlers are `internalAction`s (Node.js runtime). `findLeadByEmail` and `findLeadByUid` are `internalQuery`s (V8 runtime). The helper must use `ctx.runQuery(internal.referralLeads.findLeadByEmail, {...})` to cross the runtime boundary — this is a Convex requirement, not optional.

- [x] **Task 10: Refactor SaligPay webhook handler to add email fallback**
  - File: `convex/http.ts` (SaligPay webhook section, lines 726-914)
  - Action:
    1. In the SaligPay webhook handler, after normalization to `BillingEvent` (line 815), add the same `resolveAttributionFromLead` call as Task 9.
    2. The flow becomes: metadata attribution (from `_salig_aff_ref` in payload) → if no metadata, email lead lookup → if no lead, organic.
    3. This makes the SaligPay handler consistent with the Stripe handler — both use the same fallback path.
    4. Existing SaligPay tenants with metadata passing are unaffected — metadata still takes precedence.

#### Phase 6: Tenant Management — Stripe Connection

- [x] **Task 11: Add Stripe connection mutations in `convex/tenants.ts`**
  - File: `convex/tenants.ts`
  - Action:
    1. Create `connectStripe` mutation — accepts `{ tenantId, signingSecret, stripeAccountId? }`. For MVP, the merchant pastes their Stripe webhook signing secret (from their Stripe dashboard > Developers > Webhooks). Store `stripeCredentials: { stripeAccountId, signingSecret, mode: "live", connectedAt }`. Set `billingProvider: "stripe"` on tenant. Set top-level `stripeAccountId` for index lookup. Create audit log. **Note:** Full Stripe Connect OAuth is deferred to post-MVP. Auto-webhook configuration is also deferred — the merchant manually creates the webhook endpoint in their Stripe dashboard pointing to `/api/webhooks/stripe`.
    2. Create `disconnectStripe` mutation — accepts `{ tenantId }`. Clear `stripeCredentials`, clear top-level `stripeAccountId`, set `billingProvider: undefined`. Create audit log. (No API call to delete webhook — deferred to post-MVP when auto-webhook config is added.)
    3. Create `getStripeConnectionStatus` query — returns `{ isConnected, stripeAccountId, mode, connectedAt }` or null.
    4. ~~Create `refreshStripeToken` internalAction — deferred to post-MVP (not needed for manual API key approach).~~
    5. Update `disconnectSaligPay` mutation (line 878) to also clear `billingProvider` when disconnecting SaligPay.
    6. Update `connectMockSaligPay` mutation (line 807) to set `billingProvider: "saligpay"`.
  - Notes: **MVP simplification:** Using manual API key input (signing secret) instead of full OAuth eliminates the need for token refresh, auto-webhook configuration, and the OAuth redirect flow. This matches the existing SaligPay mock pattern and gets the webhook pipeline working faster. Full OAuth can be added as a post-MVP enhancement alongside auto-webhook configuration.

- [ ] ~~**Task 12: Add Stripe Connect OAuth redirect handler**~~
  - **DEFERRED to post-MVP.** Manual API key input (T11) replaces OAuth for MVP. OAuth + auto-webhook configuration will be added alongside multi-provider support as the first post-MVP enhancement.
  - File: ~~`convex/http.ts` or new `src/app/api/stripe/connect/route.ts`~~
  - Rationale: Stripe Connect OAuth adds significant complexity (token lifecycle, refresh logic, auto-webhook creation via API, redirect handling) that doesn't affect the core tracking pipeline. The webhook handler (T8) works identically regardless of how the credentials were configured.

#### Phase 7: Frontend — Onboarding Overhaul

- [x] **Task 13: Overhaul onboarding wizard in `OnboardingWizard.tsx`**
  - File: `src/components/onboarding/OnboardingWizard.tsx`
  - Action:
    1. Update `steps` array (lines 23-63) from 5 steps to 6:
       - Step 1: Welcome (unchanged)
       - Step 2: Connect Payment Provider (was "Connect SaligPay") — icon: `CreditCard`, description: "Choose your payment provider for automatic commission tracking"
       - Step 3: Invite Team (unchanged, skippable)
       - Step 4: Tracking Snippet (unchanged except branding)
       - Step 5: Referral Tracking Setup (NEW — was "Checkout Attribution") — icon: `TrendingUp`, description: "Add one line of code to your signup form"
       - Step 6: Complete Setup (was "Dashboard completion")
    2. Replace `SaligPayStepContent` (lines 256-398) with `ProviderChoiceStepContent`:
       - Render two equal, side-by-side cards for Stripe and SaligPay
       - Each card: icon, provider name, brief description, "Connect" button
       - Below both: "I'll set this up later" skip option with helper text
       - When Stripe selected: trigger Stripe Connect OAuth flow
       - When SaligPay selected: existing mock connection flow
       - Show connection status if already connected
    3. Add new `ReferralTrackingStepContent` component:
       - Single code snippet: `Affilio.referral({ email: customerEmail });` with copy button
       - Copy text: "When a customer signs up on your website, add this line to capture their referral. That's it — we handle the rest."
       - Best practices: "Add this to every signup form on your site" and "Call after email verification for best results"
       - If SaligPay is connected: collapsible "Advanced: Metadata Enhancement" section with existing SaligPay metadata-passing code
       - If no provider connected: note that connecting a provider enables automatic tracking
        - **Not skippable when a provider is connected** — hide "Skip for now" button in this case. Add explicit guard in `handleNext()` function: if `currentStep === 4` (Step 5 index) and `billingProvider !== null/undefined`, then only allow "Continue" — block navigation without completing Step 5.
     4. Remove old `AttributionStepContent` component (lines 452-475)
    5. Rename all SaligAffiliate/SaligPay hardcoded text to Affilio

- [x] **Task 14: Rebrand onboarding components (AttributionVerifier, CheckoutAttributionGuide, TrackingSnippetInstaller)**
  - File: `src/components/onboarding/AttributionVerifier.tsx`, `src/components/onboarding/CheckoutAttributionGuide.tsx`, `src/components/onboarding/TrackingSnippetInstaller.tsx`
  - Action:
    1. **AttributionVerifier.tsx:** Rename `(window as any).SaligAffiliate` → `(window as any).Affilio` (lines 52, 53, 62). Rename "SaligPay Integration" → "Payment Integration" (lines 78, 80).
    2. **CheckoutAttributionGuide.tsx:** This component may no longer be needed as a separate page if Step 5 is inline in the wizard. If kept as a reference page: accept `billingProvider` prop; for both providers show the simple `Affilio.referral({email})` snippet; for SaligPay only show collapsible advanced metadata section. Rename all 26 brand references: `SaligAffiliate` → `Affilio`, `_salig_aff*` → `_affilio*`.
    3. **TrackingSnippetInstaller.tsx:** Already uses "Affilio" branding. Add a second snippet example showing `Affilio.referral({email})` usage on the signup form. Add a note: "After installing the tracking snippet, add this line to your signup form to enable automatic commission tracking."
  - Notes: These are primarily rebranding tasks (56 references across 3 files). They can be done in parallel with T13 and have no dependencies on the backend changes.

#### Phase 8: Frontend — Settings & Dashboard

- [x] **Task 17: Add billing provider settings UI**
  - File: New component or extend existing settings
  - Action:
    1. Create or extend billing/payment settings section showing:
       - Current connected provider with status badge (connected/test mode/disconnected)
       - Stripe: Account ID (last 4 chars), connected date, "Test Mode" badge if applicable, "Reconnect Stripe" button if token expired
       - SaligPay: Same pattern
       - "Switch Provider" button with warning dialog (count of active subscriptions)
       - Disconnect button with confirmation
    2. Add `billingProvider` and provider-specific queries to the settings page
    3. All wrapped in Suspense boundaries

- [x] **Task 18: Add dashboard setup completeness banner**
  - File: Dashboard page component
  - Action:
    1. Query `trackingPings` table for latest referral ping timestamp
    2. If provider connected AND no referral pings in last 7 days: show persistent banner
    3. Banner text: "Referral tracking not configured — commissions won't be created until you add one line to your signup form. [Go to Setup]"
    4. Banner dismissible but reappears on next visit if condition persists

#### Phase 9: Lead Cleanup Cron

- [x] **Task 19: Add lead cleanup cron job (non-blocking — can be post-MVP)**
  - File: `convex/crons.ts` (or wherever crons are defined)
  - Action:
    1. Add daily cron job calling `internal.referralLeads.expireStaleLeads`
    2. Cron expression: `0 3 * * *` (runs at 3 AM UTC daily)
    3. Cap at 100 leads per invocation to avoid write hotspots
  - Notes: This task is **non-blocking** for the core pipeline. Leads won't grow fast enough in the first weeks to cause performance issues. Implement alongside or after the dashboard is live.

### Acceptance Criteria

**Schema & Foundation**

- [x] **AC 1:** Given a fresh Convex deployment, when the schema is pushed, then the `referralLeads` table exists with `by_tenant_email`, `by_tenant_affiliate`, and `by_tenant_uid` indexes, and the `tenants` table has `billingProvider` and `stripeCredentials` fields.
- [x] **AC 2:** Given an existing tenant with SaligPay connected, when the schema is pushed, then the tenant's data is unchanged (backward-compatible optional fields).
- [x] **AC 3:** Given a new tenant created via `createTenant`, when `seedStats` runs, then `leadsCreatedThisMonth` and `leadsConvertedThisMonth` are initialized to 0.

**Lead Tracking**

- [x] **AC 4:** Given a merchant has installed the tracking snippet and a customer visits via `/ref/ABC12345`, when the customer signs up and the merchant calls `Affilio.referral({email: "customer@example.com"})`, then a `referralLeads` record is created with `email: "customer@example.com"`, `affiliateId` of the affiliate who owns code ABC12345, and `status: "active"`.
- [x] **AC 5:** Given an existing lead for `customer@example.com` with affiliate A, when the merchant calls `Affilio.referral({email: "customer@example.com"})` again (e.g., form resubmission), then the lead is updated (upserted) with the latest affiliate data, not duplicated.
- [x] **AC 6:** Given an invalid email (e.g., "not-an-email"), when `POST /track/referral` is called, then the endpoint returns 200 with an error in the response body (never 4xx/5xx).
- [x] **AC 7:** Given no `_affilio` cookie and no `affiliateCode` in the body, when `POST /track/referral` is called, then a lead is created with no `affiliateId` (organic lead — still useful for future uid matching).

**track.js**

- [x] **AC 8:** Given the updated `track.js` is loaded, when a customer visits `/ref/ABC12345`, then the cookie is named `_affilio` (not `_salig_aff`) and contains Base64-encoded JSON with `{code, clickId, tenantId, timestamp}`.
- [x] **AC 9:** Given `window.Affilio` is loaded, when `Affilio.referral({email: "test@test.com"})` is called, then a POST request is sent to `/track/referral` with `{email: "test@test.com", affiliateCode, tenantId}` (affiliateCode and tenantId from cookie).
- [x] **AC 10:** Given `window.Affilio` is loaded and a previous `window.SaligAffiliate` reference exists in the page, when the script loads, then `window.Affilio` is defined and `window.SaligAffiliate` is `undefined` (clean break, no alias).

**Stripe Webhook**

- [x] **AC 11:** Given a merchant has connected Stripe with a valid signing secret, when Stripe sends a `checkout.session.completed` webhook with a valid signature, then the webhook is processed successfully and a conversion + commission is created if a matching lead exists for the customer email.
- [x] **AC 12:** Given a Stripe webhook with an invalid signature, when it arrives at `POST /api/webhooks/stripe`, then the endpoint returns 200 (not 4xx) and logs a signature verification error.
- [x] **AC 13:** Given a Stripe webhook with `livemode: false`, when it arrives, then the webhook is acknowledged (200) but no commission is created (test mode isolation).
- [x] **AC 14:** Given two Stripe webhooks with the same `event.id` (retry), when the second arrives, then `ensureEventNotProcessed` returns `isDuplicate: true` and no duplicate commission is created.
- [x] **AC 15:** Given a `invoice.paid` event followed by a `checkout.session.completed` event for the same payment_intent, when both arrive, then only one commission is created (Stripe dedup by payment_intent_id).

**Commission Engine — Email Lead Matching**

- [x] **AC 16:** Given a lead exists for `customer@example.com` with affiliate A, when a Stripe webhook arrives with `customerEmail: "customer@example.com"` and no metadata, then the commission is attributed to affiliate A via lead matching.
- [x] **AC 17:** Given a lead exists for `customer@example.com` with affiliate A (but affiliate A is now suspended), when a webhook arrives with that email, then an organic conversion is created (not attributed to suspended affiliate).
- [x] **AC 18:** Given a SaligPay webhook with `_affilio_ref` metadata AND a lead exists for the customer email, when the webhook is processed, then metadata-based attribution is used (takes precedence over lead matching).
- [x] **AC 19:** Given no lead exists and no metadata for a customer email, when any webhook arrives, then an organic conversion is created.
- [x] **AC 20:** Given a lead with `status: "converted"` (already paid), when a second webhook arrives for the same customer, then no duplicate commission is created (conversionId on the lead prevents it).

**Stripe Connection**

- [x] **AC 21:** Given a merchant clicks "Connect Stripe" in onboarding, when the OAuth flow completes, then the tenant's `billingProvider` is set to `"stripe"`, `stripeCredentials` contains valid tokens, and a webhook endpoint is auto-created in their Stripe dashboard.
- [x] **AC 22:** Given a merchant disconnects Stripe, when the disconnect mutation runs, then `stripeCredentials` is cleared, `billingProvider` is set to undefined, and the webhook endpoint is deleted from their Stripe dashboard.
- [x] **AC 23:** Given a merchant has an active Stripe connection with expiring token, when `refreshStripeToken` runs, then the token is refreshed and `lastRefreshedAt` is updated.
- [x] **AC 24:** Given a merchant switches from SaligPay to Stripe, when the switch completes, then all existing `referralLeads` records are preserved and will work with Stripe webhooks (leads are provider-agnostic).

**Onboarding**

- [x] **AC 25:** Given a new merchant in onboarding Step 2, when the page renders, then they see two equal cards: "Connect Stripe" and "Connect SaligPay", with "I'll set this up later" below both.
- [x] **AC 26:** Given a merchant has connected a payment provider, when they reach Step 5, then the "Skip for now" button is hidden and they must complete the referral tracking setup.
- [x] **AC 27:** Given a merchant has NOT connected a payment provider, when they reach Step 5, then the "Skip for now" button is visible.
- [x] **AC 28:** Given a merchant selects "Connect Stripe", when they complete the OAuth flow, then Step 2 shows "Connected (Stripe)" with a disconnect option, and the wizard allows proceeding to Step 3.
- [x] **AC 29:** Given the referral tracking setup step, when the merchant views the page, then they see a single code snippet `Affilio.referral({email})` with a copy button, plus best practice text about adding it to every signup form.

**Dashboard & Settings**

- [x] **AC 30:** Given a merchant has connected Stripe but has not added `Affilio.referral()` to their site, when they visit the dashboard, then a persistent banner is shown warning that referral tracking is not configured.
- [x] **AC 31:** Given a merchant has connected Stripe and `Affilio.referral()` is being called (pings detected), when they visit the dashboard, then no setup warning banner is shown.
- [x] **AC 32:** Given a merchant views their settings, when a payment provider is connected, then they see the provider name, connection status, "Switch Provider" option, and "Disconnect" option.

**Lead Cleanup**

- [x] **AC 33:** Given leads older than 90 days with `status: "active"` and no `conversionId`, when the daily cron runs, then those leads' `status` is updated to `"expired"`.

**Backward Compatibility**

- [x] **AC 34:** Given an existing SaligPay tenant with metadata passing active, when the code deploys, then their existing flow continues working (metadata takes precedence over lead matching in the SaligPay webhook handler).
- [x] **AC 35:** Given existing test data (16 auth users, seed tenants, campaigns, commissions), when `seedAllTestData` is run with the new schema, then all existing data loads correctly and no migration errors occur.

## Additional Context

### Dependencies

- **Stripe Node.js SDK** (`stripe`) — for webhook signature verification only (MVP). No OAuth usage until post-MVP.
- No new Convex dependencies required
- No new frontend UI library dependencies required

### Testing Strategy

- Stripe webhook handler can be tested using Stripe CLI (`stripe listen --forward-to`)
- Mock webhook trigger endpoint already exists for SaligPay (`POST /api/mock/trigger-payment`); similar pattern for Stripe
- Lead matching logic should be unit-testable via Convex internal functions
- Backward compatibility verified by running existing SaligPay test data through the refactored pipeline

### Notes

- The `referralLeads` table will have high write volume (one record per signup) but low read volume (one lookup per webhook). Unique index on `(tenantId, email)` is critical for both dedup and query performance.
- **Lead cleanup:** Stale leads (older than the tenant's longest campaign attribution window, no linked conversion) should be archived via a cron job to prevent unbounded table growth. Update lead `status` to `"expired"` rather than deleting — preserves audit trail. The archival cron should run daily and cap cleanup per run to avoid write hotspots.
- Stripe webhook events can arrive out of order (e.g., `invoice.paid` before `checkout.session.completed`). The normalizer must handle idempotent processing. Stripe-specific dedup by `payment_intent_id` adds a second safety layer.
- **Stripe tenant resolution:** Unlike SaligPay (where tenant ID comes from webhook metadata), Stripe webhooks don't contain Affilio metadata. The webhook handler resolves the tenant by looking up the Stripe Account ID from the event payload against `stripeCredentials.stripeAccountId` on each tenant. This requires an index on `tenants` by `stripeAccountId` or a lookup query.
- Cookie rename is a clean break: `_salig_aff` → `_affilio`. Old cookies expire naturally within the attribution window. No dual cookie reading — merchants update to new snippet to get `Affilio.referral()`.
- The `billingProvider` field is a UX/config concern only. The core pipeline (lead matching → webhook → BillingEvent → commission engine) is provider-agnostic.
- Adding future billing providers (Chargebee, Braintree, etc.) requires only: (1) a new webhook normalizer, (2) a new OAuth/connection flow, (3) onboarding UI updates. No changes to leads, commission engine, fraud detection, or payouts.

### Risk Mitigations (from Advanced Elicitation)

| # | Risk | Mitigation | Source |
|---|------|-----------|--------|
| 1 | Duplicate leads from double-form-submit | Unique index `(tenantId, email)` + upsert semantics | Pre-mortem 1 |
| 2 | Wrong email at signup vs payment | Optional `uid` matching alongside email | Pre-mortem 1 |
| 3 | Webhook arrives before lead is created | Organic conversion created (acceptable); merchant should fire referral() before payment | Pre-mortem 1 |
| 4 | Lead points to suspended affiliate | Commission engine validates `affiliate.status === "active"` | Failure Mode |
| 5 | Stripe duplicate events | Dedup by event ID + `payment_intent_id` | Failure Mode |
| 6 | Invalid email in referral() call | Server-side email validation in `POST /track/referral` | Failure Mode |
| 7 | Stale leads bloat table | Daily cron job archives leads past attribution window with no conversion; update status to "expired" (preserve audit trail) | Pre-mortem 1 + 2 |
| 8 | Stripe webhook verification failure in production | Debug logging + "test webhook" button in settings | Pre-mortem 1 |
| 9 | Merchant confused by OAuth flow | One-click "Connect Stripe" + auto webhook configuration + clear progress UI | Pre-mortem 1 |
| 10 | Lead matched to wrong tenant | All lead lookups scoped by `tenantId` | Failure Mode |
| 11 | Merchant skips referral() after connecting provider | Step 5 not skippable when provider connected; dashboard banner until referral() confirmed | Pre-mortem 2 |
| 12 | Multiple signup forms, only one has referral() | Onboarding guide says "every signup form"; referral health ping detects gaps | Pre-mortem 2 |
| 13 | Provider switch leaves orphaned webhooks | Delete webhook endpoint from old provider's dashboard on disconnect via API | Pre-mortem 2 |
| 14 | Stripe OAuth token expires | ~~Store refresh_token; auto-refresh; "Reconnect Stripe" action with explanation~~ **MVP: N/A — manual signing secret has no expiry.** OAuth deferred to post-MVP. | Pre-mortem 2 |
| 15 | Lead table unbounded growth | (see #7) | Pre-mortem 2 |
| 16 | Provider switch with active subscriptions | Warning dialog with count of affected subscriptions before disconnect | What-if |
| 17 | Stripe test mode webhooks pollute production | Check `livemode` flag; reject or tag as test; show "Test Mode" badge | What-if |
| 18 | Unverified email at signup → different email at payment | Known limitation; document it; recommend referral() after verification; uid fallback | What-if |

### Post-MVP Enhancements

| # | Enhancement | Rationale |
|---|-----------|-----------|
| 1 | Multiple providers per tenant simultaneously | Merchants want Stripe for international + SaligPay for PH. Leads and commission engine are already provider-agnostic — needs multi-webhook routing. |
| 2 | Stripe Connect OAuth + auto-webhook configuration | Full OAuth flow with token lifecycle, automatic webhook endpoint creation in merchant's Stripe dashboard. Eliminates manual signing secret copy-paste. |
| 3 | "Test Your Setup" flow per provider | Simulates a signup + payment to verify end-to-end before real conversions. Reduces "is it working?" support tickets. |
| 4 | Auto-detect merchant's payment provider | During verification ping, detect Stripe.js/other provider scripts on merchant's page and auto-suggest connection. |
