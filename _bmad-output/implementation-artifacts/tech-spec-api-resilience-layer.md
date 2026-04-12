---
title: "API Resilience Layer — Circuit Breakers, Rate Limiting & Graceful Degradation"
slug: "api-resilience-layer"
created: "2026-04-12"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Convex 1.32.0", "TypeScript 5.9.3", "Next.js 16.1.0", "React 19.2.3", "Vitest", "Zod 4.1.12", "@convex-dev/resend 0.2.3", "Postmark", "Radix UI"]
files_to_modify: [
  "convex/schema.ts",
  "convex/crons.ts",
  "convex/http.ts",
  "convex/broadcasts.tsx",
  "convex/tenants.ts",
  "convex/clicks.ts",
  "convex/conversions.ts",
  "convex/emailService.ts",
  "convex/tenantStats.ts",
  "convex/dashboard.ts",
  "convex/rateLimit.ts",
  "docs/scalability-guidelines.md",
  "AGENTS.md",
]
files_to_create: [
  "convex/lib/errorClassification.ts",
  "convex/lib/circuitBreaker.ts",
  "convex/lib/rateLimiter.ts",
  "convex/lib/gracefulDegradation.ts",
  "convex/circuitBreakers.ts",
  "convex/rateLimits.ts",
  "convex/circuitBreaker.test.ts",
  "convex/rateLimiter.test.ts",
  "convex/gracefulDegradation.test.ts",
]
code_patterns: [
  "Circuit breaker: idempotent mutations (recordFailure/recordSuccess); TOCTOU caveat in withCircuitBreaker wrapper (acceptable — extra failures recorded, no data corruption)",
  "Rate limiter: two-tier design (query for read path, mutation for write) — avoids write amplification on high-volume endpoints",
  "Error classification: single source of truth in convex/lib/errorClassification.ts — shared by circuitBreaker.ts and gracefulDegradation.ts",
  "Graceful degradation: frontend useDegradedQuery hook for query fallback (Convex queries cannot call mutations); withDegradation for action/httpAction context",
  "Email service has two paths: emailService.ts (action, full provider routing) and emailServiceMutation.ts (mutation, Resend-only inline)",
  "Webhook processing: rawWebhooks table (NOT rawEvents) — store-first pattern already partially implemented",
  "Existing retry: broadcasts use Promise.allSettled + exponential backoff (5s/10s/20s, max 3 retries) via scheduler",
  "DNS verification: fetch(dns.google) with 10s AbortController timeout, audit-log-based rate limiting (inefficient, to replace)",
  "Click dedup: by_dedupe_key index (IP+affiliate+hour hash) — complementary to rate limiting, not a replacement",
  "Observability: all resilience events → auditLogs table (action, entityType, entityId, metadata pattern)",
  "New Convex function syntax required: export const fn = query/mutation/action({ args, returns, handler })",
  "Validators required on ALL functions (args + returns) using v.* from convex/values",
  "No dynamic imports in queries/mutations (V8 runtime) — only actions/httpActions support await import()",
  "Return validators must match ALL actual return fields including computed/alias fields",
]
test_patterns: [
  "Vitest: describe/it/expect/vi.beforeEach pattern",
  "28 existing .test.ts files in convex/ — mostly placeholder tests (expect(true).toBe(true))",
  "rateLimit.test.ts: integration-style placeholder tests — new tests should be more rigorous",
  "Convex tests mock ctx.db with vi.fn() — see clicks.test.ts, fraudSignals.test.ts for patterns",
  "Test file naming: convex/{module}.test.ts (same directory as source file)",
  "Run tests: pnpm vitest run convex/{module}.test.ts",
  "Circuit breaker tests: all 3 states (closed/open/half-open), threshold boundary, reset timeout, max-open-duration, concurrent probe exclusion",
  "Rate limiter tests: under limit, at limit, over limit, window reset, per-tenant isolation, missing doc handling",
  "Graceful degradation tests: infrastructure error→fallback, auth error→throw, degraded response shape (_degraded flag), stale data indicator",
]
---

# Tech-Spec: API Resilience Layer — Circuit Breakers, Rate Limiting & Graceful Degradation

**Created:** 2026-04-12

## Overview

### Problem Statement

Salig-affiliate has no centralized resilience infrastructure. External service calls (email via Postmark, payment webhooks via SaligPay/Stripe, DNS verification) have no circuit breakers — if they fail, the system either hangs on timeouts or throws unhandled errors with no recovery path. Public API endpoints (click tracking, conversion tracking, coupon validation) have no rate limiting beyond login-specific lockout (`convex/rateLimit.ts` is email-only, non-reusable). Multiple past specs have deferred rate limiting as a follow-up item (broadcast emails, bulk operations, DNS verification, CSV export, coupon validation). There is no graceful degradation pattern — when enhanced queries compute heavy joins across tables or external services fail, users see errors instead of degraded-but-functional UI. As the platform scales with more tenants and higher traffic, the lack of resilience patterns becomes a reliability risk.

**Critical gap:** There is no observability layer for service health. If external services degrade silently, SaaS owners have no visibility — the system appears healthy while email notifications fail, webhooks go unprocessed, or queries return stale data. Silent degradation is worse than visible failure.

### Solution

Build a reusable resilience layer with three patterns plus observability:

1. **Circuit Breaker** — State machine (Closed → Open → Half-Open) for external service calls. Tracks failure counts per service in a Convex `circuitBreakers` table. When failure threshold is reached, trips to Open state and returns safe fallback immediately. After configurable reset timeout, transitions to Half-Open to probe with a single request (atomically — only one concurrent probe allowed). Automatic recovery to Closed on success. Includes max-open-duration override to prevent permanent Open state if Half-Open probes repeatedly fail.

2. **Generalized Rate Limiter** — Reusable `convex/lib/rateLimiter.ts` module supporting per-tenant, per-IP, and per-endpoint limits with sliding TTL windows. Uses a `rateLimits` table for state with a `by_expiresAt` index for efficient cleanup. Rate limit keys are constructed server-side (never from client-provided values). Integrates into public API endpoints (click tracking, conversion tracking, coupon validation, broadcast creation, bulk operations, CSV export). Login rate limiting stays separate (Better Auth plugin + existing `rateLimit.ts` have unique lockout semantics).

3. **Graceful Degradation Wrappers** — Utility functions that wrap external service calls and heavy queries with try/catch + safe fallbacks. **Error classification:** degradation wrappers must NOT swallow auth errors, validation errors, or data integrity errors — only infrastructure/timeout/network errors trigger fallback. External calls return cached/default responses on failure. Enhanced queries fall back to simpler cached versions (e.g., `tenantStats` reads instead of full table scans). All degraded responses include a `_degraded: true` flag so UI components can surface staleness indicators.

4. **Observability Layer** — Every circuit breaker state change, rate limit event, and degradation fallback writes to `auditLogs` with structured metadata. Degradation counters tracked in `tenantStats` (extend existing table). SaaS owner dashboard surfaces service health status (banner/alert for active degradation).

### Scope

**In Scope:**
- Circuit breaker infrastructure: state table, state machine logic, per-service configuration, max-open-duration override, atomic Half-Open probe
- Generalized rate limiter: reusable module, `rateLimits` table with `by_expiresAt` index, per-tenant/per-IP/per-endpoint limits, TTL window management, server-side key construction rules, paginated cron cleanup
- Graceful degradation wrappers for external service calls (email sending, DNS verification)
- Graceful degradation for heavy Convex queries (fallback to tenantStats reads)
- Error classification: infrastructure errors trigger degradation; auth/validation/integrity errors still throw
- Degradation response format: `_degraded: true` flag + staleness metadata for UI consumption
- Observability: audit logging for all resilience events, degradation counters in tenantStats, dashboard health indicator
- Integration into existing hot paths: click tracking, conversion tracking, coupon validation, broadcast emails, webhook processing, DNS verification, CSV export
- Store-first-process-later pattern for webhook HTTP actions (save to `rawWebhooks` table immediately, return 200, process asynchronously) — already partially implemented in `convex/http.ts`
- **Prerequisite refactor:** `verifyDomainDns` must be converted from `mutation` to `action` before circuit breaker integration (mutations cannot call `fetch()` in Convex V8 runtime)
- **Fix existing unbounded `.collect()`:** `convex/rateLimit.ts` `cleanupOldAttempts` uses unbounded `.collect()` — refactor to indexed pagination as part of this spec
- Update `docs/scalability-guidelines.md` and `AGENTS.md` with resilience patterns

**Out of Scope:**
- Login-specific rate limiting (already handled by Better Auth `rateLimit` plugin + `convex/rateLimit.ts`)
- DDoS protection at infrastructure/CDN level
- New business logic or feature development
- Changes to existing `tenantStats` counter system (covered by scalability audit spec)
- Email retry queue (deferred — noted as follow-up dependency; current scope logs failures for manual retry)

## Context for Development

### Codebase Patterns

- Convex functions use `query`, `mutation`, `action`, `httpAction` from `convex/_generated/server`
- External service calls happen in `action` and `httpAction` functions (Node.js runtime) — NOT in queries/mutations
- `convex/rateLimit.ts` is login-specific (email-based lockout using `loginAttempts` table) — NOT reusable
- Better Auth `rateLimit()` plugin covers auth endpoints only — configured in `convex/auth.ts`
- `convex/tenantStats.ts` provides O(1) aggregate reads for dashboard stats — ideal degradation target
- `docs/scalability-guidelines.md` codifies `.collect()` caps and counter hooks — resilience patterns should be added here
- Existing retry pattern in `convex/broadcasts.tsx`: batch email sending with `Promise.allSettled` + exponential backoff (5s/10s/20s, max 3 retries) via `ctx.scheduler.runAfter()`
- Multiple specs have "consider rate limiting" as deferred items — this spec addresses those debts
- Webhook processing in `convex/http.ts`: always returns HTTP 200 even on error (prevents provider retries); uses `rawWebhooks` table (NOT `rawEvents`) for store-first; atomic dedup via `ensureEventNotProcessed`
- Email service: two paths — `emailService.ts` (`sendEmail` action, full Postmark+Resend routing) and `emailServiceMutation.ts` (`sendEmailFromMutation` mutation, Resend-only inline for mutation context)
- DNS verification in `tenants.ts`: `fetch(dns.google)` with 10s `AbortController` timeout; rate limiting via audit-log scan (inefficient — to be replaced). **WARNING:** `verifyDomainDns` is currently a `mutation` calling `fetch()` — this violates Convex V8 runtime rules (mutations cannot make HTTP calls). Must be refactored to an `action` as a prerequisite (Task 0).
- Click tracking: dedup via `by_dedupe_key` index (IP+affiliate+hour hash), `.take(1200)` cap on stats queries, no external calls
- Conversion tracking: no rate limiting, fire-and-forget patterns for fraud signals/lead creation/email scheduling; `findConversionBySubscriptionIdInternal` has unbounded `.collect()` (violates scalability rules)
- `convex/crons.ts`: 10 active cron jobs; `cleanupOldAttempts` runs hourly (uses unbounded `.collect()` — needs indexed pagination). Note: existing codebase uses `crons.weekly()` for one job (line 32) which violates AGENTS.md rule — new cron jobs should use `crons.interval()` only
- `project-context.md`: 19 critical rules including new function syntax, validators required, no dynamic imports in queries/mutations, return validators must match all fields

### Files to Reference

| File | Purpose | Investigation Notes |
| ---- | ------- | ------------------- |
| `convex/schema.ts` | Database schema — new tables needed | `loginAttempts` at line 567, `rawWebhooks` at line 478, `auditLogs` at line 451 — use as reference for table/index patterns |
| `convex/rateLimit.ts` | Existing login-specific rate limiter | Reference only — NOT to be replaced. Uses `loginAttempts` table, `by_email` index |
| `convex/emailService.ts` | Email action (Postmark+Resend routing) | Circuit breaker target: `sendEmail` internalAction (line 53). External calls at lines 101 (Postmark) and 120 (Resend) |
| `convex/emailServiceMutation.ts` | Email from mutation context (Resend-only) | Lower priority for circuit breaker — inline Resend call, no external HTTP in most cases |
| `convex/broadcasts.tsx` | Bulk email sending | Lines 253-489: `sendBroadcastEmails` action. Uses `Promise.allSettled`, 100/batch, 100ms delay, exponential backoff. Needs circuit breaker on `emailService.sendEmail` calls |
| `convex/http.ts` | All HTTP endpoints | Webhooks always return 200. No rate limiting on ANY public endpoint. `/track/conversion`, `/track/validate-coupon` need rate limits. `rawWebhooks` table used for store-first |
| `convex/tenants.ts` | DNS verification | Lines 1797-1930: `verifyDomainDns` — **currently a mutation calling `fetch()`, which violates Convex V8 rules. Must refactor to `action` before adding circuit breaker.** Audit-log-based rate limiting (replace with proper rate limiter). Circuit breaker candidate |
| `convex/clicks.ts` | Click tracking | No external calls. Dedup by `by_dedupe_key`. Rate limit needed on `trackClickInternal` (per referral code + global IP) |
| `convex/conversions.ts` | Conversion tracking | No external calls. Fire-and-forget patterns. `findConversionBySubscriptionIdInternal` (line 1196) has unbounded `.collect()` |
| `convex/crons.ts` | Cron job definitions (10 active jobs) | `cleanupOldAttempts` runs hourly — needs extension or companion for `rateLimits` cleanup. Must use indexed pagination. Note: file is `crons.ts` (plural) |
| `convex/tenantStats.ts` | O(1) aggregate reads | `getOrCreateStats` (line 21) lazy-creates stats docs. `getStats` (line 95) public query with `?? 0` defaults. Extend with degradation counters |
| `convex/dashboard.ts` | Dashboard queries | Graceful degradation target — heavy queries fall back to `tenantStats` reads |
| `docs/scalability-guidelines.md` | Existing scalability rules | Add resilience patterns section: circuit breaker usage, rate limit integration, graceful degradation wrappers |
| `AGENTS.md` | Developer guidelines | Add resilience patterns to engineering principles and code style sections |
| `_bmad-output/project-context.md` | AI agent rules | 19 rules — all new code must comply (new function syntax, validators, no dynamic imports in q/m, etc.) |

### Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Circuit breaker state storage | Convex `circuitBreakers` table (per-service docs) | Persisted across invocations; queryable; follows Convex patterns |
| Circuit breaker mutation design | Idempotent `recordFailure` / `recordSuccess` mutations (not read-then-act) | Avoids TOCTOU race conditions within a single mutation. **Known limitation:** the `withCircuitBreaker` wrapper reads state via query then decides via action logic — this creates a TOCTOU window across action→query→mutation boundary. Two concurrent actions could both see "closed" and both call the external service. This is acceptable because: (a) the failure threshold has margin, (b) the worst case is extra failures being recorded, not data corruption, (c) the mutation-level operations are still atomic |
| Circuit breaker state field type | `v.literal()` discriminated union (not `v.string()`) | Prevents typos like "opne" from being silently accepted |
| Circuit breaker Half-Open | Atomic transition to "probing" state — only one concurrent probe allowed | Prevents multiple probe requests overwhelming a recovering service |
| Circuit breaker max-open-duration | Force Half-Open after configurable max duration (e.g., 30 min) even if probes keep failing | Prevents permanent Open state when service has intermittent failures |
| Rate limiter approach | Two-tier: `query` for read-only check + `mutation` for increment | Avoids write amplification on every request. The `getRateLimitStatus` query checks current count without writing. Only `incrementRateLimit` mutation writes. For high-volume endpoints (clicks, conversions), the query-only path avoids per-request DB writes |
| Rate limiter check flow | Check via query first → if under limit, proceed → increment via mutation asynchronously or in same call | Read path is free (no write). Write only happens for requests that pass the check. This reduces write volume by ~50% compared to check-and-increment in single mutation |
| Rate limit cleanup | Indexed `by_expiresAt` + paginated cron (NOT table scan) | Avoids 1MB transaction limit on cleanup; follows scalability guidelines |
| Rate limit key construction | Server-side only; auth endpoints use `tenantId` from Convex context; public endpoints use `IP` from `req.headers.get('x-forwarded-for')` in `httpAction` context (Convex's deployment provides this header) | Prevents IP spoofing via client headers. Exact extraction: `const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'` |
| Rate limit isolation | Per-tenant for owner-facing APIs; global for shared infra (clicks/conversions); composite `tenantId:userId` for user-facing endpoints | Prevents noisy neighbor tenants; protects shared tracking; prevents sub-user quota exhaustion |
| Login rate limiting | Keep separate (Better Auth plugin + existing `convex/rateLimit.ts`) | Unique lockout semantics (15-min cooldown, email-based); different UX requirements |
| Graceful degradation for queries | Frontend-side fallback: catch query errors in React components, fall back to simpler `tenantStats` query | Convex `query` functions cannot call mutations (for audit logs) or other queries as fallbacks. Degradation must happen on the frontend. Create a `useDegradedQuery` hook that catches errors and falls back to `tenantStats` |
| Graceful degradation error classification | Infrastructure/timeout/network errors → degrade; auth/validation/integrity errors → still throw | Prevents degradation from hiding security issues or data corruption |
| Degradation response format | `{ ...data, _degraded: true, _degradedAt: timestamp, _fallbackReason: string }` | UI can detect and surface staleness; enables observability |
| Frontend type union for degradation | All query return types that support degradation must use `T | DegradedResponse<T>` on frontend | Frontend components check `_degraded` field to discriminate between normal and degraded responses |
| Circuit breaker granularity | Per-service (not per-tenant) | External services fail globally (e.g., Postmark down affects all tenants) |
| Webhook processing pattern | Store-first (save to `rawWebhooks`, return 200 immediately) then process asynchronously | Prevents Stripe/SaligPay retry storms; enables recovery after circuit breaker resets. Already partially implemented in `convex/http.ts` |
| Observability | All resilience events → `auditLogs` + degradation counters in `tenantStats` | SaaS owners need visibility into service health; silent degradation is unacceptable |
| DNS verification refactor | Convert `verifyDomainDns` from `mutation` to `action` before adding circuit breaker | Convex mutations cannot call `fetch()` (V8 runtime). Current code violates this — must fix as prerequisite |
| Email circuit breaker fallback shape | `{ success: false, provider: "postmark"\|"resend", messageId: undefined }` | Must match existing `sendEmail` return type validator: `{ success: v.boolean(), provider: v.string(), messageId: v.optional(v.string()) }` |
| Click tracking rate limit latency budget | Merge rate limit increment into click creation mutation (not separate round-trip) | Two-tier design added ~150ms overhead (query + click + increment = 3 round-trips). Batching increment into click mutation reduces to 2 round-trips (~100ms overhead). Acceptable for tracking pixel. |
| Admin circuit breaker reset | `resetCircuitBreaker(serviceId)` internalMutation (admin-only) | Escape hatch for ops when automatic recovery isn't fast enough. Must verify caller has platform admin role. |
| useDegradedQuery error detection | Check `useQuery` `.error` property (NOT try/catch) | `useQuery` never throws — errors are in the return object's `error` field. This was the #1 pre-mortem finding. |
| Degradation cooldown | 30-second cooldown before retrying enhanced query after degradation | Prevents infinite re-render loops and query thrashing during transient outages. Uses `useRef<number>` for timestamp tracking. |
| incrementRateLimit safety | Optional `limit` param for safety net; upsert pattern for missing docs; minimum window guard (1000ms) | Prevents accidental misuse (calling without prior check), handles race conditions (doc created between query and mutation), prevents misconfiguration (0ms window → instant expiry) |

### Rate Limit Key Construction Rules (Per Endpoint)

| Endpoint | Key Pattern | Rationale |
|----------|------------|-----------|
| Click tracking (`/track/click`) | `click:{referralCode}` + global `click:ip:{IP}` | Per-campaign isolation + per-IP global cap; prevents bot from rotating codes |
| Conversion tracking (`/track/conversion`) | `conversion:{tenantId}` + global `conversion:ip:{IP}` | Per-tenant cap + per-IP global cap |
| Coupon validation (`validateCouponCode`) | `coupon:{tenantId}` | Per-tenant — prevents enumeration but doesn't block legitimate shoppers |
| Broadcast creation (`createBroadcast`) | `broadcast:{tenantId}` | Per-tenant — one broadcast per 5 min (existing pattern) |
| Bulk operations (`bulkApprove/bulkReject`) | `bulk:{tenantId}` | Per-tenant — max 50 per request (existing pattern) |
| CSV export | `export:{tenantId}` | Per-tenant — max 3 concurrent (existing pattern) |
| DNS verification (`verifyDomainDns`) | `dns:{tenantId}` | Per-tenant — max 5 per minute (existing pattern) |

### Error Classification for Graceful Degradation

| Error Category | Examples | Action |
|---------------|----------|--------|
| **Degrade** (infrastructure) | Network timeout, HTTP 5xx, connection refused, DNS resolution failure, service unavailable | Return fallback; log to auditLogs |
| **Throw** (auth/security) | Unauthorized, forbidden, invalid token, CSRF failure | Always throw; never degrade — security issues must be visible |
| **Throw** (validation) | Invalid input, missing required fields, schema validation failure | Always throw — caller needs to fix their request |
| **Throw** (data integrity) | Document not found when required, constraint violation, inconsistent state | Always throw — data corruption must not be hidden |

## Implementation Plan

### Tasks

#### Phase 0: Prerequisites — Fix Existing Violations

- [ ] **Task 0: Refactor `verifyDomainDns` from mutation to action + frontend migration**
  - File: `convex/tenants.ts`
  - Action: `verifyDomainDns` (lines ~1797-1930) is currently a `mutation` that calls `fetch(dns.google)` — this violates Convex V8 runtime rules (mutations cannot make HTTP calls). Refactor:
    1. Convert `verifyDomainDns` from `mutation` to `action`
    2. **N2: Frontend migration checklist** — search entire codebase for all callers and update:
       - Replace `useMutation(api.tenants.verifyDomainDns)` with `useAction` or `useConvex` action call
       - Replace `ctx.runMutation(api.tenants.verifyDomainDns, ...)` with `ctx.runAction(api.tenants.verifyDomainDns, ...)`
       - Update TypeScript type annotations that reference `FunctionReference<"mutation", ...>` for this function
       - Verify the function's args/returns validators are preserved during conversion
    3. Verify no other mutations in the file call `fetch()` — if found, convert those too
    4. **Action is non-transactional** — document that if the action fails midway (e.g., writes audit log then fails on fetch), the audit log persists but no verification result is recorded. This is acceptable because audit logs are append-only.
  - Notes: This is a prerequisite for Task 13 (circuit breaker on DNS verification). The existing `fetch()` call likely works because Convex may not strictly enforce this in development, but it will fail in production. **Critical:** Frontend callers MUST be migrated — `useMutation` does NOT work with actions (returns `undefined` silently).

#### Phase 1: Foundation — Schema & Core Modules

- [ ] **Task 1: Add `circuitBreakers` and `rateLimits` tables to schema**
  - File: `convex/schema.ts`
  - Action: Add two new tables after `loginAttempts` (line ~573):
    ```typescript
    circuitBreakers: defineTable({
      serviceId: v.string(),        // e.g. "postmark", "dns-google", "stripe"
      state: v.union(                // F17: use literal union, NOT v.string()
        v.literal("closed"),
        v.literal("open"),
        v.literal("half-open"),
        v.literal("probing"),
      ),
      failureCount: v.number(),      // consecutive failures in current window
      lastFailureAt: v.optional(v.number()),
      lastSuccessAt: v.optional(v.number()),
      openedAt: v.optional(v.number()),        // when state went to "open"
      lastProbeAt: v.optional(v.number()),     // when last half-open probe ran
      config: v.object({                       // per-service overrides
        failureThreshold: v.optional(v.number()),
        resetTimeoutMs: v.optional(v.number()),
        maxOpenDurationMs: v.optional(v.number()),
      }),
    }).index("by_serviceId", ["serviceId"]);

    rateLimits: defineTable({
      key: v.string(),             // composite key: "endpoint:identifier" (e.g. "click:ABC123")
      count: v.number(),           // current count in window
      windowStart: v.number(),     // window start timestamp (ms)
      windowDurationMs: v.number(), // window duration (ms)
      expiresAt: v.number(),       // absolute expiry for cleanup cron
    }).index("by_key", ["key"])
      .index("by_expiresAt", ["expiresAt"]);
    ```
  - Notes: Follow existing table/index patterns from `loginAttempts` (line 567). `circuitBreakers` is per-service (not per-tenant). `rateLimits` uses `by_expiresAt` index for efficient cron cleanup.

- [ ] **Task 2: Create circuit breaker mutations and query**
  - File: `convex/circuitBreakers.ts` (new)
  - Action: Implement 5 Convex functions using new function syntax:
    1. `getServiceState(serviceId)` — internalQuery: returns current state doc or null
    2. `recordFailure(serviceId, config?)` — internalMutation: atomically increment failure count, check threshold, transition to "open" if exceeded, write auditLog on state change
    3. `recordSuccess(serviceId)` — internalMutation: reset failure count, transition to "closed", write auditLog on state change
    4. `tryAcquireProbe(serviceId)` — internalMutation: atomically transition "half-open" → "probing" (only one caller succeeds), return whether probe was acquired
    5. `forceHalfOpen(serviceId)` — internalMutation: if state is "open" and `openedAt + maxOpenDurationMs < now`, transition to "half-open"
    6. **N5: `resetCircuitBreaker(serviceId)`** — internalMutation: unconditionally reset state to "closed", failureCount to 0, clear openedAt/lastProbeAt. **Admin-only — for ops recovery after fixing root cause.** Must be called from an admin action that verifies the caller has platform admin role.
  - Notes: All mutations are idempotent — no read-then-act across action/mutation boundary. Default config: `failureThreshold: 5`, `resetTimeoutMs: 60000` (1 min), `maxOpenDurationMs: 1800000` (30 min). Use `ctx.db.patch()` for updates. Each state change writes to `auditLogs` with action `"CIRCUIT_BREAKER_STATE_CHANGE"`. **N5:** The `resetCircuitBreaker` function is an escape hatch for when the automatic recovery (max-open-duration) isn't fast enough or when the service was fixed but the breaker needs manual reset.

- [ ] **Task 3: Create shared error classification module + circuit breaker helper**
  - File: `convex/lib/errorClassification.ts` (new) — **F12: single source of truth for error classification**
  - Action: Create a shared module with:
    1. `ErrorCategory` type: `"infrastructure" | "auth" | "validation" | "integrity"`
     2. `classifyError(error): ErrorCategory` — classifies errors based on properties. **N8: Must handle Convex `FunctionError` wrapping** — Convex wraps all function errors in `FunctionError` with `message` and `cause` properties. Classification priority:
       - **Primary:** `error.status` or `error.cause?.status` (HTTP status code) — 5xx → infrastructure, 401/403 → auth, 400/422 → validation
       - **Secondary:** `error.name` or `error.cause?.name` — "TimeoutError", "AbortError", "ConnectError" → infrastructure; "ConvexError" with specific code → map to category
       - **Tertiary:** `error.message` or `error.cause?.message` — string pattern matching for known error formats (last resort, fragile)
       - **Convex-specific:** `error.code` (Convex error codes like "RATE_LIMIT", "INVALID_ARGUMENT") — map to appropriate category
       - **Important:** `errorClassification.ts` must have ZERO imports from other project modules (pure utility only) — prevents circular dependencies
    3. `isInfrastructureError(error): boolean` — convenience wrapper returning `classifyError(error) === "infrastructure"`
  - File: `convex/lib/circuitBreaker.ts` (new)
  - Action: Create circuit breaker helper module that imports from `errorClassification.ts`:
    1. `CircuitBreakerConfig` type (failureThreshold, resetTimeoutMs, maxOpenDurationMs)
    2. `DEFAULT_CONFIG` constant
    3. `SERVICE_IDS` constant (known services: "postmark", "resend", "dns-google", "stripe")
    4. `withCircuitBreaker<T>(ctx, serviceId, fn, fallback, config?)` — action-level wrapper:
       - Calls `ctx.runQuery(internal.circuitBreakers.getServiceState, { serviceId })`
       - If "open": calls `ctx.runMutation(internal.circuitBreakers.forceHalfOpen, ...)`, if still open → return fallback
       - If "half-open": calls `ctx.runMutation(internal.circuitBreakers.tryAcquireProbe, ...)`, if acquired → run fn, on success call `recordSuccess`, on failure call `recordFailure` + return fallback; if not acquired → return fallback
       - If "closed" or "probing": run fn, on success call `recordSuccess`, on failure call `recordFailure` + return fallback
       - **F8 TOCTOU caveat:** Between the query and the external call, another action may have changed state. The worst case is extra failures recorded — acceptable because the threshold has margin and no data corruption occurs.
  - Notes: `errorClassification.ts` is imported by both `circuitBreaker.ts` and `gracefulDegradation.ts` — single source of truth. The `withCircuitBreaker` wrapper is designed for `action` and `httpAction` context only (not queries/mutations).

- [ ] **Task 4: Create circuit breaker tests**
  - File: `convex/circuitBreaker.test.ts` (new)
  - Action: Write Vitest tests mocking `ctx.db` and `ctx.runQuery`/`ctx.runMutation`:
    - `getServiceState`: returns null for unknown service, returns doc for known service
    - `recordFailure`: increments count, trips to "open" at threshold, writes auditLog
    - `recordSuccess`: resets count, transitions to "closed", writes auditLog
    - `tryAcquireProbe`: only one caller gets "probing" state, second caller gets "half-open"
    - `forceHalfOpen`: transitions "open" → "half-open" after maxOpenDurationMs
    - `forceHalfOpen`: does NOT transition if maxOpenDurationMs not elapsed
    - `withCircuitBreaker`: closed state → runs fn → records success on OK, records failure on error
    - `withCircuitBreaker`: open state → returns fallback without calling fn
    - `withCircuitBreaker`: half-open → acquires probe → success → closed
    - `withCircuitBreaker`: half-open → acquires probe → failure → open
    - `classifyError` (from `errorClassification.ts`): HTTP 5xx → "infrastructure", auth error → "auth", etc.
    - `isInfrastructureError`: convenience wrapper tests
  - Notes: Use `vi.fn()` for all ctx methods. Each test should be independent (no shared state).

#### Phase 2: Rate Limiter

- [ ] **Task 5: Create rate limiter query, mutation, and cleanup**
  - File: `convex/rateLimits.ts` (new)
  - Action: Implement 4 Convex functions using **two-tier design** (F3: avoid write amplification):
    1. `getRateLimitStatus(key)` — **internalQuery** (read-only, no write): returns current count, windowStart, remaining (limit - count), resetsAt (windowStart + windowDurationMs). Returns `{ count: 0, windowStart: 0, remaining: limit, resetsAt: now }` for missing docs (under limit by default). Uses `by_key` index.
    2. `checkAndIncrementRateLimit(key, limit, windowDurationMs)` — **internalMutation**: atomically check current count against limit, increment if under, return `{ allowed: boolean, remainingCount: number, resetsAt: number }`. If window expired, reset count to 1. If at/over limit, return `{ allowed: false, remainingCount: 0, resetsAt }`. Write auditLog on rejection.
    3. `incrementRateLimit(key, windowDurationMs, limit?)` — **internalMutation**: increment-only (no limit check). Used after `getRateLimitStatus` query confirms under limit. Returns updated count. This is the **recommended path for high-volume endpoints** — query first, mutate only if passing.
       - **N7: Upsert pattern:** Try `ctx.db.patch()` first. If doc doesn't exist (returns null), use `ctx.db.insert()` instead. This handles the race where the query saw no doc but another request created it before the increment mutation ran.
       - **N6: Safety net (optional limit param):** If `limit` is provided, check count against limit after read. If exceeded, throw `RateLimitError`. This prevents accidental misuse where `incrementRateLimit` is called without a prior query check.
       - **N9: Minimum window guard:** If `windowDurationMs < 1000`, throw validation error. Prevents misconfigured windows (e.g., 0 or negative) from causing immediate expiry and mass deletion by the cleanup cron.
    4. `cleanupExpiredLimits(cursor?, batchSize?)` — **internalMutation**: paginated cleanup using `by_expiresAt` index, delete expired docs, return continuation cursor. Args validator: `{ cursor: v.optional(v.string()), batchSize: v.optional(v.number()) }`.
  - Notes: **Two-tier flow for high-volume endpoints (clicks, conversions):** (1) call `getRateLimitStatus` query — if remaining > 0, proceed; (2) call `incrementRateLimit` mutation after processing. This avoids writing to DB for rejected requests and makes the read path free. For low-volume endpoints (broadcast, export, DNS), use `checkAndIncrementRateLimit` single-call for simplicity.

- [ ] **Task 6: Create rate limiter helper module**
  - File: `convex/lib/rateLimiter.ts` (new)
  - Action: Create helper module with:
    1. `RateLimitConfig` type (limit: number, windowDurationMs: number)
    2. `RateLimitResult` type (allowed: boolean, remainingCount: number, resetsAt: number)
    3. `ENDPOINT_CONFIGS` map: predefined configs per endpoint (click: 100/min, conversion: 60/min, coupon: 120/min, broadcast: 1/5min, bulk: 50/min, export: 3/min, dns: 5/min)
    4. `buildRateLimitKey(endpoint, identifier)` — constructs key from server-side values (never from client input)
    5. `extractIp(req: Request): string` — extracts client IP from Convex `Request` object: `req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'`. **F10: This is the canonical IP extraction method for all rate limiting.**
    6. `checkRateLimit(ctx, key, config?)` — calls `checkAndIncrementRateLimit` mutation, throws `RateLimitError` if not allowed. For low-volume endpoints.
    7. `checkRateLimitQuery(ctx, key, config?)` — calls `getRateLimitStatus` query only (no write). Returns `{ allowed, remaining, resetsAt }`. For high-volume endpoints — caller must call `incrementRateLimit` separately after processing.
    8. `RateLimitError` class extends Error with `{ statusCode: 429, key, resetsAt }`
  - Notes: Two paths: `checkRateLimit` (single mutation call, simpler) vs `checkRateLimitQuery` (query-only, no write, for high-volume). The `extractIp` function is the single source of truth for IP extraction across all endpoints.

- [ ] **Task 7: Create rate limiter tests**
  - File: `convex/rateLimiter.test.ts` (new)
  - Action: Write Vitest tests:
    - `checkRateLimit`: first request → allowed (count=1), second request under limit → allowed, request at limit → rejected (remainingCount=0)
    - `checkRateLimit`: window expired → resets count, allows request
    - `checkRateLimit`: missing doc → creates new doc, allows first request
    - `checkRateLimit`: concurrent requests within limit → all allowed
    - `cleanupExpiredLimits`: deletes only expired docs, leaves active docs, returns cursor
    - `buildRateLimitKey`: constructs correct composite keys for each endpoint type
    - `checkRateLimit` helper: throws `RateLimitError` with correct properties when rejected
    - `ENDPOINT_CONFIGS`: all 7 endpoints have valid configs (limit > 0, windowDurationMs > 0)

#### Phase 3: Graceful Degradation

- [ ] **Task 8: Create graceful degradation helper module**
  - File: `convex/lib/gracefulDegradation.ts` (new)
  - Action: Create helper module that imports `isInfrastructureError` from `convex/lib/errorClassification.ts`:
    1. `DegradedResponse<T>` type: `{ data: T, _degraded: true, _degradedAt: number, _fallbackReason: string }`
    2. `withDegradation<T>(fn, fallback, fallbackReason?)` — runs fn, on infrastructure error returns `DegradedResponse` with fallback data, on non-infrastructure error re-throws. Logs to `auditLogs` on degradation with action `"SERVICE_DEGRADED"`. **For use in `action` and `httpAction` context only.**
    3. `useDegradedQuery<T>(queryFn, fallbackQueryFn, fallbackReason?)` — **React hook for frontend-side query degradation** (F4: queries cannot call mutations or fallback queries in Convex). **N3: Precise implementation required — `useQuery` does NOT throw on error, it returns `{ data, error, isLoading }`:**
        ```typescript
        function useDegradedQuery<T>(
          enhancedQuery: () => { data: T | undefined; error: Error | null; isLoading: boolean },
          fallbackQuery: () => { data: T | undefined; error: Error | null; isLoading: boolean },
          fallbackReason: string
        ): T | DegradedResponse<T> {
          const enhanced = enhancedQuery();
          
          // N3: Check error property, NOT try/catch (useQuery doesn't throw)
          if (!enhanced.error && enhanced.data !== undefined) {
            return enhanced.data as T;  // Happy path — return directly
          }
          
          // Enhanced query failed or loading — try fallback
          const fallback = fallbackQuery();
          
          if (!fallback.error && fallback.data !== undefined) {
            // N4: Use a ref to prevent logging the same degradation twice in strict mode
            return {
              data: fallback.data as T,
              _degraded: true,
              _degradedAt: Date.now(),
              _fallbackReason,
            };
          }
          
          // N4: Both queries failed — ultimate fallback (hardcoded empty data)
          // Return the fallback data even if undefined, wrapped in degraded response
          // This prevents infinite retry loops and React re-render storms
          return {
            data: fallback.data as T,
            _degraded: true,
            _degradedAt: Date.now(),
            _fallbackReason: `${fallbackReason} (fallback also unavailable)`,
          };
        }
        ```
        **N4: Degradation cooldown:** Once degraded, the hook should NOT immediately re-try the enhanced query on every render. Use a `useRef<number>` to track last degradation timestamp. If `Date.now() - lastDegradedAt < cooldownMs` (default 30 seconds), skip the enhanced query and return the fallback directly. This prevents:
        - Infinite re-render loops when both queries fail (pre-mortem #3)
        - Thrashing between enhanced and fallback during transient outages
        - Excessive Convex query load during degradation periods
  - Notes: `errorClassification.ts` is the single source of truth — `gracefulDegradation.ts` imports `isInfrastructureError` from it (F12). Query degradation happens on the **frontend** via `useDegradedQuery` hook, not in Convex functions (F4). Frontend components use type union `T | DegradedResponse<T>` and check `_degraded` field (F14). **N3 critical:** The hook checks `error` property from `useQuery`, NOT try/catch — `useQuery` never throws.

- [ ] **Task 9: Create graceful degradation tests**
  - File: `convex/gracefulDegradation.test.ts` (new)
  - Action: Write Vitest tests:
    - `isInfrastructureError` (from `errorClassification.ts`): timeout error → true, HTTP 503 error → true, auth error → false, validation error → false, data not found → false
    - `withDegradation`: fn succeeds → returns data directly (not wrapped in DegradedResponse)
    - `withDegradation`: fn throws infrastructure error → returns DegradedResponse with fallback + `_degraded: true` + `_degradedAt` + `_fallbackReason`
    - `withDegradation`: fn throws auth error → re-throws (does NOT return fallback)
    - `withDegradation`: fn throws validation error → re-throws
    - `withDegradation`: degradation event logged to auditLogs
    - `useDegradedQuery`: enhanced query succeeds → returns data directly
    - `useDegradedQuery`: enhanced query has `error` property set → returns fallback query result wrapped in DegradedResponse (**N3: NOT try/catch — must check `.error` property**)
    - `useDegradedQuery`: both queries have `error` property set → returns DegradedResponse with fallback data (ultimate fallback)
    - `useDegradedQuery`: **N4 cooldown:** after degradation, enhanced query is NOT retried within cooldown period (30s default); after cooldown, enhanced query IS retried
    - `useDegradedQuery`: React strict mode double-render → degradation logged only once (ref guard)
    - `DegradedResponse` shape: has `_degraded: true`, `_degradedAt` (number), `_fallbackReason` (string), `data` (T)

#### Phase 4: Integration — Wire Into Existing Hot Paths

- [ ] **Task 10: Add rate limiter to click tracking HTTP endpoint**
  - File: `convex/http.ts`, `convex/clicks.ts`
  - Action: Move rate limit checks to the `httpAction` handler for click tracking (BEFORE calling the mutation):
    1. Extract IP using `extractIp(req)` from `rateLimiter.ts`
    2. Call `checkRateLimitQuery` with key `click:{referralCode}` — if not allowed, return tracking pixel response silently (don't create click, don't reveal rate limit)
    3. Call `checkRateLimitQuery` with key `click:ip:{ip}` — if not allowed, return tracking pixel response silently
    4. If both pass, proceed to call `trackClickInternal` mutation
    5. **N1 latency fix:** Do NOT call `incrementRateLimit` as a separate mutation after click creation (adds ~50ms extra round-trip). Instead, pass the rate limit keys into `trackClickInternal` and batch the increment inside the same mutation using `ctx.db.patch()` or `ctx.db.insert()`. This keeps total latency at 2 round-trips (query check + mutation with click+increment) instead of 3.
  - Notes: **N1 fix:** The original two-tier design added 2 extra round-trips per click (~150ms overhead). By batching the rate limit increment into the click creation mutation, we reduce overhead to ~50ms (one extra query-only check). The mutation-level increment is atomic with the click creation — no partial state if the mutation fails. The rate limit count may be slightly stale (query saw count=45, but 10 other requests incremented before this mutation runs), but this is acceptable soft-limit behavior.

- [ ] **Task 11: Add rate limiter to conversion tracking**
  - File: `convex/conversions.ts`
  - Action: In `createConversionWithAttribution` mutation, before processing:
    1. Call `internal.rateLimits.checkRateLimit` with key `conversion:{tenantId}`
    2. Also check global IP limit with key `conversion:ip:{ipAddress}` (if IP available)
    3. If rate limited, return `{ success: false, reason: "rate_limited" }` instead of throwing
  - Notes: Conversions are critical — rate limiting should be generous (60/min per tenant). The IP-based check is secondary protection against bots.

- [ ] **Task 12: Add rate limiter to public HTTP endpoints**
  - File: `convex/http.ts`
  - Action: Add rate limit checks to these HTTP action handlers:
    1. `/track/conversion` handler: check `conversion:{tenantId}` + `conversion:ip:{IP}` before calling conversion mutation
    2. `/track/validate-coupon` handler: check `coupon:{tenantId}` before calling validation query
    3. Return HTTP 429 with `{ error: "Too many requests", resetsAt }` when rate limited
  - Notes: **F10:** IP extraction uses `extractIp(req)` from `convex/lib/rateLimiter.ts`: `req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'`. Convex's deployment provides `x-forwarded-for` automatically. Rate limit checks happen BEFORE any processing, in the `httpAction` context.

- [ ] **Task 13: Add circuit breaker and rate limiter to DNS verification**
  - File: `convex/tenants.ts`
  - Action: In `verifyDomainDns` (now an `action` after Task 0):
    1. Replace the audit-log-based rate limiting with `checkRateLimit(ctx, "dns:" + tenantId, ENDPOINT_CONFIGS.dns)` using the single-call mutation approach (low-volume endpoint)
    2. Wrap the `fetch(dns.google)` call with `withCircuitBreaker(ctx, "dns-google", () => fetch(...), () => ({ success: false, verified: false, message: "DNS verification temporarily unavailable" }))`
    3. On success: `recordSuccess`, on failure: `recordFailure` (handled automatically by `withCircuitBreaker`)
  - Notes: **F1 fix:** After Task 0, `verifyDomainDns` is an `action`, so `withCircuitBreaker` wrapper works directly. No need for manual circuit breaker query/mutation calls. The existing 10s `AbortController` timeout remains as a secondary safeguard.

- [ ] **Task 14: Add circuit breaker to email service**
  - File: `convex/emailService.ts`
  - Action: In `sendEmail` internalAction (line 53):
    1. Determine serviceId from provider: "postmark" or "resend"
    2. Wrap the provider API call with `withCircuitBreaker(ctx, serviceId, () => client.sendEmail(...), () => ({ success: false, provider, messageId: undefined }))`
    3. If degraded, log to auditLogs and return the degraded result (caller already handles `success: false`)
  - Notes: `sendEmail` is an `internalAction` — it has access to `ctx.runQuery`/`ctx.runMutation`. The existing retry logic in `broadcasts.ts` already handles individual email failures gracefully.

- [ ] **Task 15: Add graceful degradation to dashboard frontend**
  - File: `src/app/(auth)/dashboard/` (dashboard page components)
  - Action: Wrap the heaviest dashboard queries using the `useDegradedQuery` hook from `convex/lib/gracefulDegradation.ts`:
    1. Enhanced path: existing `useQuery(api.dashboard.getOwnerDashboardStats, ...)` 
    2. Fallback path: `useQuery(api.tenantStats.getStats, { tenantId })` — O(1) aggregate read
    3. When degraded, show a subtle banner: "Showing cached stats — live data temporarily unavailable"
    4. Return type is `DashboardStats | DegradedResponse<DashboardStats>` — UI checks `_degraded` field
  - Notes: **F4 fix:** Dashboard degradation happens entirely on the frontend. Convex `query` functions cannot call fallback queries or mutations. The `useDegradedQuery` hook catches query errors in React and switches to the fallback query. This preserves Convex real-time subscriptions for the normal path. No changes to `convex/dashboard.ts` query functions needed — they remain as `query` type.

#### Phase 5: Cron & Observability

- [ ] **Task 16: Add rate limit cleanup cron job**
  - File: `convex/crons.ts`
  - Action: Add new cron job to existing `cronJobs()`:
    ```typescript
    crons.interval("cleanup-expired-rate-limits", { hours: 1 }, internal.rateLimits.cleanupExpiredLimits, { batchSize: 500 });
    ```
  - Notes: Uses paginated cleanup (not table scan). Runs hourly alongside existing `cleanupOldAttempts`. **F11:** The `cleanupExpiredLimits` function's args validator must be `{ cursor: v.optional(v.string()), batchSize: v.optional(v.number()) }` to match the `{ batchSize: 500 }` cron args.

- [ ] **Task 17: Extend tenantStats with degradation counters + fix getStats return validator**
  - File: `convex/tenantStats.ts`
  - Action:
    1. Add 3 new optional fields to `getOrCreateStats` defaults:
       - `degradationCount` (number, default 0) — total degradation events this month
       - `lastDegradedAt` (optional number) — timestamp of last degradation event
       - `circuitBreakerTrips` (number, default 0) — total circuit breaker trips affecting this tenant
    2. **F9 fix:** Update the `getStats` query's `returns` validator to include the 3 new fields:
       - Add `degradationCount: v.number()`, `lastDegradedAt: v.optional(v.number())`, `circuitBreakerTrips: v.number()` to the existing return validator object
       - Without this, adding fields to the schema but not the return validator will cause `ReturnsValidationError` at runtime
  - File: `convex/schema.ts` (Task 1 extension)
  - Action: Add the 3 fields to the `tenantStats` table definition as `v.optional(v.number())` for backward compatibility with existing docs.
  - Notes: Schema changes use `v.optional()` so existing tenantStats docs without these fields don't break. The `getStats` query's `?? 0` defaults handle null values.

- [ ] **Task 17b: Fix existing `cleanupOldAttempts` unbounded `.collect()`**
  - File: `convex/rateLimit.ts`
  - Action: Refactor `cleanupOldAttempts` internalMutation (line ~204-219) to use indexed pagination instead of unbounded `.collect()`:
    1. **N10: Verify existing indexes first** — check `loginAttempts` table definition in `convex/schema.ts` for any index that covers `lockedUntil`. The existing index may be `by_email_and_locked` (compound) or `by_lockedUntil` (standalone). Use whichever exists.
    2. If no suitable index exists, add `by_lockedUntil` index to `loginAttempts` table in `convex/schema.ts`
    3. Use `.withIndex("by_lockedUntil").filter(q => q.lte(q.field("lockedUntil"), now)).paginate(paginationOpts)` instead of `.filter().collect()`
    4. Process in batches of 500
    5. **Index backfill note:** If adding a new index to an existing table, Convex builds it asynchronously. The first cron run after deployment may see an incomplete index. Add a guard: if the paginated query returns 0 results but the unbounded count is > 0, log a warning and retry on next cron run (don't delete anything).
  - Notes: **F13 fix:** The existing `cleanupOldAttempts` uses unbounded `.collect()` which violates the project's own scalability guidelines. Fixing it alongside the new rate limit cleanup ensures consistency.

- [ ] **Task 18: Update scalability guidelines and AGENTS.md**
  - File: `docs/scalability-guidelines.md`
  - Action: Add new "Rule 6: Resilience Patterns" section covering:
    - When to use circuit breakers (any `fetch()` call to external services)
    - When to use rate limiting (all public HTTP endpoints, bulk operations)
    - When to use graceful degradation (heavy queries, external service calls)
    - Error classification rules (infrastructure → degrade, auth/validation → throw)
    - Rate limit key construction rules (server-side only, never from client headers)
    - Reference to `convex/lib/circuitBreaker.ts`, `convex/lib/rateLimiter.ts`, `convex/lib/gracefulDegradation.ts`
  - File: `AGENTS.md`
  - Action: Add to "Core Engineering Principles" section:
    - "Wrap all external service calls in circuit breakers"
    - "All public HTTP endpoints must have rate limiting"
    - "Heavy queries should have graceful degradation fallbacks to tenantStats"
  - Notes: Keep guidelines concise and actionable. Reference the helper modules by file path.

### Acceptance Criteria

- [ ] **AC 1:** Given a new circuit breaker for service "postmark", when 5 consecutive failures occur, then the breaker trips to "open" state and subsequent calls return the fallback immediately without making outbound HTTP requests.
- [ ] **AC 2:** Given a circuit breaker in "open" state, when the reset timeout (60s) elapses, then the breaker transitions to "half-open" and allows exactly one probe request.
- [ ] **AC 3:** Given a circuit breaker in "half-open" state, when two concurrent actions both try to probe, then only one acquires the "probing" state and the other gets the fallback.
- [ ] **AC 4:** Given a circuit breaker in "open" state for longer than maxOpenDurationMs (30 min), when `forceHalfOpen` is called, then the breaker transitions to "half-open" regardless of failure history.
- [ ] **AC 5:** Given a circuit breaker in "half-open" state, when the probe request succeeds, then the breaker transitions to "closed" and failure count resets to 0.
- [ ] **AC 6:** Given a rate limit of 100 requests per minute for key "click:ABC123", when 100 requests are made within the window, then the 101st request is rejected with `RateLimitError` (statusCode 429).
- [ ] **AC 7:** Given a rate limit window has expired, when a new request arrives, then the count resets to 1 and a new window begins.
- [ ] **AC 8:** Given a rate limit check for a key that has no existing doc, when the first request arrives, then it is allowed and a new doc is created with count=1.
- [ ] **AC 9:** Given rate limiting on click tracking with key "click:{referralCode}", when the limit is reached for one referral code, then clicks for other referral codes are NOT affected (per-key isolation).
- [ ] **AC 10:** Given rate limiting on click tracking with global key "click:ip:{IP}", when a single IP exceeds the global limit, then that IP is blocked across all referral codes.
- [ ] **AC 11:** Given the rate limit cleanup cron job, when expired rate limit docs exist, then they are deleted using paginated queries (not table scan) and the cleanup does not hit the 1MB transaction limit.
- [ ] **AC 12:** Given a graceful degradation wrapper with an infrastructure error (HTTP 503, timeout), when the wrapped function fails, then a `DegradedResponse` is returned with `_degraded: true`, `_degradedAt`, and `_fallbackReason`.
- [ ] **AC 13:** Given a graceful degradation wrapper with an auth error (unauthorized, invalid token), when the wrapped function fails, then the error is re-thrown (NOT degraded).
- [ ] **AC 14:** Given a graceful degradation wrapper with a validation error (invalid input), when the wrapped function fails, then the error is re-thrown (NOT degraded).
- [ ] **AC 15:** Given every circuit breaker state change, when the state transitions, then an auditLog entry is created with action "CIRCUIT_BREAKER_STATE_CHANGE" and metadata including serviceId, oldState, newState.
- [ ] **AC 16:** Given every rate limit rejection, when a request is denied, then an auditLog entry is created with action "RATE_LIMIT_EXCEEDED" and metadata including key, limit, resetsAt.
- [ ] **AC 17:** Given every graceful degradation event, when a fallback is returned, then an auditLog entry is created with action "SERVICE_DEGRADED" and metadata including fallbackReason.
- [ ] **AC 18:** Given DNS verification with circuit breaker integration (now an `action`), when the DNS service is down (breaker open), then `verifyDomainDns` returns `{ success: false, verified: false, message: "DNS verification temporarily unavailable" }` within <100ms (no 10s timeout wait).
- [ ] **AC 19:** Given email sending with circuit breaker integration, when the email provider is down (breaker open), then `sendEmail` returns `{ success: false, provider: "postmark"|"resend", messageId: undefined }` and broadcast processing continues without hanging.
- [ ] **AC 20:** Given the `docs/scalability-guidelines.md` update, when a developer reads the file, then Rule 6 documents when and how to use circuit breakers, rate limiters, and graceful degradation with references to the helper module file paths.
- [ ] **AC 21:** Given click tracking with rate limiting, when a click passes the rate limit query check and the click mutation succeeds, then the rate limit counter is incremented within the same mutation (not a separate round-trip) — total latency overhead <100ms.
- [ ] **AC 22:** Given `verifyDomainDns` has been refactored to an action, when a frontend component calls it, then the call succeeds (does not silently return `undefined` from a stale `useMutation` hook).
- [ ] **AC 23:** Given the `useDegradedQuery` hook, when the enhanced query returns `{ data: undefined, error: SomeError }`, then the hook returns the fallback wrapped in `DegradedResponse` (NOT try/catch — must check `.error` property).
- [ ] **AC 24:** Given the `useDegradedQuery` hook has entered degraded state, when the cooldown period (30s default) has not elapsed, then the enhanced query is NOT retried (prevents thrashing).
- [ ] **AC 25:** Given a platform admin calls `resetCircuitBreaker("postmark")`, when the breaker was in "open" state, then the breaker transitions to "closed" with failureCount=0 regardless of max-open-duration or failure history.
- [ ] **AC 26:** Given `incrementRateLimit` is called for a key with no existing doc, when the mutation runs, then it creates a new doc (upsert pattern) instead of throwing "Document not found".
- [ ] **AC 27:** Given a `rateLimits` doc with `windowDurationMs: 0`, when `incrementRateLimit` is called, then the mutation throws a validation error (minimum window guard: 1000ms).

## Additional Context

### Dependencies

- No new npm packages required — all patterns implemented with Convex primitives
- Depends on existing `tenantStats` infrastructure for query degradation fallbacks and degradation counters
- Depends on existing `convex/crons.ts` for rate limit cleanup job (must be updated to use indexed pagination)
- Depends on existing `rawWebhooks` table for store-first webhook pattern (already partially implemented in `convex/http.ts`)
- `convex/emailService.ts` and `convex/emailServiceMutation.ts` — two email sending paths (action vs mutation context)
- Existing `auditLogs` table structure (line 451 in schema.ts) — resilience events use `action`, `entityType`, `entityId`, `metadata` fields

### Testing Strategy

- **Framework:** Vitest with `describe/it/expect/vi.fn()` pattern
- **Test file location:** `convex/{module}.test.ts` (same directory as source)
- **Mocking pattern:** Mock `ctx.db` with `vi.fn()` — see existing `clicks.test.ts`, `fraudSignals.test.ts`
- **Run command:** `pnpm vitest run convex/{module}.test.ts`
- **3 new test files:** `circuitBreaker.test.ts`, `rateLimiter.test.ts`, `gracefulDegradation.test.ts`
- **Existing tests to update:** None — this spec adds new modules, doesn't modify existing test files
- **Coverage targets:** All 3 circuit breaker states, rate limit boundaries, error classification branches, degradation response shape

### Notes

- Party mode discussion (2026-04-12) with Winston (Architect), Amelia (Dev), and Quinn (QA) informed the initial design direction
- Advanced elicitation (2026-04-12): Red Team vs Blue Team, Failure Mode Analysis, and Chaos Monkey Scenarios identified 10 gaps — all incorporated into spec
- Adversarial review (2026-04-12): 18 findings identified — all addressed:
  - **F1 (Critical):** `verifyDomainDns` is a mutation calling `fetch()` — added Task 0 to refactor to action
  - **F2 (Critical):** Rate limiting in click tracking moved from mutation to httpAction to avoid nested `ctx.runMutation` calls
  - **F3 (Critical):** Rate limiter redesigned to two-tier (query for read, mutation for write) to avoid write amplification
  - **F4 (High):** Dashboard degradation moved to frontend `useDegradedQuery` hook — Convex queries cannot do fallbacks
  - **F5 (High):** Fixed file reference `convex/cron.ts` → `convex/crons.ts` (plural)
  - **F6 (High):** Noted existing `crons.weekly()` usage contradicts AGENTS.md — new crons use `crons.interval()` only
  - **F7 (High):** Fixed all `rawEvents` references to `rawWebhooks` (internal consistency)
  - **F8 (High):** Acknowledged TOCTOU race in `withCircuitBreaker` — documented as acceptable with rationale
  - **F9 (High):** Added explicit task to update `getStats` return validator with new degradation fields
  - **F10 (High):** Added `extractIp(req)` function to rate limiter module with exact implementation
  - **F11 (Medium):** Added args validator specification for cron cleanup function
  - **F12 (Medium):** Created `convex/lib/errorClassification.ts` as single source of truth for error classification
  - **F13 (Medium):** Added Task 17b to fix existing `cleanupOldAttempts` unbounded `.collect()`
  - **F14 (Medium):** Specified `T | DegradedResponse<T>` frontend type union and `_degraded` field check pattern
  - **F15 (Medium):** Fixed email circuit breaker fallback to match `sendEmail` return type (`success`, `provider`, `messageId`)
  - **F16 (Low):** Clarified "10 active cron jobs" in codebase patterns
  - **F17 (Low):** Changed `circuitBreakers.state` from `v.string()` to `v.literal()` discriminated union
  - **F18 (Low):** Fixed `convex/broadcasts.ts` → `convex/broadcasts.tsx`
- Existing `convex/rateLimit.ts` uses `loginAttempts` table with `by_email` index — new rate limiter uses separate `rateLimits` table to avoid schema collision
- Multiple past specs reference rate limiting as deferred debt — this spec consolidates those into a single implementation
- **Follow-up dependencies:**
  - Email retry queue (failed broadcasts should be retried after circuit breaker recovers) — noted but deferred to avoid scope creep
  - Existing `crons.weekly()` usage should eventually be converted to `crons.interval()` for AGENTS.md compliance
- Post-adversarial elicitation round 2 (2026-04-12): Pre-mortem analysis + Failure Mode Analysis identified 10 additional gaps:
  - **N1 (High):** Two-tier rate limiter added ~150ms overhead to click tracking — fixed by batching increment into click mutation
  - **N2 (High):** Task 0 had no frontend migration checklist — added explicit caller migration steps (useMutation→action)
  - **N3 (High):** `useDegradedQuery` spec didn't say HOW to detect errors — specified: check `.error` property from `useQuery`, NOT try/catch
  - **N4 (Medium):** No degradation cooldown — added 30-second cooldown to prevent re-render loops and query thrashing
  - **N5 (Medium):** No admin circuit breaker reset — added `resetCircuitBreaker` admin-only mutation
  - **N6 (Medium):** `incrementRateLimit` had no safety net — added optional `limit` param
  - **N7 (Medium):** `incrementRateLimit` needed upsert pattern — specified try-patch-then-insert for missing docs
  - **N8 (Medium):** `errorClassification` must handle Convex `FunctionError` wrapping — specified 3-tier classification priority
  - **N9 (Low):** Rate limit window minimum guard — reject `windowDurationMs < 1000`
  - **N10 (Low):** `cleanupOldAttempts` index verification — check existing indexes before adding new one; guard for async index backfill
