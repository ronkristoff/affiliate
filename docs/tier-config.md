# Tier Configuration Service

This document describes the tier configuration system implemented in Story 1.7.

## Overview

The tier configuration service provides centralized tier limit management for the platform. All tier enforcement uses this service for consistency.

## Default Tier Limits

| Feature | Starter | Growth | Scale |
|---------|---------|--------|-------|
| **Price** | $0/mo | $99/mo | $299/mo |
| **Max Affiliates** | 100 | 5,000 | Unlimited |
| **Max Campaigns** | 3 | 10 | Unlimited |
| **Max Team Members** | 5 | 20 | Unlimited |
| **Max Payouts/Month** | 10 | 100 | Unlimited |
| **Max API Calls** | 1,000 | 10,000 | Unlimited |
| **Custom Domain** | ❌ | ✅ | ✅ |
| **Advanced Analytics** | ❌ | ✅ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |

## Usage

### Backend (Convex)

```typescript
import { api } from "@/convex/_generated/api";

// Get tier configuration for a tenant
const config = await ctx.runQuery(api.tierConfig.getTierConfig, {
  tenantId: tenantId,
});

// Check limit for a resource type
const limitCheck = await ctx.runQuery(api.tierConfig.checkLimit, {
  tenantId: tenantId,
  resourceType: "affiliates",
});

// Enforce limit before creating a resource
await ctx.runMutation(api.tierConfig.enforceLimit, {
  tenantId: tenantId,
  resourceType: "campaigns",
});
```

### Frontend (React)

```typescript
import { useTierConfig, useCheckLimit } from "@/lib/tierConfig";

// Get tier configuration
const config = useTierConfig(tenantId);

// Check specific limit
const affiliateLimit = useCheckLimit(tenantId, "affiliates");

// Display warning if approaching limit
if (affiliateLimit.status === "warning") {
  return <WarningBanner />;
}
```

### UI Components

```typescript
import { TierLimitBanner, TierLimitIndicator } from "@/components/tier";

// Banner for warnings
<TierLimitBanner
  status={limitCheck.status}
  resourceType="affiliates"
  current={limitCheck.current}
  limit={limitCheck.limit}
  percentage={limitCheck.percentage}
  upgradePrompt={limitCheck.upgradePrompt}
/>

// Compact indicator
<TierLimitIndicator
  status={limitCheck.status}
  current={limitCheck.current}
  limit={limitCheck.limit}
/>
```

## API Reference

### Queries

#### `getTierConfig(tenantId)`
Returns the tier configuration for a tenant.

**Arguments:**
- `tenantId`: ID of the tenant

**Returns:**
```typescript
{
  tier: string;
  price: number;
  maxAffiliates: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxPayoutsPerMonth: number;
  maxApiCalls: number;
  features: {
    customDomain: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
}
```

#### `checkLimit(tenantId, resourceType)`
Check the current limit status for a resource type.

**Arguments:**
- `tenantId`: ID of the tenant
- `resourceType`: `"affiliates" | "campaigns" | "teamMembers" | "payouts" | "apiCalls"`

**Returns:**
```typescript
{
  status: "ok" | "warning" | "critical" | "blocked";
  percentage: number;
  current: number;
  limit: number;
  resourceType: string;
  upgradePrompt: boolean;
}
```

### Mutations

#### `enforceLimit(tenantId, resourceType)`
Enforces tier limits before resource creation. Throws if limit is exceeded.

**Arguments:**
- `tenantId`: ID of the tenant
- `resourceType`: Resource type to check

**Returns:**
```typescript
{
  allowed: boolean;
  current: number;
  limit: number;
}
```

## Limit Status Thresholds

| Status | Threshold | Behavior |
|--------|-----------|----------|
| **ok** | 0-79% | Normal operation |
| **warning** | 80-94% | Show warning banner, action allowed |
| **critical** | 95-99% | Show critical banner with upgrade prompt |
| **blocked** | 100%+ | Block resource creation, show upgrade CTA |

## Resource Types

The following resource types can be checked:

- `affiliates` - Number of affiliates
- `campaigns` - Number of campaigns
- `teamMembers` - Number of team members
- `payouts` - Number of payouts per month
- `apiCalls` - API calls (requires separate tracking)

## Integration

### RBAC Integration

The RBAC system in `convex/permissions.ts` can be integrated with tier limits. When creating resources:

1. Call `checkLimit` to verify the tenant has available capacity
2. If `status === "blocked"`, throw an error with upgrade message
3. Log the attempt in `auditLogs` table

### Example: Campaign Creation

```typescript
export const createCampaign = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    // Check tier limit
    const limitCheck = await ctx.runQuery(api.tierConfig.checkLimit, {
      tenantId,
      resourceType: "campaigns",
    });
    
    if (limitCheck.status === "blocked") {
      throw new Error(
        `You have reached the maximum number of campaigns (${limitCheck.limit}) for your plan. Please upgrade to create more.`
      );
    }
    
    // Proceed with creation
    // ...
  },
});
```

## Seeding Tier Configurations

Tier configurations are seeded automatically via the `seedTierConfigs` internal mutation. This is called during initial setup or can be invoked manually:

```typescript
await ctx.runMutation(internal.tierConfig.seedTierConfigs);
```

## Files

- `convex/tierConfig.ts` - Tier configuration service functions
- `src/lib/tierConfig.ts` - Client-side React hooks
- `src/components/tier/TierLimitBanner.tsx` - UI components
- `convex/schema.ts` - Database schema with tierConfigs table
