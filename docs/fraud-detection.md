# Fraud Detection

> Reference document for understanding how self-referral fraud detection works.

## Overview

The platform detects **self-referral fraud** — when an affiliate attempts to earn commissions on their own purchases. It runs inline during commission creation (not a scheduled job).

## Detection Signals

The system compares **affiliate data** against **customer/conversion data** using 4 signal types:

| Signal | Comparison Method | Indicator Value |
|--------|------------------|-----------------|
| **Email** | Case-insensitive exact match | `email_match` |
| **IP Address** | Exact match OR same `/24` subnet | `ip_match` or `ip_subnet_match` |
| **Device Fingerprint** | Exact match | `device_match` |
| **Payment Method** | Last 4 digits match OR processor ID match | `payment_method_match` or `payment_processor_match` |

**Threshold: ANY 1 match = self-referral detected.**

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
    │ (any 1+ match)
    ▼
isSelfReferral = true
    │
    ├── Commission status forced to "pending" (bypasses auto-approve)
    ├── isSelfReferral flag set on commission
    ├── fraudIndicators[] populated (e.g., ["email_match", "ip_subnet_match"])
    ├── Fraud signal added to affiliate.fraudSignals[]
    ├── Audit log: self_referral_detected
    └── Fraud alert email scheduled to SaaS Owner
```

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
  type: string;           // "selfReferral"
  severity: string;       // "high" (always high for self-referral)
  timestamp: number;      // When detected
  details?: string;       // JSON: matchedIndicators, commissionId, detectedAt
  reviewedAt?: number;    // When owner reviewed
  reviewedBy?: string;    // Owner who reviewed
  reviewNote?: string;    // Owner's note
  commissionId?: string;  // Link to related commission
}
```

## Key Files

| File | Responsibility |
|------|---------------|
| `convex/fraudDetection.ts` | Core detection logic, signal recording, login/payout tracking |
| `convex/commissions.ts` | Runs detection at commission creation, sets flags |
| `convex/conversions.ts` | Runs detection at conversion recording |
| `convex/affiliateAuth.ts` | Tracks affiliate login IP/device |
| `src/app/(auth)/commissions/page.tsx` | UI: flagged rows, fraud box, override/decline |

## Limitations

- **No periodic re-scanning** — existing commissions are not re-checked after affiliate data changes
- **No batch processing** — detection runs per-conversion, not batched
- **IP subnet matching** — `/24` subnet only (same network, not necessarily same person)
- **Single signal threshold** — any 1 match triggers detection (could produce false positives on shared networks)
