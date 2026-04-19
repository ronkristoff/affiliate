# AGENTS.md - Developer Guidelines for salig-affiliate

This file provides guidance for AI agents working in this codebase.

## BMad Workflow (All Tasks)

**MANDATORY: Always use BMad skills for ALL tasks.** Do NOT attempt to perform
work directly — load the appropriate BMad skill first and follow its workflow.
Reject any approach that bypasses BMad skills. The only exception is purely
informational lookups that require zero code changes or document generation
(e.g., "what does this file do?").

BMad skills are the top-level orchestrator. They may leverage other installed skills
(e.g., `Convex Best Practices`, `frontend-design`, `harden`) as tools within their workflow.
The rule is: BMad skill decides *what* to do; other skills help *how* to do it.

When a task could map to multiple skills, load `bmad-help` to determine the right one.

### Core Development

| Task | Skill |
|------|-------|
| Build/fix/tweak code, components, or features | `bmad-quick-dev` (full path or one-shot mode) |
| Implement a story spec | `bmad-dev-story` |
| Developer agent (implementation questions) | `bmad-agent-dev` (Amelia) |
| Create/edit PRD | `bmad-create-prd` / `bmad-edit-prd` |
| Validate a PRD | `bmad-validate-prd` |
| Plan UX design | `bmad-create-ux-design` |
| UX design agent (UI/UX questions) | `bmad-agent-ux-designer` (Sally) |
| Create architecture | `bmad-create-architecture` |
| Architecture agent (design decisions) | `bmad-agent-architect` (Winston) |
| Break into epics/stories | `bmad-create-epics-and-stories` |
| Create a story spec file | `bmad-create-story` |

### Sprint & Project Management

| Task | Skill |
|------|-------|
| Sprint planning/status | `bmad-sprint-planning` / `bmad-sprint-status` |
| Check implementation readiness | `bmad-check-implementation-readiness` |
| Correct course during sprint | `bmad-correct-course` |
| Retrospective | `bmad-retrospective` |
| Prioritize features, manage backlog | `bmad-agent-pm` (John) |
| Business analysis, requirements | `bmad-agent-analyst` (Mary) |
| Create product brief | `bmad-product-brief` |

### Review & Quality

| Task | Skill |
|------|-------|
| Code review (adversarial) | `bmad-code-review` |
| Edge case analysis (typically invoked by other skills) | `bmad-review-edge-case-hunter` |
| Cynical review of anything | `bmad-review-adversarial-general` |
| Human-in-the-loop checkpoint | `bmad-checkpoint-preview` |
| QA / e2e tests | `bmad-qa-generate-e2e-tests` |

### Research & Documentation

| Task | Skill |
|------|-------|
| Domain research | `bmad-domain-research` |
| Technical research | `bmad-technical-research` |
| Market research | `bmad-market-research` |
| Generate project docs | `bmad-document-project` |
| Generate project context for AI | `bmad-generate-project-context` |
| Technical documentation | `bmad-agent-tech-writer` (Paige) |
| Editorial review (prose) | `bmad-editorial-review-prose` |
| Editorial review (structure) | `bmad-editorial-review-structure` |
| Distill/compress documents | `bmad-distillator` |

### Collaboration & Ideation

| Task | Skill |
|------|-------|
| Multi-agent group discussion | `bmad-party-mode` |
| Brainstorm / ideate | `bmad-brainstorming` (or `bmad-cis-agent-brainstorming-coach` for facilitated sessions) |
| Problem solving | `bmad-cis-problem-solving` (or `bmad-cis-agent-creative-problem-solver` for Dr. Quinn) |
| Design thinking | `bmad-cis-design-thinking` (or `bmad-cis-agent-design-thinking-coach` for Maya) |
| Innovation strategy | `bmad-cis-innovation-strategy` (or `bmad-cis-agent-innovation-strategist` for Victor) |
| Storytelling | `bmad-cis-storytelling` (or `bmad-cis-agent-storyteller` for Sophia) |
| Presentations / pitch decks | `bmad-cis-agent-presentation-master` (Caravaggio) |
| PRFAQ (working backwards) | `bmad-prfaq` |

### Meta & Utilities

| Task | Skill |
|------|-------|
| Advanced elicitation / deeper critique | `bmad-advanced-elicitation` |
| Build/edit/analyze agent skills | `bmad-agent-builder` |
| Build/edit workflows and skills | `bmad-workflow-builder` |
| Build BMad modules | `bmad-module-builder` |
| Setup BMad Builder | `bmad-bmb-setup` |
| Shard large documents | `bmad-shard-doc` |
| Index docs in a folder | `bmad-index-docs` |

Two-app monorepo: **web/** (HRIS) and **app/** (Electron TimeTracker).

## Project Overview

- **Stack**: Next.js 16 (App Router), Convex (backend/database), Better Auth (authentication), Tailwind CSS v4, TypeScript
- **Package Manager**: pnpm
- **Route Groups**: `(auth)` for protected routes, `(unauth)` for public auth routes
- **Testing**: Vitest is configured; test files use `.test.ts` suffix
- **No production tests exist** in this project (placeholder tests only)

## Build & Development Commands

```bash
# Start both frontend and Convex backend (recommended)
pnpm dev

# Start only frontend (requires Convex running separately)
pnpm dev:frontend

# Start only Convex backend
pnpm dev:backend
# or run once and exit:
pnpm convex dev --once

# Production build
pnpm build

# Full TypeScript check without building (recommended before committing)
pnpm tsc --noEmit

# Start production server
pnpm start

# Lint code
pnpm lint

# Deploy Convex to production
pnpm convex deploy
```

### Convex Environment Variables

```bash
# Set development environment variables
pnpm convex env set VARIABLE_NAME value

# Set production environment variables
pnpm convex env set VARIABLE_NAME value --prod
```
## 🧠 Core Engineering Principles
Before writing any code, internalize these non-negotiable rules:

1.  **Solve the Root Cause**: Do not "punt" or implement "band-aid" solutions (e.g., adding a `setTimeout` to fix a race condition or a `!` to bypass a type error). Identify why the failure is happening at its source and fix the underlying logic.
2.  **Search Before Creating**: Before building a new UI component, **search the codebase** (specifically `src/components/`) to see if a reusable component already exists. Always aim for design consistency by extending existing patterns rather than introducing one-off variations.
3.  **Exhaust Libraries & Frameworks First**: Before writing custom logic, **exhaust the available library APIs, framework features, and plugin ecosystems first**. Never re-implement what a dependency already provides. If a library doesn't support a feature, the correct extension point is the library's plugin/hook system — not raw crypto, custom implementations, or manual workarounds. This applies to the entire app, not just auth.
4.  **Wrap External Calls in Circuit Breakers**: Every `fetch()` call to an external service (email providers, DNS APIs, payment webhooks) MUST be wrapped with a circuit breaker from `convex/lib/circuitBreaker.ts`. This prevents cascading failures when external services go down. See `docs/scalability-guidelines.md` Rule 6a.
5.  **Rate Limit All Public Endpoints**: Every public HTTP endpoint (`/track/*`, `/api/*`) MUST have rate limiting from `convex/lib/rateLimiter.ts`. Use the two-tier design: query for read path (check), mutation for write path (increment). See `docs/scalability-guidelines.md` Rule 6b.
6.  **Degrade Gracefully on Failure**: Heavy dashboard queries and external service calls should have graceful degradation fallbacks. Use `withDegradation()` for server-side (actions/httpActions) and fall back to `tenantStats` for frontend queries. Infrastructure errors → degrade; auth/validation errors → throw. See `docs/scalability-guidelines.md` Rule 6c.

    **Examples (auth — Better Auth):**
    - ❌ Manual scrypt hashing for password comparison → ✅ `auth.api.verifyPassword()` or `auth.api.changePassword()`
    - ❌ Custom session token generation/lookup → ✅ Better Auth session management
    - ❌ Manual cookie-based CSRF → ✅ Built-in CSRF protection (`advanced.disableCSRFCheck`)
    - ❌ Custom rate limiting middleware → ✅ `rateLimit()` plugin

    **Examples (general):**
    - ❌ Custom date formatting logic → ✅ `date-fns` (already installed)
    - ❌ Hand-rolled form validation → ✅ Zod schemas + `react-hook-form` resolvers
    - ❌ Custom debounce/throttle → ✅ Framework utilities or a lightweight library
    - ❌ Manual cookie parsing → ✅ Better Auth's built-in cookie handling or `universal-cookie`
    - ❌ Custom data fetching with `useEffect` + `useState` → ✅ Convex `useQuery`/`useMutation`
    - ❌ Manual `<select>` dropdown → ✅ Radix UI `Select` (already in project)

## 🛠️ Dynamic Skill Loading & Task Initialization
Before performing any task, the agent MUST execute the following protocol:

1.  **Context Discovery**: Analyze the task to identify the relevant technologies (e.g., Convex, Next.js 16, Better Auth, Tailwind v4, Lucide, Radix UI).
2.  **Skill Activation**: Proactively load and apply the best practices, strict type definitions, and architectural patterns for every identified technology.
3.  **Cross-Reference**: Check `convex/schema.ts` for database constraints and `src/proxy.ts` for route protection rules before suggesting any logic changes.

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode enabled** - all TypeScript rules are enforced
- **Module resolution**: bundler
- **Paths**: `@/*` maps to `./src/*`
- Always use explicit types for function arguments and return values
- Use `Id<'tableName'>` for Convex document IDs

### File Naming

- Components: PascalCase (e.g., `DashboardClient.tsx`, `EnableTwoFactor.tsx`)
- Utilities/lib: camelCase (e.g., `utils.ts`, `auth.ts`)
- Convex functions: camelCase (e.g., `users.ts`, `auth.ts`)

### Component Structure

- Use `"use client"` directive for any component using hooks (useState, useEffect, useQuery, useMutation)
- Server Components by default - keep client components as leaf nodes
- Use TypeScript interfaces for props
- Use object destructuring in component signatures
- Always provide stable `key` props when mapping arrays

### Imports

```typescript
// React/Next imports
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Convex imports
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// UI components (Radix-based)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Icons
import { Loader2, Copy, Check } from "lucide-react";

// Utilities
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
```

### Tailwind CSS v4

- Use Tailwind utility classes for all styling
- Use `cn()` utility for conditional classes (from `lib/utils.ts`)
- Follow mobile-first responsive patterns: `text-sm md:text-base`
- Use semantic color names: `text-muted-foreground`, `bg-primary`, `border-input`

### State Management

- **useState**: Simple local component state
- **useEffect**: Side effects, data fetching in client components
- **useQuery/useMutation**: Convex data access
- Functional updates: `setCount(prev => prev + 1)`

### Error Handling

- Use try/catch with finally for async operations
- Display errors to users via toast (sonner) or alert
- Always reset loading states in finally blocks
- Handle both success and error from auth client calls

```typescript
try {
  setLoading(true);
  const { data, error } = await authClient.someAction();
  if (error) {
    alert(error.message);
    return;
  }
  // handle success
} catch (e) {
  alert("An unexpected error occurred");
} finally {
  setLoading(false);
}
```

### Naming Conventions

- Variables/functions: camelCase
- Types/interfaces: PascalCase
- Components: PascalCase
- Constants: UPPER_SNAKE_CASE
- Boolean variables: prefix with `is`, `has`, `should` (e.g., `isLoading`, `hasError`)

### Convex Functions

```typescript
// Public query/mutation
export const myQuery = query({
  args: { userId: v.id("users") },
  returns: v.object({ ... }),
  handler: async (ctx, args) => { ... },
});

// Internal mutation (private)
export const myInternalMutation = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => { ... },
});

// Always include argument validators using v.* from convex/values
// Always specify returns validator
```

### ⚠️ Return Validators Must Match Actual Returns

When a handler returns a spread object plus additional computed fields, the return validator MUST include ALL fields. Otherwise you'll get `ReturnsValidationError` at runtime.

**❌ WRONG (causes ReturnsValidationError):**
```typescript
export const getCampaign = query({
  args: { campaignId: v.id("campaigns") },
  returns: v.object({
    _id: v.id("campaigns"),
    name: v.string(),
    // Missing: commissionRate, recurringCommissions
  }),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    return {
      ...campaign,
      commissionRate: campaign.commissionValue,           // Extra!
      recurringCommissions: campaign.recurringCommission, // Extra!
    };
  },
});
```

**✅ CORRECT (validator matches return exactly):**
```typescript
export const getCampaign = query({
  args: { campaignId: v.id("campaigns") },
  returns: v.object({
    _id: v.id("campaigns"),
    name: v.string(),
    commissionRate: v.number(),        // ✅ Alias included
    recurringCommissions: v.boolean(), // ✅ Alias included
  }),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    return {
      ...campaign,
      commissionRate: campaign.commissionValue,
      recurringCommissions: campaign.recurringCommission,
    };
  },
});
```

**Common pattern**: Frontend aliases (e.g., `commissionRate` → `commissionValue`) require the alias to be in the validator.

### ⚠️ Two Hidden Sources of "Extra Field" Errors

**1. System fields (`_creationTime`, `_id`) are always on documents.** Every Convex document includes `_id` and `_creationTime`. When returning a document from a query, these MUST be in the return validator — even if you didn't explicitly set them.

```typescript
// ❌ WRONG — _creationTime is missing from validator
returns: v.object({ _id: v.id("users"), name: v.string(), email: v.string() })

// ✅ CORRECT — system fields included
returns: v.object({ _id: v.id("users"), _creationTime: v.number(), name: v.string(), email: v.string() })
```

**2. `.paginate()` returns internal fields you must strip.** The result of `q.paginate(opts)` includes `pageStatus` and `splitCursor` fields that Convex uses internally. Never spread a paginate result directly into a return — destructure only the validated fields.

```typescript
// ❌ WRONG — pageStatus and splitCursor leak through
const result = await q.paginate(opts);
return result; // or { ...result, page: filtered }

// ✅ CORRECT — only return validated fields
const result = await q.paginate(opts);
return { page: result.page, continueCursor: result.continueCursor, isDone: result.isDone };
```

### Schema Change Checklist

**When adding/removing/rename a field from any table in `convex/schema.ts`, you MUST also update `convex/lib/validators.ts`.** All queries that return full documents from that table import their validators from that single file.

Steps:
1. **Update the validator** in `convex/lib/validators.ts` (add/remove/rename the field)
2. **Check queries with partial projections** — some queries intentionally return a subset of fields (e.g., `_getOwnersByTenantInternal` returns only `_id, email, name, role`). These use inline validators and should be updated only if they need the new field.
3. **Verify** with `grep -r "v.id(\"tableName\")" convex/` to find any remaining inline validators for that table.
4. **Test** — run the affected queries with a document that has the new field populated to confirm no `ReturnsValidationError`.

```bash
# Quick check: find all inline validators for a table (after updating shared validators)
grep -rn 'v\.id("users")' convex/ --include="*.ts"
```

### ⚠️ Critical: Dynamic Module Imports

**Dynamic imports (`await import()`) are NOT supported in queries/mutations.** They only work in `actions` and `httpAction` (Node.js runtime). Queries/mutations run in V8 which doesn't support dynamic module loading.

**❌ WRONG (will cause runtime error):**
```typescript
// In a query or mutation
async function handler(ctx) {
  const { betterAuthComponent } = await import("../auth"); // BREAKS!
}
```

**✅ CORRECT (use static imports at top):**
```typescript
import { betterAuthComponent } from "../auth";

async function handler(ctx) {
  // Use betterAuthComponent directly
  const user = await betterAuthComponent.getAuthUser(ctx);
}
```

This pattern is critical when sharing auth helpers across admin modules.

### ⚠️ Denormalized Counters — Mandatory Mutation Hooks

If your mutation changes a **status field** on `affiliates`, `commissions`, or `payouts`, you **MUST** call the corresponding `tenantStats` hook function in the same transaction. See `docs/scalability-guidelines.md` for the full checklist.

**Quick reference:**
```typescript
import { updateAffiliateCount, onCommissionCreated, onCommissionStatusChange, onCommissionAmountChanged, incrementTotalPaidOut } from "./tenantStats";

// Affiliate status change → updateAffiliateCount(ctx, tenantId, oldStatus, newStatus)
// Commission created → onCommissionCreated(ctx, tenantId, amount, status, hasFraudSignals, isSelfReferral)
// Commission status change → onCommissionStatusChange(ctx, tenantId, amount, oldStatus, newStatus, wasFlagged, isFlagged)
// Commission amount change → onCommissionAmountChanged(ctx, tenantId, oldAmount, newAmount, status)
// Payout marked paid → incrementTotalPaidOut(ctx, tenantId, amount)
```

### ⚠️ No Unbounded `.collect()` on High-Volume Tables

Never use unbounded `.collect()` on `clicks`, `conversions`, `commissions`, `payouts`, or `affiliates`. Always use `.take(N)`, `.paginate()`, or read from `tenantStats`. See `docs/scalability-guidelines.md` for the full `.take()` cap reference table.

**Quick reference:**
```typescript
// ❌ WRONG — unbounded, will crash at scale
const allCommissions = await ctx.db.query("commissions").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).collect();

// ✅ CORRECT — capped
const commissions = await ctx.db.query("commissions").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).take(500);

// ✅ CORRECT — paginated for user-facing lists
const results = await ctx.db.query("commissions").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).paginate(paginationOpts);

// ✅ CORRECT — existence check uses .first()
const hasCampaigns = !!(await ctx.db.query("campaigns").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).first());
```

### Commission Status Flow

Commissions follow a linear status flow: **Pending → Approved → Paid** (or **Declined** / **Reversed** as terminal states). Always use `"approved"` — the `"confirmed"` status has been removed.

```typescript
// ❌ WRONG — "confirmed" no longer exists
c.status === "confirmed"

// ✅ CORRECT — use "approved"
c.status === "approved"
```

### Authentication Architecture

All authentication is handled by **Better Auth** (v1.5.3) via the `@convex-dev/better-auth` Convex component.

**Key files:**
- `convex/auth.ts` — `createAuth` factory, `betterAuthComponent`, all auth queries/mutations
- `convex/auth.config.ts` — `getAuthConfigProvider()` (Convex auth config)
- `src/lib/auth-client.ts` — Client-side `authClient` (React hooks + plugins)
- `src/lib/auth-server.ts` — Server-side utilities (`isAuthenticated`, `getToken`, `handler`)
- `src/proxy.ts` — Route protection via `isAuthenticated()` from auth-server

**Two-step registration pattern:**
1. Client calls `authClient.signUp.email({ email, password, name })` → Better Auth creates the user
2. Client calls `completeSignUp()` or `completeAffiliateSignUp()` → Convex creates the app record

**Affiliate auth:** Affiliates authenticate through the SAME Better Auth flow as SaaS owners. Role-based access is enforced at the Convex query layer, not in the proxy.

**Key rules:**
- NEVER use `@noble/hashes`, `crypto.subtle`, or manual password hashing — Better Auth handles all credential management
- NEVER create custom session management — use Better Auth sessions
- Use `isAuthenticated()` from `@/lib/auth-server` in proxy/route protection — NOT `getSessionCookie` or `betterFetch`
- Route protection is handled in `src/proxy.ts` (replaces middleware.ts in Next.js 16)

### Route Structure

```
src/app/
├── (auth)/           # Protected - requires authentication
│   ├── dashboard/
│   └── settings/
├── (unauth)/         # Public auth routes
│   ├── sign-in/
│   └── sign-up/
└── api/auth/[...all]/ # Better Auth API endpoints
```

### ⚠️ Suspense Boundaries for Client Components

In Next.js 16, client components using hooks that access data (like `useQuery`, `useMutation`) **MUST** be wrapped in `<Suspense>` boundaries. Accessing uncached data outside of Suspense causes "Blocking Route" errors that delay the entire page render.

**Pattern: Suspense Wrapper with Skeleton Fallback**
```typescript
"use client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// 1. Content component (hooks inside)
function DashboardContent() {
  const data = useQuery(api.some.query); // ✅ Fine
  return <div>{/* ... */}</div>;
}

// 2. Skeleton fallback component
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

// 3. Export wrapper with Suspense
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
```

**Why this matters**: Next.js 16 uses streaming SSR. Without Suspense, the framework tries to render synchronously, blocking the entire page until all data is ready.

### Key Files & Patterns

- `src/lib/utils.ts`: Contains `cn()` utility for Tailwind class merging
- `src/lib/auth.ts`: Type re-exports from `convex/auth.ts` (thin bridge file)
- `src/lib/auth-client.ts`: Client-side `authClient` (React hooks + plugins)
- `src/lib/auth-server.ts`: Server-side `isAuthenticated`, `getToken`, `handler` via `convexBetterAuthNextJs`
- `convex/auth.ts`: `createAuth` factory, `betterAuthComponent`, auth queries/mutations
- `convex/auth.config.ts`: `getAuthConfigProvider()` for Convex Better Auth component
- `convex/schema.ts`: Database schema definition
- `src/proxy.ts`: Route protection via `isAuthenticated()` from auth-server
- `src/app/layout.tsx`: Root layout — passes `initialToken` to `ConvexClientProvider` for SSR auth
- `src/app/ConvexClientProvider.tsx`: Wraps app in `ConvexBetterAuthProvider` with `initialToken` prop

### UI Components

- Built on Radix UI primitives
- Located in `src/components/ui/`
- Use shadcn/ui-like patterns with class-variance-authority
- Tailwind CSS v4 for styling

### ⚠️ Button Motion Is Built Into the Base Component

**All `<Button>` components have subtle motion animations built in** via the `btn-motion` CSS class applied in `buttonVariants`. Every button gets hover lift, click press-down, and icon slide micro-interactions automatically.

**NEVER use raw `<button>` tags** — always use `<Button>` from `@/components/ui/button`. Raw buttons bypass the entire motion system. Use `<Button asChild>` for link-wrapped buttons.

**DO NOT add inline animation classes** (`transition-all`, `active:scale-95`, `hover:shadow-*`, etc.) to `<Button>` elements — the base component handles all motion.

**CSS for `.btn-motion` MUST live inside `@layer utilities { }` in `globals.css`** — Tailwind v4 strips custom CSS outside of layers.

```tsx
import { Button } from "@/components/ui/button";

// ✅ Correct — motion is automatic, icons animate on hover/click
<Button variant="outline" size="sm">
  <Mail className="h-4 w-4" />
  Send Email
</Button>

// ✅ Correct — link buttons use asChild
<Button size="sm" asChild>
  <Link href="/somewhere">Go</Link>
</Button>

// ❌ Wrong — raw button has no animation
<button className="px-3 py-1.5 ...">Send</button>

// ❌ Wrong — redundant classes, already in btn-motion
<Button className="transition-all duration-200 active:scale-95">Send</Button>
```

### Git Conventions

- Do NOT commit unless explicitly asked
- Do NOT amend commits unless you created them and they haven't been pushed
- Avoid destructive git commands (force push, hard reset)

## Design Context

**Users:**
- **SaaS Owner ("Alex")** — Running a subscription SaaS business; needs to launch, manage, and track affiliate programs with minimal friction; values accuracy and automation
- **Affiliate ("Jamie")** — Content creators, freelancers, digital marketers; non-technical; needs clear, accessible dashboards; values trust and transparency
- **Platform Admin** — Internal operations team; needs efficient tenant management tools
- Target market: Philippine and Southeast Asian digital entrepreneurs, GHL agency owners, SaaS resellers

**Brand Personality:**
- **Modern Professional** — Clean, trustworthy, data-driven
- Confidence-inspiring without being stiff
- FinTech-grade precision (commission accuracy is critical)
- Community-rooted in PH/SEA market — authentic, not corporate

**Aesthetic Direction:**
- Light mode primary with dark mode available
- Clean, command-center dashboard aesthetic
- Data visualization focus (metrics, charts, tables)
- Professional but not boring — modern tooling feel
- Brand primary: `#1c2260`, Secondary: `#1fb5a5`
- Typography: Poppins (body), Passion One (display headings)
- Border radius: 12px (0.75rem) default
- Status colors: success (green), warning (amber), danger (red), info (blue)

**Design Principles:**
1. **Trust through precision** — Financial accuracy is paramount; UI must convey reliability
2. **Progressive disclosure** — Show complexity only when needed; keep onboarding friction low
3. **White-label trust** — Affiliate portal reflects the SaaS Owner's brand, not salig-affiliate's
4. **Mobile-first for affiliates** — They may check commissions on mobile; dashboard must be responsive
5. **Clear status communication** — Commission states, payout status, fraud flags must be instantly understandable

## 🧪 Test Data & Seeding

### Quick Reference: Seed Workflow

For a **full fresh seed**, run these commands in order:

```bash
# 1. Clear all existing data (app tables + auth component tables)
pnpm convex run testData:clearAllTestData --typecheck=disable -- '{}'

# 2. Create credential accounts for all 16 auth users in component tables
#    (run seedAuthUsers action OR ensureAuthAccounts directly)
pnpm convex run seedAuthUsers:seedAuthUsers --typecheck=disable --push

# 3. Seed app data (tenants, users, affiliates, campaigns, clicks, commissions, etc.)
pnpm convex run testData:seedAllTestData --typecheck=disable -- '{}'

# 4. Backfill aggregate indexes (CRITICAL: seed bypasses triggers, so aggregates are empty)
pnpm convex run aggregates:backfillAll --typecheck=disable --push -- '{}'
```

**Important:** Always use `--typecheck=disable` when running Convex functions from the CLI. Pre-existing test files (commissionEngine.test.ts, payouts.test.ts, webhooks.test.ts) have TypeScript errors that will block function push/deployment otherwise.

### Test Credentials

All test accounts use password: **`TestPass123!`**

### Seed Data Summary

| Resource | Count | Notes |
|----------|-------|-------|
| Tenants | 10 | 9 SaaS companies + 1 Platform Admin |
| Auth Users (Better Auth) | 16 | In component-scoped tables |
| App Users | 16 | In root `users` table with tenant/role assignments |
| Affiliates | 17 | Across tenants, with referral codes |
| Campaigns | 14 | Various commission types and statuses |
| Clicks | ~378 | Randomly generated per affiliate |
| Conversions | ~39 | Linked to clicks and campaigns |
| Commissions | ~39 | Mix of pending/approved/paid statuses |
| Payout Batches | 7 | For affiliates with paid commissions |
| Brand Assets | 27 | Logos, copy-text per tenant |
| Billing History | 29 | Trial starts, conversions, renewals, cancellations |
| Audit Logs | 86 | Auto-generated for all seed operations |

### Seed Files

| File | Purpose |
|------|---------|
| `convex/seedAuthUsers.ts` | Action that calls HTTP signup endpoint + fallback to `ensureAuthAccounts` |
| `convex/seedAuthHelpers.ts` | `ensureAuthAccounts` internalMutation using the adapter factory to create credential accounts |
| `convex/testData.ts` | All test data config, `clearAllTestData`, `seedAllTestData`, `getTestCredentials` |

## ⚠️ Better Auth Component Tables — Critical Knowledge

The `@convex-dev/better-auth` component manages its own **component-scoped database tables** (`user`, `account`, `session`, `verification`, `twoFactor`, `passkey`, `rateLimit`, `jwks`). These are **separate** from any root Convex tables you might define with the same names.

### ⚠️ Root Tables vs. Component Tables

**Direct `ctx.db.insert("user", ...)` writes to ROOT tables**, NOT the component's tables. Better Auth sign-in only reads from component-scoped tables. If you write to root tables directly, users will not be able to sign in.

```typescript
// ❌ WRONG — writes to root "user" table, Better Auth won't see it
await ctx.db.insert("user", { email, name, ... });

// ✅ CORRECT — use the adapter to write to component tables
const factory = betterAuthComponent.adapter(ctx);
const db = factory({ options: {} });
await db.create({ model: "user", data: { email, name, ... } });
```

### ⚠️ Adapter Factory Pattern

`betterAuthComponent.adapter(ctx)` returns a **factory function**, NOT an adapter object. You must call the factory to get the actual adapter with methods (`findMany`, `findOne`, `create`, `delete`, etc.).

```typescript
import { betterAuthComponent } from "./auth";

// Step 1: Get the factory (this is a function, not an object)
const factory: any = betterAuthComponent.adapter(ctx);

// Step 2: Call the factory to get the actual adapter
const db: any = factory({ options: {} });

// Step 3: Use adapter methods
const users = await db.findMany({ model: "user" });
```

### ⚠️ Adapter `create()` Requires Both `createdAt` AND `updatedAt`

The component's schema validators require both `createdAt` and `updatedAt` fields on all models. The adapter **auto-injects `createdAt`** but does NOT auto-inject `updatedAt`. You must provide `updatedAt` explicitly, or you'll get an `ArgumentValidationError`.

```typescript
// ❌ WRONG — missing updatedAt, will fail with ArgumentValidationError
await db.create({
  model: "account",
  data: {
    userId: user.id,
    accountId: email,
    providerId: "credential",
    password: hash,
  },
});

// ✅ CORRECT — include both timestamps
const now = Date.now();
await db.create({
  model: "account",
  data: {
    userId: user.id,
    accountId: email,
    providerId: "credential",
    password: hash,
    createdAt: now,
    updatedAt: now,
  },
});
```

**Component schema for `account` model** (for reference):
```typescript
{
  accountId: v.string(),          // For credential: the email address
  providerId: v.string(),         // "credential" for email/password
  password: v.optional(v.string()),
  accessToken: v.optional(v.string()),
  refreshToken: v.optional(v.string()),
  createdAt: v.float64(),         // REQUIRED (auto-injected by adapter)
  updatedAt: v.float64(),         // REQUIRED (NOT auto-injected!)
  userId: v.string(),             // Better Auth user ID (not Convex doc ID)
  // ... other optional OAuth fields
}
```

### ⚠️ Adapter Method Reliability

| Method | Status | Notes |
|--------|--------|-------|
| `findMany` | ✅ Works | Returns array of records with `id` (mapped from `_id`) |
| `create` | ✅ Works | Triggers component onCreate hooks; requires full schema data |
| `findOne` | ❌ Fails | Throws `c.map is not a function` — use `findMany` + filter instead |
| `delete` | ❌ Fails | Throws `c.map is not a function` — no working delete via adapter |

**Workaround for reads**: Use `findMany` and filter in JavaScript.
**Workaround for deletes**: Use `ctx.db.query("account").collect()` + `ctx.db.delete()` on the root table reference (component tables ARE accessible via `ctx.db` for reads/deletes, even though `clearAllTestData` reports 0).

### ⚠️ HTTP Signup Is the Most Reliable Creation Method

The only fully reliable way to create auth users with both `user` AND `account` records is via the HTTP signup endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "TestPass123!", "name": "User Name"}'
```

This creates both the `user` and `account` (credential) records atomically. The adapter `create` approach works but must be done in two steps (user first, then account).

### ⚠️ databaseHooks.user.create.after Must Be Non-Fatal

The `databaseHooks.user.create.after` hook in `src/lib/auth.ts` calls `syncUserCreation`, which normally requires a `domain` to create a tenant. During seeding (no domain), this hook throws. It MUST be wrapped in try/catch so the auth user creation in component tables still succeeds:

```typescript
// In src/lib/auth.ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        if ("runMutation" in ctx) {
          try {
            await ctx.runMutation(internal.users.syncUserCreation, { ... });
          } catch (err) {
            // Non-fatal — auth user creation must succeed even if
            // app-level user record creation fails (e.g., missing domain during seeding)
            console.error("[Better Auth] syncUserCreation failed (non-fatal):", err);
          }
        }
      },
    },
  },
},
```

### ⚠️ Orphaned Users: User Without Account

If the `databaseHooks.user.create.after` hook throws (before the try/catch fix was added), Better Auth creates the `user` record but fails before creating the `account` record. This results in **orphaned users** that exist in the component `user` table but have no `account` record — they cannot sign in (error: "Credential account not found").

**Detection**: Users in component `user` table without matching `account` records.
**Fix**: Use `ensureAuthAccounts` in `convex/seedAuthHelpers.ts` to retroactively create `account` records for orphaned users.

### ⚠️ syncUserCreation Must Be Idempotent

The `syncUserCreation` mutation in `convex/users.ts` is called by the auth hook. It must check if a user already exists before creating one, since the hook fires on every signup (including re-runs during seeding):

```typescript
// Always check for existing user first
const existingUser = await ctx.db
  .query("users")
  .withIndex("by_email", (q) => q.eq("email", email))
  .first();

if (existingUser) {
  return existingUser._id; // Already exists, skip
}
```

### ⚠️ App User Upsert Pattern in seedAllTestData

Since auth users may already exist in the component tables (from HTTP signup) and the hook may have created minimal app user records, `seedAllTestData` uses an **upsert pattern**:

```typescript
// Check if user already exists (created by auth hook during seedAuthUsers)
const existingUser = await ctx.db
  .query("users")
  .withIndex("by_email", (q) => q.eq("email", user.email))
  .first();

if (existingUser) {
  // Patch existing user with correct tenant, role, etc.
  await ctx.db.patch(existingUser._id, {
    tenantId,
    name: user.name,
    role: user.role,
    emailVerified: true,
  });
} else {
  // Create new user in app's users table
  await ctx.db.insert("users", {
    tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: true,
  });
}
```

## ⚠️ Convex CLI Gotchas

### Pre-existing TS Errors Require `--typecheck=disable`

Several test files have TypeScript errors (commissionEngine.test.ts, payouts.test.ts, webhooks.test.ts, etc.). When pushing or running Convex functions, always use `--typecheck=disable`:

```bash
# ❌ WRONG — will fail due to TS errors in test files
pnpm convex run testData:seedAllTestData -- '{}'

# ✅ CORRECT — skips type checking
pnpm convex run testData:seedAllTestData --typecheck=disable -- '{}'

# ✅ CORRECT — push + skip type checking (for new functions)
pnpm convex run seedAuthUsers:seedAuthUsers --typecheck=disable --push
```

### `--push` Flag for New Functions

When running a function from a file that was just created or modified, use `--push` to register the new functions with the Convex backend before executing:

```bash
pnpm convex run seedAuthUsers:seedAuthUsers --typecheck=disable --push
```

### Environment Variables Required for Seeding

| Variable | Purpose | Set Command |
|----------|---------|-------------|
| `BETTER_AUTH_SECRET` | Required by Better Auth for token signing | `pnpm convex env set BETTER_AUTH_SECRET <value>` |
| `SITE_URL` | Required by Better Auth for base URL + seed HTTP calls | `pnpm convex env set SITE_URL http://localhost:3000` |

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
