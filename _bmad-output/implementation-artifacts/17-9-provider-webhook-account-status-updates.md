# Story 17.9: Provider Webhook for Account Status Updates

Status: done

## Story

As a developer,
I want the platform to receive and process provider webhooks for account status changes,
so that affiliate Connect status is always up-to-date without manual polling.

## Acceptance Criteria

1. **AC1:** Webhook endpoint `POST /stripe/connect-webhook` receives Stripe Connect events
2. **AC2:** Webhook signature is verified using `STRIPE_WEBHOOK_SECRET` — invalid signatures return HTTP 401
3. **AC3:** Events are deduplicated using `rawWebhooks` table via `ensureEventNotProcessed`
4. **AC4:** For `account.updated` events: update `payoutProviderStatus`, `payoutProviderEnabled`, and `payoutProviderStatusDetails` on the matching affiliate (looked up via `by_payout_provider_account_id` index)
5. **AC5:** Endpoint is rate-limited using existing `rateLimiter.ts` pattern
6. **AC6:** Invalid signatures return HTTP 401
7. **AC7:** Unprocessable/unknown events return HTTP 200 with logged error (never 500)
8. **AC8:** After 3 consecutive webhook signature failures (tracked per provider), log a warning to `errorLogs` indicating a possible secret compromise
9. **AC9:** Unknown account ID (no matching affiliate) → log warning in `errorLogs`, return HTTP 200
10. **AC10:** TypeScript compilation passes with `pnpm tsc --noEmit`

## Tasks / Subtasks

- [x] Task 1: Create HTTP endpoint route (AC: #1, #5, #6, #7)
  - [x] 1.1 Add `POST /stripe/connect-webhook` route in `convex/http.ts` with CORS OPTIONS preflight
  - [x] 1.2 Read raw body with `request.text()` (needed for signature verification)
  - [x] 1.3 Extract `Stripe-Signature` header
  - [x] 1.4 Apply rate limiting using `buildRateLimitKey` + `getRateLimitStatus` + `incrementRateLimit` pattern from existing webhooks
  - [x] 1.5 Delegate to a new action `handleProviderConnectWebhook` in a new file `convex/providerConnectWebhook.ts`

- [x] Task 2: Create webhook handler action (AC: #2, #3, #4, #8, #9)
  - [x] 2.1 Create `convex/providerConnectWebhook.ts` with `"use node"` directive (needs Stripe SDK)
  - [x] 2.2 Export `handleProviderConnectWebhook` action accepting `{ rawPayload: string, sigHeader: string }`
  - [x] 2.3 Verify signature using `stripe.webhooks.constructEvent(rawPayload, sigHeader, STRIPE_WEBHOOK_SECRET)` — return `{ status: 401 }` on failure
  - [x] 2.4 Track consecutive signature failures using a simple counter (store count in a helper or use `errorLogs`): after 3 consecutive failures, insert warning into `errorLogs` with source `"providerWebhook"` and message about possible secret compromise
  - [x] 2.5 Reset consecutive failure counter on successful verification
  - [x] 2.6 Deduplicate using `internal.webhooks.ensureEventNotProcessed` with source `"stripe_connect"`, extracting `event.id` as `eventId`
  - [x] 2.7 If duplicate, return `{ status: 200, duplicate: true }`
  - [x] 2.8 Store raw webhook via `ensureEventNotProcessed` (already handles insert)
  - [x] 2.9 Get provider via `getProvider("stripe_connect")`, call `provider.getWebhookEventType(verifiedEvent)` to identify event type
  - [x] 2.10 For `account.updated`: call `provider.handleWebhook(verifiedEvent)` to get `WebhookResult` with `providerAccountId`, `status`, `enabled`
  - [x] 2.11 Look up affiliate by `payoutProviderAccountId` using `by_payout_provider_account_id` index
  - [x] 2.12 If no matching affiliate found, insert warning into `errorLogs`, update webhook status to `"processed"`, return `{ status: 200 }`
  - [x] 2.13 If affiliate found, call `internal.affiliateProviderOnboarding.setAffiliateProviderStatusDetails` with mapped status and details
  - [x] 2.14 For unrecognized/other event types: update webhook status to `"processed"`, return `{ status: 200 }`
  - [x] 2.15 Wrap all processing in try/catch — never return 500, always return 200 with error logged

- [x] Task 3: Add signature failure tracking (AC: #8)
  - [x] 3.1 Use `internalMutation` that reads/writes a counter in `errorLogs` — track consecutive failures by querying recent entries with source `"providerWebhook:signature"` and checking consecutive failures
  - [x] 3.2 On signature verification failure: increment counter. If counter reaches 3, insert `errorLogs` warning with source `"providerWebhook"`, severity `"warning"`, message `"3 consecutive Stripe Connect webhook signature failures — possible secret compromise or rotation needed"`
  - [x] 3.3 On successful verification: reset counter to 0

- [x] Task 4: Verify compilation (AC: #10)
  - [x] 4.1 Run `pnpm tsc --noEmit` — zero new errors (156 total, all pre-existing)

## Dev Notes

This is a **backend-only story** — no frontend changes. The webhook endpoint processes Stripe Connect events server-side.

### Key Design Decisions

**Endpoint path**: `POST /stripe/connect-webhook` — consistent with existing `/stripe/webhook` (used by @convex-dev/stripe for payment webhooks). The epic mentions `/payouts/provider-webhook` but `/stripe/connect-webhook` follows the existing convention.

**Signature failure tracking**: Use a lightweight internalMutation with a simple counter approach. Could use `errorLogs` table to track failure count by querying recent entries with source `"providerWebhook"` and checking consecutive failures, OR use a more explicit approach with a dedicated counter stored via a query/mutation pair. The simplest reliable approach: an internalMutation that queries the last errorLog entry for `"providerWebhook"` signature failures and counts consecutively. Alternative: use `circuitBreakers` table since it already tracks service state — but circuit breakers are for external service failures, not auth failures. Recommendation: use a dedicated `getWebhookFailureCount` / `recordWebhookSignatureFailure` / `resetWebhookSignatureFailures` set of internal functions.

**Deduplication**: Reuse `internal.webhooks.ensureEventNotProcessed` which atomically checks+inserts into `rawWebhooks`. Pass `source: "stripe_connect"`, `tenantId: undefined` (Connect webhooks are not tenant-scoped).

**Account lookup**: Use `by_payout_provider_account_id` index on `affiliates` table. The `providerAccountId` from `WebhookResult` maps to `affiliates.payoutProviderAccountId`.

**Status details from webhook**: The `handleWebhook` method in `stripeConnectAdapter.ts` returns a `WebhookResult` with `status` and `enabled` but NOT `details` (currently_due, etc.). The details are available in the raw Stripe event `data.object.requirements`. Two options:
  1. Extend `WebhookResult` to include `details` field — requires modifying `payoutProvider.ts` interface and adapter
  2. Fetch account status fresh via `provider.getAccountStatus(providerAccountId)` inside the webhook handler

  **Recommendation**: Extend `WebhookResult` to optionally include `details: PayoutProviderStatusDetails | undefined`. In the `handleWebhook` `account.updated` case, include the details from `mapStripeStatus`. This avoids an extra Stripe API call and keeps data fresh from the webhook event itself.

**HTTP route pattern**: Follow the existing pattern in `http.ts` — thin HTTP route handler that reads raw body/headers and delegates to an action. The action does the heavy lifting (signature verification, processing).

### Files to Modify

| File | Description |
|------|-------------|
| `convex/http.ts` | Add POST + OPTIONS routes for `/stripe/connect-webhook` |
| `convex/providerConnectWebhook.ts` | **NEW** — Action handler for Connect webhook processing |
| `convex/lib/payoutProvider.ts` | Extend `WebhookResult` to optionally include `details` |
| `convex/lib/providers/stripeConnectAdapter.ts` | Include `details` in `account.updated` webhook result |

### References

- [Source: epics-stripe-connect.md#Story 2.5] — Epic definition and ACs
- [Source: architecture.md#Stripe Connect Webhook Events] — Webhook event types, security
- [Source: convex/http.ts:1158] — Existing webhook deduplication pattern
- [Source: convex/webhooks.ts:230] — `ensureEventNotProcessed` mutation
- [Source: convex/schema.ts:301] — `by_payout_provider_account_id` index
- [Source: convex/schema.ts:537] — `rawWebhooks` table
- [Source: convex/schema.ts:487] — `errorLogs` table
- [Source: convex/lib/providers/stripeConnectAdapter.ts:212] — `handleWebhook` method
- [Source: convex/lib/providers/stripeConnectAdapter.ts:49] — `mapStripeStatus` function

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

None

### Completion Notes List

- Webhook endpoint at POST /stripe/connect-webhook with OPTIONS preflight
- Signature verification via Stripe SDK constructEvent — returns 401 on failure
- Consecutive failure tracking via errorLogs table (source: "providerWebhook:signature")
- Deduplication via existing ensureEventNotProcessed with source "stripe_connect"
- Extended WebhookResult interface to include optional `enabled` and `details` fields
- Extended stripeConnectAdapter account.updated case to include details
- Added getAffiliateByProviderAccountId internal query using by_payout_provider_account_id index
- Rate limited at 100/min per IP via existing rateLimiter pattern
- TypeScript: 156 total errors (baseline), zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/providerConnectWebhook.ts` | Created | Webhook handler action with signature verification, dedup, account.updated processing, failure tracking |
| `convex/http.ts` | Modified | Added POST + OPTIONS routes for /stripe/connect-webhook |
| `convex/affiliateProviderOnboarding.ts` | Modified | Added getAffiliateByProviderAccountId internal query |
| `convex/lib/payoutProvider.ts` | Modified | Extended WebhookResult with optional enabled and details fields |
| `convex/lib/providers/stripeConnectAdapter.ts` | Modified | Include enabled and details in account.updated webhook result |
| `convex/lib/rateLimiter.ts` | Modified | Added "provider-webhook" rate limit config (100/min) |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.9: Provider webhook for account status updates |
