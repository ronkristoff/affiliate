---
title: "Mandatory OTP Two-Factor Authentication — Email OTP as Post-Login Verification"
slug: "otp-two-factor-email"
created: "2026-04-11"
status: "completed"
stepsCompleted: [1, 2, 3, 4, 4-R, 4-R2, 5, 6]
tech_stack:
  - Next.js 16.1.0 (App Router)
  - Convex 1.32.0
  - Better Auth 1.5.3 (twoFactor plugin + emailOTP plugin)
  - @convex-dev/better-auth 0.10.13
  - @react-email/components 0.5.7
  - Resend / Postmark (dual email provider via EMAIL_PROVIDER env var)
  - React Hook Form 7.65.0 + Zod 4.1.12 (zod/v4)
  - Tailwind CSS 4.1.16
  - TypeScript 5.9.3
files_to_modify:
  - convex/auth.ts
  - convex/email.tsx
  - convex/emails/verifyOTP.tsx
  - convex/twoFactorActions.ts (NEW)
  - src/app/(auth)/settings/EnableTwoFactor.tsx
  - src/app/(auth)/settings/DisableTwoFactor.tsx (NEW)
  - src/app/(unauth)/enable-2fa/EnableTwoFactorSetup.tsx (NEW)
  - src/app/(unauth)/enable-2fa/page.tsx (NEW)
  - src/app/(unauth)/verify-2fa/TwoFactorVerification.tsx
  - src/app/(unauth)/sign-in/SignIn.tsx
  - src/proxy.ts
  - .env.example
code_patterns:
  - Dual-path email sending: action context (Postmark+Resend via sendAuthEmail) vs mutation context (Resend-only via sendEmailFromMutation)
  - "runAction" in ctx check for context detection
  - Better Auth adapter pattern: betterAuthComponent.adapter(ctx) → factory({ options: {} }) → db.findMany/create/update
  - react-hook-form + zodResolver from @hookform/resolvers/zod + zod/v4 schemas
  - Suspense boundaries for client components with useQuery/useMutation (Next.js 16 requirement)
  - Environment variable feature flags via NEXT_PUBLIC_ prefix for client access
  - Auth config factory pattern: createOptions(ctx) returns full Better Auth config
  - Error handling: form setError() or alert() for auth errors (NOT toast/sonner)
  - Loading states: useState<boolean> with finally { setLoading(false) } blocks
  - Static imports only in Convex queries/mutations (NO dynamic imports)
test_patterns:
  - No existing test infrastructure for auth flows (placeholder tests only)
  - Vitest configured; .test.tsx suffix
  - Manual testing via seed data (password: TestPass123!)
---

# Tech-Spec: Mandatory OTP Two-Factor Authentication — Email OTP as Post-Login Verification

**Created:** 2026-04-11
**Revised:** 2026-04-11 (adversarial review — 15 findings addressed)

## Overview

### Problem Statement

The `twoFactor` plugin is imported in `convex/auth.ts` and the verify-2fa UI at `(unauth)/verify-2fa/TwoFactorVerification.tsx` already has an "Email Code" tab, but the server-side `twoFactor()` configuration has no `otpOptions.sendOTP` callback. Email OTP verification after login is non-functional. Additionally, there is no way to enforce 2FA as a mandatory step for all users based on environment configuration.

### Solution

Configure the `twoFactor` plugin with `otpOptions.sendOTP` using the existing dual-path email pattern. Add a `TWO_FACTOR_ENABLED` environment variable that, when set to `true`, makes email OTP verification **mandatory for all users on every login**. Users who haven't set up 2FA yet are gracefully redirected to a forced setup flow on their next login.

**Critical API constraint:** Better Auth's `twoFactor.enable()` only supports TOTP setup in the released version (1.5.3). PR #5739 (`twoFactorMethod: "otp"`) is still open/unmerged. The workaround (confirmed in GitHub issue #8627 and discussion #8411) is to directly set `twoFactorEnabled: true` on the Better Auth component `user` table via the adapter, without creating a TOTP record. This enables OTP as the sole 2FA method. No backup codes are generated in this approach.

### Scope

**In Scope:**
- `TWO_FACTOR_ENABLED` env var — when `true`, 2FA is mandatory for all users on every login
- `NEXT_PUBLIC_TWO_FACTOR_ENABLED` — client-side mirror so sign-in pages can decide redirect behavior
- `TWO_FACTOR_OTP_EXPIRY_SECONDS` env var — configurable OTP expiry (default: 300 = 5 minutes, recommend 600 for PH/SEA)
- Wire up `otpOptions.sendOTP` on the `twoFactor` plugin in `convex/auth.ts` (dual-path: action + mutation contexts)
- Add "2fa" purpose to `sendAuthEmail` action and `sendOTPVerification` helper in `convex/email.tsx`
- Update `VerifyOTP` email template to handle "2fa" purpose with dynamic expiry text
- **Custom Convex action `enableTwoFactorOtp`** — verifies password, sets `twoFactorEnabled: true` on component `user` table via adapter, revokes existing sessions
- Create `(unauth)/enable-2fa/EnableTwoFactorSetup.tsx` for forced setup flow
- **Custom Convex query `getTwoFactorStatus`** — reads `twoFactorEnabled` from component `user` table for proxy.ts enforcement
- Update `TwoFactorVerification.tsx` — add 30s resend cooldown, hide "Trust device" when mandatory
- Update `SignIn.tsx` — forced setup redirect when env var is true and no `twoFactorRedirect`
- **Server-side enforcement** in `src/proxy.ts` — redirect users without `twoFactorEnabled` to `/enable-2fa`; add `/enable-2fa` to public routes with special handling
- Rate limiting on OTP endpoints (Better Auth `rateLimit` plugin): max 5 attempts per 5 minutes
- 30-second client-side cooldown between OTP resend attempts
- **Sign-out escape hatch** on forced setup page
- **Disable 2FA flow** in Settings → Security (reverses the setup)
- **Affiliate portal 2FA** — extend forced setup to `/portal/login` flow

**Out of Scope:**
- TOTP / authenticator app setup for new users (not using `twoFactor.enable()` at all)
- Passwordless sign-in via email OTP (the `emailOTP` plugin already handles this separately)
- SMS OTP
- Per-tenant OTP policy configuration
- Bulk migration to auto-enable 2FA on existing users (graceful approach)
- Backup codes — NOT available with the OTP-only workaround (documented limitation)
- Changes to the existing `emailOTP` plugin sign-in flow
- Admin recovery flow for users locked out of 2FA (elevated to pre-requisite — Task 14)

## Context for Development

### Codebase Patterns

- **Dual-path email sending**: Better Auth callbacks fire in both action and mutation contexts. Check `"runAction" in ctx` — if true, use `ctx.runAction(internal.email.sendAuthEmail, ...)`. If false, fall back to `sendOTPVerification()`.
- **Better Auth adapter pattern**: Access component-scoped tables via `betterAuthComponent.adapter(ctx)` → call factory → get `db` object with `findMany`, `findOne`, `create`, `update` methods. The component `user` table has `twoFactorEnabled` field.
- **Email service abstraction**: NEVER use Resend directly. Use `sendEmail` action or `sendEmailFromMutation` mutation. Provider routing controlled by `EMAIL_PROVIDER` Convex env var.
- **Static imports only in Convex**: Dynamic imports (`await import()`) are NOT supported in queries/mutations (V8 runtime). All imports must be at the top of the file.
- **Form validation**: `react-hook-form` + `zodResolver` from `@hookform/resolvers/zod` + `zod/v4` schemas.
- **Suspense boundaries**: Client components with hooks wrapped in `<Suspense>` (Next.js 16 requirement).
- **Error handling**: Auth errors via `setError()` or `alert()`. No toast for auth errors.
- **Environment variables**: Convex env vars via `pnpm convex env set`. Client vars via `NEXT_PUBLIC_` prefix. `NEXT_PUBLIC_` vars are NOT available in Convex runtime.

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `convex/auth.ts` | Auth config factory — `twoFactor()` at line 169, `emailOTP` pattern at lines 146-168 | L1-15 (imports), L31 (factory), L146-168 (emailOTP), L169 (twoFactor) |
| `convex/email.tsx` | `sendAuthEmail` action and `sendOTPVerification` helper — add "2fa" purpose | L84-105, L945-1011 |
| `convex/emails/verifyOTP.tsx` | OTP email template — add "2fa" purpose with dynamic expiry | L11-34 |
| `convex/twoFactorActions.ts` | **NEW** — Custom `enableTwoFactorOtp` action and `getTwoFactorStatus` query | N/A |
| `src/proxy.ts` | Route protection — add 2FA enforcement, add `/enable-2fa` to public routes | L5-11 (publicRoutes), L117-123 (auth redirect logic) |
| `src/lib/auth-server.ts` | `isAuthenticated`, `fetchAuthQuery`, `fetchAuthAction` for server-side auth | L1-14 |
| `src/app/(unauth)/sign-in/SignIn.tsx` | Sign-in flow — add forced setup redirect | L166-167 |
| `src/app/(unauth)/verify-2fa/TwoFactorVerification.tsx` | Verify page — add cooldown, hide trust device | L161-282 |
| `src/app/(unauth)/enable-2fa/EnableTwoFactorSetup.tsx` | **NEW** — Forced OTP setup component | N/A |
| `src/app/(unauth)/enable-2fa/page.tsx` | **NEW** — Page wrapper | N/A |
| `src/app/(auth)/settings/EnableTwoFactor.tsx` | Current TOTP setup — rewrite to OTP only | L42-280 |
| `src/app/(auth)/settings/DisableTwoFactor.tsx` | **NEW** — Disable 2FA flow | N/A |
| `.env.example` | Add new env vars | L1-60 |

### Technical Decisions

1. **Mandatory 2FA via env var**: `TWO_FACTOR_ENABLED=true` makes 2FA mandatory for ALL users. Graceful rollout — users who haven't set up 2FA are redirected to forced setup on next login. When `false` or unset, login proceeds normally.
2. **OTP-only via `updateUser` workaround** (addresses F2, F6): Since PR #5739 is unmerged, `twoFactor.enable()` only supports TOTP. Instead, use a custom Convex action that directly sets `twoFactorEnabled: true` on the Better Auth component `user` table via the adapter pattern. This bypasses TOTP setup entirely. **Limitation: no backup codes are generated.** Users who lose email access have no recovery path (admin recovery is future work).
3. **Component table, not app table** (addresses F1): `twoFactorEnabled` lives on Better Auth's component-scoped `user` table, NOT the app's `users` table. All reads/writes must go through the adapter pattern: `betterAuthComponent.adapter(ctx)`.
4. **Dual-path email pattern**: Reuse the `"runAction" in ctx` check from `emailOTP.sendVerificationOTP` (lines 146-168). Works with both Resend and Postmark.
5. **OTP expiry via env var**: `TWO_FACTOR_OTP_EXPIRY_SECONDS` (default 300). Recommend 600 for PH/SEA. Email template must show dynamic expiry text.
6. **"2fa" purpose in email system**: Add `"2fa"` to `sendAuthEmail` and `sendOTPVerification` purpose unions.
7. **Rate limiting**: Better Auth `rateLimit` plugin — `window: 300, max: 5` (5 attempts per 5 minutes for all 2FA endpoints). Separate from custom `convex/rateLimit.ts`.
8. **Resend cooldown**: 30-second client-side cooldown. Timer displayed to user.
9. **Security note**: Email OTP is weaker than TOTP (depends on email account security). No backup codes available.
10. **Two setup components**: `(auth)/settings/EnableTwoFactor.tsx` for authenticated users. `(unauth)/enable-2fa/EnableTwoFactorSetup.tsx` for forced setup. Both call the same custom Convex action.
11. **Server-side enforcement in proxy.ts** (addresses F3, F4, F5): Add `/enable-2fa` to `publicRoutes` with special handling — allow authenticated users to access it (don't redirect to dashboard). Use `fetchAuthQuery` with a new `getTwoFactorStatus` query to check `twoFactorEnabled` from the component `user` table.
12. **Session revocation** (addresses F7): After enabling 2FA, the custom action MUST revoke all existing sessions via `authClient.revokeSessions()` or server-side equivalent. This prevents pre-2FA sessions from being used to bypass 2FA.
13. **Toggle-off behavior** (addresses F14): When env var removed, users with 2FA keep their setting. Users can disable 2FA via Settings → Security → Disable 2FA (new flow).
14. **"Trust device" hidden for mandatory 2FA** (addresses F6): When `TWO_FACTOR_ENABLED=true`, hide the "Trust this device for 60 days" checkbox in `TwoFactorVerification.tsx`.
15. **No `NEXT_PUBLIC_` mismatch detection in Convex** (addresses F8): `NEXT_PUBLIC_` vars only exist at Next.js build time, not in Convex runtime. Document that both vars must be set together. Remove any Convex-side mismatch check.
16. **Affiliate portal coverage** (addresses F13): The forced setup redirect must also be added to the affiliate login flow at `/portal/login`. The affiliate portal has its own sign-in component but uses the same Better Auth session.

### Login Flow (when `TWO_FACTOR_ENABLED=true`)

```
User enters email + password
  → Sign-in succeeds
  → Does the response include twoFactorRedirect?
      YES → User has 2FA set up → Redirect to /verify-2fa → Enter email OTP → Dashboard
      NO  → User has NOT set up 2FA → Redirect to /enable-2fa (forced setup)
            → Enter password → Custom action: verify password + set twoFactorEnabled: true
              + revoke all sessions → Send OTP → Verify OTP → Dashboard
            (no backup codes — documented limitation)
```

**Server-side enforcement (proxy.ts):**
```
Authenticated request to (auth) routes:
  → TWO_FACTOR_ENABLED=true?
      YES → fetchAuthQuery(getTwoFactorStatus, { email })
          → twoFactorEnabled=false?
              YES → Redirect to /enable-2fa (blocks all (auth) routes)
              NO  → Allow request
      NO → Allow request

Unauthenticated request to /enable-2fa:
  → Redirect to /sign-in (user must be authenticated to set up 2FA)
```

### Login Flow (when `TWO_FACTOR_ENABLED=false` or unset)

```
User enters email + password
  → Sign-in succeeds → Dashboard (normal flow, no OTP step)
```

### Failure Mode Analysis

| # | Component | Failure Mode | Impact | Severity | Mitigation |
|---|-----------|-------------|--------|----------|------------|
| F1 | Email delivery | OTP email never arrives | User locked out | 🔴 Critical | No backup codes available. Rate-limited resend. Admin recovery (future work). |
| F2 | OTP expiry | Code expires before entry | User must resend | 🟡 Medium | Configurable expiry. Recommend 600s for PH/SEA. |
| F3 | Session state | Pending 2FA cookie expires | User re-signs in | 🟢 Low | Better Auth handles. |
| F4 | No backup codes | User loses email access | Permanent lockout | 🔴 Critical | Document limitation. Admin recovery flow (future work). |
| F5 | Forced setup bypass | Direct nav to dashboard | Access without 2FA | 🔴 Critical | Server-side proxy.ts guard using fresh DB query. |
| F6 | Session not revoked | Old session bypasses 2FA | Security gap | 🔴 Critical | Custom action revokes ALL sessions after enabling 2FA. |
| F7 | OTP brute force | 1M combinations in window | Account compromise | 🔴 Critical | Rate limit: max 5 per 5 minutes. |
| F8 | Resend spam | Unlimited sendOtp calls | Inbox flood, cost | 🟡 Medium | 30s cooldown. Rate limit. |
| F9 | Email provider down | Postmark/Resend outage | All 2FA fails | 🔴 Critical | Dual-provider. Manual switch. |
| F10 | Affiliate portal | Affiliate bypasses 2FA | Inconsistent enforcement | 🟡 Medium | Add forced setup to `/portal/login` flow. |

## Implementation Plan

### Tasks

- [ ] **Task 1: Add "2fa" purpose to email system**
  - File: `convex/email.tsx`
  - Action: Add `v.literal("2fa")` to the `purpose` union in `sendAuthEmail` action args (line 957-961). Add `"2fa"` to the `purpose` type in `sendOTPVerification` helper (line 93). Add "2fa" case in `sendAuthEmail` switch with subject "Your two-factor verification code" and `<VerifyOTP code={args.otp!} purpose="2fa" expiryMinutes={...} />`.
  - Notes: Both Postmark and Resend work automatically via dual-path.

- [ ] **Task 2: Update VerifyOTP email template for "2fa" purpose with dynamic expiry**
  - File: `convex/emails/verifyOTP.tsx`
  - Action: Add `"2fa"` to `purpose` type union. Add `expiryMinutes?: number` prop (default 5). Add 2FA conditional branches:
    - `headingText`: "Your Two-Factor Verification Code"
    - `bodyText`: `Use the verification code below to complete your sign-in. This code will expire in ${expiryMinutes} minutes.`
    - `disclaimerText`: "If you didn't attempt to sign in, you can safely ignore this email. Someone may have access to your account — consider changing your password."
  - Notes: This fixes the hardcoded "5 minutes" issue. The `expiryMinutes` prop is computed from `TWO_FACTOR_OTP_EXPIRY_SECONDS / 60` in the caller.

- [ ] **Task 3: Configure twoFactor plugin with otpOptions.sendOTP**
  - File: `convex/auth.ts`
  - Action: Replace `twoFactor()` at line 169. **Use STATIC imports only** — `sendOTPVerification` and `requireMutationCtx` are already imported at lines 12-14:
    ```typescript
    twoFactor({
      otpOptions: {
        sendOTP: async ({ user, otp }, ctx) => {
          if ("runAction" in ctx) {
            await (ctx as any).runAction(internal.email.sendAuthEmail, {
              type: "otp",
              to: user.email,
              otp,
              purpose: "2fa",
            });
          } else {
            const mutationCtx = requireMutationCtx(ctx);
            await sendOTPVerification(mutationCtx, {
              to: user.email,
              code: otp,
              purpose: "2fa",
            });
          }
        },
        expiresIn: Number(process.env.TWO_FACTOR_OTP_EXPIRY_SECONDS) || 300,
      },
    }),
    ```
  - Notes: Callback signature `({ user, otp }, ctx)` confirmed from Better Auth docs. `user.email` is available. NO dynamic imports. The `expiresIn` controls OTP validity.

- [ ] **Task 4: Create custom Convex action and query for OTP-only 2FA**
  - File: `convex/twoFactorActions.ts` (NEW)
  - Action: Create two Convex functions:

    **`enableTwoFactorOtp` (action)**:
    - Args: `{ password: v.string(), email: v.string() }` (email from session)
    - Steps:
      1. **Verify password by calling Better Auth's `signInEmail` internally** — this verifies the password AND creates a fresh session token:
         ```typescript
         const signInResult = await auth.api.signInEmail({
           body: { email, password },
         });
         if (signInResult.error) throw new Error("Invalid password");
         ```
      2. Set `twoFactorEnabled: true` on the component `user` table via adapter:
         ```typescript
         const factory = betterAuthComponent.adapter(ctx);
         const db = factory({ options: {} });
         const users = await db.findMany({ model: "user" });
         const user = users.find(u => u.email === email);
         if (user) {
           await db.update({ model: "user", where: { id: user.id }, data: { twoFactorEnabled: true } });
         }
         ```
         **Fallback if `db.update` fails** (adapter `update` may have issues like `findOne`/`delete` per AGENTS.md): use read-modify-write pattern — `findMany` → filter → `delete` old record → `create` new record with `twoFactorEnabled: true`.
      3. **Revoke all OTHER sessions** (keep the fresh session from step 1 alive — it's needed for the OTP send step):
         ```typescript
         // Revoke all sessions EXCEPT the current one
         const sessions = await auth.api.listSessions();
         for (const session of sessions) {
           if (session.token !== currentSessionToken) {
             await auth.api.revokeSession({ body: { id: session.id } });
           }
         }
         ```
      4. Return `{ success: true, sessionToken: signInResult.session?.token }` so the client can use the fresh session for OTP.
    - Notes: This approach (N4 fix) uses Better Auth's built-in password verification via `signInEmail` instead of manual hash comparison. The fresh session from step 1 is kept alive so the client can call `twoFactor.sendOtp()` in step 2. All OTHER sessions (pre-2FA) are revoked. This is the only safe way to both verify the password AND maintain a valid session for the OTP flow.

    **`getTwoFactorStatus` (query)**:
    - Args: `{ email: v.string() }`
    - Steps:
      1. Query component `user` table via adapter
      2. Return `{ twoFactorEnabled: boolean | null }`
    - Notes: Used by proxy.ts for server-side enforcement. Must be a query (runs in V8, fast).

    **`disableTwoFactorOtp` (action)**:
    - Args: `{ email: v.string() }`
    - Steps:
      1. Set `twoFactorEnabled: false` on component `user` table via adapter
      2. Do NOT revoke sessions (N9 fix) — when 2FA is disabled, existing sessions are acceptable. Revoking would force re-login which is confusing UX. The next sign-in will simply skip 2FA.
      3. Return `{ success: true }`
    - Notes: Used by the Settings → Security → Disable 2FA flow.

  - Notes: Import `betterAuthComponent` from `./auth` (static import). Import `internal` from `./_generated/api`. The `auth` object for revoking sessions must be created within the action using the Better Auth config.

- [ ] **Task 5: Add environment variables to .env.example**
  - File: `.env.example`
  - Action: Add section:
    ```
    # ===========================================
    # Two-Factor Authentication (Optional)
    # ===========================================
    # Enable mandatory 2FA for all users (set to "true" to enable)
    # TWO_FACTOR_ENABLED=true
    # Client-side flag (must match TWO_FACTOR_ENABLED)
    # NEXT_PUBLIC_TWO_FACTOR_ENABLED=true
    # OTP expiry time in seconds (default: 300 = 5 minutes)
    # Recommend 600 (10 minutes) for PH/SEA deployments
    # TWO_FACTOR_OTP_EXPIRY_SECONDS=300
    ```
  - Notes: `TWO_FACTOR_ENABLED` → Convex env (server-side). `NEXT_PUBLIC_TWO_FACTOR_ENABLED` → .env.local (client-side). Both must be set together. NO mismatch detection is possible across runtimes.

- [ ] **Task 6: Update SignIn.tsx for forced setup redirect**
  - File: `src/app/(unauth)/sign-in/SignIn.tsx`
  - Action: In `onSuccess` callback (line 162), after existing `twoFactorRedirect` check:
    ```typescript
    if (ctx.data.twoFactorRedirect) {
      router.push("/verify-2fa");
    } else if (process.env.NEXT_PUBLIC_TWO_FACTOR_ENABLED === "true") {
      router.push("/enable-2fa");
    } else {
      // ... existing dashboard routing
    }
    ```
  - Notes: `twoFactorRedirect` is currently a boolean (PR #8772 not yet merged). If/when it merges, the response shape changes to `{ twoFactorRedirect: true, twoFactorMethods: [...] }` — update accordingly.

- [ ] **Task 7: Add server-side 2FA enforcement and route handling to proxy.ts**
  - File: `src/proxy.ts`
  - Action: Three changes:
    1. **Add `/enable-2fa` to `publicRoutes`** (line 5-11):
       ```typescript
       const publicRoutes = [
         "/sign-in", "/sign-up", "/verify-2fa", "/enable-2fa",
         "/reset-password", "/forgot-password",
       ];
       ```
    2. **Special handling for `/enable-2fa`** — override the "redirect authenticated users away from public routes" logic (line 119). `/enable-2fa` should be accessible to authenticated users (they were just redirected there after sign-in):
       ```typescript
       if (isAuthed && publicRoutes.some(route => pathname.startsWith(route))) {
         // Exception: /enable-2fa is accessible to authenticated users
         // (they were redirected here after sign-in for forced 2FA setup)
         if (pathname.startsWith("/enable-2fa")) {
           return NextResponse.next();
         }
         return NextResponse.redirect(new URL("/dashboard", request.url));
       }
       ```
    3. **2FA enforcement before protected routes** (after line 126). When `TWO_FACTOR_ENABLED=true` and user is authenticated, check their `twoFactorEnabled` status via `fetchAuthQuery`:
       ```typescript
       if (process.env.NEXT_PUBLIC_TWO_FACTOR_ENABLED === "true" && isAuthed) {
         // Get user email from session for the query
         const email = await getToken(); // or extract from session
         const status = await fetchAuthQuery(api.twoFactorActions.getTwoFactorStatus, { email });
         if (status && !status.twoFactorEnabled && !pathname.startsWith("/enable-2fa")) {
           return NextResponse.redirect(new URL("/enable-2fa", request.url));
         }
       }
       ```
  - Notes: `fetchAuthQuery` is available from `src/lib/auth-server.ts` (line 8). It runs server-side and can query Convex. The `getTwoFactorStatus` query reads from the component `user` table (NOT the app's `users` table). Need to get the user's email from the session — check how `isAuthenticated()` works internally or extract from the auth token.

- [ ] **Task 8: Create forced 2FA setup page and component**
  - File: `src/app/(unauth)/enable-2fa/page.tsx` (NEW), `src/app/(unauth)/enable-2fa/EnableTwoFactorSetup.tsx` (NEW)
  - Action: Create forced setup flow. `page.tsx` is a simple wrapper (same as `verify-2fa/page.tsx`). `EnableTwoFactorSetup.tsx`:

    **Step 1 — Password verification:**
    - Form with email (pre-filled, read-only) and password
    - On submit: call custom Convex action `enableTwoFactorOtp` via `useMutation`
    - On success: fresh session created by `signInEmail` inside the action, other sessions revoked, advance to Step 2
    - On error: `setError("password", { message: "Invalid password." })`
    - **Escape hatch**: "Sign out" button — `authClient.signOut()` → redirect to `/sign-in`

    **Step 2 — Send & verify OTP:**
    - Auto-call `authClient.twoFactor.sendOtp()` on mount (session is valid from Step 1)
    - 6-digit code input, `inputMode="numeric"`, `maxLength={6}`
    - "Resend code" with 30-second cooldown
    - On submit: `authClient.twoFactor.verifyOtp({ code })`
    - On success: redirect to `callbackUrl` search param or `/dashboard` (new 2FA-verified session created by verifyOtp)
    - On error: `setError("code", { message: "Invalid code." })`

    **No backup codes step** — the OTP-only workaround doesn't generate backup codes. Display a note: "Two-factor authentication is now enabled. You'll be asked for a verification code on every sign-in."

  - Notes: Style consistent with auth pages. No TOTP. Error via `setError()`. Loading via `useState`. Wrapped in Suspense by page.tsx. Preserve `callbackUrl` from search params so affiliates redirect to `/portal/home` instead of `/dashboard` (N6 fix).

- [ ] **Task 9: Simplify EnableTwoFactor.tsx to email OTP only**
  - File: `src/app/(auth)/settings/EnableTwoFactor.tsx`
  - Action: Remove TOTP code (QRCode import, totpUri, verifyTotp). Replace with:
    - Password form → call `enableTwoFactorOtp` action → auto-send OTP → verify OTP
    - After success: show success message, no backup codes
    - Add "Resend code" with 30s cooldown
    - The action creates a fresh session via `signInEmail` and revokes other sessions, so the user stays signed in
  - Notes: This is for authenticated users managing 2FA from Settings. Keep "Back to Settings" nav.

- [ ] **Task 10: Create DisableTwoFactor.tsx**
  - File: `src/app/(auth)/settings/DisableTwoFactor.tsx` (NEW)
  - Action: Simple component:
    - Warning text: "Disabling 2FA reduces your account security."
    - Password verification form
    - On submit: call `disableTwoFactorOtp` mutation
    - On success: redirect to `/sign-in?disabled=true` (sessions are revoked, so user must re-authenticate)
    - The sign-in page should check for `?disabled=true` and show a success message: "Two-factor authentication has been disabled."
  - Notes: Addresses F14 — users need a way to disable 2FA. Since sessions are revoked on disable, redirect to sign-in (not Settings) so the user can see the success message after re-authenticating (N9 fix).

- [ ] **Task 11: Update TwoFactorVerification.tsx**
  - File: `src/app/(unauth)/verify-2fa/TwoFactorVerification.tsx`
  - Action:
    - Add 30-second resend cooldown to OTP tab
    - Hide "Trust this device for 60 days" checkbox when `NEXT_PUBLIC_TWO_FACTOR_ENABLED === "true"`
    - Keep TOTP tab for backward compat (existing TOTP users)
    - **Hide Backup Code tab for OTP-only users** (N7 fix): Users with `twoFactorEnabled: true` but no TOTP record have no backup codes. Query the `getTwoFactorStatus` endpoint (or check `twoFactorMethods` from the sign-in response if PR #8772 merged) to determine if the user has TOTP. If OTP-only, hide the Backup Code tab to prevent confusion.
    - Keep Backup Code tab for existing TOTP users who have backup codes
  - Notes: The `handleOtpSend` and `handleOtpVerify` functions already exist.

- [ ] **Task 12: Add affiliate portal 2FA handling**
  - File: `src/app/(unauth)/portal/login/` (find the sign-in component)
  - Action: Add the same forced setup redirect logic as Task 6:
    ```typescript
    if (ctx.data.twoFactorRedirect) {
      router.push("/portal/verify-2fa"); // or shared /verify-2fa
    } else if (process.env.NEXT_PUBLIC_TWO_FACTOR_ENABLED === "true") {
      router.push("/enable-2fa"); // shared forced setup page
    }
    ```
  - Notes: The affiliate portal uses the same Better Auth session. The forced setup page works for both owner and affiliate users. May need to check if `/enable-2fa` redirect works for affiliate paths or if a portal-specific page is needed.

- [ ] **Task 13: Configure Better Auth rate limiting**
  - File: `convex/auth.ts`
  - Action: Add `rateLimit` plugin to plugins array:
    ```typescript
    import { rateLimit } from "better-auth/plugins";
    // In plugins array:
     rateLimit({ window: 300, max: 5 }),
     ```
   - Notes: Import from `better-auth/plugins` (NOT `better-auth/plugins/rate-limit`). This protects ALL Better Auth endpoints with 5 attempts per 5 minutes. Separate from custom `convex/rateLimit.ts` which handles login-specific limiting.

- [ ] **Task 14: Admin recovery procedure for locked-out users**
  - File: `convex/twoFactorActions.ts` (add new function)
  - Action: Create a **platform-admin-only** action to reset a user's 2FA:
    ```typescript
    export const adminResetTwoFactor = action({
      args: { email: v.string() },
      returns: v.object({ success: v.boolean() }),
      handler: async (ctx, args) => {
        // 1. Verify the caller is a platform admin (check user role in app's users table)
        // 2. Set twoFactorEnabled: false on the component user table via adapter
        // 3. Revoke all sessions for that user
        // 4. Return { success: true }
      },
    });
    ```
  - Also document a **manual recovery procedure** in code comments:
    1. Identify the user by email
    2. Run via Convex dashboard: `adminResetTwoFactor({ email: "user@example.com" })`
    3. Notify the user to sign in again and re-enable 2FA
  - Notes: This is the **safety valve** for users who lose email access. Without backup codes, this is the ONLY recovery path. Must be restricted to platform admins. The action must verify the caller's role before proceeding.

### Acceptance Criteria

- [ ] **AC 1**: Given `TWO_FACTOR_ENABLED=true` and a user WITH 2FA, when the user signs in, then they are redirected to `/verify-2fa` and must enter a valid email OTP.
- [ ] **AC 2**: Given `TWO_FACTOR_ENABLED=true` and a user WITHOUT 2FA, when the user signs in, then they are redirected to `/enable-2fa` for forced setup.
- [ ] **AC 3**: Given a user on forced setup, when they complete password verification → OTP verification, then all existing sessions are revoked and they are redirected to `/dashboard` with a new 2FA-verified session.
- [ ] **AC 4**: Given `TWO_FACTOR_ENABLED=false` or unset, when any user signs in, then they go directly to the dashboard.
- [ ] **AC 5**: Given `TWO_FACTOR_ENABLED=true` and a user WITHOUT 2FA, when they navigate directly to `/dashboard`, then the server redirects them to `/enable-2fa` (proxy.ts enforcement).
- [ ] **AC 6**: Given `TWO_FACTOR_ENABLED=true`, when an authenticated user accesses `/enable-2fa`, then the page loads normally (no redirect to `/dashboard`).
- [ ] **AC 7**: Given rate limiting, when a user enters 5 incorrect OTP codes, then further attempts are blocked for 5 minutes.
- [ ] **AC 8**: Given the OTP email, when the user receives it, then the email contains heading "Your Two-Factor Verification Code", body with correct expiry time, disclaimer about unauthorized access, and the 6-digit code.
- [ ] **AC 9**: Given `TWO_FACTOR_OTP_EXPIRY_SECONDS=600`, when an OTP is sent, then the email body says "10 minutes" (not "5 minutes").
- [ ] **AC 10**: Given an existing TOTP user, when they sign in, then the `/verify-2fa` page shows the TOTP tab and they can verify with their authenticator app.
- [ ] **AC 11**: Given `TWO_FACTOR_ENABLED=true`, when the `/verify-2fa` page renders, then the "Trust this device" checkbox is hidden.
- [ ] **AC 12**: Given `TWO_FACTOR_ENABLED` turned off, when a user who previously enabled 2FA signs in, then they are STILL prompted for OTP.
- [ ] **AC 13**: Given a user on the forced setup page, when they click "Sign out", then they are signed out and redirected to `/sign-in`.
- [ ] **AC 14**: Given OTP delivery, when the email is sent, then it works with both Resend and Postmark (controlled by `EMAIL_PROVIDER`).
- [ ] **AC 15**: Given a user who enabled 2FA, when they go to Settings → Security → Disable 2FA and enter their password, then 2FA is disabled and they are signed out (must re-authenticate).
- [ ] **AC 16**: Given an affiliate user with `TWO_FACTOR_ENABLED=true`, when they sign in at `/portal/login`, then the same forced setup / verify flow applies.

## Additional Context

### Dependencies

- **Better Auth twoFactor plugin** — `sendOTP` callback signature confirmed: `async ({ user, otp }, ctx)`. `user.email` available.
- **Better Auth adapter pattern** — confirmed working for reading/writing component `user` table. Used in `seedAuthHelpers.ts`.
- **PR #5739 (unmerged)** — `twoFactorMethod: "otp"` NOT available. Workaround: direct `updateUser` via adapter.
- **PR #8772 (unmerged)** — `twoFactorRedirect` response shape still `{ twoFactorRedirect: true }` (boolean). Monitor for merge.
- **Issue #8627** — Confirms OTP-only approach works by setting `twoFactorEnabled: true` without TOTP record.
- **No new npm packages needed.**

### Testing Strategy

**Manual testing:**
1. Set `TWO_FACTOR_ENABLED=true` + `NEXT_PUBLIC_TWO_FACTOR_ENABLED=true` in `.env.local`
2. Set `TWO_FACTOR_ENABLED=true` via `pnpm convex env set`
3. Sign in → verify forced setup redirect → complete setup → verify OTP → dashboard
4. Sign out → sign in → verify `/verify-2fa` redirect → verify OTP → dashboard
5. Navigate directly to `/dashboard` before setup → verify proxy redirect
6. Test with existing TOTP user → verify TOTP tab
7. Unset env vars → verify normal login
8. Test resend cooldown, wrong OTP, rate limiting
9. Test disable 2FA from Settings
10. Test "Sign out" on forced setup page
11. Test with `EMAIL_PROVIDER=postmark` and `EMAIL_PROVIDER=resend`
12. Test affiliate portal login flow

### Notes

**Critical limitation: No backup codes.**
The OTP-only workaround does not generate backup codes. Users who lose email access have no recovery path. This is the most significant risk. Mitigation: Task 14 provides an admin recovery action (`adminResetTwoFactorOtp`) restricted to platform admins.

**Session revocation nuance (N8 fix).**
The custom `enableTwoFactorOtp` action uses `signInEmail` internally to verify the password AND create a fresh session. This fresh session is kept alive so the client can call `twoFactor.sendOtp()` in the next step. Only OTHER (pre-2FA) sessions are revoked. This is the only safe approach — revoking ALL sessions would leave the user with no valid session for the OTP send step.

**`twoFactorEnabled` is on the component `user` table.**
All reads must go through the adapter pattern or a dedicated Convex query. The app's `users` table does NOT have this field.

**Proxy.ts performance note (N5).**
The `fetchAuthQuery(api.twoFactorActions.getTwoFactorStatus, ...)` call in proxy.ts adds a network round-trip to every authenticated request when `TWO_FACTOR_ENABLED=true`. The `getTwoFactorStatus` query is lightweight (single adapter lookup), but monitor response times after deployment. If latency is unacceptable, consider caching the result in a cookie or using Better Auth's session claims to embed `twoFactorEnabled` status.

**Future considerations:**
- Per-tenant OTP policy
- TOTP option for high-security tenants
- Admin recovery flow for locked-out users
- SMS OTP alternative
- Backup code generation (when PR #5739 merges)
- `twoFactorMethods` response handling (when PR #8772 merges)
- OTP delivery analytics (delivery rate, time-to-enter)
