---
project_name: "salig-affiliate"
user_name: "msi"
date: "2026-03-19"
sections_completed:
  - "technology_stack"
  - "framework_rules"
  - "authentication_rules"
  - "email_rules"
  - "skills"
  - "convex_module_import_rules"
status: "complete"
rule_count: 19
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 16.1.0 |
| Backend | Convex | 1.32.0 |
| Authentication | Better Auth | 1.4.9 |
| Auth Integration | @convex-dev/better-auth | 0.10.13 |
| Email | @convex-dev/resend | 0.2.3 |
| Email Components | @react-email/components | 0.5.7 |
| Styling | Tailwind CSS | 4.1.16 |
| UI Components | Radix UI | Latest |
| Forms | React Hook Form | 7.65.0 |
| Validation | Zod | 4.1.12 |
| Package Manager | pnpm | Latest |
| Runtime | React | 19.2.3 |
| Language | TypeScript | 5.9.3 |

---

## Critical Implementation Rules

### Convex Backend Rules

1. **NEW Function Syntax Required** - Always use the new Convex function syntax:
   ```typescript
   export const myFunction = query({
     args: { param: v.string() },
     returns: v.null(),
     handler: async (ctx, args) => { /* ... */ },
   });
   ```

2. **Validators Required** - ALL functions MUST have argument and return validators using `v` from `convex/values`

3. **Internal Functions** - Use `internalQuery`, `internalMutation`, `internalAction` for private functions

4. **Database Schema** - Define in `convex/schema.ts` with proper indexes

5. **NO Dynamic Imports in Queries/Mutations** - Dynamic module imports (`await import()`) are **NOT supported** in Convex queries/mutations (V8 runtime). Only `actions` and `httpAction` (Node.js runtime) support dynamic imports.
   - **WRONG** (will throw "dynamic module import unsupported"):
     ```typescript
     async function requireAdmin(ctx) {
       const { betterAuthComponent } = await import("../auth"); // ❌ BREAKS
     }
     ```
   - **CORRECT** (use static imports at top of file):
     ```typescript
     import { betterAuthComponent } from "../auth"; // ✅ Correct
     
     async function requireAdmin(ctx) {
       // use betterAuthComponent directly
     }
     ```

6. **Return Validators Must Match Actual Returns** - The return validator MUST include ALL fields returned, including computed/alias fields. Spreading `...campaign` and adding computed fields requires those fields in the validator.
   - **WRONG** (causes `ReturnsValidationError`):
     ```typescript
     returns: v.object({ _id: v.id("campaigns"), name: v.string() /* Missing: commissionRate */ }),
     handler: async (ctx, args) => {
       const campaign = await ctx.db.get(args.campaignId);
       return { ...campaign, commissionRate: campaign.commissionValue }; // Extra field!
     },
     ```
   - **CORRECT** (validator matches actual return):
     ```typescript
     returns: v.object({ _id: v.id("campaigns"), name: v.string(), commissionRate: v.number() }),
     handler: async (ctx, args) => {
       const campaign = await ctx.db.get(args.campaignId);
       return { ...campaign, commissionRate: campaign.commissionValue };
     },
     ```

### Next.js Frontend Rules

1. **Server Components** - Default is Server Components; use `"use client"` only when needed

2. **Route Protection** - Use `src/proxy.ts` (NOT middleware.ts - Next.js 16 pattern)

3. **Route Groups** - Use `(auth)` and `(unauth)` to organize without affecting URLs

4. **Loading States** - Create `loading.tsx` files for Suspense boundaries

5. **⚠️ Suspense Boundaries for Client Components** - In Next.js 16, client components using hooks (like `useQuery` from Convex) MUST be wrapped in `<Suspense>` boundaries. Accessing uncached data outside of Suspense causes "Blocking Route" errors.
   - **WRONG** (causes "Blocking Route" error):
     ```typescript
     "use client";
     export default function AuthLayout({ children }) {
       const user = useQuery(api.auth.getCurrentUser); // ❌ Blocking!
       return <div>{children}</div>;
     }
     ```
   - **CORRECT** (wrapped in Suspense):
     ```typescript
     "use client";
     import { Suspense } from "react";
     import { Skeleton } from "@/components/ui/skeleton";
     
     function AuthLayoutContent({ children }) {
       const user = useQuery(api.auth.getCurrentUser); // ✅ Works
       return <div>{children}</div>;
     }
     
     export default function AuthLayout({ children }) {
       return (
         <Suspense fallback={<AuthLayoutSkeleton />}>
           <AuthLayoutContent>{children}</AuthLayoutContent>
         </Suspense>
       );
     }
     ```
   - **Pattern**: Separate the content into a child component, export a wrapper with Suspense, provide a skeleton fallback

### Authentication Rules

1. **Two Auth Contexts** - SaaS Owners use Better Auth; Affiliates use separate portal auth

2. **Session Strategy** - Cookie-based session checking via `getSessionCookie()`

3. **Env Variables** - Set in BOTH `.env.local` AND Convex env

### Email Rules

1. **Use Resend Component** - Send emails via `@convex-dev/resend`

2. **Template Format** - Use `@react-email/components` for templates in `convex/emails/`

### Skills to Load

When implementing, AI agents MUST load relevant skills:

| Skill | When to Load |
|-------|--------------|
| **Convex** | Backend functions, schema |
| **Convex Functions** | Queries, mutations, actions |
| **Next.js Best Practices** | Frontend components |
| **Better Auth** | Authentication |
| **Frontend Design** | UI components |
| **Convex Realtime** | Real-time features |

### Design Context

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

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- Load relevant skills before starting implementation
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

---

_Last Updated: 2026-03-19_
