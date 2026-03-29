---
title: "Query Builder UI/UX Redesign"
slug: "query-builder-ui-redesign"
created: "2026-03-29"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4, "adversarial-review", "elicitation-r4"]
tech_stack: ["Next.js 16", "React 19", "Tailwind CSS v4", "TypeScript", "Convex", "Motion/React"]
files_to_modify:
  - src/app/(auth)/reports/query-builder/page.tsx
  - src/components/ui/accordion-section.tsx
  - src/components/query-builder/FilterBuilder.tsx
  - src/hooks/useQueryBuilder.ts
  - src/lib/date-presets.ts (NEW)
code_patterns:
  - "Accordion section with grid-template-rows animation"
  - "useQueryBuilder custom hook for state management"
  - "Convex useQuery for data fetching"
  - "PageTopbar for header layout"
  - "Health check computation pattern"
test_patterns: []
---

# Tech-Spec: Query Builder UI/UX Redesign

**Created:** 2026-03-29

## Overview

### Problem Statement

The Query Builder page (`/reports/query-builder`) suffers from multiple UX issues identified through multi-agent analysis:

1. **Wall of Accordions** — 6 accordion sections stacked vertically in Advanced mode. Users lose context scrolling between Tables → Columns → Filters → Joins → Aggregations → Results. When working on Filters, they can't see which Tables were selected without scrolling up.

2. **Date Range Buried** — Date filtering (the most common operation for affiliate reports) is hidden inside the FilterBuilder component, behind a small "Date Range" label. Users expect date range controls in the top toolbar.

3. **Sidebar Identity Crisis** — Saved Queries and Templates accordion sections in the sidebar are collapsed by default (`defaultOpen={false}`), making them undiscoverable for new users and forcing returning users to manually expand them every visit.

4. **No Section Completion Status** — Users have no visual indication of which query-building sections are complete vs. incomplete. The Health Indicator only shows error/warning states, not per-section progress.

5. **Results Section Layout Shifts** — When results arrive, the Results accordion expands and causes the entire page layout to shift, creating a jarring experience.

6. **Mode Toggle Unclear** — The Wizard/Advanced toggle has no explanation of when to use which mode. New users may avoid Wizard thinking it's "for beginners" and miss the quick-start path.

7. **No Query History** — No undo/redo capability within a session. Mistakes require rebuilding from scratch or loading a saved query.

### Solution

Redesign the Query Builder Advanced mode layout to improve spatial context and reduce cognitive load through three phases:

- **Phase 1 (Quick Wins):** Open sidebar by default, add tooltips to mode toggle, make Raw JSON more visible.
- **Phase 2 (High Impact):** Add completion status badges to AccordionSection, make QuerySummary sticky, elevate date range to the top toolbar, stabilize Results section.
- **Phase 3 (Enhanced):** Add undo/redo query history in the `useQueryBuilder` hook.

All changes preserve every existing feature and user workflow. Date range UI is relocated from FilterBuilder to the toolbar (same functionality, new location). No query execution, save/load, export, or data logic is modified.

### Scope

**In Scope:**
- Sidebar default open state for Saved Queries and Templates
- Mode toggle `title` attribute tooltips
- Raw JSON `<details open>` by default
- AccordionSection `status` prop + `open`/`onOpenChange` controlled props (backward-compatible)
- QuerySummary `React.memo` + `max-height: 200px` (NOT sticky — dropped per Occam's Razor R2)
- Date range picker as Radix Popover in toolbar (presets extracted to `src/lib/date-presets.ts`)
- Date range session persistence via `useRef`
- Results section controlled mode (programmatic auto-expand + loading indicator + success indicator)
- Undo/redo query history in `useQueryBuilder` hook (50-entry cap, NO debounce, `source` param for skip)
- `title` attributes on Save/Reset/Run buttons for keyboard shortcut hints
- Mobile Safari popover dismissal testing

**Out of Scope:**
- Any changes to Wizard mode logic or templates
- New query builder paradigms (conversational, visual canvas, AI-assisted)
- Backend/Convex function changes
- Mobile-specific responsive refactor
- New features or functionality removal
- Changes to data fetching, query execution, or export logic
- Changing default mode from Advanced to Wizard (deferred — needs A/B testing)

## Context for Development

### Codebase Patterns

- **Accordion Section:** `src/components/ui/accordion-section.tsx` — 65 lines. Uses CSS Grid `grid-template-rows: 0fr/1fr` animation (300ms, cubic-bezier). Spring-animated chevron via `motion/react` (stiffness: 300, damping: 25). Props: `title`, `description?`, `icon?`, `defaultOpen?`, `children`. Uncontrolled after mount (no `open`/`onOpenChange`). Extension point for `status` badge: insert at line 45, between title block and chevron, inside the flex row.
- **State Management:** `src/hooks/useQueryBuilder.ts` — 365 lines. Single `useState<QueryConfig>` at line 128. All mutations flow through `setConfig` (line 166) — the **single chokepoint** for history stack insertion. URL sync via base64-encoded `?q=` param. Dirty check via `initialConfigRef` + JSON.stringify comparison. No existing undo/redo mechanism.
- **Layout:** `page.tsx` — 928 lines. `PageTopbar` (line 656) for header. `grid gap-6 lg:grid-cols-[260px_1fr]` (line 772) for sidebar + main. All query sections use `AccordionSection` with `defaultOpen` prop.
- **Health System:** `computeHealth()` (lines 60-122) returns `{ status, score, issues }`. Score starts at 100, deductions: no tables (idle/0), no columns (-40/error), agg without GROUP BY (-30/error), multi-table without joins (-25/error), duplicate aggs (-5/warning), column collisions (-10/warning). `HealthIndicator` (lines 124-157) renders colored pill in toolbar.
- **Date Range:** State at page level (line 467): `useState<{ start: number; end: number; preset?: string } | null>(null)`. Presets defined in `FilterBuilder.tsx` lines 62-70 as `DATE_PRESETS` constant with factory functions. UI renders as inline `<button>` elements (lines 228-236) — **violates AGENTS.md raw button rule**. Passed to `executeQuery` as `{ start, end }` (preset stripped).
- **Motion:** `motion/react` for FadeIn wrapper and spring chevron. All button animations via `btn-motion` CSS class — never add inline transitions to `<Button>`.
- **Styling:** Tailwind CSS v4. Brand: primary `#10409a`, secondary `#1659d6`. CSS vars: `--text-heading`, `--text-muted`, `--border`, `--muted`, `--hover`. Border radius: `rounded-xl` (12px).
- **Keyboard Shortcuts:** Single `useEffect` (lines 582-603): `Ctrl/Cmd+Enter` → run query, `Ctrl/Cmd+S` → save dialog. No undo/redo shortcuts yet.
- **Sidebar:** Two `AccordionSection` components at lines 774-791. Both use `defaultOpen={false}`. Contains `SavedQueriesList` and `TemplateGallery`.

### Files to Reference

| File | Lines | Purpose | Modification Type |
| ---- | ----- | ------- | ----------------- |
| `src/app/(auth)/reports/query-builder/page.tsx` | 928 | Main page — layout, state, toolbar, all sections | **Major edit** — sidebar defaults, mode tooltips, date range toolbar, sticky summary, shortcut hints, completion wiring, results stability |
| `src/components/ui/accordion-section.tsx` | 65 | Reusable accordion with animation | **Add prop** — `status?: "completed" \| "pending"` + badge rendering at line 45 |
| `src/components/query-builder/FilterBuilder.tsx` | 735 | Filter UI — contains date range presets | **Extract** — move DATE_PRESETS + helpers to shared location; remove date range UI from this component; keep accepting dateRange/onSetDateRange props |
| `src/hooks/useQueryBuilder.ts` | 365 | Query config state management | **Add feature** — history stack (`historyRef`, `historyIndexRef`), `undo()`, `redo()`, `canUndo`, `canRedo`, `clearHistory()` |
| `src/components/query-builder/ResultsTable.tsx` | 450 | Results display with grouping/sorting | **Minor** — possibly add success indicator animation |
| `src/components/query-builder/TableSelector.tsx` | — | Table selection cards | No changes |
| `src/components/query-builder/ColumnSelector.tsx` | — | Column checkboxes with search, aliases, stats | No changes |
| `src/components/query-builder/JoinBuilder.tsx` | — | Join configuration UI | No changes |
| `src/components/query-builder/AggregationBuilder.tsx` | — | Aggregation and GROUP BY UI | No changes |
| `src/components/query-builder/WizardFlow.tsx` | — | Wizard mode | No changes |
| `src/components/query-builder/SavedQueriesList.tsx` | — | Saved queries sidebar | No changes |
| `src/components/query-builder/TemplateGallery.tsx` | — | Template cards sidebar | No changes |
| `src/components/ui/PageTopbar.tsx` | — | Top bar layout component | No changes (used as-is) |
| `src/components/query-builder/skeletons.tsx` | — | Loading skeletons | No changes |

### Technical Decisions

1. **AccordionSection enhancement** — Add `status?: "completed" | "pending"` prop, `open?: boolean` and `onOpenChange?: (open: boolean) => void` controlled props.
    - **Occam's Razor (Round 2):** Do NOT replace the raw `<button>` with `<Button asChild>`. The accordion header is a section toggle, not a standard action button — `btn-motion` hover effects (scale, shadow) would look wrong on a full-width header. Fix the AGENTS.md raw button violation in a separate cleanup PR for all components. This keeps Task 5 focused and avoids the `btn-motion` + accordion animation conflict risk.
    - **F4 fix (controlled/uncontrolled):** Store `const isControlled = open !== undefined` via a ref on first render. Once initialized, the component stays in that mode for its lifetime. Never switch between controlled/uncontrolled during the component's lifecycle.
    - **Pre-mortem R2 fix:** Add a `process.env.NODE_ENV === "development"` warning if the `open` prop's presence changes between renders (e.g., was `undefined`, now `true`). This catches the `isControlled` lock-in bug during development.
    - **Validity criteria (from pre-mortem):** Only show checkmark when the section has *sufficient* data for a valid query:
      - Tables: ✅ when ≥1 table selected
      - Columns: ✅ when ≥1 column selected (AND tables section is valid)
      - Filters: ✅ only when all filter values are filled (no empty fields)
      - Joins: ✅ when all unjoined secondary tables are covered
      - Aggregations: ✅ when GROUP BY is set if aggregations exist
      - Results: ✅ never shows completion badge (it's an output, not an input)
    - **FM-1 prevention:** Use `opacity` transition for the badge (always rendered, `opacity-0` when no status) to avoid layout shift during accordion animation. Badge must have `shrink-0` in the flex row.
    - **FM-7 fix (CRITICAL):** The `open`/`onOpenChange` controlled props enable programmatic expansion of the Results accordion when results arrive (defaultOpen only works on mount).
    - **Backward compatibility:** All new props are optional. Existing consumers in `CreateCampaignModal.tsx` (4 usages) and `page.tsx` (12 usages) work unchanged without these props. Document in the prop types: "Once mounted, the component cannot switch between controlled and uncontrolled mode. Pass `open` consistently or not at all."

2. **Date range extraction** — Move `DATE_PRESETS` constant and helper functions (`startOfDay`, `endOfDay`, `startOfMonth`, `startOfLastMonth`, `startOfYear`) from `FilterBuilder.tsx` (lines 62-86) to a new shared file `src/lib/date-presets.ts`. Import from shared location in both page.tsx and FilterBuilder.tsx.
    - **Toolbar rendering:** Use a Radix Popover (already available via UI library) triggered by a single `Button` showing active range as a pill: `"Last 7 days ✕"`. Presets render as a vertical list inside the popover. This prevents toolbar clutter and z-index issues (FM-3).
    - **Pre-mortem R2 fix (mobile Safari):** Radix Popover's `onInteractOutside` may not catch mobile touch events consistently. Test on mobile Safari. If popover doesn't dismiss on outside tap, add a semi-transparent backdrop overlay that catches taps and closes the popover.
    - **FilterBuilder change:** Remove the date range UI section (lines 216-256) from FilterBuilder. **Remove the `dateRange` and `onSetDateRange` props from FilterBuilder's interface** (F14 fix — these props become dead API surface since FilterBuilder no longer renders date range). Update the call site in `page.tsx` (lines 848-849) to stop passing these props.
    - **Raw button fix:** The current date range uses raw `<button>` tags (line 228) — violation of AGENTS.md. Moving to Radix Popover + `<Button>` fixes this.
    - **Session persistence (from focus group):** Store last-used date preset label in a `useRef<string>` so the toolbar button remembers the selection within the session.

3. **QuerySummary compactness** — Occam's Razor (Round 2): Do NOT make QuerySummary sticky. It's already rendered at the top of the main content area (line 795), before all accordion sections. Users typically scroll 1-2 accordion sections before needing to reference the summary — a single swipe up brings it back into view. The sticky behavior adds browser quirks (WebKit `will-change` + sticky issues), measurement overhead, and WebKit testing requirements for marginal benefit. Instead, focus on making QuerySummary compact and information-dense so it provides value without needing to stick.
    - **Height constraint (from pre-mortem):** Add `max-h-[200px] overflow-y-auto` to QuerySummary's outer container (line 242) to prevent it from consuming too much vertical space on smaller screens (1366x768 laptops).
    - **Performance (from profiler):** Wrap `QuerySummary` in `React.memo` with a shallow comparison on `configJson` (string comparison) to prevent re-renders on every keystroke in filter fields.

4. **Undo/redo** — Add a history stack to `useQueryBuilder` hook. This is the most complex change and should be implemented carefully.
    - **Insertion point:** Inside `setConfig` (line 166) — the single chokepoint for all mutations.
    - **F3 fix (TypeScript interface):** Update `UseQueryBuilderReturn` interface (line 56-77) to change `setConfig: (config: QueryConfig) => void` → `setConfig: (config: QueryConfig, skipHistory?: boolean) => void`. Add `undo`, `redo`, `canUndo`, `canRedo` to the interface. Any external consumer that destructures `setConfig` will get the updated type automatically.
    - **F2 fix (re-render trigger):** Use `useState` for `historyIndex` instead of a ref. `const [historyIndex, setHistoryIndex] = useState(-1)`. This ensures `canUndo = historyIndex > 0` and `canRedo = historyIndex < historyRef.current.length - 1` are reactive — they trigger re-renders when history changes. `historyRef` remains a ref (no re-render needed for the stack itself, only the index).
    - **Code Review fix (double re-render):** When `undo()` calls both `setConfigState` and `setHistoryIndex`, React 19 batches these in event handlers (keyboard shortcuts). If undo is ever called from an async context, the two state updates may cause two renders. This is acceptable — the visual impact is negligible (sub-16ms). Future optimization: migrate to `useReducer` if performance profiling reveals issues.
    - **F5 prevention:** Use `configRef = useRef(config)` updated on every render. `undo()` and `redo()` read from `configRef.current` instead of closure variable to avoid stale state.
    - **FM-4 prevention:** Cap history stack at 50 entries. Drop oldest when exceeded.
    - **F1 fix (loadConfig clearing history):** Do NOT call `clearHistory()` inside `loadConfig`. The `ColumnSelector` uses `loadConfig` for bulk column changes (page.tsx line 826) — clearing history there would be catastrophic. `loadConfig` should push the current config to history BEFORE applying the new config, so the user can undo back to their pre-load state.
    - **Code Review fix (history as internal concern):** Add a `source?: "user" | "undo" | "redo"` parameter to `setConfig`. When source is `"undo"` or `"redo"`, skip history push (equivalent to `skipHistory=true` but more explicit). When `loadConfig` is called, it pushes to history with source `"user"`. This keeps `clearHistory` as a public API for `resetConfig` and `handleLoadQuery` only.
    - **Occam's Razor (Round 2):** Drop the 500ms debounce entirely. Push every mutation to the history stack. With a 50-entry cap, the stack is ~75KB max — negligible memory. Intermediate states (e.g., keystrokes in filter fields) are fine — the user can just undo through them. This removes `lastPushTimeRef` and all debounce logic, simplifying the implementation significantly.
    - **URL sync fix (from profiler):** `undo()` and `redo()` call `setConfig(newState, "undo")` — this goes through the normal path (including `syncToUrl`) but skips the history push.
    - **Save safety (from pre-mortem):** Call `clearHistory()` inside `resetConfig` only. Save dialog always captures current config (it reads `config` directly — no history involvement). `handleLoadQuery` in page.tsx calls `clearHistory()` explicitly after loading a saved query.
    - **Keyboard shortcuts:** Add `Ctrl/Cmd+Z` → `undo()` and `Ctrl/Cmd+Shift+Z` → `redo()` to the existing keyboard `useEffect` (lines 582-603).
    - **F8 fix (deep clone):** Use `structuredClone(configRef.current)` instead of `JSON.parse(JSON.stringify(configRef.current))`. `structuredClone` preserves `undefined` values in optional filter fields (`value`, `valueTo`, `values`), avoiding subtle bugs after undo where keys are deleted vs. set to undefined.

5. **Results section stability** — Convert Results accordion to controlled mode using the new `open`/`onOpenChange` props from decision #1.
    - Use a `useState<boolean>(false)` for `resultsOpen` in `QueryBuilderContent`.
    - When results change from null/empty to having rows, set `resultsOpen = true` via a `useEffect` watching `results`.
    - Always pass `open={resultsOpen}` and `onOpenChange={setResultsOpen}` to the Results AccordionSection.
    - **F7 fix (handleRunQuery dependency):** `handleRunQuery` (line 515) is a plain function (not wrapped in `useCallback`), so it captures `setResultsOpen` from the closure correctly. However, the keyboard shortcut `useEffect` (lines 582-603) depends on `handleRunQuery`. If `handleRunQuery` is refactored to `useCallback` for memoization, its dependency array must include `setResultsOpen` (or `resultsOpen` if used). Verify the `useEffect` dependency array is correct after adding the `setResultsOpen` call.
    - When `handleRunQuery` is called, reset `resultsOpen = false` so the section collapses while loading, then auto-expands when results arrive.
    - **F11 fix (loading indicator):** While results are loading and the accordion is collapsed, show a loading indicator on the Results accordion header. Change the `description` prop to show "Loading..." and add a `Loader2` icon with `animate-spin` when `hasRunQuery && !results`. This keeps the user informed even when the accordion body is collapsed.
    - Add a green pulse animation or count badge on the Results accordion title when results first arrive (success indicator from focus group).

6. **Keyboard shortcut visibility** — Add `title` attributes to existing buttons (simplest approach from Occam's Razor):
    - Save button (line 714): `title="⌘+S to save"`
    - Run button (line 738): already has `title="⌘ Enter"` — no change needed
    - Reset button (line 706): `title="Reset query"`
    - These native `title` attributes provide tooltips on hover with zero additional code.

7. **Sidebar + Raw JSON (Occam's Razor simplifications):**
    - Sidebar: Change `defaultOpen={false}` → `true` on both sidebar accordions (lines 774, 785). One-word change each.
    - Raw JSON: Change `<details>` → `<details open>` (line 356 in QuerySummary). Native HTML, one word.
    - Mode toggle: Add `title` attributes to Wizard button (`"Guided templates for quick reports"`) and Advanced button (`"Full query control"`) at lines 668-695.

## Implementation Plan

### Tasks

#### Phase 1: Quick Wins

- [ ] **Task 1: Open sidebar by default**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Change `defaultOpen={false}` → `defaultOpen={true}` on the "Saved Queries" AccordionSection (line 774) and "Templates" AccordionSection (line 785).
  - Notes: One-word change on each line. No other side effects.

- [ ] **Task 2: Add mode toggle tooltips**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Add `title="Guided templates for quick reports"` to the Wizard `<Button>` (line 668 area) and `title="Full query control"` to the Advanced `<Button>` (line 682 area).
  - Notes: Native `title` attribute — no additional components needed.

- [ ] **Task 3: Make Raw JSON visible by default**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Change `<details className="group">` → `<details className="group" open>` at line 356 inside the `QuerySummary` component.
  - Notes: Native HTML — the `<pre>` content will be visible on page load when QuerySummary renders.

- [ ] **Task 4: Add keyboard shortcut title attributes**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Add `title="⌘+S to save"` to the Save button (line 714 area). Add `title="Reset query"` to the Reset button (line 706 area). Run button already has `title="⌘ Enter"` at line 738 — no change needed.
  - Notes: Native `title` attribute provides hover tooltips with zero additional code.

#### Phase 2: High Impact

- [ ] **Task 5: Add `status`, `open`/`onOpenChange` props to AccordionSection**
  - File: `src/components/ui/accordion-section.tsx`
  - Action:
    1. Extend `AccordionSectionProps` interface to add: `status?: "completed" | "pending"`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`.
    2. Import `Check` icon from lucide-react for the completed badge.
    3. Add controlled mode logic with lifecycle stability: store `const isControlled = open !== undefined` via a `useRef` on first render. Use `isControlled.current` to determine behavior. If controlled, derive state from `open` prop and call `onOpenChange?.(newOpen)` in the toggle handler. Never switch between controlled/uncontrolled during the component's lifetime.
    4. Add dev-mode warning: in a `useEffect`, compare `prevOpenPresence` (was `open` defined?) with current. If they differ, log `console.warn("[AccordionSection] Cannot switch between controlled and uncontrolled mode after mount")`. This catches the `isControlled` lock-in bug during development.
    5. Insert status badge JSX between title block and chevron. Use opacity transition: always render a `<span>` with `shrink-0`, apply `opacity-0` when `!status`, and color classes based on status value (`completed` = emerald check with `Check` icon, `pending` = amber dot).
    6. Backward-compatible: all new props are optional. Existing consumers without these props work unchanged.
    7. Verify backward compatibility: `CreateCampaignModal.tsx` (4 usages) and `page.tsx` (12 usages) all pass `title`, `icon?`, `defaultOpen?`, `children` — none of these break with the new optional props.
    8. Document in JSDoc on the interface: "Once mounted, the component cannot switch between controlled and uncontrolled mode. Pass `open` consistently or not at all."
  - Notes: This is the foundation for Tasks 9 (completion wiring) and Task 10 (Results stability). The raw `<button>` is intentionally kept (not replaced with `<Button asChild>`) — `btn-motion` hover effects are inappropriate for a full-width accordion header. Fix the AGENTS.md raw button violation in a separate cleanup PR.

- [ ] **Task 6: Extract date presets to shared module and clean up FilterBuilder**
  - File: `src/lib/date-presets.ts` (NEW)
  - Action: Create new file containing the `DATE_PRESETS` constant (from FilterBuilder lines 62-70) and all helper functions (`startOfDay`, `endOfDay`, `startOfMonth`, `startOfLastMonth`, `startOfYear` from lines 72-86). Export all as named exports. Drop `as const` from the array (F15 fix) — use a regular `const` array to avoid readonly tuple type issues for consumers.
  - File: `src/components/query-builder/FilterBuilder.tsx`
  - Action:
    1. Remove the `DATE_PRESETS` constant and all helper functions (lines 62-86).
    2. Remove the date range UI section (lines 216-256).
    3. **Remove `dateRange` and `onSetDateRange` from `FilterBuilderProps` interface** (lines 43-44) — these become dead API surface since FilterBuilder no longer renders date range UI (F14 fix).
    4. Remove all internal references to `dateRange` and `onSetDateRange` within the component body.
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Update the `<FilterBuilder>` call site (lines 840-852) to **remove** the `dateRange={dateRange}` and `onSetDateRange={setDateRange}` props.
  - Notes: FilterBuilder becomes thinner and its interface is cleaner. The date range is now fully managed at the page level.

- [ ] **Task 7: Date range Popover in toolbar**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Import `DATE_PRESETS` from `@/lib/date-presets`.
    2. Add `Calendar` to the lucide-react import at the top of page.tsx (currently imports icons around lines 26-46). Also add `X` icon for the clear button.
    3. Add `lastDatePresetRef = useRef<string>("")` for session persistence.
    3. In the `<PageTopbar>` children area (between HealthIndicator and Run button, around line 730), add a date range `Button` with a `Popover` (from `@/components/ui/popover` or Radix):
       - Trigger button: shows `Calendar` icon + active preset label (e.g., "Last 7 days") or "Date range" when none selected. When active, show a small `X` button to clear.
       - Popover content: vertical list of preset `Button` elements, each calling `onSetDateRange({ start, end, preset: label })`. Active preset highlighted with `bg-[#10409a] text-white`.
    4. Use `<Button>` component (not raw `<button>`) for all interactive elements inside the popover.
    5. Close popover on preset selection.
  - Notes: Check if `@/components/ui/popover` exists (Radix-based). If not, use Radix Popover directly. The popover must render via portal to avoid z-index clipping (FM-3).

- [ ] **Task 8: QuerySummary compactness with React.memo**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Wrap `QuerySummary` component definition (lines 230-366) in `React.memo`. Add a custom comparator that compares only `configJson` (string equality is fast and sufficient).
    2. Inside QuerySummary's outer container (line 242), add `max-h-[200px] overflow-y-auto` to constrain height.
  - Notes: Occam's Razor (Round 2): QuerySummary is NOT made sticky — it's already at the top of the main content area. Sticky adds browser quirks (WebKit) and measurement overhead for marginal benefit. `React.memo` prevents unnecessary re-renders on every keystroke in filter fields.

- [ ] **Task 9: Wire completion status to accordion sections**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: For each main-area AccordionSection, compute and pass the `status` prop based on validity criteria:
    - Tables (line 803): `status={config.tables.length > 0 ? "completed" : undefined}`
    - Columns (line 816): `status={config.tables.length > 0 && config.columns.length > 0 ? "completed" : undefined}`
    - Filters (line 834): `status={config.filters.length > 0 && config.filters.every(f => f.value !== undefined && f.value !== "") ? "completed" : undefined}`
    - Joins (line 855): Compute unjoined secondary tables from `config.columns`/`config.aggregations`/`config.groupBy` that reference tables not in `config.tables[0]`. `status={unjoinedTables.length === 0 && config.joins.length > 0 ? "completed" : undefined}`
    - Aggregations (line 871): `status={config.aggregations.length > 0 && config.groupBy.length > 0 ? "completed" : config.aggregations.length > 0 ? "pending" : undefined}`
    - Results (line 888): No `status` prop (it's an output, not an input).
  - Notes: The Joins validity computation may require a small `useMemo` to derive the set of unjoined secondary tables. The health check logic (lines 88-98) already computes this — consider extracting to a shared helper.

- [ ] **Task 10: Results section controlled mode with auto-expand and loading indicator**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Add `const [resultsOpen, setResultsOpen] = useState(false)` in `QueryBuilderContent` (near line 467).
    2. Add a `useEffect` that watches `results`: when `results` transitions from null/empty to having rows (`results?.rows && results.rows.length > 0`), set `resultsOpen = true`.
    3. On the Results AccordionSection (line 888), replace `defaultOpen={!!results && results.rows.length > 0}` with `open={resultsOpen}` and `onOpenChange={setResultsOpen}`.
    4. When `handleRunQuery` is called (line 515), reset `resultsOpen = false` so the section collapses while loading, then auto-expands when results arrive. Verify the keyboard shortcut `useEffect` dependency array is still correct after this change (F7 fix).
    5. **F11 fix (loading indicator):** While loading, show a visual indicator on the Results accordion header even when collapsed. Change the `description` prop dynamically: when `hasRunQuery && !results`, show `"Loading results..."` with a `Loader2` icon (add to lucide-react imports) rendered inline or as a spinning indicator. Import `Loader2` from lucide-react.
    6. Add a success indicator: when results first arrive, briefly show a green pulse or count badge on the Results accordion title. This can be done with a CSS animation class that plays once.
  - Notes: This resolves FM-7 (Results won't auto-expand with uncontrolled `defaultOpen`). The controlled mode from Task 5 is a prerequisite. The loading indicator ensures the user always has visual feedback, even when the accordion body is collapsed.

#### Phase 3: Enhanced

- [ ] **Task 11: Add undo/redo history stack to useQueryBuilder**
  - File: `src/hooks/useQueryBuilder.ts`
  - Action:
    1. Update `UseQueryBuilderReturn` interface (line 56-77): change `setConfig` signature to `(config: QueryConfig, source?: "user" | "undo" | "redo") => void`. Add `undo: () => void`, `redo: () => void`, `canUndo: boolean`, `canRedo: boolean`, `clearHistory: () => void` to the interface (F3 fix).
    2. Add refs near line 127: `historyRef = useRef<QueryConfig[]>([])`, `configRef = useRef<QueryConfig>(config)`.
    3. Add state for history index: `const [historyIndex, setHistoryIndex] = useState(-1)` (F2 fix — `useState` triggers re-renders, refs don't).
    4. Update `configRef.current = config` on every render via `useEffect([], () => { configRef.current = config; })` or direct assignment in the render body.
    5. Compute `canUndo` and `canRedo` as `useMemo`: `canUndo = historyIndex > 0`, `canRedo = historyIndex < historyRef.current.length - 1` (F2 fix — reactive via `historyIndex` state).
    6. Modify `setConfig` (line 166) signature to `setConfig(newConfig: QueryConfig, source = "user")`. Inside, if `source === "user"`:
       - Truncate any "future" history (if user had undone and then makes a new change): `historyRef.current = historyRef.current.slice(0, historyIndex + 1)`.
       - Push current config: `historyRef.current = [...historyRef.current, structuredClone(configRef.current)]` (F8 fix — `structuredClone` preserves `undefined` values).
       - Cap: if `historyRef.current.length > 50`, drop `historyRef.current.shift()` and keep `historyIndex` stable.
       - Set `setHistoryIndex(historyRef.current.length - 1)`.
    7. Add `undo()`: if `historyIndex > 0`, set `const prevIndex = historyIndex - 1`, read `historyRef.current[prevIndex]`, call `setConfigState(thatConfig)`, call `syncToUrl(thatConfig)`, call `setHistoryIndex(prevIndex)`, update `configRef.current = thatConfig`.
    8. Add `redo()`: if `historyIndex < historyRef.current.length - 1`, set `const nextIndex = historyIndex + 1`, read `historyRef.current[nextIndex]`, same pattern as undo.
    9. Add `clearHistory()`: reset `historyRef.current = []`, `setHistoryIndex(-1)`.
    10. **F1 fix (loadConfig history safety):** In `loadConfig` (line 316): do NOT call `clearHistory()`. Instead, push the current config to history before applying the loaded config (the normal `setConfig` path with `source="user"` handles this automatically since `loadConfig` calls `setConfig` internally). Export `clearHistory` so page.tsx can call it explicitly from `handleLoadQuery` and `handleReset`.
    11. In `resetConfig` (line 311): call `clearHistory()` — resetting should wipe history since the user explicitly chose to start over.
    12. Export `undo`, `redo`, `canUndo`, `canRedo`, `clearHistory` from the hook return value.
  - Notes: No debounce — push every mutation (Occam's Razor R2). The 50-entry cap keeps memory negligible (~75KB). `structuredClone` requires no polyfill in modern browsers (Chrome 98+, Firefox 94+, Safari 15.4+). The `source` parameter keeps history management as an internal concern (Code Review fix).

- [ ] **Task 12: Wire undo/redo keyboard shortcuts, UI, and explicit clearHistory**
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action:
    1. Destructure `undo`, `redo`, `canUndo`, `canRedo`, `clearHistory` from `useQueryBuilder()` (line 469).
    2. In the keyboard shortcuts `useEffect` (lines 582-603), add:
       - `Ctrl/Cmd+Z` (without Shift): call `undo()` if `canUndo`.
       - `Ctrl/Cmd+Shift+Z`: call `redo()` if `canRedo`.
    3. In `handleLoadQuery` (line 561-569): after calling `loadConfig(loadedConfig)`, add `clearHistory()`. Loading a saved query from disk should wipe the undo stack (F1 fix — unlike bulk column changes via `loadConfig` which should preserve history).
    4. In `handleReset` (line 571-579): `resetConfig()` already calls `clearHistory()` internally — no additional change needed.
    5. Optionally, add small undo/redo buttons in the toolbar area (near Reset button) with `Undo2` and `Redo2` icons from lucide-react (add to imports). Disabled when `!canUndo` / `!canRedo`.
  - Notes: Task 11 is a prerequisite. The key distinction: `loadConfig` called from ColumnSelector (bulk column change) preserves history, but `loadConfig` called from `handleLoadQuery` (saved query load) explicitly clears it via `clearHistory()`.

### Acceptance Criteria

#### Phase 1: Quick Wins

- [ ] **AC-1:** Given the Query Builder page loads in Advanced mode, when the page renders, then the "Saved Queries" sidebar accordion is expanded (showing saved queries list).
- [ ] **AC-2:** Given the Query Builder page loads in Advanced mode, when the page renders, then the "Templates" sidebar accordion is expanded (showing template gallery).
- [ ] **AC-3:** Given the mode toggle is visible, when the user hovers over the "Wizard" button, then a tooltip appears saying "Guided templates for quick reports".
- [ ] **AC-4:** Given the mode toggle is visible, when the user hovers over the "Advanced" button, then a tooltip appears saying "Full query control".
- [ ] **AC-5:** Given the QuerySummary is visible (user has selected tables/columns), when the page renders, then the raw JSON section is expanded by default showing the JSON output.
- [ ] **AC-6:** Given the Save button is visible, when the user hovers over it, then a tooltip shows "⌘+S to save".
- [ ] **AC-7:** Given the Reset button is visible, when the user hovers over it, then a tooltip shows "Reset query".

#### Phase 2: High Impact

- [ ] **AC-8:** Given an AccordionSection has `status="completed"`, when the section renders, then a small green checkmark badge appears between the title text and the chevron.
- [ ] **AC-9:** Given an AccordionSection has no `status` prop, when the section renders, then no badge appears (backward compatibility).
- [ ] **AC-10:** Given an AccordionSection has `open={true}` and `onOpenChange`, when the user clicks the header, then `onOpenChange(false)` is called and the section collapses.
- [ ] **AC-11:** Given an AccordionSection has no `open` prop (uncontrolled mode), when the user clicks the header, then the section toggles normally (backward compatibility).
- [ ] **AC-12:** Given the user has selected 1+ tables, when the Tables accordion renders, then it shows a green "completed" badge.
- [ ] **AC-13:** Given the user has selected 1+ tables AND 1+ columns, when the Columns accordion renders, then it shows a green "completed" badge.
- [ ] **AC-14:** Given the user has filters with empty values, when the Filters accordion renders, then it does NOT show a completed badge.
- [ ] **AC-15:** Given the user has added aggregations but no GROUP BY, when the Aggregations accordion renders, then it shows a "pending" (amber) badge.
- [ ] **AC-16:** Given no date range is selected, when the toolbar renders, then a "Date range" button with Calendar icon is visible between HealthIndicator and Run button.
- [ ] **AC-17:** Given the user clicks the Date Range toolbar button, when the popover opens, then all 7 date presets are displayed as clickable buttons.
- [ ] **AC-18:** Given the user clicks "Last 7 days" in the date popover, when the popover closes, then the toolbar button shows "Last 7 days" with an X to clear.
- [ ] **AC-19:** Given the user clicks the X on an active date range, when cleared, then the toolbar button reverts to "Date range" and `dateRange` state is set to null.
- [ ] **AC-20:** Given the FilterBuilder renders, when it displays, then no date range UI section is present (it was removed and moved to toolbar).
- [ ] **AC-21:** Given the user scrolls down through accordion sections, when they scroll past the QuerySummary, then the QuerySummary scrolls normally off-screen (no sticky behavior).
- [ ] **AC-22:** Given the QuerySummary has many items (> 3 sections populated), when it's sticky, then its height is capped at 200px with a scrollbar.
- [ ] **AC-23:** Given the user types in a filter value field, when they type each character, then the URL `?q=` param does NOT update on every keystroke (history debounce working).
- [ ] **AC-24:** Given the user clicks "Run Query", when the results are loading, then the Results accordion is collapsed AND the description shows "Loading results..." with a spinner icon.
- [ ] **AC-25:** Given query results arrive with rows, when the results transition from null to having data, then the Results accordion automatically expands.
- [ ] **AC-26:** Given results are displayed, when the user manually collapses the Results accordion, then it stays collapsed (controlled mode respects user action).
- [ ] **AC-27:** Given results arrive, when the Results accordion auto-expands, then a brief green pulse/indicator appears on the Results title.

#### Phase 3: Enhanced

- [ ] **AC-28:** Given the user adds a table, when they press Ctrl/Cmd+Z, then the table addition is undone and the config reverts to the previous state.
- [ ] **AC-29:** Given the user has undone an action, when they press Ctrl/Cmd+Shift+Z, then the action is redone.
- [ ] **AC-30:** Given the user presses Ctrl/Cmd+Z with nothing to undo, when the shortcut fires, then nothing happens (no error, no state change).
- [ ] **AC-31:** Given the user has performed 50+ mutations, when the 51st mutation occurs, then the oldest history entry is dropped (stack stays at 50 max).
- [ ] **AC-32:** Given the user loads a saved query, when the query loads, then the history stack is cleared (cannot undo past the loaded state).
- [ ] **AC-33:** Given the user undoes an action, when they refresh the page, then the URL reflects the undone state (URL sync works correctly with undo).
- [ ] **AC-34:** Given the user rapidly types in a filter field, when they type 10 characters, then each keystroke creates a history entry (no debounce — all mutations are tracked, capped at 50).

#### Regression (All Phases)

- [ ] **AC-35:** Given the user is in Wizard mode, when they click a question card, then the query config loads and switches to Advanced mode (existing behavior preserved).
- [ ] **AC-36:** Given the user saves a query, when they reload the page and load it from Saved Queries, then the full config is restored (existing behavior preserved).
- [ ] **AC-37:** Given the user exports results, when they click the export button, then the CSV downloads correctly (existing behavior preserved).
- [ ] **AC-38:** Given the user builds a query with joins, when the MissingJoinWarning appears, then the "Zap" button still auto-applies suggested joins (existing behavior preserved).
- [ ] **AC-39:** Given the user has the Query Builder open, when they navigate away and back, then the URL `?q=` param restores their config (existing behavior preserved).

## Additional Context

### Dependencies

- No new npm packages required
- All changes use existing UI primitives (Button, Badge, AccordionSection, Popover, etc.)
- `motion/react` already available for animations
- Radix Popover: verify `@/components/ui/popover` exists; if not, Radix primitives are available via existing Radix UI dependencies
- Task 5 (AccordionSection props) must be completed before Task 10 (Results controlled mode) — dependency on `open`/`onOpenChange` props
- Task 6 (date presets extraction) must be completed before Task 7 (toolbar popover) — dependency on shared module
- Task 11 (history stack) must be completed before Task 12 (keyboard wiring) — dependency on `undo`/`redo` exports

### Testing Strategy

- **Manual visual regression:** Verify all three phases in browser at 1366x768 and 1920x1080 viewports
- **Keyboard shortcuts:** Verify ⌘+Enter (run), ⌘+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo) on both Mac and Windows
- **AccordionSection backward compatibility:** Verify all existing AccordionSection usages across the codebase still work without the new props — specifically `CreateCampaignModal.tsx` (4 usages) and `page.tsx` (12 usages)
- **Cross-browser:** Test date range Popover dismissal on mobile Safari — verify outside-tap closes popover; add backdrop overlay if it doesn't (Pre-mortem R2 fix)
- **Performance spot-check:** Verify URL `?q=` param does NOT update on every keystroke in filter fields (history debounce working — observable in browser address bar)
- **Sticky scroll test:** Verify QuerySummary does NOT stick (Occam's Razor R2 decision). It should scroll normally with the page content.
- **Date range popover:** Verify popover opens/closes correctly, presets apply, clear button works, popover doesn't clip behind other elements
- **Undo/redo stress test:** Add table → add column → add filter → undo × 3 → redo × 2 → verify state is correct at each step
- **Undo + ColumnSelector:** Select 3 columns via checkbox grid → undo → verify only the last column selection batch is undone (not the entire history wiped — F1 fix)
- **Undo + Saved Query Load:** Build query → undo a step → load saved query → verify history is cleared (cannot undo past loaded state)
- **Loading indicator:** Click Run Query → verify Results accordion shows "Loading results..." in description even while collapsed
- **Regression:** Run through full query builder workflow (wizard → advanced, save, load, export, joins, aggregations) — verify no existing functionality is broken
- **No unit tests required** — all changes are UI/UX with zero backend logic changes
- **Developer verification notes (not formal ACs):** QuerySummary React.memo effectiveness can be verified via React DevTools Profiler; history stack size can be inspected via console logging in development

### Notes

- Party mode analysis conducted with Sally (UX), Maya (Design Thinking), and Amelia (Dev) agents
- Two rounds of advanced elicitation: (1) User Persona Focus Group + Pre-mortem, (2) Failure Mode + Occam's Razor + Performance Profiler
- All recommendations are backward-compatible — optional props only
- Brand colors and design system must be respected throughout
- `btn-motion` CSS class handles all button animations — do not add inline transitions
- **High-risk items:** Task 5 (controlled AccordionSection props — affects all accordion usages), Task 11 (undo/redo history — most complex, state management critical path)
- **Known limitations:** Undo/redo history is session-only (lost on page refresh despite URL sync), date range session persistence is `useRef`-only (lost on page refresh)
- **Future considerations:** Wizard-as-default mode (needs A/B testing), conversational query interface, visual canvas query builder, mobile responsive refactor

### Elicitation Insights Applied

**Round 1 — User Persona Focus Group + Pre-mortem:**
- Alex (SaaS Owner): Always uses "Last 7 days" → added session persistence for date preset
- Alex: Didn't know ⌘+S shortcut → added visible shortcut hints via `title` attributes
- Jamie (Affiliate): Didn't know Wizard existed → noted for future (deferred)
- Jamie: Doesn't notice results → added controlled accordion + auto-expand + success indicator for Results
- Sticky summary height constraint: `max-height: 200px` with overflow scroll
- Date range in toolbar: Radix Popover, not inline buttons (prevents toolbar clutter + z-index issues)
- Completion badges: strict validity criteria per section (prevents false confidence)
- Undo/redo + save: clear history on save/load/reset (prevents stale saves)

**Round 2 — Failure Mode + Occam's Razor + Performance Profiler:**
- FM-1: Badge uses opacity trick (always rendered, `opacity-0` when no status) to avoid layout shift during animation
- FM-2: `will-change: transform` on sticky QuerySummary to prevent jank with sibling accordion animations
- FM-3: Use Radix Popover for date range dropdown (handles z-index and positioning automatically)
- FM-4: History stack capped at 50 entries (prevents unbounded memory growth)
- FM-5: `undo()`/`redo()` use `configRef.current` instead of closure variable to prevent stale state corruption
- FM-7: Added `open`/`onOpenChange` controlled props to AccordionSection (CRITICAL — without this, Results cannot be programmatically expanded)
- Occam's Razor: Simplified shortcut hints to native `title` attributes, Raw JSON to `<details open>`, sidebar to `defaultOpen={true}`
- Performance: `React.memo` on QuerySummary with `configJson` string comparison to prevent re-renders on every keystroke
- Performance: `skipHistory` flag on `setConfig` instead of bypassing `setConfig` — ensures URL sync always happens
- Performance: Debounce history pushes (500ms) to avoid filling history with intermediate keystroke states

**Round 3 — Adversarial Review (15 findings, 2 Critical / 5 High / 6 Medium / 2 Low):**
- F1 (Critical): `loadConfig` called from ColumnSelector for bulk changes — must NOT clear history. Fix: only `resetConfig` and explicit `clearHistory()` calls clear history; `loadConfig` preserves it.
- F2 (Critical): `canUndo`/`canRedo` from refs never trigger re-renders. Fix: use `useState` for `historyIndex` to make it reactive.
- F3 (High): `UseQueryBuilderReturn` TypeScript interface not updated for `skipHistory` param. Fix: update interface and add `undo`/`redo`/`canUndo`/`canRedo`/`clearHistory` to interface.
- F4 (High): Controlled/uncontrolled switching triggers React warnings. Fix: store `isControlled` at initialization, never switch modes during component lifetime.
- F5 (High): AccordionSection raw `<button>` violates AGENTS.md. Fix: replace with `<Button asChild>`.
- F6 (High): "Zero functionality" claim contradicts date range relocation. Fix: reword to acknowledge UI relocation.
- F7 (High): `handleRunQuery` dependency array not updated for `resultsOpen`. Fix: document dependency requirements in Task 10.
- F8 (Medium): `JSON.parse/stringify` loses `undefined` filter values. Fix: use `structuredClone` instead.
- F9 (Medium): Missing `Calendar` and `X` icon imports for Task 7. Fix: add to imports list.
- F10 (Medium): Sticky `top-[72px]` is a guess. Fix: measure PageTopbar height, use `transform: translateZ(0)` instead of `will-change`.
- F11 (Medium): Loading state invisible when Results collapsed during re-query. Fix: add "Loading results..." description + `Loader2` icon on accordion header.
- F12 (Medium): AC-23 and AC-34 not testable without debug tools. Fix: rewrote as observable behaviors (URL param changes).
- F13 (Medium): `will-change` + sticky has WebKit quirks. Fix: use `transform: translateZ(0)` + Safari testing note.
- F14 (Low): FilterBuilder dead props after date range removal. Fix: remove `dateRange`/`onSetDateRange` from FilterBuilder interface and call site.
- F15 (Low): `as const` readonly export type. Fix: drop `as const` from extracted presets.

**Round 4 — Code Review + Pre-mortem R2 + Occam's Razor R2:**
- Code Review: `structuredClone` is correct choice for QueryConfig (no functions to break)
- Code Review: `useState` for `historyIndex` may cause double re-render on undo — acceptable, React 19 batches in event handlers; migrate to `useReducer` if profiling reveals issues
- Code Review: History as public API concern → added `source` parameter to `setConfig` for auto-clearing on `"undo"`/`"redo"`, keeping `clearHistory` for explicit reset/load flows only
- Code Review: 500ms debounce creates inconsistent intermediate entries → dropped debounce entirely (Occam's Razor R2), push every mutation, cap at 50
- Pre-mortem R2: `isControlled` ref locks accordion into wrong mode → added dev-mode `console.warn` for prop presence changes
- Pre-mortem R2: `btn-motion` hover on accordion header → dropped `<Button asChild>` entirely, raw button kept, fix in separate cleanup PR (Occam's Razor R2)
- Pre-mortem R2: Mobile Safari popover dismissal → added backdrop overlay fallback + mobile Safari testing requirement
- Occam's Razor R2: Dropped sticky QuerySummary — already at top of page, sticky adds browser quirks for marginal benefit
- Occam's Razor R2: Dropped history debounce — every mutation tracked, 50-entry cap keeps memory negligible
