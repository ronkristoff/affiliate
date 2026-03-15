# Story 2.4: Team Member Invitation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SaaS Owner**,
I want to invite team members by email and assign them a role,
so that my team can help manage the affiliate program with appropriate permissions.

## Acceptance Criteria

1. **AC1: Invitation Creation** — Given the SaaS Owner is on the Settings > Team page
   **When** they submit an email and select a role (Owner, Manager, Viewer)
   **Then** a team invitation record is created with a unique token
   **And** the invitation appears in the pending invitations list

2. **AC2: Invitation Email Sent** — Given a team invitation is created
   **When** the invitation is saved
   **Then** an invitation email is sent via Resend
   **And** the email contains the invitation link with token
   **And** the email uses tenant branding (if configured)

3. **AC3: Tier Limit Enforcement** — Given the invitation limit for the tier is reached
   **When** the SaaS Owner attempts to invite another team member
   **Then** an error message is displayed
   **And** the invitation is not sent
   **And** an upgrade prompt is shown

4. **AC4: Pending Invitations List** — Given there are pending invitations
   **When** the SaaS Owner views the Team page
   **Then** all pending invitations are displayed with email, role, and sent date
   **And** each invitation shows expiration status

5. **AC5: Invitation Cancellation** — Given a pending invitation exists
   **When** the SaaS Owner clicks "Cancel Invitation"
   **Then** the invitation is removed from pending list
   **And** the invitation token is invalidated
   **And** the action is logged in audit trail

6. **AC6: Duplicate Prevention** — Given an invitation already exists for an email
   **When** the SaaS Owner attempts to invite the same email again
   **Then** an error message is displayed
   **And** a new invitation is not created

7. **AC7: Existing User Prevention** — Given a user with the email already exists in the tenant
   **When** the SaaS Owner attempts to invite that email
   **Then** an error message is displayed
   **And** the user is informed the person is already a team member

## Tasks / Subtasks

- [x] **Task 1: Team Invitation Convex Mutations** (AC: 1, 3, 6, 7)
  - [x] 1.1 Create `createTeamInvitation` mutation with token generation
  - [x] 1.2 Implement tier limit check using `checkLimit` from tierConfig.ts
  - [x] 1.3 Add duplicate invitation check (by email + tenant)
  - [x] 1.4 Add existing user check (by email + tenant)
  - [x] 1.5 Create `getPendingInvitations` query for listing
  - [x] 1.6 Create `cancelInvitation` mutation
  - [x] 1.7 Add audit logging for all invitation actions

- [x] **Task 2: Email Template & Sending** (AC: 2)
  - [x] 2.1 Create team invitation email template in `convex/emails/TeamInvitation.tsx`
  - [x] 2.2 Use tenant branding (logo, colors) in email template
  - [x] 2.3 Include invitation link with token in email
  - [x] 2.4 Integrate email sending into `createTeamInvitation` mutation
  - [x] 2.5 Add email sending to `emails` table for tracking

- [x] **Task 3: Team Settings Page UI** (AC: 1, 3, 4, 5)
   - [x] 3.1 Create Settings > Team page at `src/app/(auth)/settings/team/page.tsx`
   - [x] 3.2 Create invite form with email input and role selector
   - [x] 3.3 Display pending invitations list with cancel action
   - [x] 3.4 Display existing team members list
   - [x] 3.5 Show tier limit status (current/max team members)
   - [x] 3.6 Show upgrade prompt when limit reached

- [x] **Task 4: Onboarding Integration** (AC: 1)
   - [x] 4.1 Update onboarding wizard Step 3 (Invite Team)
   - [x] 4.2 Integrate invitation form into onboarding flow
   - [x] 4.3 Allow skipping team invitation step
   - [x] 4.4 Mark step complete when invitation sent

- [x] **Task 5: RBAC Protection** (AC: All)
   - [x] 5.1 Verify only users with `users:*` or `manage:*` permission can invite
   - [x] 5.2 Verify Owners can invite any role
   - [x] 5.3 Verify Managers cannot invite Owners
   - [x] 5.4 Verify Viewers cannot access team settings

- [ ] **Task 6: Testing** (AC: All)
  - [ ] 6.1 Create unit tests for invitation mutations
  - [ ] 6.2 Create tests for tier limit enforcement
  - [ ] 6.3 Create tests for duplicate prevention
  - [ ] 6.4 Create tests for email template rendering
  - [ ] 6.5 Create integration test for full invitation flow

## Dev Notes

### Critical Architecture Patterns

**This Story Builds on Previous Work:**

- **Story 1.3** (COMPLETE): SaaS Owner Authentication - Better Auth + tenant context working
- **Story 1.6** (COMPLETE): RBAC Permission System - Roles and permissions established
- **Story 1.7** (COMPLETE): Tier Configuration Service - Limit checking via `checkLimit`
- **Story 2.1** (COMPLETE): SaaS Owner Registration - Onboarding wizard with team step placeholder
- **Story 2.2** (COMPLETE): SaaS Owner Login - Authentication flow working
- **Story 2.3** (COMPLETE): Mock SaligPay OAuth - Onboarding wizard has steps framework

**This Story's Focus:**
- Implement team invitation system with email delivery
- Enforce tier-based team member limits
- Add team management UI to settings
- Complete onboarding wizard Step 3

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
│   ├── (auth)/
│   │   ├── settings/
│   │   │   ├── page.tsx              # EXISTING: Add Team settings link
│   │   │   └── team/
│   │   │       └── page.tsx          # NEW: Team management page
│   │   │
│   │   └── onboarding/
│   │       └── page.tsx              # EXISTING: Update Step 3 (Team)
│   │
│   └── components/
│       ├── settings/
│       │   ├── TeamInvitationForm.tsx    # NEW: Invite form component
│       │   ├── PendingInvitationsList.tsx # NEW: Pending list component
│       │   └── TeamMembersList.tsx       # NEW: Existing members component
│       │
│       └── onboarding/
│           └── OnboardingWizard.tsx  # EXISTING: Update Step 3
│
convex/
├── schema.ts                        # EXISTING: teamInvitations table exists
├── users.ts                         # EXISTING: User management functions
├── tierConfig.ts                    # EXISTING: checkLimit function
├── permissions.ts                   # EXISTING: RBAC enforcement
├── emails/
│   ├── components/
│   │   └── BaseEmail.tsx            # EXISTING: Base email component
│   └── TeamInvitation.tsx           # NEW: Invitation email template
└── teamInvitations.ts               # NEW: Invitation mutations/queries
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

**Tier Limits** (from `convex/tierConfig.ts`):
- Starter: 5 team members
- Growth: 20 team members
- Scale: Unlimited (-1)

### Project Structure Notes

**Alignment with Unified Project Structure:**

- Follows patterns from Stories 2.1, 2.2, 2.3
- Uses existing `convex/schema.ts` with teamInvitations table
- Uses existing `convex/tierConfig.ts` for limit checking
- Uses existing `convex/permissions.ts` for RBAC
- Creates new files following naming conventions:
  - Components: PascalCase (e.g., `TeamInvitationForm.tsx`)
  - Convex files: camelCase (e.g., `teamInvitations.ts`)

**Existing Components to Leverage:**

- `convex/tierConfig.ts` - `checkLimit` function for resource limits
- `convex/permissions.ts` - `hasPermission` for RBAC checks
- `convex/emails/components/BaseEmail.tsx` - Base email template
- `src/components/onboarding/OnboardingWizard.tsx` - Onboarding wizard
- `src/components/ui/` - Form inputs, buttons, dialogs (Radix/shadcn)

### Architecture Compliance

**Tier Enforcement (from architecture.md):**

- Use `checkLimit` service from `tierConfig.ts` for all limit checks
- Resource type: `RESOURCE_TYPES.TEAM_MEMBERS`
- Show upgrade prompt at 95% threshold
- Hard block at 100% limit

**Email System (from architecture.md):**

- Use `@convex-dev/resend` Convex component
- Templates in `convex/emails/` using `@react-email/components`
- Store email records in `emails` table
- Support tenant branding in emails

**RBAC Requirements (from architecture.md):**

- Only Owner and Manager roles can invite team members
- Owners can invite any role (Owner, Manager, Viewer)
- Managers cannot invite Owners
- Viewers cannot access team settings
- Use `hasPermission` from `permissions.ts`

**Multi-tenant Isolation (from architecture.md):**

- All queries filtered by `tenantId`
- Use `getTenantId` or `requireTenantId` from `tenantContext.ts`
- Validate user belongs to tenant before operations

### Implementation Details

**Token Generation:**
```typescript
// Generate secure random token
const token = crypto.randomUUID(); // or similar secure method
const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
```

**Tier Limit Check:**
```typescript
import { checkLimit, RESOURCE_TYPES } from "./tierConfig";

const limitCheck = await checkLimit(ctx, {
  tenantId,
  resourceType: RESOURCE_TYPES.TEAM_MEMBERS,
});

if (limitCheck.status === "blocked") {
  throw new Error("Team member limit reached. Please upgrade your plan.");
}
```

**Email Template Structure:**
```typescript
// convex/emails/TeamInvitation.tsx
interface TeamInvitationEmailProps {
  inviteeEmail: string;
  inviterName: string;
  tenantName: string;
  role: string;
  invitationLink: string;
  logoUrl?: string;
  primaryColor?: string;
}
```

**RBAC Check Pattern:**
```typescript
import { hasPermission } from "./permissions";

// Check if user can invite
if (!hasPermission(user.role as Role, "users:create")) {
  throw new Error("You don't have permission to invite team members");
}

// Managers can't invite Owners
if (inviterRole === "manager" && invitedRole === "owner") {
  throw new Error("Managers cannot invite Owners");
}
```

### Previous Story Intelligence

**From Story 2.1 (SaaS Owner Registration):**

- Onboarding wizard has Step 3 placeholder for "Invite Team"
- Wizard supports skip functionality
- Steps can be marked complete

**From Story 2.3 (Mock SaligPay OAuth):**

- Onboarding wizard integration pattern established
- Use existing wizard state management
- Mark step complete after successful action

**From Story 1.7 (Tier Configuration):**

- `checkLimit` function returns status: "ok" | "warning" | "critical" | "blocked"
- Resource type constants in `RESOURCE_TYPES`
- Upgrade prompt shown at 95% threshold

**Learnings to Apply:**

- Use existing permission system - don't reinvent
- Leverage existing email infrastructure
- Follow onboarding wizard patterns from previous stories
- Use type-safe validators on all Convex functions
- Always include tenant context

### Anti-Patterns to Avoid

❌ **DO NOT** skip RBAC checks - always verify permissions
❌ **DO NOT** hardcode tier limits - use `tierConfig.ts`
❌ **DO NOT** send emails without tracking in `emails` table
❌ **DO NOT** use simple incrementing tokens - use cryptographically secure tokens
❌ **DO NOT** skip audit logging for security events
❌ **DO NOT** allow cross-tenant data access
❌ **DO NOT** forget to handle email sending failures
❌ **DO NOT** store invitation tokens in plain text (store hashed if needed for verification)

### Testing Requirements

**Testing Framework:** Vitest (already set up in project)

**Required Tests:**

1. **Unit Tests for Mutations:**
   - Invitation creation with valid data
   - Token generation and expiration
   - Duplicate invitation prevention
   - Existing user prevention
   - Tier limit enforcement

2. **Integration Tests:**
   - Full invitation flow (create → email → list)
   - RBAC permission checks
   - Tier limit blocking
   - Audit log creation

3. **Email Tests:**
   - Template rendering with branding
   - Link generation with correct token
   - Email tracking record creation

4. **UI Tests:**
   - Form validation
   - List rendering
   - Cancel action confirmation
   - Upgrade prompt display

### Dependencies on Other Stories

This story **DEPENDS ON** these completed stories:

- **Story 1.3** (COMPLETE): SaaS Owner Authentication - Auth infrastructure
- **Story 1.6** (COMPLETE): RBAC Permission System - Permission checking
- **Story 1.7** (COMPLETE): Tier Configuration Service - Limit enforcement
- **Story 2.1** (COMPLETE): SaaS Owner Registration - Onboarding wizard
- **Story 2.3** (COMPLETE): Mock SaligPay OAuth - Onboarding patterns

This story **ENABLES** these future stories:

- **Story 2.5**: Team Member Invitation Acceptance - Uses invitation tokens
- **Story 2.6**: Team Member Removal - Manages existing team members
- **Story 2.7**: Account Profile Settings - Settings page foundation

### UI/UX Design Reference

**Team Settings Page Layout:**

```
┌─────────────────────────────────────────┐
│ Team Management                         │
├─────────────────────────────────────────┤
│                                         │
│  [Invite Team Member]  (button)         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Pending Invitations (2)         │    │
│  │ ┌─────────────────────────────┐ │    │
│  │ │ john@example.com            │ │    │
│  │ │ Role: Manager | Expires: 5d │ │    │
│  │ │ [Cancel]                    │ │    │
│  │ └─────────────────────────────┘ │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Team Members (3/5)              │    │
│  │ ┌─────────────────────────────┐ │    │
│  │ │ Alex Chen (Owner)           │ │    │
│  │ │ alex@example.com            │ │    │
│  │ └─────────────────────────────┘ │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Upgrade to add more members]          │
│  (shown when approaching limit)         │
└─────────────────────────────────────────┘
```

**Invitation Form:**

```
┌─────────────────────────────────────────┐
│ Invite Team Member                      │
├─────────────────────────────────────────┤
│                                         │
│  Email:                                 │
│  [____________________]                 │
│                                         │
│  Role:                                  │
│  [Owner ▼]                              │
│                                         │
│  [Cancel]  [Send Invitation]            │
│                                         │
└─────────────────────────────────────────┘
```

## References

- [Source: epics.md#Story 2.4] - Full acceptance criteria and BDD scenarios
- [Source: epics.md#Epic 2] - Epic overview and goals
- [Source: epics.md#Story 1.6] - RBAC permission system foundation
- [Source: epics.md#Story 1.7] - Tier configuration patterns
- [Source: architecture.md#Authentication & Security] - RBAC requirements
- [Source: architecture.md#Project Structure & Boundaries] - Directory structure
- [Source: 2-1-saas-owner-registration.md] - Onboarding wizard patterns
- [Source: 2-3-mock-saligpay-oauth-connection.md] - Settings page patterns
- [Source: convex/schema.ts] - teamInvitations table definition
- [Source: convex/tierConfig.ts] - Limit checking implementation
- [Source: convex/permissions.ts] - RBAC implementation
- [Source: docs/rbac-permissions.md] - RBAC documentation
- [Source: docs/tier-config.md] - Tier configuration documentation

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled during implementation)

### File List

**New Files:**
- `convex/teamInvitations.ts` - Invitation mutations and queries
- `convex/emails/TeamInvitation.tsx` - Email template
- `src/app/(auth)/settings/team/page.tsx` - Team settings page
- `src/components/settings/TeamInvitationForm.tsx` - Invite form
- `src/components/settings/PendingInvitationsList.tsx` - Pending list
- `src/components/settings/TeamMembersList.tsx` - Members list

**Modified Files:**
- `src/app/(auth)/settings/page.tsx` - Add Team settings link
- `src/app/(auth)/onboarding/page.tsx` - Update Step 3
- `src/components/onboarding/OnboardingWizard.tsx` - Integrate invitation

## Story Completion Status

**Status:** review

**Completion Note:** Implementation completed for Story 2.4 (Team Member Invitation):
- ✅ Created convex/teamInvitations.ts with all mutations and queries
- ✅ Created convex/emails/TeamInvitation.tsx email template
- ✅ Created Team settings page with form, pending list, and members list
- ✅ Updated settings/page.tsx with Team link
- ✅ Updated OnboardingWizard.tsx Step 3
- ✅ Added tier limit UI (current/max display + upgrade prompt)
- ✅ Integrated TeamInvitationForm into onboarding wizard
- ✅ Added auto-mark step complete on invitation sent
- ✅ Added RBAC check to block Viewers from team settings
- ✅ Integrated actual email sending via Resend
- ⚠️ Some tasks remaining: Testing (Task 6)

**Next Steps:**
1. Run `code-review` for peer review
2. Complete remaining tasks (testing)

**Estimated Effort:** 2-3 dev sessions (backend mutations + email + UI + tests)
