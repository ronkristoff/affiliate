# Story 10.5: Broadcast Email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SaaS Owner or Manager**,
I want to compose and send a broadcast email to all active affiliates,
so that I can communicate program updates or promotions. (FR55)

## Acceptance Criteria

### AC1: Broadcast Email UI
**Given** the user is on the Emails > Broadcast page
**When** they compose a subject and body
**Then** a preview is shown with tenant branding applied
**And** recipient count is displayed (number of active affiliates)
**And** validation ensures subject and body are not empty

### AC2: Broadcast Email Sending
**Given** the user sends the broadcast
**When** the action is confirmed
**Then** the email is sent to all active affiliates via Resend
**And** a broadcast log entry is created with subject, recipient count, and timestamp
**And** the user is notified of completion with success message
**And** each individual email is tracked in the `emails` table

### AC3: Broadcast Email Log
**Given** a broadcast has been sent
**When** viewing the broadcast history
**Then** the broadcast appears in the log with subject, sent date, recipient count
**And** the status shows "sent" or "partial" if some failed
**And** clicking the entry shows the full email content

### AC4: Error Handling
**Given** some emails fail to send
**When** the broadcast is processing
**Then** failed emails are retried with exponential backoff
**And** failures are logged but do not stop the broadcast
**And** the user is notified of partial completion with failure count

## Tasks / Subtasks

- [x] Task 1: Create Broadcast Email Schema Extension (AC: #2, #3)
  - [x] Subtask 1.1: Add `broadcastEmails` table to `convex/schema.ts` with fields: tenantId, subject, body, recipientCount, sentCount, failedCount, status, sentAt, createdBy
  - [x] Subtask 1.2: Add index `by_tenant_and_sent_at` for broadcast log queries
  - [x] Subtask 1.3: Update `emails` table type field to support "broadcast" type

- [x] Task 2: Create Broadcast Email Template (AC: #1, #2)
  - [x] Subtask 2.1: Create `convex/emails/BroadcastEmail.tsx` with props: subject, body, portalName, brandLogoUrl, brandPrimaryColor, unsubscribeUrl
  - [x] Subtask 2.2: Use `BaseEmail` component for consistent branding
  - [x] Subtask 2.3: Support HTML body content (sanitized) or plain text
  - [x] Subtask 2.4: Include tenant branding (portal name, logo, colors)
  - [x] Subtask 2.5: Add footer with unsubscribe link placeholder

- [x] Task 3: Implement Backend Broadcast Functions (AC: #2, #4)
  - [x] Subtask 3.1: Create `createBroadcast` mutation in `convex/broadcasts.tsx` to record broadcast intent
  - [x] Subtask 3.2: Create `sendBroadcastEmails` internal action in `convex/broadcasts.tsx`
  - [x] Subtask 3.3: Query all active affiliates for the tenant
  - [x] Subtask 3.4: Batch email sending (max 100 at a time) with rate limiting
  - [x] Subtask 3.5: Implement retry logic with exponential backoff (5s base delay) for failed sends
  - [x] Subtask 3.6: Track each email in `emails` table with type="broadcast"
  - [x] Subtask 3.7: Update broadcast record with sentCount, failedCount, status

- [x] Task 4: Create Broadcast UI Page (AC: #1)
  - [x] Subtask 4.1: Create `src/app/(auth)/emails/broadcast/page.tsx`
  - [x] Subtask 4.2: Create form with subject input and body textarea (rich text or markdown)
  - [x] Subtask 4.3: Display recipient count (query active affiliates count)
  - [x] Subtask 4.4: Show live preview of email with tenant branding
  - [x] Subtask 4.5: Add confirmation modal before sending
  - [x] Subtask 4.6: Show sending progress/spinner during broadcast

- [x] Task 5: Create Broadcast History Page (AC: #3)
  - [x] Subtask 5.1: Create `src/app/(auth)/emails/history/page.tsx`
  - [x] Subtask 5.2: List all broadcasts with pagination
  - [x] Subtask 5.3: Show subject, sent date, recipient count, status
  - [x] Subtask 5.4: Click to view full broadcast details and content

- [x] Task 6: Write Tests (AC: #1, #2, #3, #4)
  - [x] Subtask 6.1: Unit tests for BroadcastEmail template rendering
  - [x] Subtask 6.2: Unit tests for createBroadcast mutation
  - [x] Subtask 6.3: Unit tests for sendBroadcastEmails action with retry logic
  - [x] Subtask 6.4: Integration tests for full broadcast flow
  - [x] Subtask 6.5: Test error handling for partial failures

## Dev Notes

### Architecture & Patterns

**Existing Infrastructure (from Stories 10.1-10.4):**
- Email templates are React Email components in `convex/emails/`
- Email sending via `@convex-dev/resend` component (v0.2.3)
- `BaseEmail` component provides consistent branding wrapper
- Retry logic with exponential backoff: 5s base delay, doubles each retry
- `trackEmailSent` mutation in `convex/emails.tsx` for logging

**Key Difference from Previous Email Stories:**
- **Manual trigger by SaaS Owner** (not automatic system email)
- **Bulk recipients** (all active affiliates) requiring batching
- **New table required** (`broadcastEmails`) for campaign tracking
- **UI-heavy** - requires compose form, preview, history views

**Key Files to Reference:**
- `convex/emails.tsx` - Main email sending functions and `trackEmailSent`
- `convex/emails/BaseEmail.tsx` - Base email layout with branding
- `convex/emails/WelcomeEmail.tsx` - Example template with branding props
- `convex/schema.ts` - Add `broadcastEmails` table
- `src/app/(auth)/` - Dashboard pages follow this pattern
- `convex/affiliates.ts` - Query pattern for active affiliates

### Schema Extension Required

**New Table: `broadcastEmails`**
```typescript
broadcastEmails: defineTable({
  tenantId: v.id("tenants"),
  subject: v.string(),
  body: v.string(), // HTML or markdown content
  recipientCount: v.number(), // Total intended recipients
  sentCount: v.number(), // Successfully sent
  failedCount: v.number(), // Failed after retries
  status: v.union(
    v.literal("pending"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("partial"),
    v.literal("failed")
  ),
  createdBy: v.id("users"), // SaaS Owner who sent it
  sentAt: v.optional(v.number()),
}).index("by_tenant", ["tenantId"])
  .index("by_tenant_and_sent_at", ["tenantId", "sentAt"]),
```

**Update `emails` table type field:**
- Add "broadcast" to the type union for broadcast emails

### Backend Implementation Pattern

**File: `convex/broadcasts.ts`**

```typescript
// Create broadcast record
export const createBroadcast = mutation({
  args: {
    subject: v.string(),
    body: v.string(),
  },
  returns: v.id("broadcastEmails"),
  handler: async (ctx, args) => {
    // Get current user and tenant
    // Count active affiliates
    // Create broadcast record with status "pending"
    // Return broadcastId
  },
});

// Send broadcast emails (internal action)
export const sendBroadcastEmails = internalAction({
  args: {
    broadcastId: v.id("broadcastEmails"),
    tenantId: v.id("tenants"),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Get all active affiliates for tenant
    // 2. Get tenant branding
    // 3. Update broadcast status to "sending"
    // 4. Batch send emails (max 100 at a time)
    // 5. For each affiliate:
    //    - Render BroadcastEmail template
    //    - Send via Resend
    //    - Track in emails table
    //    - Track success/failure
    // 6. Update broadcast record with counts and final status
    // 7. Schedule retries for failures with exponential backoff
  },
});
```

### Frontend Implementation Pattern

**File: `src/app/(auth)/emails/broadcast/page.tsx`**

Key components needed:
- Form with subject input (max 200 chars)
- Body textarea (rich text or markdown - start with plain text)
- Live preview panel showing email with tenant branding
- Recipient count display (query `api.affiliates.getActiveAffiliatesCount`)
- Send button with confirmation modal
- Loading state during send

**File: `src/app/(auth)/emails/history/page.tsx`**

Key components needed:
- Table/list of broadcasts
- Columns: Subject, Sent Date, Recipients, Status
- Pagination
- Detail view showing full content

### Resend Integration

**Bulk Sending Strategy:**
- Resend supports bulk sending via multiple API calls
- Batch size: 100 emails at a time (rate limiting consideration)
- Use `Promise.allSettled()` for parallel sends within batch
- Track individual success/failure per email

**Rate Limiting:**
- Resend free tier: 100 emails/day
- Resend paid tier: 50,000 emails/month + burst
- Add delay between batches if needed (100ms)

### Integration Points

**Trigger Point:**
- User clicks "Send Broadcast" button on broadcast page
- Frontend calls `createBroadcast` mutation
- On success, calls `sendBroadcastEmails` action (or schedule it)

**Data Dependencies:**
```typescript
// Active affiliates query
const activeAffiliates = await ctx.db
  .query("affiliates")
  .withIndex("by_tenant_and_status", q => 
    q.eq("tenantId", args.tenantId).eq("status", "active")
  )
  .collect();

// Tenant branding
const tenant = await ctx.db.get(args.tenantId);
const branding = tenant?.branding;
```

### Email Template Props

```typescript
interface BroadcastEmailProps {
  // Content
  subject: string;
  body: string; // Can contain HTML (sanitized)
  
  // Branding
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  
  // Links
  unsubscribeUrl?: string;
}
```

### Testing Requirements

**Backend Tests:**
- Test `createBroadcast` creates record with correct counts
- Test `sendBroadcastEmails` sends to all active affiliates
- Test retry logic for failed sends
- Test batching behavior (100 at a time)
- Test status updates (pending → sending → sent/partial)

**Frontend Tests:**
- Test form validation (empty subject/body)
- Test preview updates with tenant branding
- Test recipient count display
- Test confirmation modal

### Project Structure Notes

**Files to Create:**
1. `convex/broadcasts.ts` - Backend functions
2. `convex/emails/BroadcastEmail.tsx` - Email template
3. `src/app/(auth)/emails/broadcast/page.tsx` - Compose page
4. `src/app/(auth)/emails/history/page.tsx` - History page
5. `src/app/(auth)/emails/layout.tsx` - Shared layout with navigation

**Files to Modify:**
1. `convex/schema.ts` - Add `broadcastEmails` table
2. `convex/emails.tsx` - May need to export helper functions
3. `src/components/ui/` - Add any new UI components if needed

**Navigation:**
- Add "Emails" section to dashboard sidebar
- Sub-items: "Broadcast", "History"
- Location: Under main dashboard navigation

### Previous Story Intelligence (10.1-10.4)

**Learnings to Apply:**
1. ✅ Use `internalAction` decorator for Resend sending
2. ✅ Implement retry with exponential backoff (5s base, doubles each retry)
3. ✅ Use `trackEmailSent` for logging individual emails
4. ✅ Remove `console.log` statements in production code
5. ✅ Support tenant branding in all emails via BaseEmail
6. ✅ Use scheduler-based retries (non-blocking): `ctx.scheduler.runAfter(delay, ...)`
7. ✅ Return proper typed objects without `: any` annotations
8. ✅ Use `getFromAddress()` helper for sender address
9. ✅ Handle missing optional fields gracefully

**Code Review Fixes from Previous Stories:**
- Use scheduler-based retries (non-blocking)
- No `as any` type casts
- Comprehensive test coverage
- Include SLA tracking if applicable
- Add text link below button for email accessibility

### Git Intelligence (Recent Work Patterns)

**Recent commits:**
- `e8ed9b5` - Affiliate portal MVP implementation
- `e62c6fb` - Commission Processing & Audit System
- `c4c48bd` - Affiliate marketing tracking system

**Code patterns established:**
- All emails use `@react-email/components`
- Consistent use of BaseEmail component wrapper
- Tenant branding passed through to all email templates
- Error handling with fallbacks for missing data
- Internal actions for async operations

### References

- [Source: _bmad-output/planning-artifacts/prd.md#MVP Scope] Broadcast email (FR55)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.5] Broadcast Email requirements
- [Source: _bmad-output/planning-artifacts/architecture.md#Email Sending] Resend Convex Component
- [Source: convex/schema.ts:387-397] Existing emails table structure
- [Source: convex/emails.tsx] Email sending patterns and retry logic
- [Source: convex/emails/BaseEmail.tsx] Base email layout with branding
- [Source: AGENTS.md#Email Rules] Use Resend via @convex-dev/resend
- [Source: _bmad-output/project-context.md] Technology stack versions

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

### Completion Notes List

- All 6 tasks completed successfully
- Schema extended with `broadcastEmails` table including `by_tenant` and `by_tenant_and_sent_at` indexes
- `emails` table type field already supports "broadcast" type (v.string())
- BroadcastEmail template created using BaseEmail component with HTML/plain text detection
- Backend broadcasts module implemented with createBroadcast mutation, sendBroadcastEmails internalAction, and supporting internal queries/mutations
- Broadcast email sending uses batch processing (100 per batch), rate limiting (100ms between batches), and retry with exponential backoff (5s base, max 3 retries)
- Each individual email is tracked in `emails` table with type="broadcast"
- Broadcast UI compose page created with subject/body form, live preview, recipient count, and confirmation modal
- Broadcast history page created with pagination and detail view dialog
- Emails section added to sidebar navigation
- 27 unit tests pass covering template rendering, HTML detection, status logic, batch processing, and retry logic
- Convex deployment successful

### File List

**Files Created:**
1. `convex/broadcasts.tsx` - Broadcast backend functions (queries, mutations, internal actions)
2. `convex/emails/BroadcastEmail.tsx` - Broadcast email template component
3. `src/app/(auth)/emails/broadcast/page.tsx` - Broadcast compose page
4. `src/app/(auth)/emails/history/page.tsx` - Broadcast history page
5. `src/app/(auth)/emails/layout.tsx` - Emails section layout with sub-navigation
6. `src/app/(auth)/emails/page.tsx` - Redirect to /emails/broadcast
7. `convex/broadcasts.test.tsx` - Unit tests (27 tests)

**Files Modified:**
1. `convex/schema.ts` - Added broadcastEmails table with indexes
2. `src/components/shared/SidebarNav.tsx` - Added Emails navigation item with Mail icon
3. `convex/tsconfig.json` - Excluded test files from Convex type checking
4. `vitest.config.ts` - Added .tsx pattern for Convex test includes

**New Dependencies:**
- None (using existing @convex-dev/resend and @react-email/components)

### Change Log

- 2026-03-17: Story 10.5 implementation complete - all tasks done, 27 tests passing
- 2026-03-17: **[AI Code Review]** Adversarial review completed. 3 HIGH + 4 MEDIUM issues found and fixed:
  - [HIGH] Added `*.test.tsx` to `convex/tsconfig.json` exclude pattern
  - [HIGH] Replaced `v.any()` with proper return validator in `listBroadcasts` query
  - [HIGH] Added `unsubscribeUrl` generation and passing to BroadcastEmail component
  - [MEDIUM] Added backend validation for subject (max 200 chars) and body (max 50000 chars)
  - [MEDIUM] Replaced blocking `setTimeout` retry with non-blocking `ctx.scheduler.runAfter()` pattern via new `retryFailedBroadcastEmail` internal action
  - [MEDIUM] Added rate limiting (1 broadcast per 5 min per tenant) to `createBroadcast` mutation
  - [LOW] Fixed toast message to accurately reflect queued delivery status
