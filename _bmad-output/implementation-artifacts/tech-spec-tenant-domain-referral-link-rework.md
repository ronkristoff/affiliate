---
title: "Tenant Domain & Referral Link Rework"
slug: "tenant-domain-referral-link-rework"
created: "2026-03-27"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16", "Convex", "TypeScript", "Tailwind CSS v4", "Better Auth"]
files_to_modify: [
  "convex/schema.ts",
  "src/app/(unauth)/sign-up/SignUp.tsx",
  "src/lib/auth.ts",
  "convex/users.ts",
  "convex/tenants.ts",
  "src/lib/referral-links.ts",
  "convex/referralLinks.ts",
  "public/track.js",
  "convex/http.ts",
  "convex/tracking.ts",
  "src/components/onboarding/TrackingSnippetInstaller.tsx",
  "src/components/affiliate/ReferralLinksSection.tsx",
  "src/app/portal/links/components/ReferralLinkCard.tsx",
  "src/app/portal/home/components/QuickLinkCard.tsx",
  "convex/testData.ts",
  "convex/seedBulkData.ts",
  "scripts/load-test-click-tracking.ts",
  "convex/affiliateAuth.ts",
  "convex/payouts.test.ts",
  "convex/emails.test.ts",
  "convex/broadcast-log.test.ts",
  "convex/audit.commission.test.ts",
  "convex/commissionEngine.test.ts",
  "convex/commissions.approval.test.ts",
  "convex/webhooks.test.ts"
]
code_patterns: [
  "Better Auth databaseHooks.user.create.after for tenant creation",
  "Convex internalMutation for syncUserCreation",
  "Duplicate URL builder functions in src/lib and convex/",
  "Domain resolution: custom domain > subdomain > platform fallback (4 locations)",
  "track.js IIFE with init/sendPing/setupClickTracking pattern",
  "Fire-and-forget click tracking in /track/click handler",
  "Welcome email builds referral URL with tenant domain"
]
test_patterns: []
---

# Tech-Spec: Tenant Domain & Referral Link Rework

**Created:** 2026-03-27

## Overview

### Problem Statement

The current referral link system uses platform subdomains (`{tenant-slug}.saligaffiliate.com`) which doesn't make sense because salig-affiliate doesn't host the products where users buy. The buying happens on the tenant's own website. Additionally, tenant sign-up does not collect the tenant's website domain, which is essential for generating correct referral links. The referral link format needs to change from `https://{slug}.saligaffiliate.com/ref/{code}` to `https://{tenant-domain}/ref/{code}`.

### Solution

1. Add a required "Website URL" field to tenant sign-up
2. Store domain as top-level required field on tenant, verify via tracking snippet ping
3. Change referral link generation to use tenant's verified domain
4. Extend `track.js` to intercept `/ref/{code}` paths on tenant domains (SPA-compatible via `replaceState`)
5. Move conversion attribution from cross-domain cookie to request body
6. Simplify URL formats: keep Short + optional campaign/utm params, remove Full and Vanity

### Scope

**In Scope:**
- Add required "Website URL" field to sign-up form with validation (strip protocol/trailing slashes, reject localhost)
- Store domain as top-level `domain: v.string()` (required) on tenants table
- Domain verification via tracking snippet ping before referral links can be generated
- Update referral link generation to use tenant domain (remove all subdomain/platform fallback logic)
- Extend `track.js` with `/ref/{code}` path interception using `history.replaceState`
- Conversion endpoint reads attribution from POST body instead of cross-domain cookie
- Simplify URL formats: Short link only + optional campaign/utm query params
- Update all referral link display components with domain status warnings
- Domain re-verification on change, links inactive until verified
- Update welcome email to use tenant domain for referral URL
- Update all seed data scripts and test fixtures

**Out of Scope:**
- Custom domain feature (Scale tier, Story 8.8) — separate concern
- Vanity slug feature — removed as part of simplification
- Migration of existing referral links
- DNS-based domain verification (tracking ping sufficient for MVP)
- Changes to cookie-based attribution window (still 30 days)

## Context for Development

### Codebase Patterns

**Sign-up flow (tenant creation):**
- `src/app/(unauth)/sign-up/SignUp.tsx` — form with firstName, lastName, companyName, email, password. No Zod, imperative validation with toast errors.
- `authClient.signUp.email()` passes `companyName` as additional field via Better Auth
- `src/lib/auth.ts` — `databaseHooks.user.create.after` calls `internal.users.syncUserCreation`
- `convex/users.ts` — `syncUserCreation` creates tenant + user. Generates slug from company name. No domain field currently.
- Auth additional field pattern: `user.additionalFields.companyName` in `src/lib/auth.ts` — same pattern needed for `domain`

**Referral link generation:**
- `src/lib/referral-links.ts` — shared utility with `buildShortUrl`, `buildFullUrl`, `buildCampaignUrl`, `buildUtmUrl`, `buildVanityUrl`, `getTenantDomain` (returns `{slug}.saligaffiliate.com`)
- `convex/referralLinks.ts` — backend duplicates all URL builders. Domain resolution in 4 locations: custom domain > subdomain > platform fallback.
- Referral code: 8-char alphanumeric (excludes 0, O, I, 1), generated in both `affiliates.ts` and `referralLinks.ts`

**Tracking:**
- `public/track.js` — IIFE, handles ping, cookie, outbound link `?ref=` appending. Does NOT handle `/ref/{code}` path interception.
- `convex/http.ts` — `/track/click` currently sets HttpOnly `sa_aff` cookie on `.{tenant}.saligaffiliate.com` domain. `/track/conversion` reads `sa_aff` cookie for attribution. `/r/:code` resolves referral links.
- `convex/tracking.ts` — `recordTrackingPing` / `recordPingInternal` sets `trackingVerifiedAt` on first ping.

**Referral link display components:**
- `src/components/affiliate/ReferralLinksSection.tsx` — owner-facing, shows shortUrl/fullUrl/campaignUrl/vanityUrl with copy buttons
- `src/app/portal/links/components/ReferralLinkCard.tsx` — affiliate-facing, shows shortUrl/fullUrl/vanityUrl
- `src/app/portal/home/components/QuickLinkCard.tsx` — affiliate dashboard home, primary link display

**Welcome email:**
- `convex/affiliateAuth.ts` — builds referral URL as `https://${portalDomain}/ref/${uniqueCode}` where `portalDomain = tenant.branding?.customDomain || ${tenant.slug}.boboddy.business`
- `convex/emails.ts` — email templates that include referral URLs

**Seed data:**
- `convex/testData.ts` — creates 9 tenants, no domain field, referral URLs computed at query time using subdomain fallback
- `convex/seedBulkData.ts` — bulk data for existing tenants, creates referral links, some affiliates have vanitySlug
- `scripts/load-test-click-tracking.ts` — uses old `/track/click?code=X&t=Y` format

### Files to Reference

| File | Purpose | Change Type |
| ---- | ------- | ----------- |
| `convex/schema.ts` | Add top-level `domain: v.string()` to tenants table | Modify |
| `src/app/(unauth)/sign-up/SignUp.tsx` | Add domain form field + validation | Modify |
| `src/lib/auth.ts` | Add `domain` as Better Auth additional field | Modify |
| `convex/users.ts` | `syncUserCreation` — accept + store domain on tenant | Modify |
| `convex/tenants.ts` | `createTenant` — accept domain, add `updateTenantDomain` mutation | Modify |
| `src/lib/referral-links.ts` | Remove subdomain logic, update `getTenantDomain`, remove Full/Vanity builders | Modify |
| `convex/referralLinks.ts` | Update domain resolution (4 locations), remove Full/Vanity builders, remove vanity slug mutations | Modify |
| `public/track.js` | Add `/ref/{code}` path interception, send attribution in conversion body | Modify |
| `convex/http.ts` | `/track/click` — record click, return attribution data (no cookie set). `/track/conversion` — read attribution from body. `/r/:code` — use tenant domain | Modify |
| `convex/tracking.ts` | Domain verification logic — check ping domain matches tenant domain | Modify |
| `src/components/onboarding/TrackingSnippetInstaller.tsx` | Update snippet format, verification states | Modify |
| `src/components/affiliate/ReferralLinksSection.tsx` | Remove fullUrl/vanityUrl, add domain status warning | Modify |
| `src/app/portal/links/components/ReferralLinkCard.tsx` | Remove fullUrl/vanityUrl, add UTM builder, domain status warning | Modify |
| `src/app/portal/home/components/QuickLinkCard.tsx` | Remove vanity slug editor, update link display, domain status warning | Modify |
| `convex/affiliateAuth.ts` | Update welcome email referral URL to use `tenant.domain` | Modify |
| `convex/emails.ts` | Update email templates to use `tenant.domain` | Modify |
| `convex/testData.ts` | Add `domain` field to all 9+1 seed tenants, set `trackingVerifiedAt` | Modify |
| `convex/seedBulkData.ts` | Remove vanity slug generation | Modify |
| `scripts/load-test-click-tracking.ts` | Update URL format if needed | Verify |
| `convex/*.test.ts` (7 files) | Add `domain` to all tenant inserts | Modify |

### Technical Decisions

**ADR-1: Domain as top-level required field**
- `domain: v.string()` on tenants table — required from day one
- Not in `branding` object — it's a core business field, not cosmetic
- Validation: strip `https://`, `http://`, `www.`, trailing slashes, path segments. Reject `localhost`, IP addresses.
- Normalize to lowercase at storage time.

**ADR-2: track.js path interception**
- On page load, check `window.location.pathname` for `/ref/{code}` pattern
- Validate code against regex `^[A-HJ-NP-Z2-9]{8}$`
- Get tenantId from `data-tenant` attribute on script tag
- Call `GET /track/click?code={code}&t={tenantId}` to record click
- Set `_salig_aff` cookie on current domain via `document.cookie` (client-side, not HttpOnly)
- `window.history.replaceState({}, '', cleanPath)` to strip `/ref/{code}`
- This is SPA-compatible — no hard redirect, no framework conflicts

**ADR-3: Conversion attribution via body**
- track.js reads `_salig_aff` cookie, includes `affiliateCode` + `clickId` in `/track/conversion` POST body
- Server prefers body attribution, falls back to cookie for backwards compat during transition
- Cookie stays as client-side persistence mechanism only

**ADR-4: Simplified URL formats**
- Remove `buildFullUrl` and `buildVanityUrl` from both `src/lib/referral-links.ts` and `convex/referralLinks.ts`
- Remove `ReferralUrlSet.fullUrl` and `ReferralUrlSet.vanityUrl`
- Keep: `buildShortUrl` (primary), `buildCampaignUrl` (optional), `buildUtmUrl` (optional)
- Remove vanity slug mutations: `updateVanitySlug`, `deleteVanitySlug`
- Remove `isValidVanitySlug`, `extractVanitySlug`

**ADR-5: Domain verification**
- Reuses existing `trackingVerifiedAt` mechanism
- Additionally validate that ping domain matches tenant's declared domain (case-insensitive, ignore www.)
- Tenant can access dashboard before verification — referral link generation blocked until verified

**ADR-6: Domain changes**
- Tenant can update domain via `updateTenantDomain` mutation
- Clears `trackingVerifiedAt`, requires re-ping verification
- Referral links become inactive until re-verified
- Affiliate portal shows warning: "Tenant domain pending verification"

**ADR-7: `/track/click` no longer sets cookie**
- The server endpoint records the click and returns attribution data in the response
- track.js is responsible for setting the `_salig_aff` cookie client-side on the tenant's domain
- The server can't set a cookie on a different domain (cross-origin `Set-Cookie` doesn't work)

## Implementation Plan

### Tasks

- [ ] Task 1: Update Convex schema — add `domain` field, clean up vanity, update attribution
  - File: `convex/schema.ts`
  - Action:
    - Add `domain: v.string()` as a top-level required field on the `tenants` table. Add index `by_domain: ["domain"]`.
    - Remove `vanitySlug: v.optional(v.string())` from `referralLinks` table and remove `by_vanity_slug` index
    - Add `"body"` to `conversions.attributionSource` union: `v.union(v.literal("cookie"), v.literal("webhook"), v.literal("organic"), v.literal("body"))`
  - Notes: Domain is required from day one. All seed/test data must be updated (Tasks 14, 17) BEFORE schema push. Vanity slug field removal is safe — no production data exists yet.

- [ ] Task 2: Add `domain` as a Better Auth additional field + update database hook
  - File: `src/lib/auth.ts`
  - Action:
    - Add `domain` to `user.additionalFields` with `type: "string"`, `required: false`, `input: true` (same pattern as `companyName`)
    - Update `databaseHooks.user.create.after` callback: pass `domain` to `syncUserCreation` call — currently passes `{ email, name, companyName, authId }`, must also include `domain: (user as any).domain || undefined`
  - Notes: This is a critical dependency for Task 3 and Task 4. The hook bridges Better Auth user creation to Convex tenant creation. If domain is in additionalFields but not passed through the hook, it's silently dropped.

- [ ] Task 3: Add domain field and validation to sign-up form
  - File: `src/app/(unauth)/sign-up/SignUp.tsx`
  - Depends on: Task 2 (auth additional field must be registered first, otherwise `authClient.signUp.email()` silently drops unknown fields)
  - Action:
    - Add `domain` state variable and `<Input>` field (placeholder: `yourcompany.com`)
    - Add validation in `handleSignUp`: required, strip protocol (`https://`, `http://`), strip `www.`, strip trailing slashes, reject `localhost` and IP addresses, basic domain format check (`/^[a-z0-9.-]+\.[a-z]{2,}$/i`)
    - Pass `domain` to `authClient.signUp.email()` as additional field
    - Add helper text: "Your website URL where customers buy your product"
  - Notes: Domain is stored cleaned (no protocol, no www, no trailing slash), lowercase.

- [ ] Task 4: Update `syncUserCreation` to store domain on tenant
  - File: `convex/users.ts`
  - Action:
    - Add `domain: v.string()` to args validator (required)
    - Pass `domain` to `ctx.db.insert("tenants", { ... })` as a top-level field
    - Server-side validation: same checks as client (strip protocol, www, trailing slash, reject localhost, normalize lowercase)
    - Check domain uniqueness: query `tenants` table with `by_domain` index, throw "A tenant with this domain already exists" if found. Note: Convex indexes don't auto-enforce uniqueness — the mutation must explicitly check.
    - Throw error if domain is missing or invalid
  - Notes: Domain is required for new tenants.

- [ ] Task 5: Update `createTenant` in tenants.ts to accept domain + add `updateTenantDomain`
  - File: `convex/tenants.ts`
  - Action:
    - Add `domain: v.string()` to `createTenant` args validator, pass to tenant insert
    - Add new mutation `updateTenantDomain(domain: v.string())`:
      - Validate domain format (non-empty, valid format)
      - Reject empty strings
      - Updates `tenant.domain`
      - Clears `trackingVerifiedAt`
      - Send notification email to all active affiliates: "The merchant has updated their website domain. Your referral links will use the new domain once tracking is verified."
      - Show confirmation warning in UI before saving: "Changing your domain will break all existing referral links shared by your affiliates. This cannot be undone."
      - Returns `{ success, message }`
    - Add new mutation `updateTenantBranding` or extend existing to accept domain (for settings page UI)
  - Notes: `createTenant` is used by admin/test flows. `updateTenantDomain` is for the settings page.

- [ ] Task 6: Simplify `src/lib/referral-links.ts` — remove subdomain, Full, Vanity
  - File: `src/lib/referral-links.ts`
  - Action:
    - Rewrite `getTenantDomain` to accept a tenant object: `getTenantDomain(tenant: { domain: string }): string` → return `tenant.domain` directly. The current signature `(slug?: string | null): string` returning `{slug}.saligaffiliate.com` must be fully replaced.
    - Remove `buildFullUrl` function
    - Remove `buildVanityUrl` function
    - Remove `isValidVanitySlug` function
    - Remove `extractVanitySlug` function
    - Update `ReferralUrlSet` interface: remove `fullUrl` and `vanityUrl` fields
    - Update `buildAllUrls`: remove fullUrl generation, remove vanityUrl option
    - Keep: `buildShortUrl`, `buildCampaignUrl`, `buildUtmUrl`, `generateUniqueReferralCode`, `extractReferralCode`, `isReferralCode`
  - Notes: All callers of `getTenantDomain` must be updated to pass a tenant object instead of a slug string. Search for all call sites.

- [ ] Task 7: Simplify `convex/referralLinks.ts` — remove subdomain, Full, Vanity
  - File: `convex/referralLinks.ts`
  - Action:
    - Audit ALL domain resolution and URL-building calls in the file. At minimum these locations need updating: `generateReferralLink`, `getReferralLinks`, `getAffiliatePortalLinks`, `updateVanitySlug` (being removed). Search for `saligaffiliate.com` and `PLATFORM_DOMAIN` to find all instances.
    - Replace three-tier fallback (`customDomain > subdomain > platform`) with: `const domain = tenant.domain` — single source of truth, no fallback
    - Remove local `buildFullUrl`, `buildVanityUrl`, `isValidVanitySlug` functions
    - Remove `updateVanitySlug` and `deleteVanitySlug` mutations
    - Remove vanity slug from `generateReferralLink` mutation args and handler
    - Update `getReferralLinks` query return type: remove `fullUrl`, `vanityUrl` fields
    - Update `getAffiliatePortalLinks` query return type: remove `fullUrl`, `vanityUrl` fields
    - Remove `getReferralLinkByVanitySlug` query
    - Update all return objects to only include `shortUrl` and optional `campaignUrl`
    - Remove `PLATFORM_DOMAIN` constant
    - Change domain verification check in `generateReferralLink`: instead of throwing error when `tenant.trackingVerifiedAt` is not set, include `domainVerified: boolean` in the return object. Components show warning if `!domainVerified`. This decouples link generation from verification — tenants can generate links immediately after sign-up, with a warning that tracking isn't active yet.
  - Notes: This file has the most changes. Grep for all `saligaffiliate.com` references to ensure nothing is missed. The verification warning (not block) is better UX — lets tenants start inviting affiliates while finishing setup.

- [ ] Task 8: Extend `track.js` with `/ref/{code}` path interception
  - File: `public/track.js`
  - Action:
    - Add new method `handleReferralPath()` called synchronously in `init()` (MUST run before any async work and before framework routers can strip the path):
      1. Check `window.location.pathname` for `/ref/([A-HJ-NP-Z2-9]{8})` regex
      2. If matched, extract code, validate against `^[A-HJ-NP-Z2-9]{8}$`
      3. Get tenantId from `data-tenant` attribute on script tag (new attribute)
      4. Call `GET /track/click?code={code}&t={tenantId}` with explicit `Accept: application/json` header to get JSON response (NOT the default `*/*` which could trigger 302 fallback)
      5. On success, set `_salig_aff` cookie on current domain with attribution data (`{ affiliateCode, clickId, tenantId, timestamp }`)
      6. Strip `/ref/{code}` from URL using `window.history.replaceState({}, '', cleanPath)`
    - Wrap cookie parsing (`getAttributionData`) in try/catch — if cookie is corrupt, clear it and log warning
    - Strip `www.` from `window.location.hostname` before sending ping (handle `www.acmesaas.com` → `acmesaas.com`)
    - Update `setupClickTracking()`: skip same-domain links that contain `/ref/` in path
    - Update conversion sending (`sendConversion` or similar): include `affiliateCode` and `clickId` from cookie in POST body
    - Add `data-tenant` as required attribute — if missing, log warning and skip path interception
  - Notes: The script tag needs `data-tenant="{tenantId}"` attribute. Update snippet installer (Task 12).

- [ ] Task 9: Update `/track/click` handler — record click, return attribution data
  - File: `convex/http.ts` (lines 1330-1577 for `/track/click`, `/r/:code` handler)
  - Action:
    - Remove server-side cookie setting (`Set-Cookie` header) — track.js handles this client-side now
    - Change click recording from fire-and-forget to AWAITED: `trackClickInternal` must complete before returning the response, so the `clickId` in the JSON response is guaranteed to exist in the database
    - Return 200 JSON response with `{ success: true, attributionData: { affiliateCode, clickId, tenantId, campaignId, cookieDuration } }` for track.js to consume
    - Keep the 302 redirect as a fallback for old track.js clients: if request has `Accept: text/html` header (browser navigation), do 302 redirect to `tenant.domain`. If request has `Accept: application/json` (track.js fetch), return JSON. This is the backwards compat mechanism.
    - Update `/r/:code` endpoint: use `tenant.domain` for redirect URL instead of `{tenant.slug}.saligaffiliate.com`
    - Verify CORS headers: `/track/click` must allow cross-origin GET from any domain (`Access-Control-Allow-Origin: *`) since track.js on tenant domains makes cross-origin fetch calls
  - Notes: Content-type negotiation ensures old and new track.js coexist during deployment. The Accept header negotiation is transitional — remove the 302 fallback after all track.js instances are updated.

- [ ] Task 10: Update `/track/conversion` handler to read attribution from body
  - File: `convex/http.ts` (lines 32-379)
  - Action:
    - Add `affiliateCode` and `clickId` to the destructured body: `const { amount, orderId, customerEmail, products, metadata, affiliateCode, clickId } = body;`
    - After existing cookie parsing (line ~89 where `sa_aff` cookie is read), add a check: if `affiliateCode` is present in body, use it as the `effectiveCode` and skip cookie-based attribution
    - If body has `affiliateCode`, call `internal.clicks.validateAffiliateCodeInternal` with it (same validation path as cookie code)
    - If body has `clickId`, pass it to `internal.conversions.createConversionWithAttribution` to link the conversion to the specific click
    - If body `clickId` doesn't match a recorded click (e.g., click recording was fire-and-forget and failed), fall back to finding the most recent click for that affiliate/campaign (existing behavior in `findRecentClickInternal`)
    - Validate that `clickId` is within the campaign's attribution window — reject stale clicks older than the configured `cookieDuration` days
    - If body does NOT have `affiliateCode`, fall back to existing cookie-based attribution (backwards compat during transition)
    - When using body attribution, set `attributionSource: "body"` instead of `"cookie"`
  - Notes: During deployment transition, both old track.js (cookie) and new track.js (body) must work. The fallback to cookie ensures no conversions are lost.

- [ ] Task 11: Update tracking verification to validate domain match
  - File: `convex/tracking.ts`
  - Action:
    - In `recordTrackingPing` / `recordPingInternal`: after finding tenant by public key, normalize both `args.domain` and `tenant.domain` (lowercase, strip `www.` prefix) and require exact match
    - If domain doesn't match, return `{ success: false, message: "Domain mismatch" }` — don't set `trackingVerifiedAt`, don't record the ping
    - This ensures the snippet is installed on the correct domain
  - Notes: Domain comparison: normalize both sides (lowercase, no www.) before comparing.

- [ ] Task 12: Update tracking snippet installer UI
  - File: `src/components/onboarding/TrackingSnippetInstaller.tsx`
  - Action:
    - Update snippet to include `data-tenant="{tenantId}"` attribute: `<script src="..." data-key="sk_..." data-tenant="{tenantId}" async></script>`
    - Add version query param to CDN URL for cache busting: `track.js?v=2` (or use content hash)
    - Recommend placing snippet in `<head>` (not before `</body>`) to ensure track.js runs before framework routers strip the `/ref/` path
    - Show domain in verification status: "Verified on acmesaas.com"
    - Add warning state: "Domain changed — awaiting verification on newdomain.com"
    - Show tenant domain in the snippet description
    - Add troubleshooting tips to verification card: "If verification doesn't complete within 5 minutes, ensure the snippet is installed on a page that loads publicly, your site is accessible, and ad blockers aren't blocking the script"
  - Notes: The snippet format changes from `data-key="sk_..."` to `data-key="sk_..." data-tenant="..."`. Cache busting ensures browsers fetch the new track.js with `/ref/{code}` interception.

- [ ] Task 13: Update referral link display components
  - Files:
    - `src/components/affiliate/ReferralLinksSection.tsx`
    - `src/app/portal/links/components/ReferralLinkCard.tsx`
    - `src/app/portal/home/components/QuickLinkCard.tsx`
  - Action:
    - Remove `fullUrl` and `vanityUrl` displays from all three components
    - Keep only `shortUrl` as primary link
    - Add optional "Copy with UTM" button that appends `?utm_source=` input
    - Remove vanity slug editor from `QuickLinkCard.tsx`
    - Remove vanity slug from `ReferralLinkCard.tsx`
    - Remove vanity slug from `ReferralLinksSection.tsx`
    - Create shared component `src/components/affiliate/DomainVerificationBanner.tsx` — shows "The merchant's website domain is pending verification. Referral links are temporarily inactive." when `trackingVerifiedAt` is not set. Import and use in all three components above.
  - Notes: Domain status warning is critical for affiliate trust — they need to know why links might not work. Shared component avoids duplicated logic.

- [ ] Task 14: Update seed data — add domain to all test tenants
  - File: `convex/testData.ts`
  - Action:
    - Add `domain` field to all 9+1 tenant inserts with realistic domains:
      - TechFlow SaaS → `techflow.test`
      - GHL Agency Pro → `ghlagency.test`
      - Digital Marketing Hub → `digi.test`
      - Manila SaaS Labs → `manila-saas.test`
      - Cebu Digital Agency → `cebu-digital.test`
      - GrowthHacks PH → `growthhacks.test`
      - Pinoy Marketing Co → `pinoy-mktg.test`
      - SEAsia Tech Ventures → `seasia-tech.test`
      - Bicol Digital Solutions → `bicol-digital.test`
      - Salig Affiliate Platform → `salig-platform.test`
    - Set `trackingVerifiedAt: Date.now()` on all tenants so referral links work in dev
    - Remove any `vanitySlug` fields from affiliate inserts
  - Notes: Using `.test` TLD to avoid collisions with real domains.

- [ ] Task 15: Update seed bulk data script
  - File: `convex/seedBulkData.ts`
  - Action:
    - Remove vanity slug generation (line ~387)
    - Verify referral link inserts only use `code` field (no changes needed if so)
    - No tenant creation, so no domain field needed here
  - Notes: Mostly a cleanup pass — remove vanity slug references.

- [ ] Task 16: Update load test script
  - File: `scripts/load-test-click-tracking.ts`
  - Action:
    - The script sends requests with `Accept: text/html` by default (browser-like). Update to send `Accept: application/json` so it gets the new JSON response from `/track/click`.
    - Update response handling: expect 200 status + JSON body `{ success, attributionData }` instead of 302 redirect
    - Update URL construction if it currently builds `{baseUrl}/track/click?code=X&t=Y` — this format still works, just the response changes
  - Notes: This script is a load test for the `/track/click` endpoint. It must be updated to match the new response format.

- [ ] Task 17: Update test fixtures — add domain to tenant inserts
  - Files: `convex/payouts.test.ts`, `convex/emails.test.ts`, `convex/broadcast-log.test.ts`, `convex/audit.commission.test.ts`, `convex/commissionEngine.test.ts`, `convex/commissions.approval.test.ts`, `convex/webhooks.test.ts`
  - Action:
    - Add `domain: "test.example.com"` to all tenant inserts in test files
    - This ensures tests don't break when schema requires the field
  - Notes: Batch update across 7 test files — same pattern everywhere.

- [ ] Task 18: Update welcome email to use tenant domain
  - File: `convex/affiliateAuth.ts`
  - Action:
    - Find line ~282: `const portalDomain = tenant.branding?.customDomain || \`${tenant.slug}.boboddy.business\``
    - Replace with: `const portalDomain = tenant.domain`
    - Search for any other occurrences of `.boboddy.business` or `.saligaffiliate.com` in email-related files and replace with `tenant.domain`
    - Also check `convex/emails.ts` (or similar email template file) for any hardcoded domain references in referral URL construction
  - Notes: The `.boboddy.business` is a dev artifact. All referral URLs in emails must use `tenant.domain`.

### Acceptance Criteria

- [ ] AC 1: Given a new user on the sign-up page, when they fill in all fields including "Website URL" with `acmesaas.com`, then the tenant is created with `domain: "acmesaas.com"` and the user is redirected to `/onboarding`
- [ ] AC 2: Given a user on the sign-up page, when they enter `https://www.acmesaas.com/` as the Website URL, then the domain is cleaned to `acmesaas.com` before storage
- [ ] AC 3: Given a user on the sign-up page, when they enter `localhost` as the Website URL, then a validation error is shown and sign-up is blocked
- [ ] AC 4: Given a user on the sign-up page, when they leave the Website URL field empty, then a validation error is shown and sign-up is blocked
- [ ] AC 5: Given a tenant with `domain: "acmesaas.com"` and `trackingVerifiedAt` set, when an affiliate's referral link is generated, then the short URL is `https://acmesaas.com/ref/{code}`
- [ ] AC 6: Given a tenant with `domain: "acmesaas.com"` but no `trackingVerifiedAt`, when an affiliate's referral link is requested, then the link is generated with `domainVerified: false` and a warning is shown to the owner indicating tracking is not yet verified
- [ ] AC 7: Given a visitor on `https://acmesaas.com/ref/K7BP3M9X`, when track.js loads, then it extracts the code, calls `/track/click`, sets the `_salig_aff` cookie, and strips `/ref/K7BP3M9X` from the URL via `replaceState`
- [ ] AC 8: Given track.js has set the `_salig_aff` cookie, when a conversion occurs and track.js sends the POST to `/track/conversion`, then the `affiliateCode` and `clickId` are included in the request body and the conversion is attributed
- [ ] AC 9: Given a tenant changes their domain from `old.com` to `new.com`, when the domain update is saved, then `trackingVerifiedAt` is cleared and referral links become inactive until re-verified
- [ ] AC 10: Given a tenant's domain is not verified, when an affiliate views their portal links page, then a warning is shown indicating the tenant's domain is pending verification and referral links are temporarily inactive
- [ ] AC 11: Given the tracking snippet is installed on `acmesaas.com`, when it sends a ping with `domain: "acmesaas.com"`, and the tenant's stored domain is `acmesaas.com`, then `trackingVerifiedAt` is set and the snippet is marked as verified
- [ ] AC 12: Given the tracking snippet is installed on `wrong-site.com`, when it sends a ping with `domain: "wrong-site.com"`, and the tenant's stored domain is `acmesaas.com`, then the ping is rejected and verification is not set
- [ ] AC 13: Given the sign-up form, when the tracking snippet installer is shown, then the snippet includes `data-tenant="{tenantId}"` alongside `data-key`
- [ ] AC 14: Given seed data is run, when tenants are created, then all tenants have a `domain` field set and `trackingVerifiedAt` is set for dev convenience
- [ ] AC 15: Given an affiliate views their referral links, when links are displayed, then only `shortUrl` is shown (no fullUrl or vanityUrl)
- [ ] AC 16: Given an affiliate registers and receives a welcome email, when the email is rendered, then the referral URL uses `tenant.domain` (not `{slug}.boboddy.business`)

## Additional Context

### Dependencies

**Deployment Order (CRITICAL — must be followed exactly):**

All changes must be deployed atomically in a single deployment. The following order applies within that deployment:

1. **Schema first** (Task 1) — adds `domain` to tenants, removes `vanitySlug` from referralLinks, adds `"body"` to attributionSource union
2. **Seed data + test fixtures** (Tasks 14, 15, 17) — must be updated BEFORE schema push so inserts don't fail
3. **Backend functions** (Tasks 4, 5, 7, 9, 10, 11, 18) — all Convex mutations/queries/HTTP handlers updated to use new schema
4. **Auth layer** (Task 2) — Better Auth additional field + database hook updated
5. **Frontend** (Tasks 3, 6, 12, 13) — sign-up form, referral link utils, components
6. **Client-side tracking** (Task 8) — track.js deployed (backwards compatible via Accept header negotiation)

**Why atomic:** Schema requires `domain: v.string()` (required). If schema pushes without seed data + backend code updates, all tenant creation crashes. All changes MUST go in one deployment.

**Runtime dependencies:**
- Task 3 depends on Task 2 (auth additional field must exist before form can pass it)
- Task 4 depends on Task 2 (hook must pass domain to syncUserCreation)
- Task 7 depends on Task 1 (schema must have domain field before referralLinks.ts uses it)
- Task 8 depends on Task 9 (track.js calls /track/click which must return JSON)
- Task 14 depends on Task 1 (schema must accept domain before seed data inserts it)
- Task 17 depends on Task 1 (schema must accept domain before test inserts)
- Task 18 depends on Task 1 (must have domain field to read tenant.domain)

### Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| SPA framework conflicts with path interception | Tenants' sites break | Use `history.replaceState` — no hard redirect, SPA-compatible |
| Tenant enters malformed domain | Broken referral links | Validate at form + mutation level; strip protocol, trailing slashes, paths, normalize lowercase |
| Domain change breaks shared affiliate links | Affiliates lose traffic | Domain re-verification required; affiliate portal shows warning |
| Cross-domain cookie issue | Conversions unattributed | Attribution data sent in POST body by track.js |
| Tenant hasn't installed snippet | `/ref/{code}` path 404s | Domain verification blocks link generation |
| track.js deployed before backend changes | Mixed state during deployment | track.js is backwards compatible — old flow still works |
| `/track/click` response format change | Load test / consumers break | Update load test script; update any other consumers |

### Testing Strategy

**Schema testing:**
- Run `npx convex dev` after schema change — confirm no errors
- Verify all seed data inserts include `domain` field

**Sign-up flow testing:**
- Test sign-up with valid domain (e.g., `acmesaas.com`) → tenant created with domain
- Test sign-up with `https://www.acmesaas.com/` → cleaned to `acmesaas.com`
- Test sign-up with `localhost` → rejected
- Test sign-up with empty domain → rejected

**Referral link generation testing:**
- Generate referral link for verified tenant → `https://acmesaas.com/ref/{code}`
- Generate referral link for unverified tenant → error returned
- Verify no subdomain URLs are generated anywhere

**track.js testing:**
- Load page with `/ref/{code}` in URL → code extracted, cookie set, URL cleaned
- Load page without `/ref/` → no interception, normal behavior
- Test with SPA router (Next.js) → no conflicts
- Verify `data-tenant` attribute is read correctly

**Conversion tracking testing:**
- Send conversion with `affiliateCode` in body → attributed correctly
- Send conversion without body attribution → falls back to cookie (backwards compat)

**Domain verification testing:**
- Ping from matching domain → verification set
- Ping from non-matching domain → verification rejected

**Seed data testing:**
- Run `npx convex run testData:seedAllTestData` → all tenants have domain + trackingVerifiedAt
- Verify referral links resolve to tenant domains

**Component testing:**
- Referral link cards show only shortUrl
- No vanity slug editors visible
- Domain status warnings show when tenant domain unverified
- Welcome email shows correct referral URL

### Notes

- The welcome email in `convex/affiliateAuth.ts` builds referral URL with `${tenant.slug}.boboddy.business` — this is a dev artifact that must be fixed to use `tenant.domain` (Task 18)
- The `/r/:code` endpoint in `convex/http.ts` resolves domain for redirect — covered in Task 9, must use `tenant.domain` instead of subdomain
- Domain is required from day one — no optional→required migration needed. All seed/test data updated before schema push.
- The `convex/tenants.ts` `createTenant` internalMutation is used by admin/test flows — must accept `domain` arg (Task 5). Any callers of `createTenant` must also be updated to pass domain.
- The `getTenantDomain` function in `src/lib/referral-links.ts` changes signature from `(slug: string) => string` to `(tenant: { domain: string }) => string` — all callers must be updated (Task 6)
- track.js `/ref/{code}` interception sends `Accept: application/json` header to get JSON response from `/track/click`. Browser navigations (direct URL visits) send `Accept: text/html` and get 302 redirect. This content-type negotiation provides backwards compat during deployment.
- Consider adding a "Set up your domain" onboarding step if the tenant somehow gets past sign-up without a domain
- **Known limitation:** If a visitor has JavaScript disabled, track.js doesn't run. The `/ref/{code}` URL stays in the address bar and the tenant's site shows a 404 (since their app doesn't handle `/ref/` routes). This affects <1% of traffic. Mitigation: tenants can add a server-side fallback route `/ref/:code` that redirects to their homepage. Document this in the tracking snippet installer.
- **Attribution model:** Last-click attribution. If a visitor clicks two affiliate links in the same session, the second click overwrites the cookie. This is standard and expected behavior.
- **Domain change irreversibility:** Changing a tenant's domain permanently breaks all existing referral links shared on the old domain. There is no redirect mechanism — we don't control the tenant's DNS. The tenant must be warned before saving.
- **Server-side redirects:** If the tenant's domain has a server-side redirect (e.g., `acmesaas.com` → `app.acmesaas.com`) that strips the URL path, referral tracking will break. The `/ref/{code}` path is lost during the redirect. Document this as a tenant configuration requirement.
