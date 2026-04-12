# Story 15.3: Campaign & Mutation Audit Logging Gaps

Status: done

## Story

As a Platform Admin and SaaS Owner,
I want all campaign mutations and other currently-unlogged business mutations to write to the audit log,
so that I have a complete financial audit trail for every commission structure change, fraud signal, and content template change.

## Business Context

**This is the single largest audit coverage gap in the codebase.** The entire `convex/campaigns.ts` module — which defines the commission structure for affiliate programs — has ZERO audit logging across all 5 mutations. When a SaaS Owner creates, edits, pauses, archives, or resumes a campaign (which determines how affiliates get paid), there is no record of who did it, when, or what changed.

Additionally, several security-sensitive mutations in other modules also lack audit logging:

- **Fraud signal additions** (`addFraudSignalInternal`, `addSelfReferralFraudSignal`) — security-critical
- **Affiliate password set** (`setAffiliatePassword`) — security-sensitive
- **Organic conversions** (`createOrganicConversion`) — financial impact
- **Email template changes** (`templates.ts`) — content changes with user-facing impact
- **Admin notes** (`addTenantAdminNote`) — admin accountability

### Dependencies

- **Story 15.1** (should land first) — so new action types are registered in the constants

### Related Stories

- Story 15.1: Fix Audit Action Type Registry
- Story 7.8: Commission Audit Log (established the audit pattern)

## Acceptance Criteria

### AC1: Campaign Creation Logged
**Given** a SaaS Owner creates a new campaign
**When** the `createCampaign` mutation executes
**Then** an audit log entry is created with action `CAMPAIGN_CREATED`
**And** the entry includes `metadata: { name, commissionType, commissionValue, recurringCommission, landingPageUrl }`

### AC2: Campaign Update Logged
**Given** a SaaS Owner edits a campaign
**When** the `updateCampaign` mutation executes
**Then** an audit log entry is created with action `CAMPAIGN_UPDATED`
**And** the entry includes `previousValue` (fields before change) and `newValue` (fields after change)
**And** commission structure changes (commissionType, commissionValue, recurringCommission) are specifically captured

### AC3: Campaign Archive Logged
**Given** a SaaS Owner archives a campaign
**When** the `archiveCampaign` mutation executes
**Then** an audit log entry is created with action `CAMPAIGN_ARCHIVED`
**And** the entry includes `metadata: { campaignName, previousStatus }`

### AC4: Campaign Pause Logged
**Given** a SaaS Owner pauses a campaign
**When** the `pauseCampaign` mutation executes
**Then** an audit log entry is created with action `CAMPAIGN_PAUSED`
**And** the entry includes `metadata: { campaignName }`

### AC5: Campaign Resume Logged
**Given** a SaaS Owner resumes a paused campaign
**When** the `resumeCampaign` mutation executes
**Then** an audit log entry is created with action `CAMPAIGN_RESUMED`
**And** the entry includes `metadata: { campaignName }`

### AC6: Affiliate Password Set Logged
**Given** a newly approved affiliate has their password set
**When** the `setAffiliatePassword` mutation executes in `convex/affiliates.ts`
**Then** an audit log entry is created with action `AFFILIATE_PASSWORD_SET`
**And** the entry does NOT include the password value (security)

### AC7: Fraud Signal Addition Logged
**Given** a fraud signal is added to an affiliate
**When** either `addFraudSignalInternal` (affiliates.ts) or `addSelfReferralFraudSignal` (fraudDetection.ts) executes
**Then** an audit log entry is created with action `FRAUD_SIGNAL_ADDED`
**And** the entry includes `metadata: { signalType, affiliateId, commissionId? }`

### AC8: Organic Conversion Logged
**Given** an organic conversion (no affiliate attribution) is created
**When** the `createOrganicConversion` mutation executes
**Then** an audit log entry is created with action `ORGANIC_CONVERSION_CREATED`
**And** the entry includes `metadata: { amount, customerEmail }`

### AC9: Email Template Changes Logged
**Given** a SaaS Owner saves or deletes an email template
**When** the template save/delete operation executes in `convex/templates.ts`
**Then** an audit log entry is created with action `EMAIL_TEMPLATE_SAVED` or `EMAIL_TEMPLATE_DELETED`
**And** the entry includes `metadata: { templateName, templateType }`

### AC10: Admin Note Logged
**Given** a Platform Admin adds a note to a tenant
**When** the `addTenantAdminNote` mutation executes
**Then** an audit log entry is created with action `ADMIN_NOTE_ADDED`
**And** the entry includes `metadata: { noteContent (truncated), tenantId }`

### AC11: All New Action Types Registered
**Given** Story 15.1 is complete
**When** the action type registry is checked
**Then** all new action types from this story are in `AUDIT_ACTION_LABELS`

## Tasks / Subtasks

- [ ] Task 1 (AC: #1-#5): Add audit logging to all campaign mutations
  - [ ] Subtask 1.1: Add `CAMPAIGN_CREATED` audit log to `createCampaign` in `convex/campaigns.ts:86`
  - [ ] Subtask 1.2: Add `CAMPAIGN_UPDATED` audit log to `updateCampaign` in `convex/campaigns.ts:456` with previous/new value diff
  - [ ] Subtask 1.3: Add `CAMPAIGN_ARCHIVED` audit log to `archiveCampaign` in `convex/campaigns.ts:575`
  - [ ] Subtask 1.4: Add `CAMPAIGN_PAUSED` audit log to `pauseCampaign` in `convex/campaigns.ts:626`
  - [ ] Subtask 1.5: Add `CAMPAIGN_RESUMED` audit log to `resumeCampaign` in `convex/campaigns.ts:681`
  - [ ] Subtask 1.6: Import `internal` from `_generated/api` and use `ctx.runMutation(internal.audit.logAuditEventInternal, ...)`
  - [ ] Subtask 1.7: Add `CAMPAIGN_AUDIT_ACTIONS` constant to `src/lib/audit-constants.ts` and labels to `AUDIT_ACTION_LABELS`

- [ ] Task 2 (AC: #6, #7): Add audit logging to security-sensitive mutations
  - [ ] Subtask 2.1: Add `AFFILIATE_PASSWORD_SET` to `setAffiliatePassword` in `convex/affiliates.ts:1458`
  - [ ] Subtask 2.2: Add `FRAUD_SIGNAL_ADDED` to `addFraudSignalInternal` in `convex/affiliates.ts:3063`
  - [ ] Subtask 2.3: Add `FRAUD_SIGNAL_ADDED` to `addSelfReferralFraudSignal` in `convex/fraudDetection.ts:172`
  - [ ] Subtask 2.4: Register new action types in constants

- [ ] Task 3 (AC: #8-#10): Add audit logging to remaining gaps
  - [ ] Subtask 3.1: Add `ORGANIC_CONVERSION_CREATED` to `createOrganicConversion` in `convex/conversions.ts:424`
  - [ ] Subtask 3.2: Add `EMAIL_TEMPLATE_SAVED` / `EMAIL_TEMPLATE_DELETED` to template save/delete operations in `convex/templates.ts`
  - [ ] Subtask 3.3: Add `ADMIN_NOTE_ADDED` to `addTenantAdminNote` in `convex/admin/tenants.ts:1300`
  - [ ] Subtask 3.4: Register all new action types in constants

## Dev Notes

### Files to Modify

| File | Line | Mutation | New Action |
|------|------|----------|-----------|
| `convex/campaigns.ts` | 86 | `createCampaign` | `CAMPAIGN_CREATED` |
| `convex/campaigns.ts` | 456 | `updateCampaign` | `CAMPAIGN_UPDATED` |
| `convex/campaigns.ts` | 575 | `archiveCampaign` | `CAMPAIGN_ARCHIVED` |
| `convex/campaigns.ts` | 626 | `pauseCampaign` | `CAMPAIGN_PAUSED` |
| `convex/campaigns.ts` | 681 | `resumeCampaign` | `CAMPAIGN_RESUMED` |
| `convex/affiliates.ts` | 1458 | `setAffiliatePassword` | `AFFILIATE_PASSWORD_SET` |
| `convex/affiliates.ts` | 3063 | `addFraudSignalInternal` | `FRAUD_SIGNAL_ADDED` |
| `convex/fraudDetection.ts` | 172 | `addSelfReferralFraudSignal` | `FRAUD_SIGNAL_ADDED` |
| `convex/conversions.ts` | 424 | `createOrganicConversion` | `ORGANIC_CONVERSION_CREATED` |
| `convex/templates.ts` | ~582, ~875 | template save/delete | `EMAIL_TEMPLATE_SAVED` / `EMAIL_TEMPLATE_DELETED` |
| `convex/admin/tenants.ts` | 1300 | `addTenantAdminNote` | `ADMIN_NOTE_ADDED` |
| `src/lib/audit-constants.ts` | — | — | Add action types + labels |

### Audit Logging Pattern

Follow the established pattern from `convex/commissions.ts` and `convex/payouts.ts`:

```typescript
import { internal } from "./_generated/api";

// In mutation handler, after successful data change:
await ctx.runMutation(internal.audit.logAuditEventInternal, {
  tenantId: user.tenantId,
  action: "CAMPAIGN_CREATED",
  entityType: "campaign",
  entityId: campaignId,
  actorId: user.userId,
  actorType: "user",
  newValue: { name, commissionType, commissionValue },
  metadata: { landingPageUrl },
});
```

### Campaign Update Diff Pattern

For `CAMPAIGN_UPDATED`, capture what changed:

```typescript
// Before patching:
const existing = await ctx.db.get(args.campaignId);
const previousValues = {
  name: existing.name,
  commissionType: existing.commissionType,
  commissionValue: existing.commissionValue,
  // ...only fields that are being updated
};

// After patching:
await ctx.runMutation(internal.audit.logAuditEventInternal, {
  tenantId: user.tenantId,
  action: "CAMPAIGN_UPDATED",
  entityType: "campaign",
  entityId: args.campaignId,
  actorId: user.userId,
  actorType: "user",
  previousValue: previousValues,
  newValue: args, // the update payload
});
```

### Anti-Patterns to Avoid

1. **Do NOT log passwords or sensitive credentials** in metadata
2. **Do NOT log full note content** in metadata — truncate to first 100 chars for `ADMIN_NOTE_ADDED`
3. **Do NOT create a new audit module** — use existing `logAuditEventInternal` from `convex/audit.ts`
4. **Do NOT break existing campaign mutation behavior** — audit logging is additive only
5. **Do NOT use `ctx.db.insert("auditLogs", ...)` directly** — always use `ctx.runMutation(internal.audit.logAuditEventInternal, ...)`

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

No significant debugging issues encountered. All LSP errors after edits were pre-existing (conversions.ts pagination types).

### Completion Notes List

1. **Task 1 Complete**: Added audit logging to all 5 campaign mutations in `convex/campaigns.ts`
2. **Task 2 Complete**: Added audit logging to security-sensitive mutations (setAffiliatePassword, addFraudSignalInternal, addSelfReferralFraudSignal)
3. **Task 3 Complete**: Added audit logging to remaining gaps (createOrganicConversion, template save/delete, admin note)
4. All audit calls use non-blocking try/catch pattern

### File List

| File | Changes |
|------|---------|
| `convex/campaigns.ts` | Added audit logging to createCampaign, updateCampaign, archiveCampaign, pauseCampaign, resumeCampaign |
| `convex/affiliates.ts` | Added audit logging to setAffiliatePassword, addFraudSignalInternal |
| `convex/fraudDetection.ts` | Added audit logging to addSelfReferralFraudSignal, added internal import |
| `convex/conversions.ts` | Refactored organic conversion audit from raw insert to centralized logAuditEventInternal |
| `convex/templates.ts` | Added audit logging to upsertMyEmailTemplate, resetMyEmailTemplate, added internal import |
| `convex/admin/tenants.ts` | Added audit logging to addTenantAdminNote, added internal import |
