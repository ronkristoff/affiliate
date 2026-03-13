# AGENTS.md - Developer Guidelines for salig-affiliate

This file provides guidance for AI agents working in this codebase.

## Project Overview

- **Stack**: Next.js 16 (App Router), Convex (backend/database), Better Auth (authentication), Tailwind CSS v4, TypeScript
- **Package Manager**: pnpm
- **Route Groups**: `(auth)` for protected routes, `(unauth)` for public auth routes
- **No tests currently exist** in this project

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
