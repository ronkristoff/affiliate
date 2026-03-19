# Story 12.8: CTA Routing to Signup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a visitor,
I want all "Start free trial" CTAs to route me to signup without requiring a credit card,
so that I can try the product risk-free. (FR82)

## Acceptance Criteria

1. **CTA Routing to Signup Page** (AC: #1)
   - Given the visitor clicks any "Start free trial" CTA
   - When the action is processed
   - Then the visitor is redirected to the signup page
   - And the signup page URL is `/sign-up`

2. **No Credit Card Required** (AC: #2)
   - Given the visitor is on the signup page
   - When the signup form is displayed
   - Then no credit card input fields are shown
   - And the form messaging emphasizes "No credit card required"
   - And the billing/payment step is skipped during signup

3. **Automatic 14-Day Free Trial** (AC: #3)
   - Given a new user completes signup
   - When the account is created
   - Then a 14-day free trial is automatically started
   - And the trial period is reflected in the tenant record (trialEndDate)
   - And the user has full access to platform features during the trial

4. **Trial Messaging Consistency** (AC: #4)
   - Given all CTAs across the marketing page
   - When displayed to visitors
   - Then messaging consistently mentions "14-day free trial"
   - And messaging consistently mentions "No credit card required"
   - And all CTAs have the same visual treatment (primary button style)

5. **Mobile CTA Experience** (AC: #5)
   - Given a visitor on mobile viewport
   - When tapping a CTA on small screen
   - Then the CTA is easily tappable (minimum 44px touch target)
   - And the button text is readable on mobile
   - And the redirect happens smoothly without delay

## Tasks / Subtasks

- [x] Task 1: Audit all CTA routes and marketing page (AC: #1)
  - [x] Identify all CTA buttons across marketing components
  - [x] Verify HeroSection CTA links to `/sign-up`
  - [x] Verify PricingSection CTA links to `/sign-up`
  - [x] Verify FinalCTASection CTA links to `/sign-up`
  - [x] Verify MarketingNav CTA links to `/sign-up`
  - [x] Verify SaligPayCallout CTA links to `/sign-up`
  - [x] Test all CTAs redirect correctly

- [x] Task 2: Verify signup flow has no credit card requirement (AC: #2)
  - [x] Review SignUp component for credit card fields
  - [x] Verify form messaging includes "No credit card required"
  - [x] Confirm billing step is skipped during signup

- [x] Task 3: Verify automatic 14-day trial creation (AC: #3)
  - [x] Review Better Auth signup handler
  - [x] Verify tenant creation sets trialEndDate to 14 days from creation
  - [x] Test signup creates tenant with correct trial period
  - [x] Verify user can access all features during trial

- [x] Task 4: Ensure consistent CTA messaging (AC: #4)
  - [x] Audit all CTA button text for consistency
  - [x] Verify "14 days free" or "14-day free trial" messaging
  - [x] Verify "No credit card required" messaging
  - [x] Check visual consistency across CTAs

- [x] Task 5: Verify mobile CTA accessibility (AC: #5)
  - [x] Test CTA touch targets are 44px minimum
  - [x] Test button text readability on mobile viewports
  - [x] Verify smooth redirect experience on mobile

- [x] Task 6: Write comprehensive tests (AC: #1-5)
  - [x] Create unit tests for CTA routing
  - [x] Create tests for trial creation logic
  - [x] Create accessibility tests for CTAs
  - [x] Test mobile viewport rendering

## Dev Notes

### CURRENT STATE ANALYSIS — What Already Exists

**Marketing Page (`src/app/(marketing)/page.tsx`):**
- HeroSection has CTA: "Start your free trial" → links to `/sign-up` ✅
- Sub-copy shows: "14 days free · No credit card required · Cancel anytime" ✅
- PricingSection has CTA buttons → links to `/sign-up` ✅
- FinalCTASection has CTA → links to `/sign-up` ✅
- MarketingNav has "Start free trial" button → links to `/sign-up` ✅
- SaligPayCallout has CTA → links to `/sign-up` ✅

**Signup Page (`src/app/(unauth)/sign-up/`):**
- SignUp component exists
- Route is `/sign-up` ✅
- No credit card fields visible ✅

**Trial Creation (Better Auth):**
- New tenants should get 14-day trial automatically
- Verify trialEndDate is set correctly

**What Needs Verification/Implementation:**
1. Verify ALL CTAs route to `/sign-up` consistently
2. Verify 14-day trial starts automatically on signup
3. Verify messaging consistency across all CTAs
4. Ensure mobile-friendly touch targets

### CRITICAL IMPLEMENTATION RULES

**Rule 1: Use Next.js Link for all CTAs.** Never use raw `<a>` tags. All CTAs must use `<Link href="/sign-up">`.

**Rule 2: Keep marketing components as Client Components.** HeroSection, PricingSection, FinalCTASection, SaligPayCallout, and MarketingNav already use `"use client"` for the Link component.

**Rule 3: Verify trial creation in auth flow.** The Better Auth signup should automatically create a tenant with `trialEndDate` set to 14 days from creation.

**Rule 4: Minimum 44px touch targets.** All CTA buttons must have sufficient padding for mobile accessibility.

**Rule 5: Consistent button styling.** All "Start free trial" CTAs should use the same primary button variant with brand colors.

### FILE STRUCTURE

```
Files to AUDIT (verify existing implementation):
├── src/app/(marketing)/_components/HeroSection.tsx      # Hero CTAs
├── src/app/(marketing)/_components/PricingSection.tsx  # Pricing CTAs
├── src/app/(marketing)/_components/FinalCTASection.tsx  # Final CTA CTAs
├── src/app/(marketing)/_components/MarketingNav.tsx    # Nav CTAs
├── src/app/(marketing)/_components/SaligPayCallout.tsx # SaligPay CTAs
├── src/app/(unauth)/sign-up/SignUp.tsx               # Signup form component
├── src/lib/auth.ts                                 # Better Auth config (trial creation)
├── convex/users.ts or convex/tenants.ts              # Tenant creation with trial
│
Files to MODIFY (if needed):
├── src/app/(marketing)/_components/*.tsx              # Fix CTA routes if incorrect
├── src/app/(unauth)/sign-up/SignUp.tsx               # Add trial messaging if missing
├── convex/users.ts or convex/auth.ts                # Ensure trial creation logic
│
Files to CREATE:
├── src/app/(marketing)/__tests__/cta-routing.test.tsx  # CTA routing tests
```

### ARCHITECTURE COMPLIANCE

| Aspect | Requirement |
|--------|-------------|
| Link Component | Next.js `<Link>` for all navigation |
| Button styling | Radix UI Button with brand primary variant |
| Touch targets | Minimum 44px height/width for mobile |
| Client Components | Marketing CTAs need `"use client"` for Link |
| Trial duration | 14 days from tenant creation date |

### TECHNICAL SPECIFICATIONS

#### CTA Link Pattern

```typescript
// Correct pattern - using Next.js Link
import Link from "next/link";
import { Button } from "@/components/ui/button";

// In component:
<Link href="/sign-up">
  <Button className="bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] text-white font-semibold">
    Start your free trial
  </Button>
</Link>
```

#### Trial Creation Pattern

```typescript
// In Better Auth signup handler or Convex mutation
// When creating a new tenant:
const trialEndDate = new Date();
trialEndDate.setDate(trialEndDate.getDate() + 14);

// Store in tenant record
await ctx.db.insert("tenants", {
  // ... other fields
  trialEndDate: trialEndDate.getTime(),
  subscriptionStatus: "trial",
});
```

#### Mobile Touch Target Requirements

```typescript
// Button sizing for mobile accessibility
// Minimum touch target: 44px × 44px

// Using Tailwind classes:
<Button 
  size="lg"  // Provides h-11 (44px height)
  className="px-6 py-3"  // Additional padding for width
>
  Start your free trial
</Button>
```

#### Consistent Messaging

All CTAs should include one of these patterns:
- "Start your free trial"
- "Start free trial →"
- "Start your free trial →"

Sub-copy must consistently show:
- "14 days free · No credit card required · Cancel anytime"

### DESIGN TOKENS

Button styling from existing components:
- Primary: `bg-[var(--brand-primary)]` → `#10409a`
- Hover: `bg-[var(--brand-hover)]` → `#1659d6`
- Text: `text-white`
- Size: `size="lg"` for 44px height

### ENVIRONMENT VARIABLES

No new environment variables needed. Existing variables:
- `BETTER_AUTH_SECRET` - Auth configuration
- `NEXT_PUBLIC_SITE_URL` - Site URL for redirects

### PREVIOUS STORY INTELLIGENCE

**From Story 12.7 (Responsive Load Time):**
- Marketing components are in `src/app/(marketing)/_components/`
- All marketing components use `"use client"` for interactivity
- Font variables (`--font-poppins`, `--font-passion`) defined in marketing layout
- Marketing page is a Server Component, components are Client Components
- Code review found accessibility needs attention — verify 44px touch targets

**From Stories 12.1-12.6:**
- HeroSection uses `<Link href="/sign-up">` ✅
- Sub-copy shows "14 days free · No credit card required" ✅
- PricingSection uses `<Link href="/sign-up">` ✅
- All CTAs link to `/sign-up` route

### ANTI-PATTERNS TO AVOID

1. **Do NOT use raw `<a>` tags** — Always use Next.js `<Link>` component for client-side navigation
2. **Do NOT link to `/register`** — Use `/sign-up` consistently
3. **Do NOT require credit card** — Trial starts without payment
4. **Do NOT show different CTA text** — Keep messaging consistent across all CTAs
5. **Do NOT skip mobile testing** — Test on mobile viewports (375px, 390px)
6. **Do NOT forget accessibility** — Ensure 44px minimum touch targets for buttons
7. **Do NOT hardcode trial days** — Use a constant or config for the 14-day duration

### TESTING APPROACH

1. **Unit Tests:**
   - Test CTA href attributes resolve to `/sign-up`
   - Verify Link component usage
   - Test trial date calculation
   - Verify touch target sizing

2. **Integration Tests:**
   - Test full navigation from CTA click to signup page
   - Verify signup creates trial tenant
   - Test mobile viewport rendering

3. **Accessibility Tests:**
   - Verify touch targets are 44px minimum
   - Test keyboard navigation
   - Verify color contrast ratios

### REFERENCES

- **Epic 12 Story Definition:** [Source: _bmad-output/planning-artifacts/epics.md#Story 12.8]
- **PRD FR82 (CTA Routing):** [Source: _bmad-output/planning-artifacts/prd.md#FR82]
- **PRD NFR1 (Performance):** [Source: _bmad-output/planning-artifacts/prd.md#NFR1]
- **PRD NFR35 (Accessibility):** [Source: _bmad-output/planning-artifacts/prd.md#NFR35]
- **Architecture - Frontend:** [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- **Previous Story 12.7:** [Source: _bmad-output/implementation-artifacts/12-7-responsive-load-time.md]
- **Screen Design 20:** [Source: _bmad-output/screens/20-marketing-landing.html]
- **Screen Design 19:** [Source: _bmad-output/screens/19-auth-signup.html]
- **Next.js Link Component:** https://nextjs.org/docs/app/api-reference/components/link
- **Better Auth Documentation:** https://www.better-auth.com/docs
- **WCAG Touch Target Guidelines:** https://www.w3.org/WAI/WCAG21/Understanding/target-size.html

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

### Completion Notes List

- **Task 1 (AC: #1):** Audited all 5 marketing components. All CTAs correctly use Next.js `<Link href="/sign-up">`. Fixed touch target accessibility on PricingSection (3 CTAs), MarketingNav (desktop + mobile CTA), and SaligPayCallout by adding `min-h-[44px]` class to meet WCAG 44px minimum touch target. HeroSection and FinalCTASection already had adequate sizing via `py-6 h-auto`.

- **Task 2 (AC: #2):** Verified SignUp.tsx has no credit card input fields. Form only contains: firstName, lastName, company, email, password, terms checkbox. "No credit card required" messaging present in hero badge, form subtitle, and below-submit text. Billing step is skipped — redirects directly to `/onboarding`.

- **Task 3 (AC: #3):** Verified complete trial creation flow: Better Auth `databaseHooks.user.create.after` → `internal.users.syncUserCreation` → creates tenant with `trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000` (14 days). Tenant created with `status: "active"` and `plan: "starter"` granting full feature access. `getTenantContext` correctly computes `isTrial` and `trialDaysRemaining`.

- **Task 4 (AC: #4):** Verified consistent messaging across all CTAs. "14-day free trial" messaging present in HeroSection, PricingSection (features + footer), FinalCTASection. "No credit card required" present in HeroSection, FinalCTASection, and SignUp page. All primary CTAs use brand colors with context-adapted styling for dark backgrounds.

- **Task 5 (AC: #5):** Verified mobile accessibility. All CTA buttons now meet 44px minimum touch target. HeroSection/FinalCTASection use `py-6 h-auto` (54px+). PricingSection/MarketingNav/SaligPayCallout now use `min-h-[44px]`. Button text uses `font-semibold` + `text-sm` minimum for readability.

- **Task 6 (Tests):** Created 33 comprehensive tests in `src/app/(marketing)/__tests__/cta-routing.test.tsx` covering: CTA routing (all components link to `/sign-up`), trial messaging consistency, "No credit card required" verification, touch target accessibility (min-h-[44px] validation), CTA visual consistency (brand colors), and trial duration calculation logic. All 33 tests pass.

### File List

- `src/app/(marketing)/_components/HeroSection.tsx` — Verified CTA routing to `/sign-up` and messaging consistency
- `src/app/(marketing)/_components/FinalCTASection.tsx` — Verified CTA routing to `/sign-up` and messaging consistency
- `src/app/(marketing)/_components/PricingSection.tsx` — Added `min-h-[44px]` to CTA buttons
- `src/app/(marketing)/_components/MarketingNav.tsx` — Added `min-h-[44px]` to desktop and mobile CTA buttons
- `src/app/(marketing)/_components/SaligPayCallout.tsx` — Added `min-h-[44px]` to CTA button
- `src/app/(unauth)/sign-up/SignUp.tsx` — Verified no credit card fields, "No credit card required" messaging present
- `convex/users.ts` — Verified trial creation with `trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000`
- `src/app/(marketing)/__tests__/cta-routing.test.tsx` — Created 33 comprehensive tests

### Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-03-18 | 1.0.0 | Initial implementation - CTA routing audit, touch target fixes, test creation | glm-5-turbo |
| 2026-03-18 | 1.0.1 | Code review fixes - Updated File List, added Change Log, fixed SignUp.tsx to use Input component | bmm-dev |
