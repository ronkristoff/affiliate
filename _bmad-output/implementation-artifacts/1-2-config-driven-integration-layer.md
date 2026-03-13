# Story 1.2: Config-Driven Integration Layer

Status: done

## Story

As a **platform developer**,
I want a configurable integration layer that switches between mock and real SaligPay implementations,
so that the development team can test with mocks and production uses real integrations without code changes.

## Acceptance Criteria

1. **AC1: Integration Layer Location** — Integration layer is created at `src/lib/integrations/saligpay/`

2. **AC2: Development Mode Mock** — When environment is set to "development", all SaligPay calls use mock implementations

3. **AC3: Environment Variable Config** — Configuration is stored in environment variables (`INTEGRATION_MODE` or `NODE_ENV`)

4. **AC4: Production Mode Real** — When environment is set to "production", all SaligPay calls use real implementations

5. **AC5: Seamless Switch** — The switch between mock and real is seamless with no code changes required

6. **AC6: Helper Function** — Integration mode is accessible via `getIntegrationMode()` helper function

7. **AC7: Type Safety** — Both mock and real implementations share the same TypeScript interface

8. **AC8: Convex Environment** — Integration mode is also configurable via Convex environment variables

## Tasks / Subtasks

- [x] **Task 1: Create Integration Directory Structure** (AC: 1)
  - [x] 1.1 Create `src/lib/integrations/` directory
  - [x] 1.2 Create `src/lib/integrations/saligpay/` directory
  - [x] 1.3 Create barrel export file `src/lib/integrations/saligpay/index.ts`

- [x] **Task 2: Define SaligPay Interface Types** (AC: 7)
  - [x] 2.1 Create `src/lib/integrations/saligpay/types.ts` with shared interfaces
  - [x] 2.2 Define `SaligPayClient` interface with all required methods
  - [x] 2.3 Define request/response types for OAuth, webhooks, and API calls
  - [x] 2.4 Export types for use across the application

- [x] **Task 3: Implement Mock SaligPay Client** (AC: 2)
  - [x] 3.1 Create `src/lib/integrations/saligpay/mock-client.ts`
  - [x] 3.2 Implement `MockSaligPayClient` class implementing `SaligPayClient` interface
  - [x] 3.3 Add simulated OAuth flow methods
  - [x] 3.4 Add mock webhook generation methods
  - [x] 3.5 Add mock credential storage simulation
  - [x] 3.6 Add configurable delays to simulate network latency

- [x] **Task 4: Create Real SaligPay Client Stub** (AC: 4)
  - [x] 4.1 Create `src/lib/integrations/saligpay/real-client.ts`
  - [x] 4.2 Implement `RealSaligPayClient` class implementing `SaligPayClient` interface
  - [x] 4.3 Add placeholder methods for OAuth flow (Epic 14 implementation)
  - [x] 4.4 Add placeholder methods for webhook signature verification
  - [x] 4.5 Throw "Not implemented" errors for methods to be implemented in Epic 14

- [x] **Task 5: Implement Integration Mode Helper** (AC: 3, 6, 8)
  - [x] 5.1 Create `src/lib/integrations/saligpay/config.ts`
  - [x] 5.2 Implement `getIntegrationMode()` function
  - [x] 5.3 Add `isMockMode()` convenience function
  - [x] 5.4 Add `isRealMode()` convenience function
  - [x] 5.5 Support both `INTEGRATION_MODE` and `NODE_ENV` environment variables
  - [x] 5.6 Create Convex environment variable getter

- [x] **Task 6: Create Client Factory** (AC: 5)
  - [x] 6.1 Create `src/lib/integrations/saligpay/factory.ts`
  - [x] 6.2 Implement `createSaligPayClient()` factory function
  - [x] 6.3 Factory returns appropriate client based on integration mode
  - [x] 6.4 Export singleton instance via `getSaligPayClient()`

- [x] **Task 7: Add Environment Configuration** (AC: 3, 8)
  - [x] 7.1 Add `INTEGRATION_MODE` to `.env.example`
  - [x] 7.2 Document environment variable usage in comments
  - [x] 7.3 Set Convex environment variable via `pnpm convex env set INTEGRATION_MODE mock`
  - [x] 7.4 Create validation for valid mode values ("mock" | "real")

- [x] **Task 8: Code Review Fixes** (AC: All)
  - [x] 8.1 Implement Convex environment variable getter (AC8 fix)
  - [x] 8.2 Add input validation to factory options
  - [x] 8.3 Fix real-client stub consistency
  - [x] 8.4 Improve mock signature validation
  - [x] 8.5 Add custom error types
  - Note: Test framework not available - manual testing performed

### Review Follow-ups (AI) - RESOLVED ✅

Issues found and fixed during code review (kimi-k2.5):

- **[AI-Review][HIGH][FIXED]** Task 5.6: Convex environment variable getter
  - Added `getConvexIntegrationMode()`, `isConvexMockMode()`, `isConvexRealMode()` functions
  - File: `src/lib/integrations/saligpay/config.ts:39-83`

- **[AI-Review][MEDIUM][FIXED]** Missing input validation on factory options
  - Added `validateMockOptions()` function with type and range checks
  - File: `src/lib/integrations/saligpay/factory.ts:29-58`

- **[AI-Review][MEDIUM][FIXED]** Real client `getSaligPayApiUrl()` inconsistent
  - Changed to throw `SaligPayNotImplementedError` consistently
  - File: `src/lib/integrations/saligpay/real-client.ts:90-102`

- **[AI-Review][LOW][FIXED]** Mock signature validation too weak
  - Added format validation with pattern: `t=<timestamp>,v1=<64-char-hex>`
  - Added `generateMockSignature()` utility for testing
  - File: `src/lib/integrations/saligpay/mock-client.ts:177-213`

- **[AI-Review][LOW][FIXED]** Generic Error usage
  - Created `errors.ts` with custom error classes: `SaligPayError`, `SaligPayAuthError`, `SaligPayValidationError`, etc.
  - File: `src/lib/integrations/saligpay/errors.ts` (NEW)

## Dev Notes

### Critical Architecture Patterns

**Integration Layer Pattern:**
This story implements the **Strategy Pattern** where the integration mode determines which implementation (mock or real) is used at runtime. This enables:

1. **Development Testing** — Use mock SaligPay without real credentials
2. **Production Deployment** — Seamlessly switch to real SaligPay integration
3. **Epic 14 Preparation** — Real client stubs ready for actual implementation

**File Structure:**
```
src/lib/integrations/
├── saligpay/
│   ├── index.ts           # Barrel export
│   ├── types.ts           # Shared interfaces and types
│   ├── config.ts          # Integration mode helpers
│   ├── factory.ts         # Client factory
│   ├── mock-client.ts     # Mock implementation
│   └── real-client.ts     # Real implementation (stub for Epic 14)
```

**Environment Variable Strategy:**

The integration layer uses a **dual-environment approach**:

| Variable | Location | Purpose |
|----------|----------|---------|
| `NODE_ENV` | `.env.local` | Standard Next.js environment |
| `INTEGRATION_MODE` | `.env.local` + Convex env | Explicit integration control |

**Priority Order for Mode Detection:**
1. `INTEGRATION_MODE` (explicit override)
2. `NODE_ENV === 'production'` → real mode
3. Default → mock mode

### Type Definitions

**SaligPayClient Interface (types.ts):**
```typescript
// src/lib/integrations/saligpay/types.ts

export type IntegrationMode = 'mock' | 'real';

export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SaligPayClient {
  // OAuth Methods
  initiateOAuth(tenantId: string): Promise<string>; // Returns OAuth URL
  handleOAuthCallback(code: string, tenantId: string): Promise<OAuthCredentials>;
  refreshCredentials(refreshToken: string): Promise<OAuthCredentials>;
  
  // Credential Management
  getCredentials(tenantId: string): Promise<OAuthCredentials | null>;
  updateCredentials(tenantId: string, credentials: OAuthCredentials): Promise<void>;
  
  // Webhook Methods
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: string): SaligPayWebhookEvent;
  
  // API Methods (for Epic 14)
  getSubscription(subscriptionId: string): Promise<SubscriptionData>;
  getPayment(paymentId: string): Promise<PaymentData>;
}

export interface SaligPayWebhookEvent {
  id: string;
  type: 'payment.updated' | 'subscription.created' | 'subscription.updated' | 'subscription.cancelled';
  data: Record<string, unknown>;
  createdAt: number;
}

export interface SubscriptionData {
  id: string;
  status: string;
  // ... additional fields for Epic 14
}

export interface PaymentData {
  id: string;
  status: string;
  amount: number;
  // ... additional fields for Epic 14
}
```

**Config Helpers (config.ts):**
```typescript
// src/lib/integrations/saligpay/config.ts

import { IntegrationMode } from './types';

/**
 * Get the current integration mode.
 * Priority: INTEGRATION_MODE > NODE_ENV check > default 'mock'
 */
export function getIntegrationMode(): IntegrationMode {
  // Check explicit override first
  const explicitMode = process.env.INTEGRATION_MODE;
  if (explicitMode === 'mock' || explicitMode === 'real') {
    return explicitMode;
  }
  
  // Check NODE_ENV for production
  if (process.env.NODE_ENV === 'production') {
    return 'real';
  }
  
  // Default to mock for development/testing
  return 'mock';
}

export function isMockMode(): boolean {
  return getIntegrationMode() === 'mock';
}

export function isRealMode(): boolean {
  return getIntegrationMode() === 'real';
}
```

**Factory Pattern (factory.ts):**
```typescript
// src/lib/integrations/saligpay/factory.ts

import { SaligPayClient } from './types';
import { getIntegrationMode } from './config';
import { MockSaligPayClient } from './mock-client';
import { RealSaligPayClient } from './real-client';

let clientInstance: SaligPayClient | null = null;

/**
 * Create a SaligPay client based on the current integration mode.
 */
export function createSaligPayClient(): SaligPayClient {
  const mode = getIntegrationMode();
  
  if (mode === 'real') {
    return new RealSaligPayClient();
  }
  
  return new MockSaligPayClient();
}

/**
 * Get the singleton SaligPay client instance.
 * Creates the client on first call based on current integration mode.
 */
export function getSaligPayClient(): SaligPayClient {
  if (!clientInstance) {
    clientInstance = createSaligPayClient();
  }
  return clientInstance;
}

/**
 * Reset the client instance (useful for testing).
 */
export function resetSaligPayClient(): void {
  clientInstance = null;
}
```

### Mock Client Implementation Notes

**MockSaligPayClient Features:**
- In-memory credential storage (Map-based)
- Simulated OAuth flow with configurable tokens
- Deterministic webhook event generation for testing
- Configurable response delays (default: 100-500ms)
- Console logging for debugging mock interactions

**Mock Data Patterns:**
```typescript
// Example mock credential storage
const mockCredentials = new Map<string, OAuthCredentials>();

// Example mock OAuth URL generation
initiateOAuth(tenantId: string): Promise<string> {
  return Promise.resolve(
    `https://mock-saligpay.example.com/oauth?tenant=${tenantId}&state=mock-state`
  );
}
```

### Real Client Stub Notes

**RealSaligPayClient Stubs:**
- All methods throw `new Error("Not implemented - Epic 14")` 
- This prevents accidental mock usage in production
- Epic 14 will implement actual SaligPay API calls
- Interface is complete for type checking

### Convex Environment Integration

For Convex functions that need to know the integration mode:

```typescript
// In Convex functions, access via ctx
// Set via: pnpm convex env set INTEGRATION_MODE mock

// Example Convex action using integration mode
export const processWebhook = action({
  args: { payload: v.string(), signature: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Integration mode can be checked via environment
    // Real implementation in Epic 14
    return null;
  },
});
```

### Project Structure Notes

**Alignment with Existing Architecture:**
- Follows pattern from `src/lib/auth.ts` for configuration
- Integrates with existing `src/lib/` utilities
- Does NOT modify `convex/` directory (that's Story 1.1)
- Creates new integration-specific directory under `src/lib/`

**Naming Conventions:**
- Directory: `integrations` (lowercase, plural)
- Files: kebab-case (e.g., `mock-client.ts`)
- Classes: PascalCase (e.g., `MockSaligPayClient`)
- Functions: camelCase (e.g., `getIntegrationMode`)

### Previous Story Intelligence

**From Story 1.1 (Convex Schema Foundation):**
- Schema defines `tenants.saligPayCredentials` for encrypted credential storage
- `rawWebhooks` table stores webhook events with `source: "saligpay"`
- Multi-tenant isolation via `tenantId` applies to credentials
- Integration layer will use schema tables for credential persistence

**Key Learnings to Apply:**
- Use TypeScript strict mode for all files
- Export types separately for clean imports
- Follow established project patterns from architecture.md

### Git Intelligence

**Recent Commits:**
- `293e6a3` - Initial project setup with Next.js, Convex, Better Auth
- `fecd8ed` - Initial commit

**No Prior Integration Work:**
- This is the first integration layer implementation
- No existing patterns to follow or avoid
- Clean slate for establishing best practices

### Latest Tech Information

**Environment Variable Best Practices (2026):**

1. **Type-Safe Configuration** — Use Zod for environment validation:
   ```typescript
   import { z } from 'zod';
   
   const envSchema = z.object({
     INTEGRATION_MODE: z.enum(['mock', 'real']).optional(),
     NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
   });
   ```

2. **Server-Only Variables** — Integration mode is server-only (no `NEXT_PUBLIC_` prefix)

3. **Runtime Configuration** — Environment is read at runtime, not build time

4. **Convex Environment** — Use `pnpm convex env set` for Convex-side configuration

### Anti-Patterns to Avoid

❌ **DO NOT** expose integration mode to client-side code
❌ **DO NOT** hardcode mode values in multiple places
❌ **DO NOT** skip the factory pattern (direct client instantiation)
❌ **DO NOT** forget to implement the full `SaligPayClient` interface in both clients
❌ **DO NOT** use `any` types — maintain strict type safety
❌ **DO NOT** make mock client identical to real client (mocks should be predictable)
❌ **DO NOT** forget to reset singleton in tests

## References

- [Source: architecture.md#Integration Points] - SaligPay integration patterns
- [Source: architecture.md#Infrastructure & Deployment] - Environment configuration
- [Source: architecture.md#API & Communication Patterns] - Action functions for external APIs
- [Source: project-context.md#Environment Variables] - Dual environment requirement
- [Source: epics.md#Story 1.2] - Full acceptance criteria
- [Source: Story 1.1] - Schema foundation for credential storage

## Dev Agent Record

### Agent Model Used

minimax-m2.5

### Debug Log References

- Implemented Strategy Pattern for mock/real client switching
- Used singleton pattern for client factory
- Added configurable response delays for mock client

### Completion Notes List

- **Implemented:** Complete config-driven integration layer following Strategy pattern
- **Files Created:** 7 TypeScript files in src/lib/integrations/saligpay/
- **Environment:** Set INTEGRATION_MODE=mock in Convex via `pnpm convex env set`
- **Type Safety:** Full TypeScript interfaces for both mock and real clients
- **Testing:** Cannot implement tests - project has no test framework configured
- **Note:** Real client throws "Not implemented" errors as specified for Epic 14
- **Code Review:** Completed by kimi-k2.5 on 2026-03-12 - All HIGH and MEDIUM issues resolved

### File List

- `src/lib/integrations/saligpay/index.ts` — Barrel export for integration layer
- `src/lib/integrations/saligpay/types.ts` — Shared TypeScript interfaces
- `src/lib/integrations/saligpay/errors.ts` — Custom error classes (added in review)
- `src/lib/integrations/saligpay/config.ts` — Integration mode helpers with Convex support
- `src/lib/integrations/saligpay/factory.ts` — Client factory with input validation
- `src/lib/integrations/saligpay/mock-client.ts` — Mock implementation with signature validation
- `src/lib/integrations/saligpay/real-client.ts` — Real implementation stub (Epic 14 placeholder)
- `.env.example` — Added with INTEGRATION_MODE documentation

**Files Modified (from Story 1.1):**
- `convex/schema.ts` — Multi-tenant schema foundation (not part of this story but visible in git)
