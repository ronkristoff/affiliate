# Salig-Affiliate Platform Flows

Complete end-to-end documentation of every flow in the platform — from tenant signup through tracking, commissions, and payouts.

---

## Table of Contents

1. [Flow 1: Tenant Subscription & Setup](#flow-1-tenant-subscription--setup)
2. [Flow 2: Campaign & Affiliate Setup](#flow-2-campaign--affiliate-setup)
3. [Flow 3: Tracking & Conversion](#flow-3-tracking--conversion)
4. [Flow 4: Commission Processing](#flow-4-commission-processing)
5. [Flow 5: Payouts](#flow-5-payouts)

---

## Flow 1: Tenant Subscription & Setup

### Overview

A SaaS owner ("Alex") signs up, selects a plan, and configures their affiliate program. This is the onboarding journey.

### Step-by-step

```
Signup → Auth Hook → Tenant Creation → Onboarding Wizard → Plan Selection → Tracking Install → Billing Connection
```

#### 1.1 Sign Up

**Frontend:** `src/app/(unauth)/sign-up/page.tsx`
**Auth:** `src/lib/auth-client.ts` → Better Auth `authClient.signUp.email()`
**Backend:** `src/lib/auth.ts` (Better Auth config with database hooks)

When Alex signs up with email/password:

1. Better Auth creates a user record in its **component tables** (`user`, `account`)
2. The `databaseHooks.user.create.after` hook fires
3. The hook calls `internal.users.syncUserCreation` to create a matching record in the app's `users` table
4. A `tenants` record is created (if a `domain` is provided — otherwise deferred)

> **Important:** The hook is wrapped in try/catch because seeding or edge cases may lack a domain. Auth user creation must succeed even if app-level user creation fails.

#### 1.2 Onboarding Wizard

**Frontend:** `src/components/onboarding/OnboardingWizard.tsx`

A multi-step wizard guides Alex through:

| Step | Description |
|------|-------------|
| 1 | Welcome — verify email, enter business name |
| 2 | Install tracking snippet (`<script>` tag) |
| 3 | Connect a billing provider (SaligPay or Stripe) |
| 4 | Create first campaign |
| 5 | Invite affiliates or share portal link |

#### 1.3 Plan Selection

**Backend:** `convex/subscriptions.ts` — `upgradeSubscription`, `downgradeSubscription`

| Plan | Key Limits |
|------|-----------|
| **Starter** (Free) | Basic affiliate/campaign limits |
| **Growth** (Paid) | Higher limits + advanced analytics |
| **Scale** (Paid) | Custom domain + priority support |

Plans are enforced via the `tierConfigs` table. Subscription status flows:

```
trial → active → cancelled → (past_due)
```

Each plan change writes a `billingHistory` record for audit.

#### 1.4 Billing Provider Connection

**Frontend:** `src/components/settings/IntegrationsSettingsContent.tsx`

| Provider | Credential Storage | Webhook Events |
|----------|-------------------|----------------|
| **SaligPay** | `tenant.saligPayCredentials` (clientId, clientSecret) | `payment.updated`, `subscription.created/updated/cancelled`, `refund.created`, `chargeback.created` |
| **Stripe** | `tenant.stripeCredentials` (signingSecret) | Same event types, normalized to `BillingEvent` |

> **Note:** Both providers are supported equally. SaligPay supports optional metadata-based attribution (`_affilio_ref` in the payment payload). Stripe requires the `Affilio.referral()` lead matching approach (see Flow 3.4).

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `tenants` | Core tenant record — plan, status, billing credentials, branding |
| `users` | App-level user records linked to tenants (role: owner/manager/member) |
| `tierConfigs` | Plan definitions with limits (maxAffiliates, maxCampaigns, etc.) |
| `billingHistory` | Audit trail for all billing events |
| `teamInvitations` | Pending team member invitations |

### Key Backend Functions

| Function | File | Purpose |
|----------|------|---------|
| `syncUserCreation` | `convex/users.ts` | Create app user from auth hook |
| `getCurrentSubscription` | `convex/subscriptions.ts` | Get tenant subscription status |
| `upgradeSubscription` | `convex/subscriptions.ts` | Upgrade tenant plan |
| `downgradeSubscription` | `convex/subscriptions.ts` | Downgrade tenant plan |
| `getTierConfig` | `convex/tierConfig.ts` | Get plan limits for enforcement |

---

## Flow 2: Campaign & Affiliate Setup

### Overview

Alex creates campaigns with commission rules, then affiliates ("Jamie") sign up and get unique referral codes.

### Step-by-step

```
Create Campaign → Configure Commission Rules → Affiliate Self-Registration / Invite → Approval → Referral Code + Link Generation
```

#### 2.1 Campaign Creation

**Backend:** `convex/campaigns.ts` — `createCampaign`

Each campaign defines:

| Field | Options | Description |
|-------|---------|-------------|
| `commissionType` | `"percentage"`, `"flatFee"` | How commission is calculated |
| `commissionValue` | number | Rate (e.g., `15` = 15% or ₱500 flat) |
| `recurringCommission` | boolean | Whether renewals generate commissions |
| `recurringRate` | optional number | Rate for recurring (if different from initial) |
| `recurringRateType` | `"same"`, `"reduced"`, `"custom"` | How recurring rate is determined |
| `autoApproveCommissions` | boolean | Skip manual approval for small amounts |
| `approvalThreshold` | optional number | Auto-approve below this amount |
| `cookieDuration` | optional number | Attribution cookie lifespan in days |
| `status` | `"active"`, `"paused"`, `"archived"` | Campaign lifecycle |

Campaign statuses:

```
active → paused → active
active → archived  (one-way, no commissions from archived campaigns)
```

#### 2.2 Affiliate Registration

**Backend:** `convex/affiliates.ts` — `createAffiliate` (owner) or `registerAffiliate` (self-service)
**Frontend:** Public affiliate portal — `src/app/portal/register/page.tsx`

Two paths to join:

1. **Self-registration** — Affiliate visits the public portal, selects a campaign, signs up
2. **Owner invite** — Alex adds Jamie's email directly from the dashboard

Affiliate statuses:

```
pending → active     (approved by owner or auto-approved)
pending → rejected   (declined by owner)
pending → suspended  (fraud detected)
active → suspended   (owner action or fraud detection)
suspended → active   (owner reinstates)
```

Each affiliate gets a **unique 8-character referral code** (e.g., `JAMIE8X2`) generated by `generateUniqueReferralCode()`. Characters exclude confusing ones (0, O, I, 1).

#### 2.3 Referral Link Generation

**Backend:** `convex/affiliates.ts` — `createReferralLink`

A `referralLinks` record is created linking:
- `tenantId` → which merchant
- `affiliateId` → which affiliate
- `campaignId` → which campaign (optional)
- `code` → the affiliate's unique code

The public referral URL format: `merchant.com/ref/JAMIE8X2`

#### 2.4 Commission Overrides

**Backend:** `convex/affiliates.ts` — `setCommissionOverride`

Alex can set per-affiliate custom commission rates for specific campaigns. Stored in `affiliate.commissionOverrides[]`. The effective rate resolution:

```
1. Check affiliate.commissionOverrides for this campaign (active override?)
2. Fall back to campaign.commissionValue (default rate)
```

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `campaigns` | Commission rules and campaign configuration |
| `affiliates` | Affiliate profiles with referral codes, status, payout methods, fraud signals |
| `referralLinks` | Links affiliates to campaigns with referral codes |
| `affiliateCampaigns` | Many-to-many enrollment join table |
| `affiliateSessions` | Server-side session tokens for affiliate portal |

### Key Backend Functions

| Function | File | Purpose |
|----------|------|---------|
| `createCampaign` | `convex/campaigns.ts` | Create a new campaign |
| `updateCampaign` | `convex/campaigns.ts` | Update campaign settings |
| `createAffiliate` | `convex/affiliates.ts` | Owner manually adds affiliate |
| `registerAffiliate` | `convex/affiliates.ts` | Self-service registration |
| `approveAffiliate` | `convex/affiliates.ts` | Approve pending affiliate |
| `createReferralLink` | `convex/affiliates.ts` | Generate referral link |
| `generateUniqueReferralCode` | `convex/affiliates.ts` | Generate 8-char unique code |

---

## Flow 3: Tracking & Conversion

### Overview

A potential customer clicks a referral link, visits the merchant's site, signs up, and makes a payment. The tracking system records the full attribution chain.

### Step-by-step

```
Customer clicks referral link → Cookie set → Merchant's signup form calls Affilio.referral() → Referral lead created → Payment webhook fires → Conversion + Commission created
```

#### 3.1 Click Tracking

**Client:** `public/track.js` — `handleReferralPath()`
**Endpoint:** `GET /track/click?code={code}&t={tenantId}` (`convex/http.ts`)
**Backend:** `convex/clicks.ts` — `recordClick`

When a customer visits `merchant.com/ref/JAMIE8X2`:

1. `track.js` detects the `/ref/{code}` path pattern
2. Sends `GET /track/click?code=JAMIE8X2&t={tenantId}`
3. The HTTP handler:
   - Validates the affiliate code is active
   - Deduplicates via `ipAddress + date` (same IP clicks only once per day)
   - Creates a `clicks` record with `referralLinkId`, `affiliateId`, `campaignId`, `ipAddress`, `userAgent`, `referrer`
   - Returns attribution data: `{ affiliateCode, clickId, tenantId }`
4. `track.js` sets the `_affilio` cookie (base64-encoded JSON with `{ code, clickId, tenantId, timestamp }`)
5. The URL is cleaned via `history.replaceState()` — the `/ref/` path is removed

```
merchant.com/ref/JAMIE8X2  →  track.js detects code  →  GET /track/click  →  cookie set  →  merchant.com (clean URL)
```

#### 3.2 Tracking Snippet Verification

**Endpoint:** `POST /api/tracking/ping` (`convex/http.ts`)

When `track.js` loads, it sends a verification ping:
- Creates a `trackingPings` record
- Dashboard shows "Tracking: Active — last detected 2h ago" or "Not detected"

#### 3.3 Referral Lead Capture

**Client:** `Affilio.referral({ email: "customer@example.com" })` on merchant's signup form
**Endpoint:** `POST /track/referral` (`convex/http.ts`)
**Backend:** `convex/referralLeads.ts` — `createOrUpdateLead`

When a customer enters their email on the merchant's signup form:

1. Merchant's code calls `Affilio.referral({ email: customerEmail })`
2. `track.js` reads the `_affilio` cookie to get attribution data
3. Sends `POST /track/referral` with `{ email, affiliateCode, tenantId, publicKey }`
4. The HTTP handler:
   - Resolves tenant via `publicKey` or `X-Tracking-Key` header
   - Validates affiliate is active
   - Creates/updates a `referralLeads` record linking `email → affiliateId → referralLinkId → campaignId`
5. A **referral health ping** is sent to `/api/tracking/referral-ping`

**First-affiliate-wins policy:** If an active lead already exists for this tenant + email, the attribution is NOT overwritten. Only the `uid` field is updated if provided.

**Always returns HTTP 200** — even on errors — to never break the merchant's signup flow.

#### 3.4 How `Affilio.referral()` Tracks Conversions (Two-Phase Mechanism)

`Affilio.referral()` alone does **NOT** track the conversion. It only creates a **lead** — a bridge record linking the customer's email to the affiliate. The actual conversion happens later, when the **payment webhook** arrives and matches that lead.

**Phase 1 — Lead Capture (what `Affilio.referral()` does at signup):**

When a customer who arrived via `/ref/JAMIE8X2` enters their email on the merchant's signup form, the merchant's code calls:

```js
if (window.Affilio) {
  Affilio.referral({ email: "alex@example.com" });
}
```

Internally, `track.js` does the following:

1. Reads the `_affilio` cookie that was set earlier when the customer clicked the referral link
2. Extracts the attribution data: `{ code: "JAMIE8X2", clickId: "...", tenantId: "..." }`
3. Sends `POST /track/referral` with `{ email, affiliateCode, tenantId, publicKey }`
4. The server creates a `referralLeads` record:

   | Field | Value |
   |-------|-------|
   | `tenantId` | Alex's tenant |
   | `email` | `alex@example.com` |
   | `affiliateId` | Jamie's affiliate ID |
   | `referralLinkId` | Jamie's referral link |
   | `campaignId` | The campaign |
   | `status` | `"active"` |

That's it — no conversion, no commission yet. Just a note saying "this email was referred by Jamie."

**Phase 2 — Conversion (what the webhook does at payment time):**

Days or weeks later, when Alex actually **pays**, the billing provider sends a webhook:

```
Stripe → POST /api/webhooks/stripe → { customer_email: "alex@example.com", amount: 200000 }
```

The webhook handler in `commissionEngine.ts` runs this logic:

1. **No affiliate code in Stripe metadata** (Stripe webhooks don't carry affiliate data)
2. **Falls back to lead matching** — looks up `referralLeads` by customer email
3. **Finds the lead from Phase 1** — resolves `affiliateCode: "JAMIE8X2"`
4. **NOW creates the conversion + commission** using the resolved attribution

```
Signup and payment are two separate events:

Customer clicks referral link ──── Cookie set with affiliate code
         │
         ▼
Customer signs up ──── Affilio.referral() links email → affiliate
         │                in referralLeads table (Phase 1)
         │
         ▼  (could be minutes, hours, or days later)
Customer pays ─────── Webhook arrives with customer email
         │                │
         │                ▼
         │           Look up referralLeads by email
         │                │
         │                ▼
         │           Found match → Create conversion + commission (Phase 2)
         │
         ▼
    The lead is the bridge.
```

**Why is it split this way?** Because signup and payment are separate events on the merchant's site. The merchant controls the signup form (where they call `Affilio.referral()`), but the payment is processed by their billing provider (where they can't inject affiliate data). The lead bridges the gap.

**What happens if `Affilio.referral()` is never called?** The webhook arrives with `alex@example.com`, but there's no `referralLeads` record for that email → no attribution found → the sale is recorded as an **organic conversion** (no commission for Jamie). This is why adding `Affilio.referral()` to the signup form is critical.

**What about providers with metadata support?** Some billing providers (like SaligPay) can optionally pass `_affilio_ref` metadata directly in the payment payload. In that case, the webhook already has the affiliate code and **skips** the lead lookup entirely. For Stripe (and as the recommended universal approach), the lead matching is required because Stripe webhooks don't carry affiliate metadata.

#### 3.5 Webhook-Triggered Conversions

**Endpoints:**
- `POST /api/webhooks/saligpay` (`convex/http.ts`) — SaligPay webhooks
- `POST /api/webhooks/stripe` (`convex/http.ts`) — Stripe webhooks

**Backend:** `convex/webhooks.ts` — `normalizeToBillingEvent()`, `convex/commissionEngine.ts` — `routeBillingEvent()`

When a payment occurs, the billing provider sends a webhook:

```
Billing Provider → HTTP endpoint → Signature verification → Deduplication → Normalize to BillingEvent → Route to commission engine → Create conversion + commission
```

**BillingEvent types and their handlers:**

| Event Type | Handler | Action |
|------------|---------|--------|
| `payment.updated` | `processPaymentUpdatedToCommission` | One-time payment → create conversion + commission |
| `subscription.created` | `processSubscriptionCreatedEvent` | New subscription → create conversion + initial commission |
| `subscription.updated` | `processSubscriptionUpdatedEvent` | Renewal/upgrade/downgrade → create conversion + recurring commission |
| `subscription.cancelled` | `processSubscriptionCancelledEvent` | No new commissions (pending ones preserved) |
| `refund.created` | `processRefundCreatedEvent` | Reverse matching commission (status → "reversed") |
| `chargeback.created` | `processChargebackCreatedEvent` | Reverse commission + add fraud signal |

#### 3.6 Attribution Resolution (The Matching Algorithm)

When a webhook arrives, the commission engine resolves attribution in this order:

```
1. Check event metadata for affiliate code (_affilio_ref in payload)
   ↓ (not found)
2. Look up referral lead by customer email (referralLeads table)
   ↓ (not found)
3. Look up referral lead by customer uid (if provided)
   ↓ (not found)
4. No attribution → create organic conversion (no commission)
```

This is the **universal billing provider integration** — the same lead matching works for both SaligPay and Stripe.

#### 3.7 Conversion Creation

**Backend:** `convex/conversions.ts`

A `conversions` record is created with the full attribution chain:

```
tenant → affiliate → referralLink → click → campaign → customer
```

For unattributed payments, an **organic conversion** is created (no affiliate link).

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `clicks` | Every referral link click (deduplicated by IP+day) |
| `trackingPings` | Tracking snippet health verification |
| `referralPings` | Referral health verification (from `Affilio.referral()`) |
| `referralLeads` | Customer email → affiliate attribution bridge |
| `conversions` | Completed payment events with full attribution chain |
| `rawWebhooks` | All incoming webhook events (deduplication via `eventId`) |

### Key Backend Functions

| Function | File | Purpose |
|----------|------|---------|
| `recordClick` | `convex/clicks.ts` | Record a referral link click |
| `createOrUpdateLead` | `convex/referralLeads.ts` | Create/update referral lead (upsert) |
| `resolveLeadAttribution` | `convex/referralLeads.ts` | Look up lead by email for webhook matching |
| `normalizeToBillingEvent` | `convex/webhooks.ts` | Normalize SaligPay payload to standard format |
| `normalizeStripeToBillingEvent` | `convex/webhooks.ts` | Normalize Stripe payload to standard format |
| `routeBillingEvent` | `convex/commissionEngine.ts` | Route BillingEvent to correct handler |
| `processPaymentUpdatedToCommission` | `convex/commissionEngine.ts` | Handle one-time payments |
| `processSubscriptionCreatedEvent` | `convex/commissionEngine.ts` | Handle new subscriptions |
| `processSubscriptionUpdatedEvent` | `convex/commissionEngine.ts` | Handle renewals/changes |
| `processRefundCreatedEvent` | `convex/commissionEngine.ts` | Handle refunds |
| `processChargebackCreatedEvent` | `convex/commissionEngine.ts` | Handle chargebacks |

---

## Flow 4: Commission Processing

### Overview

Once a conversion is created, the commission engine calculates the commission amount, applies rules, and manages the commission lifecycle.

### Step-by-step

```
Conversion created → Calculate commission amount → Check campaign status → Apply approval threshold → Commission created (pending/approved) → Review → Approve/Decline/Reverse
```

#### 4.1 Commission Calculation

**Backend:** `convex/commissions.ts` — `createCommissionFromConversionInternal`

The commission amount is calculated:

```
IF commissionType = "percentage":
  commissionAmount = saleAmount × (effectiveRate / 100)

IF commissionType = "flatFee":
  commissionAmount = effectiveRate
```

Where `effectiveRate` is resolved:
1. Check `affiliate.commissionOverrides[]` for an active override on this campaign
2. Fall back to `campaign.commissionValue`

For **recurring commissions** on subscription renewals:

| `recurringRateType` | Rate Used |
|---------------------|-----------|
| `"same"` | `campaign.commissionValue` (same as initial) |
| `"reduced"` | `campaign.recurringRate` (default: 50% of initial) |
| `"custom"` | `campaign.recurringRate` (custom value) |

If `recurringCommission` is `false`, **no commission** is created for renewals.

#### 4.2 Approval Threshold

Campaign-level `autoApproveCommissions` and `approvalThreshold` determine initial status:

```
IF autoApproveCommissions = true AND no threshold set:
  → status = "approved" (all auto-approved)

IF autoApproveCommissions = true AND threshold set:
  IF commissionAmount < threshold:
    → status = "approved" (small amounts auto-approved)
  ELSE:
    → status = "pending" (large amounts need manual review)

IF autoApproveCommissions = false:
  → status = "pending" (all need manual review)
```

#### 4.3 Self-Referral Detection

**Backend:** `convex/commissions.ts` — self-referral check in `createCommissionFromConversionInternal`

If the customer email matches an affiliate's email (case-insensitive) OR matches the tenant owner's email:
- Commission is created with `isSelfReferral: true`
- Fraud signal is added to the affiliate's record

#### 4.4 Commission Status Lifecycle

```
                    ┌──────────────────────────┐
                    │                          │
                    ▼                          │
  ┌─────────┐   ┌─────────┐   ┌──────────┐    │
  │ pending │──▶│ approved│──▶│   paid   │    │
  └────┬────┘   └────┬────┘   └──────────┘    │
       │             │                        │
       │             │   ┌──────────────┐     │
       │             └──▶│   reversed   │─────┘
       │                 └──────────────┘
       ▼
  ┌──────────┐
  │ declined │
  └──────────┘
```

| Status | Description | Reversible? |
|--------|-------------|-------------|
| `pending` | Awaiting manual review | → approved, declined, reversed |
| `approved` | Ready for payout | → paid (via batch), reversed |
| `paid` | Included in a payout batch | → reversed (via refund/chargeback) |
| `declined` | Rejected by owner | Terminal |
| `reversed` | Refunded/charged back | Terminal (but lead is reactivated) |

#### 4.5 Reversal (Refunds & Chargebacks)

**Backend:** `convex/commissionEngine.ts` — `processRefundCreatedEvent`, `processChargebackCreatedEvent`

| Event | Action | Additional |
|-------|--------|------------|
| `refund.created` | Commission status → `"reversed"`, `reversalReason = "refund"` | Lead reactivated if applicable |
| `chargeback.created` | Commission status → `"reversed"`, `reversalReason = "chargeback"` | **Fraud signal** added to affiliate (severity: high) |

Only commissions with status `pending` or `approved` can be reversed. Already-reversed commissions are idempotently skipped.

#### 4.6 Tenant Stats (Denormalized Counters)

**Backend:** `convex/tenantStats.ts`

Every commission status change triggers a denormalized counter update via mandatory hook functions:

| Hook Function | When Called |
|--------------|-------------|
| `onCommissionCreated()` | New commission created |
| `onCommissionStatusChange()` | Commission status changes |
| `onCommissionAmountChanged()` | Commission amount adjusted |

These update the `tenantStats` record for instant dashboard queries without table scans:
- `commissionsPendingCount`, `commissionsPendingValue`
- `commissionsConfirmedThisMonth`, `commissionsConfirmedValueThisMonth`
- `commissionsReversedThisMonth`, `commissionsReversedValueThisMonth`
- `commissionsFlagged`
- `pendingPayoutTotal`, `pendingPayoutCount`
- Rolling 1-month, 3-month, and last-month counters

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `commissions` | Commission records with status, amount, attribution |
| `conversions` | Payment events linked to commissions |
| `auditLogs` | Full audit trail for all commission actions |
| `tenantStats` | Denormalized counters for dashboard performance |

### Key Backend Functions

| Function | File | Purpose |
|----------|------|---------|
| `createCommissionFromConversionInternal` | `convex/commissions.ts` | Create commission from webhook conversion |
| `approveCommission` | `convex/commissions.ts` | Manually approve pending commission |
| `declineCommission` | `convex/commissions.ts` | Manually decline pending commission |
| `reverseCommissionInternal` | `convex/commissions.ts` | Reverse a commission (refund/chargeback) |
| `adjustCommissionAmountInternal` | `convex/commissions.ts` | Adjust amount (upgrade/downgrade) |
| `getEffectiveCommissionRate` | `convex/commissions.ts` | Resolve affiliate override vs campaign default |
| `addFraudSignalInternal` | `convex/affiliates.ts` | Add fraud signal to affiliate record |

---

## Flow 5: Payouts

### Overview

Alex generates a payout batch for all affiliates with approved commissions, then marks individual payouts as paid (manually or via external payment processor).

### Step-by-step

```
View pending payouts → Generate payout batch → Commissions marked "paid" → Individual payouts created → Mark payouts as paid → Batch auto-completes → Notification emails sent
```

#### 5.1 View Pending Payouts

**Backend:** `convex/payouts.ts` — `getAffiliatesWithPendingPayouts`

The dashboard shows all affiliates with approved, unpaid commissions. Data comes from the denormalized `tenantStats.pendingPayoutTotal` counter (no table scan needed).

Tier limit enforcement: The batch generation checks `tierConfigs.maxPayoutsPerMonth` before creating the batch.

#### 5.2 Generate Payout Batch

**Backend:** `convex/payouts.ts` — `generatePayoutBatch`

When Alex clicks "Generate Payout":

1. Query all commissions with `status = "approved"` AND `batchId = null` (not already paid)
2. Optionally filter to specific affiliate IDs
3. Aggregate by affiliate: sum amounts and count commissions
4. Create a `payoutBatches` record with:
   - `totalAmount` — sum of all commission amounts
   - `affiliateCount` — number of affiliates with payouts
   - `status: "pending"`
   - `generatedAt` — current timestamp
5. For each affiliate:
   - Create a `payouts` record
   - Update all their commissions: `status → "paid"`, `batchId` set
   - Fire `onCommissionStatusChange()` tenantStats hook
6. Create audit log entry

**Idempotent:** Commissions with an existing `batchId` are excluded — the same batch cannot be regenerated.

#### 5.3 Mark Payouts as Paid

**Backend:** `convex/payouts.ts` — `markPayoutAsPaid` (individual) or `markBatchAsPaid` (bulk)

**Individual payout:**

1. Verify payout belongs to current tenant
2. If already paid → return current state (idempotent)
3. Update payout: `status → "paid"`, `paidAt`, optional `paymentReference`
4. Call `incrementTotalPaidOut()` tenantStats hook
5. Schedule payout notification email (`sendPayoutSentEmail`)
6. Check if all payouts in batch are paid → **auto-transition batch to "completed"**

**Bulk (all in batch):**

Same logic but for all pending payouts in the batch simultaneously. Sets `batch.status = "completed"`.

#### 5.4 Payout Batch Lifecycle

```
  ┌──────────┐         ┌────────────┐
  │ pending  │────────▶│ processing │
  └──────────┘         └─────┬──────┘
                             │
                             ▼
                      ┌──────────┐
                      │ completed│
                      └──────────┘
```

| Status | Description |
|--------|-------------|
| `pending` | Batch generated, individual payouts not yet paid |
| `processing` | Some payouts have been marked paid, some pending |
| `completed` | All payouts in the batch are marked paid |

> **Auto-transition:** When the last payout in a batch is marked paid, the batch automatically transitions to `completed` and sets `completedAt`.

#### 5.5 CSV Download

**Backend:** `convex/payouts.ts` — `getBatchPayouts`

The "Download CSV" button fetches all payout records for a batch, enriched with affiliate name, email, payout method, commission count, and payment reference.

#### 5.6 Payout Notification Emails

**Backend:** `convex/emails.ts` — `sendPayoutSentEmail`

When a payout is marked paid:
- An email is scheduled via `ctx.scheduler.runAfter()`
- Email is branded with the tenant's portal name, logo, and primary color
- Includes payout amount, payment reference, and link to portal earnings page
- Uses Resend for delivery
- Delivery status tracked via `emails.deliveryStatus` field

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `payoutBatches` | Batch metadata (total, count, status, timestamps) |
| `payouts` | Individual payout records per affiliate per batch |
| `commissions` | Commission records (linked to batch via `batchId` field) |
| `emails` | Notification email records with delivery tracking |
| `tenantStats` | Denormalized `totalPaidOut` counter |

### Key Backend Functions

| Function | File | Purpose |
|----------|------|---------|
| `generatePayoutBatch` | `convex/payouts.ts` | Generate batch from approved commissions |
| `getAffiliatesWithPendingPayouts` | `convex/payouts.ts` | List affiliates with approved unpaid commissions |
| `getPendingPayoutTotal` | `convex/payouts.ts` | Total pending amount from tenantStats |
| `markPayoutAsPaid` | `convex/payouts.ts` | Mark single payout as paid |
| `markBatchAsPaid` | `convex/payouts.ts` | Mark all payouts in batch as paid |
| `getPayoutBatches` | `convex/payouts.ts` | Paginated batch list with status filter |
| `getBatchPayouts` | `convex/payouts.ts` | All payouts in a batch (for CSV download) |
| `getBatchCommissionsForAffiliate` | `convex/payouts.ts` | Commission breakdown per affiliate in a batch |
| `getBatchPayoutStatus` | `convex/payouts.ts` | Paid/pending counts for batch progress |
| `recalcPendingPayoutStats` | `convex/payouts.ts` | Fix tenantStats sync issues |

---

## End-to-End Example

The complete journey from click to payout:

```
1. Jamie joins Alex's affiliate program
   └── affiliates.createReferralLink() → referralLinks { code: "JAMIE8X2" }

2. Alex shares: techflow.com/ref/JAMIE8X2

3. Customer clicks the link
   └── track.js detects /ref/JAMIE8X2
   └── GET /track/click → clicks record created
   └── _affilio cookie set (base64 JSON with attribution)

4. Customer signs up on techflow.com
   └── Merchant's form: Affilio.referral({ email: "alex@example.com" })
   └── POST /track/referral → referralLeads record created
   └── Referral health ping sent

5. Customer pays ₱2,000/month subscription
   └── Stripe webhook → POST /api/webhooks/stripe
   └── Signature verification → rawWebhooks record (deduplicated)
   └── normalizeStripeToBillingEvent() → BillingEvent
   └── No affiliate code in Stripe metadata
   └── Lead match: referralLeads.findByEmail("alex@example.com") ✓
   └── Jamie's affiliate code found → commission created

6. Commission engine processes subscription.created
   └── conversions record created (attributionSource: "webhook")
   └── Commission calculated: ₱2,000 × 15% = ₱300
   └── Below approval threshold → status: "approved"
   └── tenantStats counters updated

7. Monthly renewal (30 days later)
   └── subscription.updated webhook
   └── recurringCommission = true → new commission created (₱300)
   └── Referral lead marked as "converted"

8. Alex generates payout batch
   └── generatePayoutBatch() → payoutBatches + payouts records
   └── All commissions marked "paid", linked to batch

9. Alex marks Jamie's payout as paid
   └── markPayoutAsPaid() → payout.status = "paid"
   └── Email sent to Jamie: "You've been paid ₱300"
   └── tenantStats.totalPaidOut incremented

10. Customer requests refund
    └── refund.created webhook
    └── Commission found by transactionId → status: "reversed"
    └── Referral lead reactivated (can earn future commissions)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER BROWSER                         │
│  ┌──────────┐   ┌─────────────────────────────────────────┐    │
│  │ track.js │   │  Merchant's Website                     │    │
│  │          │   │  ┌───────────────────────────────────┐  │    │
│  │ init()   │   │  │ Signup Form                       │  │    │
│  │ handle   │   │  │   Affilio.referral({ email })     │  │    │
│  │ Referral │   │  └─────────┬─────────────────────────┘  │    │
│  │ Path()   │   │            │                           │    │
│  │          │   └────────────┼───────────────────────────┘    │
│  └────┬─────┘                │                                │
└───────┼──────────────────────┼────────────────────────────────┘
        │                      │
        │  GET /track/click    │  POST /track/referral
        │                      │
┌───────┼──────────────────────┼────────────────────────────────┐
│       ▼                      ▼                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  Convex HTTP Layer                       │  │
│  │  /track/click  │  /track/referral  │  /api/webhooks/*   │  │
│  └────────┬────────────┬──────────────────┬─────────────────┘  │
│           │            │                  │                    │
│           ▼            ▼                  ▼                    │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────┐       │
│  │   clicks   │ │ referralLeads│ │   rawWebhooks     │       │
│  └────────────┘ └──────────────┘ └────────┬──────────┘       │
│                                              │                  │
│                         normalizeToBillingEvent()              │
│                                              │                  │
│                                              ▼                  │
│                              ┌──────────────────────┐          │
│                              │  Commission Engine    │          │
│                              │  routeBillingEvent()  │          │
│                              └──────────┬───────────┘          │
│                                         │                       │
│                              ┌──────────▼───────────┐          │
│                              │   conversions        │          │
│                              └──────────┬───────────┘          │
│                                         │                       │
│                              ┌──────────▼───────────┐          │
│                              │   commissions        │          │
│                              │   (pending/approved) │          │
│                              └──────────┬───────────┘          │
│                                         │                       │
│                              ┌──────────▼───────────┐          │
│                              │   Payout Batches     │          │
│                              │   → payouts          │          │
│                              │   → emails (notify)  │          │
│                              └──────────────────────┘          │
│                                                                │
│                        Convex Backend                           │
└────────────────────────────────────────────────────────────────┘
```

---

## HTTP Endpoints Summary

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/track/click` | Record referral link click | Public (via code+tenantId) |
| `POST` | `/track/referral` | Create referral lead from `Affilio.referral()` | Public (via publicKey/cookie) |
| `POST` | `/api/tracking/ping` | Tracking snippet health ping | Public (via publicKey) |
| `POST` | `/api/tracking/referral-ping` | Referral health ping | Public (via publicKey) |
| `POST` | `/api/webhooks/saligpay` | Billing provider webhook (SaligPay) | Signature verification |
| `POST` | `/api/webhooks/stripe` | Billing provider webhook (Stripe) | Signature verification |
