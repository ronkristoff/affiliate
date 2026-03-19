# AGENTS.md - Developer Guidelines for salig-affiliate

This file provides guidance for AI agents working in this codebase.

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

### Authentication

- Use `authClient` from `@/lib/auth-client` for client-side auth
- Use `api.auth.getCurrentUser` query to get current user data
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
- `src/lib/auth.ts`: Server-side Better Auth configuration
- `src/lib/auth-client.ts`: Client-side auth instance
- `convex/schema.ts`: Database schema definition
- `convex/auth.ts`: Auth-related Convex functions
- `src/proxy.ts`: Route protection middleware

### UI Components

- Built on Radix UI primitives
- Located in `src/components/ui/`
- Use shadcn/ui-like patterns with class-variance-authority
- Tailwind CSS v4 for styling

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
- Brand primary: `#10409a`, Secondary: `#1659d6`
- Typography: Poppins (body), Passion One (display headings)
- Border radius: 12px (0.75rem) default
- Status colors: success (green), warning (amber), danger (red), info (blue)

**Design Principles:**
1. **Trust through precision** — Financial accuracy is paramount; UI must convey reliability
2. **Progressive disclosure** — Show complexity only when needed; keep onboarding friction low
3. **White-label trust** — Affiliate portal reflects the SaaS Owner's brand, not salig-affiliate's
4. **Mobile-first for affiliates** — They may check commissions on mobile; dashboard must be responsive
5. **Clear status communication** — Commission states, payout status, fraud flags must be instantly understandable
