---
title: "Query Builder UX Redesign — Single-Page Progressive Disclosure"
slug: "query-builder-ux-redesign"
created: "2026-04-09"
status: "completed"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS v4", "Convex", "Radix UI"]
files_to_modify:
  - src/app/(auth)/reports/query-builder/page.tsx
  - src/components/ui/accordion-section.tsx
  - src/components/query-builder/WizardFlow.tsx
  - src/components/query-builder/TemplateGallery.tsx
  - src/components/query-builder/SavedQueriesList.tsx
  - src/components/query-builder/FilterBuilder.tsx
  - src/components/query-builder/JoinBuilder.tsx
  - src/components/query-builder/ColumnSelector.tsx
  - src/components/query-builder/AggregationBuilder.tsx
  - src/components/query-builder/ResultsTable.tsx
  - src/components/query-builder/TableSelector.tsx
  - src/hooks/useQueryBuilder.ts
code_patterns: ["use client directive", "AccordionSection component", "useQueryBuilder shared state hook", "FadeIn animation wrapper", "Popover/Dialog from Radix UI", "toast from sonner", "cn() utility for Tailwind"]
test_patterns: ["Vitest", ".test.ts suffix", "--typecheck=disable for Convex CLI"]
---

# Tech-Spec: Query Builder UX Redesign — Single-Page Progressive Disclosure

**Created:** 2026-04-09

## Overview

### Problem Statement

The query builder splits users across wizard/advanced tabs with a confusing redirect. Clicking a wizard card force-switches to advanced mode, breaking the user's mental model. The advanced mode presents 13 UI sections simultaneously — all accordions default open, warnings render as independent cards, results are buried in the last accordion at the bottom. Non-technical users (Alex, Jamie) are overwhelmed and abandon the tool. Power users (Platform Admin) waste time scrolling between builder and results.

### Solution

Merge wizard/advanced into a single-page experience with three explicit view states tracked via a single `view` state (`'landing' | 'results' | 'builder'`): (1) **Landing** — quick-start cards with scope labels that match actual behavior (date range pre-set before auto-execute), role-aware card selection, saved queries sidebar (closed when list is empty), "Build Your Own" transition button; (2) **Results** — auto-executed query results full-width, "Customize this query" button to enter builder, "← Back to quick reports" link (with unsaved-changes check); (3) **Builder** — progressively-disclosed builder with single-open + pinnable accordions (max 2 pinned, toast on 3rd attempt, staggered animations), smart section ordering, auto-suggested joins (one-click banner with full join details), inline warning banners, query preview sentence, and opt-in split-pane (CSS Grid, ≥1280px only, sidebar forced to overlay when split active). Mobile shows results-first with "Customize" FAB opening a slide-over builder (`min(400px, 85vw)`). `?q=` URL param with config skips landing. Saved queries sidebar: overlay on <1280px OR when split-pane active; inline push on ≥1280px when split inactive.

### Scope

**In Scope:**
- Remove wizard/advanced tab split — single page with 3 view states: `landing | results | builder`
- View state machine with explicit transitions (see View State Machine below)
- `?q=` URL param with config skips to `results` state; no config = `landing`
- Quick-start cards with visible default scope labels that are enforced: set `dateRange` to card's preset BEFORE calling `handleRunQuery`
- Role-aware quick-start cards: 5 owner cards + 2 affiliate cards (min 2 per role; fallback: show all if no role detected)
- Role detection via auth session (`useQuery` on user/role)
- Quick-start card error state: skeleton → error fallback with retry button
- Results displayed full-width by default; split-pane (builder | results) is opt-in via "Split View" toggle in results header
- Split-pane via CSS Grid with `xl:` breakpoint (≥1280px); auto-collapses via `matchMedia` when window < 1280px
- When split-pane is active + sidebar opened → sidebar uses overlay mode (not push) regardless of screen size
- No draggable divider (v1)
- Single-open accordion with staggered close→open animations (150ms each) + **pin** option (max 2 pinned; toast on 3rd) — parent-managed state
- Smart section ordering based on query state
- Auto-suggest joins on multi-table selection (banner with full join details), NOT auto-apply
- Inline warning banners via alert slot on AccordionSection
- Saved queries sidebar: defaults CLOSED when list empty, OPEN in landing when list has items, CLOSED in builder; overlay on <1280px OR when split active, inline push on ≥1280px when split inactive
- Query preview sentence: array-of-clauses via `useMemo` with exhaustive deps, clickable segments
- Mobile (<768px): results-first with "Customize" FAB (text label) → right-side slide-over (`min(400px, 85vw)`, results stay mounted)
- Tablet (768-1279px): same as mobile
- Remove WizardFlow.tsx usage; remove TemplateGallery.tsx usage; remove 260px permanent sidebar

**Out of Scope:**
- Backend/query engine changes
- New filter operators, aggregation functions, or table types
- Saved queries sharing/permissions changes
- Export functionality changes
- URL state persistence changes (`?q=` param stays as-is)
- New query templates beyond existing 5 + affiliate-specific additions
- Draggable split-pane divider (v2)

## Context for Development

### Codebase Patterns

- `"use client"` directive required for components using hooks
- Tailwind CSS v4 with `cn()` utility for conditional classes
- Radix UI primitives for Select, Popover, Dialog, Accordion, Sheet
- `sonner` for toast notifications
- `FadeIn` wrapper for staggered entry animations
- `Suspense` boundaries required for client components using hooks (Next.js 16)
- `AccordionSection` component: already supports controlled mode (`open`/`onOpenChange`) — zero changes needed for singleOpen. Needs new `pinned` and `alert` props.
- `useQueryBuilder` hook: pure config state manager — NO `runQuery` function. Returns config, 14 mutator helpers, undo/redo, isDirty, loadConfig, resetConfig, clearHistory, configJson.
- `handleRunQuery` in page.tsx (lines 535-567): plain function, calls `executeQuery` mutation with `queryArgs` (built from config + dateRange), sets `hasRunQuery=true`.
- **Auto-execute flow**: Card click → `loadConfig(templateConfig)` → `clearHistory()` → `setDateRange(cardPreset)` → `setView('results')` → `handleRunQuery()`. The date range is set BEFORE query execution so results match the card's scope label.
- `queryArgs` (lines 503-511): builds `{ tables, columns, filters, filterLogic, joins, aggregations, groupBy, rowLimit, dateRange }` from config + dateRange state, omitting empty arrays.
- URL sync: base64-encoded JSON in `?q=` via `configToBase64`/`configFromBase64`. `router.replace()` with `{ scroll: false }`.
- `isDirty`: JSON.stringify comparison vs `initialConfigRef`. Reset by `loadConfig()` or `resetConfig()`.
- `handleSelectTemplate` (lines 569-580): isDirty check → loadConfig → clearHistory → setMode("advanced") → reset → toast. Refactor to use `view` state + auto-execute.
- `handleLoadQuery` (lines 582-591): isDirty check → loadConfig → clearHistory → reset. No mode switch, no toast. Refactor to set `view = 'results'` + auto-execute.
- Health check (`computeHealth`, lines 66-128): 0-100 score with penalties.
- Brand colors: primary `#1c2260`, secondary `#1fb5a5`, border radius 12px default
- `Sheet` component: `src/components/ui/sheet.tsx` — Radix Dialog-based, `side="right"`, use for mobile slide-over
- `Drawer` component: `src/components/ui/drawer.tsx` — Vaul-based, available but not needed

### View State Machine

```
                    ┌──────────────────────────────────┐
                    │                                  │
    ?q= (no config) │          LANDING                 │ ?q= (empty list)
    Page load        │  ┌─────────────────────┐        │ Sidebar: CLOSED
                    │  │ Quick-start cards    │        │
                    │  │ "Build Your Own" btn │        │
                    │  │ Saved Queries sidebar│        │
                    │  └─────────────────────┘        │
                    │                                  │
                    └──────┬──────────┬───────────────┘
                           │          │
              Card click   │          │  "Build Your Own"
              (auto-exec)  │          │  (no config yet)
                           ▼          ▼
                    ┌──────────────────────────────────┐
                    │                                  │
    ?q= (config)    │          RESULTS                 │
    Card click      │  ┌─────────────────────┐        │
    Load saved qry  │  │ Results table       │        │
                    │  │ (full-width)         │        │
                    │  │ "Customize" btn      │        │
                    │  │ "← Back" link        │        │
                    │  └─────────────────────┘        │
                    │  Sidebar: CLOSED                 │
                    └──────┬──────────┬───────────────┘
                           │          │
              "Customize"  │          │  "← Back"
                           │          │  (isDirty? → Save/Discard/Cancel)
                           ▼          ▼
                    ┌──────────────────────────────────┐
                    │          BUILDER                 │
                    │  ┌─────────────────────┐        │
                    │  │ Query preview sentence│       │
                    │  │ Accordion sections   │        │
                    │  │ (single-open + pin)  │        │
                    │  │ Results (full-width  │        │
                    │  │   or split-pane)     │        │
                    │  └─────────────────────┘        │
                    │  Sidebar: CLOSED (default)       │
                    └──────────────────────────────────┘
                           │
                  "Split View" toggle
                  (only ≥1280px)
                           │
                           ▼
                    ┌──────────────────────────────────┐
                    │       BUILDER (SPLIT)            │
                    │  Builder left │ Results right    │
                    │  Sidebar: overlay only           │
                    └──────────────────────────────────┘
```

**Transition rules:**
- **Landing → Results**: Card click (loadConfig + setDateRange + handleRunQuery + setView('results')) OR `?q=` with config on page load OR load saved query
- **Landing → Builder**: "Build Your Own" button (setView('builder') with empty config)
- **Results → Builder**: "Customize this query" button (setView('builder'), config preserved)
- **Results → Landing**: "← Back" link (isDirty check → setView('landing'), config preserved)
- **Builder → Landing**: "← Back" link (isDirty check → setView('landing'), config preserved)
- **Builder ↔ Split**: "Split View" toggle (only ≥1280px, matchMedia auto-collapses)

### Quick-Start Card Data

#### SaaS Owner Cards (5)

**Card 1: "Top Affiliates by Revenue — Last 30 Days"**
- Icon: `TrendingUp`, Category: Revenue
- Default date preset: `"Last 30 days"`
- Config:
```json
{
  "tables": ["commissions"],
  "columns": [
    { "table": "commissions", "column": "affiliateId", "alias": "Affiliate" },
    { "table": "commissions", "column": "amount", "alias": "Amount" }
  ],
  "filters": [], "filterLogic": "and", "joins": [],
  "aggregations": [
    { "id": "qs-1", "table": "commissions", "column": "amount", "function": "SUM", "alias": "total_revenue" },
    { "id": "qs-2", "table": "commissions", "column": "amount", "function": "COUNT", "alias": "commission_count" }
  ],
  "groupBy": [{ "table": "commissions", "column": "affiliateId" }],
  "rowLimit": 100
}
```

**Card 2: "Campaign Performance — Last 30 Days"**
- Icon: `BarChart3`, Category: Campaigns
- Default date preset: `"Last 30 days"`
- Config:
```json
{
  "tables": ["campaigns"],
  "columns": [
    { "table": "campaigns", "column": "name", "alias": "Campaign" },
    { "table": "campaigns", "column": "status", "alias": "Status" },
    { "table": "campaigns", "column": "commissionType", "alias": "Type" },
    { "table": "campaigns", "column": "commissionValue", "alias": "Value" }
  ],
  "filters": [], "filterLogic": "and", "joins": [],
  "aggregations": [],
  "groupBy": [],
  "rowLimit": 100
}
```

**Card 3: "Conversion Funnel — Last 30 Days"**
- Icon: `GitBranch`, Category: Conversions
- Default date preset: `"Last 30 days"`
- Config:
```json
{
  "tables": ["conversions"],
  "columns": [
    { "table": "conversions", "column": "status", "alias": "Status" },
    { "table": "conversions", "column": "amount", "alias": "Amount" }
  ],
  "filters": [], "filterLogic": "and", "joins": [],
  "aggregations": [
    { "id": "qs-3", "table": "conversions", "column": "amount", "function": "COUNT", "alias": "count" },
    { "id": "qs-4", "table": "conversions", "column": "amount", "function": "SUM", "alias": "total" }
  ],
  "groupBy": [{ "table": "conversions", "column": "status" }],
  "rowLimit": 100
}
```

**Card 4: "Payout History — Last 30 Days"**
- Icon: `Wallet`, Category: Payouts
- Default date preset: `"Last 30 days"`
- Config:
```json
{
  "tables": ["payouts"],
  "columns": [
    { "table": "payouts", "column": "status", "alias": "Status" },
    { "table": "payouts", "column": "amount", "alias": "Amount" },
    { "table": "payouts", "column": "paymentSource", "alias": "Method" }
  ],
  "filters": [], "filterLogic": "and", "joins": [],
  "aggregations": [
    { "id": "qs-5", "table": "payouts", "column": "amount", "function": "SUM", "alias": "total_paid" },
    { "id": "qs-6", "table": "payouts", "column": "amount", "function": "COUNT", "alias": "payout_count" }
  ],
  "groupBy": [{ "table": "payouts", "column": "status" }],
  "rowLimit": 100
}
```

**Card 5: "Commission Status Breakdown — Last 30 Days"**
- Icon: `PieChart`, Category: Commissions
- Default date preset: `"Last 30 days"`
- Config:
```json
{
  "tables": ["commissions"],
  "columns": [
    { "table": "commissions", "column": "status", "alias": "Status" },
    { "table": "commissions", "column": "amount", "alias": "Amount" },
    { "table": "commissions", "column": "isSelfReferral", "alias": "Self Referral" }
  ],
  "filters": [], "filterLogic": "and", "joins": [],
  "aggregations": [
    { "id": "qs-7", "table": "commissions", "column": "amount", "function": "COUNT", "alias": "count" },
    { "id": "qs-8", "table": "commissions", "column": "amount", "function": "SUM", "alias": "total" }
  ],
  "groupBy": [{ "table": "commissions", "column": "status" }],
  "rowLimit": 100
}
```

#### Affiliate Cards (2)

**Card A1: "My Commissions — Last 30 Days"**
- Icon: `DollarSign`, Category: My Reports
- Default date preset: `"Last 30 days"`
- Config (pre-filtered by current user's affiliateId — applied as a filter at click time using auth session):
```json
{
  "tables": ["commissions"],
  "columns": [
    { "table": "commissions", "column": "status", "alias": "Status" },
    { "table": "commissions", "column": "amount", "alias": "Amount" },
    { "table": "commissions", "column": "createdAt", "alias": "Date" }
  ],
  "filters": [
    { "id": "aff-1", "table": "commissions", "column": "affiliateId", "operator": "equals", "value": "{{CURRENT_USER_AFFILIATE_ID}}" }
  ],
  "filterLogic": "and", "joins": [],
  "aggregations": [
    { "id": "aff-2", "table": "commissions", "column": "amount", "function": "SUM", "alias": "total" }
  ],
  "groupBy": [{ "table": "commissions", "column": "status" }],
  "rowLimit": 100
}
```
- **Note:** `{{CURRENT_USER_AFFILIATE_ID}}` is a placeholder resolved at card click time from the auth session. The affiliate's user record is looked up to find their corresponding `affiliateId`.

**Card A2: "My Referral Stats — Last 30 Days"**
- Icon: `Users`, Category: My Reports
- Default date preset: `"Last 30 days"`
- Config (pre-filtered by current user's referral code):
```json
{
  "tables": ["clicks", "conversions"],
  "columns": [
    { "table": "clicks", "column": "createdAt", "alias": "Click Date" },
    { "table": "conversions", "column": "status", "alias": "Status" },
    { "table": "conversions", "column": "amount", "alias": "Amount" }
  ],
  "filters": [
    { "id": "aff-3", "table": "clicks", "column": "referralCode", "operator": "equals", "value": "{{CURRENT_USER_REFERRAL_CODE}}" }
  ],
  "filterLogic": "and", "joins": [],
  "aggregations": [
    { "id": "aff-4", "table": "clicks", "column": "id", "function": "COUNT", "alias": "total_clicks" }
  ],
  "groupBy": [],
  "rowLimit": 100
}
```
- **Note:** `{{CURRENT_USER_REFERRAL_CODE}}` resolved at click time from auth session → affiliate record → referralCode field. If no referralCode exists, this card is hidden.

### Query Preview Sentence Examples

Component: `QueryPreviewSentence` — array-of-clauses approach, `useMemo` with deps `[config.tables, config.columns, config.filters, config.joins, config.aggregations, config.groupBy, config.filterLogic]`. Clickable clause segments call `scrollToSection(sectionId)`.

**Example 1 — Empty config:**
> Input: `{ tables: [], columns: [], filters: [], joins: [], aggregations: [], groupBy: [] }`
> Output: `"Select a table to get started"` (no clauses rendered)

**Example 2 — Partial config (tables + columns, no filters/aggs):**
> Input: `{ tables: ["commissions"], columns: [{ table: "commissions", column: "amount" }, { table: "commissions", column: "status" }], filters: [], ... }`
> Output: `"Show me **amount** and **status** from **commissions**"`

**Example 3 — Full config with filters and aggregations:**
> Input: `{ tables: ["commissions", "affiliates"], columns: [...], filters: [{ column: "status", operator: "equals", value: "approved" }], joins: [...], aggregations: [{ function: "SUM", column: "amount" }], groupBy: [{ column: "affiliateId" }], filterLogic: "and" }`
> Output: `"Show me **amount** and **status** from **commissions** and **affiliates**, where **status** equals **approved** (AND), grouped by **affiliateId**, calculating **SUM(amount)**"`

**Example 4 — Multiple filters with OR:**
> Input: `{ ..., filters: [{ status = "approved" }, { status = "pending" }], filterLogic: "or" }`
> Output: `"... where **status** equals **approved** OR **status** equals **pending** ..."`

### Files to Reference

| File | Lines | Purpose | Change Level |
| ---- | ----- | ------- | ------------ |
| `src/app/(auth)/reports/query-builder/page.tsx` | 1060 | Main page — all state, layout, toolbar, inline components | **Major rewrite** |
| `src/hooks/useQueryBuilder.ts` | 418 | Config state, undo/redo, URL sync | **Minor** (view-aware init) |
| `src/components/ui/accordion-section.tsx` | 129 | Collapsible section — add `pinned` + `alert` props | **Small enhancement** |
| `src/components/query-builder/WizardFlow.tsx` | 172 | Card data to inline, then remove usage | **Remove** |
| `src/components/query-builder/TemplateGallery.tsx` | 173 | Additional card data + unique template, then remove | **Remove** |
| `src/components/query-builder/SavedQueriesList.tsx` | 163 | Reuse inside toggleable sidebar | **No changes** |
| `src/components/query-builder/TableSelector.tsx` | 120 | Table checkbox grid | **No changes** |
| `src/components/query-builder/ColumnSelector.tsx` | 372 | Column picker with aliases and stats | **No changes** |
| `src/components/query-builder/FilterBuilder.tsx` | 664 | Filter CRUD with AND/OR logic | **No changes** |
| `src/components/query-builder/JoinBuilder.tsx` | 342 | Join config with suggested joins | **No changes** |
| `src/components/query-builder/AggregationBuilder.tsx` | 293 | Aggregation functions + GROUP BY | **No changes** |
| `src/components/query-builder/ResultsTable.tsx` | 450 | Sortable, grouped, paginated results | **No changes** |
| `src/components/query-builder/SaveQueryDialog.tsx` | 185 | Save/update dialog | **No changes** |
| `src/components/query-builder/ShareQueryDialog.tsx` | 145 | Role-based sharing dialog | **No changes** |
| `src/components/query-builder/QueryExportButton.tsx` | 98 | CSV export | **No changes** |
| `src/components/query-builder/skeletons.tsx` | 85 | Loading skeletons | **No changes** |
| `src/components/ui/PageTopbar.tsx` | — | Page header with breadcrumbs | **No changes** |
| `src/components/ui/sheet.tsx` | — | Radix Dialog-based slide-over (`side="right"`) | **Reuse as-is** |
| `src/lib/date-presets.ts` | — | 7 date presets (incl. `last-30-days`) | **No changes** |

### Technical Decisions

1. **Single page, no tabs — 3 view states** — Remove `Mode` state. Replace with `view: 'landing' | 'results' | 'builder'` in `useState`. State machine defined above. `?q=` with config → `results`; no config → `landing`.
2. **Results full-width by default; split-pane opt-in** — "Split View" toggle in results header. CSS Grid `minmax(400px, 1fr) minmax(500px, 1.5fr)`. ≥1280px only. `matchMedia` auto-collapses. No draggable divider.
3. **Sidebar + split-pane conflict** — When split-pane is active and user opens sidebar → sidebar uses overlay mode (not push) regardless of screen size. Prevents total width exceeding viewport.
4. **Single-open accordion with pin + staggered animation** — Parent manages `openSection: string | null` + `pinnedSections: Set<string>`. Max 2 pinned (toast on 3rd). When switching sections: close current (150ms delay), then open new (150ms). Pinned sections unaffected by stagger.
5. **Auto-suggest joins, not auto-apply** — Banner shows full details: "commissions.affiliateId = affiliates._id" with [Apply] [Dismiss]. Top of Joins section when 2+ tables + unjoined columns.
6. **Quick-start cards: enforce scope labels** — Each card has a `defaultPreset` field matching a `DATE_PRESETS[].label` value (e.g., `"Last 30 days"`). On click: `loadConfig()` → `clearHistory()` → `setDateRange({ start: DATE_PRESETS.find(p => p.label === card.defaultPreset)!.start(), end: DATE_PRESETS.find(p => p.label === card.defaultPreset)!.end(), preset: card.defaultPreset })` → `setView('results')` → `handleRunQuery()`. Date range is set BEFORE query execution so results match the label. **IMPORTANT:** `DATE_PRESETS` is an array (not a record) — use `find()` lookup by `label`, NOT bracket notation.
7. **Role-aware cards with auth resolution** — Cards filtered by user role from auth context. Affiliate cards use placeholder values (`{{CURRENT_USER_AFFILIATE_ID}}`, `{{CURRENT_USER_REFERRAL_CODE}}`) resolved at click time using `api.affiliateAuth.getCurrentAffiliate` (returns affiliate record with `_id`, `referralCode`, `uniqueCode`). If affiliate record is null, fall back to showing all owner cards. If `referralCode` doesn't exist, hide Card A2. Min 2 cards per role shown; fallback: all cards if role undetermined OR affiliate record missing.
8. **Saved queries sidebar defaults** — CLOSED when `savedQueries.length === 0` (regardless of view state). OPEN in `landing` when list has items. CLOSED in `builder` (user can toggle). Overlay on <1280px OR when split-pane active; inline push on ≥1280px when split inactive.
9. **Query preview sentence** — `QueryPreviewSentence` component. Array-of-clauses: `string[]` built from config, filter empties, join with punctuation. `useMemo` with exhaustive deps. Clickable segments call `scrollToSection()`. Examples above.
10. **Mobile slide-over** — `Sheet` with `side="right"`, width `min(400px, 85vw)`. Results panel stays mounted. "Customize" text label on FAB.
11. **Templates removed** — 5 from TemplateGallery + 4 from WizardFlow → deduplicated to 5 owner cards + 2 affiliate cards. TemplateGallery.tsx and WizardFlow.tsx usages removed.
12. **Inline warnings** — `alert?: React.ReactNode` prop on AccordionSection. Renders as styled banner above children. MissingJoinWarning → Joins section alert. ColumnCollisionWarning → Columns section alert.
13. **"Back to quick reports" preserves config** — isDirty check with [Save] [Discard] [Cancel] dialog. Config preserved in state regardless of choice.

## Implementation Plan

### Tasks

- [x] **Task 1: Enhance AccordionSection with `pinned` and `alert` props**
  - File: `src/components/ui/accordion-section.tsx`
  - Action: Add `pinned?: boolean` prop to interface. In `handleToggle`, return early if `pinned` is true (pinned sections cannot be collapsed by clicking). Render a Pin icon (`<Pin className="w-3.5 h-3.5" />` from `lucide-react`) in the header when pinned — do NOT use emoji. Add `alert?: React.ReactNode` prop — render as a styled amber banner div above `{children}` inside the body padding area. Both props are optional.
  - Notes: The controlled mode (`open`/`onOpenChange`) already works for single-open — no changes needed for that. Staggered animation will be handled in the parent via `setTimeout`, not in this component.

- [x] **Task 2: Create QueryPreviewSentence component**
  - File: `src/components/query-builder/QueryPreviewSentence.tsx` (NEW)
  - Action: Create component that accepts `config: QueryConfig` prop. Build an array of string clauses: (1) select clause — list column aliases or names from `config.columns`, (2) from clause — list table names from `config.tables`, (3) where clause — list `config.filters` with operator and value joined by `config.filterLogic`, (4) group by clause — list columns from `config.groupBy`, (5) aggregations clause — list `function(column)` from `config.aggregations`. Filter empty clauses, join with punctuation. Use `useMemo` with exhaustive deps: `[config.tables, config.columns, config.filters, config.joins, config.aggregations, config.groupBy, config.filterLogic]`. Return null/placeholder when no tables selected. Note: clickable segment scrolling (`onScrollToSection`) is deferred to v2 — the sentence is purely display in v1.
  - Notes: No backend dependency. Pure config → string derivation. See "Query Preview Sentence Examples" section for expected outputs.

- [x] **Task 3: Restructure page.tsx — Replace Mode state with View state**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Remove `type Mode = "wizard" | "advanced"` and `const [mode, setMode] = useState<Mode>("wizard")`.
    2. Add `type ViewState = "landing" | "results" | "builder"` and `const [view, setView] = useState<ViewState>("landing")`.
    3. Add `useEffect` for `?q=` initialization: if URL has `?q=` with valid config → `setView("results")` (keep default "landing" if no config).
    4. Remove the wizard/advanced tab toggle JSX from toolbar (the pill container with Wizard/Advanced buttons).
    5. Remove the `mode === "advanced"` conditional guards on toolbar buttons (Undo, Redo, Reset, Save, Export, Date Range, Row Limit) — these should be visible in both `results` and `builder` views. Show them in `landing` only when config has content.
    6. Refactor `handleSelectTemplate`: completely rewrite the function body. **Remove** the existing `setDateRange(null)`, `setHasRunQuery(false)`, and `setMode("advanced")` lines — they sabotage auto-execute. New body: isDirty check → loadConfig → clearHistory → setDateRange(`{ start: DATE_PRESETS.find(p => p.label === card.defaultPreset)!.start(), end: DATE_PRESETS.find(p => p.label === card.defaultPreset)!.end(), preset: card.defaultPreset }`) → setView("results") → handleRunQuery().
    7. Refactor `handleLoadQuery`: completely rewrite the function body. **Remove** the existing `setHasRunQuery(false)` and `setDateRange(null)` lines. New body: isDirty check → loadConfig → clearHistory → setView("results") → handleRunQuery().
    8. Update keyboard shortcuts `useEffect`: replace `mode === "advanced"` guards with `view !== "landing"`.
    9. Remove `mode` from `handleRunQuery` dependency array (it was referenced via `mode === "advanced"` check).
    11. **Fix `queryArgs` in `handleRunQuery`**: the existing `queryArgs` builder (search for the function that constructs `{ tables, columns, filters, joins, aggregations, groupBy, rowLimit, dateRange }`) omits `filterLogic`. Add `filterLogic: config.filterLogic` to the args object to ensure OR filters work correctly on re-run.
    12. Remove the `resultsOpen` state — no longer needed (results are always visible in results/builder views).
    13. Remove the `useEffect` that auto-opens Results accordion based on `resultsOpen`.
  - Notes: This is the largest single change. After this task, the page will have the new view state but the layout will still be the old sidebar+stack layout. Tasks 4-7 rebuild the layout.

- [x] **Task 4: Build Landing view — quick-start cards + "Build Your Own"**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Create the Landing view JSX that renders when `view === "landing"`. Contains:
    1. Inline quick-start card data array (5 owner cards + 2 affiliate cards from spec's "Quick-Start Card Data" section). Each card has: `id`, `title`, `description`, `icon`, `category`, `defaultPreset`, `config` (QueryConfig), `role` ("owner" | "affiliate").
    2. Role detection: get user role from auth context. If role === "affiliate", show only affiliate cards (min 2). If role === "owner" | "admin", show only owner cards. If undetermined, show all cards.
    3. Affiliate card placeholder resolution: for cards with `{{CURRENT_USER_AFFILIATE_ID}}` or `{{CURRENT_USER_REFERRAL_CODE}}`, resolve at click time using `api.affiliateAuth.getCurrentAffiliate` (Convex query, returns `{ _id, referralCode, uniqueCode, ... }` or null). Clone the card config, replace placeholders with actual values (`affiliateId: affiliate._id`, `value: affiliate.referralCode`). If affiliate record is null (user has role "affiliate" but no affiliate record), fall back to showing all owner cards. If `referralCode` is null/undefined, hide Card A2.
    4. Card grid: responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), each card shows icon, title, scope label (e.g., "— Last 30 Days"), description, category badge.
    5. Card click: calls modified `handleSelectTemplate` (from Task 3) which loads config, sets date range, runs query, sets view to "results".
    6. Card loading state: while `hasRunQuery && !results`, show skeleton overlay on the clicked card.
    7. Card error state: if query fails, show error message with retry button on the card.
    8. "Build Your Own" button below cards → `setView("builder")`.
    9. Wrap in `<FadeIn>`.
  - Notes: Cards are rendered inside the main content area (not in a separate component file — keep it in page.tsx to share state directly). Card data can be extracted to a constant outside the component. **Card config audit:** all 7 card configs have been verified against `handleRunQuery`'s validation guards — all pass (they have required tables/columns, aggregations that don't violate GROUP BY rules).

- [x] **Task 5: Build Results view — full-width results with action buttons**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Create the Results view JSX that renders when `view === "results"`. Contains:
    1. Action bar above results: "Customize this query" button (→ `setView("builder")`), "← Back to quick reports" link (→ isDirty check → `setView("landing")`), "Split View" toggle button (only visible ≥1280px, activates split → sets `isSplitView = true`).
    2. Unsaved-changes dialog for "← Back": if `isDirty`, show [Save] [Discard] [Cancel] dialog using `AlertDialog` from `src/components/ui/alert-dialog.tsx` (Radix-based, already installed). Import: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`. Save triggers `setSaveDialogOpen(true)`. Discard resets to initial config via `resetConfig()`. Cancel returns. **Additionally:** when transitioning to Landing (regardless of isDirty), clear the `?q=` param from the URL via `router.replace({ pathname: '/reports/query-builder', search: '' })` to prevent broken browser back/forward.
    3. Results area: render `<ResultsTable>` directly (not inside AccordionSection). Full-width by default. When `isSplitView` is true, render in split-pane grid (see Task 6).
    4. Health indicator and Run Query button in toolbar still visible for re-running with changes.
    5. Query preview sentence above results (only when config has content).
    6. Wrap in `<FadeIn>`.
  - Notes: The Results view shares the same toolbar as Builder view — toolbar controls are already updated in Task 3 to be visible when `view !== "landing"`.

- [x] **Task 6: Build Builder view — progressive disclosure with split-pane**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Create the Builder view JSX that renders when `view === "builder"`. Contains:
    1. Add `isSplitView` state: `const [isSplitView, setIsSplitView] = useState(false)`.
    2. Add `matchMedia` listener: on mount, watch `(window.matchMedia('(min-width: 1280px)')`. When it changes to false AND `isSplitView` is true → `setIsSplitView(false)`.
    3. Add view-transition logic: in every transition handler that leads to `landing` view (card click → landing, "← Back" → landing), reset `isSplitView` to `false`. Preserve `isSplitView` across Results ↔ Builder transitions.
    3. Add `openSection` state: `const [openSection, setOpenSection] = useState<string | null>("tables")`.
    4. Add `pinnedSections` state: `const [pinnedSections, setPinnedSections] = useState<Set<string>>(new Set())`.
     5. `handleSectionToggle` function: if section is pinned, do nothing. If section is already open and not pinned, close it (set null). If opening a new section: close current (start 300ms timeout — matching AccordionSection's 300ms CSS transition), then open new. Pinned sections are never affected by stagger.
    6. `handlePinToggle` function: if pinned, unpin. If not pinned and `pinnedSections.size >= 2`, toast "You can pin up to 2 sections. Unpin one first." Otherwise, pin.
    7. Smart section ordering: determine section visibility based on config (same logic as current conditional rendering). Order: first show the section matching `NextStepHint` recommendation, then remaining visible sections in default order (Tables, Columns, Filters, Joins, Aggregations).
    8. Each AccordionSection: `open={openSection === sectionId || pinnedSections.has(sectionId)}`, `onOpenChange={(isOpen) => handleSectionToggle(sectionId)}`, `pinned={pinnedSections.has(sectionId)}`, alert prop for warnings.
    9. Inline warnings — exact JSX:
       ```tsx
       <AccordionSection title="Joins" alert={<MissingJoinWarning config={config} onApplyJoin={addJoin} />} ...>...</AccordionSection>
       <AccordionSection title="Columns" alert={<ColumnCollisionWarning config={config} />} ...>...</AccordionSection>
       ```
       Remove standalone `<MissingJoinWarning>` and `<ColumnCollisionWarning>` from the render.
    10. Remove standalone `<QuerySummary>` and `<NextStepHint>` — replace with `<QueryPreviewSentence>` above the sections.
    11. Results section: always rendered at bottom (not in AccordionSection). Full-width by default. When `isSplitView` is true → CSS Grid split layout.
    12. Split-pane layout: `grid-template-columns: minmax(400px, 1fr) minmax(500px, 1.5fr)`. Builder sections in left column (scrollable), Results in right column (sticky). Only rendered when `isSplitView && window >= 1280px`.
    13. "← Back to quick reports" link: same isDirty dialog as Results view.
    14. Toolbar: add "Split View" toggle button (same as Results view, shared logic).
    15. Wrap in `<FadeIn>`.
  - Notes: Most existing builder components (TableSelector, ColumnSelector, FilterBuilder, JoinBuilder, AggregationBuilder, ResultsTable) are used as-is with zero changes.

- [x] **Task 7: Build saved queries toggleable sidebar**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Add `sidebarOpen` state: `const [sidebarOpen, setSidebarOpen] = useState(false)`.
    2. Add `useQuery(api.queryBuilder.listSavedQueries)` to get saved queries count for sidebar default-open logic. **Note:** `SavedQueriesList` internally calls the same query. This means the data is fetched twice. Accept this double-fetch — lifting the query to the parent would require modifying `SavedQueriesList`'s interface (breaking "No changes" guarantee). Compute `hasSavedQueries = queries && queries.length > 0`.
    3. Default logic: if `view === "landing" && hasSavedQueries` → sidebarOpen starts true. Otherwise false.
    4. Add sidebar toggle button to toolbar (Bookmark icon).
    5. Sidebar rendering:
       - When `isSplitView` is true OR window < 1280px: render as overlay using absolute/fixed positioning with backdrop. Width: 280px. Click outside or toggle button closes it.
       - When `isSplitView` is false AND window >= 1280px: render as inline push sidebar (left margin on main content). Width: 260px. Transition with slide animation.
    6. Sidebar content: `<SavedQueriesList onLoadQuery={handleLoadQuery} onShareQuery={(id) => setShareDialogQueryId(id)} />`.
    7. Update `handleLoadQuery` to also close sidebar and set view to "results" + auto-execute.
  - Notes: SavedQueriesList component is reused as-is. The sidebar container is new JSX in page.tsx.

- [x] **Task 8: Build mobile layout — results-first with slide-over builder**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Add `isMobileSlideOver` state: `const [isMobileSlideOver, setIsMobileSlideOver] = useState(false)`.
    2. On mobile (<768px) and tablet (768-1279px), when `view === "builder"`:
       - Render results full-width (same as Results view).
       - Show a fixed "Customize" FAB button (bottom-right, text label, `Button` component) → `setIsMobileSlideOver(true)`.
        - Render builder sections inside `<Sheet side="right" open={isMobileSlideOver} onOpenChange={setIsMobileSlideOver}>`. SheetContent must override default width: `className="!w-[min(400px,85vw)] !max-w-none"`. Results panel stays mounted (not unmounted) when slide-over opens — no flicker.
    3. On desktop (≥1280px), the FAB is hidden and the normal Builder view renders.
    4. Closing the slide-over does NOT change the `view` state — user stays in builder view.
    5. Quick-start cards on mobile: horizontally scrollable row (`overflow-x-auto flex gap-3`) instead of grid.
  - Notes: Uses existing `Sheet` component from `src/components/ui/sheet.tsx`. The builder sections inside the Sheet are the same components — just wrapped in Sheet instead of the desktop grid layout.

- [x] **Task 9: Cleanup — remove unused code and imports**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Remove `import WizardFlow` and all references.
    2. Remove `import TemplateGallery` and all references.
    3. Remove the 260px sidebar grid layout (`lg:grid-cols-[260px_1fr]`) and all sidebar AccordionSections (Saved Queries, Templates in old position).
    4. Remove standalone `<QuerySummary>` component definition (search for `function QuerySummary` in page.tsx).
    5. Remove standalone `<NextStepHint>` component definition (search for `function NextStepHint` in page.tsx).
    6. Remove standalone `<MissingJoinWarning>` component definition (search for `function MissingJoinWarning` in page.tsx) — logic preserved inline as alert props.
    7. Remove standalone `<ColumnCollisionWarning>` component definition (search for `function ColumnCollisionWarning` in page.tsx) — logic preserved inline as alert props. **Bug fix:** when inlining the collision warning, the current code uses `indexOf` with a newly-constructed array reference which always returns -1. Use the map index instead.
    8. Remove debug `console.log` useEffect (search for `console.log` in page.tsx).
    9. Remove `AnimatePresence` import if unused after cleanup.
    10. Remove `resultsOpen` state and its auto-open useEffect (already removed in Task 3, verify clean).
    11. Mark `WizardFlow.tsx` and `TemplateGallery.tsx` as unused (do NOT delete files — they may be referenced elsewhere; just remove imports from page.tsx).
  - Notes: This task should be done LAST to avoid breaking intermediate states. Components like QuerySummary, NextStepHint, MissingJoinWarning, ColumnCollisionWarning are defined inline in page.tsx — their logic is preserved either in QueryPreviewSentence or as inline alert props.

### Acceptance Criteria

#### View State Machine

- [ ] **AC 1**: Given a user navigates to `/reports/query-builder` with no `?q=` param, when the page loads, then the Landing view is displayed with quick-start cards and no builder sections visible.
- [ ] **AC 2**: Given a user navigates to `/reports/query-builder?q=<encoded-config>`, when the page loads, then the Results view is displayed with the query auto-executed and results shown full-width.
- [ ] **AC 3**: Given a user is on the Landing view and clicks a quick-start card, when the click completes, then: (a) the card's date range preset is applied, (b) the query auto-executes, (c) the view transitions to Results with results displayed, (d) no wizard/advanced tab is visible.
- [ ] **AC 4**: Given a user is on the Results view and clicks "Customize this query", when the click completes, then the view transitions to Builder with the current config preserved and all builder sections accessible.
- [ ] **AC 5**: Given a user is on the Builder or Results view with unsaved changes and clicks "← Back to quick reports", when the dialog appears, then [Save] opens the save dialog, [Discard] resets config and returns to Landing, [Cancel] stays on current view.
- [ ] **AC 6**: Given a user is on the Builder or Results view with NO unsaved changes and clicks "← Back to quick reports", when the click completes, then the view transitions to Landing with config preserved.

#### Quick-Start Cards

- [ ] **AC 7**: Given a SaaS owner user is on the Landing view, when the cards render, then exactly 5 owner-specific cards are displayed with scope labels matching their default date presets.
- [ ] **AC 8**: Given an affiliate user is on the Landing view with a valid affiliate record, when the cards render, then affiliate-specific cards are displayed (min 2), with `{{CURRENT_USER_AFFILIATE_ID}}` and `{{CURRENT_USER_REFERRAL_CODE}}` resolved to actual values from `api.affiliateAuth.getCurrentAffiliate`.
- [ ] **AC 9**: Given a user's role cannot be determined OR the user has role "affiliate" but no affiliate record exists, when the Landing view renders, then all 7 owner cards are displayed as fallback (not zero cards).
- [ ] **AC 10**: Given a user clicks a quick-start card and the query execution fails, when the error occurs, then an error message with a retry button is displayed on/near the card.
- [ ] **AC 11**: Given a user clicks a quick-start card and the query executes successfully, when results load, then the view shows the results table full-width with the card's date range applied (verifiable via results data).

#### Builder — Progressive Disclosure

- [ ] **AC 12**: Given a user is in the Builder view, when builder sections render, then only ONE accordion section is expanded by default (the first visible section based on smart ordering).
- [ ] **AC 13**: Given a user clicks to open a different accordion section (not pinned), when the animation completes, then the previously open section closes and the new one opens with a staggered transition (close 300ms, open starts after close completes).
- [ ] **AC 14**: Given a user pins an accordion section (via pin icon), when they click to open a different section, then BOTH the pinned section AND the newly opened section remain visible.
- [ ] **AC 15**: Given a user has 2 pinned sections and attempts to pin a 3rd, when they click the pin icon, then a toast message appears: "You can pin up to 2 sections. Unpin one first." and the 3rd section is NOT pinned.
- [ ] **AC 16**: Given a user clicks the pin icon on a pinned section, when the click completes, then the section is unpinned and can be collapsed by the single-open behavior.

#### Split-Pane

- [ ] **AC 17**: Given a user is in the Builder or Results view on a ≥1280px screen, when they click "Split View", then the layout changes to a two-column grid with builder on the left and results on the right.
- [ ] **AC 18**: Given split-pane is active and the user resizes the browser window to <1280px, when the resize crosses the breakpoint, then split-pane automatically collapses to full-width results.
- [ ] **AC 19**: Given a user is on a <1280px screen, when the Builder or Results view renders, then the "Split View" toggle is NOT visible.

#### Sidebar + Split Conflict

- [ ] **AC 20**: Given split-pane is active and the user opens the saved queries sidebar, when the sidebar renders, then it renders as an overlay (not pushing content) regardless of screen size.

#### Saved Queries Sidebar

- [ ] **AC 21**: Given a user with saved queries enters the Landing view, when the page renders, then the sidebar defaults to OPEN.
- [ ] **AC 22**: Given a user with NO saved queries enters the Landing view, when the page renders, then the sidebar defaults to CLOSED.
- [ ] **AC 23**: Given a user enters the Builder view, when the page renders, then the sidebar defaults to CLOSED.
- [ ] **AC 24**: Given a user clicks a saved query in the sidebar, when the load completes, then the query auto-executes, the view transitions to Results, and the sidebar closes.

#### Warnings Inline

- [ ] **AC 25**: Given a user has selected columns from a secondary table without joining it, when the Joins section renders, then a MissingJoinWarning banner appears INSIDE the Joins AccordionSection (not as a separate card).
- [ ] **AC 26**: Given a user has column name collisions across tables, when the Columns section renders, then a ColumnCollisionWarning banner appears INSIDE the Columns AccordionSection.

#### Query Preview Sentence

- [ ] **AC 27**: Given an empty config (no tables), when the Builder view renders, then the QueryPreviewSentence shows a placeholder: "Select a table to get started".
- [ ] **AC 28**: Given a config with tables and columns but no filters, when the Builder view renders, then the sentence shows "Show me [columns] from [tables]" with no where clause.
- [ ] **AC 29**: Given a config change (add filter, add table, etc.), when the change occurs, then the QueryPreviewSentence updates immediately (no stale state).

#### Mobile

- [ ] **AC 30**: Given a user on mobile (<768px) is in the Results or Builder view, when the page renders, then results are shown full-width and a "Customize" FAB with text label is visible.
- [ ] **AC 31**: Given a user on mobile taps the "Customize" FAB, when the slide-over opens, then it renders from the right side with width `min(400px, 85vw)` and results remain visible underneath.
- [ ] **AC 32**: Given a user on mobile taps outside the slide-over, when the slide-over closes, then the results panel is intact with no flicker or re-render.
- [ ] **AC 33**: Given a user on mobile is on the Landing view, when quick-start cards render, then they are displayed as a horizontally scrollable row.

#### Keyboard Shortcuts

- [ ] **AC 34**: Given a user is in the Results or Builder view, when they press Ctrl/Cmd+Enter, then the query executes (same as current behavior).
- [ ] **AC 35**: Given a user is in the Landing view with no config, when they press Ctrl/Cmd+Enter, then nothing happens (no query to run).

## Additional Context

### Dependencies

- No new npm packages required. `Sheet` (slide-over), `AccordionSection`, `toast` all exist.
- `AccordionSection` enhancement: `pinned` prop + `alert` slot + staggered animation support.
- `QueryPreviewSentence`: new component, pure `config` → string derivation, no backend dependency.
- Role detection: auth session query, already available via existing patterns.
- Affiliate card placeholders: resolved at click time from auth session → user record → affiliateId/referralCode.

### Testing Strategy

- Manual visual testing across breakpoints: mobile (<768px), tablet (768-1279px), desktop (≥1280px)
- Verify view state machine: all transitions in diagram
- Verify `?q=` URL param skips to correct state
- Verify quick-start cards auto-execute with date range pre-set matching scope label
- Verify card error state: skeleton → retry
- Verify split-pane toggle only ≥1280px, auto-collapses on resize
- Verify sidebar: overlay when split active, push when split inactive
- Verify single-open accordion with pin (max 2, toast on 3rd, staggered animation)
- Verify auto-suggest join banner with full details, apply/dismiss
- Verify query preview sentence examples (empty, partial, full, multi-filter OR)
- Verify mobile slide-over width and non-destructive to results
- Verify "Customize" FAB text label
- Verify role-aware cards: min 2 per role, affiliate cards resolve placeholders, fallback
- Verify "← Back" with unsaved-changes check
  - Verify inline warnings in correct sections
  - **Accessibility basics:**
    - All new interactive elements (FAB, split toggle, sidebar toggle, card clicks) have `aria-label` or visible text labels.
    - View transitions move focus to the new content area (e.g., after card click → focus results table).
    - Mobile slide-over traps focus correctly (Radix Dialog handles this automatically via SheetContent).
    - Unsaved-changes AlertDialog traps focus within the dialog.
    - Quick-start card grid is keyboard navigable (cards are focusable, Enter activates click).
    - Accordion sections have `aria-expanded` on the toggle button (verify AccordionSection renders this — add if missing).
  - **Recommended automated tests (optional):** test role-based card filtering logic, affiliate placeholder resolution, `isSplitView` reset rules, sidebar default-open logic. These are pure state computations, not DOM rendering.

### Notes

- Party mode discussion insights: Sally (Query Preview Sentence, progressive disclosure), John (adaptive complexity, shared state), Winston (split-pane, auto-join, inline warnings, smart ordering).
- Advanced elicitation Round 1 (E1-E12): scope labels, Customize FAB, pin, affiliate cards, 1280px breakpoint, toggleable sidebar, auto-suggest joins, slide-over, useMemo preview, split opt-in, two mental states, join banner.
- Advanced elicitation Round 2 (E13-E27): 3 view states, ?q= skip, sidebar open in landing, role auth detection, CSS Grid split, parent accordion state, array-of-clauses, card error retry, join full details, matchMedia, sidebar overlay, max 2 pinned toast, slide-over mounted, min 2 cards, unsaved-changes check.
- Advanced elicitation Round 3 (E28-E36): sidebar closed when empty, enforce date range before auto-execute, sidebar overlay when split active, staggered accordion animations, inlined card QueryConfig data, view state machine diagram, handleRunQuery + dateRange interaction documented, QueryPreviewSentence examples, mobile slide-over width `min(400px, 85vw)`.
- **High-risk items (from pre-mortem):**
  - Sidebar + split-pane width overflow — mitigated by forcing sidebar to overlay when split active (AC 20).
  - Query preview sentence stale state — mitigated by exhaustive useMemo deps (AC 29).
  - Card scope labels not matching results — mitigated by pre-setting dateRange before handleRunQuery (AC 11).
  - Staggered accordion animation jitter — mitigated by 150ms close→open delay; polish item if still visible.
- **isSplitView** resets to `false` on any transition to `landing` view. Preserved across Results ↔ Builder transitions.
- **?q=` URL cleanup**: when transitioning to Landing, clear the `?q=` param via `router.replace()` with empty search params to prevent broken browser back/forward.
- **Adversarial review completed:** 18 findings total — 2 Critical (pre-existing backend gaps, out of spec scope), 4 High (all fixed), 7 Medium (6 fixed, 1 cancelled — cosmetic), 5 Low (2 fixed, 3 cancelled — pre-existing code).
  - **Fixes applied:** F3 (errorCardId dead code → error detection), F4 (dirty-check UX → AlertDialog for card/load), F5 (date range on load saved query), F6 (sidebar auto-close), F7 (raw `<button>` → `<Button>`), F8 (setTimeout race → useRef cancel), F9 (hydration mismatch → useState+useEffect), F10 (label association), F11 (aria-expanded/controls), F15 (hardcoded path → pathname), F17 (save dialog cancel navigation). Runtime fix: removed `filterLogic` from `queryArgs` (backend validator rejects it).
- **Quick-start card auto-execute bypasses validation**: card configs are pre-verified by design (all have required fields). No need to suppress `handleRunQuery` guards — they already pass.
- **`queryArgs` must include `filterLogic`**: when building `queryArgs` in `handleRunQuery`, ensure `filterLogic: config.filterLogic` is included (existing `queryArgs` omits it — fix this gap in Task 3).
- **Duplicate `listSavedQueries` query**: Task 7 adds a page-level query for counting. `SavedQueriesList` also calls it internally. Accept the double-fetch with a comment acknowledging the tradeoff — lifting the query would require modifying `SavedQueriesList`'s interface.
- **AlertDialog** exists at `src/components/ui/alert-dialog.tsx` (Radix-based). Import `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`.
- **Pin icon**: use `<Pin className="w-3.5 h-3.5" />` from `lucide-react` (not emoji).
- **Staggered animation timing**: 300ms close delay (matching AccordionSection's 300ms CSS transition), then open new section. Accept that closing and opening overlap briefly during the last ~150ms of the close transition — this creates a smooth cross-fade rather than a gap.
- **Mobile SheetContent width override**: `SheetContent` defaults to `w-3/4 sm:max-w-sm` for `side="right"`. Must override with `className="!w-[min(400px,85vw)] !max-w-none"` to achieve the spec width.
- **`handleSelectTemplate` rewrite**: completely replace the function body — remove existing `setDateRange(null)` and `setHasRunQuery(false)` lines (they would sabotage auto-execute). New body: isDirty check → loadConfig → clearHistory → setDateRange(preset) → setView('results') → handleRunQuery(). Similarly for `handleLoadQuery`: isDirty check → loadConfig → clearHistory → setView('results') → handleRunQuery().
- **ColumnCollisionWarning indexOf bug**: when inlining the warning, fix the `indexOf` with a new array reference by using the map index instead.
- **`onScrollToSection` deferred to v2**: remove from `QueryPreviewSentence` props in Task 2. Section ID system and scroll implementation will be added later.
- **Affiliate card configs require runtime resolution**: the `{{CURRENT_USER_AFFILIATE_ID}}` and `{{CURRENT_USER_REFERRAL_CODE}}` placeholders are replaced by cloning the card config and injecting actual values from `api.affiliateAuth.getCurrentAffiliate` before calling `loadConfig`.
- **`setHasRunQuery(false)` removed from both `handleSelectTemplate` and `handleLoadQuery`** — the auto-execute flow relies on `handleRunQuery()` setting `hasRunQuery = true`. The old `setHasRunQuery(false)` would create a race condition.
- **Future considerations (out of scope):**
  - Draggable split-pane divider
  - Wizard/stepped builder mode for guided query building
  - Query result visualizations (charts, graphs)
  - Collaborative query building (shared sessions)
- Existing `tech-spec-query-builder-ui-redesign.md` in implementation-artifacts — this is a NEW spec, not a continuation.
