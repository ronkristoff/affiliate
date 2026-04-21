---
stepsCompleted: [1, 2, 3, 4]
status: "complete"
completedAt: "2026-04-20"
inputDocuments:
  - "_bmad-output/planning-artifacts/architecture.md"
  - "docs/payout-process-flow.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
workflowType: "epics-and-stories"
project_name: "salig-affiliate (Stripe Connect Extension)"
user_name: "msi"
date: "2026-04-20"
---

# Payout Provider Integration - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the payout provider integration (Stripe Connect Express as first provider), decomposing the architecture decisions into implementable stories. The design uses a provider adapter pattern so that SaligPay, Stripe, or any future payment provider can be plugged in without changing business logic.

## Requirements Inventory

### Functional Requirements

FR1: Platform must register as a Stripe Connect platform and store platform credentials
FR2: Affiliate must be able to create a payout provider account through provider-hosted onboarding
FR3: Platform must handle onboarding return/refresh redirects and save payoutProviderAccountId on the affiliate
FR4: Platform must fetch and display provider account status (KYC progress, payouts enabled)
FR5: Platform must handle account.updated webhooks to update affiliate provider status automatically
FR6: Platform must show provider connection status badges (not started, pending, verified, rejected, restricted)
FR7: If KYC needs more info, affiliate must see requirements list and "Complete Verification" button
FR8: If KYC rejected, affiliate must see rejection reason and "Try Again" button
FR9: SaaS Owner must see their provider's available and pending balance on the payouts page
FR10: System must check balance before creating a transfer and block if insufficient
FR11: SaaS Owner must be able to "Send via [Provider]" on individual payouts (alongside manual/SaligPay)
FR12: SaaS Owner must be able to "Send All via [Provider]" for bulk provider-eligible payouts in a batch
FR13: Bulk provider send must pre-validate total amount vs available balance with shortfall modal
FR14: Bulk provider send must offer "Pay only what you can cover" option for partial sends
FR15: System must update payout status through provider lifecycle (pending → processing → paid/failed)
FR16: System must store provider transfer ID as paymentReference on the payout record
FR17: Platform must handle transfer.failed and payout.failed webhooks to mark payouts as failed
FR18: Failed provider payouts must be retryable by the SaaS Owner
FR19: SaaS Owner must be able to filter payouts by payment source (All / Manual / SaligPay / Stripe)
FR20: System must support scheduled auto-payouts based on tenant's payoutSchedule configuration
FR21: Scheduled payout must check balance before batch generation and skip if insufficient
FR22: Scheduled payout must send warning email to SaaS Owner if balance is too low
FR23: Mid-batch transfer failures must stop remaining payouts and notify SaaS Owner
FR24: SaaS Owner must be able to configure auto-pay settings (enable/disable, schedule day, processing days, minimum amount)
FR25: Existing payoutMethod field must be preserved for manual/GCash fallback alongside provider payouts

### NonFunctional Requirements

NFR1: All provider webhook endpoints must verify signatures using signing secrets
NFR2: All provider API calls must use the circuit breaker pattern (existing circuitBreaker.ts)
NFR3: Provider webhook endpoint must be rate-limited (existing rateLimiter.ts pattern)
NFR4: Provider secret keys must be stored in Convex environment variables (never in client code)
NFR5: Transfers must use provider idempotency key with payoutId to prevent duplicate transfers
NFR6: Each tenant's provider transfers must be isolated — no cross-tenant balance sharing

### Additional Requirements

AR1: New Convex module convex/lib/payoutProvider.ts with provider adapter interface and registry
AR2: Schema migration: add 5 new fields to affiliates table + 1 new index + 1 new field to payoutBatches
AR3: New provider webhook endpoint POST /payouts/provider-webhook in convex/http.ts
AR4: New cron job dailyScheduledPayouts in convex/crons.ts
AR5: Extend existing convex/payouts.ts to support provider types as paymentSource
AR6: Environment variables: provider-specific secrets (STRIPE_SECRET_KEY, STRIPE_PLATFORM_CLIENT_ID, STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET)
AR7: Pre-build verification: PH-based Stripe Connect platform must be tested before development
AR8: Balance display uses 5-minute cache with manual refresh button
AR9: Stripe Connect adapter implementation in convex/lib/providers/stripeConnectAdapter.ts
AR10: Signed JWT tokens in onboarding return/refresh URLs to prevent affiliate impersonation
AR11: Audit log entries for all successful transfers
AR12: Cron failure alerting to platform team

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Platform credentials & registration |
| FR2 | Epic 2 | Affiliate creates provider account |
| FR3 | Epic 2 | Handle onboarding return/refresh redirects |
| FR4 | Epic 2 | Fetch and display provider account status |
| FR5 | Epic 2 | Handle account.updated webhooks |
| FR6 | Epic 2 | Provider status badges |
| FR7 | Epic 2 | KYC requirements list + verification button |
| FR8 | Epic 2 | Rejection reason + retry button |
| FR9 | Epic 3 | SaaS Owner sees provider balance |
| FR10 | Epic 3 | Balance check before transfer |
| FR11 | Epic 3 | Send via provider on individual payouts |
| FR12 | Epic 3 | Send All via provider bulk action |
| FR13 | Epic 3 | Bulk balance pre-validation + shortfall modal |
| FR14 | Epic 3 | Pay only what you can cover partial send |
| FR15 | Epic 3 | Provider payout lifecycle status updates |
| FR16 | Epic 3 | Store provider transfer ID as paymentReference |
| FR17 | Epic 3 | Handle transfer.failed / payout.failed webhooks |
| FR18 | Epic 3 | Retry failed provider payouts |
| FR19 | Epic 3 | Filter payouts by payment source |
| FR20 | Epic 4 | Scheduled auto-payouts based on payoutSchedule |
| FR21 | Epic 4 | Balance pre-check before scheduled batch |
| FR22 | Epic 4 | Warning email on insufficient balance |
| FR23 | Epic 4 | Mid-batch failure handling |
| FR24 | Epic 5 | Auto-pay configuration UI |
| FR25 | Epic 2 | Preserve existing payoutMethod for fallback |

## Epic List

### Epic 1: Platform Foundation & Schema
Provider adapter interface, schema migration, Stripe Connect adapter, and environment variable setup. No user-facing features — backend foundation using a provider-agnostic pattern.
**FRs covered:** FR1
**ARs covered:** AR1, AR2, AR6, AR7, AR9
**NFRs covered:** NFR4

### Epic 2: Affiliate Payout Provider Onboarding
Affiliates create a payout provider account through the portal, complete provider-hosted KYC, and see their verification status. Includes webhook handling for status changes. Provider-agnostic with secure return URL tokens.
**FRs covered:** FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR25
**ARs covered:** AR3, AR10, AR11
**NFRs covered:** NFR1, NFR3

### Epic 3: Manual Provider Payouts
SaaS Owners view their provider balance and send individual or bulk payouts to provider-connected affiliates via the payouts page. Includes balance checking, insufficient balance handling, provider transfer lifecycle, audit logging, and retry.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19
**ARs covered:** AR5, AR8
**NFRs covered:** NFR2, NFR5, NFR6

### Epic 4: Scheduled Auto-Payouts
SaaS Owners configure automatic payout schedules. A cron job generates batches and sends provider transfers on schedule, with balance pre-checks, warning emails, mid-batch failure handling, and cron failure alerting.
**FRs covered:** FR20, FR21, FR22, FR23
**ARs covered:** AR4, AR12
**NFRs covered:** NFR8

### Epic 5: Payout Settings UI
Settings page for SaaS Owners to configure auto-pay (enable/disable, payout day, processing days, minimum amount). Activates the existing payoutSchedule fields on the tenant record.
**FRs covered:** FR24

---

## Epic 1: Platform Foundation & Schema

Provider adapter interface, schema migration, Stripe Connect adapter implementation, and environment variable setup. No user-facing features — backend foundation using a provider-agnostic pattern so SaligPay, Stripe, or future providers are plug-and-play.

### Story 1.1: Schema Migration for Provider-Agnostic Payout Fields

As a developer,
I want the affiliates and payoutBatches tables to include provider-agnostic payout fields,
So that any payment provider (Stripe, SaligPay, or future) can be used for affiliate payouts.

**Acceptance Criteria:**

**Given** the existing `affiliates` table in `convex/schema.ts`
**When** the schema migration is applied
**Then** the `affiliates` table includes `payoutProviderType` (optional string — e.g., "stripe_connect", "saligpay")
**And** the `affiliates` table includes `payoutProviderAccountId` (optional string)
**And** the `affiliates` table includes `payoutProviderStatus` (optional string — "not_started" | "pending" | "verified" | "rejected" | "restricted")
**And** the `affiliates` table includes `payoutProviderEnabled` (optional boolean)
**And** the `affiliates` table includes `payoutProviderStatusDetails` (optional object with `currentlyDue: optional array of strings`, `eventuallyDue: optional array of strings`, `pastDue: optional array of strings`, `rejectionReason: optional string` — stores only requirement IDs and status metadata, never PII or document images)
**And** a new index `by_payout_provider_account_id` is created on `payoutProviderAccountId`
**And** the `payoutBatches` table includes `providerCounts` (optional record mapping provider type string to count number)
**And** the `convex/lib/validators.ts` affiliate validator is updated with all new fields
**And** existing tests pass with `--typecheck=disable`

### Story 1.2: Payout Provider Adapter Interface

As a developer,
I want a provider adapter interface (`PayoutProvider`) that defines the contract for all payout providers,
So that adding a new provider (Stripe, SaligPay, etc.) only requires implementing the interface.

**Acceptance Criteria:**

**Given** the `convex/lib/payoutProvider.ts` module
**When** the file is created
**Then** it exports a `PayoutProvider` interface with these methods:
  - `createOnboardingLink(params: { affiliateId, returnPath, refreshPath, tenantId }): Promise<{ url: string }>`
  - `getAccountStatus(accountId: string): Promise<{ status: string, enabled: boolean, details: PayoutProviderStatusDetails }>`
  - `createTransfer(params: TransferParams): Promise<{ transferId: string }>`
  - `getBalance(accountId: string): Promise<{ available: number[], pending: number[], currency: string[] }>`
  - `retryTransfer(payoutId: string): Promise<{ transferId: string }>`
  - `getWebhookEventType(event: unknown): string | null`
  - `handleWebhook(event: unknown): Promise<WebhookResult>`
**And** it exports a `TransferParams` type with `{ payoutId, batchId, tenantId, affiliateId, amount, currency, destinationAccountId, tenantProviderAccountId }`
**And** it exports a `WebhookResult` type with `{ payoutId?: string, affiliateId?: string, providerAccountId?: string, status: string, paymentReference?: string }`
**And** it exports a `getProvider(type: string): PayoutProvider | null` function that returns the correct adapter or null if unavailable
**And** it exports a `getProviderForTenant(tenant: Doc<"tenants">): PayoutProvider | null` function that resolves provider from tenant config
**And** the interface is minimal — only methods actually used by Epics 2-4 (no speculative methods)

### Story 1.3: Stripe Connect Adapter Implementation

As a developer,
I want a Stripe Connect adapter that implements the PayoutProvider interface,
So that Stripe Connect Express is available as a payout provider without changing business logic.

**Acceptance Criteria:**

**Given** the PayoutProvider interface from Story 1.2
**When** the `StripeConnectAdapter` is implemented in `convex/lib/providers/stripeConnectAdapter.ts`
**Then** all PayoutProvider methods are implemented using the Stripe SDK
**And** `createOnboardingLink` calls `stripe.accountLinks.create()` with the affiliate's Connect account
**And** `getAccountStatus` calls `stripe.accounts.retrieve()` and maps Stripe-specific fields to generic status
**And** `createTransfer` is implemented as an action that calls an internal mutation to update payout status — the action itself never writes to the database directly
**And** `createTransfer` calls `stripe.transfers.create()` with idempotency key = payoutId
**And** `createTransfer` verifies the payout exists, belongs to the correct tenant, and has status "pending" or "failed" before creating a transfer (prevents replay attacks with crafted payoutIds)
**And** `getBalance` calls `stripe.balance.retrieve()` scoped to the tenant's account
**And** `retryTransfer` reuses the same payoutId idempotency key (safe retry — Stripe rejects duplicate idempotent requests)
**And** all Stripe API calls use the circuit breaker pattern
**And** `handleWebhook` processes `account.updated`, `transfer.failed`, `payout.failed` events and returns a `WebhookResult`
**And** webhook signature verification uses `STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET`
**And** currency conversion is handled by Stripe automatically when the tenant's and affiliate's currencies differ — the platform does not handle conversion
**And** environment variables `STRIPE_SECRET_KEY` and `STRIPE_PLATFORM_CLIENT_ID` are required for this adapter

### Story 1.4: Provider Environment Variables & SDK Initialization

As a developer,
I want each provider's credentials stored as Convex environment variables with graceful unavailability,
So that providers can be enabled/disabled independently without code changes or crashes.

**Acceptance Criteria:**

**Given** the Convex environment
**When** Stripe environment variables are set (`STRIPE_SECRET_KEY`, `STRIPE_PLATFORM_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SIGNING_SECRET`)
**Then** the Stripe Connect adapter initializes successfully
**And** when environment variables are missing, the provider reports itself as unavailable (not a crash)
**And** `getProvider("stripe_connect")` returns `null` for unavailable providers
**And** credentials are never exposed to client-side code (actions only, no queries or mutations access secrets)

---

## Epic 2: Affiliate Payout Provider Onboarding

Affiliates create a payout provider account through the portal, complete provider-hosted KYC, and see their verification status. Includes webhook handling for status changes. Provider-agnostic with secure return URL tokens to prevent impersonation.

### Story 2.1: Affiliate Onboarding Link Generation

As an affiliate,
I want to click "Set Up Payouts" and be redirected to my payout provider's onboarding page,
So that I can complete KYC verification and connect my bank account.

**Acceptance Criteria:**

**Given** an affiliate with `payoutProviderType = null` (not started)
**When** the affiliate clicks "Set Up Payouts" in their portal
**Then** the system calls `provider.createOnboardingLink(affiliateId, returnPath, refreshPath)` with signed JWT tokens in the return and refresh URLs containing the affiliate's Convex ID and tenant ID
**And** the affiliate is redirected to the provider's hosted onboarding page
**And** the provider type is resolved from the tenant's configuration
**And** if no payout provider is configured for the tenant, the "Set Up Payouts" button is hidden and a message shows "Payouts not available — contact your account manager"

**Given** the affiliate is about to start onboarding
**When** the onboarding page loads
**Then** a "Before You Start" section is displayed showing accepted KYC documents for the provider:
  - For Stripe Connect: "You will need: a valid government-issued ID (passport, driver's license, PhilHealth UMID, or national ID), your bank account details, and your legal name and address."
  - For other providers: provider-specific document list
**And** the checklist helps reduce onboarding abandonment

**Given** an affiliate who already started onboarding (`payoutProviderStatus = "pending"`)
**When** the affiliate clicks "Complete Verification"
**Then** a fresh onboarding link is generated (not a new account)
**And** the affiliate is redirected to resume their existing onboarding
**And** the JWT token in the URL is freshly signed

### Story 2.2: Onboarding Return & Refresh Handling

As an affiliate,
I want to be redirected back to the portal after completing (or abandoning) provider onboarding,
So that my payout setup status is updated correctly and securely.

**Acceptance Criteria:**

**Given** an affiliate who completes provider onboarding
**When** the provider redirects to the return URL with provider account details and a signed JWT token
**Then** the system validates the JWT token (signature, expiry, affiliate ID match)
**And** if the token is invalid or expired, the callback is rejected with an error page (no data saved)
**And** on valid token, the system saves `payoutProviderAccountId` on the affiliate record
**And** the system calls `provider.getAccountStatus(accountId)` to fetch current status
**And** `payoutProviderStatus` is updated to "verified" (if KYC complete) or "pending" (if more info needed)
**And** the affiliate sees a confirmation: "Payout setup complete" or "Verification in progress"

**Given** an affiliate who abandons onboarding (closes window)
**When** the provider redirects to the refresh URL with a signed JWT token
**Then** the system validates the JWT token
**And** the system does not create a new account
**And** the affiliate sees their current status with a "Resume Setup" button
**And** clicking "Resume Setup" generates a new onboarding link for the existing account

**Given** an affiliate who already has a payout provider configured (`payoutProviderAccountId` is set)
**When** a new onboarding callback arrives for this affiliate
**Then** the system checks if an onboarding flow is already in progress for this affiliate
**And** if yes, the new request is blocked with "Payout setup already in progress"
**And** concurrent onboarding attempts are prevented — only one active onboarding flow per affiliate at a time

**Given** an affiliate who wants to replace their payout provider account
**When** they click "Change Payout Method" (not during active onboarding)
**Then** the system warns: "You already have a payout account configured. Replacing it will require re-verification."
**And** the affiliate must confirm before the old `payoutProviderAccountId` is cleared and status reset to "not_started"

### Story 2.3: Provider Account Status Display

As an affiliate,
I want to see my payout provider connection status and KYC progress in my portal,
So that I know whether I'm eligible to receive payouts.

**Acceptance Criteria:**

**Given** an affiliate viewing their payout settings page
**When** the page loads
**Then** the affiliate sees a status badge:
  - ⚪ "Not Set Up" — no provider account (`payoutProviderType = null`)
  - 🟡 "Pending" — onboarding in progress or KYC under review
  - 🟢 "Ready" — KYC complete, payouts enabled (`payoutProviderEnabled = true`)
  - 🔴 "Rejected" — KYC failed
  - 🟠 "Restricted" — account restricted, action required
**And** the badge uses the `payoutProviderStatus` field from the affiliate record
**And** status is fetched on page load via `provider.getAccountStatus()`
**And** if the provider type is Stripe Connect, the badge shows "Stripe Connect" label
**And** existing `payoutMethod: { type, details }` is preserved and shown separately as "Manual payout method"

### Story 2.4: KYC Requirements & Rejection Handling

As an affiliate,
I want to see what additional information is needed if my KYC is incomplete or rejected,
So that I can take action to complete verification.

**Acceptance Criteria:**

**Given** an affiliate with `payoutProviderStatus = "pending"` and KYC requirements in `payoutProviderStatusDetails`
**When** the affiliate views their payout settings
**Then** the system displays a list of required actions (e.g., "Upload government ID", "Verify address")
**And** a "Complete Verification" button is shown that redirects to the provider's onboarding
**And** if `payoutProviderStatusDetails.currentlyDue` is empty but `eventuallyDue` has items, show "All set for now — no action needed"

**Given** an affiliate with `payoutProviderStatus = "rejected"`
**When** the affiliate views their payout settings
**Then** the rejection reason is displayed (from `payoutProviderStatusDetails.rejectionReason`)
**And** a "Try Again" button generates a new onboarding link
**And** the old `payoutProviderAccountId` is cleared before redirecting

### Story 2.5: Provider Webhook for Account Status Updates

As a developer,
I want the platform to receive and process provider webhooks for account status changes,
So that affiliate Connect status is always up-to-date without manual polling.

**Acceptance Criteria:**

**Given** a provider webhook endpoint `POST /payouts/provider-webhook`
**When** a webhook event is received
**Then** the system verifies the webhook signature using the provider's signing secret
**And** the system calls `provider.getWebhookEventType(event)` to identify the event type
**And** the system calls `provider.handleWebhook(event)` to process the event
**And** for `account.updated` events: updates `payoutProviderStatus`, `payoutProviderEnabled`, and `payoutProviderStatusDetails` on the matching affiliate
**And** the webhook endpoint is rate-limited using the existing `rateLimiter.ts` pattern
**And** invalid signatures return HTTP 401
**And** unprocessable events return HTTP 200 with logged error (never 500)
**And** after 3 consecutive webhook signature failures (tracked per provider), an alert is sent to the platform team indicating a possible secret compromise or rotation needed

**Given** the webhook handler cannot find the matching affiliate
**When** an account.updated event arrives with an unknown account ID
**Then** the event is logged as a warning in errorLogs
**And** HTTP 200 is returned (no crash)

---

## Epic 3: Manual Provider Payouts

SaaS Owners view their provider balance and send individual or bulk payouts to provider-connected affiliates via the payouts page. Includes balance checking, insufficient balance handling, provider transfer lifecycle, audit logging, and retry.

### Story 3.1: Provider Balance Display on Payouts Page

As a SaaS Owner,
I want to see my payout provider's available and pending balance on the payouts page,
So that I know how much I can send to affiliates before initiating payouts.

**Acceptance Criteria:**

**Given** a SaaS Owner with a connected payout provider (`stripeAccountId` on tenant)
**When** the `/payouts` page loads
**Then** a "Provider Balance" card is displayed showing:
  - Available balance (real-time from `provider.getBalance()`)
  - Pending balance (incoming funds not yet available)
  - Currency
  - Last synced timestamp
  - "Refresh" button to re-fetch
**And** the balance is cached for 5 minutes with manual refresh override
**And** if available balance < total pending payouts, a warning badge shows "Balance too low to pay all affiliates. Shortfall: ₱X"
**And** if no payout provider is connected, the balance card is hidden

### Story 3.2: Individual Payout via Provider

As a SaaS Owner,
I want to send a single payout to an affiliate via my payout provider,
So that I can pay affiliates one at a time alongside manual and SaligPay options.

**Acceptance Criteria:**

**Given** a payout in "pending" status for an affiliate with `payoutProviderEnabled = true`
**When** the SaaS Owner clicks "Send via [Provider]" (e.g., "Send via Stripe")
**Then** the "Send via [Provider]" button is disabled and shows a spinner while the request is in progress (prevents double-click)
**And** the system validates:
  - Tenant has a valid provider account
  - Affiliate has `payoutProviderEnabled = true`
  - Payout amount > 0
  - Tenant's provider balance >= payout amount
**And** on validation failure, a clear error is shown (e.g., "Insufficient balance. Available: ₱5,000. Needed: ₱8,000. Shortfall: ₱3,000.")
**And** on success, the action calls `provider.createTransfer()` and then an internal mutation updates:
  - Payout status to "processing"
  - `paymentSource` to the provider type (e.g., "stripe")
  - `paymentReference` to the provider's transfer ID
  - Payout batch `providerCounts` incremented for the provider type
**And** an audit log entry is created with `{ action: 'payout_sent', payoutId, transferId, amount, providerType, tenantId, affiliateId }`

### Story 3.3: Bulk Payout via Provider

As a SaaS Owner,
I want to send all provider-eligible payouts in a batch at once,
So that I can pay multiple affiliates efficiently.

**Acceptance Criteria:**

**Given** a payout batch with multiple pending payouts where affiliates have `payoutProviderEnabled = true`
**When** the SaaS Owner clicks "Send All via [Provider]"
**Then** the system pre-validates: total amount <= tenant's provider available balance
**And** if sufficient: all eligible payouts are sent via `provider.createTransfer()` sequentially, with the "Send All via [Provider]" button disabled during processing
**And** if insufficient: a modal shows "Your balance (₱A) is not enough. Shortfall: ₱C."
**And** the modal offers two options:
  - "Top up and retry" — closes modal
  - "Pay only what you can cover" — sends transfers for as many payouts as the balance allows (sorted by amount ascending), skips the rest
**And** payouts already sent via other methods (manual, SaligPay) are NOT affected
**And** each transfer uses `payoutId` as the idempotency key
**And** each successful transfer creates an audit log entry

### Story 3.4: Provider Transfer Webhooks (Payout Status Lifecycle)

As a developer,
I want the platform to process provider webhooks for transfer and payout status changes,
So that payout records stay in sync with the provider's actual state.

**Acceptance Criteria:**

**Given** a payout with `status = "processing"` and `paymentSource = "stripe"`
**When** a `transfer.failed` webhook is received
**Then** the payout status is updated to "failed"
**And** the failure reason is logged in errorLogs
**And** the SaaS Owner sees the payout as "Failed" with a "Retry" option

**Given** a payout with `status = "processing"` and `paymentSource = "stripe"`
**When** a `payout.paid` webhook is received
**Then** the payout status is updated to "paid" and `paidAt` is set to now
**And** the payout batch status is re-evaluated (auto-close if all settled)
**And** the affiliate receives a notification email

**Given** a transfer that succeeds but the bank payout hasn't completed yet
**When** a `transfer.created` webhook is received
**Then** the payout stays as "processing" (no status change — transfer in flight)

### Story 3.5: Retry Failed Provider Payouts

As a SaaS Owner,
I want to retry a failed provider payout without creating a duplicate transfer,
So that I can recover from transient failures.

**Acceptance Criteria:**

**Given** a payout with `status = "failed"` and `paymentSource = "stripe"`
**When** the SaaS Owner clicks "Retry"
**Then** the system calls `provider.retryTransfer(payoutId)`
**And** the idempotency key (payoutId) prevents duplicate transfers if the original actually succeeded
**And** the retry verifies the payout exists, belongs to the correct tenant, and has status "failed" before proceeding
**And** on success, payout status updates to "processing"
**And** an audit log entry is created for the retry action
**And** on failure, a clear error is shown with the failure reason
**And** the retry button is disabled while the retry is in progress

### Story 3.6: Payout Filter by Payment Source

As a SaaS Owner,
I want to filter payouts by payment source (All / Manual / SaligPay / Stripe),
So that I can focus on specific payout types in the payouts table.

**Acceptance Criteria:**

**Given** a payouts table with mixed payment sources
**When** the SaaS Owner selects a payment source filter
**Then** the table shows only payouts matching the selected source
**And** "All" shows every payout regardless of source
**And** the filter works on both active batches and payout history
**And** the filter selection is persisted in the URL query parameter

---

## Epic 4: Scheduled Auto-Payouts

SaaS Owners configure automatic payout schedules. A cron job generates batches and sends provider transfers on schedule, with balance pre-checks, warning emails, mid-batch failure handling, and cron failure alerting.

### Story 4.1: Scheduled Payout Cron Job

As a system,
I want a daily cron job that checks which tenants have scheduled payouts due today,
So that auto-payouts run on the configured schedule without manual intervention.

**Acceptance Criteria:**

**Given** tenants with `payoutSchedule.payoutDayOfMonth` configured
**When** the cron job runs daily at 00:00 UTC
**Then** for each tenant where today = `payoutDayOfMonth`:
  - Check tenant has a valid payout provider account
  - Check auto-pay is enabled (tenant flag)
  - Gather eligible commissions: status = "approved", not in a batch, `approvedAt + payoutProcessingDays < now`, affiliate has `payoutProviderEnabled = true`, amount >= `minimumPayoutAmount`
**And** if no eligible commissions exist, the tenant is skipped (no batch, no email)
**And** the cron uses `getProviderForTenant(tenant)` to resolve the correct provider adapter
**And** if the cron job itself fails (unhandled error), an alert email is sent to the platform team with the error details, tenant IDs affected, and timestamp
**And** if the cron job completes but all tenants were skipped, no alert is sent (this is normal)

### Story 4.2: Balance Pre-Check for Scheduled Payouts

As a system,
I want to verify the tenant's provider balance covers the total batch amount before generating a batch,
So that no transfers are attempted when funds are insufficient.

**Acceptance Criteria:**

**Given** eligible commissions totaling ₱12,000 for a tenant
**When** the cron job fetches the tenant's provider balance and it shows ₱5,000 available
**Then** NO batch is generated
**And** NO transfers are attempted
**And** a warning email is sent to the SaaS Owner: "Auto-payout skipped: insufficient balance. Available: ₱5,000 | Needed: ₱12,000 | Shortfall: ₱7,000. Top up your balance and retry manually."
**And** the tenant's last auto-pay attempt is logged with "skipped_insufficient_balance" reason

**Given** the tenant's provider balance covers the total
**When** the cron job proceeds to batch generation
**Then** the batch is created and transfers are initiated normally

### Story 4.3: Mid-Batch Failure Handling

As a system,
I want to handle individual transfer failures within an auto-pay batch gracefully,
So that successful transfers are not reversed and the SaaS Owner is notified of partial completion.

**Acceptance Criteria:**

**Given** an auto-pay batch with 5 payouts being sent sequentially
**When** the 3rd transfer fails (e.g., balance dropped due to chargeback between pre-check and transfer)
**Then** the 3rd payout is marked as "failed"
**And** payouts 4 and 5 are skipped (not attempted)
**And** payouts 1 and 2 remain as "processing" (already sent — not reversed)
**And** an email is sent to the SaaS Owner: "Auto-payout partially completed: 2 of 5 paid. Remaining 3 failed due to insufficient balance. Shortfall: ₱X. Top up and retry."
**And** the batch stays open (not auto-closed) since not all payouts are settled
**And** the failed payouts remain as "pending" and are eligible for the next scheduled cycle
**And** audit log entries are created for all transfer attempts (success and failure)

### Story 4.4: Auto-Payout Completion Notification

As a SaaS Owner,
I want to receive an email summary when an auto-payout batch completes successfully,
So that I have a record of what was sent without checking the dashboard.

**Acceptance Criteria:**

**Given** an auto-pay batch where all transfers succeeded
**When** the batch processing completes
**Then** an email is sent to the SaaS Owner containing:
  - Batch ID and date
  - Number of affiliates paid
  - Total amount sent
  - Currency
  - Provider type used
**And** if the email fails to send, the batch is still marked as completed (email failure is non-blocking)
**And** the email is branded with the SaaS Owner's branding (logo, colors, portal name)

---

## Epic 5: Payout Settings UI

Settings page for SaaS Owners to configure auto-pay and payout schedule.

### Story 5.1: Auto-Pay Configuration Settings Page

As a SaaS Owner,
I want a settings page where I can enable/disable auto-pay and configure the payout schedule,
So that I can control when and how affiliates are paid automatically.

**Acceptance Criteria:**

**Given** a SaaS Owner viewing `/settings/payouts`
**When** the page loads
**Then** the following fields are displayed (pre-populated from `tenant.payoutSchedule`):
  - "Enable Auto-Pay" toggle (on/off)
  - "Payout Day of Month" — number input (1-28, default: 15)
  - "Processing Days" — number input (days to wait after commission approval before paying, default: 7)
  - "Minimum Payout Amount" — currency input (default: ₱500)
  - "Payout Schedule Note" — optional text field (internal note)
**And** changes are saved via a mutation that updates the tenant's `payoutSchedule`
**And** when auto-pay is toggled ON, a confirmation dialog warns: "Affiliates will be paid automatically on the configured schedule. Make sure your provider balance is sufficient."
**And** when auto-pay is toggled OFF, pending commissions remain unpaid until the next manual batch
**And** the "Payout Day of Month" validates 1-28 (providers don't support 29-31 for monthly schedules)
**And** the page is only visible to SaaS Owner role (not affiliates, not platform admin)
