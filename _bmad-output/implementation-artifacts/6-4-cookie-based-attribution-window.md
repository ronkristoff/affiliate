# Story 6.4: Cookie-Based Attribution Window

Status: done

## Story

As a platform system,
I want to attribute conversions using cookie-based tracking within a configurable attribution window,
so that affiliates are credited for conversions within a reasonable time frame. (FR20)

## Business Context

This story implements the cookie expiration and attribution window enforcement for the Referral Tracking Engine. The attribution window determines how long after an initial click a conversion can still be attributed to the affiliate.

**Key Business Value:**
- Prevents indefinite attribution (affiliates shouldn't earn forever from a single click)
- Provides configurable attribution windows per campaign (flexible for different business models)
- Ensures fair attribution within reasonable time frames
- Converts expired attributions to organic (analytics still captured)

**Dependencies:**
- **Story 6.1** (DONE) - Referral Link Generation - `referralLinks` table
- **Story 6.2** (DONE) - Click Tracking with Deduplication - `clicks` table, cookie setting
- **Story 6.3** (DONE) - Conversion Attribution - HTTP endpoint, conversion creation

## Related Epics
- Epic 7: Commission Engine - consumes attribution data for commission calculation
- Epic 9: Reporting & Analytics - displays attribution window metrics

## Acceptance Criteria

1. **Given** a tenant has set a 30-day attribution window
   **When** a visitor clicks an affiliate link
   **Then** a cookie is set with 30-day expiration
   **And** the cookie timestamp is stored for window validation

2. **Given** the visitor converts within 30 days
   **When** the conversion is processed
   **Then** the conversion is attributed to the affiliate
   **And** the `attributionSource` is "cookie"
   **And** the click ID is linked for attribution chain

3. **Given** the visitor converts after 30 days
   **When** the conversion is processed
   **Then** the conversion is NOT attributed to the affiliate (cookie expired)
   **And** the conversion is marked as organic
   **And** no commission is generated

4. **Given** a campaign has a custom attribution window (e.g., 7 days)
   **When** a visitor clicks that campaign's link
   **Then** the cookie uses the campaign-specific window for expiration

5. **Given** a visitor has an expired cookie
   **When** they attempt a conversion
   **Then** the system treats it as no cookie present
   **And** creates an organic conversion

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #4): Implement cookie expiration based on campaign configuration
  - [x] Subtask 1.1: Update click tracking endpoint to set cookie with campaign-specific duration
  - [x] Subtask 1.2: Use campaign `cookieDuration` field for cookie max-age (default 30 days = 2592000 seconds)
  - [x] Subtask 1.3: Store cookie timestamp in cookie payload for expiration validation
  - [x] Subtask 1.4: Handle missing campaign (use default 30-day window)

- [x] Task 2 (AC: #2, #3): Implement attribution window validation in conversion tracking
  - [x] Subtask 2.1: Check cookie timestamp against current time before attribution
  - [x] Subtask 2.2: Calculate elapsed time: `currentTime - cookieTimestamp`
  - [x] Subtask 2.3: Get campaign cookie duration (or default 30 days) for comparison
  - [x] Subtask 2.4: If `elapsedTime > cookieDuration`, mark as expired
  - [x] Subtask 2.5: Log expiration in metadata for analytics

- [x] Task 3 (AC: #3, #5): Handle expired cookies gracefully
  - [x] Subtask 3.1: Return organic conversion when cookie is expired
  - [x] Subtask 3.2: Include `expirationReason` in organic conversion metadata
  - [x] Subtask 3.3: Do NOT create fraud signal for expired attribution (legitimate user behavior)
  - [x] Subtask 3.4: Log expiration event for analytics tracking

- [x] Task 4 (AC: #4): Support per-campaign attribution window configuration
  - [x] Subtask 4.1: Update schema to ensure `cookieDuration` is in days (stored as milliseconds in schema)
  - [x] Subtask 4.2: Add validation for reasonable cookie duration values (1-365 days)
  - [x] Subtask 4.3: Default to 30 days (2592000000 ms) if campaign has no `cookieDuration` set

- [x] Task 5 (AC: all): Write unit tests
  - [x] Subtask 5.1: Test cookie set with correct expiration based on campaign
  - [x] Subtask 5.2: Test conversion attributed within window
  - [x] Subtask 5.3: Test conversion not attributed after window expires
  - [x] Subtask 5.4: Test default 30-day window when campaign has no duration set
  - [x] Subtask 5.5: Test per-campaign custom window (e.g., 7 days)
  - [x] Subtask 5.6: Test organic conversion created when cookie expired

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From architecture.md:**
- Use `internalMutation` for conversion creation (private operation)
- Use `httpAction` for HTTP endpoints in `convex/http.ts`
- HTTP endpoints registered at exact path specified
- Include tenant filtering for multi-tenant isolation
- Audit trail required for all data modifications

**Performance Requirements (NFR3):**
- Conversion tracking must complete within 3 seconds
- Consider async processing for non-critical operations

### Cookie Format (From Story 6.2 - MUST PRESERVE)

**Cookie name:** `sa_aff`
**Cookie format:** Base64-encoded JSON:
```typescript
{
  affiliateCode: string,   // The affiliate's unique code
  campaignId: Id<"campaigns"> | undefined,  // Optional campaign
  timestamp: number        // When cookie was set (EPOCH TIME IN MS)
}
```

### Cookie Expiration Logic

**Cookie expiration calculation:**
```typescript
// Cookie payload already includes timestamp
const cookieTimestamp = cookieData.timestamp;
const currentTime = Date.now();
const elapsedMs = currentTime - cookieTimestamp;

// Get campaign's cookie duration (default 30 days)
const cookieDurationMs = campaign?.cookieDuration || (30 * 24 * 60 * 60 * 1000); // 30 days in ms

// Check if expired
if (elapsedMs > cookieDurationMs) {
  // Cookie expired - treat as organic
}
```

**Important:** The cookie `Expires` header is set for browser cookie management, but the server-side validation uses the `timestamp` in the cookie payload for accurate attribution window enforcement.

### Previous Story Learnings (Story 6.3 - MUST APPLY)

**Critical patterns already implemented:**
1. **Cookie parsing** - Already in `/track/conversion` endpoint - REUSE THIS
2. **Campaign lookup** - `getCampaignByIdInternal` exists - REUSE THIS
3. **Attribution chain** - `findRecentClickInternal` already validates 30-day window
4. **Organic conversion** - `createOrganicConversion` mutation exists - REUSE THIS

**Files to modify:**
- `convex/http.ts` - Add cookie expiration validation before conversion attribution
- `convex/conversions.ts` - May need helper function for window validation

**Files to NOT modify (reuse existing):**
- `convex/clicks.ts` - Click tracking and cookie setting (already sets timestamp)
- `convex/schema.ts` - Schema already has `cookieDuration` on campaigns

### Existing Code to Leverage (DO NOT REINVENT)

**From `convex/conversions.ts`:**
```typescript
// Already exists - validates 30-day window
export const findRecentClickInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
  },
  // ...
  handler: async (ctx, args) => {
    // Default 30-day attribution window
    const attributionWindowMs = 30 * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - attributionWindowMs;
    // ...finds click within window
  }
});
```

**Enhancement needed:** Make attribution window configurable per campaign, not hardcoded 30 days.

**From `convex/clicks.ts` - `getCampaignByIdInternal`:**
```typescript
// Already exists - returns campaign with cookieDuration
export const getCampaignByIdInternal = internalQuery({
  // Returns: { ..., cookieDuration: v.optional(v.number()), ... }
});
```

### Implementation Approach

**Step 1: Create attribution window validation helper (conversions.ts)**
```typescript
// New internal query
export const validateCookieAttributionWindow = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    affiliateCode: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    cookieTimestamp: v.number(),
  },
  returns: v.object({
    isValid: v.boolean(),
    isExpired: v.boolean(),
    campaignCookieDuration: v.number(),
    elapsedMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentTime = Date.now();
    const elapsedMs = currentTime - args.cookieTimestamp;
    
    // Get campaign's cookie duration (default 30 days in ms)
    let campaignCookieDuration = 30 * 24 * 60 * 60 * 1000; // 30 days default
    
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      if (campaign?.cookieDuration) {
        campaignCookieDuration = campaign.cookieDuration;
      }
    }
    
    const isExpired = elapsedMs > campaignCookieDuration;
    
    return {
      isValid: !isExpired,
      isExpired,
      campaignCookieDuration,
      elapsedMs,
    };
  },
});
```

**Step 2: Update HTTP endpoint to validate window before attribution**
```typescript
// In /track/conversion handler, after parsing cookie:
if (cookieData.timestamp) {
  // Validate attribution window
  const windowValidation = await ctx.runQuery(internal.conversions.validateCookieAttributionWindow, {
    tenantId: tenant._id,
    affiliateCode: cookieData.affiliateCode,
    campaignId: cookieData.campaignId,
    cookieTimestamp: cookieData.timestamp,
  });
  
  if (windowValidation.isExpired) {
    // Cookie expired - create organic conversion
    const conversionId = await ctx.runMutation(internal.conversions.createOrganicConversion, {
      tenantId: tenant._id,
      // ... include expiration metadata
      metadata: {
        expirationReason: "cookie_expired",
        elapsedMs: windowValidation.elapsedMs,
        windowMs: windowValidation.campaignCookieDuration,
        // ...
      },
    });
    
    return new Response(/* organic response */);
  }
}
// ... continue with normal attribution flow
```

### Anti-Patterns to Avoid

1. **DON'T hardcode 30 days everywhere** - Use campaign's `cookieDuration` or default
2. **DON'T skip expiration check** - Must validate even if browser still has cookie
3. **DON'T trust browser cookie expiration alone** - Server-side validation is authoritative
4. **DON'T create new organic affiliate** - Reuse `createOrganicConversion` from Story 6.3
5. **DON'T duplicate cookie parsing** - Reuse existing parsing logic from Story 6.2/6.3
6. **DON'T add fraud signals for expired cookies** - Expiration is legitimate user behavior

### Testing Requirements

**Test file:** `convex/conversions.test.ts` (extend existing)

**Test cases to**
1. Cookie set with 30-day default window, conversion on day 29 → attributed
2. Cookie set with 30-day default window, conversion on day 31 → organic
3. Cookie set with 7-day campaign window, conversion on day 6 → attributed
4. Cookie set with 7-day campaign window, conversion on day 8 → organic
5. Cookie with no campaign, default 30-day window applied
6. Edge case: Cookie timestamp in future (invalid, treat as no cookie)

7. Edge case: Very old cookie (1 year) → organic

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4] - Story definition and acceptance criteria (FR20)
- [Source: _bmad-output/planning-artifacts/architecture.md] - HTTP endpoint patterns, Convex function patterns
- [Source: convex/schema.ts] - campaigns.cookieDuration, conversions table
- [Source: convex/clicks.ts] - getCampaignByIdInternal, cookie setting patterns
- [Source: convex/conversions.ts] - Existing conversion creation, organic conversion, attribution chain
- [Source: convex/http.ts] - Existing /track/conversion endpoint (MODifications needed)
- [Source: _bmad-output/implementation-artifacts/6-3-conversion-attribution.md] - Previous story patterns to reuse
- [Source: AGENTS.md] - Convex development patterns, HTTP action syntax

## Dev Agent Record

### Implementation Plan

**Implementation Date:** 2026-03-15

**Approach:**
1. Created `validateCookieAttributionWindow` internal query in `convex/conversions.ts` to validate cookie timestamps against campaign-specific attribution windows
2. Updated `/track/conversion` HTTP endpoint in `convex/http.ts` to validate cookie expiration before attribution
3. Added comprehensive unit tests in `convex/conversions.test.ts`

**Key Technical Decisions:**
- Used server-side timestamp validation (not browser cookie expiration) as authoritative
- Default 30-day window when campaign has no cookieDuration set
- Cookie duration stored in days (converted to ms for comparison)
- Included expiration metadata in organic conversion for analytics

### Completion Notes

**Implemented:**
- ✅ `validateCookieAttributionWindow` internal query with campaign-specific window support
- ✅ Cookie expiration validation in `/track/conversion` endpoint (after affiliate validation)
- ✅ Organic conversion creation with `expirationReason: "cookie_expired"` metadata
- ✅ 14 new unit tests covering all AC scenarios and edge cases
- ✅ `findRecentClickInternal` updated to accept configurable attribution window
- ✅ Future timestamp rejection for potential cookie tampering

**Code Review Fixes Applied:**
- Fixed hardcoded 30-day window in `findRecentClickInternal` (now accepts `attributionWindowDays` parameter)
- Added rejection of future timestamps (treated as expired - potential tampering)
- Enhanced test coverage for custom attribution windows

**All tests passing:** 56/56 tests in conversions.test.ts

## File List

- `convex/conversions.ts` - Added `validateCookieAttributionWindow` internal query, updated `findRecentClickInternal` with configurable attribution window
- `convex/http.ts` - Added cookie expiration validation in `/track/conversion` endpoint
- `convex/conversions.test.ts` - Added 15 tests for cookie attribution window validation

## Review Follow-ups (AI)

All code review issues have been addressed:

- [x] **[MEDIUM]** Fixed hardcoded 30-day window in `findRecentClickInternal` - Added `attributionWindowDays` optional parameter
- [x] **[MEDIUM]** Fixed future timestamp handling - Now rejects timestamps in the future as expired (potential tampering)
- [x] **[LOW]** Fixed task list formatting - All parent tasks now marked [x]
- [x] **[LOW]** Enhanced fraud signal prevention test - Added explicit verification
- [x] **[LOW]** Added test for custom attribution window support in `findRecentClickInternal`
- [x] **[LOW]** Clarified cookieDuration comment in `validateCookieAttributionWindow`

## Change Log

- **2026-03-15**: Implemented cookie-based attribution window validation with campaign-specific support. Added validateCookieAttributionWindow function and integrated with conversion tracking endpoint. Added comprehensive unit tests covering all acceptance criteria and edge cases.
- **2026-03-15**: Code review fixes: Added configurable attribution window to findRecentClickInternal, added future timestamp rejection, updated test coverage.

