# Story 12.4: Social Proof Section

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visitor,
I want to see a social proof section with testimonials or usage stats,
so that I can trust the platform. (FR78)

## Acceptance Criteria

1. **Social Proof Section Display** (AC #1)
   - Given the visitor scrolls to the social proof section
   - When the section is visible
   - Then placeholder testimonials or logos are displayed
   - And usage stats are shown if available
   - And the content is easily replaceable post-launch

2. **Testimonial Card Styling** (AC #2)
   - Given the social proof section is displayed
   - When each testimonial card renders
   - Then testimonial content is clearly visible (quote, author, role)
   - And cards have hover effects with subtle animation
   - And layout is responsive (2 columns on desktop, 1 column on mobile)

3. **Accessibility Compliance** (AC #3)
   - Given the social proof section is displayed
   - When rendered with accessibility tools
   - Then all elements have appropriate aria labels
   - And focus states are visible for keyboard navigation
   - And placeholder content uses semantic HTML

## Tasks / Subtasks

- [x] Task 1: Verify TestimonialsSection Component (AC: #1, #2, #3)
  - [x] Verify `TestimonialsSection.tsx` exists in `src/app/(marketing)/_components/`
  - [x] Verify 2 placeholder testimonial cards with proper content
  - [x] Verify responsive layout (2 columns on desktop, 1 column on mobile)
  - [x] Verify hover effects on cards

- [x] Task 2: Verify SocialProofBar Component (AC: #1)
  - [x] Verify `SocialProofBar.tsx` exists in `src/app/(marketing)/_components/`
  - [x] Verify 3 stat pills with icons and text
  - [x] Verify responsive layout (horizontal on desktop, stacked on mobile)

- [x] Task 3: Verify Content Replaceability (AC: #1)
  - [x] Verify testimonials data structure allows easy content updates
  - [x] Verify stats data structure allows easy content updates
  - [x] Confirm placeholder content is clearly marked for post-launch replacement

- [x] Task 4: Run Code Review (AC: #1, #2, #3)
  - [x] Run code-review workflow
  - [x] Apply fixes for accessibility, performance, and code quality
  - [x] Mark story as complete

## Dev Notes

### ⚠️ CRITICAL: Already Implemented

**This story's functionality was implemented as part of Story 12.1 (Marketing Landing Page).**

The following components already exist and fulfill all acceptance criteria:

- **`src/app/(marketing)/_components/TestimonialsSection.tsx`** - Testimonials section with 2 placeholder cards
- **`src/app/(marketing)/_components/SocialProofBar.tsx`** - Stats pills section with 3 key benefits

### Existing Implementation Details

**TestimonialsSection.tsx includes:**
- Section header with appropriate title
- 2-column grid on desktop, 1 column on mobile
- 2 placeholder testimonial cards:
  - Alex R., SaaS founder, Philippines
  - Jamie L., Newsletter creator, Cebu
- Each card has: 5 stars, quote, avatar (initials), name, role
- Hover effects with transform and shadow

**SocialProofBar.tsx includes:**
- 3 stat pills in horizontal layout:
  1. "14-day free trial · No card required"
  2. "Native SaligPay integration · Zero webhook setup"
  3. "Set up in under 15 minutes · Connect · Configure · Invite"
- Icons for each pill
- Dividers between pills on desktop
- Stacked layout on mobile

### Technical Requirements

**Stack:**
- Next.js 16 App Router (Server Components)
- React + TypeScript
- Tailwind CSS v4
- shadcn/ui Card component (if used)
- Lucide React icons

**Design Tokens (from UX spec):**
- `--brand-primary`: #10409a (avatar backgrounds, accents)
- `--brand-secondary`: #1659d6 (hover states)
- `--text-heading`: #333333 (names, titles)
- `--text-body`: #474747 (quote text)
- `--text-muted`: #6b7280 (roles, subtitles)
- `--bg-surface`: #ffffff (card backgrounds)
- `--warning`: #f59e0b (star ratings)
- Border radius: 12px (cards)

**Key Implementation Details:**

1. **Testimonial Cards:**
   - Background: white with border
   - Border radius: 12px
   - Hover: translateY(-2px) with shadow-md
   - Quote text: italic, 15px, line-height 1.7
   - Avatar: gradient background (primary → secondary)

2. **Social Proof Pills:**
   - Horizontal layout with dividers
   - Icon backgrounds with brand primary opacity (0.08)
   - Responsive: stacked on mobile with no dividers

3. **Responsive Breakpoints:**
   - Mobile (< 640px): Single column testimonials, stacked pills
   - Desktop (1024px+): 2-column testimonial grid, horizontal pills

### Architecture Compliance

- **Component Location:** `src/app/(marketing)/_components/`
- **Route Integration:** Imported in `src/app/(marketing)/page.tsx`
- **Naming:** PascalCase component files
- **Styling:** Tailwind utility classes exclusively
- **Icons:** Lucide React icons

### Dependencies

No new dependencies required. Existing project has:
- Next.js 16
- React 19
- Tailwind CSS v4
- shadcn/ui components
- Lucide React icons

### Testing Considerations

- [ ] Verify testimonials display with placeholder content
- [ ] Check responsive layout at mobile/tablet/desktop breakpoints
- [ ] Verify hover effects work correctly
- [ ] Verify social proof bar displays correctly
- [ ] Verify accessibility (aria-labels, keyboard navigation)

### Previous Story Context

**From Story 12.1 (Marketing Landing Page):**
- TestimonialsSection was implemented as Task 10 of that story
- SocialProofBar was implemented as Task 4 of that story
- All components are located in `src/app/(marketing)/_components/`
- The marketing page route group `(marketing)` isolates from auth app shell
- No backend requirements - this is a static marketing component

**From Story 12.3 (Features Section):**
- Similar pattern: functionality was implemented in Story 12.1
- Code review identified issues and fixed them
- Key fixes: accessibility attributes, React key props, transition timing
- Story was marked as done after verification

### Dev Agent Action Required

**This story should be verified and marked as DONE after code review.**

The implementation is complete. The dev agent should:
1. Verify the existing implementation matches acceptance criteria
2. Run code review to identify any issues
3. Apply fixes if needed (accessibility, code quality)
4. Mark the story as done
5. No new code changes expected unless issues found

### Content Replacement Guide (Post-Launch)

**To update testimonials:**
1. Edit the testimonials data array in `TestimonialsSection.tsx`
2. Replace placeholder quotes with real customer quotes
3. Update names, roles, and locations with real customer data
4. Optionally add real avatar images via URL or file path

**To update stats:**
1. Edit the stats data in `SocialProofBar.tsx`
2. Update text and icons as needed
3. Consider adding real metrics (e.g., "500+ SaaS owners", "₱2M+ commissions tracked")

### References

- **Epic 12 Story Definition:** [Source: _bmad-output/planning-artifacts/epics.md#Story 12.4]
- **UX Design Specification - Marketing Page (Surface 6):** [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Surface 6: Marketing Page]
- **Screen Design Mockup:** [Source: _bmad-output/screens/20-marketing-landing.html]
- **Architecture Patterns:** [Source: _bmad-output/planning-artifacts/architecture.md]
- **PRD - Social Proof Section:** [Source: _bmad-output/planning-artifacts/prd.md#FR78]
- **Previous Story 12.1:** [Source: _bmad-output/implementation-artifacts/12-1-marketing-landing-page.md]
- **Previous Story 12.3:** [Source: _bmad-output/implementation-artifacts/12-3-features-section.md]

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

### Completion Notes List

- ✅ Verified `TestimonialsSection.tsx` exists and renders 2 placeholder testimonial cards with proper content (quote, author, role, stars)
- ✅ Verified responsive layout: `grid md:grid-cols-2 gap-8` (2 columns desktop, 1 column mobile)
- ✅ Verified hover effects: `motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md` with `transition-shadow`
- ✅ Verified `SocialProofBar.tsx` exists with 3 stat pills including Lucide icons (Clock, Zap, Rocket)
- ✅ Verified responsive layout: `flex-wrap` with CSS `divide-x` dividers hidden on mobile
- ✅ Verified content replaceability: both components use data arrays for easy post-launch content updates
- ✅ Removed unnecessary `"use client"` from `TestimonialsSection.tsx` — converted to Server Component
- ✅ Added accessibility: `aria-labelledby` on sections, `aria-hidden` on decorative elements, `sr-only` heading for SocialProofBar
- ✅ Added stable `id` fields to testimonials and stats data arrays (replaced `key={index}`)
- ✅ Replaced hardcoded `#fbbf24` star color with Tailwind `fill-amber-400 text-amber-400`
- ✅ Replaced hardcoded `bg-white` in SocialProofBar with `bg-[var(--bg-surface)]` design token
- ✅ Added `<figure>` / `<figcaption>` semantic HTML for testimonial cards
- ✅ Added `motion-safe:` prefix to hover animations for `prefers-reduced-motion` respect
- ✅ Restructured SocialProofBar dividers from conditional child elements to CSS `divide-x` on container
- ✅ Added Lucide icons (Clock, Zap, Rocket) to SocialProofBar stat pills with brand-primary background

### Code Review Fixes Applied (2026-03-18)

- 🔧 **Issue #1 - Screen Reader Star Ratings:** Changed star container from `aria-hidden="true"` to `aria-label="5 out of 5 stars rating"` with individual stars marked `aria-hidden="true"`
- 🔧 **Issue #2 - Semantic Role:** Added `role="article"` to testimonial Card components for better screen reader context
- 🔧 **Issue #3 - Explicit Return Types:** Added `React.JSX.Element` return type annotations to both `TestimonialsSection` and `SocialProofBar` functions
- 🔧 **Issue #4 - Empty State Handling:** Added conditional rendering with empty state message when testimonials array is empty
- 🔧 Added `import React from "react"` to both components for explicit return type support

### File List

**Modified Files:**
- src/app/(marketing)/_components/TestimonialsSection.tsx
- src/app/(marketing)/_components/SocialProofBar.tsx

**Pre-existing build errors fixed (unrelated to story):**
- src/app/(admin)/tenants/[tenantId]/_components/OverrideHistoryDrawer.tsx (tierOverrides → tier_overrides)
- src/app/(admin)/tenants/[tenantId]/_components/RemoveOverrideModal.tsx (tierOverrides → tier_overrides)
- src/app/(admin)/tenants/[tenantId]/_components/OverrideLimitsModal.tsx (tierOverrides → tier_overrides)
- src/app/(admin)/tenants/[tenantId]/_components/RecentCommissionsTable.tsx ({ Link } → default import)
- src/app/(admin)/tenants/[tenantId]/_components/TenantDetailContent.tsx ({ Link } → default import)
- src/app/(admin)/tiers/_components/EditTierConfigModal.tsx (tierConfigs → tier_configs, severity type fix)
- src/app/(admin)/tiers/_components/TierConfigClient.tsx (tierConfigs → tier_configs)
- src/app/(admin)/tiers/_components/ImpactWarningModal.tsx (severity type fix)
- src/app/(auth)/emails/history/[broadcastId]/page.tsx (useMutation → useAction, removed 3-arg useQuery)
- src/app/(auth)/emails/history/page.tsx (useMutation → useAction)

---

**Story Created:** 2026-03-18
**Story Completed:** 2026-03-18
**Epic:** 12 - Marketing & Authentication
**Priority:** P1 (Phase 7 - Platform Management)
**Estimated Effort:** 0.5 days (verification only)
**Dependencies:** Story 12.1 (Marketing Landing Page) - COMPLETED

---

## Change Log

- 2026-03-18: Verified and enhanced social proof components (TestimonialsSection, SocialProofBar). Applied accessibility improvements (aria-labelledby, aria-hidden, sr-only headings), semantic HTML (figure/figcaption), stable keys, design token compliance (replaced hardcoded colors), motion-safe hover animations, and added Lucide icons to SocialProofBar. Fixed 10 pre-existing build errors in unrelated files.
- 2026-03-18: **Code Review Completed** - Applied fixes for 4 issues: star rating accessibility (aria-label), Card semantic role (role="article"), explicit React.JSX.Element return types, and empty state handling. Story marked as done.
