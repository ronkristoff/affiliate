---
title: "Affiliate Portal Visual Refresh & UX Overhaul with Reports"
slug: "affiliate-portal-redesign"
created: "2026-04-10"
status: "completed"
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
reviewed: true
adversarial_review_findings: 14
adversarial_review_fixes_applied: 25
elicitation_improvements_applied: 18
tech_stack: ["Next.js 16 (App Router)", "Convex 1.32", "TypeScript 5.9", "Tailwind CSS v4", "Radix UI", "Recharts 3.8.1", "Motion 12.38", "Vitest 4.1", "nuqs 2.8.9", "vaul 1.1.2", "date-fns"]
files_to_modify: ["src/app/portal/layout.tsx (NEW)", "src/app/portal/(authenticated)/layout.tsx (NEW)", "src/app/portal/(authenticated)/home/page.tsx", "src/app/portal/(authenticated)/earnings/page.tsx", "src/app/portal/(authenticated)/links/page.tsx", "src/app/portal/(authenticated)/assets/page.tsx", "src/app/portal/(authenticated)/account/page.tsx", "src/app/portal/(authenticated)/reports/page.tsx (NEW)", "src/app/portal/(public)/login/page.tsx", "src/app/portal/(public)/register/page.tsx", "src/components/affiliate/PortalHeader.tsx", "src/components/affiliate/PortalSidebar.tsx", "src/components/affiliate/PortalBottomNav.tsx", "src/app/portal/home/components/WelcomeBanner.tsx", "src/app/portal/home/components/EarningsSummaryGrid.tsx", "src/app/portal/home/components/RecentActivityFeed.tsx", "src/app/portal/home/components/QuickLinkCard.tsx", "src/app/portal/earnings/components/EarningsHero.tsx", "src/app/portal/earnings/components/ConfirmedCommissionCard.tsx (DELETE)", "src/app/portal/earnings/components/CommissionList.tsx", "src/app/portal/earnings/components/CommissionItem.tsx", "src/app/portal/earnings/components/CommissionDetailDrawer.tsx", "src/app/portal/earnings/components/PayoutHistory.tsx", "src/app/portal/earnings/components/PayoutBanner.tsx", "src/app/portal/earnings/components/PayoutMethodInfo.tsx", "src/app/portal/earnings/components/PeriodFilterTabs.tsx", "src/app/portal/earnings/components/StatusFilter.tsx", "src/app/portal/links/components/ReferralLinkCard.tsx", "src/app/portal/links/components/LinkPerformanceCard.tsx", "src/app/portal/links/components/PromoLibrary.tsx", "src/app/portal/assets/components/AssetsEmptyState.tsx", "src/app/portal/assets/components/AssetCard.tsx", "src/app/portal/assets/components/AssetCategorySection.tsx", "src/app/portal/assets/components/CopyTextCard.tsx", "src/app/portal/assets/components/UsageGuidelines.tsx", "src/app/portal/account/components/ProfileSection.tsx", "src/app/portal/account/components/PayoutSection.tsx", "src/app/portal/account/components/PasswordSection.tsx", "src/app/globals.css", "convex/schema.ts", "convex/affiliatePortalReports.ts (NEW)"]
code_patterns: ["useQuery/useMutation via convex/react", "Skeleton fallback in Suspense boundaries", "navigator.share with clipboard fallback", "Toast notifications via sonner", "Props drilling for primaryColor/portalName/logoUrl", "Card-based layouts via @/components/ui/card", "Dialog/Sheet patterns for drawers"]
test_patterns: ["Vitest 4.1 configured", "Test files use .test.ts suffix", "No existing portal tests (register/page.test.tsx exists as placeholder)", "convex-test for Convex function testing"]
---

# Tech-Spec: Affiliate Portal Visual Refresh & UX Overhaul with Reports

**Created:** 2026-04-10

## Overview

### Problem Statement

The affiliate portal (`/portal/*`) has 5 working pages (Home, Earnings, Links, Assets, Account) with rich functionality but suffers from six systemic issues:

1. **No shared layout** — Every protected page duplicates `PortalHeader` + `PortalSidebar` + `PortalBottomNav` construction. Changing the navigation requires editing 5 files.
2. **Layout inconsistency** — The earnings page uses `fixed` sidebar positioning with `md:ml-[220px]` while all other pages use `flex` layout, causing visual shifts between page navigations.
3. **No Suspense boundaries** — All protected pages are top-level `"use client"` components without `<Suspense>` wrappers, causing full-page blocking loads in Next.js 16 streaming SSR.
4. **Currency inconsistency** — Some components format as PHP (`Intl.NumberFormat("en-PH", { currency: "PHP" })`) while others hardcode `"USD"`.
5. **No performance reporting** — Affiliates can see individual commissions but cannot analyze trends, compare periods, or identify their best-performing links.
6. **Visual debt from inline branding** — Tenant branding is applied via per-component inline styles instead of systematic CSS custom properties, despite a rich set of `--brand-*` variables existing in `globals.css`.

### Solution

Three-phase approach:

1. **Phase 1 — Foundation (refactor, zero visual regression):** Extract shared `layout.tsx` with `(public)` and `(authenticated)` route groups. Add Suspense boundaries with skeleton fallbacks. Unify branding via CSS custom properties injected from tenant config. Fix earnings layout inconsistency. Unify currency to PHP standard. Remove dead `/portal/activity` link. Audit all inline styles, `useQuery` calls, and USD hardcodes before starting.

2. **Phase 2 — Reports + Visual Alignment:** Build new `/portal/reports` page with earnings trend charts, top links ranking, conversion funnel, and period comparison (establishes new component conventions on a clean slate). Simultaneously apply a light visual refresh across all 5 existing pages — consistent card border-radius, spacing, remove remaining inline styles, use CSS custom properties — so ALL pages share a cohesive visual language when Reports ships.

3. **Phase 3 — Home + Earnings Deep UX:** Full component restructuring for Home (merged hero metrics, slim referral bar, enhanced activity feed, quick actions) and Earnings (simplified 3-balance metrics, unified commission+payout feed with tab toggle, improved filter chips). Builds on the established visual language from Phase 2.

### Scope

**In Scope:**
- Shared portal layout extraction with `(public)` and `(authenticated)` route groups
- Suspense boundaries with skeleton fallbacks for all protected pages
- **Skeleton-to-content parity enforcement** — skeletons must match final layout structure exactly to prevent visual "jump" on data load
- CSS custom properties for tenant branding (replacing inline styles)
- **CSS custom property injection in ROOT portal layout** — injects `--portal-primary`, `--portal-logo`, `--portal-name` at the root level so both public (login/register) and authenticated pages share branding without inline styles
- Currency unification (PHP standard)
- Earnings page layout fix (remove `fixed` positioning, use flex like all other pages)
- Dead `/portal/activity` link removal from `RecentActivityFeed.tsx`
- New Reports page (`/portal/reports`) with:
  - Summary cards with trend indicators (earnings, clicks, conversions, conversion rate) and period-over-period comparison
  - Earnings trend area chart (current period + optional comparison period overlay)
  - Top links ranking (numbered list sorted by clicks/conversions/earnings)
  - Conversion funnel visualization using **plain English labels**: "89 people clicked your link → 12 signed up → 8 became paying customers" — NOT technical funnel language ("clicks → conversions → earnings")
  - Period selector: 7 days, 30 days, 90 days, This Month, Last Month (preset only)
  - Comparison toggle to overlay previous period on chart and show trend arrows on cards
  - Contextual insight tips next to key metrics — **must be encouraging, framing drops as opportunities not failures**: e.g., "Your clicks dropped 5% this week. Try sharing your link in a different group chat — new audiences can boost your results!" NOT "Your performance is declining." Static tips initially, extensible to AI-generated later.
  - Contextual empty states ("No activity this week — share your link to start earning!")
- New Convex indexes: `by_affiliate_created` compound index `[affiliateId, _creationTime]` on `commissions`, `clicks`, `conversions`
- New Convex queries for reports: earnings chart data, links ranking, funnel aggregation, period comparison
- Home page UX overhaul (Phase 3):
  - Merge `WelcomeBanner` + `EarningsSummaryGrid` → new `HeroMetrics` component (greeting + primary metric + 4 compact stat tiles)
  - Slim down `QuickLinkCard` → new `ReferralLinkBar` (always-visible, persistent below hero)
  - Enhance `RecentActivityFeed` → add customer names and contextual descriptions
  - New `QuickActions` row: **"Share Link" (one-tap Web Share API with WhatsApp as top option), "My Links", "Withdraw"** — NOT "View Campaigns" (affiliates don't think in campaigns, they think in links)
  - **Pending approval state:** Show specific review timeline ("Your application is under review. We'll email you within 48 hours.") with muted overlay — not a generic "pending" card
- Earnings page UX overhaul (Phase 3):
  - Simplified 3-balance hero (Available/Pending/Paid Out) replacing current 5-number display
  - **"Withdraw" CTA button directly on the Available balance card** when available > 0 — no need to navigate to another page to initiate withdrawal
  - **Client-side unified feed** — merge existing `getAffiliateCommissions` + `getAffiliatePayoutHistory` arrays by date, sort descending. No new Convex query needed.
  - **Tab toggle on unified feed: "All Activity" | "Commissions Only" | "Payouts Only"** — client-side filtering of the merged array. Respects that affiliates have separate mental models for commissions vs. payouts.
  - Pill-shaped filter chips (period + status) replacing separate dropdowns
  - Remove `ConfirmedCommissionCard` — single-commission hero card adds no value over the list
  - **Commission detail drawer rewrite** — replace raw data fields ("effective rate", "sale amount", "commission type") with a plain English narrative: "You referred Alex M. on March 5. Alex signed up for the Pro plan. You earned ₱500." Keep technical details available in a collapsible "Details" section below the narrative.
  - Keep `CommissionDetailDrawer` component — good pattern, new content
- Light visual refresh across all 5 existing pages (Phase 2, alongside Reports):
  - Consistent card border-radius, spacing, and shadow using design system variables
  - Remove all remaining inline `style` branding — use `var(--portal-primary)` throughout
  - Links: better visual hierarchy, **Web Share API integration** for one-tap sharing to WhatsApp/Facebook/Messenger/etc. (with fallback to clipboard copy on unsupported browsers), WhatsApp category in promo library
  - Assets: prettier cards, clearer categories, improved empty state
  - Account: minor polish (already well-structured)
- Navigation update: 6 items across sidebar and bottom nav (add Reports with 📊 icon)
- **Mobile bottom nav overflow handling** — if 6 items too cramped on small screens (iPhone SE / 320px), implement "More..." overflow menu collapsing least-used items
- Contextual empty states across all pages (explain why empty, what to do, action button)

**Out of Scope:**
- CSV/PDF export from Reports
- Custom date range builders (preset periods only)
- Advanced segmentation (by country, device, referrer, etc.)
- Real-time streaming dashboards (near-real-time via Convex subscriptions is fine)
- Notification system
- New auth flow changes (login/register pages stay as-is)
- Dark mode for portal
- Admin-facing changes (separate concern)
- Campaign-specific affiliate pages
- Activity page (dead link removed, not rebuilt)
- AI-generated insight tips (static tips only; AI generation is a future enhancement)
- **Portal event tracking / analytics (`portalEvents` table)** — deferred to a separate analytics spec. The redesign should stand on its own without instrumentation.

## Context for Development

### Codebase Patterns

- **Convex new function syntax** — All queries/mutations use `query({ args, returns, handler })` pattern
- **Validators required** — ALL functions must have `args` and `returns` validators
- **No dynamic imports in queries/mutations** — Static imports only; dynamic `await import()` only works in `action`/`httpAction`
- **Suspense boundaries mandatory** — Client components using `useQuery`/`useMutation` MUST be wrapped in `<Suspense>` with skeleton fallbacks (Next.js 16 streaming SSR requirement)
- **Button motion built-in** — All buttons use `<Button>` from `@/components/ui/button` with built-in `btn-motion` CSS. Never use raw `<button>`. Never add inline animation classes to `<Button>`.
- **CSS custom properties in `globals.css`** — Rich set of `--brand-*`, `--color-*`, `--shadow-*`, `--spacing-*`, `--radius-*`, `--font-*` variables already defined. Dark mode overrides in `.dark` class. Portal pages currently ignore these and use inline styles from `tenant.branding.primaryColor`.
- **Tailwind v4** — Utility classes for all styling. `cn()` utility for conditional classes. Mobile-first responsive: `text-sm md:text-base`.
- **No unbounded `.collect()`** — High-volume tables (`clicks`, `conversions`, `commissions`, `payouts`) must use `.take(N)`, `.paginate()`, or read from `tenantStats`. See scalability guidelines doc.
- **Route protection via proxy** — `src/proxy.ts` handles auth enforcement at the edge. Protected portal routes redirect unauthenticated users to `/portal/login?callbackUrl=<path>`.
- **Branding data shape** — `tenant.branding` has `{ logoUrl?, primaryColor?, portalName?, assetGuidelines?, customDomain?, domainStatus?, domainVerifiedAt?, sslProvisionedAt? }`. Portal receives subset: `{ logoUrl?, primaryColor?, portalName? }`.
- **Existing chart library** — Recharts 3.8.1 already installed. No new dependency needed.
- **Existing animation library** — Motion 12.38.0 already installed (Framer Motion successor).
- **URL state management** — `nuqs` v2.8.9 installed for URL search param state.
- **Drawer component** — `vaul` v1.1.2 installed for drawer/sheet patterns.
- **Date utilities** — `date-fns` installed for date formatting and manipulation.
- **Currency formatting** — `src/lib/format.ts` already exists with `formatCurrency(amount, currency="PHP")`, `formatCurrencyCompact`, `formatDate`, `formatDateTime`, `getInitials`. BUT ~30+ ad-hoc `Intl.NumberFormat` calls across the codebase don't use it. Portal earnings components (CommissionDetailDrawer, CommissionItem, ConfirmedCommissionCard) hardcode "USD" while home components use "PHP". All portal components MUST be migrated to import from `@/lib/format`.
- **Portal nav structure** — Hardcoded 5-item arrays in `PortalSidebar.tsx` and `PortalBottomNav.tsx`. Items: Home, Earnings, Links, Assets, Account. Icons: Home, DollarSign, Link2, Images, User.
- **Skeleton component** — `src/components/ui/skeleton.tsx` exists (shadcn style, used in 57 files but only 1 portal file). No `loading.tsx` files. Suspense uses inline/local skeletons.
- **Web Share API** — Already used in 3 portal files with `navigator.share()` + clipboard fallback. Pattern established.
- **`adjustColor` duplication** — In WelcomeBanner, EarningsHero, login, register. Extract to shared utility.
- **Inline styles: 68 instances** across portal + 17 in shared components. Almost all for `primaryColor` theming.
- **`primaryColor` prop drilling** — 9 page files extract it, drill to 19 children. Root layout injection eliminates ALL.
- **`portalName` fallback inconsistency** — "Affiliate Portal" vs "Affiliate Program" vs "our affiliate program".
- **Route protection safe** — `proxy.ts` checks incoming URL pathname, NOT filesystem. `callbackUrl` preserved. No proxy changes needed.
- **`conversions.affiliateId` is `v.optional()`** — Report queries must handle undefined.
- **`referralLinks` has NO `clickCount`/`conversionCount`** — Query `clicks`/`conversions` tables for Top Links.
- **No compound `[affiliateId, _creationTime]` indexes** on any table — all three need new indexes.
- **`conversions` has NO `affiliateId` index at all** — most significant gap.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/ui/skeleton.tsx` | Base Skeleton component for Suspense fallbacks |
| `src/lib/format.ts` | Existing formatCurrency, formatDate, formatDateTime utilities |
| `src/lib/utils.ts` | cn(), downloadCsv, commission rate utilities |
| `src/app/globals.css` | 927 lines of CSS custom properties |
| `src/proxy.ts` | Route protection, callbackUrl handling |
| `convex/schema.ts` | Table and index definitions |
| `convex/affiliateAuth.ts` | All 7 affiliate queries |
| `convex/commissions.ts` | getAffiliateCommissions query |
| `src/components/affiliate/PortalHeader.tsx` | Props: logoUrl?, portalName, primaryColor, pageTitle, pageDescription? |
| `src/components/affiliate/PortalSidebar.tsx` | 67 lines, hardcoded 5-item nav |
| `src/components/affiliate/PortalBottomNav.tsx` | 50 lines, hardcoded 5-item nav, dead portalName prop |
| `src/app/portal/earnings/components/CommissionDetailDrawer.tsx` | STATUS_STYLES, CommissionComputationSection |
| `src/app/portal/earnings/components/EarningsHero.tsx` | Own useQuery, own adjustColor |
| `src/app/portal/links/components/ReferralLinkCard.tsx` | Vanity slug editor, Web Share API |
| `src/app/portal/home/components/QuickLinkCard.tsx` | UTM builder, copy/share |
| `src/app/portal/account/components/PasswordSection.tsx` | Show/hide toggles, validation |

### Technical Decisions

**ADR 1: Layout Extraction — Route Groups with Shared Layout**
- Restructure `src/app/portal/` into `(public)/` (login, register, forgot-password, reset-password) and `(authenticated)/` (home, earnings, links, assets, account, reports) route groups
- New `src/app/portal/layout.tsx` — root portal layout, resolves tenant branding, injects CSS custom properties, wraps children
- New `src/app/portal/(authenticated)/layout.tsx` — shared shell with `PortalHeader` + `PortalSidebar` + `PortalBottomNav`
- Public pages inherit root portal layout (which provides CSS custom properties) but NOT the nav shell
- Route paths remain identical: `/portal/home`, `/portal/earnings`, etc.
- **Post-migration verification:** Test full auth redirect flow (`/portal/home` → redirect to `/portal/login?callbackUrl=/portal/home` → login → redirect back) to ensure `callbackUrl` preservation
- Rationale: URL paths don't change (route groups are transparent), eliminates 5x layout duplication, single place to update navigation. Root layout injection ensures BOTH public and authenticated pages get CSS custom properties.

**ADR 2: Branding via CSS Custom Properties (Server Component Layout + Client Sync)**
- Root portal layout is a **Server Component** that preserves SSR streaming — it wraps `{children}` in a `<div>` with default CSS custom properties from `globals.css`
- Inside the layout, a thin `"use client"` component `<PortalBrandingSync />` calls `useQuery(api.affiliateAuth.getCurrentAffiliate)` and, once resolved, sets CSS custom properties on the wrapper div via `useEffect` + `ref.current.style.setProperty("--portal-primary", ...)`
- **This preserves SSR streaming** — the Server Component renders the HTML shell immediately, the browser paints the skeleton, THEN the client component hydrates and applies branding without blocking. Mobile affiliates on slow connections see content faster.
- **Public pages (login/register):** Remain Server Components that resolve their own branding via `?tenant=<slug>` URL param and `fetchQuery(api.affiliateAuth.getAffiliateTenantContext)`. The `<PortalBrandingSync />` client component runs but has no effect on public pages (no authenticated affiliate → no-op). Public pages that handle their own branding continue to work independently.
- **Loading state:** While the affiliate query loads, the wrapper div uses default CSS custom properties from `globals.css` (`--brand-primary: #1c2260`). If the tenant uses a different primary color, there is a brief paint from default → brand color. This is acceptable because: (a) the default (`#1c2260`) is a neutral dark blue, (b) the transition is nearly instant (single React state update), (c) the page skeleton loads fast via SSR. For tenants where this flash is unacceptable, a future enhancement could pass the tenant slug as a URL search param on all portal links, enabling server-side resolution.
- Components reference `var(--portal-primary)` via Tailwind arbitrary values or utility classes
- Falls back to default `--brand-primary` from `globals.css` when no tenant branding
- **Branding updates propagate instantly** — CSS custom properties are set from `getCurrentAffiliate` query result. When a SaaS owner changes their primary color, the next page load reflects it immediately. No cache delay.
- Rationale: Server Component layout preserves streaming SSR (critical for mobile performance in PH/SEA target market). Client wrapper is a ~30-line component that only sets CSS variables on mount. Eliminates inline style soup. Enables dark mode support in future.

**ADR 3: Currency Standardization — PHP with Tenant Override**
- All affiliate-facing components use `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`
- Currency derived from `tenant.branding` or `tenant.currency` if available; PHP as default
- Shared `formatCurrency(amount, currency?)` utility in `src/lib/format.ts`
- Rationale: Target market is PH/SEA; PHP is the standard; tenant override supports future multi-currency

**ADR 4: Reports Data — Compound Index + Server-Side Aggregation**
- New compound indexes `by_affiliate_created [affiliateId, _creationTime]` on `commissions`, `clicks`, `conversions`
- All chart/aggregation queries use these indexes for efficient date-range filtering
- Aggregation done server-side in Convex query handlers (not client-side)
- `.paginate()` with `numItems: 1000` on all queries — prevents silent data truncation that `.take()` causes, while still bounding memory usage
- **Deploy indexes before feature code** — deploy indexes in a separate PR, monitor Convex dashboard for 24h, then merge Reports feature code
- **Deploy during low-traffic window** — backfill on high-volume `conversions` table may cause temporary performance degradation
- Rationale: Single compound index serves both date-range filtering and affiliate scoping; server-side aggregation reduces client payload; pagination prevents silent truncation

**ADR 5: Earnings Unified Feed — Client-Side Merge with Tab Toggle**
- **No new Convex query.** Use existing `getAffiliateCommissions` and `getAffiliatePayoutHistory` queries
- Client-side merge: combine both arrays, map to a common shape (`{ type, amount, status, date, description }`), sort by date descending
- **Default view: "All Activity"** — merged chronological feed
- **Tab options: "Commissions Only" | "Payouts Only"** — client-side filter on the `type` field
- Rationale: Existing queries already return enriched data (campaign names, customer emails, batch metadata). No need for a new complex server-side join. Client-side merge of ~100-200 items is instant. Simpler implementation, fewer moving parts, uses proven queries.

**ADR 6: Recharts for Reports Charts**
- Use existing Recharts 3.8.1 (already installed, no new dependency)
- Area chart for earnings trend, bar chart for daily clicks (if needed)
- Responsive containers via `ResponsiveContainer`
- Brand primary color (via `var(--portal-primary)`) for chart fill/stroke
- Rationale: Already in stack, lightweight, SSR-compatible, well-typed

**ADR 7: Nav Components — Configurable via Props with Mobile Overflow**
- Refactor `PortalSidebar` and `PortalBottomNav` to accept `items` prop (array of `{ name, href, icon }`) instead of hardcoded arrays
- Default items array provided by shared authenticated layout
- **Mobile bottom nav:** If 6 items prove too cramped on small screens (< 375px), implement a "More..." overflow that collapses the 6th item (Reports) into a popover menu. Test on iPhone SE (320px) before finalizing.
- Rationale: Adding/removing nav items requires editing layout only; mobile overflow prevents tappable-area issues on small devices

## Implementation Plan

### Phase 1 — Foundation Refactor (Zero Visual Regression)

- [ ] Task 1.1: Prerequisite audit — count and document all inline `style` props, `useQuery` calls, and `"USD"` hardcodes across portal components
  - Files: All files under `src/app/portal/`, `src/components/affiliate/`, AND `convex/affiliateAuth.ts`, `convex/commissions.ts`
  - Action: Run greps across both frontend and Convex backend. Document counts for: (a) all inline `style` props in portal components, (b) all `useQuery` calls that need Suspense wrappers, (c) all `"USD"` hardcodes, (d) all unbounded `.collect()` or `for await` on high-volume tables (clicks, conversions, commissions) in Convex queries. This audit IS the Phase 1 definition-of-done gate — no Phase 1 task starts without it.
  - Notes: Use `rg` for `style=\{\{`, `useQuery`, `"USD"`, `.collect\(\)`, `for await`. The Convex backend audit is critical — `getAffiliatePortalDashboardStats` (affiliateAuth.ts:1033-1055) uses unbounded `for await` on clicks and `.collect()` on ALL tenant conversions then JS-filters to one affiliate. These backend queries power the portal pages and are just as important to audit as frontend patterns.

- [ ] Task 1.2: Create `src/lib/portal-utils.ts` — shared color utility functions
  - File: `src/lib/portal-utils.ts` (NEW)
  - Action: Extract `adjustColor()` and `darkenColor()` from `WelcomeBanner.tsx` and `EarningsHero.tsx`. Export both as named functions. Also export `getPortalName(portalName?: string)` returning the provided name or fallback `"Affiliate Portal"`.
  - Notes: These are pure functions with no dependencies. Used by Tasks 1.5, 1.6, 1.8, and Phase 2/3 tasks.

- [ ] Task 1.3: Create `src/app/portal/layout.tsx` — root portal layout + `PortalBrandingSync` client component
  - File: `src/app/portal/layout.tsx` (NEW), `src/components/affiliate/PortalBrandingSync.tsx` (NEW)
  - Action:
    - Create `layout.tsx` as a **Server Component** that renders a wrapper `<div>` (with default CSS custom properties via `className` referencing `globals.css` defaults) containing `{children}` and `<PortalBrandingSync />`.
    - Create `PortalBrandingSync.tsx` as a thin `"use client"` component (~30 lines) that: (a) calls `useQuery(api.affiliateAuth.getCurrentAffiliate)`, (b) on query resolution, sets CSS custom properties on `document.documentElement.style.setProperty("--portal-primary", ...)` (NOT on a parent div ref — a child component cannot hold a ref to a parent DOM element in React). Sets `--portal-primary`, `--portal-logo` (as a data attribute `data-portal-logo` since CSS custom properties can't hold URL values), `--portal-name` (as a data attribute `data-portal-name`). If no affiliate (public routes), this is a no-op.
    - **This preserves SSR streaming** — the Server Component renders HTML immediately, then the client component hydrates and applies branding without blocking the initial paint.
    - **Cookie-based pre-rendering (optional, for tenants with non-default brand colors):** In the authenticated layout (Task 1.5), after `useQuery(getCurrentAffiliate)` resolves, set a `tenant_brand` cookie with `{ primaryColor, portalName, logoUrl }`. In the root Server Component layout (this task), read the cookie via `cookies()` from `next/headers` and inject a `<script>` tag that pre-sets CSS custom properties on `document.documentElement` before React hydrates. This eliminates the default→brand flash for returning visitors. For first-time visitors (no cookie), the flash is brief (~200ms) and acceptable.
  - Notes: The root layout is a Server Component, NOT `"use client"`. The `<PortalBrandingSync />` client component is a child that handles the dynamic branding. Public pages (login/register) handle their own branding independently via `searchParams.tenant` → `fetchQuery(api.affiliateAuth.getAffiliateTenantContext)`. Cookie-based pre-rendering is an optional enhancement — implement if time permits in Phase 1, or defer to a follow-up task.

- [ ] Task 1.4: Restructure portal directory into `(public)` and `(authenticated)` route groups
  - Files: Move existing files under `src/app/portal/` into route group folders
    - `src/app/portal/login/` → `src/app/portal/(public)/login/`
    - `src/app/portal/register/` → `src/app/portal/(public)/register/`
    - `src/app/portal/forgot-password/` → `src/app/portal/(public)/forgot-password/`
    - `src/app/portal/reset-password/` → `src/app/portal/(public)/reset-password/`
    - `src/app/portal/home/` → `src/app/portal/(authenticated)/home/`
    - `src/app/portal/earnings/` → `src/app/portal/(authenticated)/earnings/`
    - `src/app/portal/links/` → `src/app/portal/(authenticated)/links/`
    - `src/app/portal/assets/` → `src/app/portal/(authenticated)/assets/`
    - `src/app/portal/account/` → `src/app/portal/(authenticated)/account/`
  - Action: Create route group directories. Move files using `git mv` to preserve history. Verify URL paths remain identical (`/portal/home`, `/portal/earnings`, etc.). Route groups are URL-transparent.
  - Notes: CRITICAL — verify `callbackUrl` redirect flow works end-to-end after move. Run `pnpm dev` and test: visit `/portal/home` → redirect to `/portal/login?callbackUrl=/portal/home` → sign in → redirect back to `/portal/home`. Also update any test files that import from old paths (e.g., `register/page.test.tsx` imports from `src/app/portal/register/page` — must update to `src/app/portal/(public)/register/page`).

- [ ] Task 1.5: Create `src/app/portal/(authenticated)/layout.tsx` — shared nav shell + cleanup duplicated page logic
  - File: `src/app/portal/(authenticated)/layout.tsx` (NEW)
  - Action: Create a Client Component (needs `useQuery` for affiliate data) that renders `PortalHeader` + `PortalSidebar` + `PortalBottomNav` + `{children}`. **Handle session expiry:** if `useQuery(getCurrentAffiliate)` returns `null` (session expired while user was on the page), show a minimal "Session expired" overlay with a "Sign in again" button that navigates to `/portal/login`, instead of rendering the full nav shell with exposed links. If the query returns `undefined` (still loading), show the skeleton nav. Only render the full layout when `affiliate` is a valid object. Remove duplicated header/sidebar/bottom-nav construction from all 5 authenticated page files (`home/page.tsx`, `earnings/page.tsx`, `links/page.tsx`, `assets/page.tsx`, `account/page.tsx`).
  - **Also remove from each page file (where applicable):** (a) `handleLogout` function and `authClient` import — `PortalHeader` already has its own `handleLogout` at `PortalHeader.tsx:17-37`, so the page-level copies become dead code. Present in 4 of 5 pages: home (line 75), earnings (line 52), links (line 44), assets (line 41). The account page does NOT have `handleLogout` — skip it. (b) `useEffect` auth redirect guards (`useEffect(() => { if (!isLoading && !isAuthenticated) router.push("/portal/login") }, ...)`) — redundant since the shared layout handles auth state and `proxy.ts` handles unauthenticated redirects at the edge. Present in all 5 pages.
  - Notes: The authenticated layout receives branding from the parent root portal layout via CSS custom properties — NO prop drilling needed for `primaryColor`, `logoUrl`, `portalName`. However, `PortalHeader` currently expects `portalName` and `logoUrl` as explicit props (they can't use CSS custom properties — see Task 1.6). Pass these from the layout's `useQuery` result. **SSR trade-off acknowledged:** This layout is `"use client"` so the header/sidebar/bottom nav shell is client-rendered, not streamed. This is acceptable because: (a) the page CONTENT inside `{children}` is still wrapped in `<Suspense>` boundaries with server-rendered skeletons, (b) the nav shell is lightweight (~3KB), (c) the root Server Component layout (Task 1.3) still streams the outer HTML structure.

- [ ] Task 1.6: Update nav components to remove prop-drilled branding, accept `items` prop
  - Files: `src/components/affiliate/PortalHeader.tsx`, `src/components/affiliate/PortalSidebar.tsx`, `src/components/affiliate/PortalBottomNav.tsx`
  - Action:
    - `PortalHeader`: Make `primaryColor` optional (read from CSS custom property `var(--portal-primary)` via computed style when not provided). **`portalName` and `logoUrl` must REMAIN as explicit props** — they are rendered as React text content (`{portalName}`) and `img src` attribute respectively, which cannot use CSS custom properties. The authenticated layout (Task 1.5) passes these props from `useQuery(api.affiliateAuth.getCurrentAffiliate)` result. Keep `pageTitle` and `pageDescription` as required props.
    - `PortalSidebar`: Replace hardcoded 5-item array with `items` prop. Default: `[{ name: "Home", href: "/portal/home", icon: Home }, { name: "Earnings", href: "/portal/earnings", icon: DollarSign }, { name: "Links", href: "/portal/links", icon: Link2 }, { name: "Assets", href: "/portal/assets", icon: Images }, { name: "Account", href: "/portal/account", icon: User }, { name: "Reports", href: "/portal/reports", icon: BarChart3 }]`. Read `primaryColor` from CSS custom property.
    - `PortalBottomNav`: Same as sidebar — accept `items` prop with same default. Remove dead `portalName` prop. Test 6-item layout on small screens (320px). If too cramped, add "More..." overflow for 6th item.
  - Notes: The `items` prop enables easy addition/removal of nav items from the layout only. The default 6-item array adds Reports (BarChart3 icon from lucide-react).

- [ ] Task 1.7: Remove inline `style` branding from all portal components
  - Files: All portal component files with `style={{ color: primaryColor, backgroundColor: primaryColor, ... }}` (68 instances per audit) AND `src/components/affiliate/AuthTabs.tsx`
  - Action: Replace each inline style with Tailwind arbitrary value using CSS custom property. Pattern: `style={{ color: primaryColor }}` → `className="text-[var(--portal-primary)]"`. `style={{ backgroundColor: primaryColor }}` → `className="bg-[var(--portal-primary)]"`. Remove `primaryColor` prop from component signatures where no longer needed.
  - **AuthTabs.tsx specifically:** Replace `bg-[${primaryColor}]` (line 18-19) with `bg-[var(--portal-primary)]`. The current pattern uses string interpolation to build a Tailwind arbitrary value at runtime, which Tailwind v4 cannot detect at build time — the active tab background color silently fails. After migration, `AuthTabs` reads from CSS custom property instead.
  - Also fix: `AffiliateSignInForm.tsx` and `AffiliateSignUpForm.tsx` — both have inline styles for `primaryColor` that must be migrated to CSS custom properties.
  - **Derived colors (lighter/darker variants):** Wherever `adjustColor(primaryColor, 0.1)` is used to create lighter/darker brand variants, replace with Tailwind opacity modifiers on the CSS custom property: `bg-[var(--portal-primary)]/10` for 10% opacity, `bg-[var(--portal-primary)]/80` for 80%, etc. This avoids the cascading flash problem where `adjustColor` reads the CSS variable before `PortalBrandingSync` has hydrated (getting wrong default color → brief flash → correct color). Tailwind opacity modifiers work with the computed value at render time, so they're always consistent. For cases where a computed hex is truly needed (e.g., passing to a third-party component), use `portal-utils.ts` functions but only AFTER the `useQuery` has resolved — wrap in a conditional render or use the `primaryColor` from the query result directly.

- [ ] Task 1.7b: Remove `<style jsx global>` CSS variable clobbering from earnings page
  - File: `src/app/portal/(authenticated)/earnings/page.tsx` (lines 116-132)
  - Action: Delete the entire `<style jsx global>{`:root { ... }}</style>` block that overwrites `--brand`, `--brand-light`, `--brand-dark`, `--text-heading`, `--text-body`, `--text-muted`, `--bg-page`, `--bg-surface`, `--border`, and all status colors at the `:root` level. This is MORE destructive than inline styles because it clobbers ALL pages' CSS variables, not just the earnings page. Replace with nothing — the root portal layout (Task 1.3) now injects `--portal-primary` and `globals.css` provides all other defaults.
  - Notes: This MUST happen before or alongside Task 1.7. If this block remains, it will override the root layout's CSS custom property injection. Also remove the `tenantPrimaryColor` variable that feeds this block.

- [ ] Task 1.8: Migrate all portal components to `formatCurrency()` from `@/lib/format`
  - Files: `CommissionDetailDrawer.tsx`, `CommissionItem.tsx`, `ConfirmedCommissionCard.tsx`, `EarningsHero.tsx`, `WelcomeBanner.tsx`, `EarningsSummaryGrid.tsx`, `PayoutHistory.tsx`, `PayoutBanner.tsx`, `PayoutMethodInfo.tsx`
  - Action: Replace all `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })` and `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` calls with `formatCurrency(amount)` import from `@/lib/format`. Replace all hardcoded `"USD"` strings with `"PHP"` (or remove currency param entirely since PHP is the default in `formatCurrency`).
  - Notes: `formatCurrency` already defaults to PHP. Some components pass currency as prop — update those to default to "PHP" or remove the prop if always PHP.

- [ ] Task 1.9: Fix earnings page layout — remove `fixed` positioning, align with flex layout
  - File: `src/app/portal/(authenticated)/earnings/page.tsx`
  - Action: Remove `fixed` sidebar positioning and `md:ml-[220px]` content offset. Match the flex-based layout pattern used by all other portal pages (sidebar + content side by side via flex). **Normalize sidebar width:** earnings page uses `w-[220px]` while all other pages use `w-56` (224px). After shared layout extraction (Task 1.5), the sidebar width is defined once in the layout — use `w-56` as the standard.
  - Notes: After Task 1.5 extracts the shared layout, this page file becomes much simpler. The layout inconsistency was caused by inline sidebar management instead of using the shared layout.

- [ ] Task 1.10: Add `<Suspense>` boundaries with skeleton fallbacks to all 5 authenticated pages
  - Files: `home/page.tsx`, `earnings/page.tsx`, `links/page.tsx`, `assets/page.tsx`, `account/page.tsx` (all under `(authenticated)/`)
  - Action: For each page, (a) extract the current page content into a `PageContent` inner component, (b) create a matching `PageSkeleton` component that mirrors the page's card layout and grid structure, (c) wrap `PageContent` in `<Suspense fallback={<PageSkeleton />}>`. The skeleton MUST match the final layout (same number of cards, same grid columns, same heights) to prevent visual jump on data load.
  - Notes: Use `<Skeleton>` from `src/components/ui/skeleton.tsx`. Each page already has a known card structure — replicate it with skeleton rectangles. Example: Home has a welcome banner (full-width skeleton) + 3 stat cards (3-col grid of skeleton cards) + activity feed (stacked skeleton lines).

- [ ] Task 1.11: Remove dead `/portal/activity` link from `RecentActivityFeed.tsx`
  - File: `src/app/portal/(authenticated)/home/components/RecentActivityFeed.tsx`
  - Action: Remove the "View all activity" link that points to `/portal/activity` (a non-existent page).
  - Notes: Small cleanup. The Activity page is out of scope.

- [ ] Task 1.12: Phase 1 verification — full smoke test of all portal routes
  - Action: Run `pnpm dev`. Manually verify: (a) `/portal/login` renders with brand color via CSS custom property, (b) `/portal/register` same, (c) `/portal/home` → redirect to login → login → redirect back, (d) all 5 authenticated pages render correctly with shared layout, (e) earnings page uses flex layout (not fixed), (f) no visual regression compared to pre-Phase-1 screenshots, (g) currency displays as PHP everywhere, (h) no console errors.
  - **Mobile loading sequence test (Jamie persona):** On a throttled 3G connection (Chrome DevTools), visit `/portal/home` and verify the loading sequence: (1) skeleton HTML paints immediately (SSR), (2) nav shell hydrates and branding colors appear (~200ms), (3) content data fills in via Suspense. There should NEVER be a blank white screen. The first paint should show the skeleton layout, not nothing.
  - Notes: This is a manual testing gate. No Phase 2 work starts until Phase 1 passes this checklist.

### Phase 2 — Reports Page + Visual Alignment

- [ ] Task 2.1: Add compound indexes to Convex schema
  - File: `convex/schema.ts`
  - Action: Add 4 new indexes:
    - `commissions`: index `by_affiliate_created` on `["affiliateId", "_creationTime"]`
    - `clicks`: index `by_affiliate_created` on `["affiliateId", "_creationTime"]`
    - `conversions`: index `by_affiliate_created` on `["affiliateId", "_creationTime"]`
    - `conversions`: index `by_affiliate` on `["affiliateId"]` (basic index, fills critical gap)
  - Notes: Deploy with `pnpm convex deploy`. The `conversions` table currently has NO `affiliateId` index — this is the most critical addition. Index backfill on high-volume tables is handled automatically by Convex.

- [ ] Task 2.1b: Fix existing unbounded conversion query in dashboard stats
  - File: `convex/affiliateAuth.ts` (specifically `getAffiliatePortalDashboardStats`, lines ~1050-1055)
  - Action: Refactor ONLY the conversions portion of the dashboard stats query:
    - **Conversions count:** Replace the tenant-wide `.collect()` + JS filter (line 1050-1055, fetches ALL tenant conversions then `c.filter(c => c.affiliateId === ...)`) with the new `by_affiliate` index on conversions. Query directly by `affiliateId` instead of fetching all tenant data. This is the WORST scalability offender in the portal — it fetches every conversion for the entire tenant on every home page load.
    - **Clicks count:** The existing `for await` on `by_affiliate` (line 1033-1044) is memory-efficient streaming iteration — it does NOT load all clicks into memory at once. **Leave this as-is.** Do NOT replace with `.take()` or `.paginate()` — that would require loading all clicks into memory to get an accurate total count. `for await` is the correct pattern for counting.
  - Notes: This fix directly benefits the Home page dashboard stats. The new `by_affiliate` index (Task 2.1) makes this fix possible. After this fix, the only remaining unbounded pattern in `getAffiliatePortalDashboardStats` is the clicks `for await` — which is intentional and safe.

- [ ] Task 2.2: Create `convex/affiliatePortalReports.ts` — Reports query functions
  - File: `convex/affiliatePortalReports.ts` (NEW)
  - Action: Create these Convex queries:
    - `getEarningsChartData(affiliateId, startDate, endDate)`: Uses `by_affiliate_created` index on `commissions`. Returns daily aggregated earnings `{ date, amount, count }[]` for chart rendering. Use `.paginate()` with `numItems: 1000` to handle high-volume affiliates without silent truncation.
    - `getClicksTrendData(affiliateId, startDate, endDate)`: Uses `by_affiliate_created` index on `clicks`. Returns daily click counts `{ date, count }[]`. Use `.paginate()` with `numItems: 1000`.
    - `getConversionFunnelData(affiliateId, startDate, endDate)`: Counts clicks (via `by_affiliate_created` on `clicks`) and conversions (via `by_affiliate_created` on `conversions`). Returns `{ clicks: number, conversions: number }`. **Important:** `conversions.affiliateId` is `v.optional()` — Convex compound indexes on optional fields exclude documents where the field is `undefined`. This is CORRECT behavior for affiliate reports: only conversions attributed to this affiliate should count. Coupon-only or organic conversions without affiliate attribution are intentionally excluded from the funnel.
    - `getTopLinks(affiliateId, startDate, endDate)`: Single-query approach — use `by_affiliate_created` index on `clicks` to fetch all clicks in date range, group by `referralLinkId` in-memory to count per link. Then do the same for `conversions`, group by `referralLinkId`. Merge the two grouped maps with the affiliate's referral links (from `referralLinks` table, `.take(50)`). Return top 10 sorted by conversions desc, then clicks desc. Total: 3 database round trips (links + clicks + conversions), NOT N+1.
  - Notes: ALL queries must have `args` and `returns` validators. Use `v.number()` for timestamps (Date.now() ms). Handle `affiliateId` being undefined in conversions. Use `.paginate()` with appropriate `numItems` per scalability guidelines — pagination prevents silent data truncation that `.take()` causes. For date-range queries, `numItems: 1000` is a safe upper bound (covers ~3 years of daily data points). The chart data queries should check `isDone` and if false, indicate to the UI that data is truncated. Do NOT use `.collect()` unbounded. **`getReportSummary` is intentionally omitted** — summary values (total earnings, total clicks, total conversions, conversion rate) are computed client-side from the chart/funnel data, avoiding 3 redundant Convex round-trips.

- [ ] Task 2.3: Create Reports page skeleton structure
  - File: `src/app/portal/(authenticated)/reports/page.tsx` (NEW)
  - Action: Create a Client Component with `<Suspense>` boundary. Structure:
    1. Period selector (7d, 30d, 90d, This Month, Last Month)
    2. Comparison toggle (checkbox/switch to enable period-over-period)
    3. Summary cards grid (4 cards: Earnings, Clicks, Conversions, Conversion Rate) with trend arrows
    4. Earnings trend area chart (Recharts `AreaChart`)
    5. Top Links ranking (numbered list)
    6. Conversion funnel (plain English labels: "X people clicked → Y signed up → Z became customers")
    7. Contextual insight tips (static text blocks next to key metrics)
    8. **"What to do next" action section** — a prominent, visually distinct card below the funnel/top links that gives the affiliate a single, specific action to take based on their data. Examples: "Your top link got 200 clicks but only 5 conversions (2.5%). Try sharing it with a personal message — affiliates who do this see 3x more sign-ups!" with a "Share Now" button. This is MORE prominent than the small static insight tips next to individual metrics. When data shows strong performance, the message should be encouraging: "Great month! You earned ₱12,500 from 8 referrals. Keep sharing your top-performing link."
    9. Empty state ("No activity this period — share your link to start earning!")
  - **Error boundaries:** Wrap each major section (SummaryCards, EarningsTrendChart, TopLinksRanking, ConversionFunnel) in individual React Error Boundaries (`class XErrorBoundary extends React.Component`). **Purpose clarification:** Error Boundaries catch rendering crashes (e.g., accessing `.property` on undefined data, Recharts receiving invalid data shape). They do NOT catch Convex query failures — those return `null` and are handled by each component's null checks (`if (!data) return <Skeleton />`). Error Boundary message: "Something went wrong displaying this section. Try refreshing the page." — not "Unable to load data" (which implies a fetch failure). A single section crash should NOT tank the entire Reports page.
  - Notes: Start with the skeleton layout using `<Skeleton>` components. Each sub-section becomes its own component (Tasks 2.4–2.8). Use `nuqs` for period state in URL (`?period=30d&compare=true`).

- [ ] Task 2.4: Create Reports components — PeriodSelector and ComparisonToggle
  - Files: `src/app/portal/(authenticated)/reports/components/PeriodSelector.tsx` (NEW), `ComparisonToggle.tsx` (NEW)
  - Action:
    - `PeriodSelector`: Pill-shaped button group with options: "7 Days", "30 Days", "90 Days", "This Month", "Last Month". Uses `nuqs` `useQueryState` for `period` param. Highlights active period with `bg-[var(--portal-primary)]`. **"All Time" is intentionally excluded** — it would require fetching unbounded data. If added later, cap at 12 months (`startDate = Date.now() - 365 * 24 * 60 * 60 * 1000`).
    - `ComparisonToggle`: A switch/toggle that enables "Compare with previous period". Uses `nuqs` for `compare` boolean param.
  - Notes: Both are pure client components. Period presets map to date ranges computed via `date-fns`.

- [ ] Task 2.5: Create Reports components — SummaryCards with trend indicators
  - File: `src/app/portal/(authenticated)/reports/components/SummaryCards.tsx` (NEW)
  - Action: 4-card responsive grid (`grid-cols-2 md:grid-cols-4`). Each card shows: metric label, current value (formatted via `formatCurrency` for earnings, a new `formatNumberCompact` for click/conversion counts when > 999 (e.g., "1.2K", "3.5M"), `toLocaleString()` for counts ≤ 999, percentage for conversion rate), trend arrow (up/down/neutral) with percentage change, and a brief insight tip below. When comparison is enabled, compute previous period values and show delta.
  - **Create `formatNumberCompact(n)` in `src/lib/format.ts`:** A new utility that formats numbers as compact strings WITHOUT currency symbol: `Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)` — produces "1.2K", "3.5M", "500". Do NOT use `formatCurrencyCompact` — it prepends "₱" which is wrong for non-currency counts.
  - **Summary values computed client-side** from `getEarningsChartData` (sum amounts for total earnings), `getClicksTrendData` (sum counts for total clicks), and `getConversionFunnelData` (use clicks and conversions directly). No separate `getReportSummary` query needed — this eliminates 3 Convex round-trips per page load.
  - Notes: Insight tips are static strings, selected based on metric direction. E.g., if clicks down: "Try sharing your link in a different group chat — new audiences can boost your results!"

- [ ] Task 2.6: Create Reports components — EarningsTrendChart
  - File: `src/app/portal/(authenticated)/reports/components/EarningsTrendChart.tsx` (NEW)
  - Action: Recharts `AreaChart` wrapped in `ResponsiveContainer`. X-axis: dates. Y-axis: PHP amounts. Fill color: `var(--portal-primary)` with opacity. When comparison enabled, overlay previous period as a dashed line. Uses `useQuery(api.affiliatePortalReports.getEarningsChartData)`. Wrapped in `<Suspense>` with chart skeleton. **Wrap the chart component in `React.memo`** and use `useMemo` for the transformed data array passed to Recharts — prevents unnecessary re-renders when parent state changes (e.g., period selector interaction).
  - Notes: Recharts is SSR-compatible but needs client component. Import `AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer` from `recharts`. Format tooltip values with `formatCurrency`.

- [ ] Task 2.7: Create Reports components — TopLinksRanking and ConversionFunnel
  - Files: `src/app/portal/(authenticated)/reports/components/TopLinksRanking.tsx` (NEW), `ConversionFunnel.tsx` (NEW)
  - Action:
    - `TopLinksRanking`: Numbered list (1-10) of referral links. Each row shows: rank number, link slug (truncated), click count, conversion count, earnings. Sort by conversions desc. Empty state: "No link activity this period."
    - `ConversionFunnel`: Vertical funnel visualization. Three stages with plain English labels: (1) "X people clicked your link", (2) "Y signed up (Z% conversion)", (3) "W became paying customers". Use CSS widths or bars to show relative proportions. Include encouraging insight tip below: "Tip: Personalized messages when sharing your link can boost sign-ups by up to 3x!"
  - Notes: The funnel is NOT a complex chart — use simple styled divs with width proportions. The labels are user-friendly, not technical.

- [ ] Task 2.8: Wire Reports page — connect all components with data flow
  - File: `src/app/portal/(authenticated)/reports/page.tsx`
  - Action: Connect `PeriodSelector` → `useQueryState('period')` → derived `startDate`/`endDate` → pass to all report queries. Connect `ComparisonToggle` → `useQueryState('compare')` → pass to `SummaryCards` and `EarningsTrendChart`. Add loading skeleton fallback. Add empty state check (if all metrics are 0, show encouraging empty state).
  - Notes: Date range computation: "7 Days" = today - 7d to today, "This Month" = start of current month to now, "Last Month" = start of last month to end of last month. Comparison period: if current is "30 Days", previous is 30 days before that.

- [ ] Task 2.9: Visual alignment pass — consistent card styling across all 5 existing pages
  - Files: All portal page components (home, earnings, links, assets, account)
  - Action: Apply consistent visual treatment across all pages:
    - Card border-radius: `rounded-xl` (12px) for all card containers
    - Card padding: `p-5` for standard cards, `p-6` for hero/featured cards
    - Card shadow: `shadow-sm` for standard, `shadow-md` for elevated
    - Card border: `border border-border/50` for subtle separation
    - Section spacing: `space-y-6` between major sections
    - Typography: consistent heading sizes (`text-lg font-semibold` for section titles)
    - Remove any remaining inline `style` props not caught in Task 1.7
  - Notes: This is a LIGHT touch — no component restructuring, just CSS class consistency. The goal is visual cohesion across all pages when Reports ships.

- [ ] Task 2.10: Visual alignment — Links page Web Share API integration
  - Files: `src/app/portal/(authenticated)/links/components/ReferralLinkCard.tsx`, `PromoLibrary.tsx`
  - Action: On `ReferralLinkCard`, add a "Share" button using the established `navigator.share()` pattern (already in 3 portal files). Share payload includes the referral URL. Fallback to clipboard copy on unsupported browsers. In `PromoLibrary`, add a "WhatsApp" category tab alongside existing social categories, since WhatsApp is the primary sharing channel in the PH/SEA market.
  - Notes: The Web Share API pattern is already established — copy from `QuickLinkCard.tsx` or `ReferralLinkCard.tsx` existing share logic.

- [ ] Task 2.11: Visual alignment — Assets and Account page polish
  - Files: `src/app/portal/(authenticated)/assets/components/AssetCard.tsx`, `AssetsEmptyState.tsx`, `src/app/portal/(authenticated)/account/components/ProfileSection.tsx`
  - Action:
    - `AssetCard`: Apply consistent card styling from Task 2.9. Add hover lift effect (subtle `hover:-translate-y-0.5 transition-transform`).
    - `AssetsEmptyState`: Improve empty state messaging — explain what assets are, why they're valuable, and add a "Contact your program manager" action.
    - `ProfileSection`: Minor polish — consistent spacing, clean form field alignment.
  - Notes: Account page was noted as "already well-structured" — minimal changes needed.

- [ ] Task 2.12: Phase 2 verification — visual consistency check across all 6 pages
  - Action: Run `pnpm dev`. Verify: (a) Reports page renders with all sections, (b) all 6 authenticated pages share consistent card/spacing/typography, (c) period selector and comparison toggle work on Reports, (d) empty states render on Reports with no data, (e) Web Share API works on Links page, (f) WhatsApp category visible in promo library, (g) no visual regression on existing pages.
  - Notes: Compare screenshots of all pages side-by-side to verify visual consistency.

### Phase 3 — Home + Earnings Deep UX Overhaul

- [ ] Task 3.1: Create Home page — HeroMetrics component (merge WelcomeBanner + EarningsSummaryGrid)
  - File: `src/app/portal/(authenticated)/home/components/HeroMetrics.tsx` (NEW)
  - Action: Replace `WelcomeBanner` + `EarningsSummaryGrid` with a single `HeroMetrics` component:
    - Top section: Greeting ("Good morning, [name]!") + primary metric (Available Earnings in large bold PHP) + "Withdraw" button if available > 0
    - Below: 4 compact stat tiles in a row: Total Earned, Pending, Conversions, Clicks
    - Use `var(--portal-primary)` for accent color (no inline styles)
    - Background: subtle gradient using brand primary color
  - Notes: Delete `WelcomeBanner.tsx` and `EarningsSummaryGrid.tsx` after migration. Import `formatCurrency` from `@/lib/format`.

- [ ] Task 3.2: Create Home page — ReferralLinkBar (slim replacement for QuickLinkCard)
  - File: `src/app/portal/(authenticated)/home/components/ReferralLinkBar.tsx` (NEW)
  - Action: A slim, always-visible bar below HeroMetrics showing:
    - Referral link URL (truncated with ellipsis)
    - "Copy" button (clipboard)
    - "Share" button (Web Share API with WhatsApp as top option)
    - Minimal height (`py-3 px-4`), compact design
  - Notes: Replaces the larger `QuickLinkCard`. Delete `QuickLinkCard.tsx` after migration. The referral link data comes from existing `useQuery(api.affiliateAuth.getAffiliateReferralLinks)`.

- [ ] Task 3.3: Create Home page — QuickActions component
  - File: `src/app/portal/(authenticated)/home/components/QuickActions.tsx` (NEW)
  - Action: A row of 3 action buttons:
    - "Share Link" — primary button, triggers Web Share API (WhatsApp-first)
    - "My Links" — outline button, navigates to `/portal/links`
    - "Withdraw" — outline button, navigates to earnings or triggers withdrawal (only shown if available > 0)
  - Notes: Uses `<Button>` component with `btn-motion` built in. These are the actions an affiliate takes most frequently — NOT "View Campaigns".

- [ ] Task 3.4: Enhance Home page — RecentActivityFeed improvements
  - File: `src/app/portal/(authenticated)/home/components/RecentActivityFeed.tsx`
  - Action: Enhance existing feed:
    - Add customer names (from conversion data) to commission entries: "Alex M. signed up for Pro plan — you earned ₱500"
    - Add contextual descriptions based on commission type
    - Show pending approval state with timeline: "Your application is under review. We'll email you within 48 hours." (when affiliate status is pending)
    - Remove dead `/portal/activity` link (already done in Task 1.11, verify it's still clean)
  - Notes: Commission data already includes customer info from the Convex query. Just format it better.

- [ ] Task 3.5: Create Home page — PendingApprovalState component
  - File: `src/app/portal/(authenticated)/home/components/PendingApprovalState.tsx` (NEW)
  - Action: A muted overlay/card shown when affiliate status is "pending". Content: "Your application is under review" title, "We typically review applications within 48 hours. We'll email you at [email] once you're approved. In the meantime, feel free to explore your dashboard." body. Styled with muted colors (`bg-muted/50 border border-muted`).
  - Notes: Check affiliate status from existing `useQuery(api.affiliateAuth.getCurrentAffiliate)`. Only render when `status === "pending"`.

- [ ] Task 3.6: Rewrite Home page.tsx — assemble new Home layout
  - File: `src/app/portal/(authenticated)/home/page.tsx`
  - Action: Replace current page content with new component hierarchy:
    1. `PendingApprovalState` (conditional, if status === "pending")
    2. `HeroMetrics`
    3. `ReferralLinkBar`
    4. `QuickActions`
    5. `RecentActivityFeed` (enhanced)
  - Notes: Update the skeleton to match new layout. All new components use `var(--portal-primary)`.

- [ ] Task 3.7: Create Earnings page — SimplifiedHero component (3-balance display)
  - File: `src/app/portal/(authenticated)/earnings/components/SimplifiedHero.tsx` (NEW)
  - Action: Replace `EarningsHero` with a cleaner hero showing 3 balances:
    - **Available**: Large, prominent, with "Withdraw" CTA button when > 0 (NOT just "View Payouts")
    - **Pending**: Smaller, muted, with tooltip "Waiting for confirmation"
    - **Paid Out**: Smaller, muted
    - Layout: horizontal flex on desktop, stacked on mobile
    - **"Withdraw" button click behavior:** Check payout method status from affiliate data. If payout method IS set → navigate to `/portal/earnings` with a withdrawal flow initiated (or open a simple modal with amount input and confirm button — implementation detail left to dev). If payout method is NOT set → navigate to account payout settings using `window.location.href = '/portal/account#payout'` (NOT `router.push` — Next.js doesn't preserve hash fragments on `router.push`). Add `id="payout"` to the payout section in the Account page (Task 2.11). Show a toast message: "Set up your payout method first to withdraw earnings."
  - Notes: Delete `EarningsHero.tsx` after migration. The "Withdraw" CTA directly on Available balance is a key UX insight from the focus group. Also applies to the QuickActions "Withdraw" button on the Home page (Task 3.3) — same behavior.

- [ ] Task 3.8: Create Earnings page — UnifiedFeed component
  - File: `src/app/portal/(authenticated)/earnings/components/UnifiedFeed.tsx` (NEW)
  - Action: Client-side merge of existing commission and payout data:
    1. Fetch commissions via `useQuery(api.commissions.getAffiliateCommissions)`
    2. Fetch payouts via `useQuery(api.affiliateAuth.getAffiliatePayoutHistory)`
    3. Map to common shape: `{ type: "commission" | "payout", amount, status, date, description, id }`
    4. Sort by date descending
    5. Tab toggle: "All Activity" (default) | "Commissions Only" | "Payouts Only" — client-side filter. **Tab toggle must be visually prominent: sticky position (`sticky top-0 z-10`) so it remains visible when the user scrolls through the feed. Use `bg-background/95 backdrop-blur-sm` for a subtle glass effect behind the sticky tabs. The active tab should have `bg-[var(--portal-primary)] text-white` styling to clearly indicate selection.**
    6. Each item renders as a list row with icon (commission = DollarSign, payout = ArrowDownCircle), description, amount, status badge, date
  - Notes: No new Convex query needed. Merging ~100-200 items is instant client-side.

- [ ] Task 3.9: Create Earnings page — FilterChips component
  - File: `src/app/portal/(authenticated)/earnings/components/FilterChips.tsx` (NEW)
  - Action: Pill-shaped filter chips replacing separate dropdowns:
    - Period chips: "All Time", "This Month", "Last Month", "Last 90 Days"
    - Status chips: **Remapped for unified feed (commissions + payouts):** "All", "Pending" (commissions with `status: "pending"` + payouts with `status: "pending"` or `"processing"`), "Completed" (commissions with `status: "approved"` or `"paid"` + payouts with `status: "paid"`), "Declined" (commissions with `status: "reversed"` or `"declined"` + payouts with `status: "failed"`). The old commission-specific labels ("Approved", "Paid", "Declined") don't map cleanly to payout statuses — the new labels are user-friendly and cover both item types.
    - Use `nuqs` for URL state (`?period=month&status=pending`)
    - Active chip: `bg-[var(--portal-primary)] text-white`. Inactive: `bg-muted text-muted-foreground`.
  - Notes: Replace `PeriodFilterTabs` and `StatusFilter` components. Delete both old files after migration.
  - **IMPORTANT — Period filtering must be server-side, NOT client-side:** The existing `getAffiliateCommissions` query already accepts `period: v.optional(v.string())` with values `"all" | "this_month" | "last_month" | "last_3_months"` and has server-side date filtering logic (`commissions.ts:578-595`). **Do NOT add parallel `startDate`/`endDate` args.** Instead, map the FilterChips period options to the existing `period` parameter values. Add `"last_90_days"` to the `getPeriodRange` switch in `commissions.ts` if not already supported. The FilterChips component maps: "This Month" → `"this_month"`, "Last Month" → `"last_month"`, "Last 90 Days" → `"last_3_months"` (or add new value), "All Time" → `"all"` (or omit period param).

- [ ] Task 3.10: Rewrite Earnings page — CommissionDetailDrawer narrative content
  - File: `src/app/portal/(authenticated)/earnings/components/CommissionDetailDrawer.tsx`
  - Action: Rewrite the drawer content section:
    - Top: Plain English narrative: "You referred [customer name] on [date]. They signed up for [plan name]. You earned ₱[amount]." **Fallbacks:** If `customerName` is missing/undefined → "A new user"; if `planName` is missing → "a subscription". Example with missing data: "A new user signed up for a subscription on March 5. You earned ₱500."
    - Middle: Status timeline with clear labels (Pending → Approved → Paid with dates)
    - Bottom: Collapsible "Details" section with technical fields (effective rate, sale amount, commission type, campaign name) — collapsed by default
  - Notes: Keep the drawer component structure (vaul Drawer pattern). Just change the content layout and copy.

- [ ] Task 3.11: Rewrite Earnings page.tsx — assemble new Earnings layout
  - File: `src/app/portal/(authenticated)/earnings/page.tsx`
  - Action: Replace current page content with new component hierarchy:
    1. `PayoutBanner` (keep if payout method not set — existing component)
    2. `SimplifiedHero`
    3. `FilterChips`
    4. `UnifiedFeed` (with `CommissionDetailDrawer` as sheet)
  - **Delete these files:** `ConfirmedCommissionCard.tsx`, `EarningsHero.tsx`, `CommissionList.tsx`, `CommissionItem.tsx`, `PeriodFilterTabs.tsx`, `StatusFilter.tsx`
  - Notes: Keep `PayoutBanner.tsx`, `PayoutMethodInfo.tsx`, `PayoutHistory.tsx` (they may be referenced by the unified feed for payout detail view). `ConfirmedCommissionCard.tsx` deletion is tracked explicitly here — it is no longer imported by any component after `EarningsHero` is removed.

- [ ] Task 3.12: Phase 3 verification — deep UX review of Home and Earnings
  - Action: Run `pnpm dev`. Verify:
    - Home: HeroMetrics shows greeting + primary metric + 4 stat tiles, ReferralLinkBar is always visible, QuickActions renders 3 buttons, RecentActivityFeed shows customer names, PendingApprovalState shows for pending affiliates
    - Earnings: SimplifiedHero shows 3 balances with Withdraw CTA, UnifiedFeed merges commissions + payouts chronologically, tab toggle works (All/Commissions/Payouts), FilterChips work, CommissionDetailDrawer shows narrative + collapsible details
    - Both pages: no console errors, proper loading skeletons, responsive on mobile (375px) and desktop (1280px)
    - Cross-page: navigate between all 6 pages, verify consistent visual language
  - Notes: Test with both an active affiliate and a pending affiliate account.

### Acceptance Criteria

- [ ] AC 1: Given an unauthenticated user visits `/portal/home`, when the page loads, then they are redirected to `/portal/login?callbackUrl=/portal/home` and the login page displays the tenant's brand primary color.
- [ ] AC 2: Given an authenticated affiliate visits `/portal/login` without a `?tenant=` param, when the page loads, then the `ResolvePortalTenant` client component detects the authenticated affiliate session and redirects to `/portal/login?tenant=<slug>` so the login page can render with correct branding. (Note: the proxy does NOT redirect authenticated users away from `/portal/login` — this is handled client-side by `ResolvePortalTenant`.)
- [ ] AC 3: Given a tenant has set `primaryColor: "#1c2260"`, when any portal page loads, then all brand-colored elements use `#1c2260` via CSS custom property — zero inline `style={{ color: primaryColor }}` on any portal component.
- [ ] AC 4: Given the Reports page with period set to "30 Days", when the page loads, then 4 summary cards display (Earnings in PHP, Clicks, Conversions, Conversion Rate) with trend arrows comparing to the previous 30 days.
- [ ] AC 5: Given the Reports page with comparison toggle enabled, when the earnings trend chart renders, then both current period (solid area) and previous period (dashed line) are visible on the same chart.
- [ ] AC 6: Given the Reports page with at least 3 referral links that have clicks, when the Top Links section renders, then links are ranked by conversion count descending with rank numbers, click counts, and earnings displayed.
- [ ] AC 7: Given the Reports page conversion funnel, when there are 100 clicks and 10 conversions, then the funnel displays "100 people clicked your link → 10 signed up (10% conversion rate)" using plain English labels.
- [ ] AC 8: Given an affiliate with ₱0 available earnings, when they view the Earnings hero, then the "Withdraw" button is NOT displayed.
- [ ] AC 9: Given an affiliate with available earnings > 0, when they view the Earnings hero, then a "Withdraw" CTA button is displayed on the Available balance card.
- [ ] AC 10: Given the Earnings unified feed, when both commissions and payouts exist, then all items appear in a single chronological list sorted by date descending with the active tab showing "All Activity".
- [ ] AC 11: Given the Earnings unified feed with "Payouts Only" tab selected, when the user views the feed, then only payout items are displayed and commission items are hidden.
- [ ] AC 12: Given the Commission Detail Drawer, when opened for a commission, then the narrative reads "You referred [name] on [date]. They signed up for [plan]. You earned ₱[amount]." with technical details in a collapsed section.
- [ ] AC 13: Given the Home page, when loaded, then HeroMetrics displays greeting + available earnings as primary metric + 4 compact stat tiles (Total Earned, Pending, Conversions, Clicks) — no separate WelcomeBanner or EarningsSummaryGrid.
- [ ] AC 14: Given the Home page, when loaded, then ReferralLinkBar is visible below HeroMetrics showing the referral URL with Copy and Share buttons.
- [ ] AC 15: Given the Home page QuickActions, when rendered, then 3 buttons are shown: "Share Link" (primary), "My Links" (outline), and "Withdraw" (outline, only if available > 0).
- [ ] AC 16: Given an affiliate with status "pending", when they visit the Home page, then a PendingApprovalState card is displayed with review timeline information.
- [ ] AC 17: Given any authenticated portal page, when data is loading, then a skeleton fallback matching the page's layout structure is displayed (same card count, same grid, same heights) — no blank screen or blocking spinner.
- [ ] AC 18: Given all 6 authenticated portal pages, when navigated between, then visual consistency is maintained — same card border-radius, spacing, typography, and shadow treatment.
- [ ] AC 19: Given the Links page, when the Share button is tapped on a referral link, then the Web Share API sheet opens with the referral URL (or clipboard copy fallback on unsupported browsers).
- [ ] AC 20: Given the mobile bottom navigation on a 320px screen, when rendered, then all 6 nav items are tappable without overlap (or "More..." overflow handles the 6th item).

## Additional Context

### Dependencies

- Route group restructure requires verifying `src/proxy.ts` route protection still works (route groups are URL-transparent, so no proxy changes expected — BUT `callbackUrl` redirect flow must be tested end-to-end)
- New Convex indexes require schema deployment (`pnpm convex deploy` or `--push`)
- `conversions` table currently has NO `affiliateId` index — must be added for Reports and existing dashboard queries
- Reports page depends on Phase 1 layout extraction being complete (shared layout must exist before building new page)
- All portal Convex queries depend on `getCurrentAffiliate` returning valid affiliate data (auth must be working)
- **Phase 1 prerequisite audit** — BEFORE starting Phase 1, count and document: (a) all inline `style` props in portal components, (b) all `useQuery` calls that need Suspense wrappers, (c) all `"USD"` hardcodes. This audit IS part of Phase 1 definition of done.
- **Phase 1 is a pure refactor — fully reversible.** All changes are file restructures (route groups), layout extractions, and style migrations. Zero data changes. Rollback = revert the commit. No schema changes in Phase 1.
- **Phase 2 ordering:** Reports page + visual alignment of all 5 existing pages should ship together (or in rapid succession) to avoid visual inconsistency between old and new page styles

### Testing Strategy

**Unit Tests:**
- `src/lib/portal-utils.test.ts`: Test `adjustColor()`, `darkenColor()`, `getPortalName()` — edge cases (no input, invalid hex, undefined portalName)
- `convex/affiliatePortalReports.test.ts`: Test all 5 report queries with mocked Convex context — verify index usage, date filtering, `.take()` caps, handling of `affiliateId: undefined` in conversions
- Test `formatCurrency()` usage — verify PHP formatting, undefined amount handling, compact format

**Integration Tests:**
- Auth redirect flow: `/portal/home` (unauthenticated) → `/portal/login?callbackUrl=/portal/home` → sign in → redirect to `/portal/home`
- Route group URL transparency: verify `/portal/login`, `/portal/register`, `/portal/home`, `/portal/earnings`, `/portal/links`, `/portal/assets`, `/portal/account`, `/portal/reports` all resolve correctly after restructure
- CSS custom property injection: verify `--portal-primary` is set on the root portal layout div for both public and authenticated routes

**Manual Testing Steps:**
1. `pnpm dev` → visit `/portal/login` → verify brand color renders (no inline styles)
2. Sign in as test affiliate → verify redirect to `/portal/home`
3. Navigate all 6 authenticated pages → verify shared layout, no visual jumps
4. Visit `/portal/reports` → verify all sections render (or empty state with no data)
5. Change period selector on Reports → verify chart and cards update
6. Enable comparison toggle → verify previous period overlay
7. Visit Earnings → verify unified feed shows both commissions and payouts
8. Click commission item → verify drawer opens with narrative content
9. Check "Payouts Only" tab → verify only payouts shown
10. Visit Home → verify HeroMetrics, ReferralLinkBar, QuickActions render
11. Set test affiliate status to "pending" → verify PendingApprovalState on Home
12. Test on mobile viewport (375px) → verify bottom nav tappable, layouts responsive
13. Test on small viewport (320px / iPhone SE) → verify bottom nav overflow handling
14. Verify no console errors on any page
15. Verify all currency displays show PHP symbol (₱)

### Notes

**Pre-mortem Risks Already Addressed:**
- Unified feed confusion → resolved with tab toggle (ADR 5)
- Mobile nav cramping → Task 1.6 includes overflow handling design
- Skeleton mismatch → Task 1.10 enforces layout parity
- Auth redirect breakage → Task 1.4 includes explicit verification
- CSS custom properties missing on public pages → Task 1.3 injects at ROOT layout
- Reports lacking insights → Task 2.5 includes static insight tips
- Phase 1 scope creep → Task 1.1 audit gate + explicit Phase 1 definition of done
- Visual inconsistency between phases → Task 2.9 ensures cohesive visual language

**Known Limitations:**
- Static insight tips only — AI-generated insights deferred to future enhancement
- Preset periods only — no custom date range builder (out of scope)
- CSV/PDF export deferred (out of scope)
- No portal event tracking — deferred to separate analytics spec
- Dark mode for portal not in scope

**Future Considerations:**
- AI-generated contextual insights based on affiliate performance patterns
- Custom date range selector for Reports
- Campaign-specific reports (when affiliate campaigns are implemented)
- Real-time earnings notifications
- Affiliate referral leaderboard
- Advanced analytics segmentation (by country, device, referrer)
- Portal event tracking table (`portalEvents`) for product analytics — separate spec needed

### Risk Mitigations

1. **Route group migration breaks URLs** — Route groups are URL-transparent in Next.js. `/portal/home` stays `/portal/home`. Zero URL changes. BUT: **Test the full auth redirect flow after migration** — verify `callbackUrl=/portal/home` survives the round-trip through login and back.
2. **Inline style removal breaks branding** — Every component using `style={{ color: primaryColor }}` must be migrated to CSS custom property. **Audit ALL portal components for inline `style` props BEFORE starting migration.** Count and document every instance.
3. **Currency change breaks existing displays** — Grep for all `"USD"` hardcodes and `Intl.NumberFormat` calls in portal components. Replace with shared `formatCurrency()` utility.
4. **New indexes slow down writes** — Compound indexes add write overhead. Only 3 new indexes on 3 tables. Impact is negligible at current scale. **Deploy during low-traffic window** — monitor Convex function performance during index backfill on `conversions`.
5. **Reports queries expensive at scale** — `by_affiliate_created` compound index keeps queries bounded. `.paginate()` with `numItems: 1000` prevents unbounded scans and avoids silent data truncation. Chart data capped at 90 days max. Funnel uses count queries, not `.collect()`.
6. **Unified feed query complexity** — Resolved: using client-side merge of existing queries instead of a new server-side query. No cursor management complexity. Tab toggle is client-side filter.
7. **Shared layout increases bundle size** — All authenticated pages load the same layout shell. This is negligible — header, sidebar, and bottom nav are lightweight components.
8. **Motion/Recharts SSR issues** — Both libraries are SSR-compatible but charts need client-side rendering. Wrap chart components in `"use client"` + `<Suspense>`.
9. **Unified feed confuses affiliates with separate mental models** — Add tab toggle: "All Activity" | "Commissions Only" | "Payouts Only". Default to "All Activity" for the elegant unified view, but allow filtering.
10. **Mobile bottom nav too cramped at 6 items** — Test on iPhone SE (320px). If items are too close, implement "More..." overflow popover for the 6th item (Reports). Alternatively, collapse Links + Assets into a "Resources" group.
11. **Skeleton/content layout mismatch causes visual "jump"** — Enforce skeleton-to-content parity. Each page's skeleton MUST match the final rendered structure (same number of cards, same grid layout, same heights).
12. **CSS custom properties missing on public pages** — Inject at ROOT portal layout (not authenticated layout only). Both public and authenticated routes go through root layout. Verify login/register pages render brand color after migration.
13. **Reports page lacks actionable insights** — Add contextual insight tips next to key metrics (static tips initially). E.g., next to funnel: "Your conversion rate dropped. Tip: Try sharing your link with a personalized message."
14. **Phase 1 scope creep** — Strict Phase 1 definition of done. Prerequisite: audit all inline styles, `useQuery` calls, and USD hardcodes BEFORE starting. Currency utility is Phase 1, not Phase 2.
15. **Visual inconsistency between phases** — Phase 2 ships Reports (new visual style) alongside light visual refresh of all 5 existing pages. This ensures ALL pages share cohesive visual language before Phase 3 deep UX work begins.
