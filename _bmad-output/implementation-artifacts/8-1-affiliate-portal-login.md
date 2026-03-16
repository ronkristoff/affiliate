# Story 8.1: Affiliate Portal Login

Status: done

## Story

As an approved affiliate,
I want to log in to a branded affiliate portal with email and password,
so that I can access my affiliate dashboard and resources. (FR37)

## Acceptance Criteria

### AC1: Successful Login Flow
**Given** the affiliate is on the portal login page
**When** they submit valid email and password
**Then** the session is created
**And** the affiliate is redirected to the portal home
**And** the portal displays the tenant's branding (logo, colors)

### AC2: Suspended Account Handling
**Given** the affiliate's account is suspended
**When** they attempt to log in
**Then** an error message is displayed
**And** no session is created

### AC3: Pending Approval Handling
**Given** the affiliate's application is still pending
**When** they attempt to log in
**Then** a message is displayed indicating the application is under review

## Tasks / Subtasks

- [x] Task 1: Implement tenant branding on login page (AC: #1)
  - [x] 1.1 Fetch tenant context using `getAffiliateTenantContext` query
  - [x] 1.2 Apply tenant's primary color as CSS variable (--brand)
  - [x] 1.3 Display tenant's logo in portal header
  - [x] 1.4 Display tenant's portal name in header
  - [x] 1.5 Remove/hide any salig-affiliate branding (white-label requirement)

- [x] Task 2: Enhance login page UI to match design (AC: #1)
  - [x] 2.1 Create tabbed interface (Sign In / Join Program)
  - [x] 2.2 Style form inputs per design spec (rounded corners: 10px, proper padding)
  - [x] 2.3 Add "Forgot password?" link (even if placeholder for MVP)
  - [x] 2.4 Add terms of service text below submit button
  - [ ] 2.5 Implement trust signal strip (affiliate count + average earnings)
  - **NOTE**: Temporarily removed hardcoded fake data. Requires backend query for real tenant affiliate metrics before re-enabling.

- [x] Task 3: Integrate with existing backend (AC: #1, #2, #3)
  - [x] 3.1 Verify `loginAffiliate` mutation handles all status cases
  - [x] 3.2 Ensure error messages match UX spec for each status
  - [x] 3.3 Test redirect to `/portal/home` on successful login
  - [x] 3.4 Verify session cookie is set correctly via API route

- [x] Task 4: Implement status-specific error UI (AC: #2, #3)
  - [x] 4.1 Display "pending approval" message with icon (hourglass/clock)
  - [x] 4.2 Display "suspended" message with contact support guidance
  - [x] 4.3 Display "rejected" message (if applicable)
  - [x] 4.4 Style error states per design spec (amber for pending, red for errors)

- [x] Task 5: Session management verification (AC: #1)
  - [x] 5.1 Verify httpOnly cookie is set with session token
  - [x] 5.2 Verify session persists across page refreshes
  - [x] 5.3 Test session expiration behavior (7-day expiry)
  - [x] 5.4 Implement logout functionality if not present

### Review Follow-ups (AI)
  - [ ] [AI-Review][LOW] Add comprehensive unit tests for login flow
  - [ ] [AI-Review][LOW] Add integration tests for tenant branding rendering
  - [ ] [AI-Review][LOW] Add proper ARIA attributes to AuthTabs for accessibility
  - [ ] [AI-Review][LOW] Implement functional "Forgot Password" flow or remove clickable link
  - [ ] [AI-Review][LOW] Create Terms of Service and Privacy Policy pages or modals
  - [ ] [AI-Review][LOW] Implement real trust strip data query (`getPublicTenantStats`)

## Senior Developer Review (AI)

**Reviewer:** msi (Code Review Agent)  
**Date:** 2026-03-16  
**Outcome:** Changes Requested → Fixed → Approved

### Review Summary
Adversarial code review identified 1 HIGH, 2 MEDIUM, and 5 LOW priority issues. All HIGH and MEDIUM issues have been resolved.

### Issues Resolved

**🔴 HIGH - Task 2.5 Incompletely Implemented (FIXED)**
- **Issue:** Trust signal used hardcoded fake data (fake initials, static "+42 affiliates", fake earnings)
- **Fix:** Removed hardcoded trust strip entirely. Added note that real data query needed before re-enabling.
- **File:** `src/app/portal/login/page.tsx`

**🟡 MEDIUM - Missing Error Handling in Server Component (FIXED)**
- **Issue:** `fetchQuery` for tenant context had no try-catch; page would crash on failure
- **Fix:** Added try-catch block around tenant fetch with graceful error state showing "Portal Not Found" message
- **File:** `src/app/portal/login/page.tsx`

**🟡 MEDIUM - Logo Image Without Error Handler (FIXED)**
- **Issue:** Tenant logo image could show broken image icon if URL invalid
- **Fix:** Added `onError` handler that hides broken image and shows fallback initial logo
- **File:** `src/app/portal/login/page.tsx`

### Remaining LOW Priority Items
- Accessibility: Add ARIA attributes to tab buttons
- UX: "Forgot Password" link is non-functional placeholder
- UX: Terms links are non-functional placeholders
- Feature: Implement real trust strip with `getPublicTenantStats` query
- Code: Remove unused template literal classes in AuthTabs

## Dev Notes

### CRITICAL: Backend Already Implemented

**DO NOT recreate or modify backend authentication logic.** The following Convex functions are complete and tested:

| Function | File | Purpose |
|----------|------|---------|
| `loginAffiliate` | `convex/affiliateAuth.ts:435-533` | Handles login with status checks |
| `validateAffiliateSession` | `convex/affiliateAuth.ts:539-581` | Session validation |
| `logoutAffiliate` | `convex/affiliateAuth.ts:586-604` | Session invalidation |
| `getAffiliateTenantContext` | `convex/affiliateAuth.ts:668-702` | Tenant branding fetch |
| `requestAffiliatePasswordReset` | `convex/affiliateAuth.ts:814-852` | Password reset (MVP placeholder) |

**Status handling already implemented in `loginAffiliate`:**
- `pending`: Returns error "Your account is pending approval..."
- `suspended`: Returns error "Your account has been suspended..."
- `rejected`: Returns error "Your application has been rejected."
- `active`: Creates session and returns success

### Frontend Files to Modify

| File | Current State | Required Changes |
|------|---------------|------------------|
| `src/app/portal/login/page.tsx` | Basic card layout | Add tenant branding, redesign per UI spec |
| `src/components/affiliate/AffiliateSignInForm.tsx` | Functional form | Enhance UI, improve error display |
| `src/app/portal/register/page.tsx` | Exists | Add tab switching, align styling |

### API Route

The form calls `/api/affiliate-auth` which sets an httpOnly cookie. Verify this route exists and properly handles the login action.

### UI Design Reference

Primary design: `_bmad-output/screens/08-portal-login.html`

**Key Design Elements:**
1. **Header**: Tenant-branded with logo icon (32px) + portal name
2. **Auth Card**: 400px max-width, 16px border-radius, subtle shadow
3. **Tabs**: 50/50 grid, active tab shows brand color underline
4. **Form Inputs**: 10px border-radius, 1.5px border, brand color on focus
5. **Submit Button**: Full width, brand background, 10px radius, bold text
6. **Trust Strip**: Avatar stack + affiliate count + average earnings text
7. **Footer**: © tenant name only (no salig-affiliate branding)

**Color System (CSS Variables):**
```css
--brand: #10409a;          /* Tenant's primary color - dynamic */
--brand-light: #eff6ff;
--brand-dark: #0c2e6e;
--text-heading: #1a1a2e;
--text-body: #474747;
--text-muted: #6b7280;
--bg-page: #f8fafc;
--bg-surface: #ffffff;
--border: #e5e7eb;
```

**Typography:**
- Font: Poppins (already configured in project)
- Labels: 13px, weight 600
- Inputs: 14px
- Button: 15px, weight 700

### Session Cookie Behavior

The affiliate session is stored in an httpOnly cookie (not localStorage). The session:
- Expires after 7 days (`SESSION_EXPIRY_MS` in affiliateAuth.ts)
- Is validated server-side via `validateAffiliateSession` query
- Should be cleared on logout via `logoutAffiliate` mutation

### Error Message Mappings

| Affiliate Status | Error Message | UI Treatment |
|-----------------|---------------|--------------|
| `pending` | "Your account is pending approval. Please wait for the merchant to approve your application." | Amber/pending state with hourglass icon |
| `suspended` | "Your account has been suspended. Please contact support." | Red error alert |
| `rejected` | "Your application has been rejected." | Red error alert |
| Invalid credentials | "Invalid email or password" | Red error alert |

### Project Structure Notes

- Follow existing component patterns in `src/components/affiliate/`
- Use Radix UI components from `src/components/ui/`
- Follow Tailwind CSS v4 utility patterns
- Client components use `"use client"` directive
- Server components fetch tenant context when possible

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1385-1405`] - Story definition and acceptance criteria
- [Source: `_bmad-output/screens/08-portal-login.html`] - UI design specification
- [Source: `convex/affiliateAuth.ts`] - Backend authentication implementation
- [Source: `src/components/affiliate/AffiliateSignInForm.tsx`] - Current form implementation
- [Source: `_bmad-output/planning-artifacts/architecture.md#L155-158`] - Authentication split pattern
- [Source: `AGENTS.md`] - Project coding standards

## Dev Agent Record

### Agent Model Used

mimo-v2-flash-free (opencode/mimo-v2-flash-free)

### Debug Log References

- Implemented tenant branding with dynamic CSS variables based on tenant's primary color
- Created tabbed authentication interface with Sign In / Join Program tabs
- Enhanced login form with proper error handling for different account statuses
- Verified session management with httpOnly cookies and 7-day expiration
- Applied design specifications from 08-portal-login.html reference

### Completion Notes List

✅ **Task 1: Tenant Branding Implementation**
- Fetch tenant context using `getAffiliateTenantContext` query
- Applied tenant's primary color as CSS variable (--brand)
- Display tenant's logo in portal header (with fallback to initial)
- Display tenant's portal name in header
- Removed salig-affiliate branding (white-label requirement)

✅ **Task 2: Enhanced Login UI**
- Created tabbed interface (Sign In / Join Program) using AuthTabs component
- Styled form inputs with 10px border-radius and proper padding
- Added "Forgot password?" link (placeholder for MVP)
- Added terms of service text below submit button
- ~~Implemented trust signal strip~~ Removed hardcoded fake data pending real metrics query

✅ **Task 3: Backend Integration**
- Verified `loginAffiliate` mutation handles all status cases (pending, suspended, rejected, active)
- Error messages match UX spec for each status
- Redirect to `/portal/home` on successful login
- Session cookie is set correctly via API route with httpOnly, secure, sameSite=lax, 7-day expiry

✅ **Task 4: Status-Specific Error UI**
- Display "pending approval" message with clock icon (amber styling)
- Display "suspended" message with contact support guidance (red styling)
- Display "rejected" message (red styling)
- Error states styled per design spec

✅ **Task 5: Session Management**
- httpOnly cookie set with session token (affiliate_session)
- Session persists across page refreshes via cookie
- Session expiration set to 7 days (SESSION_EXPIRY_MS)
- Logout functionality implemented via `/api/affiliate-auth?action=logout`

### Code Review Fixes Applied

**✅ HIGH Priority Fixes:**
- Removed hardcoded trust strip fake data (requires real backend query)

**✅ MEDIUM Priority Fixes:**
- Added try-catch error handling for tenant fetch with graceful "Portal Not Found" state
- Added logo image `onError` handler to show fallback initial on broken images

### File List
- `src/app/portal/login/page.tsx` - Updated with tenant branding and tabbed interface
- `src/components/affiliate/AuthTabs.tsx` - New component for tabbed authentication
- `src/components/affiliate/AffiliateSignInForm.tsx` - Enhanced with error handling and styling
- `src/app/api/affiliate-auth/route.ts` - Verified existing login/logout functionality
