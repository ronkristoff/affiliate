# Story 10.2: Commission Confirmed Email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **platform system**,
I want to send a transactional commission confirmed email to an affiliate,
so that affiliates know when they've earned money. (FR52)

## Acceptance Criteria

### AC1: Commission Confirmed Email Sent on Approval
**Given** a commission is approved (status changes to "approved")
**When** the approval is processed
**Then** an email is sent to the affiliate via Resend
**And** the email includes the commission amount and customer context
**And** the email uses the tenant's branding
**And** the email is sent within 5 minutes of approval

### AC2: Email Failure Handling with Retry
**Given** the email fails to send
**When** a retry attempt is made
**Then** exponential backoff is applied
**And** the failure is logged to the emails table

## Tasks / Subtasks

- [x] Task 1: Create Commission Confirmed Email Template (AC: #1)
  - [x] Subtask 1.1: Create `convex/emails/CommissionConfirmedEmail.tsx` with required props
  - [x] Subtask 1.2: Include commission amount, campaign name, conversion date in template
  - [x] Subtask 1.3: Use BaseEmail component for consistent branding
  - [x] Subtask 1.4: Add customer context (plan type, subscription info if available)

- [x] Task 2: Implement Email Sending Function (AC: #1, #2)
  - [x] Subtask 2.1: Create `sendCommissionConfirmedEmail` action in `convex/emails.tsx`
  - [x] Subtask 2.2: Implement retry logic with exponential backoff (1s, 2s, 4s, 8s)
  - [x] Subtask 2.3: Add error logging to emails table via `trackEmailSent`
  - [x] Subtask 2.4: Include tenant branding (portalName, logoUrl, primaryColor)

- [x] Task 3: Integrate with Commission Approval Flow (AC: #1)
  - [x] Subtask 3.1: Update `approveCommission` mutation to trigger email after status update
  - [x] Subtask 3.2: Use scheduler.runAfter for async email sending (non-blocking)
  - [x] Subtask 3.3: Pass all required data (affiliate, campaign, conversion details)
  - [x] Subtask 3.4: Handle cases where conversion/conversion metadata is missing

- [x] Task 4: Verify Email Template Props and Data Flow (AC: #1)
  - [x] Subtask 4.1: Verify all required template props are passed from mutation
  - [x] Subtask 4.2: Test with missing optional fields (customer context, subscription info)
  - [x] Subtask 4.3: Ensure timestamp formatting is correct

## Dev Notes

### Architecture & Patterns

**Existing Infrastructure (from Story 10.1):**
- Email templates are React Email components in `convex/emails/`
- Email sending via `@convex-dev/resend` component (v0.2.3)
- `BaseEmail` component provides consistent branding wrapper
- Retry logic with exponential backoff already implemented in `sendAffiliateWelcomeEmail`
- `trackEmailSent` mutation in `convex/emails.tsx` for logging

**Key Files to Reference:**
- `convex/email.tsx` - Main email sending functions (add new function here)
- `convex/emails.tsx` - Contains `trackEmailSent` mutation
- `convex/emails/BaseEmail.tsx` - Base email layout with branding
- `convex/commissions.ts` - Contains `approveCommission` mutation (integration point)
- `convex/schema.ts` - Commissions, affiliates, tenants tables structure

**Pattern to Follow (from Story 10.1):**
```typescript
// Email sending action pattern
export const sendCommissionConfirmedEmail = action({
  args: {
    tenantId: v.id("tenants"),
    commissionId: v.id("commissions"),
    affiliateId: v.id("affiliates"),
    affiliateEmail: v.string(),
    affiliateName: v.string(),
    commissionAmount: v.number(),
    campaignName: v.string(),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    // Customer context
    customerPlanType: v.optional(v.string()),
    conversionDate: v.number(),
    transactionId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    // 1. Track email attempt
    // 2. Render and send email via Resend
    // 3. Track success/failure
    // 4. Return result
  },
});
```

### Integration Points

**Trigger Point:**
- `approveCommission` mutation in `convex/commissions.ts` (line 858)
- After status is updated to "approved" (line 900-902)
- Use `ctx.scheduler.runAfter(0, internal.email.sendCommissionConfirmedEmail, {...})`

**Data Dependencies:**
```typescript
// From commissions table
interface CommissionData {
  _id: Id<"commissions">;
  tenantId: Id<"tenants">;
  affiliateId: Id<"affiliates">;
  campaignId: Id<"campaigns">;
  conversionId?: Id<"conversions">;
  amount: number;
  status: string; // "approved"
  eventMetadata?: {
    source: string;
    transactionId?: string;
    timestamp: number;
    subscriptionId?: string;
  };
  transactionId?: string;
}

// From affiliates table (needed for recipient)
interface AffiliateData {
  email: string;
  name: string;
}

// From tenants table (for branding)
interface TenantBranding {
  portalName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

// From campaigns table (for email context)
interface CampaignData {
  name: string;
}

// From conversions table (for customer context)
interface ConversionData {
  amount: number;
  metadata?: {
    planId?: string;
    subscriptionId?: string;
    products?: string[];
  };
}
```

### Email Template Props Required

```typescript
interface CommissionConfirmedEmailProps {
  // Recipient info
  affiliateName: string;
  
  // Commission details
  commissionAmount: number;
  campaignName: string;
  conversionDate: number;
  transactionId?: string;
  
  // Customer context
  customerPlanType?: string;
  
  // Branding
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  
  // Optional links
  portalEarningsUrl?: string;
  contactEmail?: string;
}
```

### Resend Integration

The project uses `@convex-dev/resend` (v0.2.3) for email delivery.

**Best Practices from Story 10.1:**
- Use `action` decorator (not mutation) for email sending that calls Resend
- Implement retry with exponential backoff: 1s, 2s, 4s, 8s delays
- Log all email attempts via `trackEmailSent` for audit trail
- Handle template rendering errors gracefully
- Include tenant branding in every email
- Use `getFromAddress("notifications")` for commission emails

### Commission Status Flow

**Important Context:**
- Commission statuses: "pending" → "approved" (manual) or "confirmed" (auto-approved)
- This story triggers on "approved" status (from manual approval flow)
- The email is "Commission Confirmed" but status in DB is "approved"

**From `approveCommission` mutation:**
```typescript
// Line 900-902 in convex/commissions.ts
await ctx.db.patch(args.commissionId, {
  status: "approved",
});

// Audit log is created at line 905-918
// EMAIL TRIGGER SHOULD GO HERE (after audit log)
```

### Project Structure Notes

**Files to Create:**
1. `convex/emails/CommissionConfirmedEmail.tsx` - New email template

**Files to Modify:**
1. `convex/email.tsx` - Add `sendCommissionConfirmedEmail` action
2. `convex/commissions.ts` - Update `approveCommission` to trigger email

**Alignment with Architecture:**
- Follows pattern in `architecture.md`: "Email Sending: Resend Convex Component via @convex-dev/resend"
- Email templates stored in `convex/emails/` (already aligned)
- Internal actions for email sending (not client-exposed)

### Previous Story Intelligence (10-1-welcome-email)

**Learnings to Apply:**
1. ✅ Use `action` decorator, not `internalMutation` for Resend sending
2. ✅ Implement retry with exponential backoff (1s, 2s, 4s, 8s delays)
3. ✅ Use `trackEmailSent` from `convex/emails.tsx` for logging
4. ✅ Remove `console.log` statements in production code
5. ✅ Return proper typed objects without `: any` annotations
6. ✅ Use `getFromAddress()` helper for sender address

**Code Review Fixes Applied (from 10-1):**
- Fixed type safety: Removed `: any` annotations
- Fixed AC compliance: Ensure all required props are displayed in email
- Fixed return types: Match returns validator exactly
- Fixed production hygiene: No console logging

### References

- [Source: _bmad-output/planning-artifacts/prd.md#MVP Scope] Automated emails - transactional (commission confirmed)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2] Commission Confirmed Email requirements (FR52)
- [Source: _bmad-output/planning-artifacts/architecture.md#Email Sending] Resend Convex Component via @convex-dev/resend
- [Source: convex/email.tsx] Email sending patterns and retry logic
- [Source: convex/commissions.ts:858] approveCommission mutation (integration point)
- [Source: convex/schema.ts] Commissions, affiliates, tenants, campaigns tables
- [Source: AGENTS.md#Email Rules] Use Resend via @convex-dev/resend, templates via @react-email/components
- [Source: _bmad-output/project-context.md] Technology stack versions and design context

## Dev Agent Record

### Agent Model Used

mimo-v2-flash-free

### Debug Log References

- Created CommissionConfirmedEmail template at `convex/emails/CommissionConfirmedEmail.tsx`
- Added `sendCommissionConfirmedEmail` internal action in `convex/emails.tsx` with retry logic
- Updated `approveCommission` mutation to trigger email via `ctx.scheduler.runAfter()`
- All Convex functions compiled successfully with `npx convex dev --once`
- Retry logic: exponential backoff with 1s, 2s, 4s, 8s delays (max 3 retries)

### Completion Notes List

- ✅ Task 1.1: Created `convex/emails/CommissionConfirmedEmail.tsx` with all required props
- ✅ Task 1.2: Template includes commission amount, campaign name, conversion date, transaction ID
- ✅ Task 1.3: Uses BaseEmail component for consistent branding with tenant logo/colors
- ✅ Task 1.4: Customer context (plan type, subscription info) included as optional fields
- ✅ Task 2.1: Created `sendCommissionConfirmedEmail` internal action in `convex/emails.tsx`
- ✅ Task 2.2: Implemented retry logic with exponential backoff (1s, 2s, 4s, 8s delays)
- ✅ Task 2.3: Error logging via `trackEmailSent` mutation for audit trail
- ✅ Task 2.4: Tenant branding (portalName, logoUrl, primaryColor) included
- ✅ Task 3.1: Updated `approveCommission` to trigger email after status update
- ✅ Task 3.2: Uses scheduler.runAfter for non-blocking async email sending
- ✅ Task 3.3: Passes affiliate, campaign, and conversion details to email
- ✅ Task 3.4: Handles missing optional fields gracefully (transactionId, customerPlanType, etc.)
- ✅ Convex functions compiled successfully

### File List

- `convex/emails/CommissionConfirmedEmail.tsx` - New email template with currency support (created)
- `convex/emails.tsx` - Added `sendCommissionConfirmedEmail` internal action with scheduler-based retry logic, SLA monitoring, and console.log cleanup (modified)
- `convex/commissions.ts` - Updated `approveCommission` to trigger email on approval with proper conversion date lookup, customer plan detection, and error handling (modified)
- `convex/email.tsx` - Import reordering and sendAffiliateWelcomeEmail retry logic from Story 10.1 (modified - documented)
- `convex/emails.test.ts` - Unit tests for email logging, commission data flow, and missing field handling (created)

### Change Log

- Created CommissionConfirmedEmail.tsx template for commission confirmation emails
- Added sendCommissionConfirmedEmail internal action with exponential backoff retry logic
- Updated approveCommission mutation to trigger email after commission approval
- Email is sent asynchronously via scheduler.runAfter() to not block the approval response
- All emails are tracked in the emails table for audit trail

**Code Review Fixes (2026-03-17):**
- Added SLA monitoring (approvalTimestamp) to track 5-minute delivery requirement (AC1)
- Implemented scheduler-based retries with 5s base delay (non-blocking, MED-8)
- Removed `as any` type cast from commissions.ts scheduler call (HIGH-3)
- Added error handling for scheduler failures with audit logging (MED-6)
- Fixed conversion date to use actual conversion._creationTime instead of eventMetadata fallback (MED-7)
- Improved customer plan type detection from conversion metadata (planId → subscriptionId → products) (MED-10)
- Made currency configurable via props (defaults to PHP) (MED-9)
- Removed console.log statements from sendFraudAlertEmail (LOW-12)
- Updated File List to include email.tsx changes from Story 10.1 (MED-5)
- Added comprehensive test coverage for missing optional fields (Subtask 4.2)
- Added tests for email logging, retry tracking, and data flow validation
