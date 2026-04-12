# Story 15.6: Login Attempts & Email Chain Integration

Status: ready-for-dev

## Story

As a Platform Admin,
I want login attempt history and email delivery status to appear inline in the User Timeline,
so that I don't have to manually check 3 separate tables when debugging "user can't login" or "user didn't receive email."

## Business Context

**This story completes the "single pane of glass" vision for support debugging.** Even after Stories 15.1-15.5, two critical data sources remain separate from the unified audit log:

1. **`loginAttempts` table** — stores failed login attempts with IP, attempt count, and lockout status. Currently only visible via direct database queries, with NO admin UI.
2. **`emails` table** — stores every email send with delivery status (sent, delivered, opened, bounced, complained). Separate from `auditLogs` and not visible in the User Timeline.

When a tenant reports "user can't login," the admin needs to see:
- ✅ Login failures (from `loginAttempts`)
- ✅ Account lockout status (from `loginAttempts.lockedUntil`)
- ✅ OTP email sent (from `emails` table)
- ✅ Email delivery status (from `emails.deliveryStatus`)
- ✅ Email bounce reason (from `emails` + `rawWebhooks`)

**Story 15.2** already bridges auth events into `auditLogs`. This story goes further by merging the `loginAttempts` and `emails` data inline into the User Timeline, so the admin sees everything in one chronological view.

### Dependencies

- **Story 15.5** (User Timeline page must exist)

### Related Stories

- Story 15.2: Bridge Better Auth Events (auth events already in auditLogs)
- Story 15.5: Platform Admin User Timeline Page (timeline UI to integrate into)

## Acceptance Criteria

### AC1: Login Attempts Inline in Timeline
**Given** the User Timeline is displayed for a user
**When** the user has failed login attempts in the `loginAttempts` table
**Then** those login attempts appear as timeline entries, chronologically merged with audit log events
**And** each entry shows: IP address, attempt number, lockout status
**And** entries are visually consistent with other timeline events (same row format)

### AC2: Account Lockout Clearly Indicated
**Given** a user has been locked out (5 failed attempts)
**When** the timeline displays the lockout event
**Then** a clear lock icon and remaining lockout time are shown
**And** the event is color-coded red (severity: failure)

### AC3: Login Attempt Metadata Expandable
**Given** a login attempt entry is shown
**When** the admin clicks to expand
**Then** full metadata is displayed: IP, attempt count, lockedUntil timestamp, userAgent (if available)

### AC4: Email Events Inline in Timeline
**Given** the User Timeline is displayed for a user
**When** the user has email events in the `emails` table
**Then** those email events appear as timeline entries, chronologically merged
**And** each entry shows: email type (OTP, verification, password reset, etc.), provider, delivery status badge

### AC5: Email Delivery Chain Visualized
**Given** an email was sent and delivery events exist
**When** the timeline displays email events
**Then** the delivery chain is clear: Sent → Delivered (✅) or Sent → Bounced (❌)
**And** bounced emails show the bounce reason and provider diagnostic

### AC6: OTP/Auth Emails Specifically Highlighted
**Given** an OTP or password reset email was sent
**When** the timeline displays the email event
**Then** the entry uses the 🔐 Auth category icon (not generic email icon)
**And** it's grouped under the "Auth" filter tab, not just "Email"

### AC7: Performance — No N+1 Queries
**Given** the timeline loads for a user with many login attempts and emails
**When** the page renders
**Then** login attempts and emails are fetched in parallel (not sequentially)
**And** results are capped (e.g., max 50 login attempts, max 50 emails) to prevent large payloads
**And** timeline rendering does not trigger additional per-item queries

## Tasks / Subtasks

- [ ] Task 1 (AC: #1, #2, #3): Create login attempts query for admin timeline
  - [ ] Subtask 1.1: Add `getUserLoginAttempts` admin query in `convex/admin/audit.ts`
  - [ ] Subtask 1.2: Args: `{ email: v.string(), limit?: v.number() }` — look up user by email, then query `loginAttempts`
  - [ ] Subtask 1.3: Use `loginAttempts` table index (by_email or equivalent) to fetch recent attempts
  - [ ] Subtask 1.4: Return capped results (max 50) ordered by `_creationTime` desc
  - [ ] Subtask 1.5: Include lockout status and remaining lockout time

- [ ] Task 2 (AC: #4, #5, #6): Create email events query for admin timeline
  - [ ] Subtask 2.1: Add `getUserEmailEvents` admin query in `convex/admin/audit.ts`
  - [ ] Subtask 2.2: Args: `{ email: v.string(), limit?: v.number() }` — look up emails by recipient
  - [ ] Subtask 2.3: Use `emails` table to fetch recent email sends for the user
  - [ ] Subtask 2.4: Include delivery status, bounce reason, provider info
  - [ ] Subtask 2.5: Map email `type` field to category (OTP → "auth", verification → "auth", etc.)
  - [ ] Subtask 2.6: Return capped results (max 50) ordered by `_creationTime` desc

- [ ] Task 3 (AC: #1, #4, #7): Integrate into User Timeline page
  - [ ] Subtask 3.1: In `UserTimelineClient.tsx`, add parallel queries: `getUserTimeline` + `getUserLoginAttempts` + `getUserEmailEvents`
  - [ ] Subtask 3.2: Merge all three result sets into a single chronological array (sort by `_creationTime` desc)
  - [ ] Subtask 3.3: Create `TimelineLoginAttemptEvent.tsx` component for login attempt rows
  - [ ] Subtask 3.4: Create `TimelineEmailEvent.tsx` component for email event rows
  - [ ] Subtask 3.5: Include login/email events in category filter logic (login → "Auth" or "Security", email → type-based category)

## Dev Notes

### Data Merge Strategy

The three data sources have different shapes. The merge normalizes them into a common timeline entry format:

```typescript
type TimelineEntry = 
  | { source: "audit"; entry: Doc<"auditLogs"> }
  | { source: "loginAttempt"; entry: Doc<"loginAttempts"> }
  | { source: "email"; entry: Doc<"emails"> };
```

Client-side merge:
```typescript
const allEntries = [
  ...auditLogs.map(e => ({ source: "audit" as const, entry: e, timestamp: e._creationTime })),
  ...loginAttempts.map(e => ({ source: "loginAttempt" as const, entry: e, timestamp: e._creationTime })),
  ...emails.map(e => ({ source: "email" as const, entry: e, timestamp: e._creationTime })),
].sort((a, b) => b.timestamp - a.timestamp);
```

### loginAttempts Table Schema Reference

Check `convex/schema.ts` for the `loginAttempts` table definition. It stores:
- `email` — user email
- `ip` — IP address
- `attemptCount` — cumulative failed attempts
- `lockedUntil` — lockout expiry timestamp (if locked)

### emails Table Schema Reference

Check `convex/schema.ts` for the `emails` table definition. Key fields:
- `to` — recipient email
- `subject` — email subject
- `type` — email type (welcome, commission_confirmed, etc.)
- `provider` — email provider (resend, postmark)
- `status` — delivery status (sent, delivered, opened, bounced, complained)
- `bouncedAt`, `bounceReason` — bounce details

### Files to Modify

| File | Changes |
|------|---------|
| `convex/admin/audit.ts` | Add `getUserLoginAttempts`, `getUserEmailEvents` queries |
| `src/app/(admin)/user-timeline/UserTimelineClient.tsx` | Add parallel queries, merge logic, new event components |
| `src/app/(admin)/user-timeline/TimelineLoginAttemptEvent.tsx` | NEW — login attempt row component |
| `src/app/(admin)/user-timeline/TimelineEmailEvent.tsx` | NEW — email event row component |

### Anti-Patterns to Avoid

1. **Do NOT query unbounded** — always cap login attempts and emails (max 50 each)
2. **Do NOT create a backend merge query** — merge client-side for flexibility and to avoid cross-table transaction overhead
3. **Do NOT show email content/body** — only metadata (subject, type, status, timestamps)
4. **Do NOT show OTP codes or password reset tokens** — security sensitive
5. **Do NOT add new indexes** unless the `loginAttempts` or `emails` tables lack an efficient email-based lookup index

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Changes |
|------|---------|
