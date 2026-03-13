# Story 2.2: SaaS Owner Login

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SaaS Owner**,
I want to log in to my account securely,
so that I can access my dashboard and manage my affiliate program.

## Acceptance Criteria

1. **AC1: Valid Login Creates Session** — Given the SaaS Owner is on the login page
   **When** they submit valid email and password
   **Then** the session is created with httpOnly cookies
   **And** the user is redirected to the dashboard
   **And** tenant context is loaded for all subsequent requests

2. **AC2: Invalid Credentials Rejection** — Given invalid credentials are submitted
   **When** the login form is submitted
   **Then** a generic error message is displayed
   **And** no session is created

3. **AC3: Rate Limiting After Failed Attempts** — Given 5 failed login attempts have occurred
   **When** the user attempts another login
   **Then** rate limiting is applied
   **And** the user must wait before attempting again

4. **AC4: Password Visibility Toggle** — Given the user is entering their password
   **When** they click the visibility toggle
   **Then** the password field shows/hides the password

5. **AC5: Remember Me Option** — Given the user is on the login page
   **When** they check "Remember me"
   **Then** the session persists longer (if supported by Better Auth)

## Tasks / Subtasks

- [ ] **Task 1: Verify Existing Login Implementation** (AC: 1, 2)
  - [ ] 1.1 Review existing SignInForm component implementation
  - [ ] 1.2 Verify session creation with httpOnly cookies
  - [ ] 1.3 Verify redirect to dashboard after successful login
  - [ ] 1.4 Verify tenant context loading after login
  - [ ] 1.5 Verify error handling for invalid credentials

- [ ] **Task 2: Implement Rate Limiting** (AC: 3)
  - [ ] 2.1 Track failed login attempts per email/IP
  - [ ] 2.2 Implement lockout after 5 failed attempts
  - [ ] 2.3 Add rate limiting display to UI
  - [ ] 2.4 Add cooldown period (e.g., 15 minutes)

- [ ] **Task 3: Enhance Login Form UX** (AC: 4, 5)
  - [ ] 3.1 Add password visibility toggle
  - [ ] 3.2 Add "Remember me" checkbox (if Better Auth supports it)
  - [ ] 3.3 Add "Forgot password?" link
  - [ ] 3.4 Add "Sign up" link for new users

- [ ] **Task 4: Security Hardening** (AC: 2, 3)
  - [ ] 4.1 Ensure generic error messages (don't reveal if email exists)
  - [ ] 4.2 Add CSRF protection
  - [ ] 4.3 Log failed login attempts for security audit

- [ ] **Task 5: Testing** (AC: All)
  - [ ] 5.1 Create integration test for successful login
  - [ ] 5.2 Create test for invalid credentials rejection
  - [ ] 5.3 Create test for rate limiting
  - [ ] 5.4 Create test for password visibility toggle

## Dev Notes

### Critical Architecture Patterns

**This Story Builds on Previous Work:**
- **Story 1.3** (COMPLETE): SaaS Owner Authentication - Provided Better Auth configuration
- **Story 2.1** (COMPLETE): SaaS Owner Registration - Verified auth flow, created onboarding
- **SignInForm component already exists** at `src/components/auth/SignInForm.tsx`
- **Sign-in page already exists** at `src/app/(unauth)/sign-in/SignIn.tsx`

**This Story's Focus:**
- Verify existing login implementation works correctly
- Implement rate limiting for failed login attempts
- Enhance login form UX with password visibility toggle
- Add "Remember me" functionality if supported
- Add "Forgot password" flow

### Technical Stack Requirements

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 16.1.0 |
| Backend | Convex | 1.32.0 |
| Authentication | Better Auth | 1.4.9 |
| Forms | React Hook Form | 7.65.0 |
| Validation | Zod | 4.1.12 |
| Styling | Tailwind CSS | 4.1.16 |

### Key Files to Modify/Create

```
src/
├── app/
│   └── (unauth)/
│       └── sign-in/
│           └── SignIn.tsx              # EXISTING: May need enhancements
│
├── components/
│   └── auth/
│       └── SignInForm.tsx              # EXISTING: Verify and enhance
│
└── lib/
    └── auth.ts                         # EXISTING: May need rate limiting config
```

### Project Structure Notes

**Alignment with Unified Project Structure:**
- Follows established patterns from Stories 1.3 and 2.1
- Uses existing `src/lib/auth.ts` configuration
- Extends existing Convex auth functions if needed
- Creates new files following naming conventions:
  - Components: PascalCase (e.g., `SignInForm.tsx`)
  - Pages: `page.tsx`, `layout.tsx`

**Existing Components to Leverage:**
- `SignInForm.tsx` - Already exists with email/password fields
- `SignUpForm.tsx` - Already exists (for reference)
- `SignIn.tsx` - Sign-in page already exists
- `src/lib/auth.ts` - Better Auth configuration
- `convex/auth.ts` - Auth-related Convex functions

### Architecture Compliance

**Authentication (from architecture.md):**
- Use Better Auth with Convex adapter
- Cookie-based sessions with httpOnly cookies
- Tenant context loaded for all authenticated requests
- Rate limiting for failed login attempts

**Route Protection (from architecture.md):**
- Use `src/proxy.ts` for route protection
- Sign-in route is public (unauthenticated)
- Protected routes redirect to sign-in when not authenticated

**Convex Functions (from project-context.md):**
- Use NEW function syntax (not legacy)
- Include argument and return validators
- Use `internal*` decorators for private functions

### Previous Story Intelligence

**From Story 2.1 (SaaS Owner Registration):**
- SignInForm already exists with email and password fields
- Session is created with httpOnly cookies (handled by Better Auth)
- Tenant context loading is handled at Convex layer
- Redirect to `/dashboard` after successful auth
- Onboarding redirect after registration

**Learnings to Apply:**
- Continue using the same patterns established in Stories 1.3 and 2.1
- The login should redirect to `/dashboard` (not onboarding - that's for new users)
- Rate limiting should follow Better Auth conventions or custom implementation
- Use similar error handling as registration

### Anti-Patterns to Avoid

❌ **DO NOT** create new authentication - reuse Story 1.3 implementation
❌ **DO NOT** modify existing auth configuration significantly - extend it
❌ **DO NOT** reveal whether email exists or not in error messages (security)
❌ **DO NOT** skip validation on any form field
❌ **DO NOT** use `any` types - maintain strict type safety
❌ **DO NOT** hardcode rate limit thresholds - make them configurable
❌ **DO NOT** skip loading tenant context after login

### Testing Requirements

**Testing Framework:** Vitest (already set up in project)

**Required Tests:**
1. Login success flow (integration)
2. Invalid credentials rejection (integration)
3. Rate limiting after 5 failed attempts (integration)
4. Password visibility toggle (unit)
5. Session created with httpOnly cookies (integration)
6. Redirect to dashboard after login (integration)

### Dependencies on Other Stories

This story **DEPENDS ON** these completed stories:
- **Story 1.3** (COMPLETE): SaaS Owner Authentication - Provides auth infrastructure
- **Story 2.1** (COMPLETE): SaaS Owner Registration - Verified auth flow

This story **ENABLES** these future stories:
- **Story 2.3**: Mock SaligPay OAuth - Requires authenticated user
- **Story 2.4**: Team Member Invitation - Requires authenticated user
- All subsequent Epic 2 stories require login capability

### Login Flow Design

The login flow should:
1. Display email and password fields
2. Show "Remember me" checkbox
3. Show "Forgot password?" link
4. Show "Sign up" link for new users
5. Handle loading state during authentication
6. Display generic error for invalid credentials
7. Implement rate limiting after 5 failed attempts
8. Redirect to `/dashboard` on success

### Rate Limiting Strategy

Options for rate limiting:
1. **Better Auth built-in**: Check if Better Auth has rate limiting
2. **Convex scheduler**: Track failed attempts in database, implement lockout
3. **External service**: Use third-party rate limiting (if configured)

**Recommended Approach:**
- Track failed attempts in Convex (using a lightweight table or cache)
- Implement 5-attempt lockout with 15-minute cooldown
- Display countdown or lockout message in UI

## References

- [Source: epics.md#Story 2.2] - Full acceptance criteria
- [Source: epics.md#Epic 2] - Epic overview and goals
- [Source: architecture.md#Authentication & Security] - Better Auth configuration
- [Source: architecture.md#Project Structure & Boundaries] - Directory structure
- [Source: project-context.md#Technology Stack & Versions] - Tech versions
- [Source: project-context.md#Critical Implementation Rules] - Implementation rules
- [Source: Story 1.3] - Authentication infrastructure
- [Source: 2-1-saas-owner-registration.md] - Previous story implementation patterns

## Change Log

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

