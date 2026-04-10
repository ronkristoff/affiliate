---
title: "Attribution Resilience — Auto Lead Capture + Coupon Code Fallback"
slug: "attribution-resilience"
created: "2026-04-09"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Convex 1.32.0", "TypeScript 5.9.3", "Next.js 16.1.0", "track.js (vanilla JS)"]
files_to_modify:
  - "convex/schema.ts"
  - "convex/conversions.ts"
  - "convex/referralLeads.ts"
  - "convex/affiliates.ts"
  - "convex/affiliateCampaigns.ts"
  - "convex/http.ts"
  - "convex/tenantStats.ts"
  - "public/track.js"
files_to_create:
  - "convex/emailNormalization.ts"
  - "convex/couponCodes.ts"
code_patterns:
  - "internalMutation with upsert semantics (createOrUpdateLead)"
  - "createConversionWithAttribution — single funnel point for all attributed conversions"
  - "resolveLeadAttribution — email-based lead lookup for webhook handlers"
  - "validateAffiliateCodeInternal — code validation with active affiliate check"
  - "tenantStats hooks — onLeadCreated, onLeadConverted, incrementTotalConversions"
test_patterns:
  - "Vitest configured; test files use .test.ts suffix"
  - "Convex tests use vi.fn() for mock ctx.db"
  - "Existing test: convex/clicks.test.ts (attribution precedence tests at lines 353-384)"
---

# Tech-Spec: Attribution Resilience — Auto Lead Capture + Coupon Code Fallback

**Created:** 2026-04-09

## Overview

### Problem Statement

Affiliate attribution relies on browser cookies (`_affilio`) which are fragile — users clear cookies, switch devices (click on mobile, buy on desktop), or use incognito mode. When the cookie is lost, the affiliate gets no credit for the conversion. The existing `referralLeads` table and `Affilio.referral({email})` API provide a permanent DB-based fallback, but they depend on the merchant properly integrating the referral call on their signup form. If the merchant skips this integration step, attribution is lost entirely.

### Solution

Two-phase resilience layer that hardens attribution beyond cookies:

1. **Phase 1 — Auto Lead Capture on Conversion:** Whenever a conversion is created with both an affiliate code and a customer email, automatically create a `referralLeads` record. This retroactively locks attribution in the database, so future purchases from that email (via Stripe/SaligPay webhook email matching) work even if cookies are cleared. Auto-capture fires on ALL conversion paths: `/track/conversion`, SaligPay webhooks, and Stripe webhooks.

2. **Phase 2 — Coupon Code Fallback:** Add auto-generated vanity coupon codes per affiliate (format: `{AFFILIATE_PREFIX}{TENANT_SLUG}`). When a coupon code is used at conversion time, it locks attribution to the owning affiliate — completely independent of cookies, devices, or browsers. Coupon code is an **independent attribution source** — no prior click required.

### Scope

**In Scope:**
- Auto-create `referralLeads` records during conversion creation on ALL paths (`/track/conversion`, SaligPay webhook, Stripe webhook)
- Email normalization (lowercase + Gmail dot/plus/`googlemail.com` stripping) for lead creation and lookup
- Log warnings when conversion has affiliate code but no `customerEmail` (for merchant visibility)
- Add `couponCode` field to `affiliates` table (one code per affiliate, not per campaign)
- Auto-generate vanity coupon codes on affiliate approval using `{AFFILIATE_PREFIX}{TENANT_SLUG}` format
- SaaS Owner can edit coupon codes post-generation with uniqueness + format validation (`^[A-Z0-9]{3,20}$`)
- "Regenerate" button to auto-generate a fresh code
- Add `couponAttributionEnabled` toggle on affiliates (default: true) — SaaS Owner can disable coupon attribution per affiliate
- Add optional `defaultCouponCampaignId` on affiliates for coupon-only campaign routing
- Validate coupon codes at `/track/conversion` and webhook endpoints as an independent attribution source
- Coupon code uniqueness per tenant with collision regeneration
- Coupon code wins over cookie attribution when both present with different affiliates
- Add `"coupon"` and `"lead_email"` values to existing `attributionSource` enum on `conversions` table
- track.js: `data-affilio-coupon` auto-detect attribute + `Affilio.applyCoupon()` API
- Affiliate portal display of their coupon code
- Backfill migration to generate codes for all existing approved affiliates
- Warning on code change (old code immediately invalid — industry standard)

**Out of Scope:**
- Browser fingerprinting (declining technology, privacy risks)
- Modifying track.js to auto-capture emails from form fields
- Changes to the merchant's signup/integration flow
- Discount/coupon engine (coupon codes are for ATTRIBUTION only — the merchant handles the actual discount on their end)
- Campaign-level coupon codes (one code per affiliate, scoped to the affiliate not the campaign)
- Coupon code grace period on edit (v2)
- Per-conversion coupon abuse flagging (v1 tracks source in reports instead; v2 adds threshold-based alerting)
- Content moderation on edited codes beyond basic profanity blocking (v2 adds trademark blocking)
- Code reservation before affiliate approval (v2)
- Fixing the cookie name mismatch bug (`sa_aff` vs `_affilio`) — pre-existing, separate fix

## Context for Development

### Codebase Patterns

1. **All attributed conversions funnel through a single internalMutation:** `createConversionWithAttribution` in `convex/conversions.ts` (line 220). All 5 call sites provide `tenantId`, `affiliateId`, `customerEmail`, `referralLinkId`, `campaignId`, `clickId`. This is the ideal single point for auto-capture logic.
2. **First-affiliate-wins enforced at DB level:** `createOrUpdateLead` in `convex/referralLeads.ts` (line 24) uses upsert semantics — if an active lead already exists for `tenantId + email`, it does NOT overwrite the affiliate.
3. **Email normalization not yet implemented:** Current lead creation/lookup uses raw email strings. All normalization must be added.
4. **`attributionSource` already exists** on `conversions` table (schema line 355) with values: `"cookie"`, `"webhook"`, `"organic"`, `"body"`. Must ADD `"coupon"` and `"lead_email"` to this union.
5. **tenantStats hooks:** `onLeadCreated` and `onLeadConverted` already exist in `tenantStats.ts` and are called by `referralLeads.ts`. Auto-capture calling `createOrUpdateLead` will automatically trigger these hooks.
6. **`createConversionWithAttribution` does NOT call tenantStats hooks** — pre-existing gap. Auto-capture (via `createOrUpdateLead`) will trigger `onLeadCreated`, which is correct and independent.
7. **No coupon infrastructure exists** anywhere in the codebase. Zero references to `coupon` across all Convex files. Entirely new feature.
8. **`affiliateCampaigns` table is write-only** — no queries read from it currently. Need new queries for enrollment lookup.
9. **Affiliate activation has 5 entry points** — all in `convex/affiliates.ts`: `approveAffiliate` (line 1867), `bulkApproveAffiliates` (line 2090), `updateAffiliateStatus` (line 1227), `inviteAffiliate` (line 1148), `reactivateAffiliate` (line 1734). All self-service signups start as `"pending"`.
10. **Cookie name mismatch pre-existing bug:** Server `/track/click` reads `sa_aff`, but track.js writes `_affilio`. This causes the cookie to behave as last-affiliate-wins at the browser level despite design intent for first-affiliate-wins. The DB-level lead system (`createOrUpdateLead`) provides the real safety net. NOT in scope for this spec.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/schema.ts` | Database schema — `conversions`, `affiliates`, `referralLeads`, `affiliateCampaigns` |
| `convex/conversions.ts` | `createConversionWithAttribution` — single funnel point for all attributed conversions |
| `convex/referralLeads.ts` | `createOrUpdateLead` — upsert with first-affiliate-wins; `resolveLeadAttribution` — email-based lookup |
| `convex/affiliates.ts` | All activation paths — `approveAffiliate`, `bulkApproveAffiliates`, `updateAffiliateStatus`, `inviteAffiliate`, `reactivateAffiliate` |
| `convex/affiliateCampaigns.ts` | Write-only currently — need new query for enrollment lookup |
| `convex/tenantStats.ts` | `onLeadCreated`, `onLeadConverted` — triggered automatically by auto-capture |
| `convex/http.ts` | `/track/conversion`, `/track/validate-coupon`, SaligPay webhook, Stripe webhook |
| `convex/commissionEngine.ts` | Webhook → conversion path via `processPaymentUpdatedToCommission` |
| `convex/webhooks.ts` | Email extraction from billing events, `processWebhookToConversion` |
| `public/track.js` | Client-side tracking — coupon API + cookie integration |

### Technical Decisions

#### ADR-1: Coupon Code Format
**Decision:** Vanity coupon code auto-generated on affiliate approval using `{AFFILIATE_PREFIX}{TENANT_SLUG}` format. SaaS Owner can edit post-generation.
**Generation algorithm:**
1. `affiliate_prefix` = first 4 chars of affiliate `name`, uppercase, strip accents/special chars. If result is shorter than 3 chars, pad with characters from the tenant slug to reach minimum 3 chars. If still shorter (both name and slug are very short), use the full name + slug concatenation.
2. `tenant_prefix` = first 4 chars of tenant `slug`, uppercase, strip hyphens
3. `candidate` = `affiliate_prefix + tenant_prefix` (max 10 chars total; truncate tenant side if over)
4. Check uniqueness within tenant via `by_tenant_coupon_code` index
5. If collision: append numeric suffix (`JUANKLOOK2`, `JUANKLOOK3`)
6. All base characters: A-Z only (numbers only as collision suffix)
**Edit rules:** `^[A-Z0-9]{3,20}$`, unique within tenant. Warning shown on edit that old code becomes immediately invalid.

#### ADR-2: Auto-Capture Timing
**Decision:** Capture leads at conversion time only (not at click time). All 5 call sites funnel through `createConversionWithAttribution` (conversions.ts line 220). Guard on `if (args.customerEmail)`. Insert auto-capture logic after conversion record creation (around line 296), before audit log.

#### ADR-3: Coupon Code Scope
**Decision:** One coupon code per affiliate (not per campaign).

#### ADR-4: Coupon vs Cookie Precedence
**Decision:** When both cookie attribution and coupon code exist with different affiliates, coupon code takes precedence. `attributionSource = "coupon"`.

#### ADR-5: Attribution Source Tracking
**Decision:** EXTEND existing `attributionSource` enum. Add `"coupon"` and `"lead_email"` to existing union: `"cookie"`, `"webhook"`, `"organic"`, `"body"`. No new field needed.

#### ADR-6: Coupon Lookup Architecture
**Decision:** Composite index `by_tenant_coupon_code` on `affiliates` table `["tenantId", "couponCode"]`. Public `validateCouponCode` query.

#### ADR-7: track.js Coupon Integration
**Decision:** Both auto-detect (`data-affilio-coupon` attribute) and manual API (`Affilio.applyCoupon(code)`, `Affilio.validateCoupon(code)`). Coupon stored in `_affilio` cookie alongside existing data.

#### ADR-8: Default Campaign for Coupon-Only Conversions
**Decision:** Per-affiliate `defaultCouponCampaignId`. Falls back to most recent active enrollment. If none, reject.

#### ADR-9: Coupon Code Deprecation on Edit
**Decision:** Warning-only for v1. Old code immediately invalid.

#### ADR-10: Coupon Abuse Controls
**Decision:** `couponAttributionEnabled` boolean on `affiliates` (default: true).

#### ADR-11: Coupon Code Generation Hook Architecture
**Decision:** Shared `internalMutation` (`onAffiliateActivated`) called from all 5 activation paths. Preserves existing code on reactivation.
**CONFIRMED by Step 2:** Affiliate activation has 5 entry points in `convex/affiliates.ts`: `approveAffiliate` (line 1867), `bulkApproveAffiliates` (line 2090), `updateAffiliateStatus` (line 1227), `inviteAffiliate` (line 1148), `reactivateAffiliate` (line 1734). A shared internalMutation avoids duplicating logic across all 5 sites.
**Reactivation handling:** When `reactivateAffiliate` is called, check if affiliate already has a `couponCode`. If yes, preserve it (don't regenerate). If no, generate one.

#### ADR-12: track.js Cookie Name Strategy
**Decision:** track.js writes coupon data to the `sa_aff` cookie (same cookie the server reads), NOT `_affilio`.
**Rationale:** The server-side `/track/conversion` handler reads `sa_aff` (http.ts line 123). Writing coupon data to `_affilio` means it never reaches the server — the feature would be non-functional. This is a known cookie name mismatch bug (documented in codebase patterns), but rather than fixing the mismatch (which could break existing tracking), we align track.js to write to the same cookie the server already reads. **v2 consideration:** Unify to a single cookie name after confirming backward compatibility.

### Email Normalization Specification

**Implementation:** New file `convex/emailNormalization.ts` with `normalizeEmail(email: string): string`.

**Rules:**
1. Lowercase entire email
2. If domain is `gmail.com` or `googlemail.com`: normalize domain to `gmail.com`, remove dots from local part, strip `+` aliases
3. All other domains: lowercase only

| Input | Normalized |
|---|---|
| `John.Doe+Newsletter@Gmail.com` | `johndoe@gmail.com` |
| `john.doe@googlemail.com` | `johndoe@gmail.com` |
| `John.Doe@outlook.com` | `john.doe@outlook.com` |

## Implementation Plan

### Tasks

#### Phase 1: Foundation (Schema + Email Normalization)

- [ ] **Task 1: Create email normalization utility**
  - File: `convex/emailNormalization.ts` (NEW)
  - Action: Create `normalizeEmail(email: string): string` export function. Implement: (1) lowercase, (2) Gmail/Google Mail domain normalization + dot removal + plus-alias stripping, (3) return normalized email. Pure function, no DB access.
  - Notes: Used by `referralLeads.ts` and `conversions.ts`. Must be a static import (no dynamic imports in mutations).

- [ ] **Task 2: Update schema — add new fields and indexes**
  - File: `convex/schema.ts`
  - Action:
    - Add to `affiliates` table: `couponCode: v.optional(v.string())`, `couponAttributionEnabled: v.optional(v.boolean())`, `defaultCouponCampaignId: v.optional(v.id("campaigns"))`
    - Add index on `affiliates`: `.index("by_tenant_coupon_code", ["tenantId", "couponCode"])`
    - Extend `attributionSource` union on `conversions` table: add `v.literal("coupon")` and `v.literal("lead_email")` to existing union
    - Add to `conversions` table: `couponCode: v.optional(v.string())` — first-class field for queryable coupon reporting (not buried in metadata)
    - Change `referralLeads` table: make `referralLinkId` optional (`v.optional(v.id("referralLinks"))`) — required for coupon-only conversions that have no click/referral link
    - Optionally add index on `affiliateCampaigns`: `.index("by_affiliate_and_status", ["affiliateId", "status"])` for efficient coupon-only campaign resolution
  - Notes: All new fields are `v.optional()` for backward compatibility with existing data. Making `referralLinkId` optional on `referralLeads` is backward compatible — existing leads already have values. No migration needed — Convex schema is additive.

- [ ] **Task 2.5: Data migration — normalize existing lead emails**
  - File: `convex/emailNormalization.ts` (add migration action)
  - Action: Add an action `migrateNormalizeLeadEmails` that:
    1. Queries all `referralLeads` records using cursor-based pagination (`.paginate({ numItems: 100, cursor: args.cursor })`)
    2. For each: normalizes `email` field using `normalizeEmail()`
    3. If normalized email differs from current, patches the record
    4. Returns `{ migrated, total, continueCursor }` — if `continueCursor` is non-null, call again with that cursor
    5. **NOT a single-call batch** — must recurse across multiple calls to avoid Convex function timeout limits
    6. **Dual-lookup transition strategy**: If `args.mode === "dual"`, patch AND store the original raw email in a temporary `_rawEmail` field (for backward-compat fallback lookups). When `args.mode === "finalize"` (after migration confirmed complete), remove the `_rawEmail` field from all records.
  - Notes: **MUST run before or alongside the code deploy.** Without this migration, existing leads with raw emails (e.g., `John.Doe@gmail.com`) won't match new normalized lookups (e.g., `johndoe@gmail.com`), breaking backward compatibility. **Deploy sequence:** (1) Deploy schema + code with dual-lookup, (2) Run migration in `dual` mode, (3) Verify all records migrated, (4) Run migration in `finalize` mode to remove `_rawEmail` field. Run via CLI: `pnpm convex run emailNormalization:migrateNormalizeLeadEmails --typecheck=disable --push '{"cursor": null, "mode": "dual"}'`. Idempotent — skips records already normalized.

#### Phase 2: Auto Lead Capture (Conversion-Time)

- [ ] **Task 3: Integrate email normalization into lead creation and lookup**
  - File: `convex/referralLeads.ts`
  - Action:
    - Import `normalizeEmail` from `./emailNormalization`
    - In `createOrUpdateLead` (line 24): normalize `args.email` before the upsert lookup and insert
    - In `findLeadByEmail` (line 80): normalize `args.email` before the query
    - In `resolveLeadAttribution` (line 329): normalize `args.email` before the query
    - In `findLeadByUid` (line 128): no change needed (UID-based, not email-based)
  - Notes: Normalization must be applied consistently to BOTH writes and reads for matching to work.

- [ ] **Task 3.5: Update all validators to match schema changes (critical — prevents runtime crashes)**
  - File: `convex/referralLeads.ts`, `convex/conversions.ts`
  - Action: Table schema changes (Task 2) do NOT auto-update mutation args validators or query return validators. Each must be manually updated:
    - **`createOrUpdateLead` args** (referralLeads.ts): change `referralLinkId: v.id("referralLinks")` to `referralLinkId: v.optional(v.id("referralLinks"))` — required for coupon-only leads
    - **`findLeadByEmail` return** (referralLeads.ts): change `referralLinkId: v.id("referralLinks")` to `referralLinkId: v.optional(v.id("referralLinks"))` — coupon-only leads have no referral link
    - **`findLeadByUid` return** (referralLeads.ts): if `referralLinkId` is in the return type, change to `v.optional()` — same reason
    - **`resolveLeadAttribution` return** (referralLeads.ts): change `referralLinkId: v.id("referralLinks")` to `v.optional(v.id("referralLinks"))` — same reason
    - **`resolveLeadAttribution` body** (referralLeads.ts): add null-check before `ctx.db.get(lead.referralLinkId)` — `ctx.db.get(undefined)` throws. Change to: `if (lead.referralLinkId) { const refLink = await ctx.db.get(lead.referralLinkId); ... }`
    - **`createConversionWithAttribution` args** (conversions.ts): add `v.literal("coupon")` and `v.literal("lead_email")` to the `attributionSource` union validator — without this, passing `"coupon"` causes `ArgumentValidationError`
  - Notes: This is the #1 ship-blocker. Every coupon-only conversion path will crash at one of these validators if not updated. These are pure TypeScript validator changes — no logic changes needed.

- [ ] **Task 4: Add auto-capture logic inside createConversionWithAttribution**
  - File: `convex/conversions.ts`
  - Action:
    - Import `normalizeEmail` from `./emailNormalization` and `createOrUpdateLead` from `./referralLeads` (via `internal` API)
    - Normalize `customerEmail` before storing in conversion record: `const normalizedCustomerEmail = args.customerEmail ? normalizeEmail(args.customerEmail) : undefined;` — use `normalizedCustomerEmail` in the DB insert (replaces the raw `customerEmail`). This ensures conversion records match lead records for Gmail addresses and enables accurate email-based report joins.
    - After the conversion record is created (around line 296, before audit log), add auto-capture block:
      ```
      if (args.customerEmail) {
        const normalizedEmail = normalizeEmail(args.customerEmail);
        if (args.referralLinkId || args.attributionSource === "coupon") {
          // Lead can be created with or without referralLinkId
          // Coupon-only conversions have no referral link but still need a lead for future email matching
          await ctx.runMutation(internal.referralLeads.createOrUpdateLead, {
            tenantId: args.tenantId,
            email: normalizedEmail,
            affiliateId: args.affiliateId,
            referralLinkId: args.referralLinkId ?? undefined,
            campaignId: args.campaignId,
            clickId: args.clickId,
          });
        }
      } else if (args.affiliateId) {
        console.warn("[Auto-Capture] Attributed conversion missing customerEmail. Lead not captured. Email is required for future cross-device attribution.");
      }
      ```
    - Import `internal.referralLeads` via `internal` from `./_generated/api`
  - Notes: `createOrUpdateLead` already handles upsert (first-affiliate-wins). The `onLeadCreated` tenantStats hook fires automatically. The guard now fires when `customerEmail` is present AND either a `referralLinkId` exists (click-based) OR the source is a coupon (coupon-only). Coupon-only conversions pass `referralLinkId: undefined` — this is valid since `referralLinkId` is now optional on `referralLeads`.

- [ ] **Task 5: Update attributionSource values in callers**
  - File: `convex/http.ts`, `convex/commissionEngine.ts`, `convex/webhooks.ts`
  - Action:
    - In `http.ts` `/track/conversion` handler: when coupon code is provided in body, set `attributionSource: "coupon"` instead of `"body"` or `"cookie"`
    - In `webhooks.ts` `resolveLeadAttribution` path: normalize the customer email from the billing event BEFORE calling `resolveLeadAttribution` (using `normalizeEmail()`). When attribution comes from lead email matching, set `attributionSource: "lead_email"` instead of `"webhook"`
    - In `commissionEngine.ts`: pass through `attributionSource` from the billing event without modification
  - Notes: The `createConversionWithAttribution` args already accept `attributionSource` as a string union. The schema change in Task 2 allows the new values. Callers must be updated to pass the correct value. **Critical:** Webhook callers must normalize the email before lead lookup, otherwise normalized leads (from the migration) won't match raw webhook emails.

#### Phase 3: Coupon Code Infrastructure

- [ ] **Task 6: Create coupon code generation and validation module**
  - File: `convex/couponCodes.ts` (NEW)
  - Action: Create the following functions:
    - `generateVanityCode(affiliateName: string, tenantSlug: string): string` — implements ADR-1 algorithm (4-char affiliate prefix + 4-char tenant prefix, max 10 chars, A-Z only)
    - `validateCouponCodeFormat(code: string): boolean` — regex `^[A-Z0-9]{3,20}$`
    - `internalMutation generateCouponCodeForAffiliate`: takes `tenantId`, `affiliateId`, generates vanity code, checks uniqueness via `by_tenant_coupon_code` index, appends numeric suffix on collision, patches affiliate record
    - `internalMutation onAffiliateActivated`: shared hook called from all 5 activation paths. Checks if affiliate already has `couponCode` — if yes, preserve; if no, call `generateCouponCodeForAffiliate`
    - `query validateCouponCode`: public query. Takes `tenantId`, `couponCode`. Looks up affiliate via `by_tenant_coupon_code` index. Validates: affiliate exists, status === "active", `couponAttributionEnabled !== false`. Resolves campaign per ADR-8 (defaultCouponCampaignId → most recent active enrollment). Returns `{ affiliateId, affiliateName, campaignId, referralLinkId }` or null. **`referralLinkId` is `v.optional(v.id("referralLinks"))`** — returns `undefined` for coupon-only attribution (no click = no referral link). Callers must handle this.
    - `mutation updateAffiliateCouponCode`: takes `tenantId`, `affiliateId`, `newCode`. Validates format, checks uniqueness, patches affiliate record. **Must also create an audit log entry** documenting the coupon code change (old code → new code, who changed it, when).
    - `internalQuery getMostRecentActiveEnrollment`: takes `affiliateId`. Queries `affiliateCampaigns` by `by_affiliate_and_status` (or `by_affiliate` with `.order("desc")` + memory filter), returns most recent active enrollment with campaignId.
  - Notes: `generateVanityCode` is a pure function (testable). The validation query is public (no auth) since it's called from merchant tracking endpoints.

- [ ] **Task 7: Hook coupon generation into all 5 activation paths**
  - File: `convex/affiliates.ts`
  - Action: Import `internal.couponCodes.onAffiliateActivated` and add a call at each activation point:
    - `approveAffiliate` — after line 1869 (after `updateAffiliateCount`)
    - `bulkApproveAffiliates` — inside the loop, after each individual approval
    - `updateAffiliateStatus` — after line 1229, only when `args.status === "active"`
    - `inviteAffiliate` — after line 1152 (after affiliate insert)
    - `reactivateAffiliate` — after line 1737 (after status patch)
  - Notes: `onAffiliateActivated` handles the "already has code" check internally, so it's safe to call from all paths without conditional logic at the call site.

- [ ] **Task 8: Add coupon validation to /track/conversion endpoint**
  - File: `convex/http.ts`
  - Action: In the `/track/conversion` handler (around line 88):
    - Add `couponCode` to the existing request body destructuring (alongside `amount`, `orderId`, `customerEmail`, `products`, `metadata`, `affiliateCode`, `clickId`)
    - If `couponCode` is provided:
      1. Call `ctx.runQuery(api.couponCodes.validateCouponCode, { tenantId, couponCode })` to resolve affiliate + campaign
      2. If valid and `couponAttributionEnabled` is true, use the coupon's affiliate as the attribution source (overriding cookie-based `affiliateCode` per ADR-4)
      3. Set `attributionSource: "coupon"`
      4. Pass `couponCode` through to conversion as first-class field (not just metadata)
    - If `couponCode` is provided but invalid, log warning and fall back to cookie/body attribution (don't fail the conversion)
    - If both `affiliateCode` (from cookie) AND `couponCode` point to DIFFERENT affiliates, coupon wins (ADR-4)
  - Notes: The coupon validation query is a public query callable from httpAction via `ctx.runQuery`.

- [ ] **Task 9: Add coupon validation to webhook handlers**
  - File: `convex/webhooks.ts`
  - Action:
    - In the billing event normalization flow, check for coupon code in payment metadata using the exact key `_salig_aff_coupon_code`. Merchant must embed the coupon code at this key in their payment intent/session metadata: `{ metadata: { "_salig_aff_coupon_code": "JUANKLOOK" } }`.
    - If coupon found: validate via `validateCouponCode`, resolve affiliate, set `attributionSource: "lead_email"` (since webhook attribution without click = email/lead-based)
    - Integrate with existing `resolveLeadAttribution` flow — coupon validation runs as an additional attribution source BEFORE email-based lead matching
  - Notes: Webhook coupon support depends on merchants embedding the coupon code in their payment metadata. Document this integration requirement.

#### Phase 4: track.js Client-Side

- [ ] **Task 10: Add coupon API to track.js**
  - File: `public/track.js`
  - Action:
    - Add `data-affilio-coupon` auto-detection (opt-in): on init, scan DOM for `input[data-affilio-coupon-autowire]` only. On `input`/`change` events, call `Affilio.validateCoupon(code)` and store result in internal state. Standard `data-affilio-coupon` attribute is a passive marker for styling/identification — does NOT auto-wire events.
    - Add `Affilio.applyCoupon(code)` method: validates code via API call to `validateCouponCode`, stores validated code in the `sa_aff` cookie (matching what the server reads — see ADR-12) alongside existing data (`{ code, clickId, tenantId, timestamp, couponCode }`), returns `{ valid, affiliateName, campaignName }`.
    - Add `Affilio.validateCoupon(code)` method: calls API, returns validation result without storing. For merchant's custom UI.
    - Add `Affilio.getCouponCode()` method: returns currently applied coupon code from cookie/internal state, or null.
    - Modify conversion tracking payload: if `couponCode` is stored, include it in the POST body to `/track/conversion` and set `attributionSource: "coupon"`
  - Notes: track.js uses `btoa`/`atob` for cookie encoding (Base64 JSON). The `couponCode` field is added to the existing cookie object. The validation API call goes to `/track/validate-coupon`. **Cookie name is `sa_aff`** (matching what the server reads) — NOT `_affilio`. This aligns with the existing server-side cookie reading in `/track/conversion` and `/track/click`.

- [ ] **Task 11: Add coupon validation HTTP endpoint for track.js**
  - File: `convex/http.ts`
  - Action: Add a new lightweight endpoint at `GET /track/validate-coupon` with query params `code` and `t` (tenant ID). Uses the same auth pattern as existing `/track/*` endpoints (tracking key validation or public access with tenant ID). Returns JSON `{ valid: true, affiliateName, campaignName }` or `{ valid: false, error: "Invalid coupon code" | "Coupon disabled" | "Affiliate not found" }`. Called by track.js `Affilio.validateCoupon()` and `Affilio.applyCoupon()`. Internally calls `validateCouponCode` query.
  - Notes: Must be fast (single index read, no heavy computation). Public endpoint — uses same tracking key pattern as other `/track/*` endpoints for auth.

#### Phase 5: UI + Backfill

- [ ] **Task 12: Add coupon code display to affiliate portal**
  - File: `src/app/portal/` (affiliate dashboard components)
  - Action: Show the affiliate's `couponCode` in their dashboard/profile. Display as a prominent, copyable element with label "Your Personal Promo Code". If no code yet, show "Code will be generated once approved."
  - Notes: Read `couponCode` from the affiliate's Convex record. Use existing `<Button>` component with copy functionality (icon button pattern from codebase).

- [ ] **Task 13: Add coupon code view + edit to SaaS Owner affiliate detail**
  - File: `src/app/(auth)/dashboard/` (affiliate detail/edit components)
  - Action:
    - Display current `couponCode` on affiliate detail page
    - Add inline edit with format validation (`^[A-Z0-9]{3,20}$`) and uniqueness check
    - Add "Regenerate" button to call `updateAffiliateCouponCode` mutation with a freshly generated code
    - Show warning on edit: "⚠️ Changing this code will make the old code invalid"
    - Add `couponAttributionEnabled` toggle
    - Add `defaultCouponCampaignId` selector (dropdown of active campaigns)
  - Notes: Uses existing form patterns from the codebase (react-hook-form + zod). Campaign dropdown queries active campaigns for the tenant.

- [ ] **Task 14: Create backfill migration for existing affiliates**
  - File: `convex/couponCodes.ts` (add migration action)
  - Action: Add an action `backfillCouponCodes` that:
    1. Queries affiliates with `status: "active"` and no `couponCode` using cursor-based pagination (same pattern as Task 2.5 — `.paginate({ numItems: 100, cursor: args.cursor })`)
    2. For each: generates vanity code (same algorithm as Task 6), checks uniqueness, patches record
    3. Returns `{ generated, total, continueCursor }` — if `continueCursor` is non-null, call again with that cursor
    4. **NOT a single-call batch** — must recurse across multiple calls to avoid Convex function timeout limits
  - Notes: Run via CLI in a loop until `continueCursor` is null: `pnpm convex run couponCodes:backfillCouponCodes --typecheck=disable --push '{"cursor": null}'`. Idempotent — skips affiliates that already have codes. Non-blocking — can run async after main deploy.

### Acceptance Criteria

#### Phase 1: Foundation

- [ ] **AC-1:** Given an email `John.Doe+Newsletter@Gmail.com`, when `normalizeEmail()` is called, then the result is `johndoe@gmail.com`.
- [ ] **AC-2:** Given an email `john.doe@googlemail.com`, when `normalizeEmail()` is called, then the result is `johndoe@gmail.com`.
- [ ] **AC-3:** Given an email `John.Doe@outlook.com`, when `normalizeEmail()` is called, then the result is `john.doe@outlook.com` (dots preserved for non-Gmail).
- [ ] **AC-4:** Given the schema is updated, when an existing conversion record is read, then no errors occur (new fields are optional).
- [ ] **AC-5:** Given a new conversion is created with `attributionSource: "coupon"` and `couponCode: "JUANKLOOK"`, when the record is written, then both fields persist and `couponCode` is queryable as a first-class field.
- [ ] **AC-5b:** Given the `referralLeads` schema change makes `referralLinkId` optional, when an existing lead with a `referralLinkId` is read, then no errors occur.

#### Phase 1.5: Email Normalization Migration

- [ ] **AC-5c:** Given a lead was created before normalization with raw email `John.Doe@gmail.com`, when the normalization migration runs, then the lead's email is updated to `johndoe@gmail.com` and subsequent lookups via `findLeadByEmail` match correctly.
- [ ] **AC-5d:** Given the normalization migration is run a second time, when all leads are already normalized, then no records are patched (idempotent).

#### Phase 2: Auto Lead Capture

- [ ] **AC-6:** Given a conversion is created via `/track/conversion` with `affiliateCode` and `customerEmail`, when `createConversionWithAttribution` completes, then a `referralLeads` record exists for the normalized email with the correct affiliate.
- [ ] **AC-6b:** Given a coupon-only conversion is created via `/track/conversion` with `couponCode: "JUANKLOOK"` and `customerEmail` but NO prior click (no `referralLinkId`), when `createConversionWithAttribution` completes, then a `referralLeads` record exists for the normalized email with the coupon's affiliate (with `referralLinkId: undefined`).
- [ ] **AC-7:** Given a conversion is created via Stripe webhook with `customerEmail`, when the webhook completes, then a `referralLeads` record exists for the normalized email.
- [ ] **AC-8:** Given a conversion is created via SaligPay webhook with `customerEmail`, when the webhook completes, then a `referralLeads` record exists for the normalized email.
- [ ] **AC-9:** Given an active lead already exists for `tenantId + email` with Affiliate A, when a second conversion arrives attributed to Affiliate B with the same email, then the lead is NOT overwritten (first-affiliate-wins preserved).
- [ ] **AC-10:** Given a conversion has an affiliate but no `customerEmail`, when the conversion is created, then no lead is created and a warning is logged.
- [ ] **AC-11:** Given user signs up with `john+work@gmail.com` (via `Affilio.referral()`), when they later pay via Stripe with `johndoe@gmail.com`, then the webhook resolves the lead and attributes correctly (email normalization).

#### Phase 3: Coupon Codes

- [ ] **AC-12:** Given an affiliate "Juan Cruz" is approved in tenant with slug "klook", when `onAffiliateActivated` fires, then the affiliate has a `couponCode` of `JUANKLOOK`.
- [ ] **AC-12b:** Given an affiliate with name "Li" (short name) in tenant with slug "sa", when `onAffiliateActivated` fires, then the affiliate has a `couponCode` of at least 3 chars (padded from tenant slug if needed, e.g., `LISA` or `LISA2`).
- [ ] **AC-13:** Given two affiliates named "Juan" in the same tenant, when both are approved, then the second gets code `JUAN2{SLUG}` (collision suffix).
- [ ] **AC-14:** Given an affiliate is reactivated (suspended → active), when `onAffiliateActivated` fires, then the existing `couponCode` is preserved (not regenerated).
- [ ] **AC-15:** Given `validateCouponCode("JUANKLOOK")` is called, when the affiliate is active and `couponAttributionEnabled` is true, then the response includes `affiliateId` and `campaignId`.
- [ ] **AC-16:** Given `validateCouponCode("JUANKLOOK")` is called, when the affiliate has `couponAttributionEnabled: false`, then the response is null (coupon disabled).
- [ ] **AC-17:** Given `validateCouponCode("JUANKLOOK")` is called, when the affiliate is suspended, then the response is null (inactive affiliate).
- [ ] **AC-18:** Given a SaaS Owner edits the coupon code to "NEWCODE", when saved, then the old code is immediately invalid and the new code resolves correctly.
- [ ] **AC-19:** Given a SaaS Owner enters an invalid format (e.g., "ab"), when editing, then validation fails with format error.
- [ ] **AC-20:** Given a SaaS Owner enters a code that already belongs to another affiliate in the same tenant, when editing, then validation fails with uniqueness error.
- [ ] **AC-21:** Given a conversion via `/track/conversion` with `couponCode: "JUANKLOOK"` and a different cookie-based `affiliateCode`, when the conversion is created, then attribution goes to the coupon's affiliate (not the cookie's affiliate).
- [ ] **AC-22:** Given a conversion via `/track/conversion` with `couponCode: "JUANKLOOK"` and no prior click, when the conversion is created, then `attributionSource` is `"coupon"` and the affiliate is credited.
- [ ] **AC-23:** Given a coupon-only conversion (no click), when the campaign is resolved, then `defaultCouponCampaignId` is used if set, otherwise the most recent active enrollment.
- [ ] **AC-24:** Given a coupon code is used but the affiliate has no active campaign enrollments and no `defaultCouponCampaignId`, when validated, then the coupon is rejected as invalid.

#### Phase 4: track.js

- [ ] **AC-25:** Given a merchant page has `<input data-affilio-coupon-autowire>`, when a user types a valid coupon code, then track.js auto-validates and stores the code in the `_affilio` cookie.
- [ ] **AC-26:** Given `Affilio.applyCoupon("JUANKLOOK")` is called with a valid code, when the promise resolves, then the code is stored and `{ valid: true }` is returned.
- [ ] **AC-27:** Given a coupon is stored via `Affilio.applyCoupon()`, when a conversion is tracked, then the conversion payload includes `couponCode` and `attributionSource: "coupon"`.
- [ ] **AC-28:** Given `Affilio.validateCoupon("INVALID")` is called, when the promise resolves, then `{ valid: false }` is returned and no code is stored.

#### Phase 5: UI + Backfill

- [ ] **AC-29:** Given an affiliate views their portal dashboard, when they have an approved account, then their `couponCode` is displayed prominently with a copy button.
- [ ] **AC-30:** Given a SaaS Owner views an affiliate detail page, when the affiliate has a coupon code, then the code is displayed with edit and regenerate options.
- [ ] **AC-31:** Given the backfill action is run, when existing active affiliates have no `couponCode`, then codes are generated for all of them.
- [ ] **AC-32:** Given the backfill action is run a second time, when affiliates already have codes, then no codes are changed (idempotent).
- [ ] **AC-32b:** Given a coupon-only conversion with `customerEmail`, when the user makes a second purchase from a different device (no cookie, no coupon re-entered), then the existing `referralLeads` record matches the second purchase email and attributes correctly.

#### Data Consistency

- [ ] **AC-33:** Given `createOrUpdateLead` is called twice for the same `tenantId + email` (once from `Affilio.referral()` at signup, once from auto-capture at conversion), when both calls complete, then only ONE lead record exists with the original affiliate (idempotent upsert).

## Additional Context

### Dependencies

- **Schema migration required:** Add `couponCode`, `couponAttributionEnabled`, `defaultCouponCampaignId` to `affiliates` table; add `"coupon"` and `"lead_email"` to `attributionSource` union on `conversions` table; add `couponCode` first-class field on `conversions` table; add `by_tenant_coupon_code` index on `affiliates`; make `referralLinkId` optional on `referralLeads` table; optionally add `by_affiliate_and_status` index on `affiliateCampaigns`. Convex schema is additive — no explicit migration needed.
- **Data migration required (CRITICAL):** Run `emailNormalization:migrateNormalizeLeadEmails` action on deploy to normalize all existing `referralLeads.email` fields. Without this, existing leads with raw emails won't match new normalized lookups, breaking backward compatibility.
- **Backfill migration:** Run `couponCodes:backfillCouponCodes` action after deploy to generate codes for existing approved affiliates. Non-blocking — can run async after main deploy.
- **No new npm dependencies required.**
- **Merchant integration required for coupon feature:** Merchants must add a coupon input field to their checkout page (either via `data-affilio-coupon-autowire` attribute or `Affilio.applyCoupon()` API). Without this, coupon codes cannot be entered by end users.
- **Deploy sequence (important):** (1) Deploy schema changes — (2) Run email normalization migration — (3) Deploy code changes. Steps 1 and 2 must complete before step 3 to prevent a window of broken attribution. Alternatively, make the code backward-compatible by trying BOTH normalized and raw email lookups during a transition period.

### Testing Strategy

**Unit tests (Vitest):**
- `emailNormalization.ts`: Test all normalization rules (Gmail dots, plus aliases, googlemail.com, case, non-Gmail passthrough, edge cases like empty string, null-like inputs)
- `couponCodes.ts`: Test `generateVanityCode` algorithm (name truncation, slug truncation, special chars, collision suffix, **short name padding**), `validateCouponCodeFormat` regex, `onAffiliateActivated` idempotency, `validateCouponCode` with active/inactive/disabled affiliates, `getMostRecentActiveEnrollment` resolution order

**Integration tests:**
- End-to-end auto-capture: Create conversion with email → verify lead exists → create second conversion with different affiliate but same email → verify lead not overwritten
- Coupon validation flow: Apply coupon → track conversion → verify attributionSource is "coupon" → verify correct affiliate credited
- Cookie + coupon precedence: Set cookie for Affiliate A, apply coupon for Affiliate B, track conversion → verify Affiliate B credited (coupon wins)
- **Coupon-only auto-capture:** Create conversion with coupon but no click → verify lead is created with `referralLinkId: undefined` → verify second purchase from same email on different device attributes correctly
- **Email normalization backward compat:** Create lead with raw email → run migration → verify lookup with normalized email matches
- **Double createOrUpdateLead call:** Simulate `Affilio.referral()` + conversion auto-capture for same user → verify only one lead exists

**Manual testing:**
- Install updated track.js on a test merchant site
- Verify `data-affilio-coupon` auto-detection works
- Verify `Affilio.applyCoupon()` returns correct validation results
- Verify coupon code appears in affiliate portal
- Verify SaaS Owner can edit/regenerate codes
- Run backfill migration on development environment

### Notes

- **Coupon codes are for ATTRIBUTION only** — the merchant is responsible for implementing the actual discount on their checkout
- **track.js is CDN-hosted and auto-updates**, but merchants must add coupon input fields to their checkout pages
- **Backfill migration** should generate codes for all existing approved affiliates on deploy
- **Email normalization migration is CRITICAL** — must run before or alongside code deploy to prevent broken lead matching
- **Deploy sequence:** schema → email normalization migration → code (see Dependencies section)
- **Coupon codes are per-session, not persistent** — entering a coupon code on one visit doesn't carry to the next visit unless the merchant re-applies it. After a coupon is used, the cookie reverts to normal click-based attribution on subsequent visits. Document this for affiliates.
- **Double `createOrUpdateLead` call is expected** — when a user both signs up (via `Affilio.referral()`) and converts, the lead creation function is called twice. The second call is a read-only no-op (upsert finds existing lead, skips write). Cost: one extra index read per conversion. Acceptable.
- **Coupon-only conversions bypass click-based fraud detection** — existing fraud signals check IP overlap between clicks and conversions. Coupon-only conversions have NO click → no IP check possible. v2 needs coupon-aware fraud rules (e.g., rate-limit coupon-only conversions per affiliate, flag affiliates with >60% coupon-only conversion rate).
- **Audit trail for coupon edits** — `updateAffiliateCouponCode` mutation must create an audit log entry (old code → new code) for compliance.
- **The existing `attributionSource` value `"body"`** represents track.js body-based attribution (functionally equivalent to `"cookie"`) — both should be treated as click-tracked attribution in reports
- **Cookie name mismatch** (`sa_aff` vs `_affilio`) is a pre-existing bug documented here for awareness but NOT fixed as part of this spec
- **`createConversionWithAttribution` does not call tenantStats hooks** — pre-existing gap, not introduced by this spec. Auto-capture triggers `onLeadCreated` via `createOrUpdateLead`, which is correct.
- **`attributionSource: "lead_email"`** is set by webhook handlers when attribution comes from email-based lead matching (the existing `resolveLeadAttribution` path). This distinguishes webhook conversions that found their attribution via the DB lead from those that got it from payment metadata.
- **v2 considerations:** Coupon code grace period on edit, threshold-based coupon abuse alerting, content moderation for edited codes, code reservation before approval, per-campaign coupon codes, dashboard metric for "conversions missing email" to help owners identify integration issues, rate limiting on `validateCouponCode` endpoint, unified cookie name (resolve `sa_aff` vs `_affilio` mismatch).

### Known v1 Limitations (Acceptable Debt)

| # | Limitation | Impact | v2 Fix |
|---|---|---|---|
| L1 | **Coupon code collision is racy** — concurrent activations can generate identical codes simultaneously (no DB unique constraint) | Low probability (admin action); accept small risk | Add retry-on-conflict with deterministic fallback |
| L2 | **No rate limiting on `validateCouponCode`** — public query could theoretically be enumerated | Large code space (31^6 per tenant) makes brute force impractical | Add tenant-scoped rate limiting |
| L3 | **`expireStaleLeads` cron doesn't decrement `leadsCreatedThisMonth`** — auto-capture inflates lead volume, making counter discrepancy worse | Pre-existing gap, not introduced by this spec | Add `onLeadExpired` tenantStats hook |
| L4 | **Converted lead triggers new insert on repeat conversion** — if a lead was converted via `markLeadConverted` (status set to "converted"), a subsequent conversion creates a second lead, triggering `onLeadCreated` again | Pre-existing edge case in `createOrUpdateLead` upsert logic | Check `status !== "converted"` before creating new lead |
| L5 | **`couponCode` on `conversions` table has no index** — full table scan per tenant for coupon-filtered reports | Reports filter by `attributionSource: "coupon"` for v1; add index when volume justifies | Add index `by_tenant_coupon_code` on `conversions` |
