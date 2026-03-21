# Payout Process Flow

> Business process reference for the `/payouts` page — how the SaaS Owner generates, processes, and tracks affiliate payouts.

## Actors

| Actor | Role in This Process |
|-------|---------------------|
| **SaaS Owner (Alex)** | Manages the page — decides when to pay, confirms payments, downloads reports |
| **Affiliate (Jamie)** | Recipient — receives money, gets email notification when paid |
| **SaligPay** | (Optional) Automated payment gateway — processes payments on Alex's behalf |

## End-to-End Flow

```
Commissions Earned & Approved
         │
         ▼
    ┌────────────┐
    │  Payouts   │  ← Alex arrives at /payouts
    │   Page     │     Sees summary cards:
    └─────┬──────┘     • Pending amount
          │            • Total paid out
          │            • Processing amount
          ▼            • # of pending affiliates
    Any money owed?
     │           │
    No          Yes
     │           │
     ▼           ▼
  Empty     Review who's owed
  State      & how much
                 │
                 ▼
          Generate Batch
          (groups all pending
           into a pay run)
                 │
                 ▼
           How to Pay?
          │          │
      Manual     SaligPay
          │          │
          ▼          ▼
    Transfer      System sends
    externally    automatically
          │          │
          ▼          ▼
    Mark as Paid  Auto-completes
    (+ enter ref) (~3 seconds)
          │          │
          └────┬─────┘
               │
               ▼
        All paid in batch?
         │          │
        No         Yes
         │          │
         │          ▼
         │     Batch Closed
         │     Emails Sent
         │          │
         └──────────┘
               │
               ▼
        History & Audit Trail
```

## Step-by-Step Walkthrough

### Step 1 — Arriving at the Page

Alex navigates to `/payouts`. The page immediately answers four questions:

> **"How much do I owe? Who do I owe it to? What's already been paid? What's in progress?"**

These are displayed as four summary cards at the top:

| Card | What It Shows |
|------|--------------|
| **Pending Payouts** | Total dollar amount owed right now |
| **Total Paid Out** | Historical total across all completed batches |
| **Processing** | Money currently in-flight (e.g., SaligPay is sending it) |
| **Pending Affiliates** | How many people are waiting to be paid (flags if any haven't set up their payout method yet) |

### Step 2 — Reviewing Who's Owed

Below the summary cards, a table lists **every affiliate** who has approved, unpaid commissions:

| What Alex Sees | What It Means |
|---------------|---------------|
| Affiliate name & email | Who to pay |
| Payout Method (badge) | How they want to be paid (GCash, bank transfer, etc.) — or a warning if not configured |
| # of Commissions | How many sales/referrals led to this amount |
| Amount Due | The actual money owed |

**Business rule:** Only commissions that have been **approved** (not pending, not declined) and **not already part of a previous batch** appear here. This prevents paying the same commission twice.

If nobody is owed anything, Alex sees an empty state: *"No pending payouts at this time."*

### Step 3 — Generating a Payout Batch

When Alex is ready to pay, they click **"Generate Batch."** A confirmation dialog appears showing:

- Number of affiliates in the batch
- Total amount to be paid
- Total number of commissions being settled
- **Warning** if any affiliates don't have a payout method configured

> A "batch" is like a pay run. It groups all pending payouts into a single transaction record. Each affiliate gets their own payout line item inside the batch. The commissions that make up those amounts are immediately marked as "paid" (committed to this batch — they won't show up as pending again).

### Step 4 — Paying the Affiliates

Alex has **two options** per payout:

#### Option A: Manual Payment

1. Alex opens the batch detail (clicks "View" on a batch)
2. For each affiliate, Alex clicks **"Mark Paid"**
3. A dialog asks for an optional **payment reference** (e.g., "BPI Transfer #12345")
4. A warning reminds Alex: *"Make sure you've actually transferred the funds — this can't be undone."*
5. Alex confirms — payout is recorded as paid

**Or bulk:** Alex can click **"Mark All as Paid"** to settle every manual payout in the batch at once.

#### Option B: SaligPay (Automated)

If the tenant has SaligPay connected:

1. Alex clicks **"Send via SaligPay"** on an individual payout
2. The system immediately marks it as **"Processing"**
3. After the payment gateway responds, it auto-completes to **"Paid"**
4. A system-generated payment reference is recorded

**Business rule:** SaligPay can only be used for batch payouts.

### Step 5 — Batch Completion

A batch automatically closes when **every payout inside it is settled** — meaning each one is either "Paid" or "Failed." The system checks this every time a payout status changes.

> If Alex marks 3 out of 4 payouts as paid, and the 4th is still being processed via SaligPay, the batch stays open. Once SaligPay completes (or fails), the batch auto-closes.

When a batch closes:

- It's marked as **"Completed"** with a completion timestamp
- It appears in the **Payout History** page

### Step 6 — Notifications

Every time a payout is marked as paid (whether manual or SaligPay), the affiliate receives an **automated email** containing:

- Payout amount
- Payment reference (if available)
- Link to their earnings page on the affiliate portal
- Branded with the SaaS Owner's logo, colors, and portal name

**Business rule:** If the email fails to schedule, it does **not** block the payout from being recorded. The payout still goes through — the email error is logged.

### Step 7 — History & Audit Trail

Two places Alex can look back:

1. **Payout History** (`/payouts/history`) — A filterable, paginated list of all batches ever created. Filter by: All / Processing / Completed / Failed. Click any batch to see its full payout breakdown, progress bar, and download a CSV.

2. **Payout Audit Log** (bottom of `/payouts`) — A timeline of every payout-related action: batch generated, payout paid, batch completed, etc. Shows who did it, when, and the details (amounts, reference numbers, email status). Filterable by action type. Expandable for full metadata.

## Batch Status Lifecycle

```
                generatePayoutBatch
                       │
                       ▼
                  ┌──────────┐
                  │ PENDING  │  All payouts created as "pending"
                  └────┬─────┘
                       │
            initiateSaligPayPayout
            (on any payout in batch)
                       │
                       ▼
                  ┌────────────┐
                  │ PROCESSING │  At least one payout is in-flight via SaligPay
                  └────┬───────┘
                       │
          All payouts settled?
          (paid or failed)
                  │    │
                 No   Yes
                  │    │
                  │    ▼
                  │ ┌───────────┐
                  │ │ COMPLETED │  All payouts settled, batch closed
                  │ └───────────┘
                  │
                  └── (stays PROCESSING)
```

**Note:** A batch can skip the PROCESSING state entirely if all payouts are marked manually (no SaligPay involved). It goes PENDING → COMPLETED directly.

## Payout Status Lifecycle

```
            ┌──────────┐
            │ PENDING  │  Initial state (batch)
            └────┬─────┘
                 │
       ┌─────────┼──────────────┐
       │         │              │
  markPaid   SaligPay       markPaid
  (manual)   initiate        (manual,
       │         │            bulk)
       │         ▼              │
       │    ┌────────────┐     │
       │    │ PROCESSING │     │
       │    └──┬─────┬───┘     │
       │       │     │         │
       │    success  fail      │
       │       │     │         │
       ▼       ▼     ▼         ▼
    ┌──────────────────────────┐
    │          PAID            │  Terminal — money delivered
    └──────────────────────────┘
                    or
    ┌──────────────────────────┐
    │         FAILED           │  Terminal — payment didn't go through
    └──────────────────────────┘
```

## Business Rules

| Rule | Detail |
|------|--------|
| **Double-pay protection** | Commissions can only belong to one batch. Already-batched commissions are filtered out. |
| **SaligPay double-credit guard** | If a SaligPay payout is already completed or failed, the system won't process it again (even if the scheduled job fires twice). |
| **Batch stays open until fully settled** | A batch only auto-completes when every payout is "Paid" or "Failed." In-flight SaligPay payments keep the batch open. |
| **Mark All Paid only affects manual payouts** | SaligPay-sourced payouts in the same batch are untouched by "Mark All as Paid." |
| **Email failures don't block payouts** | If the notification email can't be scheduled, the payout still records successfully. |
| **Affiliates without payout methods** | They're still included in batches. A warning is shown to Alex, but the batch isn't blocked. |
| **Multi-tenant isolation** | Alex can only see and manage payouts for their own tenant. No cross-tenant data leakage. |
| **Max batch scan** | The system processes up to 5,000 commissions per batch generation to stay within database transaction limits. |

## CSV Download

At any point, Alex can download a CSV of a batch's payouts. The CSV includes:

- Affiliate name and email
- Payout method
- Commission count
- Amount
- Payment source (manual / SaligPay)
- Status
- Payment reference

Use cases:

- Providing to an accounting team
- Reconciling with bank statements
- Record-keeping

## Database Tables Involved

| Table | Purpose |
|-------|---------|
| `commissions` | Source of truth for amounts owed; `batchId` field links commission to its payout batch |
| `payouts` | Individual payout records (one per affiliate per batch) |
| `payoutBatches` | Grouping container for batch payouts; tracks aggregate totals and status |
| `tenantStats` | Denormalized counter for `totalPaidOut` — updated atomically on every paid mutation |
| `auditLogs` | Immutable record of every payout action (generated, paid, failed, etc.) |
