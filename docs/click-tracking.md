# Click Tracking

> Reference document for understanding why and how clicks are tracked, and their role in attribution.

## Purpose

Clicks are tracked to establish **attribution** — linking a customer's future purchase to the affiliate who referred them. Without click tracking, there's no way to know which affiliate deserves a commission when a conversion occurs.

Clicks also power key metrics:
- Click count per affiliate (traffic volume)
- Conversion rate (clicks → purchases)
- Campaign/link performance analysis

## The Attribution Chain

```
Affiliate shares referral link
        │
        ▼
Customer clicks link → saligaffiliate.com/r/ABC123
        │
        ▼
   [CLICK RECORDED] + attribution cookie set
        │
        ▼
Customer leaves (hours, days, or weeks pass)
        │
        ▼
Customer makes a purchase (SaligPay webhook)
        │
        ▼
System looks up: who referred this customer?
        │
        ▼
   [ATTRIBUTION] → finds recent click by that affiliate
        │
        ▼
Conversion linked to click → referral link → affiliate
        │
        ▼
   [COMMISSION CREATED]
```

## How It Works

### 1. Customer Clicks Referral Link

An affiliate shares a link like `saligaffiliate.com/r/ABC123`. When clicked, `http.ts` handles the request.

### 2. Deduplication Key Generated

A `dedupeKey` is created to prevent counting the same person clicking repeatedly:

```
dedupeKey = IP address + referral code + hourly time window
```

### 3. Click Recorded (Fire-and-Forget)

The click is recorded **without blocking the redirect**. The customer is redirected immediately while the database write happens in the background:

```typescript
// Don't await — redirect happens immediately
ctx.runMutation(internal.clicks.trackClickInternal, { ... })
  .catch(error => console.error("Click tracking error:", error));
```

This ensures fast redirect performance (< 3 second response time).

### 4. Attribution Cookie Set

A cookie is placed on the customer's browser with affiliate attribution data:

```json
{
  "affiliateCode": "ABC123",
  "campaignId": "...",
  "timestamp": 1234567890
}
```

- **Default cookie duration**: 30 days
- **Configurable**: per-campaign cookie TTL
- **Purpose**: if customer returns later, the cookie attributes the purchase to the affiliate

### 5. Customer Purchases Later

When a conversion event arrives (SaligPay webhook or manual entry):

1. System checks the cookie for affiliate attribution
2. Falls back to looking up **recent clicks** for that affiliate within the attribution window
3. Links: conversion → click → referral link → affiliate → campaign
4. Commission is created with the campaign's rate/rules

## Deduplication Rules

Prevents inflating click counts with repeated clicks from the same person.

| Scenario | New Click? |
|----------|-----------|
| Same IP, same code, same hour | No (duplicate) |
| Same IP, same code, different hour | Yes |
| Different IP, same code | Yes |
| Same IP, different code | Yes |

**Dedupe key format**: `${ipAddress}:${referralCode}:${hourlyTimeWindow}`

The hourly time window is calculated as: `Math.floor(Date.now() / (1000 * 60 * 60))`

## Click Data Schema

Each click record stores:

| Field | Type | Purpose |
|-------|------|---------|
| `tenantId` | Id | Which SaaS owner |
| `referralLinkId` | Id | Which specific referral link was clicked |
| `affiliateId` | Id | Which affiliate gets credit |
| `campaignId` | Id (optional) | Which campaign for filtering |
| `ipAddress` | string | For deduplication + fraud detection |
| `userAgent` | string (optional) | Browser/device info |
| `referrer` | string (optional) | Traffic source (Google, Twitter, etc.) |
| `dedupeKey` | string | Unique key for deduplication |

**Indexes:**
- `by_tenant` — tenant's click history
- `by_referral_link` — clicks per link
- `by_affiliate` — clicks per affiliate (used for attribution lookup)
- `by_dedupe_key` — deduplication check

## Attribution Window

When a conversion arrives without a cookie, the system looks up recent clicks:

- **Default window**: 30 days (configurable per campaign)
- **Lookup**: finds the most recent click by the affiliate within the window
- **Limit**: checks last 20 clicks (optimization — clicks are ordered by time descending)
- **Campaign match**: if campaign is specified, only matches clicks for that campaign

## Metrics Powered by Clicks

| Metric | Where Used | Description |
|--------|-----------|-------------|
| Click count | Affiliate portal, owner dashboard | Total clicks per affiliate |
| Conversion rate | Reports | Purchases ÷ clicks |
| Campaign performance | Campaigns page | Clicks and conversions per campaign |
| Referrer analysis | Reports | Where clicks come from (Google, Twitter, etc.) |

## Key Files

| File | Responsibility |
|------|---------------|
| `convex/clicks.ts` | Click recording, deduplication, stats queries |
| `convex/http.ts` | Handles `/r/{code}` redirect, generates dedupeKey, fires tracking |
| `convex/conversions.ts` | Uses clicks for attribution when creating conversions |
| `convex/commissionEngine.ts` | Links clicks to commissions via attribution chain |

## Limitations

- **No bot detection** — clicks are deduplicated but not filtered for bot traffic
- **IP-based deduplication only** — VPN users sharing an IP in the same hour count as one click
- **Hourly granularity** — same person clicking twice 59 minutes apart = 1 click; 61 minutes apart = 2 clicks
- **No click-to-conversion time tracking** — we don't measure how long from click to purchase
