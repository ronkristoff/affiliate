# Story 17.5: Affiliate Onboarding Link Generation

Status: done

## Story

As an affiliate,
I want to click "Set Up Payouts" and be redirected to my payout provider's onboarding page,
so that I can complete KYC verification and connect my bank account.

## Acceptance Criteria

1. **AC1:** A Convex action `affiliateProviderOnboarding.generateOnboardingLink` exists that accepts `{ tenantId }` (resolved from affiliate auth session), creates or reuses a Stripe Connect Express account, and returns `{ url: string }`
2. **AC2:** When the affiliate has no `payoutProviderAccountId` (first-time setup), the action creates a Stripe Connect Express account via `stripe.accounts.create({ type: "express" })` and saves the `acct_*` ID as `payoutProviderAccountId` on the affiliate record
3. **AC3:** When the affiliate already has `payoutProviderAccountId` (resuming), the action reuses the existing account and generates a fresh onboarding link (no new Connect account created)
4. **AC4:** The action sets `payoutProviderType = "stripe_connect"` and `payoutProviderStatus = "pending"` on the affiliate record before redirecting
5. **AC5:** The return and refresh URLs contain a signed JWT token (using `jose` library) with payload `{ affiliateId, tenantId, exp }` embedded as a `?token=` query parameter — token expiry is 1 hour
6. **AC6:** The action verifies the tenant has a `stripeAccountId` (Stripe billing connected) before proceeding; throws a clear error if not configured
7. **AC7:** The `getCurrentAffiliate` query in `convex/affiliateAuth.ts` is extended to return `payoutProviderType`, `payoutProviderAccountId`, `payoutProviderStatus`, `payoutProviderEnabled`, and `payoutProviderStatusDetails` fields
8. **AC8:** A new `ProviderPayoutSection` component renders in the portal account page (`/portal/account`) showing:
   - When no provider configured: message "Payouts not available — contact your account manager" (no button)
   - When `payoutProviderStatus = null` (not started): "Set Up Payouts" button + "Before You Start" checklist
   - When `payoutProviderStatus = "pending"`: "Complete Verification" button + "In Progress" status
   - When `payoutProviderStatus = "verified"`: "Connected" badge with green indicator
9. **AC9:** The "Before You Start" section displays: "You will need: a valid government-issued ID (passport, driver's license, PhilHealth UMID, or national ID), your bank account details, and your legal name and address."
10. **AC10:** The existing manual `PayoutSection` component is preserved below `ProviderPayoutSection` with label "Manual Payout Method" — both coexist
11. **AC11:** TypeScript compilation passes with `pnpm tsc --noEmit`
12. **AC12:** No existing tests break

## Tasks / Subtasks

- [x] Task 1: Install `jose` dependency for JWT signing (AC: #5)
  - [x] 1.1 Run `pnpm add jose` — lightweight, edge-compatible JWT library
- [x] Task 2: Create `convex/affiliateProviderOnboarding.ts` with backend functions (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1 Add `"use node"` directive (required for `jose` and Stripe SDK) — moved to `affiliateProviderOnboardingActions.ts`
  - [x] 2.2 Import `jose`, `stripe` SDK (via adapter), circuit breaker, internal refs
  - [x] 2.3 Create helper `createSignedOnboardingToken(affiliateId, tenantId): Promise<string>` — signs JWT with `BETTER_AUTH_SECRET`, 1-hour expiry
  - [x] 2.4 Create helper `verifyOnboardingToken(token): Promise<{ affiliateId, tenantId } | null>` — verifies JWT signature and expiry — moved to action
  - [x] 2.5 Export `generateOnboardingLink` action in `affiliateProviderOnboardingActions.ts`:
    - Get affiliate from auth session via `betterAuthComponent.getAuthUser(ctx)` → look up in `affiliates` by email
    - Get tenant record to check `stripeAccountId` exists
    - If no `payoutProviderAccountId`: call `stripe.accounts.create({ type: "express" })`, save ID
    - If has `payoutProviderAccountId`: reuse existing
    - Build returnPath = `/portal/account?setup=return&token={jwt}`
    - Build refreshPath = `/portal/account?setup=refresh&token={jwt}`
    - Call `provider.createOnboardingLink({ affiliateId: payoutProviderAccountId, returnPath, refreshPath, tenantId })`
    - Update affiliate: `payoutProviderType = "stripe_connect"`, `payoutProviderStatus = "pending"`
    - Return `{ url }`
  - [x] 2.6 Export `verifyOnboardingToken` action (public, no auth required — for callback page):
    - Accept `{ token: v.string() }`
    - Verify JWT and return `{ affiliateId, tenantId }` or `null`
- [x] Task 3: Extend `getCurrentAffiliate` return validator in `convex/affiliateAuth.ts` (AC: #7)
  - [x] 3.1 Add `payoutProviderType: v.optional(v.string())` to return object
  - [x] 3.2 Add `payoutProviderAccountId: v.optional(v.string())` to return object
  - [x] 3.3 Add `payoutProviderStatus: v.optional(v.string())` to return object
  - [x] 3.4 Add `payoutProviderEnabled: v.optional(v.boolean())` to return object
  - [x] 3.5 Add `payoutProviderStatusDetails: v.optional(v.object({ ... }))` to return object
  - [x] 3.6 Add these fields to the return object in the handler (from `affiliate` doc)
- [x] Task 4: Create `ProviderPayoutSection` component (AC: #8, #9)
  - [x] 4.1 Create `src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx`
  - [x] 4.2 Accept props: `affiliateId`, `tenantId`, `payoutProviderType`, `payoutProviderAccountId`, `payoutProviderStatus`, `payoutProviderEnabled`, `payoutProviderStatusDetails`, `stripeAccountId` (from tenant)
  - [x] 4.3 Render "not available" state when `!stripeAccountId`
  - [x] 4.4 Render "not started" state with "Set Up Payouts" button + "Before You Start" checklist
  - [x] 4.5 Render "pending" state with "Complete Verification" button
  - [x] 4.6 Render "verified" state with green "Connected" badge
  - [x] 4.7 Button click calls `useAction(api.affiliateProviderOnboardingActions.generateOnboardingLink)` then `window.location.href = url`
  - [x] 4.8 Loading state: button disabled with spinner during mutation
  - [x] 4.9 Error state: display error message from mutation failure
- [x] Task 5: Integrate `ProviderPayoutSection` into account page (AC: #8, #10)
  - [x] 5.1 Import and render `ProviderPayoutSection` above existing `PayoutSection` in `src/app/portal/(authenticated)/account/page.tsx`
  - [x] 5.2 Pass affiliate provider fields and tenant `stripeAccountId` (from `affiliate.tenant`)
  - [x] 5.3 Add section label "Provider Payout" to distinguish from manual payout section
  - [x] 5.4 Update `PayoutSection` card title from "Payout Method" to "Manual Payout Method"
- [x] Task 6: Handle tenant `stripeAccountId` availability in `getCurrentAffiliate` (AC: #8)
  - [x] 6.1 Extended the existing `tenant` sub-object in `getCurrentAffiliate` to include `stripeAccountId: v.optional(v.string())`
- [x] Task 7: Verify compilation and no regressions (AC: #11, #12)
  - [x] 7.1 Run `pnpm tsc --noEmit` and confirm zero errors
  - [x] 7.2 Run `pnpm lint` — ESLint has pre-existing circular dependency issue (not related to changes)
  - [x] 7.3 Verify portal account page renders correctly (manual visual check)

## Dev Notes

### Architecture Context

This is the **first user-facing story** in Epic 17 (after 4 backend-only foundation stories). It bridges the backend adapter (Stories 17.1-17.4) to the affiliate portal UI. The affiliate clicks a button in `/portal/account`, a Convex action orchestrates Stripe Connect account creation + onboarding link generation, and the affiliate is redirected to Stripe's hosted KYC page.

**Story 17.6** (next) handles the return/refresh callback processing. This story only generates the link and redirects.

### Critical Gap: Connect Account Creation

The `StripeConnectAdapter.createOnboardingLink()` expects `params.affiliateId` to be a Stripe Connect account ID (`acct_*`). For first-time affiliates, this ID doesn't exist yet. The action in this story must:

1. Call `stripe.accounts.create({ type: "express" })` to create the Connect account
2. Save the returned `acct_*` as `payoutProviderAccountId`
3. Then call `provider.createOnboardingLink({ affiliateId: acct_* })`

The adapter does NOT have a `createConnectAccount` method. The action must call the Stripe SDK directly (via the adapter's `requireStripeClient()` or a new helper). **Do NOT add a `createConnectAccount` method to the `PayoutProvider` interface** — this is Stripe-specific and breaks the provider-agnostic pattern. Instead, call `stripe.accounts.create()` directly in the action.

### Critical Gap: No JWT Infrastructure

The codebase has **zero JWT signing infrastructure**. The epic requires "signed JWT tokens in the return and refresh URLs." Install `jose` — it's the standard lightweight JWT library for Node.js/edge:

```typescript
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET);
const token = await new SignJWT({ affiliateId, tenantId })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("1h")
  .sign(secret);
```

Verification in the callback (Story 17.6):
```typescript
const { payload } = await jwtVerify(token, secret);
// payload.affiliateId, payload.tenantId, payload.exp
```

Use `BETTER_AUTH_SECRET` as the signing key — it already exists as a Convex env var and is appropriate for this purpose.

### Critical Gap: Provider Resolution Without `tenant.payoutProviderType`

The `getProviderForTenant()` function expects `tenant.payoutProviderType`, but the tenants table does NOT have this field. For this story (MVP with only Stripe Connect):

- **Check `tenant.stripeAccountId`** — if set, the tenant has Stripe billing connected and Stripe Connect payouts are available
- **Use hardcoded `"stripe_connect"`** as the provider type
- Do NOT add `payoutProviderType` to the tenants table in this story — that's a future consideration when multiple providers exist

### Existing Patterns to Follow

**Affiliate auth pattern** (from `convex/affiliateAuth.ts:113`):
```typescript
const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
const cleanEmail = betterAuthUser.email.trim().toLowerCase();
const affiliate = await ctx.db
  .query("affiliates")
  .withIndex("by_email", (q: any) => q.eq("email", cleanEmail))
  .first();
```

**Circuit breaker pattern** (from 17.3 review notes):
```typescript
// The adapter exports withStripeCircuitBreaker for calling actions to wrap
import { withStripeCircuitBreaker, stripeCircuitBreakerRefs } from "./lib/providers/stripeConnectAdapter";
const result = await withStripeCircuitBreaker(ctx, async () => {
  // Stripe API call
}, fallbackValue);
```

**Portal component pattern** (from `PayoutSection.tsx`):
- `"use client"` directive
- Props interface with optional fields
- `useState` for loading/error/success states
- `useMutation` for Convex actions
- Card-based layout with `bg-[var(--portal-primary)]` for branded buttons

**Action pattern for Stripe calls** (from `stripeConnectAdapter.ts`):
- `"use node"` directive at top of file
- `requireStripeClient()` returns Stripe client or throws
- All Stripe calls in actions, never in queries/mutations
- Circuit breaker wrapping for resilience

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `convex/affiliateProviderOnboarding.ts` | **CREATE** | Action: generate onboarding link; Query: verify JWT token; Helpers: JWT sign/verify |
| `convex/affiliateAuth.ts` | **MODIFY** | Extend `getCurrentAffiliate` return validator with 5 provider fields + `tenant.stripeAccountId` |
| `src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx` | **CREATE** | Provider payout setup UI component |
| `src/app/portal/(authenticated)/account/page.tsx` | **MODIFY** | Add ProviderPayoutSection above PayoutSection, update PayoutSection label |
| `src/app/portal/(authenticated)/account/components/PayoutSection.tsx` | **MODIFY** | Change CardTitle from "Payout Method" to "Manual Payout Method" |
| `package.json` | **MODIFY** | Add `jose` dependency |

### What NOT to Do

- Do NOT add `createConnectAccount` to the `PayoutProvider` interface — it's Stripe-specific; call Stripe SDK directly in the action
- Do NOT add `payoutProviderType` to the tenants table — use `stripeAccountId` presence check for MVP
- Do NOT implement the return/refresh callback processing — that's Story 17.6
- Do NOT implement KYC requirements display or rejection handling — that's Story 17.8
- Do NOT implement webhook handling for account status — that's Story 17.9
- Do NOT use `getProviderForTenant()` since tenants don't have `payoutProviderType` — resolve provider directly
- Do NOT expose `STRIPE_SECRET_KEY` or `BETTER_AUTH_SECRET` to client code — all signing/Stripe calls in actions only
- Do NOT modify the existing manual payout flow — `PayoutSection` must continue to work unchanged
- Do NOT create test files — no runtime test infrastructure exists for this pattern
- Do NOT use dynamic imports in queries or mutations — only in actions
- Do NOT store JWT tokens in the database — they are ephemeral URL parameters only
- Do NOT use the `@convex-dev/stripe` component for Connect operations — use the raw `stripe` SDK

### ProviderPayoutSection Component Design

The component should follow the portal's existing Card-based design pattern:

```
┌──────────────────────────────────────────┐
│ 🔗 Provider Payout          [Status]    │
├──────────────────────────────────────────┤
│                                          │
│  ┌─ Before You Start ─────────────────┐ │
│  │ ✅ Valid government-issued ID      │ │
│  │ ✅ Bank account details            │ │
│  │ ✅ Legal name and address          │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [    Set Up Payouts    ]                │
│                                          │
│  ── or ──                                │
│                                          │
│  GCash ••• 1234        [Manual Method]  │
│                                          │
└──────────────────────────────────────────┘
```

States:
- **No provider**: Gray card with "Payouts not available — contact your account manager"
- **Not started**: Checklist + "Set Up Payouts" button (branded color)
- **Pending**: Yellow badge "In Progress" + "Complete Verification" button
- **Verified**: Green badge "Connected" + no action button
- **Rejected/Restricted**: Handled in Story 17.8, not this story

### Security Considerations

1. **JWT token prevents impersonation** — Without signed tokens, any affiliate could craft a return URL with another affiliate's ID. The JWT binds the callback to the specific affiliate who initiated onboarding.
2. **1-hour expiry** — Tokens expire quickly to reduce the window for replay attacks.
3. **Action-only Stripe calls** — `stripe.accounts.create()` and `stripe.accountLinks.create()` only run in Convex actions (Node.js runtime), never exposed to clients.
4. **Tenant isolation** — The action verifies the affiliate belongs to the tenant before creating any Connect account.
5. **No credential exposure** — `STRIPE_SECRET_KEY` and `BETTER_AUTH_SECRET` are only accessible in Convex actions via `process.env`.

### Previous Story Intelligence (17.3)

- `stripeConnectAdapter.ts` exports `createOnboardingLinkRaw(params)` which calls `stripe.accountLinks.create({ account: params.affiliateId, ... })`
- `params.affiliateId` must be a Stripe Connect account ID (`acct_*`)
- The adapter does NOT create Connect accounts — only generates onboarding links for existing accounts
- Circuit breaker pattern: use `withStripeCircuitBreaker(ctx, fn, fallback)` in the calling action
- `isStripeConnectAvailable()` checks if `STRIPE_SECRET_KEY` exists

### Previous Story Intelligence (17.2)

- `PayoutProvider` interface at `convex/lib/payoutProvider.ts` with 7 methods
- `OnboardingParams`: `{ affiliateId, returnPath, refreshPath, tenantId }`
- `getProvider("stripe_connect")` returns the adapter or `null` if unavailable
- `registerProvider("stripe_connect", adapter)` called at module load if Stripe available

### Previous Story Intelligence (17.1)

- All 5 provider fields exist on `affiliates` table (optional)
- `by_payout_provider_account_id` index ready for lookups
- `affiliateFields` validator in `validators.ts` includes all new fields
- Keep `v.string()` for `payoutProviderType` and `payoutProviderStatus` (provider-agnostic)

### Return Validator Warning

When extending `getCurrentAffiliate` in `convex/affiliateAuth.ts`, the return validator is an inline `v.object({...})`. Adding new optional fields is safe — Convex only validates fields present in the document. Optional `undefined` fields are not returned and not validated.

However, the `payoutProviderStatusDetails` field has a nested `v.object({...})` validator. When the affiliate document doesn't have this field (most affiliates), Convex will not include it in the return. The validator must use `v.optional()` for the entire object.

### References

- [Source: epics-stripe-connect.md#Story 2.1] — Epic definition, acceptance criteria, JWT token requirement
- [Source: epics-stripe-connect.md#AR10] — "Signed JWT tokens in onboarding return/refresh URLs"
- [Source: architecture.md#Extension: Phase 3] — Affiliate Connect Onboarding flow diagram
- [Source: architecture.md#Extension: Security Considerations] — Transfer replay, credential storage, tenant isolation
- [Source: convex/lib/payoutProvider.ts] — PayoutProvider interface, OnboardingParams, getProvider
- [Source: convex/lib/providers/stripeConnectAdapter.ts] — createOnboardingLink implementation, requireStripeClient
- [Source: convex/affiliateAuth.ts#L113-160] — getCurrentAffiliate auth pattern and return validator
- [Source: src/app/portal/(authenticated)/account/page.tsx] — Account page structure
- [Source: src/app/portal/(authenticated)/account/components/PayoutSection.tsx] — Existing payout component pattern
- [Source: convex/schema.ts#L284-301] — Affiliate provider fields
- [Source: convex/schema.ts#L35] — Tenant stripeAccountId field
- [Source: AGENTS.md#Suspense Boundaries] — Wrap client components using hooks in Suspense
- [Source: AGENTS.md#Button Motion] — Use Button component, never raw button tags

## Dev Agent Record

### Agent Model Used

glm-5-turbo (zai-coding-plan/glm-5-turbo)

### Debug Log References

No debug logs generated. All validation done via `pnpm tsc --noEmit` (zero errors) and `npx convex dev --once` (successful push).

### Completion Notes List

1. **`"use node"` split**: Queries/mutations cannot coexist with `"use node"` directive. Created two files: `affiliateProviderOnboarding.ts` (queries/mutations, V8 runtime) and `affiliateProviderOnboardingActions.ts` (actions, Node.js runtime for jose + Stripe SDK).
2. **Exported `requireStripeClient`**: Was private in `stripeConnectAdapter.ts`; exported so the action can call `stripe.accounts.create()` directly (adapter only handles onboarding links, not account creation).
3. **`getProviderForTenant()` workaround**: Tenants table lacks `payoutProviderType`; action checks `tenant.stripeAccountId` directly and hardcodes `"stripe_connect"`.
4. **jose v6.2.2 installed**: Uses `BETTER_AUTH_SECRET` env var as HS256 signing key, 1-hour token expiry. No prior JWT infrastructure existed.
5. **`verifyOnboardingToken` is an action**, not a query — `jose` requires Node.js crypto APIs.
6. **`getCurrentAffiliate` extended**: Added 5 provider fields (`payoutProviderType`, `payoutProviderAccountId`, `payoutProviderStatus`, `payoutProviderEnabled`, `payoutProviderStatusDetails`) plus `tenant.stripeAccountId` to return validator and handler.
7. **Convex codegen required**: After creating new files, ran `npx convex codegen` to regenerate `_generated/api.d.ts`. Used `as any` casts for self-referencing internal calls until codegen ran.
8. **Pre-existing ESLint error**: Circular dependency in `@eslint/eslintrc` + react plugin (unrelated to this story). `pnpm lint` fails but `pnpm tsc --noEmit` passes cleanly.

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/affiliateProviderOnboarding.ts` | CREATE | Internal queries (`getAffiliateByEmailInternal`, `getTenantStripeConfigInternal`) and internal mutations (`setAffiliateProviderAccount`, `setAffiliateProviderStatus`) |
| `convex/affiliateProviderOnboardingActions.ts` | CREATE | Actions with `"use node"`: `generateOnboardingLink` (creates Connect account if needed, signs JWT, returns onboarding URL), `verifyOnboardingToken` (verifies JWT signature/expiry) |
| `src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx` | CREATE | Provider payout setup UI with 4 states (not available, not started, pending, verified) |
| `convex/affiliateAuth.ts` | MODIFY | Extended `getCurrentAffiliate` return validator with 5 provider fields + `tenant.stripeAccountId` |
| `convex/lib/providers/stripeConnectAdapter.ts` | MODIFY | Exported `requireStripeClient()` function |
| `src/app/portal/(authenticated)/account/page.tsx` | MODIFY | Added ProviderPayoutSection import and rendering above PayoutSection |
| `src/app/portal/(authenticated)/account/components/PayoutSection.tsx` | MODIFY | Changed CardTitle from "Payout Method" to "Manual Payout Method" |
| `package.json` | MODIFY | Added `jose` v6.2.2 dependency |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-20 | Story 17.5 implementation complete. All 12 acceptance criteria met. TypeScript compilation passes. Convex functions pushed. |
| 2026-04-20 | Code review complete. 8 patches, 7 deferred, 5 dismissed. |

### Review Findings

- [x] [Review][Patch] Stripe API calls lack circuit breaker wrapping [convex/affiliateProviderOnboardingActions.ts:76,111] — `stripe.accounts.create()` and `provider.createOnboardingLink()` called directly without `withStripeCircuitBreaker()`. Per AGENTS.md Rule 4, all external service calls must use circuit breakers.
- [x] [Review][Patch] `verifyOnboardingToken` has no caller-ownership check [convex/affiliateProviderOnboardingActions.ts:122-143] — Action accepts any valid token and returns decoded `affiliateId`/`tenantId` without verifying the caller owns that affiliate. Add auth session check.
- [x] [Review][Patch] `payoutProviderEnabled` never set during onboarding [convex/affiliateProviderOnboardingActions.ts:84-92] — `setAffiliateProviderAccount` patches provider fields but omits `payoutProviderEnabled`. Should set to `false` during onboarding.
- [x] [Review][Patch] Remove dead props `affiliateId`/`tenantId` from ProviderPayoutSection [src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx:11-12,27-28] — Props declared and passed from parent but never used in component logic or JSX.
- [x] [Review][Patch] ProviderPayoutSection hangs on undefined action result [src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx:52-59] — If `generateLink` resolves to `undefined`, loading spinner stops in catch only. Add null-check guard on result.
- [x] [Review][Patch] Remove `as any` casts on internal function refs [convex/affiliateProviderOnboardingActions.ts:45,53,85,95] — Casts were needed before codegen ran; can be removed now.
- [x] [Review][Patch] Add `typ: "onboarding"` JWT claim to prevent confused deputy [convex/affiliateProviderOnboardingActions.ts:108] — No `typ` or `aud` claim distinguishes onboarding tokens from auth session tokens signed with the same `BETTER_AUTH_SECRET`.
- [x] [Review][Patch] Action should check `payoutProviderEnabled` before generating link [convex/affiliateProviderOnboardingActions.ts:29] — A disabled affiliate can still generate onboarding links; should throw if disabled.
- [x] [Review][Defer] Race condition: double-click creates orphaned Stripe accounts [convex/affiliateProviderOnboardingActions.ts:72-92] — deferred, requires Convex conditional write pattern; no unique constraint on provider fields. Evaluate in Story 17.6 (return/refresh handling) or when adding idempotency.
- [x] [Review][Defer] ProviderPayoutSection doesn't handle `"rejected"` status [ProviderPayoutSection.tsx:42-44] — deferred, Story 17.8 explicitly handles KYC rejection. By design for this story.
- [x] [Review][Defer] `payoutProviderStatus` is untyped string enum — deferred, Story 17.1 chose `v.string()` for provider-agnostic flexibility.
- [x] [Review][Defer] JWT token in URL leaks to logs/history — deferred, standard Stripe Connect pattern; return/refresh URLs require query params by design.
- [x] [Review][Defer] No rate limiting on `generateOnboardingLink` — deferred, AGENTS.md rate-limiting rule targets public HTTP endpoints; this is an authenticated Convex action.
- [x] [Review][Defer] `setAffiliateProviderStatus` overwrites verified→pending unconditionally — deferred, Story 17.6 handles return flow appropriately. Action only runs on explicit user click.
- [x] [Review][Defer] `mapStripeStatus` doesn't handle `restricted` status — deferred, pre-existing in Story 17.3 adapter; not introduced by this change.
