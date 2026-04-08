---
title: "Multi-Provider Email Support (Resend + Postmark)"
slug: "multi-provider-email-postmark"
created: "2026-04-08"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Convex 1.32.0", "Next.js 16", "@convex-dev/resend 0.2.3", "@react-email/components 0.5.7", "postmark npm (new)", "TypeScript 5.9"]
files_to_modify: ["convex/emailService.ts (NEW)", "convex/schema.ts", "convex/http.ts", "convex/email.tsx", "convex/emails.tsx", "convex/broadcasts.tsx", "convex/teamInvitations.ts", "convex/tenants.ts", "convex/users.ts", "convex/affiliateAuth.ts", "convex/subscriptions.ts", "convex/admin/tier_configs.ts", "convex/convex.config.ts", "package.json"]
code_patterns: ["internalAction for Postmark sends", "internalMutation for Resend sends from mutation context", "ctx.scheduler.runAfter for async email dispatch", "httpAction for webhook handlers", "getFromAddress(prefix) helper for from-address", "process.env for Convex env vars"]
test_patterns: ["Vitest configured (placeholder tests only)", "No production tests exist", ".test.ts suffix", "--typecheck=disable for Convex CLI runs"]
---

# Tech-Spec: Multi-Provider Email Support (Resend + Postmark)

**Created:** 2026-04-08
**Reviewed:** Adversarial review passed — 15 findings addressed

## Overview

### Problem Statement

The platform is locked to Resend for all transactional email (auth, billing, affiliate lifecycle, commissions, fraud, broadcasts, team). There is no way to switch email providers without changing code across 9+ files that directly instantiate Resend. Need Postmark as an alternative provider, selectable via global configuration. Additionally, email tracking is inconsistent — some files use the canonical `trackEmailSent` mutation, others do manual `ctx.db.insert("emails", ...)`, and some have no tracking at all.

### Solution

Build a **dual-path email service abstraction** in `convex/emailService.ts` that routes sends to either Resend or Postmark based on the `EMAIL_PROVIDER` Convex environment variable. The abstraction provides TWO entry points to handle Convex's runtime constraints:

1. **`sendEmail` (internalAction)** — Full provider routing (Resend + Postmark). Used from action contexts or via `ctx.scheduler.runAfter(0, ...)`.
2. **`sendEmailFromMutation` (internalMutation)** — Resend-only inline sends from mutation contexts. Throws a clear error if `EMAIL_PROVIDER=postmark` (because Postmark's SDK requires Node.js runtime).

This design preserves existing mutation-callable helpers (Better Auth callbacks, broadcast batching, billing notifications) while adding Postmark support. Both paths include opt-in tracking, centralized from-address construction, and consistent error handling. Add a Postmark webhook endpoint (`POST /webhooks/postmark`) with full delivery tracking parity. Migrate ALL email send sites across the entire codebase to use the unified abstraction.

### Scope

**In Scope:**
- Dual-path email service abstraction (`convex/emailService.ts`) — `sendEmail` internalAction + `sendEmailFromMutation` internalMutation
- Opt-in tracking via `tracking` flag: `{tenantId, type, affiliateId?, broadcastId?}` — abstraction handles `emails` table insert
- Postmark sending via `postmark` npm package (Node.js SDK, used in actions only)
- Postmark webhook handler (`POST /webhooks/postmark`) — 5 events mapped to existing `updateEmailDeliveryStatus`
- Webhook auth via custom header `X-Webhook-Secret` (validated against `POSTMARK_WEBHOOK_SECRET` env var)
- Schema migration: `emails` table gains `provider` and `postmarkMessageId` fields; new index `by_postmark_message_id`
- Schema migration: `rawWebhooks` table gains `"postmark"` as a valid `source` value
- Migrate ALL 9 files with direct Resend calls: `email.tsx`, `emails.tsx`, `broadcasts.tsx`, `teamInvitations.ts`, `tenants.ts`, `users.ts`, `affiliateAuth.ts`, `subscriptions.ts`, `admin/tier_configs.ts`
- Consolidate ALL files doing manual `emails` inserts to use abstraction's built-in tracking
- Fix pre-tracking bug in `email.tsx` (4 action functions track "sent" before actual send)
- Remove dead code: `getEmailByResendMessageId` query (never called), `_logEmailSentInternal` mutation (moved to PR3 deletion)
- Global config via Convex env vars: `EMAIL_PROVIDER` (resend|postmark), `POSTMARK_SERVER_TOKEN`, `EMAIL_TEST_MODE`
- New dependency: `postmark` npm package
- Hard fail + log error if configured provider has missing/invalid credentials
- Migration verification: grep for zero residual direct Resend calls across `convex/`
- Fix hardcoded `boboddy.business` in `teamInvitations.ts`, `tenants.ts`, `users.ts` to use `EMAIL_DOMAIN` pattern
- Standardize `testMode` via Convex env var `EMAIL_TEST_MODE` (not `NODE_ENV`)
- Store raw Postmark webhook payloads in `rawWebhooks` table
- Rename `sendDeletionReminder` collision: `email.tsx` → `sendSubscriptionDeletionReminder`, `tenants.ts` → `sendTenantDeletionReminder`
- Broadcast batching: preserved for Resend (inline), degraded for Postmark (documented limitation)

**Out of Scope:**
- Per-tenant provider selection (global only)
- Admin UI settings page for email provider configuration
- Email template changes (React Email components untouched)
- Fallback to alternate provider on failure
- Inbound email handling
- Postmark-specific features (Rebound, Bulk API, Inbound)
- Retry scheduling at abstraction level (retry remains at caller level via `ctx.scheduler.runAfter`)
- Production tests (project has no test suite yet)

## Context for Development

### Codebase Patterns

- Email sending uses `@convex-dev/resend` Convex component, instantiated via `new Resend(components.resend, { testMode: false })` in 9 separate files
- The `@convex-dev/resend` component accepts `MutationCtx` (wraps Node.js runtime internally) — this is why existing code can send from inside mutations
- Postmark's SDK (`postmark` npm) does NOT have a Convex component — requires Node.js runtime directly, meaning it can only be called from `action` contexts
- Component registration lives in `convex/convex.config.ts` — Resend registered with key `resend`
- All email templates are React Email components in `convex/emails/`, rendered to HTML via `@react-email/render`'s `render()` function
- From-address pattern: `${FROM_NAME} <${prefix}@${EMAIL_DOMAIN}>` using env vars `EMAIL_DOMAIN` and `EMAIL_FROM_NAME`
- Convex env vars are set via `pnpm convex env set VARIABLE_NAME value` and accessed via `process.env.VARIABLE_NAME`
- `emails.tsx` contains the canonical tracking functions: `trackEmailSent` (internalMutation, line 29), `updateEmailDeliveryStatus` (internalMutation, line 67), `updateBroadcastAggregateCount` (internalMutation, line 155)
- `getEmailByResendMessageId` (internalQuery, line 204) is dead code — never called
- Resend webhook at `POST /webhooks/resend` (http.ts lines 618-718) uses HMAC-SHA256 verification via `x-resend-signature` header
- `rawWebhooks` table is used by SaligPay/Stripe webhooks but NOT by the Resend webhook handler
- Pre-existing test files have TypeScript errors — always use `--typecheck=disable` when running Convex CLI

### Complete Send Site Catalogue (27 send sites across 9 files)

#### `convex/email.tsx` (15 send sites)

| # | Line | Function | Type | From Prefix | Tracking | Caller Context |
|---|------|----------|------|-------------|----------|----------------|
| 1 | 48 | `sendEmailVerification` | Plain async helper | `onboarding` | **NONE** | Better Auth callback (mutation ctx) |
| 2 | 66 | `sendOTPVerification` | Plain async helper | `onboarding` | **NONE** | Better Auth callback (mutation ctx) |
| 3 | 84 | `sendMagicLink` | Plain async helper | `onboarding` | **NONE** | Better Auth callback (mutation ctx) |
| 4 | 102 | `sendResetPassword` | Plain async helper | `onboarding` | **NONE** | Better Auth callback (mutation ctx) |
| 5 | 128 | `sendUpgradeConfirmation` | Plain async helper | `billing` | **NONE** | Mutation (`subscriptions.ts` L370) |
| 6 | 160 | `sendDowngradeConfirmation` | Plain async helper | `billing` | **NONE** | Mutation (`subscriptions.ts` L679) |
| 7 | 189 | `sendCancellationConfirmation` | Plain async helper | `billing` | **NONE** | Mutation (`subscriptions.ts` L809) |
| 8 | 215 | `sendSubscriptionDeletionReminder` | Plain async helper | `billing` | **NONE** | Mutation — **rename from `sendDeletionReminder` (F7)** |
| 9 | 269 | `sendAffiliateWelcomeEmail` | Plain async helper | `onboarding` | Manual insert (L290) | Mutation (`affiliateAuth.ts` L5) |
| 10 | 369 | `sendAffiliateWelcomeEmailWithRetry` | internalAction | `onboarding` | `trackEmailSent` (L389) | Action context |
| 11 | 458 | `sendNewAffiliateNotificationEmail` | Plain async helper | `notifications` | **NONE** | Mutation (`affiliateAuth.ts` L5) |
| 12 | 507 | `sendApprovalEmail` | action | `notifications` | `trackEmailSent` (L498) **BUG: pre-tracks** | Action context |
| 13 | 572 | `sendRejectionEmail` | action | `notifications` | `trackEmailSent` (L563) **BUG: pre-tracks** | Action context |
| 14 | 636 | `sendSuspensionEmail` | action | `notifications` | `trackEmailSent` (L627) **BUG: pre-tracks** | Action context |
| 15 | 700 | `sendReactivationEmail` | action | `notifications` | `trackEmailSent` (L691) **BUG: pre-tracks** | Action context |

#### `convex/emails.tsx` (4 send sites)

| # | Line | Function | Type | From Prefix | Tracking | Caller Context |
|---|------|----------|------|-------------|----------|----------------|
| 16 | 334 | `sendFraudAlertEmail` | internalAction | `security` | `trackEmailSent` (L355) | Action context |
| 17 | 494 | `sendCommissionConfirmedEmail` | internalAction | `notifications` | `trackEmailSent` (L502) | Action context |
| 18 | 673 | `sendPayoutSentEmail` | internalAction | `notifications` | `trackEmailSent` (L681) | Action context |
| 19 | 787 | `sendNewReferralAlertEmail` | internalAction | `notifications` | `trackEmailSent` (L813) | Action context |

#### `convex/broadcasts.tsx` (2 send sites)

| # | Line | Function | Type | From Prefix | Tracking | Caller Context |
|---|------|----------|------|-------------|----------|----------------|
| 20 | 421 | `sendSingleBroadcastEmail` | Plain async helper | `broadcasts` | `trackEmailSent` (L442) + `resendMessageId` | Mutation (batch loop with `Promise.allSettled`) |
| 21 | 528 | `retryFailedBroadcastEmail` | internalAction | `broadcasts` | `trackEmailSent` (L546) + `resendMessageId` | Action context |

#### `convex/teamInvitations.ts` (3 send sites)

| # | Line | Function | Type | From Prefix | Tracking | Caller Context |
|---|------|----------|------|-------------|----------|----------------|
| 22 | 228 | `scheduleInvitationEmail` | internalMutation | **HARDCODED** `boboddy.business` | Manual insert (L248) | Mutation via `runAfter(0)` |
| 23 | 491 | `scheduleAcceptanceEmails` (member) | internalMutation | **HARDCODED** `boboddy.business` | Manual insert (L509) | Mutation via `runAfter(0)` |
| 24 | 545 | `scheduleAcceptanceEmails` (owner) | internalMutation | **HARDCODED** `boboddy.business` | Manual insert (L565) | Mutation via `runAfter(0)` |

#### `convex/tenants.ts` (2 send sites)

| # | Line | Function | Type | From Prefix | Tracking | Caller Context |
|---|------|----------|------|-------------|----------|----------------|
| 25 | 273 | `sendDomainChangeNotification` | internalMutation | **HARDCODED** `boboddy.business` | **NONE** | Mutation via `runAfter(0)` |
| 26 | 1401 | `sendTenantDeletionReminder` | internalAction | **HARDCODED** `boboddy.business` | Local `_logEmailSentInternal` (L1409) | Action context — **rename from `sendDeletionReminder` (F7)** |

#### `convex/users.ts` (1 send site)

| # | Line | Function | Type | From Prefix | Tracking | Caller Context |
|---|------|----------|------|-------------|----------|----------------|
| 27 | 828 | `sendRemovalNotification` | internalAction | **HARDCODED** `boboddy.business` | `trackEmailSent` (L845) | Action context |

#### Additional files with manual `emails` inserts

| File | Line | Context | Notes |
|------|------|---------|-------|
| `convex/affiliateAuth.ts` | 456 | Manual `ctx.db.insert("emails", ...)` | Also calls `sendAffiliateWelcomeEmail` + `sendNewAffiliateNotificationEmail` from `email.tsx` (L5) |
| `convex/subscriptions.ts` | 378 | Manual `ctx.db.insert("emails", ...)` | Also calls `sendUpgradeConfirmation` + `sendDowngradeConfirmation` + `sendCancellationConfirmation` from `email.tsx` (L14) |
| `convex/admin/tier_configs.ts` | 764 | Manual `ctx.db.insert("emails", ...)` | Tier config notification |

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/emailService.ts` | **NEW** — Dual-path email abstraction (`sendEmail` action + `sendEmailFromMutation` mutation + `getFromAddress`) |
| `convex/email.tsx` | Primary email service — 15 send sites, Resend instantiation, from-address helper |
| `convex/emails.tsx` | Secondary email service — 4 send sites + `trackEmailSent` (L29), `updateEmailDeliveryStatus` (L67), `updateBroadcastAggregateCount` (L155) |
| `convex/broadcasts.tsx` | Broadcast sending — 2 send sites, batch loop with `Promise.allSettled` |
| `convex/teamInvitations.ts` | Team emails — 3 send sites, hardcoded domains |
| `convex/tenants.ts` | Tenant emails — 2 send sites, hardcoded domains, local `_logEmailSentInternal` |
| `convex/users.ts` | User emails — 1 send site, hardcoded domain |
| `convex/affiliateAuth.ts` | Affiliate auth emails — manual tracking + calls helpers from `email.tsx` |
| `convex/subscriptions.ts` | Subscription emails — manual tracking + calls helpers from `email.tsx` |
| `convex/admin/tier_configs.ts` | Admin tier emails — manual tracking |
| `convex/http.ts` | Webhook handlers — Resend (L618-718), new Postmark handler to add |
| `convex/schema.ts` | DB schema — `emails` table (L473-503), `rawWebhooks` (L458-471) |
| `convex/convex.config.ts` | Convex component registration — Resend registered as `resend` |
| `package.json` | Dependencies — add `postmark` |

### Technical Decisions

1. **Global config via Convex env vars** — `EMAIL_PROVIDER=resend|postmark`, `POSTMARK_SERVER_TOKEN`, `EMAIL_TEST_MODE`. Same pattern as existing `RESEND_API_KEY`. No DB table needed for config.
2. **Hard fail on bad credentials** — No silent fallback. If `EMAIL_PROVIDER=postmark` but `POSTMARK_SERVER_TOKEN` is missing, throw a clear error and log.
3. **Dual-path abstraction** — Two entry points to handle Convex's runtime constraint that Postmark SDK requires Node.js (action context) while Resend component works in mutation context:
   - `sendEmail` (internalAction): Full provider routing. Used from action contexts or via `ctx.scheduler.runAfter(0, ...)`.
   - `sendEmailFromMutation` (internalMutation): Resend-only inline sends. Throws `"Postmark emails cannot be sent from mutation context — use sendEmail action via ctx.scheduler.runAfter"` if `EMAIL_PROVIDER=postmark`.
   - **Why**: Better Auth callbacks run in mutation context and must send synchronously. Broadcast batching uses `Promise.allSettled` inside a mutation. Billing helpers are called from mutations in `subscriptions.ts`. Converting all to actions/fire-and-forget would break these patterns. (Adversarial findings F1, F2, F3)
4. **Postmark SDK over HTTP** — Use official `postmark` npm package (`ServerClient`) rather than raw HTTP calls.
5. **Webhook parity** — Postmark sends 5 webhook types (Delivery, Open, Click, Bounce, SpamComplaint) that map 1:1 to existing Resend events. Reuse `updateEmailDeliveryStatus` mutation (extend to support `postmarkMessageId` lookup).
6. **Separate provider message ID fields** — Keep `resendMessageId` + `postmarkMessageId` as separate fields (not consolidated to `providerMessageId`). Rationale: avoids data migration for existing rows with `resendMessageId` populated; the `provider` field already serves as discriminator. Adding a third provider would add a third field — acceptable given low frequency of provider changes. (Adversarial finding F11 — decided against consolidation to avoid migration complexity)
7. **Provider field on emails table** — Add `provider` field (resend|postmark) to `emails` table. Add `postmarkMessageId` alongside existing `resendMessageId`. Add `by_postmark_message_id` index.
8. **Opt-in tracking** — Abstraction accepts optional `tracking` object (`{tenantId, type, affiliateId?, broadcastId?}`). When provided, calls `internal.emails.trackEmailSent` internally. When omitted, no tracking row.
9. **Rich send args** — Abstraction accepts optional `replyTo` and `messageStream` fields for provider-specific features without schema changes later. (Adversarial findings F10, F12)
10. **Return type provides observability** — Both send functions return `v.object({ success: v.boolean(), provider: v.string(), messageId: v.optional(v.string()) })` instead of `v.null()`. Callers can log/messageId for debugging. (Adversarial finding F13)
11. **Webhook auth via custom header** — Postmark does not use HMAC signatures. Configure `X-Webhook-Secret` header in Postmark dashboard. Validate against `POSTMARK_WEBHOOK_SECRET` env var.
12. **Unify tracking** — Abstraction is the single point of tracking. `trackEmailSent` in `emails.tsx` remains but is only called by the abstraction.
13. **Extend `updateEmailDeliveryStatus`** — Add `provider` param, conditional index lookup based on provider, full handler pseudocode documented. (Adversarial finding F5)
14. **Store raw webhooks** — Postmark webhook handler stores payloads in `rawWebhooks` with `eventId = ${MessageID}_${RecordType}` to avoid uniqueness collisions. (Adversarial finding F9)
15. **Remove dead code in PR3 only** — `getEmailByResendMessageId` deleted in PR1 (no callers). `_logEmailSentInternal` deleted in PR3 alongside `tenants.ts` migration to avoid broken reference window. (Adversarial finding F4)
16. **Fix pre-tracking bug** — 4 action functions in `email.tsx` fixed by abstraction (tracks only after successful send).
17. **3-PR migration strategy** — Incremental for reviewability and rollback safety.
18. **`EMAIL_TEST_MODE` Convex env var** — Controls Resend `testMode`. Not `process.env.NODE_ENV` which is platform-set and unreliable in Convex production. (Adversarial finding F15)
19. **`EMAIL_DOMAIN` consistency** — Abstraction centralizes from-address. Throws if missing. Eliminates all hardcoded domains.
20. **Rename `sendDeletionReminder` collision** — `email.tsx` → `sendSubscriptionDeletionReminder`, `tenants.ts` → `sendTenantDeletionReminder`. (Adversarial finding F7)
21. **Broadcast batching preserved for Resend, degraded for Postmark** — Resend path uses existing `Promise.allSettled` batch loop (unchanged). Postmark path schedules individual sends via `ctx.scheduler.runAfter(0, ...)` with a delayed status-finalization action. Documented limitation. (Adversarial finding F2)

### Failure Mode Mitigations

| Failure Mode | Mitigation |
|---|---|
| `EMAIL_PROVIDER` not set, typo, or invalid value | Validate at entry — throw clear error listing valid options |
| `POSTMARK_SERVER_TOKEN` missing when provider is `postmark` | Fail fast — throw descriptive error |
| Postmark send from mutation context | `sendEmailFromMutation` throws: "Postmark emails cannot be sent from mutation context" |
| Postmark API down / network error | Wrap in try/catch, log error, rethrow. Callers handle retry |
| `postmark` npm package incompatibility | Pin version, test in Convex action before shipping |
| Postmark webhook payload format change | Validate `RecordType` at entry, return 400 for unknown types |
| Wrong provider in `emails` table | Set provider from actual send, not from config |
| Webhook URL not configured | Document setup step in Postmark dashboard |
| Raw webhooks for debugging | Store all Postmark webhook payloads in `rawWebhooks` table |
| `rawWebhooks` eventId collision | Construct as `${MessageID}_${RecordType}` (unique per event type per message) |
| Open/Click webhook timestamp extraction | Use `ReceivedAt` field for Open and Click events (not `DeliveredAt`/`BouncedAt`) |
| `@convex-dev/resend` ctx cast | Document `ctx as unknown as MutationCtx` cast in abstraction for Resend path |

### Tracking Pattern Inconsistencies (to be fixed by this migration)

| Current Pattern | Files | Fix |
|---|---|---|
| No tracking at all | `email.tsx` (8 auth/billing helpers), `tenants.ts` (domain change) | Pass `tracking` to abstraction where appropriate; leave untracked for Better Auth sends |
| Manual `ctx.db.insert("emails", ...)` | `email.tsx` (L290), `teamInvitations.ts` (L248,509,565), `tenants.ts` (L1409), `affiliateAuth.ts` (L456), `subscriptions.ts` (L378), `admin/tier_configs.ts` (L764) | Replace with abstraction's opt-in tracking |
| `trackEmailSent` (canonical) | `emails.tsx`, `broadcasts.tsx`, `email.tsx` (action functions), `users.ts` | Replace direct calls with abstraction tracking param |
| Local `_logEmailSentInternal` | `tenants.ts` (L1437) | Delete in PR3 — replaced by abstraction |
| Pre-tracking bug | `email.tsx` (L498, L563, L627, L691) | Fixed by abstraction (tracks only after successful send) |

## Implementation Plan

### Migration Strategy (3-PR Incremental Rollout)

**Default `EMAIL_PROVIDER=resend` throughout migration** — zero production impact until Postmark is explicitly activated.

#### PR1: Abstraction Foundation + Postmark Support
- Create `convex/emailService.ts` with dual-path abstraction (`sendEmail` + `sendEmailFromMutation`)
- Schema changes: add `provider`, `postmarkMessageId` fields + `by_postmark_message_id` index
- Extend `trackEmailSent` and `updateEmailDeliveryStatus` for dual-provider
- Add `POST /webhooks/postmark` handler in `http.ts`
- Add `postmark` npm dependency
- Centralize from-address + dead code removal (`getEmailByResendMessageId` only)
- **No file migrations yet** — existing code still calls Resend directly
- **`_logEmailSentInternal` NOT deleted yet** (moved to PR3 to avoid broken reference window)

#### PR2: Core Email Files Migration
- Migrate `convex/emails.tsx` — 4 send sites (already action-based, best template)
- Migrate `convex/broadcasts.tsx` — 2 send sites (use `sendEmailFromMutation` for batch loop; add Postmark fallback path)

#### PR3: All Remaining Files + Cleanup
- Migrate `convex/email.tsx` — 15 send sites (plain helpers stay callable via `sendEmailFromMutation`)
- Migrate `convex/users.ts` — 1 send site
- Migrate `convex/teamInvitations.ts` — 3 send sites
- Migrate `convex/tenants.ts` — 2 send sites + **delete `_logEmailSentInternal`**
- Migrate `convex/affiliateAuth.ts` — manual tracking + update caller patterns for imported helpers
- Migrate `convex/subscriptions.ts` — manual tracking + update caller patterns for imported helpers
- Migrate `convex/admin/tier_configs.ts` — manual tracking
- **Rename** `sendDeletionReminder` → `sendSubscriptionDeletionReminder` (email.tsx) + `sendTenantDeletionReminder` (tenants.ts)
- Remove all residual Resend instantiation and imports
- Migration verification: grep confirms zero residual direct Resend calls

#### Rollback Plan
- Flip `EMAIL_PROVIDER=resend` and redeploy — immediate rollback to Resend-only
- Each PR is independently revertable via git revert

### Tasks

#### PR1: Abstraction Foundation + Postmark Support

- [x] **Task 1: Install postmark dependency**
  - File: `package.json`
  - Action: Add `postmark` npm package (pin to latest stable version). Run `pnpm install`.
  - Notes: The `postmark` npm package provides `ServerClient` for sending emails. No Convex component exists for Postmark — must use SDK directly in actions.

- [x] **Task 2: Schema migration — extend `emails` table**
  - File: `convex/schema.ts`
  - Action: Add two fields to the `emails` table definition:
    - `provider: v.optional(v.union(v.literal("resend"), v.literal("postmark")))`
    - `postmarkMessageId: v.optional(v.string())`
  - Action: Add new index `.index("by_postmark_message_id", ["postmarkMessageId"])`
  - Notes: Fields are `optional` for backward compatibility. Existing data unaffected.

- [x] **Task 3: Extend `trackEmailSent` to support provider and postmarkMessageId**
  - File: `convex/emails.tsx` (line 29)
  - Action: Add to args validator:
    - `provider: v.optional(v.union(v.literal("resend"), v.literal("postmark")))`
    - `postmarkMessageId: v.optional(v.string())`
  - Action: Add both fields to the `ctx.db.insert` call (lines 44-56)

- [x] **Task 4: Extend `updateEmailDeliveryStatus` for dual-provider lookup**
  - File: `convex/emails.tsx` (line 67)
  - Action: Refactor args to:
    ```typescript
    args: {
      provider: v.union(v.literal("resend"), v.literal("postmark")),
      resendMessageId: v.optional(v.string()),
      postmarkMessageId: v.optional(v.string()),
      eventType: v.union(v.literal("delivered"), v.literal("opened"), v.literal("clicked"), v.literal("bounced"), v.literal("complained")),
      timestamp: v.number(),
      reason: v.optional(v.string()),
    }
    ```
  - Action: Handler logic (full pseudocode):
    ```typescript
    handler: async (ctx, args) => {
      // 1. Lookup email by provider-specific index
      let email;
      if (args.provider === "resend") {
        if (!args.resendMessageId) throw new Error("resendMessageId required for resend provider");
        email = await ctx.db.query("emails")
          .withIndex("by_resend_message_id", q => q.eq("resendMessageId", args.resendMessageId))
          .unique();
      } else {
        if (!args.postmarkMessageId) throw new Error("postmarkMessageId required for postmark provider");
        email = await ctx.db.query("emails")
          .withIndex("by_postmark_message_id", q => q.eq("postmarkMessageId", args.postmarkMessageId))
          .unique();
      }
      if (!email) return; // Email not found, silently skip

      // 2. Update delivery status fields (existing logic unchanged)
      const updates: Record<string, any> = {};
      if (args.eventType === "delivered") { updates.deliveryStatus = "delivered"; updates.deliveredAt = args.timestamp; }
      else if (args.eventType === "opened") { updates.deliveryStatus = "opened"; updates.openedAt = args.timestamp; }
      else if (args.eventType === "clicked") { updates.deliveryStatus = "clicked"; updates.clickedAt = args.timestamp; }
      else if (args.eventType === "bounced") { updates.deliveryStatus = "bounced"; updates.bounceReason = args.reason; }
      else if (args.eventType === "complained") { updates.deliveryStatus = "complained"; updates.complaintReason = args.reason; }
      await ctx.db.patch(email._id, updates);

      // 3. Update broadcast aggregate counts (existing logic)
      if (email.broadcastId) {
        await ctx.runMutation(internal.emails.updateBroadcastAggregateCount, {
          broadcastId: email.broadcastId, eventType: args.eventType,
        });
      }

      // 4. Audit log for bounces/complaints (existing logic)
      if (args.eventType === "bounced" || args.eventType === "complained") {
        await ctx.db.insert("auditLogs", { /* existing audit fields */ });
      }
    }
    ```
  - Action: Update Resend webhook caller in `convex/http.ts` (line 693) to pass `provider: "resend"`

- [x] **Task 5: Create `convex/emailService.ts` — dual-path email abstraction**
  - File: `convex/emailService.ts` (NEW)
  - Action: Create `"use node"` file with:
    1. Static imports at top (dynamic imports not supported):
       ```typescript
       import Postmark from "postmark";
       import { Resend } from "@convex-dev/resend";
       import { components } from "./_generated/api";
       import { internal } from "./_generated/api";
       import { v } from "convex/values";
       import { internalAction, internalMutation, ActionCtx, MutationCtx } from "./_generated/server";
       ```
    2. Centralized from-address construction:
       ```typescript
       const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;
       if (!EMAIL_DOMAIN) throw new Error("EMAIL_DOMAIN env var is required");
       const FROM_NAME = process.env.EMAIL_FROM_NAME || "Salig Affiliate";
       export const getFromAddress = (prefix: string) => `${FROM_NAME} <${prefix}@${EMAIL_DOMAIN}>`;
       ```
    3. Shared provider validation:
       ```typescript
       function getProvider(): "resend" | "postmark" {
         const provider = process.env.EMAIL_PROVIDER;
         if (provider !== "resend" && provider !== "postmark") {
           throw new Error(`EMAIL_PROVIDER must be 'resend' or 'postmark', got '${provider}'`);
         }
         return provider;
       }
       ```
    4. `sendEmail` internalAction (full provider routing):
       ```typescript
       export const sendEmail = internalAction({
         args: {
           from: v.string(),
           to: v.union(v.string(), v.array(v.string())),
           subject: v.string(),
           html: v.string(),
           replyTo: v.optional(v.string()),
           messageStream: v.optional(v.string()),
           tracking: v.optional(v.object({
             tenantId: v.id("tenants"),
             type: v.string(),
             affiliateId: v.optional(v.id("affiliates")),
             broadcastId: v.optional(v.id("broadcastEmails")),
           })),
         },
         returns: v.object({
           success: v.boolean(),
           provider: v.string(),
           messageId: v.optional(v.string()),
         }),
         handler: async (ctx, args) => {
           const provider = getProvider();
           try {
             let messageId: string | undefined;
             if (provider === "postmark") {
               const token = process.env.POSTMARK_SERVER_TOKEN;
               if (!token) throw new Error("POSTMARK_SERVER_TOKEN env var is required when EMAIL_PROVIDER=postmark");
               const client = new Postmark.ServerClient(token);
               const result = await client.sendEmail({
                 From: args.from,
                 To: Array.isArray(args.to) ? args.to.join(",") : args.to,
                 Subject: args.subject,
                 HtmlBody: args.html,
                 ReplyTo: args.replyTo,
                 MessageStream: args.messageStream || "outbound",
               });
               messageId = result.MessageID;
             } else {
               const resend = new Resend(components.resend, {
                 testMode: process.env.EMAIL_TEST_MODE === "true",
               });
               const castCtx = ctx as unknown as MutationCtx; // @convex-dev/resend requires MutationCtx
               const result = await resend.sendEmail(castCtx, {
                 from: args.from,
                 to: Array.isArray(args.to) ? args.to.join(",") : args.to,
                 subject: args.subject,
                 html: args.html,
                 reply_to: args.replyTo,
               });
               messageId = (result as unknown as { id?: string })?.id;
             }
             if (args.tracking) {
               await ctx.runMutation(internal.emails.trackEmailSent, {
                 tenantId: args.tracking.tenantId,
                 type: args.tracking.type,
                 recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
                 subject: args.subject,
                 status: "sent",
                 broadcastId: args.tracking.broadcastId,
                 affiliateId: args.tracking.affiliateId,
                 provider,
                 resendMessageId: provider === "resend" ? messageId : undefined,
                 postmarkMessageId: provider === "postmark" ? messageId : undefined,
               });
             }
             return { success: true, provider, messageId };
           } catch (error) {
             console.error(`[emailService] ${provider} send failed:`, error);
             if (args.tracking) {
               await ctx.runMutation(internal.emails.trackEmailSent, {
                 tenantId: args.tracking.tenantId,
                 type: args.tracking.type,
                 recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
                 subject: args.subject,
                 status: "failed",
                 errorMessage: error instanceof Error ? error.message : String(error),
                 broadcastId: args.tracking.broadcastId,
                 affiliateId: args.tracking.affiliateId,
                 provider,
               });
             }
             return { success: false, provider, messageId: undefined };
           }
         },
       });
       ```
    5. `sendEmailFromMutation` internalMutation (Resend-only, inline, awaitable):
       ```typescript
       export const sendEmailFromMutation = internalMutation({
         args: {
           from: v.string(),
           to: v.union(v.string(), v.array(v.string())),
           subject: v.string(),
           html: v.string(),
           replyTo: v.optional(v.string()),
           tracking: v.optional(v.object({
             tenantId: v.id("tenants"),
             type: v.string(),
             affiliateId: v.optional(v.id("affiliates")),
             broadcastId: v.optional(v.id("broadcastEmails")),
           })),
         },
         returns: v.object({
           success: v.boolean(),
           provider: v.string(),
           messageId: v.optional(v.string()),
         }),
         handler: async (ctx, args) => {
           const provider = getProvider();
           if (provider === "postmark") {
             throw new Error(
               "Postmark emails cannot be sent from mutation context. " +
               "Use sendEmail action via ctx.scheduler.runAfter(0, internal.emailService.sendEmail, ...) instead."
             );
           }
           // Resend component works in mutation context
           const resend = new Resend(components.resend, {
             testMode: process.env.EMAIL_TEST_MODE === "true",
           });
           try {
             const result = await resend.sendEmail(ctx, {
               from: args.from,
               to: Array.isArray(args.to) ? args.to.join(",") : args.to,
               subject: args.subject,
               html: args.html,
               reply_to: args.replyTo,
             });
             const messageId = (result as unknown as { id?: string })?.id;
             if (args.tracking) {
               await ctx.runMutation(internal.emails.trackEmailSent, {
                 tenantId: args.tracking.tenantId,
                 type: args.tracking.type,
                 recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
                 subject: args.subject,
                 status: "sent",
                 broadcastId: args.tracking.broadcastId,
                 affiliateId: args.tracking.affiliateId,
                 provider,
                 resendMessageId: messageId,
               });
             }
             return { success: true, provider, messageId };
           } catch (error) {
             console.error("[emailService] Resend send from mutation failed:", error);
             if (args.tracking) {
               await ctx.runMutation(internal.emails.trackEmailSent, {
                 tenantId: args.tracking.tenantId,
                 type: args.tracking.type,
                 recipientEmail: Array.isArray(args.to) ? args.to[0] : args.to,
                 subject: args.subject,
                 status: "failed",
                 errorMessage: error instanceof Error ? error.message : String(error),
                 broadcastId: args.tracking.broadcastId,
                 affiliateId: args.tracking.affiliateId,
                 provider,
               });
             }
             return { success: false, provider, messageId: undefined };
           }
         },
       });
       ```
  - Notes: The `ctx as unknown as MutationCtx` cast in `sendEmail` is required because `@convex-dev/resend`'s component type expects `MutationCtx`. This is the same pattern already used in the existing codebase (`email.tsx` L507). The `EMAIL_TEST_MODE` Convex env var controls test mode — more reliable than `process.env.NODE_ENV`.

- [x] **Task 6: Add `POST /webhooks/postmark` handler**
  - File: `convex/http.ts`
  - Action: Add new route:
    - `POST /webhooks/postmark` — `httpAction`
    - `OPTIONS /webhooks/postmark` — preflight (same CORS as Resend webhook)
    - Auth: Validate `X-Webhook-Secret` header against `POSTMARK_WEBHOOK_SECRET`
    - Store raw payload: `ctx.runMutation(internal.emails.storeRawWebhook, { source: "postmark", eventId: ${payload.MessageID}_${payload.RecordType}, eventType: payload.RecordType, rawPayload: rawBody, signatureValid: true/false })`
    - Parse `RecordType` and map: `{ Delivery: "delivered", Open: "opened", Click: "clicked", Bounce: "bounced", SpamComplaint: "complained" }`
    - Validate: unknown `RecordType` → return 200
    - Extract fields **per event type** (fixed F8):
      - Message ID: `payload.MessageID`
      - Timestamp:
        - Delivery: `new Date(payload.DeliveredAt).getTime()`
        - Bounce: `new Date(payload.BouncedAt).getTime()`
        - SpamComplaint: `new Date(payload.BouncedAt).getTime()`
        - Open: `new Date(payload.ReceivedAt).getTime()`
        - Click: `new Date(payload.ReceivedAt).getTime()`
      - Reason: `payload.Details || payload.Description` (for bounces/complaints)
    - Call: `ctx.runMutation(internal.emails.updateEmailDeliveryStatus, { provider: "postmark", postmarkMessageId: payload.MessageID, eventType, timestamp, reason })`
    - Error handling: catch all, return 200, log error

- [x] **Task 7: Add `storeRawWebhook` internalMutation**
  - File: `convex/emails.tsx`
  - Action: Add internalMutation (stores raw webhook payload in `rawWebhooks` table with `source: "postmark"`, `status: "processed"`)

- [x] **Task 8: Remove dead code (partial — PR1 only)**
  - File: `convex/emails.tsx` (line 204) — delete `getEmailByResendMessageId` internalQuery (never called)
  - **DO NOT** delete `_logEmailSentInternal` from `tenants.ts` yet — moved to PR3 Task 15 to avoid broken reference window
  - Notes: Verify no callers reference `getEmailByResendMessageId` via grep before deleting.

- [x] **Task 9: Update Resend webhook caller**
  - File: `convex/http.ts` (line 693)
  - Action: Pass `provider: "resend"` to `updateEmailDeliveryStatus`

#### PR2: Core Email Files Migration

- [x] **Task 10: Migrate `convex/emails.tsx` — 4 send sites**
  - File: `convex/emails.tsx`
  - Action: For each of the 4 internalAction functions (`sendFraudAlertEmail`, `sendCommissionConfirmedEmail`, `sendPayoutSentEmail`, `sendNewReferralAlertEmail`):
    1. Replace Resend imports + instantiation with `import { sendEmail, getFromAddress } from "./emailService"`
    2. Replace `resend.sendEmail(ctx, {...})` + `trackEmailSent` with `ctx.runAction(internal.emailService.sendEmail, { from, to, subject, html, tracking })`
    3. Remove `trackEmailSent` calls (success + failure), Resend message ID extraction
    4. Import `getFromAddress` from `./emailService`, remove local `EMAIL_DOMAIN`/`FROM_NAME`
    5. Keep retry scheduling via `ctx.scheduler.runAfter`
  - Notes: All 4 are already internalActions — cleanest migration. Template for others.

- [x] **Task 11: Migrate `convex/broadcasts.tsx` — 2 send sites**
  - File: `convex/broadcasts.tsx`
  - Action:
    1. **Resend path (default, preserves batching):** Replace `resend.sendEmail(ctx, {...})` in `sendSingleBroadcastEmail` with `await sendEmailFromMutation(ctx, { from, to, subject, html, tracking })`. The batch loop, `Promise.allSettled`, and count updates remain UNCHANGED.
    2. **Postmark fallback path:** Before the batch loop, check `EMAIL_PROVIDER` via a query. If `"postmark"`, skip the batch loop and instead schedule individual sends via `ctx.scheduler.runAfter(0, internal.emailService.sendEmail, ...)` for each affiliate. Add a `finalizeBroadcastStatus` internalAction scheduled ~5 minutes after broadcast start to check aggregate counts and set final status.
    3. Migrate `retryFailedBroadcastEmail` (internalAction): replace with `ctx.runAction(internal.emailService.sendEmail, ...)`
    4. Remove Resend imports, replace with `sendEmailFromMutation`, `sendEmail`, `getFromAddress` from `./emailService`
  - Notes: This is the key architectural decision — Resend broadcasts keep full batch fidelity. Postmark broadcasts are degraded (individual scheduling, delayed finalization). This is an acceptable trade-off since Postmark is opt-in and the `EMAIL_PROVIDER=resend` default preserves existing behavior.

#### PR3: All Remaining Files + Cleanup

- [x] **Task 12: Migrate `convex/email.tsx` — 15 send sites**
  - File: `convex/email.tsx`
  - Action: Plain async helpers stay as regular functions (callable from mutations) but use `sendEmailFromMutation` internally:
  
  **Group A — 4 Better Auth helpers (untracked):**
  - `sendEmailVerification`, `sendOTPVerification`, `sendMagicLink`, `sendResetPassword`: Replace `resend.sendEmail(ctx, {...})` with `await sendEmailFromMutation(ctx, { from, to, subject, html })`. No `tracking` param. Stay as plain async helpers.
  
  **Group B — 4 billing helpers (add tracking):**
  - `sendUpgradeConfirmation`, `sendDowngradeConfirmation`, `sendCancellationConfirmation`: Replace with `await sendEmailFromMutation(ctx, { from, to, subject, html, tracking: { tenantId, type: "billing_..." } })`. Stay as plain async helpers.
  - `sendSubscriptionDeletionReminder` (**renamed from `sendDeletionReminder`**): Same pattern. Update callers in `subscriptions.ts` to use new name.
  
  **Group C — 3 affiliate helpers:**
  - `sendAffiliateWelcomeEmail`: Replace `resend.sendEmail()` + manual insert with `await sendEmailFromMutation(ctx, { from, to, subject, html, tracking: {...} })`. Remove manual `ctx.db.insert("emails", ...)`.
  - `sendAffiliateWelcomeEmailWithRetry` (internalAction): Replace with `ctx.runAction(internal.emailService.sendEmail, ...)`.
  - `sendNewAffiliateNotificationEmail`: Replace with `await sendEmailFromMutation(ctx, { from, to, subject, html, tracking: {...} })`.
  
  **Group D — 4 action functions (fix pre-tracking bug):**
  - `sendApprovalEmail`, `sendRejectionEmail`, `sendSuspensionEmail`, `sendReactivationEmail`: Replace Resend + pre-tracking `trackEmailSent` with single `ctx.runAction(internal.emailService.sendEmail, { from, to, subject, html, tracking: {...} })`. **Fixes the pre-tracking bug.**
  
  **Cleanup:** Remove exported `resend` instance, Resend imports, `new Resend(...)`, local `EMAIL_DOMAIN`/`FROM_NAME`/`getFromAddress`.

- [x] **Task 13: Migrate `convex/users.ts` — 1 send site**
  - File: `convex/users.ts`
  - Action: Replace `resend.sendEmail()` + `trackEmailSent` with `ctx.runAction(internal.emailService.sendEmail, { from, to, subject, html, tracking: {...} })`. Replace hardcoded domain with `getFromAddress("notifications")`.

- [x] **Task 14: Migrate `convex/teamInvitations.ts` — 3 send sites**
  - File: `convex/teamInvitations.ts`
  - Action: These are internalMutations called via `ctx.scheduler.runAfter(0, ...)`. Replace `resend.sendEmail()` + manual tracking with `await sendEmailFromMutation(ctx, { from, to, subject, html, tracking: {...} })`. Replace all hardcoded `"boboddy.business"` with `getFromAddress(prefix)`. Remove Resend imports.
  - Notes: These functions stay as internalMutations — no conversion needed. `sendEmailFromMutation` works in mutation context for Resend.

- [x] **Task 15: Migrate `convex/tenants.ts` — 2 send sites + delete dead code**
  - File: `convex/tenants.ts`
  - Action:
    1. `sendDomainChangeNotification` (internalMutation): Replace `resend.sendEmail()` with `await sendEmailFromMutation(ctx, { from, to, subject, html, tracking: { tenantId, type: "domain_change_notification" } })`. Replace hardcoded domain.
    2. `sendTenantDeletionReminder` (**renamed from `sendDeletionReminder`**, internalAction): Replace `resend.sendEmail()` + `_logEmailSentInternal()` with `ctx.runAction(internal.emailService.sendEmail, { from, to, subject, html, tracking: { tenantId, type: "tenant_deletion_reminder" } })`. Replace hardcoded domain.
    3. **DELETE `_logEmailSentInternal`** internalMutation (L1437) — no longer called after step 2.
    4. Update caller in `checkAndSendDeletionReminders` (L1506) to use new function name `sendTenantDeletionReminder`.
    5. Remove Resend imports.
  - Notes: This is where `_logEmailSentInternal` is deleted (PR3, not PR1) to avoid the broken reference window identified in adversarial review.

- [x] **Task 16: Migrate `convex/affiliateAuth.ts`**
  - File: `convex/affiliateAuth.ts`
  - Action:
    1. Remove manual `ctx.db.insert("emails", ...)` at line 456 — tracking now handled by abstraction
    2. Update calls to `sendAffiliateWelcomeEmail` (imported from `./email`) and `sendNewAffiliateNotificationEmail` (imported from `./email`) — these now use `sendEmailFromMutation` internally, so the call pattern stays the same (they're still plain async callable functions). Just import `getFromAddress` from `./emailService` if needed.
    3. If these helpers now accept tracking params, pass appropriate tracking args.
  - Notes: The key insight from adversarial review — since email.tsx helpers stay as plain async functions (using `sendEmailFromMutation` internally), callers like `affiliateAuth.ts` DON'T need to change their invocation patterns. They just benefit from unified tracking.

- [x] **Task 17: Migrate `convex/subscriptions.ts`**
  - File: `convex/subscriptions.ts`
  - Action:
    1. Remove manual `ctx.db.insert("emails", ...)` at line 378
    2. Update calls to `sendUpgradeConfirmation`, `sendDowngradeConfirmation`, `sendCancellationConfirmation`, `sendSubscriptionDeletionReminder` (imported from `./email`) — these are now plain async functions using `sendEmailFromMutation` internally. Call pattern stays the same.
    3. If these helpers now accept tracking params, pass appropriate tracking args.
    4. Remove Resend imports if any.
  - Notes: Same as Task 16 — caller patterns unchanged since helpers stay callable from mutation context.

- [x] **Task 18: Migrate `convex/admin/tier_configs.ts`**
  - File: `convex/admin/tier_configs.ts` (line 764)
  - Action: Replace manual `ctx.db.insert("emails", ...)` with passing `tracking` param to the emailService abstraction call.

- [x] **Task 19: Migration verification — grep audit**
  - Files: All files in `convex/`
  - Action: Run grep searches and verify ZERO results:
    - `resend\.sendEmail` — no direct Resend send calls
    - `new Resend\(` — no Resend instantiation
    - `boboddy\.business` — no hardcoded domains
    - `_logEmailSentInternal` — dead code removed
    - `getEmailByResendMessageId` — dead code removed
    - `sendDeletionReminder` — naming collision resolved (both renamed)
  - Action: Verify `import { Resend }` only exists in `convex/emailService.ts`

#### Post-Migration (Deployment)

- [x] **Task 20: Set Convex environment variables**
  - Action:
    ```bash
    pnpm convex env set EMAIL_PROVIDER resend
    pnpm convex env set EMAIL_TEST_MODE false
    pnpm convex env set POSTMARK_SERVER_TOKEN <token>  # when ready
    pnpm convex env set POSTMARK_WEBHOOK_SECRET <secret>  # when ready
    ```

- [x] **Task 21: Update project-context.md**
  - File: `_bmad-output/project-context.md`
  - Action: Update "Email Rules" section with dual-path abstraction pattern.

### Acceptance Criteria

- [ ] **AC 1:** Given `EMAIL_PROVIDER=resend` is set, when any of the 27 email send sites sends an email, then the email is delivered via the Resend API and an `emails` table row is created with `provider: "resend"` and `resendMessageId` populated.
- [ ] **AC 2:** Given `EMAIL_PROVIDER=postmark` and `POSTMARK_SERVER_TOKEN` are set, when any email send site sends an email via `sendEmail` (action path), then the email is delivered via the Postmark API with `provider: "postmark"` and `postmarkMessageId` populated.
- [ ] **AC 3:** Given `EMAIL_PROVIDER=postmark`, when a mutation-context caller (Better Auth callback, broadcast batch loop, billing mutation) attempts to send via `sendEmailFromMutation`, then a clear error is thrown: "Postmark emails cannot be sent from mutation context."
- [ ] **AC 4:** Given `EMAIL_PROVIDER=postmark` but `POSTMARK_SERVER_TOKEN` is NOT set, when an email send is attempted, then a clear error is thrown indicating the missing token.
- [ ] **AC 5:** Given `EMAIL_PROVIDER` is invalid (e.g., `"sendgrid"`), when a send is attempted, then a clear error lists valid options.
- [ ] **AC 6:** Given an email is sent with `tracking`, when send succeeds, then `trackEmailSent` is called with `status: "sent"` and appropriate `resendMessageId` or `postmarkMessageId`.
- [ ] **AC 7:** Given an email send fails, when tracking was requested, then `trackEmailSent` is called with `status: "failed"` and `errorMessage`.
- [ ] **AC 8:** Given an email is sent without `tracking`, then no row is created in the `emails` table.
- [ ] **AC 9:** Given a Postmark webhook POST with `RecordType: "Delivery"` and valid auth, then `deliveryStatus` updates to `"delivered"` and `deliveredAt` is set.
- [ ] **AC 10:** Given a Postmark webhook POST with invalid `X-Webhook-Secret`, then 401 is returned.
- [ ] **AC 11:** Given a Postmark webhook POST with unknown `RecordType`, then 200 is returned, no DB changes.
- [ ] **AC 12:** Given a Postmark webhook POST, then raw payload is stored in `rawWebhooks` with `source: "postmark"` and unique `eventId` (includes `RecordType`).
- [ ] **AC 13:** Given the existing Resend webhook, after migration, delivery status updates correctly (regression check).
- [ ] **AC 14:** Given `grep -r "resend\.sendEmail" convex/`, then zero results.
- [ ] **AC 15:** Given `grep -r "boboddy\.business" convex/`, then zero results.
- [ ] **AC 16:** Given `grep -r "getEmailByResendMessageId\|_logEmailSentInternal" convex/`, then zero results.
- [ ] **AC 17:** Given `grep -r "sendDeletionReminder" convex/`, then zero results (both renamed).
- [ ] **AC 18:** Given the 4 action functions in `email.tsx`, when send fails, then only ONE `emails` row with `status: "failed"` (no false "sent" row).
- [ ] **AC 19:** Given `EMAIL_DOMAIN` not set, then a clear error is thrown.
- [ ] **AC 20:** Given `sendEmail` returns `{ success: true, provider: "postmark", messageId: "abc123" }`, then callers can access the messageId for logging.
- [ ] **AC 21:** Given broadcast sending with Resend, then `Promise.allSettled` batch loop works (existing behavior preserved). Given broadcast sending with Postmark, then individual sends are scheduled via `ctx.scheduler.runAfter`.

## Additional Context

### Dependencies

- `postmark` npm package (latest stable, pin version)
- No Convex component exists for Postmark; must use SDK directly in actions
- `@convex-dev/resend` remains (Resend path uses Convex component)

### Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `EMAIL_PROVIDER` | Yes | — | `resend` or `postmark` |
| `POSTMARK_SERVER_TOKEN` | If provider=postmark | — | Postmark API server token |
| `POSTMARK_WEBHOOK_SECRET` | If using Postmark webhooks | — | Secret for `X-Webhook-Secret` header validation |
| `EMAIL_TEST_MODE` | No | `"false"` | Resend test mode (`"true"` enables) |

### Postmark Webhook Event Mapping

| Postmark `RecordType` | Maps To | Timestamp Field |
|---|---|---|
| `Delivery` | `delivered` | `DeliveredAt` |
| `Open` | `opened` | `ReceivedAt` |
| `Click` | `clicked` | `ReceivedAt` |
| `Bounce` | `bounced` | `BouncedAt` |
| `SpamComplaint` | `complained` | `BouncedAt` |

### Postmark Webhook Payload Structures

**Delivery:**
```json
{ "RecordType": "Delivery", "MessageID": "uuid", "Recipient": "john@example.com", "DeliveredAt": "2019-11-05T16:33:54Z", "Details": "...", "MessageStream": "outbound" }
```

**Open:**
```json
{ "RecordType": "Open", "MessageID": "uuid", "Recipient": "john@example.com", "ReceivedAt": "2019-11-05T16:33:54Z", "Client": { "Name": "Chrome" } }
```

**Click:**
```json
{ "RecordType": "Click", "MessageID": "uuid", "Recipient": "john@example.com", "ReceivedAt": "2019-11-05T16:33:54Z", "OriginalLink": "https://example.com" }
```

**Bounce:**
```json
{ "RecordType": "Bounce", "MessageID": "uuid", "Email": "john@example.com", "BouncedAt": "2019-11-05T16:33:54Z", "Details": "Unknown user" }
```

**SpamComplaint:**
```json
{ "RecordType": "SpamComplaint", "MessageID": "uuid", "Email": "john@example.com", "BouncedAt": "2019-11-05T16:33:54Z", "Details": "Marked as spam" }
```

### Key Differences Between Webhook Handlers

| Aspect | Resend (existing) | Postmark (new) |
|---|---|---|
| Auth | HMAC-SHA256 via `x-resend-signature` | Custom header `X-Webhook-Secret` |
| Secret env var | `RESEND_WEBHOOK_SECRET` | `POSTMARK_WEBHOOK_SECRET` |
| Message ID field | `data.email_id` | `MessageID` |
| Event type field | `type` | `RecordType` |
| Timestamp field | `data.created_at` | Event-specific (`DeliveredAt`, `ReceivedAt`, `BouncedAt`) |
| Raw payload storage | NOT stored | Store in `rawWebhooks` table |

### Testing Strategy

**Note:** No production test suite exists. Testing is manual and verification-based.

#### Manual Testing Steps

**Post-PR1 (Abstraction Foundation):**
1. Set `EMAIL_PROVIDER=resend` — trigger password reset. Verify Resend delivery + `provider: "resend"` in `emails` table.
2. Set `EMAIL_PROVIDER=invalidvalue` — trigger send. Verify clear error.
3. Set `EMAIL_PROVIDER=postmark` without token — verify clear error.
4. Set `EMAIL_PROVIDER=postmark` with valid token — trigger send via action path. Verify Postmark delivery.
5. Set `EMAIL_PROVIDER=postmark`, trigger send via mutation path — verify "cannot be sent from mutation context" error.
6. Test Postmark webhook: curl mock `Delivery` + `Open` + `Click` + `Bounce` + `SpamComplaint` payloads. Verify status updates.
7. Test webhook auth failure (401) and unknown event (200).
8. Test raw webhook storage: query `rawWebhooks` for `source: "postmark"`.
9. Verify Resend webhook still works (regression).

**Post-PR2 (Core Files):**
1. Trigger fraud alert. Verify email + tracking.
2. Trigger commission confirmation. Verify email + tracking.
3. Send broadcast (Resend). Verify batch counts updated in real-time.
4. Send broadcast (Postmark, if available). Verify individual sends + delayed status.

**Post-PR3 (All Remaining):**
1. Send team invitation. Verify no `boboddy.business` in from-address.
2. Change tenant domain. Verify notification.
3. Remove team member. Verify notification.
4. Run grep verification (AC 14-17). Zero results.

#### Automated Verification

```bash
grep -r "resend\.sendEmail" convex/ --include="*.ts" --include="*.tsx"
grep -r "new Resend\(" convex/ --include="*.ts" --include="*.tsx"
grep -r "boboddy\.business" convex/ --include="*.ts" --include="*.tsx"
grep -r "getEmailByResendMessageId" convex/ --include="*.ts" --include="*.tsx"
grep -r "_logEmailSentInternal" convex/ --include="*.ts" --include="*.tsx"
grep -r "sendDeletionReminder" convex/ --include="*.ts" --include="*.tsx"
grep -r "from.*@convex-dev/resend" convex/ --include="*.ts" --include="*.tsx"
# Expected: only convex/emailService.ts
```

### Notes

- **Dual-path design** resolves Convex runtime constraint: Postmark SDK needs Node.js (action), Resend component works in mutations.
- **`sendEmailFromMutation`** enables zero-change migration for mutation callers — Better Auth callbacks, broadcast batching, billing mutations all stay as-is when using Resend.
- **Broadcast degradation under Postmark** is documented and acceptable — Postmark is opt-in, default is Resend.
- **Naming collision** resolved: `sendDeletionReminder` → `sendSubscriptionDeletionReminder` (email.tsx) + `sendTenantDeletionReminder` (tenants.ts).
- **Separate `resendMessageId`/`postmarkMessageId`** fields kept (not consolidated) to avoid data migration for existing rows.
- **`ctx as unknown as MutationCtx`** cast required for Resend component in action context — same pattern used in existing codebase.
- **Future considerations**: Adding a third provider requires adding a code path in both `sendEmail` and `sendEmailFromMutation`, plus a webhook handler. The dual-path abstraction is extensible.
- **Known limitation**: Switching `EMAIL_PROVIDER` mid-flight causes queued scheduled actions to use the NEW provider (env var read at execution time). Drain the queue before switching for clean cutover.
- **Adversarial review completed** — 15 findings addressed (4 critical, 5 high, 4 medium, 2 low).
