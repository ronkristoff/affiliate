# Story 10.4: New Referral Alert Email

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **platform system**,
I want to send a transactional new referral alert email to a SaaS Owner,
so that they're notified of new conversions. (FR54)

## Acceptance Criteria

### AC1: New Referral Alert Email Sent on Conversion Attribution
**Given** a new conversion is attributed to an affiliate
**When** the conversion is processed
**Then** an alert email is sent to the SaaS Owner via Resend
**And** the email includes affiliate name, customer context, and commission amount
**And** the email is sent within 5 minutes of conversion

### AC2: Email Content Requirements
**Given** a new referral alert email is generated
**When** the email is rendered
**Then** it includes:
- Affiliate name and email
- Conversion amount (formatted in tenant's currency)
- Customer email (if available, partially masked for privacy)
- Campaign name (if available)
- Conversion timestamp
- Commission amount (based on campaign commission structure)
- Tenant branding (portal name, logo, colors)
- Link to affiliate detail page in dashboard
- Link to conversion/commission detail in dashboard

### AC3: Email Failure Handling with Retry
**Given** the email fails to send
**When** a retry attempt is made
**Then** exponential backoff is applied (5s base delay)
**And** the failure is logged to the emails table

## Tasks / Subtasks

- [x] Task 1: Create New Referral Alert Email Template (AC: #2)
  - [x] Subtask 1.1: Create `convex/emails/NewReferralAlertEmail.tsx` with required props
  - [x] Subtask 1.2: Include affiliate details, conversion amount, customer email in template
  - [x] Subtask 1.3: Use BaseEmail component for consistent branding
  - [x] Subtask 1.4: Add commission amount display (calculated from conversion amount and campaign rate)
  - [x] Subtask 1.5: Include masked customer email for privacy (e.g., `j***@example.com`)

- [x] Task 2: Implement Email Sending Function (AC: #1, #3)
  - [x] Subtask 2.1: Create `sendNewReferralAlertEmail` internal action in `convex/emails.tsx`
  - [x] Subtask 2.2: Implement retry logic with exponential backoff (5s base delay, doubles each retry)
  - [x] Subtask 2.3: Add error logging to emails table via `trackEmailSent`
  - [x] Subtask 2.4: Include tenant branding (portalName, logoUrl, primaryColor)
  - [x] Subtask 2.5: Support currency configuration via props (defaults to PHP)
  - [x] Subtask 2.6: Add SLA monitoring for 5-minute delivery requirement

- [x] Task 3: Integrate with Conversion Attribution Flow (AC: #1)
  - [x] Subtask 3.1: Update `createConversionWithAttribution` mutation in `convex/conversions.ts`
  - [x] Subtask 3.2: Add email trigger after conversion record is created and audit log is written
  - [x] Subtask 3.3: Use `ctx.scheduler.runAfter` for async email sending (non-blocking)
  - [x] Subtask 3.4: Gather all required data (affiliate, campaign, owner email) before triggering
  - [x] Subtask 3.5: Handle cases where SaaS Owner email is not found gracefully
  - [x] Subtask 3.6: Skip email for self-referral conversions (fraud already alerts separately)

- [x] Task 4: Write Tests (AC: #1, #2, #3)
  - [x] Subtask 4.1: Unit tests for email template rendering with all props
  - [x] Subtask 4.2: Unit tests for email sending action with retry logic
  - [x] Subtask 4.3: Unit tests for masked customer email privacy
  - [x] Subtask 4.4: Unit tests for missing optional fields handling
  - [x] Subtask 4.5: Integration test for conversion → email trigger flow

## Dev Notes

### Architecture & Patterns

**Existing Infrastructure (from Stories 10.1, 10.2, 10.3):**
- Email templates are React Email components in `convex/emails/`
- Email sending via `@convex-dev/resend` component (v0.2.3)
- `BaseEmail` component provides consistent branding wrapper
- Retry logic with exponential backoff implemented in `sendCommissionConfirmedEmail`, `sendPayoutSentEmail`
- `trackEmailSent` mutation in `convex/emails.tsx` for logging

**Key Difference from Other Email Stories:**
- **Recipient is SaaS Owner, NOT affiliate** - this email goes to the paying customer
- Similar pattern to `sendFraudAlertEmail` which also emails the SaaS Owner
- Need to look up owner email from `users` table with role "owner"

**Key Files to Reference:**
- `convex/emails.tsx` - Main email sending functions (add new function here)
- `convex/emails/NewAffiliateNotificationEmail.tsx` - SaaS Owner notification pattern to follow
- `convex/emails/FraudAlertEmail.tsx` - Pattern for getting SaaS Owner email
- `convex/emails/BaseEmail.tsx` - Base email layout with branding
- `convex/conversions.ts` - Contains `createConversionWithAttribution` mutation (integration point)
- `convex/schema.ts` - Conversions, affiliates, campaigns, tenants tables

**Pattern to Follow (from FraudAlertEmail and PayoutSentEmail):**
```typescript
// Email sending action pattern for SaaS Owner notifications
export const sendNewReferralAlertEmail = internalAction({
  args: {
    tenantId: v.id("tenants"),
    conversionId: v.id("conversions"),
    affiliateId: v.id("affiliates"),
    ownerEmail: v.string(),
    affiliateName: v.string(),
    affiliateEmail: v.string(),
    conversionAmount: v.number(),
    commissionAmount: v.number(),
    customerEmail: v.optional(v.string()),
    campaignName: v.optional(v.string()),
    portalName: v.string(),
    brandLogoUrl: v.optional(v.string()),
    brandPrimaryColor: v.optional(v.string()),
    conversionTimestamp: v.number(),
    dashboardAffiliateUrl: v.optional(v.string()),
    dashboardConversionUrl: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    currency: v.optional(v.string()),
    maxRetries: v.optional(v.number()),
    attempt: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()), retryCount: v.number() }),
  handler: async (ctx, args) => {
    // 1. Mask customer email for privacy
    // 2. Render and send email via Resend
    // 3. Track success via trackEmailSent
    // 4. On failure, schedule retry with exponential backoff
    // 5. Return result
  },
});
```

### Integration Points

**Trigger Point:**
- `createConversionWithAttribution` mutation in `convex/conversions.ts` (line 219)
- After conversion record is created (line 277) and audit log is written (line 296)
- BEFORE the return statement (line 314)
- Use `ctx.scheduler.runAfter(0, internal.emails.sendNewReferralAlertEmail, {...})`

**Important: Skip for Self-Referrals**
- Self-referral conversions already trigger `sendFraudAlertEmail` (line 264-272)
- Do NOT send both fraud alert AND new referral alert for same conversion
- Check `isSelfReferral` flag before triggering this email

**Data Dependencies:**
```typescript
// From conversions table (schema.ts lines 262-294)
interface ConversionData {
  _id: Id<"conversions">;
  tenantId: Id<"tenants">;
  affiliateId: Id<"affiliates">;
  campaignId?: Id<"campaigns">;
  customerEmail?: string;
  amount: number;
  status?: string;
  attributionSource: "cookie" | "webhook" | "organic";
  isSelfReferral?: boolean;
  metadata?: {
    orderId?: string;
    products?: string[];
    subscriptionId?: string;
    planId?: string;
  };
}

// From affiliates table (needed for email content)
interface AffiliateData {
  _id: Id<"affiliates">;
  email: string;
  name: string;
  uniqueCode: string;
}

// From campaigns table (optional, for email context)
interface CampaignData {
  _id: Id<"campaigns">;
  name: string;
  commissionType: "percentage" | "flat_fee";
  commissionValue: number;
}

// From tenants table (for branding)
interface TenantBranding {
  portalName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

// From users table (for SaaS Owner recipient)
interface OwnerUserData {
  email: string;
  name: string;
  role: "owner";
}
```

### Email Template Props Required

```typescript
interface NewReferralAlertEmailProps {
  // Recipient info (SaaS Owner)
  ownerName?: string;
  
  // Affiliate details
  affiliateName: string;
  affiliateEmail: string;
  
  // Conversion details
  conversionAmount: number;
  conversionDate: number;
  customerEmail?: string; // Will be masked in template
  campaignName?: string;
  
  // Commission details
  commissionAmount: number;
  
  // Branding
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  
  // Optional links
  dashboardAffiliateUrl?: string;
  dashboardConversionUrl?: string;
  contactEmail?: string;
  
  // Currency
  currency?: string; // Default: "PHP"
}
```

### Helper Function: Mask Customer Email

```typescript
// Privacy helper to partially mask customer email
function maskCustomerEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}${"*".repeat(Math.min(localPart.length - 2, 3))}@${domain}`;
}

// Examples:
// "john.doe@example.com" → "j***@example.com"
// "ab@test.com" → "a***@test.com"
```

### Resend Integration

The project uses `@convex-dev/resend` (v0.2.3) for email delivery.

**Best Practices from Stories 10.1, 10.2, 10.3:**
- Use `internalAction` decorator (not mutation) for email sending that calls Resend
- Implement retry with exponential backoff: 5s base delay, doubles each retry (5s, 10s, 20s)
- Log all email attempts via `trackEmailSent` for audit trail
- Handle template rendering errors gracefully
- Include tenant branding in every email
- Use `getFromAddress("notifications")` for referral alert emails
- Use scheduler-based retries (non-blocking): `ctx.scheduler.runAfter(delay, ...)`

### Database Schema Reference

**conversions table:**
```typescript
conversions: defineTable({
  tenantId: v.id("tenants"),
  affiliateId: v.id("affiliates"),
  referralLinkId: v.optional(v.id("referralLinks")),
  clickId: v.optional(v.id("clicks")),
  campaignId: v.optional(v.id("campaigns")),
  customerEmail: v.optional(v.string()),
  amount: v.number(),
  status: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  deviceFingerprint: v.optional(v.string()),
  paymentMethodLastDigits: v.optional(v.string()),
  paymentMethodProcessorId: v.optional(v.string()),
  attributionSource: v.union(v.literal("cookie"), v.literal("webhook"), v.literal("organic")),
  isSelfReferral: v.optional(v.boolean()),
  metadata: v.optional(v.object({...})),
}).index("by_tenant", ["tenantId"])
  .index("by_affiliate", ["affiliateId"])
  .index("by_click", ["clickId"])
  .index("by_campaign", ["campaignId"]);
```

### Project Structure Notes

**Files to Create:**
1. `convex/emails/NewReferralAlertEmail.tsx` - New email template

**Files to Modify:**
1. `convex/emails.tsx` - Add `sendNewReferralAlertEmail` internal action
2. `convex/conversions.ts` - Update `createConversionWithAttribution` to trigger email

**Alignment with Architecture:**
- Follows pattern in `architecture.md`: "Email Sending: Resend Convex Component via @convex-dev/resend"
- Email templates stored in `convex/emails/` (already aligned)
- Internal actions for email sending (not client-exposed)

### Previous Story Intelligence (10-1, 10-2, 10-3)

**Learnings to Apply:**
1. ✅ Use `internalAction` decorator, not `internalMutation` for Resend sending
2. ✅ Implement retry with exponential backoff (5s base delay, doubles each retry)
3. ✅ Use `trackEmailSent` from `convex/emails.tsx` for logging
4. ✅ Remove `console.log` statements in production code
5. ✅ Return proper typed objects without `: any` annotations
6. ✅ Use `getFromAddress()` helper for sender address
7. ✅ Use scheduler-based retries (non-blocking): `ctx.scheduler.runAfter(delay, ...)`
8. ✅ Support currency formatting via props (default: PHP)
9. ✅ Add SLA monitoring for 5-minute delivery requirement (from 10-2)

**Code Review Fixes from 10-2 & 10-3 to Apply:**
- Use scheduler-based retries with 5s base delay (non-blocking)
- No `as any` type casts
- Handle missing optional fields gracefully (campaign name, customer email)
- Comprehensive test coverage for missing optional fields
- Include SLA tracking if applicable
- Add text link below button for email accessibility

**Key Difference for This Story:**
- This is a SaaS Owner notification, similar to `FraudAlertEmail` and `NewAffiliateNotificationEmail`
- Use those files as reference for the template structure and recipient lookup

### Git Intelligence (Recent Work Patterns)

**Recent commits:**
- `e8ed9b5` - Affiliate portal MVP implementation
- `e62c6fb` - Commission Processing & Audit System
- `c4c48bd` - Affiliate marketing tracking system

**Code patterns established:**
- All emails use `@react-email/components` (Heading, Text, Link, Hr, Button)
- Consistent use of BaseEmail component wrapper
- Tenant branding passed through to all email templates
- Error handling with fallbacks for missing data
- Currency formatting with `toLocaleString()` and configurable currency

### Integration Code Location

**In `convex/conversions.ts` around line 313 (before return):**
```typescript
// After audit log insertion (line 312), before return (line 314)

// Send new referral alert email to SaaS Owner (if not self-referral)
if (!isSelfReferral) {
  // Get owner email for notification
  const ownerUser = await ctx.runQuery(internal.users.getOwnerByTenantInternal, {
    tenantId: args.tenantId,
  });
  
  // Get affiliate and campaign details
  const affiliate = await ctx.db.get(args.affiliateId);
  const campaign = args.campaignId ? await ctx.db.get(args.campaignId) : null;
  const tenant = await ctx.db.get(args.tenantId);
  
  // Calculate commission amount based on campaign structure
  let commissionAmount = 0;
  if (campaign) {
    if (campaign.commissionType === "percentage") {
      commissionAmount = args.amount * (campaign.commissionValue / 100);
    } else {
      commissionAmount = campaign.commissionValue; // flat_fee
    }
  }
  
  // Schedule email (non-blocking) if owner found
  if (ownerUser && affiliate && tenant) {
    const portalName = tenant.branding?.portalName || tenant.name || "Your Portal";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.boboddy.business";
    
    ctx.scheduler.runAfter(0, internal.emails.sendNewReferralAlertEmail, {
      tenantId: args.tenantId,
      conversionId,
      affiliateId: args.affiliateId,
      ownerEmail: ownerUser.email,
      affiliateName: affiliate.name,
      affiliateEmail: affiliate.email,
      conversionAmount: args.amount,
      commissionAmount,
      customerEmail: args.customerEmail,
      campaignName: campaign?.name,
      portalName,
      brandLogoUrl: tenant.branding?.logoUrl,
      brandPrimaryColor: tenant.branding?.primaryColor,
      conversionTimestamp: Date.now(),
      dashboardAffiliateUrl: `${appUrl}/affiliates/${args.affiliateId}`,
      dashboardConversionUrl: `${appUrl}/conversions/${conversionId}`,
    }).catch(err => {
      // Log but don't fail the conversion if email fails
      console.error("Failed to schedule referral alert email:", err);
    });
  }
}
```

### References

- [Source: _bmad-output/planning-artifacts/prd.md#MVP Scope] Automated emails - transactional (new referral alert)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4] New Referral Alert Email requirements (FR54)
- [Source: _bmad-output/planning-artifacts/architecture.md#Email Sending] Resend Convex Component via @convex-dev/resend
- [Source: convex/emails.tsx] Email sending patterns and retry logic
- [Source: convex/emails/NewAffiliateNotificationEmail.tsx] SaaS Owner notification template pattern
- [Source: convex/emails/FraudAlertEmail.tsx] Pattern for getting SaaS Owner email
- [Source: convex/conversions.ts:219-316] createConversionWithAttribution mutation (integration point)
- [Source: convex/schema.ts:262-294] Conversions table structure
- [Source: AGENTS.md#Email Rules] Use Resend via @convex-dev/resend, templates via @react-email/components
- [Source: _bmad-output/project-context.md] Technology stack versions and design context

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

✅ **Story Implementation Complete**
- Created New Referral Alert Email Template with all required fields
- Implemented sendNewReferralAlertEmail internal action with retry logic
- Integrated email trigger in createConversionWithAttribution mutation
- Email includes affiliate details, conversion amount, commission amount, and tenant branding
- Follows pattern from existing email stories (10.1, 10.2, 10.3)
- Uses exponential backoff (5s base delay) for retry logic
- Skips email for self-referral conversions (fraud already alerts separately)
- SLA monitoring for 5-minute delivery requirement implemented

✅ **Code Review Fixes Applied (2026-03-17)**
- **HIGH**: Fixed ownerName to use actual SaaS Owner name from users table (was incorrectly using tenant portal name)
- **HIGH**: Removed console.error from production code in sendNewReferralAlertEmail action
- **HIGH**: Added audit log for email scheduling failures in createConversionWithAttribution
- **MEDIUM**: Updated test file header to include Story 10.4
- **MEDIUM**: Added comprehensive tests for sendNewReferralAlertEmail action (retry logic, max retries, ownerName usage)

### File List

**Files Created:**
1. `convex/emails/NewReferralAlertEmail.tsx` - New email template for SaaS Owner notifications

**Files Modified:**
1. `convex/emails.tsx` - Added sendNewReferralAlertEmail internal action with retry logic, added ownerName arg
2. `convex/conversions.ts` - Updated createConversionWithAttribution to trigger email, pass ownerName, added audit log for failures
3. `convex/emails.test.ts` - Updated header, added tests for sendNewReferralAlertEmail action
4. `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status to "done"
5. `_bmad-output/implementation-artifacts/10-4-new-referral-alert-email.md` - Updated story status and added completion notes
