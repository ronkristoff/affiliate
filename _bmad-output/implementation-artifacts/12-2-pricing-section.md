# Story 12.2: Pricing Section

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visitor,
I want to see a pricing section with all three subscription tiers,
so that I can choose the right plan for my needs. (FR76)

## Acceptance Criteria

1. **Pricing Section Display** (AC #1)
   - Given the visitor scrolls to the pricing section
   - When the section is visible
   - Then all three tiers are displayed (Starter, Growth, Scale)
   - And each tier shows price, affiliate limit, campaign limit, and key features
   - And a "Start free trial" CTA is available per tier

2. **Tier Information Display** (AC #2)
   - Given the pricing section is visible
   - When the visitor views each tier
   - Then the following information is displayed per tier:
     - **Starter**: ₱1,999/mo, 1,000 affiliates, 3 campaigns
     - **Growth**: ₱4,499/mo, 5,000 affiliates, 10 campaigns (highlighted as "Most Popular")
     - **Scale**: ₱8,999/mo, Unlimited affiliates, Unlimited campaigns, custom domain

3. **Monthly/Annual Toggle** (AC #3)
   - Given the visitor is viewing the pricing section
   - When they toggle between monthly and annual billing
   - Then all prices update to reflect the billing period
   - And annual pricing shows ~17% discount (2 months free)
   - And a "Save 17%" badge is visible when annual is selected

4. **CTA Functionality** (AC #4)
   - Given the visitor clicks any "Start free trial" CTA
   - When the action is processed
   - Then the visitor is redirected to the signup page (`/sign-up`)
   - And a 14-day free trial is communicated

## Tasks / Subtasks

- [x] Task 1: Implement PricingSection component (AC: #1, #3)
  - [x] Create `PricingSection.tsx` in `src/app/(marketing)/_components/`
  - [x] Add section header with eyebrow, title, subtitle
  - [x] Implement monthly/annual toggle with "Save 17%" badge
  - [x] Use CSS variables for brand colors (`--brand-primary`, etc.)

- [x] Task 2: Implement PricingCard component (AC: #2)
  - [x] Create `PricingCard.tsx` in `src/app/(marketing)/_components/`
  - [x] Display tier name, price, description
  - [x] Show affiliate limit and campaign limit
  - [x] Render feature list with checkmarks
  - [x] Add "Most Popular" badge for Growth tier
  - [x] Style Growth tier with elevated appearance (scale, shadow)
  - [x] Include "Start free trial" CTA button per card

- [x] Task 3: Define tier data structure (AC: #2)
  - [x] Create pricing tiers array with all tier information
  - [x] Include: name, monthlyPrice, description, affiliateLimit, campaignLimit, features
  - [x] Add `highlighted` flag for Growth tier
  - [x] Add `customDomain` flag for Scale tier

- [x] Task 4: Implement pricing calculation (AC: #3)
  - [x] Create `getPrice()` function to calculate annual vs monthly
  - [x] Annual = monthly × 10 (2 months free = ~17% discount)
  - [x] Update all card prices when toggle changes

- [x] Task 5: Add footer elements (AC: #4)
  - [x] Add footnote: "All plans include 14-day free trial with full Scale tier access"
  - [x] Add enterprise callout with "Contact us" link
  - [x] Link CTAs to `/sign-up` route

## Dev Notes

### ⚠️ CRITICAL: Already Implemented

**This story's functionality was implemented as part of Story 12.1 (Marketing Landing Page).**

The following components already exist and fulfill all acceptance criteria:

- **`src/app/(marketing)/_components/PricingSection.tsx`** - Main pricing section component
- **`src/app/(marketing)/_components/PricingCard.tsx`** - Individual tier card (embedded in PricingSection)

### Existing Implementation Details

**PricingSection.tsx includes:**
- Section header with "Pricing" eyebrow and title
- Monthly/Annual toggle with visual feedback
- "Save 17%" badge when annual is selected
- 3-column grid for pricing cards
- Footnote about 14-day free trial
- Enterprise callout section

**Pricing tiers data (already defined):**
```typescript
const pricingTiers = [
  {
    name: "Starter",
    monthlyPrice: 1999,
    description: "For new businesses testing affiliate marketing.",
    affiliateLimit: "1,000",
    campaignLimit: "3",
    features: [
      "Up to 1,000 affiliates",
      "3 campaigns",
      "Native SaligPay integration",
      "Basic reporting",
      "Email support",
      "14-day free trial",
    ],
  },
  {
    name: "Growth",
    monthlyPrice: 4499,
    description: "For growing businesses ready to scale their affiliate program.",
    affiliateLimit: "5,000",
    campaignLimit: "10",
    highlighted: true, // "Most Popular" badge + elevated styling
    features: [
      "Up to 5,000 affiliates",
      "10 campaigns",
      "Everything in Starter",
      "Advanced analytics",
      "Priority support",
      "Custom affiliate portal",
      "A/B testing",
      "API access",
    ],
  },
  {
    name: "Scale",
    monthlyPrice: 8999,
    description: "For enterprises with complex affiliate program needs.",
    affiliateLimit: "Unlimited",
    campaignLimit: "Unlimited",
    customDomain: true,
    features: [
      "Unlimited affiliates",
      "Unlimited campaigns",
      "Everything in Growth",
      "Custom domain",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom integrations",
      "White-label options",
    ],
  },
];
```

**Annual pricing calculation (already implemented):**
```typescript
const getPrice = (monthlyPrice: number) => {
  if (isAnnual) {
    // Annual = monthly × 10 (2 months free)
    return Math.round(monthlyPrice * 10);
  }
  return monthlyPrice;
};
```

### Technical Requirements

**Stack:**
- Next.js 16 App Router (Server Components)
- React + TypeScript
- Tailwind CSS v4
- shadcn/ui Button component

**Design Tokens (from UX spec):**
- `--brand-primary`: #10409a (buttons, accents)
- `--brand-secondary`: #1659d6 (hover states)
- `--text-heading`: #333333
- `--text-body`: #474747
- `--text-muted`: #6B7280
- `--success`: #10B981 (checkmarks)
- Border radius: 12px (cards)

**Styling Patterns:**
- 3-column grid on desktop (`grid grid-cols-1 md:grid-cols-3`)
- Growth tier elevated with `scale(1.04)` and enhanced shadow
- Feature list with green checkmark icons
- Responsive: single column on mobile

### Architecture Compliance

- **Component Location:** `src/app/(marketing)/_components/PricingSection.tsx`
- **Route Integration:** Imported in `src/app/(marketing)/page.tsx`
- **Naming:** PascalCase component files
- **Styling:** Tailwind utility classes exclusively
- **Icons:** Lucide React (Check from "lucide-react")

### Testing Considerations

- [x] Verify all 3 tiers display with correct information
- [x] Test monthly/annual toggle updates all prices correctly
- [x] Verify Growth tier shows "Most Popular" badge and elevated styling
- [x] Test all CTAs route to `/sign-up`
- [x] Check responsive layout at mobile/tablet/desktop breakpoints

### Previous Story Context

**From Story 12.1 (Marketing Landing Page):**
- PricingSection was implemented as Task 9 of that story
- All components are located in `src/app/(marketing)/_components/`
- The marketing page route group `(marketing)` isolates from auth app shell
- No backend requirements - this is a static marketing component

### Dev Agent Action Required

**This story should be marked as DONE after code review verification.**

The implementation is complete. The dev agent should:
1. Verify the existing implementation matches acceptance criteria
2. Run code review to mark the story as done
3. No new code changes needed

### References

- **Epic 12 Story Definition:** [Source: _bmad-output/planning-artifacts/epics.md#Story 12.2]
- **UX Design Specification - Marketing Page (Surface 6):** [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Surface 6: Marketing Page]
- **Screen Design Mockup:** [Source: _bmad-output/screens/20-marketing-landing.html]
- **Architecture Patterns:** [Source: _bmad-output/planning-artifacts/architecture.md]
- **PRD - Subscription Tiers:** [Source: _bmad-output/planning-artifacts/prd.md#Subscription Tiers]
- **Previous Story 12.1:** [Source: _bmad-output/implementation-artifacts/12-1-marketing-landing-page.md]

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

_None - implementation already complete from Story 12.1_

### Completion Notes List

- Story 12.2 functionality was implemented as part of Story 12.1
- PricingSection.tsx and embedded PricingCard component exist and verified
- All 4 acceptance criteria verified against implementation:
  - AC#1: All 3 tiers displayed with price, limits, features, CTA ✅
  - AC#2: Tier info matches spec (Starter ₱1,999, Growth ₱4,499 "Most Popular", Scale ₱8,999) ✅
  - AC#3: Monthly/annual toggle with "Save 17%" badge, annual=monthly×10 ✅
  - AC#4: All CTAs link to `/sign-up`, 14-day free trial footnote ✅
- **Code Review Fixes Applied (2026-03-18):**
  - Replaced custom toggle with shadcn/ui Switch component for accessibility
  - Added proper aria-label for screen readers
  - Fixed React keys to use stable identifiers (tier.name instead of index)
  - Added cn() utility for cleaner conditional class handling
- Story marked done per workflow Step 9

### File List

**Existing Files (from Story 12.1, verified for Story 12.2 ACs):**
- src/app/(marketing)/_components/PricingSection.tsx (modified during code review)
- src/app/(marketing)/page.tsx (imports PricingSection)

**Files Modified During Code Review:**
- src/app/(marketing)/_components/PricingSection.tsx:
  - Added Switch component import from shadcn/ui
  - Added cn() utility import
  - Replaced custom toggle button with accessible Switch component
  - Fixed React keys to use stable identifiers (tier.name)
  - Fixed feature list keys to use composite keys (${tier.name}-${index})

## Code Review (AI)

**Reviewer:** Code Review Agent  
**Date:** 2026-03-18  
**Status:** ✅ PASSED - All issues fixed

### Issues Found & Fixed

#### 🟡 MEDIUM (4) - All Fixed
1. **Accessibility - Missing ARIA Attributes** ✅ FIXED
   - Replaced custom toggle with shadcn/ui Switch component
   - Added aria-label="Toggle annual billing"
   - Switch component provides built-in keyboard handling

2. **Inconsistent Component Usage** ✅ FIXED
   - Now uses standard Switch component from `@/components/ui/switch`
   - Aligns with project design system

3. **Array Index as React Key** ✅ FIXED
   - Changed `<Card key={index}>` to `<Card key={tier.name}>`
   - Changed feature list keys to use composite keys: `${tier.name}-${index}`

4. **Missing Focus Styles** ✅ FIXED
   - Switch component provides proper focus indicators
   - Meets WCAG accessibility standards

#### 🟢 LOW (2) - Documented
1. **Description Text Discrepancy** - Minor, acceptable variation
2. **No Unit Tests** - Out of scope for verification-only story

### Acceptance Criteria Verification
| AC | Status | Notes |
|---|---|---|
| AC #1 | ✅ PASS | All 3 tiers displayed correctly |
| AC #2 | ✅ PASS | Tier info matches spec exactly |
| AC #3 | ✅ PASS | Toggle works, 17% discount applied |
| AC #4 | ✅ PASS | CTAs route to `/sign-up` |

---

**Story Created:** 2026-03-18
**Epic:** 12 - Marketing & Authentication
**Priority:** P1 (Phase 7 - Platform Management)
**Estimated Effort:** Already complete (verify only)
**Dependencies:** Story 12.1 (Marketing Landing Page) - COMPLETE
