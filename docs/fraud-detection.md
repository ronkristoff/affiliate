# Fraud Detection

> Reference document for understanding how self-referral fraud detection works.

## Overview

The platform detects **self-referral fraud** — when an affiliate attempts to earn commissions on their own purchases. It runs inline during commission creation (not a scheduled job).

## Detection Signals

The system compares **affiliate data** against **customer/conversion data** using 6 signal types with **weighted scoring**:

| Signal | Comparison Method | Indicator Value | Weight |
|--------|------------------|-----------------|--------|
| **Email** | Case-insensitive exact match | `email_match` | 3 |
| **IP Address (exact)** | Exact match | `ip_match` | 3 |
| **IP Address (subnet)** | Same `/24` subnet | `ip_subnet_match` | 1 |
| **Device Fingerprint** | Exact match | `device_match` | 2 |
| **Payment Method** | Last 4 digits match | `payment_method_match` | 2 |
| **Payment Processor** | Processor ID match | `payment_processor_match` | 2 |

**Threshold: Weighted score >= 3 points = self-referral detected.**

### What triggers vs. what doesn't

| Matched Indicators | Total Score | Triggers? |
|--------------------|-------------|-----------|
| `email_match` alone | 3 | Yes |
| `ip_match` alone | 3 | Yes |
| `ip_subnet_match` alone | 1 | No |
| `device_match` alone | 2 | No |
| `ip_subnet_match` + `device_match` | 3 | Yes |
| `ip_subnet_match` + `payment_method_match` | 3 | Yes |
| `email_match` + `ip_subnet_match` | 4 | Yes |
| Empty (no matches) | 0 | No |

This weighted approach reduces false positives from shared networks (PH/SEA co-working spaces, cafés) where IP subnet matches alone should not trigger detection.

## When It Runs

Fraud detection is **not** a cron job. It runs inline at two points:

### 1. Commission Creation (webhook flow)

```
SaligPay webhook received
    → commissionEngine.ts processes the event
    → calls createCommissionFromConversionInternal()
    → detectSelfReferral() runs
    → commission created with fraud flags (or without)
```

### 2. Conversion Recording (manual flow)

```
Owner/affiliate records a conversion
    → conversions.ts createConversion()
    → detectSelfReferralInternal() runs
    → conversion flagged if self-referral
    → commission created (detection runs again)
```

Detection can run **twice** for a single conversion — once at conversion creation and once at commission creation.

## Data Tracking

The affiliate's fingerprint data is updated reactively (not during detection):

| Trigger | Function | Data Stored |
|---------|----------|-------------|
| Affiliate logs in | `updateAffiliateLoginTracking` | `lastLoginIp`, `lastDeviceFingerprint` |
| Payout method set/changed | `updateAffiliatePayoutTracking` | `payoutMethodLastDigits`, `payoutMethodProcessorId` |

This data is stored on the affiliate record and compared against future conversions.

## What Happens When Detected

```
Conversion arrives
    │
    ▼
detectSelfReferral() compares affiliate vs. conversion data
    │
    │ (weighted score >= 3)
    ▼
isSelfReferral = true
    │
    ├── Commission status forced to "pending" (bypasses auto-approve)
    ├── isSelfReferral flag set on commission
    ├── fraudIndicators[] populated (e.g., ["email_match", "ip_subnet_match"])
    ├── Fraud signal added to affiliate.fraudSignals[] (with signalId)
    ├── Dedup guard: skips if same type + commissionId + severity already exists
    ├── Audit log: self_referral_detected
    └── Fraud alert email scheduled to SaaS Owner
```

### Dedup Behavior

Duplicate signals (same `type` + `commissionId` + `severity`) are skipped. This prevents multiple fraud signals from being created for the same commission if detection runs more than once.

## Owner Experience

### Commissions Page

| Feature | Behavior |
|---------|----------|
| **Flagged row highlight** | Yellow background (`!bg-[#fffbeb]`) |
| **"Flagged for Review" card** | Count of self-referral + fraud-indicator commissions |
| **Detail drawer** | Yellow fraud warning box with specific indicators listed |
| **Approve All** | Automatically **skips** fraud-flagged commissions |
| **Override** | Owner can approve individually via "Override — Mark Legitimate" |
| **Decline** | Owner can decline with a required reason |

### Drawer States

**Fraud detected:**
```
┌─────────────────────────────────────┐
│ ⚠️  Fraud detected                  │
│                                     │
│ Self-referral detected              │
│ Score: 3/3 threshold                │
│                                     │
│ • email_match                       │
│ • ip_subnet_match                   │
│                                     │
│ [Decline Commission] [Override]     │
└─────────────────────────────────────┘
```

**No fraud:**
```
┌─────────────────────────────────────┐
│ ✅  No fraud signals detected       │
│                                     │
│ [Decline]           [Approve]       │
└─────────────────────────────────────┘
```

## Schema Fields

### On `conversions`

| Field | Type | Purpose |
|-------|------|---------|
| `ipAddress` | string (optional) | Customer's IP address |
| `deviceFingerprint` | string (optional) | Customer's device fingerprint |
| `customerEmail` | string (optional) | Customer's email |
| `paymentMethodLastDigits` | string (optional) | Last 4 digits of payment method |
| `paymentMethodProcessorId` | string (optional) | Payment processor ID |
| `isSelfReferral` | boolean (optional) | Flag set by detection |

### On `affiliates`

| Field | Type | Purpose |
|-------|------|---------|
| `lastLoginIp` | string (optional) | IP from last login |
| `lastDeviceFingerprint` | string (optional) | Device fingerprint from last login |
| `payoutMethodLastDigits` | string (optional) | Last 4 digits of payout method |
| `payoutMethodProcessorId` | string (optional) | Payout processor ID |
| `fraudSignals[]` | array | Accumulated fraud signal history |

### On `commissions`

| Field | Type | Purpose |
|-------|------|---------|
| `isSelfReferral` | boolean (optional) | Whether self-referral was detected |
| `fraudIndicators[]` | string array (optional) | Matched indicator names |

### `fraudSignals[]` Entry Structure

```typescript
{
  type: string;           // "selfReferral" | "botTraffic" | "ipAnomaly" | "manual_suspension"
  severity: string;       // "high" (always high for self-referral)
  timestamp: number;      // When detected
  signalId?: string;      // Stable unique ID for signal lookup (e.g., "sig_1710000000_abc123")
  details?: string;       // JSON: matchedIndicators, commissionId, detectedAt, totalScore, threshold
  reviewedAt?: number;    // When owner reviewed
  reviewedBy?: string;    // Owner who reviewed
  reviewNote?: string;    // Owner's note
  commissionId?: string;  // Link to related commission
}
```

### Details JSON Example

```json
{
  "matchedIndicators": ["email_match", "ip_subnet_match"],
  "commissionId": "jxk7y8m9n0p1q2r3s4t5",
  "detectedAt": "2026-03-23T10:30:00.000Z",
  "totalScore": 4,
  "threshold": 3
}
```

> **Note:** `totalScore` is persisted in signal details for audit trail — enables retroactive re-evaluation if weights change in the future.

## Key Files

| File | Responsibility |
|------|---------------|
| `convex/fraudDetection.ts` | Core detection logic (weighted scoring), signal recording, login/payout tracking, migration action |
| `convex/fraudSignals.ts` | Signal queries, dismissal, suspension, RBAC — uses signalId for stable lookups |
| `convex/affiliates.ts` | Affiliate management, fraud signal creation in suspend/status-change flows |
| `convex/commissions.ts` | Runs detection at commission creation, sets flags |
| `convex/conversions.ts` | Runs detection at conversion recording |
| `convex/affiliateAuth.ts` | Tracks affiliate login IP/device |
| `src/app/(auth)/commissions/page.tsx` | UI: flagged rows, fraud box, override/decline |

## Limitations

- **No periodic re-scanning** — existing commissions are not re-checked after affiliate data changes
- **No batch processing** — detection runs per-conversion, not batched
- **IP subnet matching** — `/24` subnet only (same network, not necessarily same person)
- **Detection is point-in-time** — the system stores only `lastLoginIp` and `lastDeviceFingerprint` (a single snapshot). If an affiliate's IP or device changes legitimately between login and purchase, the comparison may miss or falsely match.
- **Weights are per-platform** — `SIGNAL_WEIGHTS` and `SELF_REFERRAL_THRESHOLD` apply to all tenants. A Manila-based agency (dense shared networks) and a US-based SaaS (distributed remote affiliates) have different false-positive profiles. Per-tenant configuration is a future feature.
- **Embedded array scaling** — fraud signals are stored as an embedded array on the affiliate document. This works for current scale but will hit the 1MB Convex document limit at ~thousands of signals per affiliate. A standalone `fraudSignals` table migration is planned for when tenant scale demands it.
