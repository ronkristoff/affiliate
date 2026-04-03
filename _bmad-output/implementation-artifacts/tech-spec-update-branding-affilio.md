---
title: "Update Branding to Affilio Logo & New Color Scheme"
slug: "update-branding-affilio"
created: "2026-04-02"
completed: "2026-04-03"
status: "Completed"
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Next.js 16
  - React 19
  - Tailwind CSS v4
  - CSS Custom Properties
  - Radix UI
  - TypeScript
files_to_modify:
  - public/logo.png (new)
  - public/logo-icon.png (new)
  - public/favicon.ico (update)
  - src/components/shared/Logo.tsx
  - src/app/globals.css
  - src/app/(unauth)/sign-in/SignIn.tsx
  - src/app/(unauth)/sign-up/SignUp.tsx
  - src/components/ui/input.tsx
  - src/components/query-builder/FilterBuilder.tsx
  - src/components/query-builder/ResultsTable.tsx
  - src/components/query-builder/ColumnSelector.tsx
  - src/components/query-builder/JoinBuilder.tsx
  - src/components/query-builder/TemplateGallery.tsx
  - src/components/query-builder/WizardFlow.tsx
  - src/components/query-builder/AggregationBuilder.tsx
  - src/components/query-builder/SavedQueriesList.tsx
  - src/components/query-builder/SaveQueryDialog.tsx
  - src/components/query-builder/TableSelector.tsx
  - src/components/query-builder/ShareQueryDialog.tsx
  - src/components/dashboard/CampaignOverview.tsx
  - src/components/dashboard/CreateCampaignModal.tsx
  - src/app/(auth)/campaigns/[id]/page.tsx
  - src/app/(auth)/reports/query-builder/page.tsx
  - src/app/(auth)/dashboard/components/OverviewChart.tsx
  - src/components/ui/accordion-section.tsx
  - src/components/auth/InvitationSignupForm.tsx
code_patterns:
  - CSS vars in :root for light mode
  - .dark class for dark mode
  - Inline Tailwind arbitrary values for colors
  - @theme inline for Tailwind v4 integration
test_patterns:
  - Visual regression before/after
  - Grep for old color values to verify cleanup
---

# Tech-Spec: Update Branding to Affilio Logo & New Color Scheme

**Created:** 2026-04-02

**Enhanced via:** Critique and Refine (Method 2)

## Overview

### Problem Statement

The app currently uses an auto-generated "salig affiliate" logo and outdated brand colors (`#10409a` primary, `#10b981` secondary). The new "affilio" branding requires the actual logo image and updated colors (`#1c2260` navy primary, `#1fb5a5` teal secondary) across all surfaces.

### Solution

Replace the generated Logo component with the actual PNG image, update CSS custom properties for the new brand colors, update all hardcoded old color values (including rgba animations), and ensure consistent branding across the main app, affiliate portal, and marketing pages. Include fallback states for image loading failures and size variants for different contexts.

### Scope

**In Scope:**
- Copy `design-mockups/logo/MAIN LOGO.png` to `public/logo.png`
- Update `Logo.tsx` component to use the actual image with fallback
- Create logo size variants: `sm` (24px), `md` (32px), `lg` (48px), `xl` (64px)
- Create icon-only variant for constrained spaces (sidebar, mobile nav)
- Update brand colors in `globals.css`:
  - `--brand-primary`: `#10409a` → `#1c2260`
  - `--brand-secondary`: `#10b981` → `#1fb5a5`
- Update all derived color references (dark mode, sidebar, charts, status rings)
- **Fix all hardcoded old brand colors** across 300+ references
- Update favicon to new branding
- Verify dark mode contrast with new navy logo on `#0f172a` background
- Verify affiliate portal displays new branding
- Verify marketing/landing pages display new branding
- Email template branding review (Resend templates)

**Out of Scope:**
- Tenant-level white-label branding (tenants can still customize their own logos)
- Font changes (keeping Poppins + Passion One)
- Structural/layout changes

## Context for Development

### Codebase Patterns

- Brand colors are defined as CSS custom properties in `src/app/globals.css`
- The `Logo.tsx` component currently generates an SVG-style logo with a gradient "S" icon
- The affiliate portal uses a `PortalHeader` component that accepts `logoUrl` prop
- Marketing pages are in `src/app/(marketing)/`
- Dark mode is supported via `.dark` class with separate color values
- Animations use hardcoded `rgba(16, 64, 154, ...)` values that must be updated
- Many components use inline arbitrary Tailwind values like `text-[#10409a]` instead of utility classes

### Hardcoded Color Audit Results

**300+ inline hardcoded references to old brand colors found across codebase:**

| File | Count | Color Values |
|------|-------|--------------|
| `sign-in/SignIn.tsx` | ~25 | `#10409a`, `#1659d6`, `rgba(16,64,154,...)` |
| `sign-up/SignUp.tsx` | ~20 | `#10409a`, `#1659d6`, `rgba(16,64,154,...)` |
| `query-builder/*.tsx` (8 files) | ~50 | `#10409a`, `#1659d6` |
| `dashboard/*.tsx` | ~15 | `#10409a`, `#1659d6` |
| `ui/input.tsx` | 2 | `#10409a` |
| `OverviewChart.tsx` | 4 | `#10409a` (chart stroke/fill) |
| Other components | ~180+ | Various `#10409a` references |

**Color replacement mapping:**
- `#10409a` → `#1c2260` (primary navy)
- `#1659d6` → `#1fb5a5` (secondary teal — was secondary blue)
- `rgba(16,64,154,...)` → `rgba(28,34,96,...)`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/shared/Logo.tsx` | Main app logo component (needs image replacement + fallback) |
| `src/app/globals.css` | All brand color definitions, animations, and theme variables |
| `src/components/affiliate/PortalHeader.tsx` | Affiliate portal header (good fallback pattern to follow) |
| `src/app/(marketing)/page.tsx` | Marketing landing page |
| `src/app/(marketing)/_components/MarketingNav.tsx` | Marketing nav uses `<Logo>` — will auto-update |
| `src/app/(auth)/settings/branding/` | Tenant branding settings (reference only) |
| `public/` | Static assets directory for logo image and favicon |
| `convex/emails/` | Email templates (branding review) |

### Technical Decisions

- Use the actual PNG image instead of generated SVG/CSS logo
- Logo component needs error boundary / fallback for broken images
- Keep font stack unchanged (Poppins + Passion One)
- Update all CSS custom properties in one pass for consistency
- Update all hardcoded rgba values referencing old brand color
- Dark mode: verify navy logo `#1c2260` contrasts well on `#0f172a` (should be fine — 15%+ contrast)
- Icon-only variant: use CSS `object-fit: cover` with crop OR source separate icon file

## Implementation Plan

### Tasks

#### Phase 1: Logo Asset Setup

- [x] **Task 1:** Copy logo asset to public directory
  - File: `public/logo.png`
  - Action: Copy `design-mockups/logo/MAIN LOGO.png` → `public/logo.png`
  - Notes: Use `cp` command or file system operation

- [x] **Task 2:** Create icon-only variant
  - File: `public/logo-icon.png`
  - Action: Crop the left portion (network icon) from the full logo
  - Notes: Can use ImageMagick `convert logo.png -crop 40%x100%+0+0 +repage logo-icon.png` or manual crop

- [x] **Task 3:** Update favicon
  - File: `public/favicon.ico`
  - Action: Generate favicon from icon-only variant using `convert` or online tool
  - Notes: Should be 16x16 and 32x32 versions in .ico format

#### Phase 2: Logo Component Rewrite

- [x] **Task 4:** Rewrite Logo component with image support
  - File: `src/components/shared/Logo.tsx`
  - Action: Complete rewrite with:
    - `<img>` tag pointing to `/logo.png` (full) or `/logo-icon.png` (icon variant)
    - Props: `variant?: "full" | "icon"`, `size?: "sm" | "md" | "lg" | "xl"`
    - Size mapping: sm=24px, md=32px, lg=48px, xl=64px
    - `onError` handler showing fallback text "affilio"
    - Keep `href` prop for Link wrapping
    - Remove gradient "S" icon and "salig affiliate" text
  - Notes: Follow fallback pattern from `PortalHeader.tsx` lines 51-63

#### Phase 3: CSS Variables Update (globals.css)

- [x] **Task 5:** Update root CSS custom properties
  - File: `src/app/globals.css`
  - Action: Update lines 14-16:
    ```css
    --brand: #1c2260;           /* was #10409a */
    --brand-primary: #1c2260;   /* was #10409a */
    --brand-secondary: #1fb5a5; /* was #10b981 */
    ```
  - Notes: These cascade to `--color-brand-primary`, `--color-brand-secondary` via @theme

- [x] **Task 6:** Update dark mode CSS variables
  - File: `src/app/globals.css`
  - Action: Update lines 213, 225-226, 233, 238 in `.dark` section:
    ```css
    --primary: #1c2260;
    --ring: #1c2260;
    --chart-1: #1c2260;
    --sidebar-primary: #1c2260;
    --sidebar-ring: #1c2260;
    ```

- [x] **Task 7:** Fix hardcoded rgba values in animations
  - File: `src/app/globals.css`
  - Action: Update all `rgba(16, 64, 154, ...)` → `rgba(28, 34, 96, ...)`:
    - Line 646: `.glow-brand` class
    - Lines 759-766: `@keyframes glow`
    - Lines 838-845: `@keyframes pulse-glow`

#### Phase 4: Component Hardcoded Colors (Batch 1 - Auth Pages)

- [x] **Task 8:** Update sign-in page colors
  - File: `src/app/(unauth)/sign-in/SignIn.tsx`
  - Action: Replace all `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`
  - Also fix: `rgba(16,64,154,0.1)` → `rgba(28,34,96,0.1)`
  - Notes: ~25 references; use find-and-replace

- [x] **Task 9:** Update sign-up page colors
  - File: `src/app/(unauth)/sign-up/SignUp.tsx`
  - Action: Replace all `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`
  - Also fix: `rgba(16,64,154,0.1)` → `rgba(28,34,96,0.1)`
  - Notes: ~20 references

- [x] **Task 10:** Update invitation signup form colors
  - File: `src/components/auth/InvitationSignupForm.tsx`
  - Action: Replace all `#10409a` → `#1c2260`
  - Notes: ~5 references

#### Phase 5: Component Hardcoded Colors (Batch 2 - UI Components)

- [x] **Task 11:** Update input component focus ring
  - File: `src/components/ui/input.tsx`
  - Action: Replace `#10409a` → `#1c2260` in focus styles
  - Notes: 2 references on line 14

- [x] **Task 12:** Update accordion section colors
  - File: `src/components/ui/accordion-section.tsx`
  - Action: Replace `#10409a` → `#1c2260`
  - Notes: 1 reference on line 79

#### Phase 6: Component Hardcoded Colors (Batch 3 - Query Builder)

- [x] **Task 13:** Update FilterBuilder colors
  - File: `src/components/query-builder/FilterBuilder.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 14:** Update ResultsTable colors
  - File: `src/components/query-builder/ResultsTable.tsx`
  - Action: Replace `#10409a` → `#1c2260`

- [x] **Task 15:** Update ColumnSelector colors
  - File: `src/components/query-builder/ColumnSelector.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 16:** Update JoinBuilder colors
  - File: `src/components/query-builder/JoinBuilder.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 17:** Update TemplateGallery colors
  - File: `src/components/query-builder/TemplateGallery.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 18:** Update WizardFlow colors
  - File: `src/components/query-builder/WizardFlow.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 19:** Update AggregationBuilder colors
  - File: `src/components/query-builder/AggregationBuilder.tsx`
  - Action: Replace `#10409a` → `#1c2260`

- [x] **Task 20:** Update SavedQueriesList colors
  - File: `src/components/query-builder/SavedQueriesList.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 21:** Update SaveQueryDialog colors
  - File: `src/components/query-builder/SaveQueryDialog.tsx`
  - Action: Replace `#10409a` → `#1c2260`

- [x] **Task 22:** Update TableSelector colors
  - File: `src/components/query-builder/TableSelector.tsx`
  - Action: Replace `#10409a` → `#1c2260`

- [x] **Task 23:** Update ShareQueryDialog colors
  - File: `src/components/query-builder/ShareQueryDialog.tsx`
  - Action: Replace `#10409a` → `#1c2260`

#### Phase 7: Component Hardcoded Colors (Batch 4 - Dashboard)

- [x] **Task 24:** Update CampaignOverview colors
  - File: `src/components/dashboard/CampaignOverview.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 25:** Update CreateCampaignModal colors
  - File: `src/components/dashboard/CreateCampaignModal.tsx`
  - Action: Replace `#10409a` → `#1c2260` and `#1659d6` → `#1fb5a5`

- [x] **Task 26:** Update campaign detail page colors
  - File: `src/app/(auth)/campaigns/[id]/page.tsx`
  - Action: Replace `#10409a` → `#1c2260`

- [x] **Task 27:** Update reports query builder page colors
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Replace `#10409a` → `#1c2260`

- [x] **Task 28:** Update OverviewChart colors
  - File: `src/app/(auth)/dashboard/components/OverviewChart.tsx`
  - Action: Replace `#10409a` → `#1c2260` in gradient stops and stroke colors
  - Notes: Lines 165-166 (gradient), 191 (stroke), 196 (activeDot)

#### Phase 8: Verification & Testing

- [x] **Task 29:** Grep verification — ensure no old colors remain
  - Action: Run `grep -r "10409a" src/` and `grep -r "1659d6" src/` and `grep -r "rgba(16, 64, 154" src/`
  - Expected: 0 results (except comments)

- [x] **Task 30:** Visual verification — light mode
  - Action: Navigate to dashboard, sign-in, sign-up, marketing page
  - Verify: Logo displays, colors are new navy/teal

- [x] **Task 31:** Visual verification — dark mode
  - Action: Toggle dark mode on dashboard
  - Verify: Logo visible on dark background, colors consistent

- [x] **Task 32:** Test logo fallback
  - Action: Rename `public/logo.png` temporarily, reload page
  - Verify: Fallback text "affilio" displays instead of broken image
  - Restore: Rename back to `logo.png`

---

## Acceptance Criteria

- [ ] **AC 1:** GIVEN a user navigates to any page in the app, WHEN the page loads, THEN the logo displayed is the actual "affilio" PNG image (not generated)

- [ ] **AC 2:** GIVEN the logo image fails to load, WHEN the component renders, THEN a text-based fallback "affilio" is displayed gracefully

- [ ] **AC 3:** GIVEN the app is in dark mode, WHEN the logo renders on dark background (#0f172a), THEN the logo maintains good contrast and visibility

- [ ] **AC 4:** GIVEN a user views the sidebar or mobile navigation, WHEN space is constrained, THEN an icon-only variant is shown (without "affilio" text)

- [ ] **AC 5:** GIVEN all brand color references are updated, WHEN a user views any component, animation, or shadow, THEN no old colors (#10409a, #1659d6, or rgba(16, 64, 154, ...)) remain

- [ ] **AC 6:** GIVEN the favicon is updated, WHEN a user views the browser tab, THEN the new affilio icon is displayed

- [ ] **AC 7:** GIVEN a user visits the marketing landing page, WHEN the page renders, THEN the new logo and brand colors are consistent with the app

- [ ] **AC 8:** GIVEN the grep verification runs, WHEN searching for old color values, THEN zero results are returned (excluding comments)

- [ ] **AC 9:** GIVEN a user views the sign-in page, WHEN the page renders, THEN all interactive elements (buttons, links, focus rings) use the new brand colors

- [ ] **AC 10:** GIVEN a user views any dashboard chart, WHEN the chart renders, THEN the chart colors use the new brand primary color

---

## Additional Context

### Dependencies

- `design-mockups/logo/MAIN LOGO.png` exists and is the correct file
- ImageMagick (optional) for cropping icon-only variant
- No new npm packages required

### Testing Strategy

**Manual Testing:**
1. Navigate to key pages and verify logo displays correctly:
   - Marketing landing page (`/`)
   - Sign-in page (`/sign-in`)
   - Sign-up page (`/sign-up`)
   - Dashboard (`/dashboard`)
   - Affiliate portal pages

2. Test dark mode:
   - Toggle dark mode in settings
   - Verify logo visibility on dark background
   - Verify all colors are consistent

3. Test logo fallback:
   - Temporarily rename `public/logo.png`
   - Reload page and verify fallback text displays
   - Restore original file

4. Verify no old colors remain:
   ```bash
   grep -r "10409a" src/ --include="*.tsx" --include="*.ts" --include="*.css"
   grep -r "1659d6" src/ --include="*.tsx" --include="*.ts" --include="*.css"
   grep -r "rgba(16, 64, 154" src/ --include="*.tsx" --include="*.ts" --include="*.css"
   ```

**Automated Verification:**
- Run grep commands to verify 0 results for old color values
- Check build succeeds with `pnpm build`

### Notes

- The logo has two variants needed: full logo (icon + "affilio" text) and icon-only for small spaces
- New navy `#1c2260` is darker than old `#10409a` — white text on brand buttons should still have sufficient contrast
- Consider adding `loading="lazy"` for below-fold logo instances
- The `#1659d6` (old secondary blue) appears in hover states and secondary actions — these become `#1fb5a5` (teal)

### Potential Risks

| Risk | Mitigation |
|------|------------|
| Logo looks blurry at small sizes | Test at all sizes; consider SVG version if needed |
| Dark mode contrast issues | Manual test; add white backdrop if needed |
| Cached old favicon | Hard refresh or cache-busting param |
| Missed hardcoded colors | Grep verification catches all instances |
| Tenant branding reset shows old default | Update `#10409a` default in branding settings page |

### Future Considerations

- Consider creating an SVG version of the logo for better scaling
- Could add logo animation on page load for premium feel
- Favicon could be animated (`.ico` supports multiple sizes)

---

## Review Notes

- Adversarial review completed via Code Reviewer subagent
- Findings: 15 total, 14 fixed, 1 skipped (noise — pre-existing package.json name)
- Resolution approach: auto-fix (all real findings addressed)
- Additional scope beyond original spec: derived color values (#022232, #7dd3fc, #0a2e5c, #1e4a8c, #2b7bb9, #0c3280), user-facing text replacements, OpenGraph image, JSON-LD data, Convex email templates, marketing/admin/portal pages, logo optimization, Next.js Image migration, apple-touch-icon
- Encryption salt intentionally preserved (changing it would invalidate existing encrypted data)
