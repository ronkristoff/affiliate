# Story 13.3: Mark Payouts as Paid

Status: done

## Story

As a SaaS Owner,
I want to mark individual payouts or an entire batch as paid,
so that affiliate balances are updated and payout records reflect actual payment status. (FR47)

## Acceptance Criteria

1. **Mark Single Payout as Paid** (AC: #1)
   - Given the SaaS Owner views a batch's payout details
   - When they click "Mark as Paid" on a single payout row
   - Then that payout's status is updated from "pending" to "paid"
   - And the `paidAt` timestamp is set
   - And an optional payment reference can be entered before confirming
   - And an audit log entry is created for the action

2. **Mark All Payouts in Batch as Paid** (AC: #2)
   - Given the SaaS Owner views a batch with pending payouts
   - When they click "Mark All as Paid"
   - Then a confirmation dialog is displayed with batch summary (total amount, affiliate count)
   - And the confirmation includes a warning: "Ensure you've transferred funds externally"
   - When confirmed, all payouts in the batch are marked as "paid"
   - And all affected payouts get `paidAt` timestamp
   - And an optional batch-level payment reference can be entered

3. **Batch Status Auto-Transition** (AC: #2)
   - Given a batch has individual payouts being marked as paid
   - When all payouts in the batch reach "paid" status
   - Then the batch status automatically transitions to "completed"
   - And the batch `completedAt` timestamp is set
   - When marking all payouts at once (batch-wide action)
   - Then the batch status transitions to "completed" in the same mutation

4. **Confirmation Dialog with Warning** (UX Requirement)
   - Given the SaaS Owner clicks any mark-as-paid action
   - When the confirmation dialog appears
   - Then it displays: affected affiliate count, total amount
   - And a clear warning message about irreversible action
   - And an optional payment reference input field
   - And Cancel / Confirm buttons

5. **View Batch Payout Details** (Supporting AC #1)
   - Given the SaaS Owner is on the Payouts page
   - When they click on a batch in the Recent Batches table
   - Then a detail view opens showing all individual payouts in that batch
   - And each payout row shows: affiliate name, email, amount, status, payout method
   - And payout rows with "pending" status show a "Mark Paid" action button

6. **UI State Updates** (AC: #1, #2)
   - Given a mark-as-paid action succeeds
   - When the UI updates
   - Then the payout status badge updates to "Paid" (green)
   - And the batch status badge updates to "Paid" when all payouts are paid
   - And a success toast notification is displayed
   - And the metrics (Total Paid Out) recalculate automatically

## Tasks / Subtasks

- [x] Task 1: Create Convex mutation for marking single payout as paid (AC: #1, #3)
  - [x] Add `markPayoutAsPaid` mutation to `convex/payouts.ts`
  - [x] Accept `payoutId: v.id("payouts")` and optional `paymentReference: v.optional(v.string())` args
  - [x] Verify payout belongs to current tenant (tenant isolation)
  - [x] Update payout: set `status: "paid"`, `paidAt: Date.now()`, `paymentReference` if provided
  - [x] Check if all payouts in the same batch are now paid → auto-transition batch to "completed"
  - [x] Create audit log entry with action "payout_marked_paid"
  - [x] Return updated payout and batch status

- [x] Task 2: Create Convex mutation for marking all batch payouts as paid (AC: #2, #3)
  - [x] Add `markBatchAsPaid` mutation to `convex/payouts.ts`
  - [x] Accept `batchId: v.id("payoutBatches")` and optional `paymentReference: v.optional(v.string())` args
  - [x] Verify batch belongs to current tenant (tenant isolation)
  - [x] Fetch all payouts for the batch using `by_batch` index
  - [x] Update all pending payouts: set `status: "paid"`, `paidAt: Date.now()`, `paymentReference`
  - [x] Update batch: set `status: "completed"`, `completedAt: Date.now()`
  - [x] Create audit log entry with action "batch_marked_paid" including all affected payouts
  - [x] Return success with count of payouts marked

- [x] Task 3: Create Convex query for batch payout details (AC: #5)
  - [x] Add `getBatchPayoutStatus` query to `convex/payouts.ts`
  - [x] Return payouts with current status for individual mark-as-paid UI
  - [x] Include count of paid vs pending payouts for progress indicator

- [x] Task 4: Add Batch Detail Dialog to PayoutsClient.tsx (AC: #5)
  - [x] Add click handler on batch rows in Recent Batches table
  - [x] Create BatchDetailDialog component showing individual payouts
  - [x] Display payout table with: affiliate avatar, name, email, payout method, amount, status badge
  - [x] Add "Mark Paid" button per payout row (only for pending status)
  - [x] Add "Mark All as Paid" button in dialog header (only when pending payouts exist)
  - [x] Show progress indicator: "X of Y payouts paid" with progress bar

- [x] Task 5: Add Mark-as-Paid confirmation dialogs (AC: #4)
  - [x] Create MarkPaidConfirmDialog for individual payout confirmation
  - [x] Include: affiliate name, amount, optional payment reference input
  - [x] Create BatchMarkPaidConfirmDialog for batch-wide confirmation
  - [x] Include: batch total, affiliate count, warning message, optional payment reference input
  - [x] Warning text: "This marks payouts as paid. Ensure you've transferred funds externally."
  - [x] Integrate with existing Dialog component from Radix UI

- [x] Task 6: Wire up mutations and UI state updates (AC: #6)
  - [x] Connect `markPayoutAsPaid` mutation to individual "Mark Paid" buttons
  - [x] Connect `markBatchAsPaid` mutation to "Mark All as Paid" button
  - [x] Add loading states during mutation execution (Loader2 spinner)
  - [x] Add success toast on completion
  - [x] Add error handling with toast on failure
  - [x] Ensure Convex subscriptions auto-update batch status badges

- [x] Task 7: Add "Mark All Paid" button to batch history table (AC: #2)
  - [x] Add action button column in Recent Batches table for pending batches
  - [x] Show "Mark All Paid" button (CheckCircle2 icon) for batches with "pending" status
  - [x] Disable button for "completed" batches
  - [x] Loading state during mutation

- [x] Task 8: Write tests (AC: #1-6)
  - [x] Unit test for `markPayoutAsPaid` (tenant isolation, status update, audit log, batch auto-transition)
  - [x] Unit test for `markBatchAsPaid` (tenant isolation, all payouts updated, batch completed, audit log)
  - [x] Edge case: marking already-paid payout (no-op or error)
  - [x] Edge case: batch with mix of paid and pending payouts
  - [x] Edge case: payment reference validation

## Dev Notes

### CURRENT STATE ANALYSIS — What Already Exists

**convex/payouts.ts (Stories 13.1 + 13.2):**
- `generatePayoutBatch` mutation — creates batch + payout records + updates commissions to "paid"
- `getPayoutBatches` query — returns all batches for tenant (no payout detail rows)
- `getPendingPayoutTotal` query — aggregates pending commissions
- `getAffiliatesWithPendingPayouts` query — lists affiliates needing payout
- `getBatchPayouts` query — returns all payouts for a batch enriched with affiliate data
- Uses `requireTenantId(ctx)` and `getAuthenticatedUser(ctx)` from `convex/tenantContext.ts`
- All queries enforce tenant isolation

**convex/schema.ts:**
- `payouts` table: `tenantId`, `affiliateId`, `batchId`, `amount`, `status`, `paymentReference` (optional string), `paidAt` (optional number)
- `payoutBatches` table: `tenantId`, `totalAmount`, `affiliateCount`, `status`, `generatedAt`, `completedAt` (optional number)
- `payouts` has indexes: `by_batch`, `by_tenant`, `by_affiliate`, `by_tenant_and_status`
- `payoutBatches` has indexes: `by_tenant`, `by_tenant_and_status`
- `auditLogs` table with comprehensive fields for action tracking

**PayoutsClient.tsx (Stories 13.1 + 13.2):**
- Batch success dialog shows batch info and affiliate list after generation
- Recent Batches table displays historical batches with BatchStatusBadge and Download CSV
- BatchStatusBadge handles "pending" (amber), "processing" (blue), "completed" (green) statuses
- Format helpers: `formatCurrency()`, `formatDate()`, `getInitials()`
- Metrics row shows Total Paid Out, Pending Batches, Processing amounts
- No batch detail view or mark-as-paid functionality exists yet

**IMPORTANT: Commission lifecycle context from Story 13.1:**
- Commissions are ALREADY marked as "paid" when batch is generated (status transitions from "confirmed" → "paid")
- The `payouts` table records start with status="pending"
- This story transitions `payouts.status` from "pending" → "paid" — this is the MANUAL mark-as-paid step
- Commissions do NOT need to be updated again in this story

### CRITICAL IMPLEMENTATION RULES

**Rule 1: Use NEW Convex Function Syntax.** All functions must use `args`, `returns`, `handler` pattern with validators on all args and returns.

**Rule 2: Tenant Isolation.** Every mutation MUST verify the payout/batch belongs to the current tenant before modifying. Fetch the record first, check `tenantId`, then proceed.

**Rule 3: Index Usage.** Use `by_batch` index on `payouts` table for fetching batch payouts. Use `by_tenant_and_status` for counting. NEVER use `ctx.db.query("payouts").filter()`.

**Rule 4: Atomic Operations.** `markBatchAsPaid` must update all payouts AND the batch in a single mutation (Convex mutations are atomic). Do NOT use separate mutations.

**Rule 5: Audit Trail.** Every mark-as-paid action MUST create an audit log entry. Single payout = one entry. Batch = one entry with summary metadata.

**Rule 6: Financial Precision.** No monetary calculations in this story — just status transitions. Amounts are already set during batch generation.

**Rule 7: Existing File Modification.** MODIFY existing files — do NOT create new route pages or new Convex files. The payouts page already exists at `src/app/(auth)/payouts/`.

**Rule 8: No Email Sending.** Story 13.4 handles email notifications. This story should NOT send emails or call `sendPayoutSentEmail`. Only update data and create audit logs.

**Rule 9: Batch Auto-Transition.** When the last pending payout in a batch is marked as paid, the batch MUST auto-transition to "completed" with `completedAt` set. This must work for both individual and batch-wide actions.

### FILE STRUCTURE

```
Files to MODIFY:
├── convex/payouts.ts                        # Add markPayoutAsPaid, markBatchAsPaid mutations, getBatchPayoutStatus query
├── src/app/(auth)/payouts/PayoutsClient.tsx  # Add batch detail dialog, mark-as-paid UI, confirmation dialogs

Files to REFERENCE (do NOT modify):
├── convex/schema.ts                          # payouts/payoutBatches table definitions and indexes
├── convex/tenantContext.ts                   # requireTenantId(), getAuthenticatedUser()
├── src/lib/csv-utils.ts                      # CSV utilities (existing, from Story 13.2)
├── src/components/ui/dialog.tsx               # Radix Dialog component
├── src/components/ui/badge.tsx                # Badge component
├── src/components/ui/input.tsx                # Input component (for payment reference)
├── src/components/ui/table.tsx                # Table components
└── _bmad-output/screens/04-owner-payouts.html  # UI design reference
```

### TECHNICAL SPECIFICATIONS

#### Convex Mutation: markPayoutAsPaid

```typescript
// Add to convex/payouts.ts
export const markPayoutAsPaid = mutation({
  args: {
    payoutId: v.id("payouts"),
    paymentReference: v.optional(v.string()),
  },
  returns: v.object({
    payoutId: v.id("payouts"),
    batchStatus: v.string(),
    remainingPending: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // 1. Verify payout belongs to current tenant
    const payout = await ctx.db.get(args.payoutId);
    if (!payout || payout.tenantId !== tenantId) {
      throw new Error("Payout not found or access denied");
    }

    // 2. Check if already paid (idempotency)
    if (payout.status === "paid") {
      // Return current state without error (idempotent)
      const batch = await ctx.db.get(payout.batchId);
      const pendingCount = batch
        ? await countPendingPayouts(ctx, payout.batchId)
        : 0;
      return {
        payoutId: payout._id,
        batchStatus: batch?.status ?? "unknown",
        remainingPending: pendingCount,
      };
    }

    // 3. Update payout record
    await ctx.db.patch(args.payoutId, {
      status: "paid",
      paidAt: Date.now(),
      ...(args.paymentReference ? { paymentReference: args.paymentReference } : {}),
    });

    // 4. Check if all payouts in batch are now paid → auto-transition batch
    const batch = await ctx.db.get(payout.batchId);
    let batchStatus = batch?.status ?? "unknown";
    const remainingPending = await countPendingPayouts(ctx, payout.batchId);

    if (batch && remainingPending === 0) {
      await ctx.db.patch(payout.batchId, {
        status: "completed",
        completedAt: Date.now(),
      });
      batchStatus = "completed";
    }

    // 5. Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "payout_marked_paid",
      entityType: "payouts",
      entityId: payout._id,
      targetId: payout.batchId,
      actorId: user.userId,
      actorType: "user",
      metadata: {
        affiliateId: payout.affiliateId,
        amount: payout.amount,
        paymentReference: args.paymentReference ?? null,
        batchStatus,
      },
    });

    return {
      payoutId: payout._id,
      batchStatus,
      remainingPending,
    };
  },
});
```

#### Convex Mutation: markBatchAsPaid

```typescript
export const markBatchAsPaid = mutation({
  args: {
    batchId: v.id("payoutBatches"),
    paymentReference: v.optional(v.string()),
  },
  returns: v.object({
    batchId: v.id("payoutBatches"),
    payoutsMarked: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");

    // 1. Verify batch belongs to current tenant
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Batch not found or access denied");
    }

    // 2. Fetch all pending payouts for this batch
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();

    const pendingPayouts = payouts.filter((p) => p.status === "pending");

    if (pendingPayouts.length === 0) {
      throw new Error("NO_PENDING_PAYOUTS");
    }

    // 3. Update all pending payouts to paid
    for (const payout of pendingPayouts) {
      await ctx.db.patch(payout._id, {
        status: "paid",
        paidAt: Date.now(),
        ...(args.paymentReference ? { paymentReference: args.paymentReference } : {}),
      });
    }

    // 4. Update batch to completed
    await ctx.db.patch(args.batchId, {
      status: "completed",
      completedAt: Date.now(),
    });

    // 5. Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "batch_marked_paid",
      entityType: "payoutBatches",
      entityId: args.batchId,
      actorId: user.userId,
      actorType: "user",
      metadata: {
        payoutsMarked: pendingPayouts.length,
        totalAmount: batch.totalAmount,
        paymentReference: args.paymentReference ?? null,
        payoutIds: pendingPayouts.map((p) => p._id),
      },
    });

    return {
      batchId: args.batchId,
      payoutsMarked: pendingPayouts.length,
    };
  },
});
```

#### Helper: countPendingPayouts (internal)

```typescript
// Internal helper function within payouts.ts
async function countPendingPayouts(
  ctx: any,
  batchId: Id<"payoutBatches">
): Promise<number> {
  const payouts = await ctx.db
    .query("payouts")
    .withIndex("by_batch", (q) => q.eq("batchId", batchId))
    .collect();
  return payouts.filter((p) => p.status === "pending").length;
}
```

#### UI: Batch Detail Dialog Pattern

```typescript
// In PayoutsClient.tsx, add state for viewing batch details
const [selectedBatchId, setSelectedBatchId] = useState<Id<"payoutBatches"> | null>(null);

// Query batch payouts when a batch is selected
const batchPayouts = useQuery(
  api.payouts.getBatchPayouts,
  selectedBatchId ? { batchId: selectedBatchId } : "skip"
);

// Click handler on batch row
onClick={() => setSelectedBatchId(batch._id)}
```

#### UI: Mark-as-Paid Confirmation Dialog Pattern

```typescript
// Confirmation dialog with payment reference input
<Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Mark as Paid</DialogTitle>
      <DialogDescription>
        This action confirms you have transferred funds externally.
      </DialogDescription>
    </DialogHeader>
    
    {/* Warning */}
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm text-amber-800">
        This marks the payout as paid. Ensure you've transferred funds externally.
        This action cannot be undone.
      </p>
    </div>
    
    {/* Batch summary */}
    <div className="rounded-lg bg-muted p-3">
      <div className="flex justify-between text-sm">
        <span>Affiliates</span><span className="font-bold">{count}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Total Amount</span><span className="font-bold text-[#10409a]">{total}</span>
      </div>
    </div>
    
    {/* Payment reference input */}
    <div>
      <label className="text-sm font-medium">Payment Reference (optional)</label>
      <Input placeholder="e.g., BPI Transfer #12345" ... />
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={cancel}>Cancel</Button>
      <Button onClick={confirmMarkPaid}>Mark as Paid</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### ARCHITECTURE COMPLIANCE

| Aspect | Requirement |
|--------|-------------|
| Convex Functions | NEW syntax with `args`, `returns`, `handler` — all validators present |
| Tenant Isolation | Verify payout/batch `tenantId` matches authenticated user on every mutation |
| Index Usage | `by_batch` for batch payouts, `by_tenant_and_status` for counts |
| Client Components | All UI changes in `"use client"` PayoutsClient.tsx |
| No New Routes | Modify existing `PayoutsClient.tsx` and `convex/payouts.ts` only |
| Audit Trail | Every mark-as-paid action logged to `auditLogs` table |
| Idempotency | Marking already-paid payout returns current state without error |
| Atomic Operations | `markBatchAsPaid` updates all payouts + batch in single mutation |
| Styling | Tailwind CSS v4 with brand colors (`#10409a`, `#1659d6`) |
| No Email Sending | Email notification is Story 13.4 — do NOT call email functions |

### DESIGN TOKENS

From existing PayoutsClient.tsx and design context:
- Mark as Paid button: Use `default` variant with `CheckCircle2` icon from lucide-react (green theme)
- Batch row click: cursor-pointer, subtle hover highlight
- Confirmation dialog warning: `border-amber-200 bg-amber-50 text-amber-800` (matches existing warning pattern)
- Status badges: "Pending" = amber, "Paid" = green (already implemented in BatchStatusBadge)
- Payment reference input: Standard `Input` component from Radix UI
- Brand primary: `#10409a`, Secondary: `#1659d6`
- Success toast: Use `toast.success()` from sonner

### PREVIOUS STORY INTELLIGENCE

**From Story 13.1 (Payout Batch Generation):**
- Batch generation creates individual `payouts` records with `status: "pending"`
- Commissions are ALREADY marked as "paid" during batch generation (status: "confirmed" → "paid")
- Batch data includes affiliate details (name, email, payoutMethod)
- Success dialog already shows batch summary — could add "Mark as Paid" button there too
- All queries enforce tenant isolation via `requireTenantId()`
- `getAuthenticatedUser(ctx)` returns `{ userId, tenantId }` for audit log actor

**From Story 13.2 (Payout Batch CSV Download):**
- `getBatchPayouts` query returns all payouts for a batch with affiliate enrichment
- Already includes payout status per record — can reuse for batch detail view
- CSV download uses state-driven query pattern (`csvDownloadBatchId` state)
- The Recent Batches table has an Actions column — add "Mark All Paid" alongside "Download CSV"

**From Code Reviews:**
- Convex test suite has pre-existing `convex-test` version incompatibility — tests can be written but may not execute
- All UI patterns (confirmation dialogs, toasts, loading states) are established

### ANTI-PATTERNS TO AVOID

1. **Do NOT send emails** — Story 13.4 handles notification; this story only updates data
2. **Do NOT modify commission records** — Commissions were already marked "paid" in Story 13.1
3. **Do NOT skip tenant isolation** — Always verify `payout.tenantId === tenantId` and `batch.tenantId === tenantId`
4. **Do NOT use `ctx.db.query("payouts").filter()`** — Use `withIndex("by_batch")` instead
5. **Do NOT create separate mutations per payout** — `markBatchAsPaid` must be atomic in one mutation
6. **Do NOT forget batch auto-transition** — When last payout is paid, batch MUST become "completed"
7. **Do NOT create a new page/route** — All UI changes go in existing `PayoutsClient.tsx`
8. **Do NOT allow marking payouts from other tenants** — Strict ownership check required
9. **Do NOT use `window.prompt()` or `window.confirm()`** — Use Radix Dialog components
10. **Do NOT forget audit logging** — Every mark-as-paid action MUST be logged

### TESTING APPROACH

1. **Unit Tests (convex/payouts.test.ts):**
   - `markPayoutAsPaid` updates payout status to "paid" and sets paidAt
   - `markPayoutAsPaid` sets paymentReference when provided
   - `markPayoutAsPaid` throws error for cross-tenant payout access
   - `markPayoutAsPaid` auto-transitions batch to "completed" when last payout is paid
   - `markPayoutAsPaid` returns correct batch status when other payouts remain pending
   - `markPayoutAsPaid` is idempotent (already-paid payout returns current state)
   - `markBatchAsPaid` updates all pending payouts to "paid"
   - `markBatchAsPaid` sets batch status to "completed" and completedAt
   - `markBatchAsPaid` throws error for cross-tenant batch access
   - `markBatchAsPaid` throws "NO_PENDING_PAYOUTS" for fully paid batch
   - `markBatchAsPaid` creates audit log entry with correct metadata

2. **Edge Cases:**
   - Batch with mix of already-paid and pending payouts (mark all should only update pending)
   - Empty payment reference (valid — field is optional)
   - Very large batch (many payouts in single mutation)
   - Concurrent marking (two users marking same payout)

### ENVIRONMENT VARIABLES
No new environment variables needed.

### REFERENCES

- **Epic 13 Story Definition:** [Source: _bmad-output/planning-artifacts/epics.md#Story 13.3]
- **PRD FR47 (Mark Payouts as Paid):** [Source: _bmad-output/planning-artifacts/prd.md#FR47]
- **Architecture Document (Manual-Assisted Workflow):** [Source: _bmad-output/planning-artifacts/architecture.md]
- **UX Design Spec (Manual Payout Honesty UX):** [Source: _bmad-output/planning-artifacts/ux-design-specification.md#L48]
- **UX Design Spec (Irreversible Action Confirmation):** [Source: _bmad-output/planning-artifacts/ux-design-specification.md#L838]
- **Screen Design 04:** [Source: _bmad-output/screens/04-owner-payouts.html]
- **Convex Schema:** [Source: convex/schema.ts]
- **Existing Payout Functions:** [Source: convex/payouts.ts]
- **Existing Payout UI:** [Source: src/app/(auth)/payouts/PayoutsClient.tsx]
- **Tenant Context Helpers:** [Source: convex/tenantContext.ts]
- **Previous Story 13.1:** [Source: _bmad-output/implementation-artifacts/13-1-payout-batch-generation.md]
- **Previous Story 13.2:** [Source: _bmad-output/implementation-artifacts/13-2-payout-batch-csv-download.md]

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

### Completion Notes List

- ✅ Added `markPayoutAsPaid` mutation with tenant isolation, idempotency, batch auto-transition, and audit logging
- ✅ Added `markBatchAsPaid` mutation with atomic batch-wide update, tenant isolation, and audit logging
- ✅ Added `countPendingPayouts` internal helper function for batch auto-transition logic
- ✅ Added `getBatchPayoutStatus` query for batch detail dialog progress indicator
- ✅ Added BatchDetailDialog showing individual payouts with avatar, name, email, method, amount, status badge
- ✅ Added MarkPaidConfirmDialog with affiliate info, warning, and optional payment reference input
- ✅ Added BatchMarkPaidConfirmDialog with batch summary, warning, and optional payment reference input
- ✅ Added "Mark All as Paid" button in batch history table for pending/processing batches
- ✅ Added "View Details" (Eye) icon button per batch row
- ✅ Batch rows are clickable to open detail dialog
- ✅ All mutations connected with loading states (Loader2), success toasts, error toasts
- ✅ Convex real-time subscriptions auto-update batch status badges after mark-as-paid
- ✅ Payment reference input resets when dialogs close
- ✅ Added 15 unit tests covering markPayoutAsPaid, markBatchAsPaid, getBatchPayoutStatus, tenant isolation, idempotency, batch auto-transition, audit logging, edge cases
- ✅ TypeScript compiles with zero errors; pre-existing ESLint config issue unrelated to changes
- ✅ Code review fixes applied:
  - Fixed File List documentation (changed "Modified" to "Created" for new files)
  - Removed unused `result` variable in `handleMarkPayoutAsPaid`
  - Fixed test email mismatch (jamie@example.com → jamie@test.com)
  - Added accessibility attributes (htmlFor/id) to payment reference labels
  - Fixed payment reference reset timing (clears when dialogs open, not close)
  - Improved code comments for confirmation dialogs

### File List

Created:
- `convex/payouts.ts` — Added markPayoutAsPaid, markBatchAsPaid mutations, getBatchPayoutStatus query, countPendingPayouts helper
- `convex/payouts.test.ts` — Added 15 unit tests for Story 13.3 mark-as-paid functionality
- `src/app/(auth)/payouts/PayoutsClient.tsx` — Added BatchDetailDialog, MarkPaidConfirmDialog, BatchMarkPaidConfirmDialog, mark-as-paid state management, mutation wiring, Mark All Paid buttons in batch table

### Change Log

- 2026-03-18: Implemented Story 13.3 Mark Payouts as Paid — all 8 tasks complete, all ACs satisfied
- 2026-03-18: Code review fixes — File List corrected (Created vs Modified), removed unused result variable, fixed test email mismatch, added accessibility attributes (htmlFor/id), fixed payment reference reset timing, improved code comments
