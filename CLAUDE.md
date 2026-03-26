# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Next.js 16.0.1** (App Router with Turbopack) - React 19.2.0
- **Convex** - Real-time backend database and functions
- **Better Auth** - Authentication system with email verification, 2FA, magic links, and OAuth
- **TypeScript** - Full type safety throughout
- **Tailwind CSS v4** - Styling with dark mode support
- **Radix UI** - Accessible component primitives
- **pnpm** - Package manager

## 🧠 Core Engineering Principles
Before writing any code, internalize these two non-negotiable rules:

1.  **Solve the Root Cause**: Do not "punt" or implement "band-aid" solutions (e.g., adding a `setTimeout` to fix a race condition or a `!` to bypass a type error). Identify why the failure is happening at its source and fix the underlying logic.
2.  **Search Before Creating**: Before building a new UI component, **search the codebase** (specifically `src/components/`) to see if a reusable component already exists. Always aim for design consistency by extending existing patterns rather than introducing one-off variations.

## Development Commands

### Starting the Application
```bash
# Start both Convex backend and Next.js frontend (recommended)
pnpm dev

# Start only frontend (requires Convex to be running separately)
pnpm dev:frontend

# Start only Convex backend
pnpm dev:backend
# or run once and exit:
pnpm convex dev --once
```

### Building and Deployment
```bash
# Production build
pnpm build

# Start production server
pnpm start

# Lint
pnpm lint

# Deploy Convex to production
pnpm convex deploy
```

### Convex Environment Management
```bash
# Set development environment variables
pnpm convex env set VARIABLE_NAME value

# Set production environment variables
pnpm convex env set VARIABLE_NAME value --prod

# List environment variables
pnpm convex env list
```

## Convex MCP Tools (AI Assistant Integration)

This project has the **Convex MCP server** installed, providing AI assistants with direct access to the Convex backend. See `@convex-mcp.md` for details.

### Available MCP Tools

**Prefer using MCP tools over bash commands when working with Convex** - they provide structured data and better error handling.

- **Deployment**: Use `status` tool to select your deployment
- **Tables**: Use `tables` tool to view schemas, `data` tool to browse table contents, `runOneoffQuery` for custom read-only queries
- **Functions**: Use `functionSpec` to see available functions, `run` to execute them, `logs` to view execution logs
- **Environment**: Use `envList`, `envGet`, `envSet`, `envRemove` instead of bash `convex env` commands

These tools provide structured access to Convex data and are more reliable than parsing CLI output.

## Architecture Overview

### Authentication Flow

This application uses a **dual-system authentication architecture**:

1. **Better Auth** (`src/lib/auth.ts`) - Server-side auth configuration running on Convex
   - Configures providers (Google, GitHub, Slack), email verification, password reset
   - Defines all auth options including 2FA, magic links, email OTP
   - Exports `createAuth(ctx)` which must receive Convex context

2. **Better Auth Client** (`src/lib/auth-client.ts`) - Client-side auth instance
   - React hooks and client methods for auth operations
   - Exports `authClient` used in components for sign in/out, session management
   - Plugins must match server-side configuration

3. **Convex Auth Component** (`convex/auth.ts`) - Connects Better Auth to Convex database
   - `betterAuthComponent` - handles database operations for auth
   - `onCreateUser` - creates application user record when auth user is created
   - `onDeleteUser` - cascade deletes user data (todos, etc.)
   - `onUpdateUser` - keeps email field synced between auth and app user tables
   - `getCurrentUser` - merges Better Auth user metadata with application user data

4. **HTTP Routes** (`convex/http.ts`) - Registers Better Auth API endpoints
   - Must call `betterAuthComponent.registerRoutes(http, createAuth)`
   - Handles `/api/auth/*` endpoints through Convex

5. **Proxy Protection** (`src/proxy.ts`) - Route protection middleware (renamed from middleware.ts in Next.js 16)
   - Uses cookie-based session checking (recommended approach)
   - Redirects unauthenticated users to `/sign-in`
   - Redirects authenticated users from auth pages to `/dashboard`
   - Matcher excludes static assets, `_next`, and `api/auth` routes

### Key Authentication Concepts

- **Session checking**: `proxy.ts` uses `getSessionCookie()` for performance (recommended over fetching full session)
- **User data split**: Auth metadata (email, name, image) lives in Better Auth tables; application data lives in `users` table
- **Lifecycle hooks**: `onCreateUser`, `onDeleteUser`, `onUpdateUser` keep application user table in sync with auth system
- **Plugin synchronization**: Client plugins (`src/lib/auth-client.ts`) must match server plugins (`src/lib/auth.ts`)

### Convex Integration

**Client Setup** (`src/app/ConvexClientProvider.tsx`):
- `ConvexReactClient` - connects to Convex backend using `NEXT_PUBLIC_CONVEX_URL`
- `ConvexBetterAuthProvider` - wraps app with both Convex and auth context
- Must wrap all client components that use `useQuery`, `useMutation`, or auth hooks

**Database Schema** (`convex/schema.ts`):
- Application tables defined here (e.g., `users`, `todos`)
- Better Auth tables auto-generated by `@convex-dev/better-auth`
- Indexes required for efficient queries (e.g., `userId` index on todos)

**Querying Data**:
```typescript
// In client components
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const data = useQuery(api.moduleName.functionName, { args });
const mutate = useMutation(api.moduleName.functionName);
```

### Route Structure

```
src/app/
├── (auth)/           # Protected routes - requires authentication
│   ├── dashboard/    # Main user dashboard
│   └── settings/     # User settings (2FA, profile)
├── (unauth)/         # Public auth routes
│   ├── sign-in/      # Login page
│   ├── sign-up/      # Registration page
│   └── verify-2fa/   # 2FA verification
└── api/auth/[...all]/ # Next.js API route that delegates to Convex (via Better Auth)
```

Route groups `(auth)` and `(unauth)` organize routes without affecting URLs. Proxy handles protection logic.

### Email System

Emails are sent through Convex using `@convex-dev/resend`:
- `convex/email.tsx` - Email templates using `@react-email/components`
- Functions: `sendEmailVerification`, `sendResetPassword`, `sendMagicLink`, `sendOTPVerification`
- Called from `src/lib/auth.ts` auth configuration callbacks

## Environment Variables

### Required in `.env.local`:
```bash
# Convex (auto-generated after first deploy)
CONVEX_DEPLOYMENT=automatic
NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://example.convex.site

# Site URL
SITE_URL=http://localhost:3000

# Better Auth Secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET=

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### Must also be set in Convex:
```bash
pnpm convex env set SITE_URL http://localhost:3000
pnpm convex env set BETTER_AUTH_SECRET your-secret
pnpm convex env set GOOGLE_CLIENT_ID your-id
pnpm convex env set GOOGLE_CLIENT_SECRET your-secret
# etc.
```

**Critical**: Environment variables must be set in BOTH `.env.local` (for Next.js) AND Convex (for backend functions).

## Adding/Removing Auth Providers

When modifying authentication providers:

1. **Update `src/lib/auth.ts`**:
   - Add/remove provider in `socialProviders` section
   - For generic OAuth: add to `genericOAuth({ config: [...] })`

2. **Update `src/lib/auth-client.ts`**:
   - Add/remove corresponding client plugin (e.g., `genericOAuthClient()`)

3. **Environment Variables**:
   - Add `PROVIDER_CLIENT_ID` and `PROVIDER_CLIENT_SECRET` to both `.env.local` and Convex
   - Use `pnpm convex env set` for Convex variables

4. **Update UI Components**:
   - Add provider buttons in sign-in/sign-up pages if needed

Example providers included: Google, GitHub, Slack (via genericOAuth), plus anonymous, magic link, email OTP, and 2FA.

## Important File Locations

- `src/proxy.ts` - Route protection (Next.js 16 renamed from middleware.ts)
- `convex/auth.config.ts` - Better Auth domain configuration
- `convex/schema.ts` - Application database schema
- `convex/polyfills.ts` - Required polyfills for Better Auth in Convex environment
- `next.config.ts` - Next.js configuration (images, remotePatterns)

## Common Patterns

### Creating a New Protected Page
1. Create `src/app/(auth)/page-name/page.tsx`
2. Use `"use client"` directive if using hooks
3. Import `useQuery(api.auth.getCurrentUser)` for current user
4. Wrap content with `<AppContainer>` component (optional, for consistent layout)

### Adding a Convex Function
1. Create function in `convex/*.ts` file
2. Export as `query`, `mutation`, or `action` from `convex/_generated/server`
3. Import in client: `import { api } from "@/convex/_generated/api"`
4. Use with: `useQuery(api.file.functionName)` or `useMutation(api.file.functionName)`

### Accessing Current User
```typescript
// In client components
const user = useQuery(api.auth.getCurrentUser);

// In Convex functions
const user = await betterAuthComponent.getAuthUser(ctx);
```

## Deployment Notes

**Vercel Deployment**:
- Build Command: `npx convex deploy --cmd 'pnpm run build'`
- Install Command: `pnpm install`
- Add all environment variables from `.env.local`
- Set `CONVEX_DEPLOYMENT` to production key from Convex dashboard

**Convex Production Variables**:
```bash
pnpm convex env set SITE_URL https://your-domain.com --prod
pnpm convex env set BETTER_AUTH_SECRET your-prod-secret --prod
# etc. for all required variables
```

## Next.js 16 Specifics

- **Turbopack is default** - no `--turbo` flag needed in dev/build commands
- **Proxy pattern** - `src/proxy.ts` replaces `middleware.ts` (deprecated convention)
- **React 19** - Using React 19.2.0 with async server components

---

## Design Context

### Users

**Primary Users:**
- **SaaS Owner ("Alex")** — Running a subscription SaaS business; needs to launch, manage, and track affiliate programs with minimal friction; values accuracy and automation
- **Affiliate ("Jamie")** — Content creators, freelancers, digital marketers; non-technical; needs clear, accessible dashboards; values trust and transparency
- **Platform Admin** — Internal operations team; needs efficient tenant management tools

**User Context:**
- Target market: Philippine and Southeast Asian digital entrepreneurs, GHL agency owners, SaaS resellers
- Users range from technical (can install JS snippets) to non-technical (need guided setup)
- Mobile-responsive affiliate portal required (affiliates may check on-the-go)

### Brand Personality

**Modern Professional** — Clean, trustworthy, data-driven
- Confidence-inspiring without being stiff
- FinTech-grade precision (commission accuracy is critical)
- Community-rooted in PH/SEA market — authentic, not corporate

### Aesthetic Direction

**Visual Tone:**
- Light mode primary with dark mode available
- Clean, command-center dashboard aesthetic
- Data visualization focus (metrics, charts, tables)
- Professional but not boring — modern tooling feel

**Design System Established:**
- Brand primary: `#10409a` (trustworthy blue)
- Secondary: `#1659d6`
- Typography: Poppins (body), Passion One (display headings)
- Spacing: 8px base scale
- Border radius: 12px (0.75rem) default
- Status colors: success (green), warning (amber), danger (red), info (blue)
- Full CSS variables and design tokens in `src/app/globals.css`

**References:**
- No specific references — flexible, go with what fits the product
- Avoid: cluttered interfaces, outdated SaaS aesthetics, overly playful tones

### Design Principles

1. **Trust through precision** — Financial accuracy is paramount; UI must convey reliability
2. **Progressive disclosure** — Show complexity only when needed; keep onboarding friction low
3. **White-label trust** — Affiliate portal reflects the SaaS Owner's brand, not salig-affiliate's
4. **Mobile-first for affiliates** — They may check commissions on mobile; dashboard must be responsive
5. **Clear status communication** — Commission states, payout status, fraud flags must be instantly understandable

---

## Design System Patterns (from _bmad-output/screens/)

### Color Palette (CSS Variables)

```css
/* Brand Colors */
--brand-primary: #10409a;   /* Primary buttons, active states */
--brand-secondary: #1659d6;  /* Hover states, accents */
--brand-dark: #022232;       /* Sidebar background */
--brand-light: #eff6ff;     /* Light backgrounds */
--brand-link: #2b7bb9;       /* Links */

/* Text Colors */
--text-heading: #333333;      /* Headings */
--text-body: #474747;         /* Body text */
--text-muted: #6b7280;       /* Secondary text */

/* Surface Colors */
--bg-page: #f2f2f2;          /* Page background */
--bg-surface: #ffffff;         /* Card backgrounds */

/* Status Colors */
--success: #10b981;          /* Confirmed, active */
--warning: #f59e0b;          /* Pending, flagged */
--danger: #ef4444;           /* Reversed, rejected */
--info: #3b82f6;            /* Processing, info */

/* Borders */
--border: #e5e7eb;
```

### Typography

- **Font Family**: Poppins (300, 400, 600, 700, 900 weights)
- **Body Size**: 14px
- **Topbar Title**: 17px / 700
- **Card Titles**: 14px / 700
- **Metric Label**: 11-12px uppercase
- **Display Headings**: Passion One (for hero text, branding moments)

### Layout

- **Sidebar**: 240px fixed width
- **Topbar Height**: 60px
- **Page Padding**: 28px 32px
- **Card Border Radius**: 12px (0.75rem)
- **Button Border Radius**: 8px
- **Badge/Pill Border Radius**: 99px (rounded-full)
- **Input Border Radius**: 10px

### Component Patterns

#### Status Badges (Dot Indicator Pattern)
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
}
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* Variants */
.badge-confirmed { background: #d1fae5; color: #065f46; }
.badge-confirmed .badge-dot { background: var(--success); }

.badge-pending { background: #fef3c7; color: #92400e; }
.badge-pending .badge-dot { background: var(--warning); }

.badge-reversed { background: #fee2e2; color: #991b1b; }
.badge-reversed .badge-dot { background: var(--danger); }

.badge-paid { background: #f3f4f6; color: #374151; }
.badge-paid .badge-dot { background: var(--text-muted); }
```

#### Metric Cards
```css
.metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 22px;
  position: relative;
  overflow: hidden;
}
.metric-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}
.metric-card.blue::before { background: var(--brand-secondary); }
.metric-card.green::before { background: var(--success); }
.metric-card.yellow::before { background: var(--warning); }
.metric-card.gray::before { background: var(--text-muted); }
```

#### Tables
```css
th {
  padding: 10px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #fafafa;
  border-bottom: 1px solid var(--border);
}
td {
  padding: 13px 16px;
  font-size: 13px;
  color: var(--text-body);
  border-bottom: 1px solid #f3f4f6;
}
tr:hover td { background: #f9fafb; }
```

#### Buttons
```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn-primary {
  background: var(--brand-primary);
  color: #fff;
}
.btn-primary:hover { background: var(--brand-secondary); }
.btn-outline {
  background: transparent;
  color: var(--text-body);
  border: 1.5px solid var(--border);
}
.btn-outline:hover { background: var(--bg-page); }
```

#### Sidebar
```css
.sidebar {
  width: 240px;
  background: var(--brand-dark);
  min-height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 20px;
  color: rgba(255, 255, 255, 0.55);
  border-left: 3px solid transparent;
}
.nav-item.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border-left-color: #7dd3fc;
  font-weight: 600;
}
```

#### Portal (White-label)
```css
.portal-header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 50;
}
.portal-logo-icon {
  width: 32px;
  height: 32px;
  background: var(--brand);
  border-radius: 8px;
}
```

### Key UI Patterns

1. **Status Badges**: Rounded-full with colored dot indicator + label
2. **Metric Cards**: White background with 3px colored top accent bar
3. **Tables**: Header with #fafafa background, hover rows with #f9fafb
4. **Buttons**: Primary uses `--brand-primary`, outline uses `--border`. All buttons have built-in hover lift, click press-down, and icon slide animations via `.btn-motion` in `globals.css` `@layer utilities`. **NEVER use raw `<button>` tags — always use `<Button>` from `@/components/ui/button`**. **DO NOT add inline `transition-*`, `active:scale-*`, or `hover:shadow-*` classes to `<Button>`**.
5. **Filter Pills**: Rounded-full with active state using `--brand-light` background
6. **Cards**: 12px border-radius, subtle shadow, 16-20px padding
7. **Activity Feed**: List items with icon, text content, and relative timestamp
8. **Quick Actions**: 2-column grid of action cards with icon + label

### Screen Reference Files

All design patterns extracted from:
- `01-owner-dashboard.html` - Main dashboard layout
- `02-owner-affiliates.html` - Affiliates management
- `03-owner-commissions.html` - Commission tracking
- `04-owner-payouts.html` - Payout management
- `05-owner-campaigns.html` - Campaign management
- `06-owner-reports.html` - Reports and analytics
- `07-owner-settings.html` - Settings pages
- `08-portal-login.html` - Affiliate portal login
- `09-portal-home.html` - Affiliate portal home
- `10-portal-earnings.html` - Portal earnings
- `11-portal-links.html` - Portal referral links
- `12-portal-account.html` - Portal account settings
- `13-admin-tenants.html` - Admin tenant list
- `14-admin-tenant-detail.html` - Admin tenant detail
- `18-auth-login.html` - Auth sign-in
- `19-auth-signup.html` - Auth sign-up
- `20-marketing-landing.html` - Marketing landing page
