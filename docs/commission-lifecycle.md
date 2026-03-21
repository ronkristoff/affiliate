# Commission Lifecycle

> Reference document for understanding how a commission flows from creation to payout.

## Status Values

| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `pending` | Awaiting owner review | No |
| `approved` | Owner approved or auto-approved | No |
| `declined` | Owner rejected | Yes |
| `paid` | Included in a payout batch | Yes |
| `reversed` | Refund/chargeback received | Yes |

## Lifecycle Flow

```
Webhook / Manual Entry
        │
        ▼
   ┌─────────┐
   │ CREATED  │  (amount calculated, fraud checked)
   └────┬─────┘
        │
   ┌────▼──────────────────────────────────┐
   │ Auto-approve rules applied             │
   │ • OFF → pending                        │
   │ • ON + below threshold → approved      │
   │ • ON + no threshold → approved         │
   │ • ON + above threshold → pending       │
   │ • Self-referral → pending (always)     │
   └────┬──────────────────┬───────────────┘
        │                  │
        ▼                  ▼
   "pending"          "approved"
        │                  │
   ┌────┼────┐             │
   ▼         ▼             │
"approved" "declined"      │
   │         (terminal)    │
   │                       │
   └───────────┬───────────┘
               │
          generatePayoutBatch
               │
               ▼
            "paid"
          (terminal)

   Any non-terminal stage:
        │
        ▼ (refund/chargeback)
    "reversed"
      (terminal)
```

## Stage Details

### 1. Creation

A commission is created when a conversion event is processed (SaligPay webhook or manual entry).

**Initial status is determined by campaign settings:**

| Scenario | Initial Status |
|----------|---------------|
| Auto-approve OFF | `pending` |
| Auto-approve ON + amount < threshold | `approved` |
| Auto-approve ON + no threshold set | `approved` |
| Auto-approve ON + amount ≥ threshold | `pending` |
| Self-referral detected | `pending` (fraud flag, always) |

**Side effects at creation:**
- Commission amount calculated (percentage × sale, or flat fee)
- Affiliate rate override applied if exists
- Fraud detection runs (IP, device fingerprint, email matching)
- Audit log: `COMMISSION_CREATED`
- If self-referral: fraud signal added to affiliate

### 2. Pending Review

Commissions in `pending` status await owner action.

- Visible to affiliate as "Pending" in their portal
- NOT counted in earnings or payout calculations
- Fraud signals shown as warnings on the commissions page

### 3. Owner Decision

#### Approve → `approved`

- Owner clicks "Approve" (single) or "Approve All Pending" (bulk)
- Bulk approve **skips** fraud-flagged commissions
- Owner can "Override — Mark Legitimate" for fraud-flagged commissions
- **Side effects:**
  - Status set to `approved`
  - Audit log: `COMMISSION_APPROVED`
  - `commission_confirmed` email sent to affiliate

#### Decline → `declined`

- Owner clicks "Decline" with a required reason
- **Side effects:**
  - Status set to `declined`
  - Decline reason stored (internal only — NOT shown to affiliate)
  - Audit log: `COMMISSION_DECLINED`

### 4. Approved (Eligible for Payout)

Once `approved`, the underlying sale is confirmed as legitimate revenue. The commission represents what the owner owes the affiliate from that sale.

- **MRR/revenue metrics**: The conversion amount is counted (the owner already received the customer's payment)
- **Affiliate earnings**: The commission amount is visible to the affiliate as confirmed earnings
- **Payout eligibility**: Can be included in a payout batch
- **Reversible**: Can still be reversed if a refund/chargeback occurs

### 5. Payout Batch

When the owner generates a payout batch:
1. System queries all `approved` commissions without a `batchId`
2. Groups by affiliate, calculates totals
3. Creates a `payoutBatch` record (status: `pending`)
4. Creates individual `payout` records per affiliate
5. Updates each commission to `status: "paid"` and sets `batchId`

### 6. Paid

The terminal success state:
- Commission linked to a payout batch
- No longer eligible for further actions
- Counted in "total paid" metrics

### Reversal

If a refund or chargeback webhook is received:
- Works on `pending` and `approved` commissions
- Status set to `reversed`
- Original commission preserved (not deleted)
- Amount subtracted from affiliate earnings
- Audit log: `COMMISSION_REVERSED`

## Key Files

| File | Responsibility |
|------|---------------|
| `convex/commissions.ts` | Creation, approve, decline, bulk approve, stats |
| `convex/commissionEngine.ts` | Webhook processing, reversal logic |
| `convex/payouts.ts` | Batch generation, marking as paid |
| `src/app/(auth)/commissions/page.tsx` | Owner UI for reviewing commissions |
| `convex/affiliateAuth.ts` | Affiliate portal commission display |

## Design Decision: "approved" vs "confirmed"

The epics originally specified "Confirmed" as the post-approval status, but the implementation uses "approved" for consistency:
- The UI button says "Approve" → status should be `approved`
- The affiliate-facing label is "Approved"
- The payout batch queries for `status: "approved"`
- All audit logs reference `COMMISSION_APPROVED`
