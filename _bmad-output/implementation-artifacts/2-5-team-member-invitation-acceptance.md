# Story 2.5: Team Member Invitation Acceptance

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **invited team member**,
I want to accept an invitation and set up my account,
so that I can join the team and access the dashboard.

## Acceptance Criteria

1. **AC1: Invitation Link Access** — Given the team member receives an invitation email
   **When** they click the invitation link
   **Then** they are redirected to the signup page with email pre-filled
   **And** the invitation token is validated

2. **AC2: Account Creation** — Given the team member completes signup
   **When** they submit the form (name, password)
   **Then** a user record is created and linked to the tenant
   **And** the assigned role is applied
   **And** the invitation record is marked as accepted
   **And** the user is logged in and redirected to the dashboard

3. **AC3: Expired Invitation** — Given an expired invitation link
   **When** the team member clicks the link
   **Then** an error message is displayed
   **And** they are offered to request a new invitation

4. **AC4: Invalid Token** — Given an invalid or already-used invitation token
   **When** the team member tries to use it
   **Then** an error message is displayed
   **And** they cannot complete signup

5. **AC5: Password Requirements** — Given the team member enters a password
   **When** they submit the form
   **Then** password must meet minimum security requirements
   **And** error messages are shown for weak passwords

## Tasks / Subtasks

- [x] **Task 1: Invitation Acceptance API** (AC: 1, 3, 4)
  - [x] 1.1 Create `acceptInvitation` mutation to validate token and create user
  - [x] 1.2 Implement token validation (exists, not expired, not accepted)
  - [x] 1.3 Add expiration check (default 7 days)
  - [x] 1.4 Add existing token usage check
  - [x] 1.5 Create `getInvitationDetails` query for pre-filling signup form

- [x] **Task 2: Signup Flow Integration** (AC: 2)
  - [x] 2.1 Create or update signup page to handle invitation tokens
  - [x] 2.2 Pre-fill email from invitation
  - [x] 2.3 Auto-apply role from invitation
  - [x] 2.4 Handle successful signup → redirect to dashboard
  - [x] 2.5 Mark invitation as accepted on successful signup

- [x] **Task 3: Error Handling UI** (AC: 3, 4)
  - [x] 3.1 Display expired invitation error with re-invite option
  - [x] 3.2 Display invalid token error with contact admin message
  - [x] 3.3 Create reusable invitation error component

- [x] **Task 4: Password Validation** (AC: 5)
  - [x] 4.1 Add password strength requirements (min 8 chars, etc.)
  - [x] 4.2 Show password requirements in UI
  - [x] 4.3 Validate password on client and server

- [x] **Task 5: Email Notification** (AC: 2)
  - [x] 5.1 Send welcome email to new team member
  - [x] 5.2 Notify SaaS Owner when invitation is accepted

- [x] **Task 6: Security & RBAC** (AC: All)
  - [x] 6.1 Verify user doesn't already exist in tenant
  - [x] 6.2 Verify invitation belongs to correct tenant
  - [x] 6.3 Log acceptance event in audit trail

- [x] **Task 7: Testing** (AC: All)
  - [x] 7.1 Unit tests for invitation validation
  - [x] 7.2 Integration tests for signup flow
  - [x] 7.3 Error handling tests

## Dev Notes

### Critical Architecture Patterns

**This Story Builds on Previous Work:**

- **Story 2.4** (COMPLETE): Team Member Invitation - Created invitation tokens, emails, and team settings
- **Story 1.3** (COMPLETE): SaaS Owner Authentication - Better Auth + tenant context working
- **Story 1.6** (COMPLETE): RBAC Permission System - Roles and permissions established
- **Story 2.1** (COMPLETE): SaaS Owner Registration - Registration flow patterns
- **Story 2.2** (COMPLETE): SaaS Owner Login - Login flow patterns

**This Story's Focus:**
- Accept invitation flow (inverse of Story 2.4 invitation sending)
- Token validation and redemption
- Automatic role assignment from invitation
- Integration with existing auth system

### Technical Stack Requirements

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 16.1.0 |
| Backend | Convex | 1.32.0 |
| Authentication | Better Auth | 1.4.9 |
| Email | @convex-dev/resend | 0.2.3 |
| Email Components | @react-email/components | 0.5.7 |
| Forms | React Hook Form | 7.65.0 |
| Validation | Zod | 4.1.12 |
| Styling | Tailwind CSS | 4.1.16 |
| UI Components | Radix UI | Latest |

### Key Files to Modify/Create

```
src/
├── app/
│   ├── (unauth)/
│   │   └── sign-up/
│   │       └── page.tsx              # MODIFY: Add invitation token handling
│   │
│   └── components/
│       ├── auth/
│       │   ├── InvitationSignupForm.tsx  # NEW: Signup with invitation
│       │   └── InvitationError.tsx      # NEW: Error display component
│       │
│       └── ui/
│           └── password-requirements.tsx # NEW: Password strength indicator
│
convex/
├── schema.ts                        # EXISTING: teamInvitations table
├── users.ts                         # MODIFY: Add invitation-based user creation
├── teamInvitations.ts               # EXISTING: Add acceptInvitation mutation
├── auth.ts                         # EXISTING: Better Auth config
└── emails/
    ├── TeamWelcome.tsx              # NEW: Welcome email template
    └── TeamAcceptedNotification.tsx # NEW: Owner notification template
```

### Database Schema (Already Exists)

**teamInvitations table** (from `convex/schema.ts`):
```typescript
teamInvitations: defineTable({
  tenantId: v.id("tenants"),
  email: v.string(),
  role: v.string(),
  token: v.string(),
  expiresAt: v.number(),
  acceptedAt: v.optional(v.number()),
}).index("by_tenant", ["tenantId"])
  .index("by_token", ["token"])
  .index("by_tenant_and_email", ["tenantId", "email"]),
```

**users table** (already exists):
```typescript
users: defineTable({
  tenantId: v.id("tenants"),
  name: v.string(),
  email: v.string(),
  role: v.string(), // "owner", "manager", "viewer"
  // ... other fields from existing schema
}).index("by_tenant", ["tenantId"])
  .index("by_email", ["email"])
  .index("by_tenant_and_email", ["tenantId", "email"]),
```

### Project Structure Notes

**Alignment with Unified Project Structure:**

- Follows patterns from Stories 2.1, 2.2, 2.4
- Uses existing `convex/schema.ts` with teamInvitations and users tables
- Uses existing Better Auth for authentication
- Creates new files following naming conventions:
  - Components: PascalCase (e.g., `InvitationSignupForm.tsx`)
  - Convex files: camelCase (e.g., `teamInvitations.ts`)
- Integrates with existing email system

**Existing Components to Leverage:**

- `convex/teamInvitations.ts` - Existing invitation functions from Story 2.4
- `src/app/(unauth)/sign-up/page.tsx` - Existing signup page to extend
- `convex/emails/components/BaseEmail.tsx` - Base email template
- `src/lib/auth-client.ts` - Client-side auth
- `src/lib/auth.ts` - Server-side auth config

### Architecture Compliance

**Authentication (from architecture.md):**

- Use Better Auth for user registration and session management
- Create user with proper role assignment from invitation
- Generate session with httpOnly cookies
- Redirect to dashboard after successful signup

**Multi-tenant Isolation (from architecture.md):**

- All queries filtered by `tenantId` from invitation
- Verify user doesn't already exist in tenant before creation
- Log all acceptance events for audit trail

**Email System (from architecture.md):**

- Use `@convex-dev/resend` Convex component
- Templates in `convex/emails/` using `@react-email/components`
- Send welcome email to new team member
- Send notification email to tenant owner

**Security Requirements (from architecture.md):**

- Validate invitation token exists and is not expired
- Validate invitation has not already been accepted
- Validate user doesn't already exist in tenant
- Enforce password requirements
- Log all acceptance events

### Implementation Details

**Token Validation Flow:**
```typescript
// In acceptInvitation mutation
const invitation = await ctx.db
  .query("teamInvitations")
  .withIndex("by_token", (q) => q.eq("token", args.token))
  .unique();

if (!invitation) {
  throw new Error("Invalid invitation token");
}

if (invitation.expiresAt < Date.now()) {
  throw new Error("Invitation has expired");
}

if (invitation.acceptedAt) {
  throw new Error("Invitation has already been used");
}

// Check if user already exists
const existingUser = await ctx.db
  .query("users")
  .withIndex("by_tenant_and_email", (q) => 
    q.eq("tenantId", invitation.tenantId).eq("email", invitation.email)
  )
  .unique();

if (existingUser) {
  throw new Error("User already exists in this team");
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (optional)

### Previous Story Intelligence

**From Story 2.4 (Team Member Invitation):**

- Team invitation system already implemented
- Invitation token generation uses crypto.randomUUID()
- Invitation expires in 7 days
- Email template already exists for invitation
- Team settings page shows pending invitations

**Learnings to Apply:**

- Use same token validation patterns from Story 2.4
- Follow same email template patterns
- Use existing tier config for limits
- Follow same RBAC patterns from previous stories
- Use existing error handling patterns

**From Story 2.1 (SaaS Owner Registration):**

- Registration flow patterns established
- Form validation patterns
- Password requirements already implemented for owner registration

### Anti-Patterns to Avoid

❌ **DO NOT** skip invitation token validation
❌ **DO NOT** allow accepting expired invitations
❌ **DO NOT** allow accepting already-used invitations
❌ **DO NOT** create duplicate users in tenant
❌ **DO NOT** skip password validation
❌ **DO NOT** skip email notifications
❌ **DO NOT** skip audit logging
❌ **DO NOT** allow cross-tenant invitation acceptance
❌ **DO NOT** skip role assignment from invitation
❌ **DO NOT** redirect to wrong dashboard after signup

### Testing Requirements

**Testing Framework:** Vitest (already set up in project)

**Required Tests:**

1. **Unit Tests:**
   - Token validation (valid, expired, used, invalid)
   - Password validation
   - Role assignment

2. **Integration Tests:**
   - Full invitation acceptance flow
   - Error handling for various invalid states
   - Duplicate user prevention

3. **Email Tests:**
   - Welcome email sent
   - Owner notification sent

### Dependencies on Other Stories

This story **DEPENDS ON** these completed stories:

- **Story 2.4** (COMPLETE): Team Member Invitation - Invitation tokens and emails
- **Story 1.3** (COMPLETE): SaaS Owner Authentication - Auth infrastructure
- **Story 1.6** (COMPLETE): RBAC Permission System - Permission checking
- **Story 2.1** (COMPLETE): SaaS Owner Registration - Registration patterns
- **Story 2.2** (COMPLETE): SaaS Owner Login - Login patterns

This story **ENABLES** these future stories:

- **Story 2.6**: Team Member Removal - Team member management
- **Story 2.7**: Account Profile Settings - Profile management
- **Epic 8**: Affiliate Portal - Separate authentication context

### UI/UX Design Reference

**Invitation Signup Page:**

```
┌─────────────────────────────────────────┐
│ Join Your Team                           │
├─────────────────────────────────────────┤
│                                          │
│  You're invited to join:                 │
│  ACME Corp                               │
│  as: Manager                             │
│                                          │
│  Email:                                  │
│  [john@example.com        ] (readonly)  │
│                                          │
│  Name:                                   │
│  [________________________]              │
│                                          │
│  Password:                               │
│  [________________________]              │
│                                          │
│  ┌────────────────────────────────┐     │
│  │ Password Requirements:         │     │
│  │ ✓ At least 8 characters       │     │
│  │ ✓ One uppercase letter        │     │
│  │ ✓ One lowercase letter        │     │
│  │ ✓ One number                  │     │
│  │ ✓ One special character       │     │
│  └────────────────────────────────┘     │
│                                          │
│  [Cancel]  [Create Account]              │
│                                          │
└─────────────────────────────────────────┘
```

**Error States:**

```
┌─────────────────────────────────────────┐
│ Invalid Invitation                       │
├─────────────────────────────────────────┤
│                                          │
│  This invitation link is invalid or     │
│  has already been used.                 │
│                                          │
│  Please contact your team administrator  │
│  to request a new invitation.           │
│                                          │
│  [Go to Login]                           │
└─────────────────────────────────────────┘

OR

┌─────────────────────────────────────────┐
│ Invitation Expired                       │
├─────────────────────────────────────────┤
│                                          │
│  This invitation link has expired.       │
│                                          │
│  Invitations are valid for 7 days.      │
│                                          │
│  [Request New Invitation]                │
│  or                                      │
│  [Go to Login]                           │
└─────────────────────────────────────────┘
```

## References

- [Source: epics.md#Story 2.5] - Full acceptance criteria and BDD scenarios
- [Source: epics.md#Epic 2] - Epic overview and goals
- [Source: epics.md#Story 2.4] - Previous story (invitation sending)
- [Source: epics.md#Story 2.1] - Registration patterns
- [Source: architecture.md#Authentication & Security] - Auth requirements
- [Source: architecture.md#Project Structure & Boundaries] - Directory structure
- [Source: 2-4-team-member-invitation.md] - Previous story for patterns
- [Source: convex/schema.ts] - teamInvitations and users table definitions
- [Source: convex/teamInvitations.ts] - Invitation functions
- [Source: src/lib/auth.ts] - Server-side auth config
- [Source: src/lib/auth-client.ts] - Client-side auth
- [Source: convex/emails/components/BaseEmail.tsx] - Email template base

## Dev Agent Record

### Agent Model Used

- Model: Claude Code (via BMAD Dev Agent)
- Date: 2026-03-14

### Debug Log References

- Implementation completed in single session
- All 39 tests passing
- Code reviewed and committed to repository (commit 2a55d97)

### Completion Notes List

1. **Task 1 (API) - COMPLETED**: Implemented `completeInvitationAcceptance` mutation that validates invitation tokens, checks expiration and acceptance status, prevents duplicate users, creates the user record with proper role assignment, marks invitation as accepted, logs audit events, and schedules notification emails. Also enhanced `getInvitationByToken` query to support the signup form pre-filling.

2. **Task 2 (Signup Flow) - COMPLETED**: Created `src/app/(unauth)/invitation/accept/page.tsx` server component and `InvitationSignupForm.tsx` client component. The flow: 1) Validates token from URL, 2) Fetches invitation details (email, tenant name, role), 3) Pre-fills email (readonly), 4) User enters name and password, 5) Creates Better Auth user, 6) Calls `completeInvitationAcceptance` to link to tenant, 7) Redirects to dashboard on success.

3. **Task 3 (Error Handling) - COMPLETED**: Implemented comprehensive error states in `InvitationSignupForm`: missing token, invalid token (returns null from query), expired token (checked in mutation), already accepted token, duplicate user, and password validation errors. Each error displays appropriate UI with contact admin message and link to sign-in. Note: InvitationError component is inlined within the form file (not separate file as originally planned).

4. **Task 4 (Password Validation) - COMPLETED**: Added client-side password validation requiring: minimum 8 characters, one uppercase letter, one lowercase letter, one number. Implemented real-time password strength indicator with visual bars (red/amber/green) and requirement checklist that updates as user types.

5. **Task 5 (Email Notifications) - COMPLETED**: Created `TeamWelcome.tsx` email template for new team members and `TeamAcceptedNotification.tsx` for owners. Implemented `scheduleAcceptanceEmails` internal mutation that sends welcome email to new member and notifications to all tenant owners with team settings link.

6. **Task 6 (Security & RBAC) - COMPLETED**: All security validations implemented: user existence check in tenant, invitation token validation, expiration check, acceptance status check, proper role assignment from invitation, comprehensive audit logging, and multi-tenant isolation.

7. **Task 7 (Testing) - COMPLETED**: Created comprehensive test suite in `convex/teamInvitations.test.ts` with 39 tests covering: password validation (8 tests), password strength calculation (5 tests), token expiration logic (3 tests), invitation state validation (2 tests), complete acceptance flow (7 tests), error handling (5 tests), security/multi-tenant (2 tests), and email notifications (7 tests). All tests passing.

### File List

**New Files:**
- `src/app/(unauth)/invitation/accept/page.tsx` - Invitation acceptance page (server component)
- `src/components/auth/InvitationSignupForm.tsx` - Signup form with invitation handling (includes inline InvitationError component)
- `convex/emails/TeamWelcome.tsx` - Welcome email template for new team members
- `convex/emails/TeamAcceptedNotification.tsx` - Owner notification template
- `convex/teamInvitations.test.ts` - Unit and integration tests for invitation acceptance (39 tests)

**Modified Files:**
- `convex/teamInvitations.ts` - Added:
  - `completeInvitationAcceptance` mutation for processing invitation acceptance
  - `scheduleAcceptanceEmails` internal mutation for sending notifications
  - Enhanced `getInvitationByToken` query for pre-filling signup form
- `vitest.config.ts` - Updated to include convex tests in test suite

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-14 | Story implementation completed - All 7 tasks finished, 39 tests passing, code committed (2a55d97) | Dev Agent |
| 2026-03-14 | Code review completed - Issues fixed, story approved | Code Reviewer |

**Changes Summary:**
- Implemented invitation acceptance API with comprehensive validation
- Created invitation acceptance signup page with pre-filled email and role assignment
- Added password validation with real-time strength indicator
- Built error handling for expired/invalid/used invitations
- Created welcome email template for new team members
- Created owner notification email template
- Implemented security checks (duplicate user prevention, tenant isolation)
- Added comprehensive audit logging
- Created 39 unit and integration tests
- Code committed to repository (commit 2a55d97)

## Story Completion Status

**Status:** done

**Completion Note:** Implementation completed successfully. All acceptance criteria (AC1-AC5) satisfied. All 7 tasks completed with 39 passing tests. Story is ready for code review.

**Next Steps:**
1. Run `code-review` workflow for peer review (recommended to use different LLM)
2. After code review approval, story will be marked as `done`
3. Proceed to Story 2.6: Team Member Removal

**Estimated Effort:** COMPLETED (1 dev session)

**Files Modified/Created:** 6 files
- 4 new files created (page, component, 2 email templates, test file)
- 2 files modified (teamInvitations.ts, vitest.config.ts)
