---
project_name: "salig-affiliate"
user_name: "msi"
date: "2026-04-17"
sections_completed:
  - "technology_stack"
  - "framework_rules"
  - "authentication_rules"
  - "email_rules"
  - "skills"
  - "convex_module_import_rules"
  - "datatable_best_practices"
status: "complete"
rule_count: 28
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

7. **Read Convex AI Guidelines First** - When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

   Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

8. **`ctx.runMutation` vs `ctx.runAction`** — Context types determine which cross-function calls are available:
   - `MutationCtx` has `runQuery` + `runMutation` — NO `runAction`.
   - `ActionCtx` has `runQuery` + `runMutation` + `runAction`.
   - Calling an `internalAction` from a mutation requires scheduling: `ctx.scheduler.runAfter(0, internal.myFile.myAction, args)`.
   - Calling an `internalMutation` from a mutation: `ctx.runMutation(internal.myFile.myMutation, args)`.
   - Calling an `internalAction` from an action: `ctx.runAction(internal.myFile.myAction, args)`.
   - `RegisteredMutation`/`RegisteredAction` types are NOT directly callable as functions — must go through `ctx.run*`.

9. **`"use node"` files can export both Convex functions AND plain helpers** — A file with `"use node"` can export `action`/`internalAction` Convex functions AND regular `async function` helpers. Callers import helpers directly (e.g., `import { sendMagicLink } from "./email"`). Helpers run in Node.js runtime and can use Node.js APIs.

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

1. **Use unified email service** - Send emails via `convex/emailService.ts` abstraction (`sendEmail` action or `sendEmailFromMutation` mutation). NEVER use Resend directly.
2. **Provider routing** - `EMAIL_PROVIDER` Convex env var controls routing: `resend` (default) or `postmark`. Both providers supported.
3. **From-address** - Use `getFromAddress(prefix)` from `emailService.ts`. Never hardcode domain.
4. **Template Format** - Use `@react-email/components` for templates in `convex/emails/`
5. **Tracking** - Pass `tracking` param to email service for opt-in `emails` table records. Never do manual `ctx.db.insert("emails", ...)`.
6. **Mutation context** - Use `sendEmailFromMutation` (Resend-only). Postmark throws in mutation context.
7. **Action context** - Use `ctx.runAction(internal.emailService.sendEmail, ...)` for full provider routing.
8. **Webhooks** - Resend webhook at `POST /webhooks/resend`, Postmark webhook at `POST /webhooks/postmark`.

#### Email File Architecture

Two separate systems exist — do NOT confuse them:

| Path | Purpose | Runtime |
|------|---------|---------|
| `convex/email.ts` | Convex function wrappers (actions + helpers) that orchestrate sending | Node.js (`"use node"`) |
| `convex/emails/` | 30+ React email components (`.tsx`) for rendering HTML templates | Imported by `email.ts` or frontend |
| `convex/emailService.ts` | Low-level `sendEmail` internalAction with provider routing + circuit breaker | Node.js (`"use node"`) |
| `convex/emailServiceMutation.ts` | Low-level `sendEmailFromMutation` internalMutation (Resend-only) | V8 (mutation context) |
| `convex/templates.ts` | Template variable system: `TEMPLATE_DEFINITIONS`, `renderTemplate()`, validation | Static imports |

#### Email Calling Patterns

**`RegisteredMutation` types are NOT directly callable.** `sendEmailFromMutation` is an `internalMutation` — you cannot call it as `sendEmailFromMutation(ctx, args)`. Must use `ctx.runMutation`:

```typescript
// ❌ WRONG — RegisteredMutation has no call signatures
await sendEmailFromMutation(ctx, { from, to, subject, html });

// ✅ CORRECT — call via ctx.runMutation
await ctx.runMutation(internal.emailServiceMutation.sendEmailFromMutation, {
  from, to, subject, html, tracking: { tenantId, type: "..." },
});
```

**`emailService.sendEmail` is an `internalAction`** — must use `ctx.runAction`, NOT `ctx.runMutation`:

```typescript
// ❌ WRONG — type mismatch: "action" is not assignable to "mutation"
await ctx.runMutation(internal.emailService.sendEmail, { ... });

// ✅ CORRECT — actions call actions
await ctx.runAction(internal.emailService.sendEmail, { ... });
```

**Better Auth callbacks use dual-path pattern** — `auth.ts` checks `"runAction" in ctx`:
- Action context → `ctx.runAction(internal.email.sendAuthEmail, { type, to, url/otp })`
- Mutation context → direct import from `./email` (e.g., `sendMagicLink(ctx, { to, url })`)
- 2FA OTP callback uses dynamic import to avoid circular deps: `const { sendOTPVerification } = await import("./email")`

**Helper functions in `email.ts`** accept `MutationCtx` and internally call `ctx.runMutation(internal.emailServiceMutation.sendEmailFromMutation, ...)`. Date/amount parameters accept `number` (epoch ms) and format via `new Date(value).toLocaleDateString()` in HTML.

#### Template Variable System

Email templates use `{{variable}}` placeholders defined in `TEMPLATE_DEFINITIONS` (in `templates.ts`):

```typescript
import { renderTemplate, TEMPLATE_DEFINITIONS } from "./templates";

const definition = TEMPLATE_DEFINITIONS.find((d) => d.type === "affiliate_welcome");
const subject = renderTemplate(definition.defaultSubject, {
  affiliate_name: "Jamie",
  portal_name: "My SaaS",
  referral_link: "https://example.com/r/JAMIE",
});
```

Custom templates (stored in `emailTemplates` table) override defaults. Check via `getEmailTemplateForSending` internal query before falling back to defaults.

#### Aggregate Component Architecture

**Each `TableAggregate` instance MUST use its own dedicated component instance.** Multiple `TableAggregate` instances sharing the same component (e.g., `components.aggregate`) share the **same B-tree**. If they also share the same namespace (e.g., `tenantId`) and sort key (e.g., `_creationTime`), all their documents get mixed together. Paginating one table's aggregate returns documents from ALL tables.

```typescript
// ❌ WRONG — all tables share one B-tree, paginate() returns mixed documents
const commissionsAggregate = new TableAggregate(components.aggregate, { namespace: d.tenantId });
const clicksAggregate = new TableAggregate(components.aggregate, { namespace: d.tenantId });

// ✅ CORRECT — each table gets its own isolated B-tree
const commissionsAggregate = new TableAggregate(components.commissions, { namespace: d.tenantId });
const clicksAggregate = new TableAggregate(components.clicks, { namespace: d.tenantId });
```

Register each as a separate component in `convex/convex.config.ts`:
```typescript
app.use(aggregate, { name: "commissions" });
app.use(aggregate, { name: "clicks" });
// etc.
```

The only time multiple `TableAggregate` instances can safely share a component is when their namespaces never overlap (e.g., one uses `tenantId` and another uses `userId`).

#### Aggregate Backfill

**Seed data bypasses aggregate triggers.** Seed files use raw `internalMutation` from `./_generated/server`, not the trigger-wrapped version from `./triggers`. Aggregate tables are never populated during seeding — a `backfillAll` step is mandatory after seeding.

```bash
# Full seed workflow — step 4 is critical
pnpm convex run testData:clearAllTestData --typecheck=disable -- '{}'
pnpm convex run seedAuthUsers:seedAuthUsers --typecheck=disable --push
pnpm convex run testData:seedAllTestData --typecheck=disable -- '{}'
pnpm convex run aggregates:backfillAll --typecheck=disable --push -- '{}'
```

**No-op `patch({})` fails on empty aggregates.** The naive backfill approach of `ctx.db.patch(docId, {})` triggers `replace` (delete + insert) under the hood. If the aggregate tree is empty, the delete throws `DELETE_MISSING_KEY`. The correct backfill approach is:

1. `clear()` all aggregate trees first
2. `insertIfDoesNotExist()` directly on the aggregate for each document

See `convex/backfillIndex.ts` for the implementation.

**`_creationTime` is immutable.** Convex sets `_creationTime` to `Date.now()` on insert and it cannot be overridden. Seed data with simulated historical timestamps only records the real time in `_creationTime` — date-filtered queries ("This Month") will only show data if the seed was run in the current period.

#### Aggregate Backfill CLI

When the Convex backend is already running, backfill works WITHOUT `--push`:
```bash
# ✅ Works when backend is running — skip push to avoid CanonicalizationConflict
pnpm convex run aggregates:backfillAll --typecheck=disable '{}'

# ❌ --push may fail with CanonicalizationConflict (pre-existing issue in this codebase)
pnpm convex run aggregates:backfillAll --typecheck=disable --push
```

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

### TypeScript Checking

**Run before committing** to catch type errors that `pnpm dev` misses (Turbopack is lenient):

```bash
# Full TypeScript check without building
pnpm tsc --noEmit
```

### Button Motion (`src/components/ui/button.tsx` + `globals.css`)

**All buttons across the app have subtle motion built into the base `Button` component** via the `btn-motion` CSS class in `@layer utilities`. No additional imports or wrappers needed — every `<Button>` automatically inherits these micro-interactions.

**Built-in behaviors:**
| Interaction | Effect | Timing |
|-------------|--------|--------|
| Hover | Gentle lift (`translateY(-1px)`) + scale 1.015 + shadow | 150ms ease-out-quart |
| Click/Active | Press-down + scale 0.97 | 75ms snappy |
| Hover (icon inside) | Icon slides forward 2px | 200ms ease-out-quart |
| Click (icon inside) | Icon snaps back | 75ms |
| Hover (icon-only) | Icon scales to 1.1 | 150ms |
| Click (icon-only) | Icon scales to 0.95 | 75ms |
| Disabled + spinner | Spinning icon softened (opacity 0.7) | — |

**Icons work automatically** — any `<svg>` child of `<Button>` gets hover/click slide animation.

**`prefers-reduced-motion` respected** — all transitions killed via existing media query.

**IMPORTANT:** CSS must live inside `@layer utilities { }` — Tailwind v4 strips CSS outside layers.

**DO NOT add inline transition/animation classes to `<Button>` elements:**
```tsx
// ✅ Correct — motion is automatic
<Button variant="outline" size="sm">
  <Mail className="h-4 w-4" />
  Send Email
</Button>

// ❌ Wrong — redundant, already in btn-motion
<Button className="transition-all duration-200 active:scale-95 hover:shadow-lg">
  Send
</Button>
```

**NEVER use raw `<button>` tags** — always use `<Button>` from `@/components/ui/button` (or `<Button asChild>` for links). Raw buttons bypass the motion system entirely.

### Data Table Best Practices (Convex + Next.js 16)

All data tables in this project MUST follow these patterns. Convex is a NoSQL real-time database with a **hard 1MB query payload limit** and **32,000 document scan limit per transaction**. These limits are embedded in the Convex engine itself (even self-hosted) and cannot be changed. Every data table must be architected to stay within these boundaries.

#### 1. Choose the Right Pagination Path

There are **two distinct paths** for data table pagination. Choose based on UX requirements:

| Requirement | Path | Backend Strategy | Frontend Hook |
|-------------|------|-----------------|---------------|
| URL-driven numbered pages (`?page=3`), jump to any page | **Path A: Offset** | `TableAggregate.at(offset)` | `useQuery` with manual offset |
| Infinite scroll, "Load More", Next/Prev buttons | **Path B: Cursor** | Convex native `.paginate()` | `usePaginatedQuery` |
| URL state + Next/Prev (no page numbers) | **Path C: Cursor URL** | Explicit cursor arg | `useQuery` with cursor stack |

**You CANNOT have all three simultaneously:** dynamic multi-column filters + exact numbered pages + unlimited result sets. Pick ONE path per table.

#### 2. Path A: Offset/Numbered Pagination (Recommended for this project)

Most admin dashboards (affiliates, commissions, campaigns) need numbered pages and URL state. Use the **Hybrid Approach**:

- **No search/filters active** → Use `TableAggregate` for O(log n) page jumps
- **Search or filters active** → Use `withSearchIndex` or `withIndex`, cap results at `.take(500)`, paginate in-memory

**Backend pattern (convex module):**
```typescript
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";

const myTableAggregate = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "myTable";
}>(components.aggregate, {
  sortKey: (doc) => doc._creationTime,
});

export const getHybridPage = query({
  args: {
    offset: v.number(),
    limit: v.number(),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // PATH A-1: Search or filters active → capped in-memory pagination
    if (args.search || args.status) {
      const results = args.search
        ? await ctx.db.query("myTable")
            .withSearchIndex("search_field", (q) => {
              let s = q.search("name", args.search!);
              if (args.status) s = s.eq("status", args.status);
              return s;
            })
            .take(500)
        : await ctx.db.query("myTable")
            .withIndex("by_status", (q) => q.eq("status", args.status!))
            .take(500);

      return {
        items: results.slice(args.offset, args.offset + args.limit),
        totalCount: results.length,
      };
    }

    // PATH A-2: No filters → O(log n) aggregate offset
    const totalCount = await myTableAggregate.count(ctx);
    if (args.offset >= totalCount || totalCount === 0) {
      return { items: [], totalCount };
    }

    const firstInPage = await myTableAggregate.at(ctx, args.offset);
    const pageData = await myTableAggregate.paginate(ctx, {
      bounds: {
        lower: { key: firstInPage.key, id: firstInPage.id, inclusive: true },
      },
      pageSize: args.limit,
    });

    const items = await Promise.all(
      pageData.page.map((doc) => ctx.db.get(doc.id))
    );

    return { items: items.filter(Boolean), totalCount };
  },
});
```

**Frontend pattern (Next.js 16):**
```typescript
// page.tsx (Server Component)
import { Suspense } from "react";
import MyDataTable from "./MyDataTable";

export default function Page() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <MyDataTable />
    </Suspense>
  );
}

// MyDataTable.tsx (Client Component)
"use client";
import { useQuery } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const ITEMS_PER_PAGE = 10;

export default function MyDataTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  const data = useQuery(api.myModule.getHybridPage, {
    offset, limit: ITEMS_PER_PAGE, search, status,
  });

  const updateUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, String(value));
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalPages = Math.ceil((data?.totalCount ?? 0) / ITEMS_PER_PAGE);

  // When changing search/filter, ALWAYS reset to page 1:
  // updateUrl({ search: newSearch, page: 1 });
}
```

#### 3. Path B: Cursor-Based (Infinite Scroll / Load More)

Use for feeds, activity logs, or any view where users don't need to jump to specific pages.

```typescript
// Frontend
const { results, status, loadMore } = usePaginatedQuery(
  api.myModule.getList,
  { status: "active" },  // filter args
  { initialNumItems: 50 }
);
// <button onClick={() => loadMore(50)}>Load More</button>
```

#### 4. Total Counts — ALWAYS Use `@convex-dev/aggregate`

**NEVER** do `ctx.db.query("table").collect().length` or `ctx.db.query("table").filter(...).collect()` for counts. These scan the entire table and WILL hit the 1MB limit on large tables.

- Use `TableAggregate.count(ctx)` for O(log n) counts
- Register aggregate in `convex/convex.config.ts`: `app.use(aggregate)`
- Keep aggregates in sync via Convex triggers or by calling aggregate operations in your mutations
- For filtered counts on predictable dimensions (e.g., per-status), use aggregate **Namespaces**

#### 5. Search — Use `withSearchIndex`, NOT `.filter()`

Text search MUST use Convex's native full-text search indexes defined in `convex/schema.ts`:
```typescript
// In schema.ts
defineTable({ name: v.string(), status: v.string() })
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["status"],  // Chain equality filters with search
  })
```

**NEVER** use `.filter((q) => q.eq(q.field("name"), searchTerm))` for text matching — that's an exact equality check, not a search.

#### 6. Filters — Use Database Indexes (`withIndex`)

For non-search filters (dropdowns, status tabs), ALWAYS use `withIndex()`:
```typescript
// Schema must have: .index("by_status", ["status"])
ctx.db.query("table").withIndex("by_status", (q) => q.eq("status", "active"))
```

**NEVER** use unbounded `.filter()` on paginated queries — it causes variable page sizes and inconsistent results.

#### 7. Export — Use Actions with Chunked Queries

Exporting data MUST use a Convex `action` (Node.js runtime, higher limits) with chunked internal queries. NEVER export from a query.

```typescript
// 1. Internal query fetches safe chunks
export const getExportChunk = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("myTable").paginate({
      cursor: args.cursor, numItems: 1000,
    });
  },
});

// 2. Action loops through chunks, builds file, stores it
export const generateCsvExport = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let isDone = false;
    let csvLines = ["id,name,status"];

    while (!isDone) {
      const page = await ctx.runQuery(internal.export.getExportChunk, { cursor });
      for (const row of page.page) {
        csvLines.push(`${row._id},"${row.name}",${row.status}`);
      }
      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const storageId = await ctx.storage.store(blob);
    return await ctx.storage.getUrl(storageId);
  },
});
```

#### 8. Suspense Boundaries for Tables Using `useSearchParams`

In Next.js 16, any client component using `useSearchParams()` MUST be wrapped in `<Suspense>` by its parent server component. Without this, the entire route de-opts into client-side rendering.

```typescript
// page.tsx (Server Component)
export default function Page() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <MyDataTable />  // uses useSearchParams
    </Suspense>
  );
}
```

#### 9. Filtered Count Cap Display

When search or filters are active (capped at `.take(500)`), the UI MUST indicate the cap to users:
- Show: `"Showing 50 of 500 results"` (not `"of 12,000"`)
- If results hit the cap: show a message like `"Showing top 500 results. Refine your search for more specific results."`

#### 10. Filter Changes MUST Reset Pagination

When any search term or filter changes, ALWAYS reset to page 1:
```typescript
updateUrl({ search: newTerm, status: newStatus, page: 1 });
```

---

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

_Last Updated: 2026-04-17_
