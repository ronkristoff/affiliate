---
title: "Migrate Auth to Better Auth — Full Doc Alignment"
slug: "better-auth-full-migration"
created: "2026-04-08"
status: "ready-for-dev"
  stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - "Next.js 16.1.0"
  - "Convex 1.32.0"
  - "Better Auth 1.5.3 (target)"
  - "@convex-dev/better-auth 0.10.13 (pinned)"
  - "TypeScript 5.9.3"
  - "React 19.2.3"
files_to_modify:
  - "convex/auth.config.ts"
  - "convex/auth.ts"
  - "convex/http.ts"
  - "convex/affiliateAuth.ts"
  - "convex/affiliates.ts"
  - "convex/schema.ts"
  - "convex/testData.ts"
  - "convex/seedAuthUsers.ts"
  - "src/lib/auth.ts"
  - "src/lib/auth-client.ts"
  - "src/lib/affiliate-auth-client.ts"
  - "src/lib/affiliate-auth.test.ts"
  - "src/lib/auth-server.ts (NEW)"
  - "src/app/api/auth/[...all]/route.ts"
  - "src/app/api/affiliate-auth/route.ts"
  - "src/app/ConvexClientProvider.tsx"
  - "src/app/layout.tsx"
  - "src/proxy.ts"
  - "src/app/(unauth)/sign-in/SignIn.tsx"
  - "src/app/(unauth)/sign-up/SignUp.tsx"
  - "src/app/portal/account/components/PasswordSection.tsx"
  - "src/app/reset-password/page.tsx"
  - "src/app/portal/forgot-password/page.tsx (NEW)"
  - "src/app/portal/home/page.tsx"
  - "src/app/portal/links/page.tsx"
  - "src/app/portal/earnings/page.tsx"
  - "src/app/portal/assets/page.tsx"
  - "src/app/portal/account/page.tsx"
  - "src/components/affiliate/AffiliateSignInForm.tsx"
  - "src/components/affiliate/AffiliateSignUpForm.tsx"
  - "package.json"
  - "AGENTS.md"
  - "_bmad-output/project-context.md"
code_patterns:
  - "createAuth factory pattern (convex/auth.ts)"
  - "createClient component pattern (convex/auth.ts)"
  - "ConvexBetterAuthProvider with initialToken"
  - "convexBetterAuthNextJs server utilities"
  - "preloadAuthQuery / usePreloadedAuthQuery for SSR"
  - "betterAuthComponent.getAuthUser(ctx) for session reads"
  - "authComponent.adapter(ctx) for DB access"
  - "better-auth/minimal import"
  - "Two-step sign-up: authClient.signUp.email() + completeSignUp/completeAffiliateSignUp"
  - "databaseHooks.user.create.after for user-to-app-table routing"
  - "ReCaptchaWrapper for bot protection on sign-up forms"
  - "rateLimit plugin for sign-in protection (5/min per email, 20/min per IP)"
  - "Email trim+lowercase at form layer + defensive trim in mutations"
  - "Type re-export pattern: src/lib/auth.ts re-exports types from convex/auth.ts"
  - "Orphaned user recovery: detect session → skip sign-up → retry completeAffiliateSignUp"
  - "Affiliate forgot password: callbackURL routing keeps redirect chain within /portal/"
  - "getCurrentAffiliate with optional tenantSlug filter for multi-tenant safety"
test_patterns: []
---

# Tech-Spec: Migrate Auth to Better Auth — Full Doc Alignment

**Created:** 2026-04-08

**Reference Documentation:**
- Convex + Better Auth Next.js Guide: https://labs.convex.dev/better-auth/framework-guides/next
- Better Auth Component Docs: https://www.convex.dev/components/better-auth
- Better Auth API Docs: https://www.better-auth.com/docs/concepts/api

## Overview

### Problem Statement

The app has two auth systems: SaaS Owners and Platform Admins use Better Auth (but with patterns that deviate from official docs), and Affiliates use a hand-rolled auth system (localStorage sessions, SHA-256 hashing, no CSRF/rate-limiting). The goal is to fully align all auth with the official Convex + Better Auth Next.js guide at `labs.convex.dev/better-auth/framework-guides/next`, migrating the entire app to a single, production-grade Better Auth layer.

### Solution

Refactor SaaS Owner/Platform Admin auth to match the official documentation patterns exactly, then migrate affiliate auth from the custom system onto Better Auth — replacing localStorage sessions with Better Auth cookie sessions, SHA-256 with scrypt, and custom route handlers with the standard `auth-server.ts` utilities. All three user types (SaaS Owner, Platform Admin, Affiliate) will authenticate through Better Auth.

### Scope

**In Scope:**

*SaaS Owner / Platform Admin Auth (Doc Alignment):*
> All changes in this section follow patterns from https://labs.convex.dev/better-auth/framework-guides/next

- `convex/auth.config.ts` — Replace current `providers` array (wrapping `CONVEX_SITE_URL` with `applicationID: "convex"`) with `getAuthConfigProvider()` from `@convex-dev/better-auth/auth-config` ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#add-convex-auth-config))
- `convex/auth.ts` — Absorb `createAuth` factory, switch to `better-auth/minimal` ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#create-a-better-auth-instance))
- `src/lib/auth.ts` — Remove `createAuth`; keep only what client-side needs (or eliminate)
- `src/lib/auth-server.ts` — Create with `convexBetterAuthNextJs` utilities (`handler`, `preloadAuthQuery`, `isAuthenticated`, `getToken`, `fetchAuthQuery`, `fetchAuthMutation`, `fetchAuthAction`) ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#configure-nextjs-server-utilities))
- `src/app/api/auth/[...all]/route.ts` — Simplify to `export const { GET, POST } = handler` ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#mount-handlers))
- `src/app/ConvexClientProvider.tsx` — Add `initialToken` prop ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#set-up-convex-client-provider))
- `convex/http.ts` — Update `createAuth` import to new location ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#mount-handlers))
- `package.json` — Upgrade `better-auth` to `1.5.3` (pinned) AND pin `@convex-dev/better-auth` to `0.10.13` (remove caret range) ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#install-packages))
- Clean up unused imports (`convexAdapter`)
- Refactor `proxy.ts` to use `isAuthenticated()` from `auth-server.ts` ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#configure-nextjs-server-utilities))
- Wire `initialToken` through `layout.tsx` SSR ([doc reference](https://labs.convex.dev/better-auth/framework-guides/next#ssr-with-server-components))
- Validate `initialToken` is not expired before passing to `ConvexBetterAuthProvider` — pass `null` if expired to avoid flash of authenticated content

*Affiliate Auth Migration:*
> Affiliates will use the same Better Auth instance as SaaS Owners. The `authClient` from `src/lib/auth-client.ts` handles sign-in/sign-up for all user types. See https://labs.convex.dev/better-auth/framework-guides/next#create-a-better-auth-client-instance

**Affiliate sign-up uses a two-step flow** (same pattern as SaaS Owner's `SignUp.tsx` + `completeSignUp`):
1. Client calls `authClient.signUp.email({ email, password, name, additionalFields: { userType: "affiliate" } })` — Better Auth creates user + account
2. Client calls `completeAffiliateSignUp({ email, tenantSlug, campaignSlug, promotionChannel, recaptchaToken })` — Convex action validates reCAPTCHA, creates affiliate record
3. `databaseHooks.user.create.after` creates a minimal `users` record (or no-op for affiliates — routing handled by `completeAffiliateSignUp`)
4. Error handling: if `completeAffiliateSignUp` fails (reCAPTCHA invalid, tenant not found), the Better Auth user exists but no affiliate record — display error to user and offer to retry or contact support

- Migrate affiliate login to use Better Auth sign-in (`authClient.signIn.email`)
- Migrate affiliate registration to use Better Auth sign-up (`authClient.signUp.email`) + `completeAffiliateSignUp` action (two-step)
- Replace localStorage sessions with Better Auth cookie sessions
- Replace SHA-256 hashing with Better Auth scrypt
- Update `convex/affiliateAuth.ts` to use `betterAuthComponent` session consistently
- Add `userType: "affiliate"` via `additionalFields` on affiliate signup to route `databaseHooks` correctly
- Create `completeAffiliateSignUp` action in `convex/affiliateAuth.ts` (validates reCAPTCHA, creates affiliate record with tenant context — replaces `registerAffiliateAccount`)
- `completeAffiliateSignUp` must handle duplicate email gracefully — if affiliate record already exists for that tenant, return existing record (not an error)
- `AffiliateSignUpForm` must detect existing session (`authClient.getSession()`) — if authenticated, show "Join this program" flow that skips `authClient.signUp.email()` and calls `completeAffiliateSignUp` directly (handles multi-tenant affiliate sign-up)
- `getCurrentAffiliate` must accept optional `tenantSlug` filter — without it, `by_email` index may return wrong tenant's affiliate record
- Hardening: ensure every affiliate-facing query/mutation checks `affiliate.status !== "pending"` (not just session validity)
- Replace or remove `src/lib/affiliate-auth-client.ts`
- Replace or remove `src/app/api/affiliate-auth/route.ts`
- Update affiliate portal pages to use `authClient` instead of custom `useAffiliateAuth` hook
- Update affiliate route protection to use `isAuthenticated()` from `auth-server.ts`
- Preserve existing affiliate approval workflow (`status: "pending"` → approved)
- Add "pending approval" redirect page for affiliates who are registered but not yet approved

*Affiliate Password Management (currently missing or custom):*
> All password operations should use Better Auth's built-in APIs. See https://www.better-auth.com/docs/concepts/api for the full API reference.

- **Forgot/reset password** — No flow exists for affiliates currently. Add `/portal/forgot-password` page using `authClient.forgetPassword()`. Must pass `callbackURL` with tenant slug (`/portal/login?tenant=<slug>`) so password reset redirects back to the affiliate portal, not the SaaS Owner dashboard. Create dedicated `/portal/reset-password` page that uses the same Better Auth token but redirects to `/portal/login?tenant=` after reset. Add `/portal/forgot-password` to public routes in `proxy.ts`. ([Better Auth forgetPassword API](https://www.better-auth.com/docs/concepts/api#forget-password))
- **Change password** — Currently uses custom `changeAffiliatePassword` mutation in `convex/affiliateAuth.ts` (SHA-256 hashing via custom `hashPassword`, writes to `affiliates.passwordHash`). Replace with Better Auth's `auth.api.changePassword` via a Convex mutation (same pattern as SaaS Owner's `updateUserPassword`). Remove the custom mutation. ([Better Auth changePassword API](https://www.better-auth.com/docs/concepts/api#change-password))
- **Password reuse check** — Currently only applies to SaaS Owners via `checkResetPasswordReuse` in `convex/auth.ts`. After migration, extend this to also work for affiliates (same Better Auth verification table).
- **Set password on approval** — `setAffiliatePassword` mutation in `convex/affiliates.ts` (line 1440) lets owners set passwords for newly approved affiliates with no existing password. After migration, this should use Better Auth's admin API to set the user's password (or create the `account` record via adapter factory with a random scrypt hash, then send a password reset email).
- **Owner-initiated affiliate registration** — `registerAffiliate` mutation in `convex/affiliates.ts` (line 988) lets authenticated SaaS Owners create affiliate records with a `passwordHash`. After migration, this mutation must be replaced: the owner creates the affiliate record (name, email, status) but does NOT pass a password. Instead, a Better Auth `user` + `account` record is created with a temporary random password, and a "set your password" email is sent to the affiliate. The affiliate clicks the link to set their own password via the standard Better Auth reset flow. The mutation is renamed to `createAffiliateByOwner` with updated args (no `passwordHash`).

*Affiliate Session Cleanup (schema + code):*
- **Remove `affiliateSessions` table** from `convex/schema.ts` — No longer needed (Better Auth manages sessions)
- **Remove `affiliates.passwordHash` field** from `convex/schema.ts` — No longer needed (Better Auth stores password hashes in its component `account` table)
- **Remove `authenticateAffiliate` query** in `convex/affiliates.ts` (line 1283) — Custom password hash comparison, replaced by Better Auth
- **Remove `registerAffiliate` mutation** in `convex/affiliates.ts` (line 988) — Accepts `passwordHash` directly; replaced by new `createAffiliateByOwner` mutation (see below)
- **Remove `updateAffiliatePassword` mutation** in `convex/affiliates.ts` (line 1396) — Custom password update, replaced by Better Auth
- **Remove `setAffiliatePassword` mutation** in `convex/affiliates.ts` (line 1440) — Custom password set, replaced by Better Auth
- **Remove `loginAffiliate` mutation** in `convex/affiliateAuth.ts` (line 566) — Custom login with session token, replaced by Better Auth sign-in
- **Remove `validateAffiliateSession` query** in `convex/affiliateAuth.ts` (line 649) — Custom session lookup, replaced by `betterAuthComponent.getAuthUser`
- **Remove `logoutAffiliate` mutation** in `convex/affiliateAuth.ts` (line 696) — Custom session deletion, replaced by `authClient.signOut()`
- **Remove `createAffiliateSession` helper** in `convex/affiliateAuth.ts` — Session creation, replaced by Better Auth
- **Remove `requestAffiliatePasswordReset` mutation** in `convex/affiliateAuth.ts` (line 835) — MVP stub, replaced by Better Auth `forgetPassword`
- **Update `getCurrentAffiliate` query** in `convex/affiliateAuth.ts` — Currently checks `affiliateSessions` table. Replace with `betterAuthComponent.getAuthUser(ctx)` + `affiliates` table lookup
- **Update seed data** — Remove `affiliateSessions` and `passwordHash` from seed config (`convex/testData.ts`, `convex/seedAuthUsers.ts`)
- **Keep `validateRecaptchaToken`** in `convex/affiliateAuth.ts` — Bot protection still needed, can be called before Better Auth sign-up

*Data Migration:*
- Create one-time Convex action to migrate existing affiliates to Better Auth user + account records
- Send password reset emails to all existing affiliates (SHA-256 hashes are not scrypt-compatible)
- Clean up old `affiliate_session` cookie and localStorage data
- Create utility to detect orphaned Better Auth users (user record exists but no matching `users` or `affiliates` record) — useful for cleaning up failed `completeAffiliateSignUp` attempts

*Version Upgrade:*
- Upgrade `better-auth` from `1.4.9` → `1.5.3` (pinned) as ISOLATED first step
- Verify `@convex-dev/better-auth@0.10.13` adapter compatibility before proceeding
- Verify `databaseHooks.user.create.after` still fires correctly after upgrade

*Documentation:*
- Update `AGENTS.md` and `project-context.md` to reflect new patterns

*Input Sanitization (trim + lowercase):*
- **Bug:** Leading/trailing spaces in email fields cause silent failures — `"john@example.com "` doesn't match `"john@example.com"` in lookups, creates duplicate accounts, and breaks sign-in
- Trim + lowercase all email fields before calling `authClient.signIn.email()`, `authClient.signUp.email()`, `authClient.forgetPassword()`, `authClient.resetPassword()`
- Trim all name fields (firstName, lastName, companyName) before submission
- Apply to ALL auth forms: `SignIn.tsx`, `SignUp.tsx`, `AffiliateSignInForm.tsx`, `AffiliateSignUpForm.tsx`, `reset-password/page.tsx`, `portal/forgot-password/page.tsx`
- Add defensive `.trim().toLowerCase()` in `databaseHooks.user.create.after` for the email field (safety net)
- Add defensive `.trim().toLowerCase()` in `completeSignUp` and `completeAffiliateSignUp` mutations (safety net)
- Update `getUserTypeByEmail` and `getAuthenticatedUserType` queries to trim email before lookup

*Anti-Spam Protection (reCAPTCHA):*
- **Bug:** SaaS Owner sign-up (`SignUp.tsx`) and sign-in (`SignIn.tsx`) have NO bot protection — open to account creation abuse and credential stuffing
- Add reCAPTCHA v3 to SaaS Owner sign-up (`SignUp.tsx`) — wrap with `ReCaptchaWrapper`, validate token in `completeSignUp` mutation
- Add Better Auth `rateLimit` plugin for sign-in protection (`SignIn.tsx`) — reCAPTCHA on sign-in adds latency and doesn't prevent direct API abuse; rate limiting is the correct protection. Configure `rateLimit()` in `createAuth` with limits on `sign-in.email` endpoint (e.g., 5 attempts per minute per email, 20 per IP). See TD-6a.
- Keep reCAPTCHA on affiliate sign-up (move validation from `registerAffiliateAccount` to `completeAffiliateSignUp` action)
- `ReCaptchaWrapper` component already exists at `src/components/ui/ReCaptchaWrapper.tsx` — reuse it

**Out of Scope:**
- Adding auth capabilities that don't exist today (new plugins, new flows beyond replicating what's already there), with the exception of `rateLimit` plugin for sign-in (replacing the originally planned reCAPTCHA-on-sign-in approach)

## Context for Development

### Codebase Patterns

**Auth Architecture (Current State):**
- Two auth systems: SaaS Owner/Platform Admin via Better Auth, Affiliates via custom system
- `src/lib/auth.ts` contains the `createAuth` factory (imports from `convex/` — cross-boundary)
- `convex/auth.ts` contains the component client (`betterAuthComponent`) and all session queries
- `src/lib/auth-client.ts` creates the client-side `authClient` with plugins
- `convex/affiliateAuth.ts` has its own session management (`affiliateSessions` table, `createAffiliateSession`, `validateSessionToken`) PLUS some functions already using `betterAuthComponent.getAuthUser(ctx)` (`getCurrentAffiliate`)
- `src/proxy.ts` uses `getSessionCookie` from `better-auth/cookies` for route protection — works for both owner and affiliate (single cookie check, role resolved at Convex layer)
- User type resolution: `getUserTypeByEmail` and `getAuthenticatedUserType` queries in `convex/auth.ts` check both `users` and `affiliates` tables by email

**Auth Architecture (Target State per Docs):**
- `convex/auth.ts` contains BOTH `betterAuthComponent` AND `createAuth` factory (no cross-boundary import)
- `src/lib/auth-server.ts` contains `convexBetterAuthNextJs` server utilities (`handler`, `isAuthenticated`, `getToken`, `preloadAuthQuery`, etc.)
- `src/app/api/auth/[...all]/route.ts` exports `const { GET, POST } = handler` (no sign-out workaround)
- `src/app/ConvexClientProvider.tsx` accepts `initialToken` prop for SSR hydration
- `proxy.ts` uses `isAuthenticated()` from `auth-server.ts` instead of `getSessionCookie`
- All password operations (forgot, reset, change) go through Better Auth APIs for all user types
- No `affiliateSessions` table, no `affiliates.passwordHash` field, no custom password hashing

**Key Patterns to Preserve:**
- `databaseHooks.user.create.after` — Syncs user to app tables after Better Auth creates the user
- `databaseHooks.user.delete.after` — Syncs user deletion; **must also check `affiliates` table** and patch matching records to `status: "removed"` (prefer soft-delete over hard-delete to avoid removing multi-tenant affiliates on other tenants)
- `betterAuthComponent.getAuthUser(ctx)` — Session reads in Convex queries
- `betterAuthComponent.adapter(ctx)` — DB access for component tables (via factory pattern)
- User type discrimination: check `users` table first, then `affiliates` table by email
- Affiliate approval workflow: `status: "pending"` → approved by owner
- reCAPTCHA validation on affiliate registration (keep `validateRecaptchaToken`)
- Tenant-scoped branding on portal pages (resolve via `?tenant=` slug param)

**Key Code Changes Required:**

| File | Current Pattern | Target Pattern |
|------|----------------|----------------|
| `src/lib/auth.ts` | Contains `createAuth`, imports `betterAuth` from `better-auth` | Remove `createAuth` entirely; keep as thin type re-export file for `src/` consumers (TD-8) |
| `convex/auth.ts` | Has `betterAuthComponent` + queries only | Absorb `createAuth` factory + import from `better-auth/minimal` + export `authWithoutCtx` type |
| `convex/auth.config.ts` | `providers` array with `CONVEX_SITE_URL` + `applicationID: "convex"` (Convex component format) | `getAuthConfigProvider()` from `@convex-dev/better-auth/auth-config` |
| `src/lib/auth-client.ts` | `inferAdditionalFields<typeof authWithoutCtx>()` | Update import path to point to `convex/auth.ts` |
| `src/proxy.ts` | `getSessionCookie(request)` from `better-auth/cookies` | `isAuthenticated(request)` from `auth-server.ts` |
| `src/app/api/auth/[...all]/route.ts` | Custom sign-out cookie workaround | `export const { GET, POST } = handler` |
| `src/app/ConvexClientProvider.tsx` | No `initialToken` prop | Accept and pass `initialToken` |
| `convex/affiliateAuth.ts` | `registerAffiliateAccount` action hashes password with SHA-256, calls `createAffiliateAccountInternal` with `passwordHash` | Two-step flow: `authClient.signUp.email()` on client + new `completeAffiliateSignUp` action (reCAPTCHA + affiliate record creation) (TD-7) |
| `convex/affiliateAuth.ts` | `loginAffiliate` mutation with custom session token | Removed (use `authClient.signIn.email`) |
| `convex/affiliateAuth.ts` | `changeAffiliatePassword` mutation with SHA-256 hashing | Removed (use Better Auth `changePassword`) |
| `convex/affiliates.ts` | `registerAffiliate`, `authenticateAffiliate`, `updateAffiliatePassword`, `setAffiliatePassword` mutations | Remove auth functions; replace `registerAffiliate` with `createAffiliateByOwner` (no password, sends reset email) |
| `convex/schema.ts` | `affiliates.passwordHash` field, `affiliateSessions` table | Remove both |
| `src/components/affiliate/AffiliateSignUpForm.tsx` | Calls `api.affiliateAuth.registerAffiliateAccount` action | Two-step: detect session → if authenticated, "join program" flow (skip sign-up); if not, `authClient.signUp.email()` + `completeAffiliateSignUp()`. Handle retry on failure. |
| `src/components/affiliate/AffiliateSignInForm.tsx` | Already uses `authClient.signIn.email()` | Add forgot password link pointing to `/portal/forgot-password?tenant=`, add email trim |
| `src/app/(unauth)/sign-in/SignIn.tsx` | No reCAPTCHA, no email trim | Add email trim (no reCAPTCHA — sign-in uses server-side rate limiting via `rateLimit` plugin) |
| `src/app/(unauth)/sign-up/SignUp.tsx` | No reCAPTCHA on auth, email trimmed before `completeSignUp` but NOT before `authClient.signUp` | Add `ReCaptchaWrapper`, validate in `completeSignUp`, trim email before BOTH `authClient.signUp` AND `completeSignUp` calls |
| `src/app/portal/account/page.tsx` | `useMutation(api.affiliateAuth.changeAffiliatePassword)` | Use Better Auth `authClient.changePassword()` |
| `src/app/portal/account/components/PasswordSection.tsx` | Custom `onChangePassword(affiliateId, newPassword)` prop, no current password | Remove `onChangePassword` and `affiliateId` props; add `currentPassword` field; call `authClient.changePassword()` directly |
| `src/lib/affiliate-auth-client.ts` | `useAffiliateAuth()` hook, `hashPassword()`, localStorage session | Remove entirely (replaced by `authClient`) |
| `src/app/api/affiliate-auth/route.ts` | Custom login/logout endpoints with `affiliate_session` cookie | Remove entirely (replaced by Better Auth route handler) |
| `src/app/portal/forgot-password/page.tsx` | Does not exist | Create new page using `authClient.forgetPassword()` |
| `src/app/portal/pending/page.tsx` | Does not exist | Create new page for pending approval redirect |

**Existing Tests Affected:**
- `convex/affiliateAuth.test.ts` — Tests `registerAffiliateAccount`, reCAPTCHA validation, `loginAffiliate`, `validateAffiliateSession`, `requestAffiliatePasswordReset` (many will need updates/removal)
- `src/lib/affiliate-auth.test.ts` — Tests `hashPassword` (SHA-256), `isAffiliateRoute`, `isAffiliateAuthRoute` (remove `hashPassword` tests, keep route helpers)
- `src/components/affiliate/AffiliateSignUpForm.test.tsx` — Tests registration flow including reCAPTCHA (update to match new `authClient.signUp` flow)
- `src/app/portal/register/page.test.tsx` — Tests portal register page (update if form API changes)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/auth.ts` | Component client, session queries, user type resolution, password reuse check |
| `src/lib/auth.ts` | `createAuth` factory (to be moved), plugin config, `databaseHooks`, `authWithoutCtx` type |
| `src/lib/auth-client.ts` | Client-side `authClient` with plugins |
| `src/lib/auth-server.ts` | NEW: `convexBetterAuthNextJs` server utilities |
| `convex/auth.config.ts` | Convex auth config (to be migrated to `getAuthConfigProvider()`) |
| `convex/http.ts` | HTTP route mounting for Better Auth |
| `convex/affiliateAuth.ts` | Affiliate session management (to be removed), `getCurrentAffiliate` (to be updated), `registerAffiliateAccount` (to be removed), `validateRecaptchaToken` (to be kept), dashboard queries (to be kept) |
| `convex/affiliates.ts` | `registerAffiliate` (to be removed), `authenticateAffiliate` (to be removed), `updateAffiliatePassword` (to be removed), `setAffiliatePassword` (to be removed), `setAffiliateStatus` (to be kept — approval workflow), non-auth mutations (to be kept) |
| `convex/schema.ts` | `affiliates.passwordHash` (to be removed), `affiliateSessions` (to be removed) |
| `convex/users.ts` | `syncUserCreation` mutation (to be extended for affiliate routing) |
| `src/proxy.ts` | Route protection middleware (to be updated to use `isAuthenticated()`) |
| `src/app/ConvexClientProvider.tsx` | React provider (to add `initialToken` prop) |
| `src/app/api/auth/[...all]/route.ts` | Auth API route (to be simplified) |
| `src/app/api/affiliate-auth/route.ts` | Custom affiliate auth API (to be removed) |
| `src/lib/affiliate-auth-client.ts` | Custom affiliate auth client (to be removed) |
| `src/components/affiliate/AffiliateSignInForm.tsx` | Already uses `authClient.signIn.email()` (minor update: add forgot password link) |
| `src/components/affiliate/AffiliateSignUpForm.tsx` | Uses custom `registerAffiliateAccount` action (major update: use `authClient.signUp.email()`) |
| `src/app/portal/account/page.tsx` | Uses `changeAffiliatePassword` mutation (update to use Better Auth `changePassword`) |
| `src/app/portal/account/components/PasswordSection.tsx` | Custom password change UI (update to accept `currentPassword`) |
| `convex/testData.ts` | Seed data including `affiliateSessions` and `passwordHash` (to be updated) |
| `convex/seedAuthUsers.ts` | Auth user seeding with `passwordHash` (to be updated) |
| `convex/email.tsx` | Email dispatch including `resetPassword` type (verify works for affiliates) |
| `src/app/reset-password/page.tsx` | Reset password page (already uses `authClient.resetPassword()` — reusable for affiliates) |

### Technical Decisions

#### TD-1: User Type Discrimination Strategy

**Decision:** Separate lookup tables, single auth session (Option B)

Better Auth handles authentication only (sessions, password hashing, CSRF). App tables (`users` for owners/admins, `affiliates` for affiliates) handle authorization (roles, tenant membership, approval status). The `databaseHooks.user.create.after` hook routes to the correct table based on signup context.

**Rationale:**
- Preserves existing data model — no schema migration needed for `users` or `affiliates` tables
- Clean separation of concerns — Better Auth doesn't need to know about user types
- Each table has its own tenant scoping (`tenantId` on `users`, `tenantId` on `affiliates`)
- Session lookup checks BOTH tables: first `users`, then `affiliates`, to determine which context the user is in

**Implementation note:** Signup context can be passed via `additionalFields` (e.g., a `userType: "affiliate"` field) or by which signup route is called. The `databaseHooks.user.create.after` hook reads this field and syncs to the appropriate table.

#### TD-2: Affiliate Approval Workflow Post-Migration

**Decision:** Allow session, redirect to "pending approval" page (Option C)

After registration, Better Auth creates the user and session immediately. The affiliate record is created with `status: "pending"`. When the affiliate tries to access the portal, the auth check verifies session validity AND checks `affiliates.status !== "pending"`. Pending affiliates get redirected to a dedicated "Your account is pending approval" page.

**Rationale:**
- Best UX — affiliate gets immediate confirmation that registration worked
- Uses existing pattern — `useAffiliateAuth` already has `isPending` state
- Better Auth handles password reset, email verification etc. even while pending
- No complex "create user later" logic needed

**Hardening requirement:** Every affiliate-facing query/mutation in `convex/affiliateAuth.ts` MUST verify `affiliate.status !== "pending"` in addition to session validity. A pending affiliate must not be able to access portal data.

> **Server code pattern:** When calling Better Auth's `auth.api.*` methods from Convex mutations/actions, use the `authComponent.getAuth(createAuth, ctx)` pattern documented at https://labs.convex.dev/better-auth/framework-guides/next#using-better-auth-in-server-code

#### TD-3: Existing Affiliate Data Migration

**Decision:** One-time migration script with forced password reset (Option A + password reset)

Write a Convex action that creates Better Auth `user` + `account` records for every existing affiliate. Since current passwords are hashed with SHA-256 (not scrypt), existing password hashes cannot be reused. All existing affiliates will receive a password reset email to set a new password.

**Rationale:**
- Clean cutover — no lazy migration complexity or first-login friction
- Security baseline — all passwords reset to scrypt-hashed values
- Acceptable for current user base size (seed data + small real user count)

**Migration steps:**
1. Create Better Auth `user` record for each existing affiliate (via adapter factory)
2. Create a `verification` record with a password reset token (via adapter factory)
3. Send password reset email via existing email service
4. Remove old `affiliate_session` data and localStorage references
5. Delete or deprecate `src/lib/affiliate-auth-client.ts` and `src/app/api/affiliate-auth/route.ts`

#### TD-4: Multi-Tenant Session Isolation

**Decision:** Single session cookie, tenant resolved per-request

Both SaaS Owners and Affiliates share the `better-auth.session_token` cookie. Since an email can exist in BOTH `users` and `affiliates` tables (on different tenants), the session lookup must check both tables and determine the user's context. The `proxy.ts` / auth middleware handles routing based on which context is found.

**Edge case:** A user who is both an owner AND an affiliate — the routing logic (already in `proxy.ts`) checks the requested path to determine which context to use. Owner routes → `users` table. Portal routes → `affiliates` table.

**Cookie namespace:** No collision because there's only ONE Better Auth session per email. The user is authenticated — which "app" they access is determined by route, not by separate cookies.

#### TD-5: Version Upgrade Verification

**Decision:** Upgrade `better-auth` FIRST, verify in isolation before any other changes.

The version upgrade from 1.4.9 → 1.5.3 must be done as an isolated step:
1. Pin `"better-auth": "1.5.3"` in `package.json`
2. Pin `"@convex-dev/better-auth": "0.10.13"` in `package.json` (remove caret range — prevent patch-level surprises)
3. Run `pnpm install`
3. Verify `@convex-dev/better-auth@0.10.13` adapter still works (run `pnpm dev`, sign in, sign out)
4. Verify `databaseHooks.user.create.after` still fires
5. Only after verification passes, proceed with doc alignment changes

**Rollback:** If 1.5.3 breaks the adapter, check if `@convex-dev/better-auth` has a newer compatible version. If not, pin to the latest compatible `better-auth` version and document the delta.

#### TD-6: Rate Limiting

**Decision:** Add `rateLimit` plugin for sign-in; defer sign-up rate limiting to follow-up.

**Decision (revised from original TD-6):** Originally marked as "evaluate but do not add." Reversed after adversarial review: rate limiting for sign-in IS in scope because reCAPTCHA on sign-in is architecturally flawed (adds latency, doesn't prevent direct API abuse). The `rateLimit()` plugin is the correct server-enforced protection for credential stuffing.

**Configuration:**
- `rateLimit()` plugin added to `createOptions.plugins` array in `createAuth` factory
- Default limits: `sign-in.email`: 5 per minute per email, 20 per minute per IP
- Sign-up rate limiting is covered by reCAPTCHA (Task 16) — no additional rate limit needed

#### TD-6a: Sign-in reCAPTCHA vs Rate Limiting

**Decision:** Rate limiting over reCAPTCHA for sign-in.

**Rationale:**
- reCAPTCHA on sign-in adds ~200ms latency (separate Convex round-trip to validate token BEFORE `authClient.signIn.email()` call)
- reCAPTCHA is client-side — an attacker can bypass it by calling the Better Auth endpoint directly
- Better Auth's `rateLimit` plugin enforces limits server-side on the actual auth endpoint
- reCAPTCHA on sign-up IS retained because sign-up is a Convex action (not direct Better Auth), so the reCAPTCHA token can be validated in the same action call

#### TD-7: Affiliate Sign-Up Two-Step Flow

**Decision:** Two-step flow matching SaaS Owner pattern (Option C)

The current `registerAffiliateAccount` action does everything in one Convex call (reCAPTCHA + password hashing + affiliate record creation). After migration, the sign-up is split:

1. **Client:** `authClient.signUp.email({ email, password, name, additionalFields: { userType: "affiliate" } })` → HTTP request to `/api/auth/sign-up/email`
2. **Client:** `completeAffiliateSignUp({ email, tenantSlug, campaignSlug, promotionChannel, recaptchaToken })` → Convex action
3. **Better Auth hook:** `databaseHooks.user.create.after` fires — for affiliates with `userType: "affiliate"`, this is a no-op (the affiliate record is created by `completeAffiliateSignUp`)
4. **Convex action:** `completeAffiliateSignUp` validates reCAPTCHA, generates referral code, creates affiliate record with `status: "pending"`, optionally enrolls in campaign

**Why not pass `tenantSlug` through `additionalFields`?**
- `tenantSlug` is an app concept, not a Better Auth user attribute. Storing it on the Better Auth `user` record pollutes the auth schema.
- The two-step pattern cleanly separates auth (Better Auth) from business logic (Convex).
- This matches the existing SaaS Owner flow: `SignUp.tsx` calls `authClient.signUp.email()` then `completeSignUp()`.

**Error handling:** If `completeAffiliateSignUp` fails after Better Auth user creation, the user has an auth record but no affiliate record. The form should display the error and allow retry. If the email already exists in the `affiliates` table, return a clear "already registered" message.

#### TD-8: Cross-Boundary Import Constraints

**Decision:** `convex/` files cannot import from `src/` and vice versa.

After moving `createAuth` from `src/lib/auth.ts` to `convex/auth.ts`, several imports break:

| Import | Current Location | After Migration |
|--------|-----------------|-----------------|
| `createAuth` in `convex/http.ts` | `../src/lib/auth` → `convex/auth.ts` | `./auth` (clean intra-convex) |
| `authWithoutCtx` type in `src/lib/auth-client.ts` | `@/lib/auth` | Re-export as type from `src/lib/auth.ts` (which imports the type from `convex/auth.ts` via generated API) |
| `Session` type in `src/proxy.ts` | `ReturnType<typeof createAuth>["$Infer"]["Session"]` using `createAuth` from `./lib/auth` | Import `Session` type from `better-auth` directly, or from `src/lib/auth.ts` type re-export |
| Email helpers in `createAuth` | `../../convex/email` (cross-boundary from `src/lib/auth.ts`) | `./email` (clean relative within `convex/auth.ts`) |

**Pattern:** `src/lib/auth.ts` becomes a thin re-export file for types that `src/` code needs from the `convex/` boundary:
```typescript
// src/lib/auth.ts — type re-exports only
export type { authWithoutCtx } from "../../convex/auth";
// or use the generated type from convex/_generated/api
```

#### TD-9: Affiliate Forgot Password Redirect Chain

**Decision:** Dedicated `/portal/reset-password` page with `callbackURL` routing

When an affiliate clicks "Forgot password" on the portal login:
1. `/portal/forgot-password?tenant=<slug>` → calls `authClient.forgetPassword({ email, callbackURL: "/portal/reset-password?tenant=<slug>" })`
2. Better Auth sends email with link to `/portal/reset-password?token=...&tenant=<slug>` (via `callbackURL`)
3. User lands on `/portal/reset-password`, enters new password, redirects to `/portal/login?tenant=<slug>`

**Solution:** Create `/portal/reset-password/page.tsx` that:
- Accepts `token` and `tenant` query params
- Calls `authClient.resetPassword({ token, newPassword })`
- Redirects to `/portal/login?tenant=<slug>` on success

The forgot password flow must pass `callbackURL` in the `forgetPassword` call pointing to `/portal/reset-password?tenant=<slug>`. This ensures the entire redirect chain stays within the affiliate portal.

**Alternatively:** Override the reset password email template to include `callbackURL` with tenant slug. This requires a custom email template per user type — more complex but avoids needing a separate page.

**Chosen approach:** Create `/portal/reset-password/page.tsx` (simpler, self-contained, doesn't require email template changes).

#### TD-10: Orphaned User Recovery

**Decision:** Detection utility + client-side retry flow + server-side sign-in auto-recovery

After migrating to the two-step sign-up flow (TD-7), a failure in `completeAffiliateSignUp` leaves a Better Auth user with no corresponding `affiliates` record. The user cannot sign up again (email taken) and cannot access the portal (no affiliate record).

**Detection:** A Convex query `findOrphanedAuthUsers` that:
1. Reads all Better Auth `user` records (via adapter factory)
2. For each user, checks if they exist in `users` table OR `affiliates` table
3. Returns users with no matching app record

**Client-side recovery:**
- `AffiliateSignUpForm` detects if user is already authenticated after sign-up
- If authenticated but `completeAffiliateSignUp` failed, show error with "Try Again" button
- "Try Again" calls `completeAffiliateSignUp` without re-calling `authClient.signUp.email()`
- If the user already has an affiliate record, show "You're already registered — please sign in"

**Server-side sign-in recovery (browser close edge case):**
- If the user closes their browser after step 1 (`authClient.signUp.email()` succeeds) but before step 2 (`completeAffiliateSignUp` completes), the client-side retry flow is unavailable
- **Solution:** In `AffiliateSignInForm`, after successful `authClient.signIn.email()`, call `getUserTypeByEmail` to check if the user has an affiliate record for the given tenant
- If the user is authenticated (sign-in succeeds) but NO affiliate record exists for the tenant, redirect to `/portal/register?tenant=<slug>` with a `retry=true` query param
- The `AffiliateSignUpForm` detects `retry=true` and the existing session, then automatically calls `completeAffiliateSignUp` without requiring re-authentication
- This covers the "user closed browser" edge case without requiring manual admin intervention

**Not in scope for implementation:** Automated cleanup job. The detection utility is created for manual/admin use. Automated cleanup can be a follow-up spec.

## Implementation Plan

### Deployment Strategy

**WARNING: This is a big-bang migration with no feature flag mechanism.** All phases must be completed and verified on staging before deploying to production. Deploy during a low-traffic window.

**Rollback gates between phases:**

| After Phase | Verification Gate | Rollback Plan |
|-------------|------------------|---------------|
| Phase 0 (version upgrade) | Verify on production: sign-in, sign-out, sign-up for SaaS Owners | Revert `package.json` pins, `pnpm install` |
| Phase 1 (backend doc alignment) | Staging: full auth flow for all user types works | Revert `convex/` changes, redeploy previous Convex functions |
| Phase 2 (frontend doc alignment) | Staging: SSR token, proxy.ts, auth route handler all work | Revert `src/` changes (proxy.ts, layout.tsx, route handler, auth-server.ts) |
| Phases 3–4 (sanitization + anti-spam) | Staging: reCAPTCHA, rate limiting, email trimming verified | Revert form changes and rateLimit plugin config |
| Phase 5–6 (affiliate migration) | Staging: full affiliate sign-up, sign-in, forgot/reset password flows | Revert to pre-migration state; old custom auth still works if affiliate changes haven't been deployed yet |
| Phase 7 (cleanup) | Staging: no references to deleted files/functions | N/A — final cleanup, no functional changes |

**CRITICAL:** Phases 0–2 should be deployed to production FIRST (they are backward-compatible for existing auth). Phases 5–6 (affiliate migration + data migration) should be deployed as a single batch after staging verification. Phase 7 (cleanup of deleted files) follows last.

### Tasks

#### Phase 0: Version Upgrade (Isolated — No Other Changes)

- [ ] **Task 1:** Upgrade `better-auth` to 1.5.3 and verify compatibility
  - File: `package.json`
  - Action: Pin `"better-auth": "1.5.3"` and `"@convex-dev/better-auth": "0.10.13"` in `package.json` (remove caret from adapter). Run `pnpm install`.
  - Notes: Run `pnpm dev` and verify: (a) SaaS Owner sign-in/sign-out works, (b) `databaseHooks.user.create.after` fires on sign-up, (c) `betterAuthComponent.getAuthUser(ctx)` returns user in queries. If any break, check `@convex-dev/better-auth` for a newer compatible version and pin to the latest working `better-auth`. Document the verified versions.

#### Phase 1: Doc Alignment — Backend (convex/)

- [ ] **Task 2:** Migrate `auth.config.ts` to use `getAuthConfigProvider()`
  - File: `convex/auth.config.ts`
  - Action: Replace the current Convex site provider configuration (`providers: [{ id: "convex", lookup: { CONVEX_SITE_URL }, applicationID: "convex" }]`) with `getAuthConfigProvider()` from `@convex-dev/better-auth/auth-config`. Export default.
  - Notes: Follow https://labs.convex.dev/better-auth/framework-guides/next#add-convex-auth-config

- [ ] **Task 3:** Move `createAuth` factory from `src/lib/auth.ts` to `convex/auth.ts`
  - File: `convex/auth.ts`, `src/lib/auth.ts`
  - Action:
    1. In `convex/auth.ts`: Import from `better-auth/minimal` instead of `better-auth`. Copy the `createOptions` function and `createAuth` factory from `src/lib/auth.ts`. Update email helper imports to relative paths (`./email` instead of `../../convex/email`). Export `authWithoutCtx` type.
    2. In `src/lib/auth.ts`: Remove `createAuth`, `createOptions`, all plugin imports, `betterAuthComponent` import, email helper imports. Keep only type re-exports: `export type { authWithoutCtx }` from `../../convex/auth` (or equivalent).
  - Notes: `convex/auth.ts` now has BOTH `betterAuthComponent` (client) and `createAuth` (factory). This eliminates the cross-boundary import. Follow TD-8.

- [ ] **Task 4:** Update `convex/http.ts` to import `createAuth` from new location
  - File: `convex/http.ts`
  - Action: Change `import { createAuth } from "../src/lib/auth"` to `import { createAuth } from "./auth"`.
  - Notes: Clean intra-convex import.

- [ ] **Task 5:** Update `src/lib/auth-client.ts` import path
  - File: `src/lib/auth-client.ts`
  - Action: Update `import type { authWithoutCtx } from "@/lib/auth"` to point to the re-export from the updated `src/lib/auth.ts`.
  - Notes: No functional change — just ensuring the type import chain works after Task 3.

- [ ] **Task 6:** Add `userType` to `additionalFields` in `createAuth` config
  - File: `convex/auth.ts` (within the `createOptions` function moved in Task 3)
  - Action: Add `userType: { type: "string", required: false, input: true }` to `user.additionalFields`.
  - Notes: This allows affiliates to pass `{ userType: "affiliate" }` during `signUp.email()`. The `databaseHooks.user.create.after` hook reads this to determine routing.

- [ ] **Task 7:** Update `databaseHooks` to handle affiliate routing + deletion cleanup
  - File: `convex/auth.ts` (within `createOptions` moved in Task 3), `convex/users.ts`
  - Action:
    1. In `databaseHooks.user.create.after`: Check `user.userType === "affiliate"`. If so, call a new internal mutation `internal.affiliateAuth.createAffiliateFromAuth` (no-op for now, placeholder). If not affiliate, call existing `internal.users.syncUserCreation` as before.
    2. Add defensive `.trim().toLowerCase()` on `user.email` before passing to mutations.
    3. In `databaseHooks.user.delete.after`: In addition to existing `syncUserDeletion`, also check if the user's email exists in the `affiliates` table. If an affiliate record matches, patch `status: "removed"` (do NOT hard-delete — this prevents accidentally deleting a multi-tenant affiliate who is active on a DIFFERENT tenant). **CRITICAL:** Do NOT delete by email alone — an email can exist in `affiliates` on multiple tenants. Only remove the affiliate if it's also in the `users` table being deleted (i.e., the same person was both an owner and affiliate). For safety, prefer `status: "removed"` over hard delete.
  - Notes: The actual affiliate record creation happens in `completeAffiliateSignUp` (Task 19). The create hook can be a no-op for affiliates.

#### Phase 2: Doc Alignment — Frontend (src/)

- [ ] **Task 8:** Create `src/lib/auth-server.ts` with `convexBetterAuthNextJs` utilities
  - File: `src/lib/auth-server.ts` (NEW)
  - Action: Create file exporting `{ handler, preloadAuthQuery, isAuthenticated, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction }` from `convexBetterAuthNextJs({ authConfig })`. Import `authConfig` from `../../convex/auth.config`.
  - **IMPORTANT — plugin chain clarification:** `auth-server.ts` imports `authConfig` (not `createAuth`). The `rateLimit` plugin (added in Task 17) is configured in the `createAuth` factory inside `convex/auth.ts`. The `authConfig` from `convex/auth.config.ts` feeds into `createAuth`. The `convexBetterAuthNextJs` utility wraps `authConfig` to produce the server-side `handler`, `isAuthenticated`, `getToken`, etc. This means plugins configured in `createAuth` ARE visible to the handler because `authConfig` is the input to `createAuth`, and `convexBetterAuthNextJs` uses the same auth instance. Verify this chain during Task 1 staging verification — if rate limiting doesn't work on the `handler` endpoint, the plugin may need to be configured at the `authConfig` level instead.
  - Notes: Follow https://labs.convex.dev/better-auth/framework-guides/next#configure-nextjs-server-utilities

- [ ] **Task 9:** Simplify auth route handler
  - File: `src/app/api/auth/[...all]/route.ts`
  - Action: Replace the entire file with `import { handler } from "@/lib/auth-server"; export const { GET, POST } = handler;`. Remove sign-out cookie workaround, `betterFetch` import, manual cookie clearing.
  - Notes: Follow https://labs.convex.dev/better-auth/framework-guides/next#mount-handlers. Test sign-out still works after this change.

- [ ] **Task 10:** Add `initialToken` prop to `ConvexClientProvider`
  - File: `src/app/ConvexClientProvider.tsx`
  - Action: Add `initialToken?: string | null` to component props. Pass it to `<ConvexBetterAuthProvider initialToken={initialToken}>`.
  - Notes: Follow https://labs.convex.dev/better-auth/framework-guides/next#set-up-convex-client-provider

- [ ] **Task 11:** Wire `initialToken` through `layout.tsx` SSR
  - File: `src/app/layout.tsx`
  - Action: Import `getToken` from `@/lib/auth-server`. In the root layout (server component), call `getToken()` to get the auth token (a JWT string). Before passing it to `ConvexClientProvider`, validate it is not expired:
    ```typescript
    // Decode JWT payload without a library (JWT is base64url-encoded)
    function isTokenExpired(token: string | null): boolean {
      if (!token) return true;
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString()
        );
        if (payload.exp == null) return true; // missing exp → treat as expired
        return payload.exp * 1000 < Date.now();
      } catch {
        return true; // Malformed token — treat as expired
      }
    }
    const token = await getToken();
    const initialToken = isTokenExpired(token) ? null : token;
    ```
    Pass `initialToken` as prop to `ConvexClientProvider`. Pass `null` if expired to avoid flash of authenticated content.
  - Notes: Follow https://labs.convex.dev/better-auth/framework-guides/next#ssr-with-server-components. The `Buffer.from(str, "base64url")` approach requires no additional dependencies — `base64url` is supported in Node.js 16+. Do NOT use `atob()` (browser-only).

- [ ] **Task 12:** Refactor `proxy.ts` to use `isAuthenticated()` from `auth-server.ts`
  - File: `src/proxy.ts`
  - Action: Replace `import { getSessionCookie } from "better-auth/cookies"` and the `getSession` function with `import { isAuthenticated } from "@/lib/auth-server"`. Replace `const isAuthenticated = !!ownerSessionCookie;` with `const isAuthed = await isAuthenticated(request);`. Remove `betterFetch` import and `createAuth` type import (use `Session` type from `better-auth` if needed, or remove if unused).
  - Notes: Follow https://labs.convex.dev/better-auth/framework-guides/next#configure-nextjs-server-utilities

- [ ] **Task 13:** Clean up unused imports across codebase
  - Files: `src/lib/auth.ts`, `src/proxy.ts`, `src/app/api/auth/[...all]/route.ts`
  - Action: Remove `convexAdapter` import (unused in `src/lib/auth.ts`), `betterFetch` import (moved to `auth-server.ts`), `createAuth` import from `proxy.ts` (replaced by `isAuthenticated`).
  - Notes: Run `pnpm lint` to catch any remaining unused imports.

#### Phase 3: Input Sanitization

- [ ] **Task 14:** Add email/name trimming to all auth forms
  - Files: `src/app/(unauth)/sign-in/SignIn.tsx`, `src/app/(unauth)/sign-up/SignUp.tsx`, `src/components/affiliate/AffiliateSignInForm.tsx`, `src/components/affiliate/AffiliateSignUpForm.tsx`, `src/app/reset-password/page.tsx`
  - Action: In every form's `onSubmit` handler, add `const cleanEmail = values.email.trim().toLowerCase()` and `const cleanName = values.name?.trim()` before passing to `authClient.*()` calls or Convex mutations. Use `cleanEmail` consistently.
  - Notes: This prevents silent failures from leading/trailing spaces in email fields. **Important:** `SignUp.tsx` already trims before `completeSignUp` (line 240) but does NOT trim before `authClient.signUp.email()` (line 227) — both calls must use the trimmed email.

- [ ] **Task 15:** Add defensive email trimming in Convex queries
  - Files: `convex/auth.ts` (`getUserTypeByEmail`, `getAuthenticatedUserType`, `getCurrentUser`, `getCurrentTenantId`, `validateTenantAccess`), `convex/users.ts` (`syncUserCreation`)
  - Action: Add `.trim().toLowerCase()` to email arguments at the start of each query handler before using them in index lookups.
  - Notes: Safety net in case any client forgets to trim.

#### Phase 4: Anti-Spam (reCAPTCHA)

- [ ] **Task 16:** Add reCAPTCHA to SaaS Owner sign-up
  - File: `src/app/(unauth)/sign-up/SignUp.tsx`, `convex/users.ts`
  - Action: Wrap the sign-up form content in `<ReCaptchaWrapper>` (already exists at `src/components/ui/ReCaptchaWrapper.tsx`). Import `useGoogleReCaptcha` from `react-google-recaptcha-v3`. Before calling `authClient.signUp.email()`, execute reCAPTCHA and pass the token to `completeSignUp` mutation. In `completeSignUp` mutation (`convex/users.ts`), add `recaptchaToken: v.string()` to args and validate it by calling `internal.affiliateAuth.validateRecaptchaToken` before proceeding.
  - Notes: Reuses existing reCAPTCHA infrastructure. Validate server-side, not client-side.

- [ ] **Task 17:** Add rate limiting for sign-in via Better Auth `rateLimit` plugin
  - File: `convex/auth.ts` (within `createOptions` moved in Task 3)
  - Action: Import `rateLimit` from `better-auth/plugins`. Add `rateLimit()` to the plugins array in `createOptions`. Configure limits for `sign-in.email` endpoint: max 5 attempts per minute per email, max 20 attempts per minute per IP. This replaces the flawed reCAPTCHA-on-sign-in approach (reCAPTCHA adds ~200ms latency per sign-in and doesn't prevent direct API abuse since `authClient.signIn.email()` calls Better Auth directly, bypassing any client-side token check).
  - Notes: Do NOT add reCAPTCHA to sign-in forms. Rate limiting is the server-enforced, standards-aligned protection for credential stuffing. See TD-6a. **UX requirement:** `SignIn.tsx` error handler must distinguish rate limit errors (HTTP 429 or error message containing "rate") from credential errors. Show user-friendly message: "Too many sign-in attempts. Please wait a minute and try again." instead of generic "Invalid credentials."

#### Phase 5: Affiliate Auth Migration — Backend

- [ ] **Task 18:** Remove custom auth functions from `convex/affiliateAuth.ts`
  - File: `convex/affiliateAuth.ts`
  - Action: Remove `generateSessionToken`, `SESSION_EXPIRY_MS`, `createAffiliateSession`, `validateSessionToken`, `loginAffiliate`, `validateAffiliateSession`, `logoutAffiliate`, `changeAffiliatePassword`, `requestAffiliatePasswordReset` (MVP stub). Keep `getCurrentAffiliate`, `getAffiliateTenantContext`, `registerAffiliateAccount` (to be replaced in Task 19), `validateRecaptchaToken`, `createAffiliateAccountInternal`, and all dashboard/stats/commission queries.
  - Notes: These are all replaced by Better Auth. Keep the file structure clean.

- [ ] **Task 19:** Create `completeAffiliateSignUp` action
  - File: `convex/affiliateAuth.ts`
  - Action: Create new action that replaces `registerAffiliateAccount`:
    - Args: `{ email, tenantSlug, campaignSlug?, promotionChannel?, recaptchaToken }`
    - Validate reCAPTCHA token (call `internal.affiliateAuth.validateRecaptchaToken`)
    - Resolve tenant by slug
    - Check if affiliate already exists for this tenant + email — if so AND status is `"active"`, return existing record; if status is `"suspended"`, throw error; if status is `"pending"`, return existing record (idempotent retry)
    - Generate unique referral code
    - Create affiliate record with `status: "pending"` (call `internal.affiliateAuth.createAffiliateAccountInternal` — reuse existing, remove `passwordHash` arg)
    - Optionally enroll in campaign if `campaignSlug` provided
    - Send welcome email and notification email to SaaS Owner
  - Notes: This is called AFTER `authClient.signUp.email()` succeeds. **The action MUST verify the caller is authenticated as the matching email** — call `betterAuthComponent.getAuthUser(ctx)` and compare `baUser.email === args.email`. If mismatch, throw error. This prevents creating affiliate records without a corresponding auth user (e.g., if the action is called directly without going through the two-step flow). No password hashing needed — Better Auth handles it.

- [ ] **Task 20:** Remove `registerAffiliateAccount` and `createAffiliateAccountInternal` password handling
  - File: `convex/affiliateAuth.ts`
  - Action: Remove `registerAffiliateAccount` (replaced by `completeAffiliateSignUp` in Task 19). Update `createAffiliateAccountInternal` to remove `passwordHash` from args (no longer stored in `affiliates` table).
  - Notes: `createAffiliateAccountInternal` is kept as an internal mutation but simplified.

- [ ] **Task 21:** Remove custom auth functions from `convex/affiliates.ts`
  - File: `convex/affiliates.ts`
  - Action: Remove `authenticateAffiliate` query, `registerAffiliate` mutation, `updateAffiliatePassword` mutation, `setAffiliatePassword` mutation. Keep all other mutations (status changes, tier checks, referral code generation, etc.).
  - Notes: These are replaced by Better Auth + `completeAffiliateSignUp`. `registerAffiliate` is replaced by `createAffiliateByOwner` (Task 21b). `setAffiliatePassword` is replaced by the password reset email flow.

- [ ] **Task 21b:** Create `createAffiliateByOwner` mutation (replaces `registerAffiliate`)
  - File: `convex/affiliates.ts`
  - Action: Create new mutation that replaces the owner-initiated `registerAffiliate`:
    - Args: `{ email, firstName, lastName, tier?, campaignId? }` (remove `passwordHash`)
     - Require authenticated owner context (`requireTenantId`)
     - Check if affiliate already exists for this tenant + email — if so, throw error "Affiliate already exists on this tenant"
     - Check if Better Auth `user` record already exists for this email — if so AND they already have a `credential` account, throw error "This email already has an account" (prevents duplicate credential records). If they exist but have no credential account (e.g., OAuth-only user), skip account creation and only send the password reset email
     - Create affiliate record with `status: "pending"` (same as current logic — tier limit check, referral code generation)
    - Create Better Auth `user` + `account` records via adapter factory with a random scrypt-hashed temporary password
     - Send a "set your password" email to the affiliate. **IMPORTANT:** Do NOT use the standard `sendResetPassword` email template — it says "You requested to reset your password," which is confusing for a new user who never had a password. Create a dedicated `sendAffiliateInviteEmail` helper (or add a `reason: "invite"` parameter to the email helper) with copy like "You've been invited to join [Tenant Name]'s affiliate program. Click here to set your password and get started."
    - Handle edge case: if Better Auth user already exists for this email (e.g., the person is already a SaaS Owner), create only the `account` record with a credential provider, or return a clear error explaining the email conflict
  - Notes: This preserves the owner-initiated flow without requiring owners to choose/set passwords for affiliates. The affiliate receives a password reset link to set their own credentials. This is more secure (owner never sees the password) and aligns with Better Auth's password management.

- [ ] **Task 22:** Remove `affiliates.passwordHash` and `affiliateSessions` from schema
  - File: `convex/schema.ts`
  - Action: Remove `passwordHash: v.optional(v.string())` from `affiliates` table definition. Remove entire `affiliateSessions` defineTable and its indexes.
  - Notes: Schema migration is handled by Convex — removing fields/tables is a backward-compatible change.

- [ ] **Task 23:** Update `getCurrentAffiliate` to accept optional `tenantSlug` filter
  - File: `convex/affiliateAuth.ts`
  - Action: Add optional `tenantSlug: v.optional(v.string())` arg. If provided, look up tenant by slug first, then filter `affiliates` by `tenantId` AND `email`. If not provided, keep current behavior (lookup by email alone).
  - Notes: Prevents returning wrong tenant's affiliate record for multi-tenant affiliates. **IMPORTANT:** Every portal page that calls `getCurrentAffiliate` must pass `tenantSlug` (extracted from `searchParams`). Without it, multi-tenant affiliates may see the wrong tenant's data. Task 27 must verify all portal pages pass `tenantSlug`.

- [ ] **Task 24:** Update seed data to remove password hash references
  - Files: `convex/testData.ts`, `convex/seedAuthUsers.ts`
  - Action: Remove `passwordHash` from all affiliate seed data. Remove `affiliateSessions` from clear/seed counts. Ensure `clearAllTestData` doesn't try to delete from `affiliateSessions` table.
  - Notes: After schema migration, these references would cause errors.

#### Phase 6: Affiliate Auth Migration — Frontend

- [ ] **Task 25:** Update `AffiliateSignInForm` — add forgot password link + email trim + orphan recovery
  - File: `src/components/affiliate/AffiliateSignInForm.tsx`
  - Action: (a) Add email trim in `onSubmit`. (b) Change the "Forgot password?" link from `onClick={() => { e.preventDefault(); /* TODO */ }}` to `href={/portal/forgot-password?tenant=${tenantSlug}}`. (c) Add pending/suspended status check after sign-in — call `getUserTypeByEmail` and check affiliate status; redirect to `/portal/pending` if pending, show error if suspended. (d) Add orphan recovery redirect — after successful sign-in, if the user has NO affiliate record for this tenant (orphaned user from failed `completeAffiliateSignUp`), redirect to `/portal/register?tenant=${slug}&retry=true` so the sign-up form can auto-complete `completeAffiliateSignUp`. (e) Add "not on this tenant" error — if the user is authenticated and IS an affiliate but NOT on this specific tenant, show error "You're not registered as an affiliate on this program" with a link to `/portal/register?tenant=${slug}` (multi-tenant join flow).
  - Notes: The sign-in already uses `authClient.signIn.email()` — no auth change needed. The orphan recovery (step d) handles the "user closed browser after sign-up but before completeAffiliateSignUp" edge case (TD-10). **Note on step (c):** The pending/suspended redirect in AffiliateSignInForm covers post-sign-in. However, portal pages accessed via direct URL bookmark (e.g., `/portal/home`) must also check status — this is covered by the hardening requirement in TD-2 (every affiliate-facing query checks `affiliate.status !== "pending"`), which means `getCurrentAffiliate` should return `null` or a status field that the page can use to redirect.

- [ ] **Task 26:** Rewrite `AffiliateSignUpForm` for two-step flow
  - File: `src/components/affiliate/AffiliateSignUpForm.tsx`
  - Action:
    1. Check for `retry=true` search param. If present, call `authClient.getSession()` to verify the session is still active. If session exists, auto-call `completeAffiliateSignUp` (handles orphan recovery from TD-10 — no user interaction needed beyond confirmation). If session is null/expired (user logged out or session expired since being redirected here), redirect to `/portal/login?tenant=<slug>` with an info message instead of attempting auto-complete.
    2. If no `retry` param but authenticated (`authClient.getSession()`), show simplified "Join this program" UI (no email/password fields, just confirm button calling `completeAffiliateSignUp`).
     3. If not authenticated, show full form. On submit: (a) execute reCAPTCHA, (b) call `authClient.signUp.email()` with `additionalFields: { userType: "affiliate" }`, (c) call `completeAffiliateSignUp` action with `recaptchaToken, tenantSlug, campaignSlug, promotionChannel`.
     4. If `authClient.signUp.email()` fails with `USER_ALREADY_EXISTS` error: the email already has a Better Auth user. Call `authClient.getSession()` — if authenticated, the user is likely an affiliate on another tenant. Call `completeAffiliateSignUp` directly (skip re-sign-up, treat as multi-tenant join flow). If not authenticated, show "An account with this email already exists — please sign in first" with link to `/portal/login?tenant=<slug>`.
     5. If step (c) `completeAffiliateSignUp` fails: show error with "Try Again" button (user is already authenticated from step b, so retry just calls `completeAffiliateSignUp`).
     6. If `completeAffiliateSignUp` returns existing affiliate: show "You're already registered — please sign in" message.
     7. Add email/name trim before all calls.
  - Notes: This is the most complex frontend change. Follow TD-7 and TD-10.

- [ ] **Task 27:** Update affiliate portal pages to remove `useAffiliateAuth` references
  - Files: `src/app/portal/home/page.tsx`, `src/app/portal/links/page.tsx`, `src/app/portal/earnings/page.tsx`, `src/app/portal/assets/page.tsx`, `src/app/portal/account/page.tsx`
  - Action: Search each file for imports of `useAffiliateAuth` or `affiliate-auth-client`. Replace with `api.affiliateAuth.getCurrentAffiliate` (already using Better Auth session). Remove any localStorage session checks. **Additionally:** verify each portal page extracts `tenantSlug` from `searchParams` and passes it to `getCurrentAffiliate({ tenantSlug })`. Without `tenantSlug`, multi-tenant affiliates will see the wrong tenant's data.
  - Notes: Most portal pages already use `getCurrentAffiliate` query. Just verify no leftover custom auth imports AND that all callers pass `tenantSlug`.

- [ ] **Task 28:** Update `PasswordSection` for Better Auth `changePassword`
  - Files: `src/app/portal/account/page.tsx`, `src/app/portal/account/components/PasswordSection.tsx`
  - Action: (a) In `page.tsx`: Remove `useMutation(api.affiliateAuth.changeAffiliatePassword)`. Import `authClient` from `@/lib/auth-client`. Remove the `handleChangePassword` wrapper — `PasswordSection` will call `authClient.changePassword()` directly instead of going through a parent-provided callback. Remove `affiliateId` prop from `PasswordSection`. (b) In `PasswordSection.tsx`: **BREAKING PROP CHANGE** — remove `onChangePassword` and `affiliateId` props entirely. Add `currentPassword` field to the form. Call `authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })` directly inside the component. Add `primaryColor` prop (keep for branding).
  - Notes: Better Auth's `changePassword` requires `currentPassword`. The old interface `(affiliateId, newPassword)` was insecure (no current password verification). The new interface requires the user to know their current password. Both `page.tsx` and `PasswordSection.tsx` MUST be updated in the same task to avoid a broken build.

- [ ] **Task 29:** Create `/portal/forgot-password` page
  - File: `src/app/portal/forgot-password/page.tsx` (NEW)
  - Action: Create page that: (a) accepts `tenant` search param, (b) loads tenant branding via `fetchQuery(api.affiliateAuth.getAffiliateTenantContext)`, (c) shows forgot password form with email input, (d) calls `authClient.forgetPassword({ email, callbackURL: /portal/reset-password?tenant=${tenantSlug} })`, (e) shows success message "Check your email for a reset link".
  - Notes: Reuses tenant branding pattern from `portal/login/page.tsx`. Follow TD-9.

- [ ] **Task 30:** Make existing `/reset-password` page tenant-aware (instead of creating a separate `/portal/reset-password`)
  - File: `src/app/reset-password/page.tsx`, `src/app/portal/reset-password/page.tsx` (NEW — thin redirect wrapper)
  - Action: Instead of duplicating the existing `src/app/reset-password/page.tsx`, update it to accept an optional `tenant` search param. If `tenant` is present: (a) load tenant branding via `fetchQuery(api.affiliateAuth.getAffiliateTenantContext)`, (b) on success, redirect to `/portal/login?tenant=${tenantSlug}` instead of `/sign-in`. If `tenant` is absent, keep current behavior (owner redirect to `/sign-in`). Create a thin `/portal/reset-password/page.tsx` that redirects to `/reset-password?token=${token}&tenant=${tenantSlug}` to preserve the `/portal/reset-password` URL that the forgot-password email links to.
  - **Rationale:** Avoids maintaining two nearly identical reset password pages. The existing page already handles `authClient.resetPassword()` — we just need to add tenant awareness and redirect logic.

- [ ] **Task 31:** Create `/portal/pending` page
  - File: `src/app/portal/pending/page.tsx` (NEW)
  - Action: Create page that shows: (a) "Your application is pending approval" message, (b) "You'll receive an email once your application is reviewed", (c) link back to `/portal/login?tenant=<slug>`, (d) loads tenant branding via `tenant` search param, (e) **sign-out button** — call `authClient.signOut()` and redirect to `/portal/login?tenant=<slug>` (allows the user to sign out and sign back in if their status changes), (f) **support contact** — "Questions? Contact the program owner at [tenant email or support link]" (prevents dead-end UX where the user has no recourse).
  - Notes: Follow TD-2. This is where pending affiliates are redirected.

- [ ] **Task 32:** Update `proxy.ts` public routes for new pages
  - File: `src/proxy.ts`
  - Action: Add `/portal/reset-password` to `affiliatePublicRoutes` array. Verify `/portal/forgot-password` is already present (it is).
  - Notes: Both pages need to be accessible without authentication.

#### Phase 7: Cleanup

- [ ] **Task 33:** Remove `src/lib/affiliate-auth-client.ts`
  - File: `src/lib/affiliate-auth-client.ts`
  - Action: Delete the file entirely (or empty it and add a comment pointing to `@/lib/auth-client.ts`).
  - Notes: Search entire codebase for imports of this file and remove them first.

- [ ] **Task 34:** Remove `src/app/api/affiliate-auth/route.ts`
  - File: `src/app/api/affiliate-auth/route.ts`
  - Action: Delete the file entirely.
  - Notes: This custom API route is replaced by Better Auth's `/api/auth` handler.

- [ ] **Task 35:** Create data migration action for existing affiliates
  - File: `convex/affiliateAuth.ts` (or new `convex/migrateAffiliateAuth.ts`)
  - Action: Create `migrateExistingAffiliates` action that: (a) reads all affiliates from `affiliates` table (cap at 500 via `.take(500)`), (b) for each, **skip if email is null/empty** (log warning), (c) check if Better Auth `user` + `account` records already exist (skip if so), (d) if not, creates Better Auth `user` record via adapter factory (name, email from affiliate record), (e) creates Better Auth `account` record with `providerId: "credential"`, `accountId: email`, `password: null` (no password — forces reset), (f) creates a `verification` record with a password reset token via adapter factory, (g) sends password reset email to the affiliate using existing `sendResetPassword` helper. Add `findOrphanedAuthUsers` query for admin use (reads all Better Auth `user` records, checks against `users` and `affiliates` tables, returns mismatches).
  - **CRITICAL:** Do NOT use `TEST_PASSWORD_HASH` or any shared password — each affiliate must receive a unique reset token. The `account.password` must be `null` so the reset flow is the only way to authenticate.
  - **Resumability:** If the action times out, it can be re-run safely — it skips affiliates that already have Better Auth records. Log progress (e.g., console.log after each batch of 50) so the operator can verify partial completion.
  - Notes: Follow TD-3 and TD-10. Run with `--typecheck=disable`. This is a one-time action. Use `"use node"` directive since it needs adapter factory access.

- [ ] **Task 35b:** Verify email templates work for affiliate password reset
  - File: `convex/email.tsx`, `convex/auth.ts` (within `createOptions`)
  - Action: (a) Verify that `sendResetPassword` in `convex/email.tsx` does NOT include owner-specific branding or links that would confuse affiliates. The reset password email should be generic (no tenant-specific references). (b) Test by running the migration action (Task 35) and confirming the email is received and the reset link works. (c) If the email template has owner-specific content (e.g., "Set up your SaaS dashboard"), create a conditional branch based on `userType` to render affiliate-appropriate copy. (d) Verify the `callbackURL` in the `forgetPassword` call is respected by Better Auth — the reset email link should point to the correct page. (e) Verify that the **owner-invite email** (Task 21b) uses different copy from the password reset email — the invite email must NOT say "You requested to reset your password" for users who never had one.
  - Notes: Better Auth's `emailAndPassword.sendResetPassword` (configured in `createOptions`) calls `sendResetPassword` from `convex/email.tsx`. This handler must work for all user types. If it's owner-specific, affiliates receive broken/confusing emails.

- [ ] **Task 36:** Update documentation
  - Files: `AGENTS.md`, `_bmad-output/project-context.md`
  - Action: Update auth sections to reflect: (a) single Better Auth instance for all user types, (b) `createAuth` lives in `convex/auth.ts`, (c) `auth-server.ts` provides SSR utilities, (d) no `affiliateSessions` table or `affiliates.passwordHash`, (e) all password operations via Better Auth, (f) reCAPTCHA on sign-up forms, rate limiting on sign-in, (g) email trimming at form layer.
  - Notes: Ensure AGENTS.md auth section accurately reflects new patterns for future dev agent reference.

- [ ] **Task 37:** Clean up legacy `affiliate_session` cookie from browsers
  - File: `src/proxy.ts`
  - Action: In `proxy.ts`, when processing a request that hits any `/portal/` route, check for the legacy `affiliate_session` cookie. If present, return a response that clears it (`Set-Cookie: affiliate_session=; Max-Age=0; Path=/`). This ensures the orphaned cookie (7-day expiry, set by the now-removed `api/affiliate-auth/route.ts`) is cleaned up on the next portal visit without requiring any user action.
  - Notes: This is a one-line addition in `proxy.ts` and should be done during Task 12 (the `proxy.ts` refactor). Added as a separate task for tracking. The cookie doesn't cause harm but is dead state that could confuse debugging.

### Acceptance Criteria

- [ ] **AC 1:** Given a SaaS Owner with valid credentials, when they sign in via `/sign-in`, then they are redirected to `/dashboard` and see their tenant data.
- [ ] **AC 2:** Given a SaaS Owner, when they sign up via `/sign-up`, then a Better Auth user + `users` table record is created, and they are redirected to `/onboarding`.
- [ ] **AC 3:** Given an affiliate with valid credentials, when they sign in via `/portal/login?tenant=<slug>`, then they see the affiliate portal dashboard with tenant branding.
- [ ] **AC 4:** Given an unauthenticated user, when they try to access `/portal/home`, then they are redirected to `/portal/login`.
- [ ] **AC 5:** Given a pending affiliate, when they sign in, then they are redirected to `/portal/pending` and cannot access any portal data.
- [ ] **AC 6:** Given a new affiliate registering, when they complete the sign-up form, then a Better Auth user is created, an affiliate record with `status: "pending"` is created, and they see the "Application Submitted" success state.
- [ ] **AC 7:** Given an already-authenticated user, when they visit `/portal/register?tenant=<slug>`, then they see a simplified "Join this program" flow (no email/password required).
- [ ] **AC 8:** Given an affiliate on Tenant A, when they try to register on Tenant B, then they can join Tenant B without re-entering credentials (already authenticated).
- [ ] **AC 9:** Given any user, when they enter an email with leading/trailing spaces in any auth form, then the spaces are trimmed before processing.
- [ ] **AC 10:** Given a user who forgot their password, when they use `/portal/forgot-password?tenant=<slug>`, then they receive a reset email and the reset flow redirects back to `/portal/login?tenant=<slug>`.
- [ ] **AC 11:** Given an authenticated affiliate, when they change their password in `/portal/account`, then they must provide their current password and the new password is validated by Better Auth.
- [ ] **AC 12:** Given a SaaS Owner, when they sign up, then reCAPTCHA is validated before the request is processed. When they sign in, rate limiting is enforced server-side (5 attempts/min per email, 20/min per IP).
- [ ] **AC 13:** Given `better-auth@1.5.3` is installed, when `pnpm dev` runs, then SaaS Owner sign-in, sign-out, and sign-up work without errors.
- [ ] **AC 14:** Given the `initialToken` is valid, when the page loads via SSR, then there is no flash of unauthenticated content.
- [ ] **AC 15:** Given the `initialToken` is expired, when the page loads via SSR, then it falls back to client-side token fetch with no flash.
- [ ] **AC 16:** Given `completeAffiliateSignUp` fails after `authClient.signUp.email()` succeeds, when the user clicks "Try Again", then `completeAffiliateSignUp` is retried without re-signing-up.
- [ ] **AC 17:** Given the `/api/affiliate-auth` endpoint is removed, when any request hits it, then a 404 is returned (no errors).
- [ ] **AC 18:** Given the migration action is run, when existing affiliates try to sign in, then they receive a password reset email (old hashes are incompatible).
- [ ] **AC 18b:** Given the migration action completes, when `findOrphanedAuthUsers` is queried, then it returns zero results (all affiliates have matching Better Auth records). Run this check BEFORE cutover to verify migration completeness.
- [ ] **AC 19:** Given `proxy.ts` uses `isAuthenticated()`, when an authenticated user accesses a protected route, then they are allowed through; when unauthenticated, they are redirected.
- [ ] **AC 20:** Given `getCurrentAffiliate` is called with a `tenantSlug`, when an affiliate exists on multiple tenants, then the correct tenant's record is returned.
- [ ] **AC 21:** Given an authenticated SaaS Owner, when they create an affiliate via the owner dashboard, then an affiliate record with `status: "pending"` is created AND a "set your password" email is sent to the affiliate — the owner does NOT set or know the affiliate's password.
- [ ] **AC 22:** Given an authenticated SaaS Owner creates an affiliate whose email already exists as a Better Auth user (e.g., the person is a SaaS Owner on another tenant), then a clear error message is returned explaining the email conflict (no duplicate Better Auth user created).
- [ ] **AC 23:** Given an authenticated affiliate who is registered on Tenant A, when they try to access `/portal/home?tenant=B` (where they're NOT registered), then they see an error message "You're not registered as an affiliate on this program" with a link to join Tenant B.

## Additional Context

### Dependencies

- `better-auth` upgrade from `1.4.9` → `1.5.3` (pinned)
- `@convex-dev/better-auth` pinned to `0.10.13` (remove caret range)
- Must verify both packages are compatible together
- **Deploy during a low-traffic window.** This is a big-bang migration with no feature flag mechanism. Staging verification of ALL phases is mandatory before production deployment.

### Testing Strategy

**Test Framework:** Vitest + React Testing Library (frontend), Convex test (backend)

**Existing tests affected by this migration:**

| Test File | Impact | Action |
|-----------|--------|--------|
| `convex/affiliateAuth.test.ts` | Tests `registerAffiliateAccount`, `loginAffiliate`, `validateAffiliateSession`, reCAPTCHA | Remove tests for deleted functions; keep reCAPTCHA tests; add tests for `databaseHooks` affiliate routing |
| `src/lib/affiliate-auth.test.ts` | Tests `hashPassword` (SHA-256), `isAffiliateRoute`, `isAffiliateAuthRoute` | Remove `hashPassword` tests; keep route helper tests (if file isn't deleted) |
| `src/components/affiliate/AffiliateSignUpForm.test.tsx` | Tests registration flow including reCAPTCHA | Update to mock `authClient.signUp.email()` instead of `registerAffiliateAccount` action |
| `src/app/portal/register/page.test.tsx` | Tests portal register page | Minor updates if form props change |
| `src/app/(unauth)/sign-in/SignIn.test.tsx` | Tests SaaS Owner sign-in | Verify still works after `auth-server.ts` changes |
| `convex/users.test.ts` | Tests `syncUserCreation` | Add tests for affiliate routing in `databaseHooks` |

**New tests needed:**
- `src/app/portal/forgot-password/` — Test forgot password page renders and submits
- `src/app/portal/pending/` — Test pending approval page renders correctly
- `src/lib/auth-server.ts` — Test `isAuthenticated()` utility with various cookie states
- `convex/auth.ts` — Test `checkResetPasswordReuse` works for affiliate users (extends existing coverage)
- End-to-end: Sign up as affiliate → receive pending status → owner approves → affiliate can log in
- Input sanitization: Test that emails with leading/trailing spaces are trimmed correctly across all forms
- Anti-spam: Test that reCAPTCHA validation runs on SaaS Owner sign-up and sign-in
- Two-step flow: Test `completeAffiliateSignUp` creates affiliate record and handles reCAPTCHA failure gracefully
- Orphan recovery: Test `AffiliateSignUpForm` retry flow when `completeAffiliateSignUp` fails after sign-up
- Multi-tenant: Test affiliate sign-up on second tenant (already authenticated → skip sign-up → call `completeAffiliateSignUp` directly)
- Forgot password redirect: Test that `callbackURL` with tenant slug keeps redirect chain within `/portal/`
- `initialToken` expiry: Test that expired token falls back to client-side fetch (no flash)
- Owner-initiated registration: Test that `createAffiliateByOwner` sends password reset email and does NOT require a `passwordHash` arg
- Email conflict on owner-initiated registration: Test that creating an affiliate with an email that already exists as a Better Auth user returns a clear error
- Multi-tenant error state: Test that accessing `/portal/home?tenant=B` when only registered on Tenant A shows "not registered" error
- Sign-in rate limiting: Test that the 6th sign-in attempt within 60 seconds for the same email is rejected
- Rate limit UX: Test that SignIn.tsx shows "Too many attempts" message on 429 error (not generic "Invalid credentials")
- JWT without exp: Test `isTokenExpired()` with a token missing the `exp` claim returns `true`
- Suspended affiliate retry: Test that `completeAffiliateSignUp` returns error (not success) when affiliate exists with `status: "suspended"`
- createAffiliateByOwner same-tenant duplicate: Test that creating an affiliate with an email already registered on the same tenant throws error
- Reset password missing token: Test that `/portal/reset-password` without `token` param redirects to forgot-password page
- Reset password expired token: Test that `authClient.resetPassword` with expired token shows "link expired" message
- User deletion cleanup: Test that deleting a Better Auth user also removes the corresponding affiliate record (or marks it removed)
- Orphan retry with expired session: Test that `retry=true` with no active session redirects to login instead of crashing
- Multi-tenant sign-up "already exists": Test that `USER_ALREADY_EXISTS` error on sign-up triggers auto `completeAffiliateSignUp` if session exists

**Note:** Per AGENTS.md, existing test files have TypeScript errors that require `--typecheck=disable`. New tests should be written correctly with proper types.

### Notes

- Platform Admins share the same Better Auth flow as SaaS Owners (same `users` table, different `role`). No separate work needed.
- **User type discrimination (TD-1):** Better Auth handles auth only. App tables (`users`, `affiliates`) handle authorization. `databaseHooks.user.create.after` routes to correct table based on signup context (`additionalFields.userType`).
- **Affiliate approval UX (TD-2):** Affiliates get a Better Auth session immediately on registration but are redirected to a "pending approval" page. Every affiliate-facing Convex function MUST check `affiliate.status !== "pending"`.
- **Existing affiliate migration (TD-3):** One-time migration script creates Better Auth records. Password reset emails sent to all existing affiliates (SHA-256 → scrypt incompatibility).
- **Multi-tenant session isolation (TD-4):** Single `better-auth.session_token` cookie. Tenant context resolved per-request by checking both `users` and `affiliates` tables. Route determines which context to use.
- **Version upgrade first (TD-5):** `better-auth@1.5.3` upgrade must be done and verified in isolation before any doc alignment changes.
- **Rate limiting (TD-6):** Not in this spec. Better Auth `rateLimit` plugin should be evaluated as a follow-up security hardening task.
- **Affiliate password flows — all now via Better Auth:**
  - Forgot/reset password: `authClient.forgetPassword()` + `authClient.resetPassword()` — currently MISSING for affiliates entirely
  - Change password: Better Auth's `auth.api.changePassword()` — replaces custom `changeAffiliatePassword` (SHA-256 hashing) in `convex/affiliateAuth.ts` and `updateAffiliatePassword` in `convex/affiliates.ts`
  - Set password on approval: `setAffiliatePassword` in `convex/affiliates.ts` — needs to go through Better Auth instead of writing to `affiliates.passwordHash`
  - Password reuse check: `checkResetPasswordReuse` in `convex/auth.ts` — extend to cover affiliates
- **Schema cleanup:** After migration, remove `affiliates.passwordHash` field and entire `affiliateSessions` table from `convex/schema.ts`. Password hashes live in Better Auth's component `account` table; sessions live in Better Auth's component `session` table.
- **Functions to remove (replaced by Better Auth):**
  - `convex/affiliateAuth.ts`: `loginAffiliate`, `validateAffiliateSession`, `logoutAffiliate`, `createAffiliateSession`, `changeAffiliatePassword`, `requestAffiliatePasswordReset` (MVP stub)
  - `convex/affiliates.ts`: `authenticateAffiliate`, `registerAffiliate` (owner-initiated), `updateAffiliatePassword`, `setAffiliatePassword`
- **Functions to keep (business logic, not auth):**
  - `convex/affiliateAuth.ts`: `getCurrentAffiliate` (update implementation, not delete), `validateRecaptchaToken`, all dashboard/stats/commission queries
  - `convex/affiliates.ts`: all non-auth mutations (status changes, tier checks, referral code generation, etc.)
- **New pages needed:** `/portal/forgot-password` (forgot password flow), `/portal/pending` (pending approval redirect)
- **reCAPTCHA:** Keep `validateRecaptchaToken` in `convex/affiliateAuth.ts` — bot protection still needed, call before Better Auth sign-up
- **CSRF protection:** `advanced.disableCSRFCheck: false` must remain enforced after migration. Verify after removing the sign-out workaround in route handler.
- **Input sanitization:** ALL email fields must be `.trim().toLowerCase()` before calling any Better Auth method or Convex lookup. Currently `SignIn.tsx` and `AffiliateSignInForm.tsx` do NOT trim — this causes silent failures with leading/trailing spaces (duplicate accounts, broken sign-in). Fix at form layer AND as defensive trim in mutations/hooks.
- **Anti-spam (reCAPTCHA + Rate Limiting):** SaaS Owner sign-up has reCAPTCHA (via `ReCaptchaWrapper` in `SignUp.tsx`). Sign-in uses Better Auth's `rateLimit` plugin (server-enforced, 5/min per email, 20/min per IP) — reCAPTCHA is NOT used on sign-in because it adds latency and doesn't prevent direct API abuse. Affiliate sign-up retains reCAPTCHA (validated in `completeAffiliateSignUp`).
- **Affiliate sign-up two-step flow (TD-7):** After migration, affiliate registration uses `authClient.signUp.email()` + `completeAffiliateSignUp` action (matches SaaS Owner's `SignUp.tsx` + `completeSignUp` pattern). `tenantSlug`, `campaignSlug`, and `promotionChannel` are passed to `completeAffiliateSignUp`, NOT through Better Auth `additionalFields`.
- **Cross-boundary imports (TD-8):** After moving `createAuth` to `convex/auth.ts`, `src/lib/auth.ts` becomes a thin type re-export file. `authWithoutCtx` type and `Session` type are re-exported for `src/` consumers. Email helper imports simplify to relative paths within `convex/`.
- **Affiliate forgot password (TD-9):** Must use dedicated `/portal/reset-password` page with `callbackURL` routing to keep redirect chain within the affiliate portal. `authClient.forgetPassword()` must pass `callbackURL` with tenant slug.
- **Orphaned user recovery (TD-10):** If `completeAffiliateSignUp` fails after `authClient.signUp.email()` succeeds, the user is stuck (can't re-register, can't access portal). Client-side retry flow: detect existing session, skip sign-up, retry `completeAffiliateSignUp`. Detection utility for admin use.
- **Multi-tenant affiliate (Edge Case A):** Affiliate can be on multiple tenants. `AffiliateSignUpForm` must detect existing session and offer "join program" flow. `getCurrentAffiliate` must accept optional `tenantSlug` filter to avoid returning wrong tenant.
- **`initialToken` validation:** Decode the JWT payload via `Buffer.from(token.split(".")[1], "base64url")`, parse JSON, compare `payload.exp * 1000 < Date.now()`. Pass `null` if expired or malformed to avoid flash of authenticated content. Use `getToken()` from `auth-server.ts`. No additional JWT library needed.
- **`src/lib/affiliate-auth-client.ts`** — Uses localStorage for sessions. After migration, this file and its `useAffiliateAuth` hook should be replaced by standard `authClient` usage from `src/lib/auth-client.ts`.
- **`src/lib/affiliate-auth.test.ts`** — Tests for `hashPassword` (SHA-256 via `crypto.subtle`) and `isAffiliateRoute`/`isAffiliateAuthRoute`. Route helpers may still be useful; `hashPassword` tests should be removed (no longer needed).
- **Error message consistency:** All user-facing error messages across auth forms should use toast notifications (via `sonner`). Error tone should be action-oriented ("Please try again in a minute" not "Rate limit exceeded"). Follow existing patterns in `SignIn.tsx` and `SignUp.tsx` for message placement and styling. Key messages to standardize: "Invalid email or password" (credential error), "Too many sign-in attempts — please wait a minute and try again" (rate limit), "This reset link has expired — please request a new one" (token error), "An account with this email already exists" (duplicate).
