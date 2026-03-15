# Story 3.1: Mock Subscription Checkout

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SaaS Owner**,
I want to complete a mock subscription checkout,
so that I can test the billing flow without real payment processing.

## Acceptance Criteria

1. **AC1: Trial Status Detection** — Given the SaaS Owner is on a free trial
   **When** they view their subscription status
   **Then** the current plan (Starter), trial end date, and upgrade options are displayed

2. **AC2: Mock Checkout Flow Initiation** — Given the SaaS Owner initiates a subscription upgrade
   **When** they select a plan (Growth or Scale)
   **Then** a mock checkout flow is initiated
   **And** mock payment details form is displayed

3. **AC3: Mock Payment Form** — Given the mock checkout is active
   **When** the payment form is displayed
   **Then** fields for mock card number, expiry, CVV are shown
   **And** "Use Mock Payment" button is available

4. **AC4: Subscription Update** — Given the mock checkout is completed
   **When** the mock payment is processed successfully
   **Then** the tenant's subscription is updated in the database
   **And** the plan field is changed from "starter" to the selected plan
   **And** the trial end date is removed (nullified)

5. **AC5: Billing Cycle Establishment** — Given the subscription is upgraded
   **When** the checkout is complete
   **Then** billing cycle dates are established (billingStartDate, billingEndDate)
   **And** the next billing date is calculated based on monthly cycle

6. **AC6: Mock Transaction Logging** — Given a mock checkout is completed
   **When** the transaction is processed
   **Then** the mock transaction is logged in the audit trail
   **And** the transaction ID follows mock pattern (e.g., "mock_sub_xxx")

## Tasks / Subtasks

- [x] **Task 1: Subscription Status Display in Settings** (AC: 1)
  - [x] 1.1 Add subscription status card to Settings > Billing page
  - [x] 1.2 Display current plan, trial end date, and upgrade CTA
  - [x] 1.3 Show plan limits and current usage
  - [x] 1.4 Connect to existing tier config queries

- [x] **Task 2: Mock Checkout UI Components** (AC: 2, 3)
  - [x] 2.1 Create MockCheckoutModal component
  - [x] 2.2 Create PlanSelectionCard component with Growth/Scale options
  - [x] 2.3 Create MockPaymentForm component
  - [x] 2.4 Add checkout flow with proper state management

- [x] **Task 3: Backend Subscription Mutation** (AC: 4, 5)
  - [x] 3.1 Create `upgradeSubscription` mutation in convex/subscriptions.ts
  - [x] 3.2 Update tenant plan field
  - [x] 3.3 Remove trial end date
  - [x] 3.4 Set billing cycle dates
  - [x] 3.5 Add tenantId scoping for multi-tenant isolation

- [x] **Task 4: Audit Logging** (AC: 6)
  - [x] 4.1 Log subscription upgrade events to auditLogs table
  - [x] 4.2 Include mock transaction ID in audit entry
  - [x] 4.3 Record previous and new plan values

- [x] **Task 5: Integration with Settings Page** (AC: 1, 2)
  - [x] 5.1 Add billing section to Settings > Billing page
  - [x] 5.2 Wire up upgrade buttons to open mock checkout
  - [x] 5.3 Display success/error feedback

- [x] **Task 6: Testing** (AC: All)
  - [x] 6.1 Test mock checkout flow end-to-end
  - [x] 6.2 Test tenant isolation (cannot upgrade other tenants)
  - [x] 6.3 Test audit logging content

## Dev Notes

### Epic Context

**Epic 3: Subscription & Billing Management**
- Goal: Enable SaaS owners to manage their salig-affiliate subscription via mock checkout
- FRs covered: FR5, FR83-FR86, FR88
- Screen: 07-owner-settings.html

**This is the first story in Epic 3**, which includes:
- Story 3.1: Mock Subscription Checkout (THIS STORY)
- Story 3.2: Trial-to-Paid Conversion
- Story 3.3: Subscription Tier Upgrade
- Story 3.4: Subscription Downgrade
- Story 3.5: Subscription Cancellation
- Story 3.6: View Subscription Status

### Technical Stack Requirements

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 16.1.0 |
| Backend | Convex | 1.32.0 |
| Authentication | Better Auth | 1.4.9 |
| Database | Convex | 1.32.0 |
| Styling | Tailwind CSS | 4.1.16 |
| UI Components | Radix UI | Latest |

### Key Files to Modify/Create

```
src/
├── app/
│   ├── (auth)/
│   │   └── settings/
│   │       └── billing/
│   │           └── page.tsx              # MODIFY: Add billing section
│   │
│   └── components/
│       └── settings/
│           ├── SubscriptionStatusCard.tsx  # NEW: Current plan display
│           ├── PlanSelectionCard.tsx      # NEW: Growth/Scale options
│           ├── MockCheckoutModal.tsx      # NEW: Checkout flow modal
│           └── MockPaymentForm.tsx        # NEW: Mock payment form
│
convex/
├── schema.ts                             # MODIFY: Add billing fields to tenants
├── subscriptions.ts                      # NEW: Subscription mutations
└── audit.ts                              # MODIFY: Add subscription audit logging
```

### Database Schema Updates

**tenants table** (existing - additions needed):
```typescript
// Add to existing tenants table
billingStartDate: v.optional(v.number()),
billingEndDate: v.optional(v.number()),
subscriptionStatus: v.optional(v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("cancelled"),
  v.literal("past_due")
)),
subscriptionId: v.optional(v.string()), // Mock or real subscription ID
```

**billingHistory table** (new):
```typescript
billingHistory: defineTable({
  tenantId: v.id("tenants"),
  event: v.string(), // "upgrade", "downgrade", "cancel", "renew"
  previousPlan: v.optional(v.string()),
  newPlan: v.string(),
  amount: v.optional(v.number()),
  transactionId: v.optional(v.string()),
  mockTransaction: v.boolean(),
  timestamp: v.number(),
  actorId: v.optional(v.id("users")),
}).index("by_tenant", ["tenantId"])
  .index("by_tenant_and_time", ["tenantId", "timestamp"]),
```

### Project Structure Notes

**Alignment with Unified Project Structure:**

- Uses existing `src/app/(auth)/settings/` structure from Story 2.7
- Follows component patterns from previous onboarding stories
- Uses Convex mutations with proper validators (new syntax)
- Follows multi-tenant isolation patterns from Story 1.5
- Uses tier config from Story 1.7

**Key Patterns from Previous Stories:**

- Modal component patterns from onboarding (Story 2.x)
- Settings page structure from Story 2.7
- Tenant context loading from Stories 1.3, 1.5
- Tier configuration from Story 1.7

### Architecture Compliance

**Subscription Flow (from epics.md):**

```
Trial → Initiate Upgrade → Select Plan → Mock Payment → Subscription Updated → Billing Cycle Set
```

**Mock Payment Processing:**

```typescript
// Mock payment validation
const mockPayment = {
  cardNumber: "4242424242424242", // Always succeeds
  expiry: "12/28",
  cvv: "123",
  cardholderName: "Test User"
};

// Mock transaction response
const mockResult = {
  success: true,
  transactionId: `mock_sub_${Date.now()}`,
  timestamp: Date.now()
};
```

**Tier Pricing (from tierConfigs table):**

| Tier | Price (PHP) | Price (USD) |
|------|-------------|-------------|
| Starter | ₱0 | $0 |
| Growth | ₱2,499 | $49 |
| Scale | ₱4,999 | $99 |

**Billing Cycle Calculation:**

```typescript
const BILLING_CYCLE_DAYS = 30;

function calculateBillingDates(): { start: number; end: number } {
  const start = Date.now();
  const end = start + (BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}
```

**Multi-Tenant Isolation (from architecture.md):**

- All subscription mutations must filter by authenticated tenantId
- Tenant context loaded via `getCurrentTenant` from ctx
- Audit logs include tenantId for filtering

### Implementation Details

**Settings Page Integration:**

```typescript
// src/app/(auth)/settings/billing/page.tsx
export default function BillingSettingsPage() {
  const tenant = useQuery(api.tenants.getCurrentTenant);
  const tierConfig = useQuery(api.tierConfig.getTierConfigForCurrentTenant);
  
  return (
    <div className="space-y-6">
      <SubscriptionStatusCard 
        plan={tenant?.plan}
        trialEndsAt={tenant?.trialEndsAt}
        subscriptionStatus={tenant?.subscriptionStatus}
      />
      
      {tenant?.plan === 'starter' && (
        <PlanSelectionCard 
          currentPlan="starter"
          onSelectPlan={handleSelectPlan}
        />
      )}
    </div>
  );
}
```

**Mock Checkout Modal Flow:**

```typescript
// MockCheckoutModal.tsx
export function MockCheckoutModal({ 
  isOpen, 
  selectedPlan, 
  onClose, 
  onSuccess 
}: MockCheckoutModalProps) {
  const [step, setStep] = useState<'payment' | 'processing' | 'success'>('payment');
  
  const handleMockPayment = async () => {
    setStep('processing');
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Call mutation
    await mutate(api.subscriptions.upgradeSubscription, {
      plan: selectedPlan,
      mockPayment: true,
    });
    
    setStep('success');
    onSuccess();
  };
  
  return (
    <Modal open={isOpen} onClose={onClose}>
      {step === 'payment' && (
        <MockPaymentForm 
          selectedPlan={selectedPlan}
          onSubmit={handleMockPayment}
        />
      )}
      {step === 'processing' && <ProcessingSpinner />}
      {step === 'success' && <SuccessMessage />}
    </Modal>
  );
}
```

**Subscription Upgrade Mutation:**

```typescript
// convex/subscriptions.ts
export const upgradeSubscription = mutation({
  args: {
    plan: v.union(v.literal("growth"), v.literal("scale")),
    mockPayment: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    transactionId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get current tenant
    const tenant = await getCurrentTenant(ctx);
    if (!tenant) {
      throw new Error("No tenant context");
    }
    
    // Validate plan is valid
    if (args.plan !== "growth" && args.plan !== "scale") {
      throw new Error("Invalid plan");
    }
    
    // Get tier config for pricing
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.plan))
      .unique();
    
    if (!tierConfig) {
      throw new Error("Tier configuration not found");
    }
    
    // Calculate billing dates
    const billingStartDate = Date.now();
    const billingEndDate = billingStartDate + (30 * 24 * 60 * 60 * 1000);
    
    // Generate mock transaction ID
    const transactionId = `mock_sub_${Date.now()}`;
    
    // Update tenant subscription
    await ctx.db.patch(tenant._id, {
      plan: args.plan,
      trialEndsAt: null, // Remove trial
      billingStartDate,
      billingEndDate,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });
    
    // Log to billing history
    await ctx.db.insert("billingHistory", {
      tenantId: tenant._id,
      event: "upgrade",
      previousPlan: "starter",
      newPlan: args.plan,
      amount: tierConfig.price,
      transactionId,
      mockTransaction: true,
      timestamp: Date.now(),
    });
    
    // Log to audit
    await ctx.db.insert("auditLogs", {
      tenantId: tenant._id,
      action: "SUBSCRIPTION_UPGRADE",
      entityType: "tenant",
      entityId: tenant._id,
      actorType: "user",
      previousValue: { plan: "starter" },
      newValue: { 
        plan: args.plan, 
        billingStartDate, 
        billingEndDate,
        transactionId 
      },
    });
    
    return { success: true, transactionId };
  },
});
```

### Previous Story Intelligence

**This is the first story in Epic 3**, so there is no direct previous story in this epic. However, it builds on:

- **Story 1.7 (COMPLETE)**: Tier Configuration Service - Tier limits and pricing
- **Story 2.7 (COMPLETE)**: Account Profile Settings - Settings page patterns
- **Story 2.3 (COMPLETE)**: Mock SaligPay OAuth - Mock integration patterns

**Key learnings from related stories:**
- Use consistent component patterns from onboarding
- Follow tenant isolation patterns from Story 1.5
- Use tier config queries from Story 1.7 for plan limits

### Anti-Patterns to Avoid

❌ **DO NOT** allow subscription upgrade without authentication  
❌ **DO NOT** skip tenant isolation in mutations  
❌ **DO NOT** store real payment information (this is mock only)  
❌ **DO NOT** update plan without logging to audit trail  
❌ **DO NOT** skip billing history tracking  
❌ **DO NOT** allow upgrading to invalid plans  
❌ **DO NOT** forget to nullify trial end date on upgrade  
❌ **DO NOT** break existing tier limit enforcement  

### Testing Requirements

**Testing Framework:** Vitest (already set up in project)

**Required Tests:**

1. **Unit Tests:**
   - Mock payment validation
   - Billing date calculation
   - Transaction ID generation
   - Plan validation

2. **Integration Tests:**
   - End-to-end mock checkout flow
   - Tenant isolation verification
   - Audit log content verification

3. **Security Tests:**
   - Unauthenticated upgrade attempts blocked
   - Cross-tenant subscription upgrades blocked

### Dependencies on Other Stories

This story **DEPENDS ON** these completed stories:

- **Story 1.7** (COMPLETE): Tier Configuration Service - Tier limits and pricing
- **Story 2.7** (COMPLETE): Account Profile Settings - Settings patterns

This story **ENABLES** these future stories:

- **Story 3.2**: Trial-to-Paid Conversion - Extend to handle trial expiry
- **Story 3.3**: Subscription Tier Upgrade - Reuse checkout for upgrades
- **Story 3.4**: Subscription Downgrade - Similar flow, opposite direction
- **Story 3.5**: Subscription Cancellation - Uses subscription status field
- **Story 3.6**: View Subscription Status - Uses billing history

### UI/UX Design Reference

**Settings > Billing Page (from 07-owner-settings.html):**

```
┌─────────────────────────────────────────────────────────┐
│ Settings - Billing                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Current Subscription                                │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Plan: Starter (Free Trial)                         │ │
│ │ Trial ends: March 25, 2026                         │ │
│ │ Status: Active                                     │ │
│ │                                                     │ │
│ │ [Upgrade to Growth - ₱2,499/mo]  [View Plans]     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Plan Comparison                                     │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Starter    │ Growth (₱2,499/mo) │ Scale (₱4,999)  │ │
│ │ 100 aff.  │ 5,000 affiliates    │ Unlimited       │ │
│ │ 3 camps   │ 10 campaigns        │ Unlimited       │ │
│ │           │ ✓ Advanced Analytics│ All features    │ │
│ │ [Current] │ [Upgrade]           │ [Upgrade]       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Mock Checkout Modal                                  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Plan: Growth - ₱2,499/month                         │ │
│ │                                                     │ │
│ │ Card Number: [4242 4242 4242 4242]                 │ │
│ │ Expiry: [MM/YY]  CVV: [123]                       │ │
│ │ Cardholder: [Test User]                           │ │
│ │                                                     │ │
│ │ [Cancel]                    [Pay ₱2,499]          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Billing History Section (Future Story 3.6):**

```
┌─────────────────────────────────────────────────────────┐
│ Billing History                                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Date       │ Event    │ Amount │ Transaction ID    │ │
│ │ Mar 14     │ Upgrade  │ ₱2,499 │ mock_sub_123456   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## References

- [Source: epics.md#Story 3.1] - Full acceptance criteria and user story
- [Source: epics.md#Epic 3] - Epic overview and goals (FR5, FR83-FR86, FR88)
- [Source: architecture.md#Data Architecture] - Convex patterns
- [Source: architecture.md#Project Structure & Boundaries] - Directory structure
- [Source: 1-7-tier-configuration-service.md] - Tier pricing and limits
- [Source: 2-7-account-profile-settings.md] - Settings page patterns
- [Source: 07-owner-settings.html] - UX design reference
- [Source: convex/schema.ts] - Existing schema with tenants and tierConfigs
- [Source: convex/tierConfig.ts] - Tier configuration queries

## Dev Agent Record

### Agent Model Used

- Model: minimax-m2.5-free (OpenCode)

### Debug Log References

- To be populated during implementation

### Completion Notes List

- [x] Task 1.1: Created billing section in settings page
- [x] Task 1.2: Added subscription status display with trial countdown
- [x] Task 1.3: Show plan limits and current usage from tier config
- [x] Task 1.4: Connected to existing tier config queries
- [x] Task 2.1: Created MockCheckoutModal component
- [x] Task 2.2: Created PlanSelectionCard with Growth/Scale options
- [x] Task 2.3: Created MockPaymentForm with validation
- [x] Task 2.4: Implemented checkout flow with state management
- [x] Task 3.1: Created upgradeSubscription mutation
- [x] Task 3.2: Updated tenant plan field
- [x] Task 3.3: Removed trial end date on upgrade
- [x] Task 3.4: Set billing cycle dates
- [x] Task 3.5: Added tenantId scoping
- [x] Task 4.1: Logged subscription upgrade to auditLogs
- [x] Task 4.2: Included mock transaction ID in audit
- [x] Task 4.3: Recorded plan change history
- [x] Task 5.1: Integrated billing section into settings
- [x] Task 5.2: Wired upgrade buttons to checkout modal
- [x] Task 5.3: Added success/error feedback
- [x] Task 6.1: Test mock checkout flow - Unit tests created in convex/subscriptions.test.ts
- [x] Task 6.2: Test tenant isolation - Unit tests for tenant isolation added
- [x] Task 6.3: Verify audit logging - Unit tests for audit logging added

### File List

**New Files Created:**
- `src/components/settings/SubscriptionStatusCard.tsx` - Current plan display
- `src/components/settings/PlanSelectionCard.tsx` - Growth/Scale selection
- `src/components/settings/MockCheckoutModal.tsx` - Checkout flow modal
- `src/components/settings/MockPaymentForm.tsx` - Mock payment form
- `src/app/(auth)/settings/billing/page.tsx` - Billing settings page
- `convex/subscriptions.ts` - Subscription mutations and queries
- `convex/subscriptions.test.ts` - Unit tests for subscription functionality

**Modified Files:**
- `convex/schema.ts` - Added billing fields to tenants, created billingHistory table

### Change Log

- **2026-03-14**: Story created - Ready for implementation
- **2026-03-14**: Implemented mock subscription checkout flow - Schema updates, backend mutations, UI components, and billing page integrated
- **2026-03-14**: Code Review fixes applied - Added unit tests, fixed hardcoded prices, added plan validation, upgraded Growth→Scale support, mock payment button text, preserved billingEndDate on cancel

---

## Story Completion Status

**Status:** done

**Completion Note:** Implementation complete. All 6 acceptance criteria implemented: (1) Trial status detection and display, (2) Mock checkout flow initiation with plan selection, (3) Mock payment form with validation, (4) Subscription update with plan change and trial removal, (5) Billing cycle establishment, (6) Mock transaction logging to audit trail. Code review completed with fixes applied: unit tests added (convex/subscriptions.test.ts), hardcoded prices removed, plan change validation added, Growth→Scale upgrade support added.

**Dependencies:** Stories 1.7, 2.7 (all complete)

**Created:** 2026-03-14 by bmm-pm-agent
