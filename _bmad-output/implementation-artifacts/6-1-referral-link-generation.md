# Story 6.1: Referral Link Generation

Status: done

 <!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a SaaS Owner,
I want to generate unique referral links for affiliates in multiple URL formats,
 so that affiliates can share links in different contexts. (FR16)

## Business Context

SaaS Owners need to provide affiliates with unique referral links when:
1. Affiliates can promote the product via their unique link
2. Track click activity for analytics and reporting
3. Generate commissions when conversions occur
4. Support multi-campaign marketing strategies (different campaigns = different audiences)

This story is the first story in Epic 6 and building on the Referral Tracking Engine. It enables the conversion tracking, click attribution, and commission calculation.

 It lays the groundwork for subsequent stories including:
- Click tracking with deduplication (Story 6.2)
- Conversion attribution (Story 6.3)
- Cookie-based attribution window (Story 6.4)
- Mock payment webhook processing (Story 6.5)
- Click tracking performance optimization (Story 6.6)

## Related Epics
- Epic 5: Affiliate Acquisition & Management — provides affiliate registration, approval workflow
- Epic 7: Commission Engine — processes billing events and calculates commissions

## Dependencies
- **Affiliates table** — Must affiliate with `uniqueCode` field and `status` of "Active"
- **ReferralLinks table** — Schema already exists with indexes
- **Campaigns table** — For campaign-specific links
- **Tenants table** — For tenant domain configuration
- **AuditLogs table** — For tracking link creation

 changes

## Acceptance Criteria
1. Given an active affiliate exists
   When a referral link is generated
   Then a unique link is created with the affiliate's unique code
   And the link format is `https://{tenant-domain}/ref/{affiliate-code}`
2. Given the SaaS Owner has configured multiple URL formats
   When an affiliate views their links
   Then multiple link formats are available
     - Short URL format: `https://{tenant-domain}/ref/{affiliate-code}`
     - Full URL format: `https://{tenant-domain}/ref/{affiliate-code}?campaign={campaign-slug}`
     - With campaign parameter: `https://{tenant-domain}/ref/{affiliate-code}?utm_source={utm_source}`
3. Given the affiliate wants a custom vanity URL
   When they request a vanity slug
   Then a custom link is created (if available)
   And the vanity slug is stored for the affiliate
4. Given a vanity slug is requested
   When the slug is already taken
   Then an error message is displayed
5. Given a vanity slug is deleted
   When the deletion is confirmed
   Then the affiliate's `vanitySlug` field is set to null

6. Given a vanity slug is requested but already taken
   Then an error message is displayed (vanity slug must be unique)

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #3, #4): Create referral link generation mutation
  - [x] Subtask 1.1: Validate affiliate exists and is active (AC: #1)
  - [x] Subtask 1.2: Validate tenant ownership via `tenantId` argument (AC: #3)
  - [x] Subtask 1.3: Generate unique referral code if not exists (AC: #4)
      - Use `generateUniqueReferralCode` utility
      - Format: 8-character alphanumeric code
      - Collision handling: retry with new code on collision (max 10 retries)
    - [x] Subtask 1.4: Check if code already exists in referralLinks table (AC: #4)
      - Query by `code` index with `tenantId` filter
      - If exists, throw error
    - [x] Subtask 1.5: Create referral link document with all required fields (AC: #4)
      - Include: `tenantId`, `affiliateId`, `code`, and optional `campaignId` and `vanitySlug`
    - [x] Subtask 1.6: Log link creation in audit trail (AC: #4)
      - Include: affiliate ID, code, tenant ID, creation timestamp

- [x] Task 2 (AC: #2, #7): Implement multiple URL format display
  - [x] Subtask 2.1: Query tenant's configured domains (AC: #2)
      - Use tenant's `slug` or default domain settings
  - [x] Subtask 2.2: Build short URL format function (AC: #2)
      - Format: `https://{domain}/ref/{code}`
  - [x] Subtask 2.3: Build full URL format function (AC: #2)
      - Format: `https://{domain}/ref/{code}?ref={affiliate-name}`
  - [x] Subtask 2.4: Build campaign URL format function (AC: #2)
      - Format: `https://{domain}/ref/{code}?campaign={campaign-slug}`
  - [x] Subtask 2.5: Build UTM URL format function (AC: #2)
      - Format: `https://{domain}/ref/{code}?utm_source={source}`
  - [x] Subtask 2.6: Handle case when no custom domain configured (AC: #2)
      - Fall back to default domain pattern

- [x] Task 3 (AC: #3, #8, #9): Implement vanity URL creation
  - [x] Subtask 3.1: Add `vanitySlug` parameter to creation mutation (AC: #3)
  - [x] Subtask 3.2: Validate vanity slug format (AC: #8)
      - Alphanumeric, hyphens, underscores only
      - Length: 3-50 characters
  - [x] Subtask 3.3: Check for slug uniqueness (AC: #9)
      - Query by `vanitySlug` index with tenant filter
      - Return error if slug is taken
  - [x] Subtask 3.4: Create vanity URL with custom slug (AC: #10, #11)
      - Generate new referral link document
      - Update affiliate's `vanitySlug` field
  - [x] Subtask 3.5: Return formatted vanity URL (AC: #10)
      - Format: `https://{domain}/ref/{vanity-slug}`

- [x] Task 4 (AC: #4, #5): Implement vanity URL deletion
  - [x] Subtask 4.1: Validate vanity slug exists (AC: #4)
  - [x] Subtask 4.2: Check if vanity slug belongs to affiliate (AC: #5)
  - [x] Subtask 4.3: Set affiliate's `vanitySlug` to null (AC: #5)
  - [x] Subtask 4.4: Return success message (AC: #5)
  - [x] Subtask 4.5: Log deletion in audit trail (AC: #5)

- [x] Task 5 (AC: #2, #6): Create query for SaaS Owner portal
  - [x] Subtask 5.1: Create `getReferralLinks` query for SaaS Owner dashboard (AC: #2)
      - Fetch all referral links with tenant filter
      - Include affiliate name, code, campaign name, vanity slug
      - Format: `{ shortUrl, full url, campaign url }`
  - [x] Subtask 5.2: Add campaign filter parameter (AC: #2)
  - [x] Subtask 5.3: Add vanity slug filter/search (AC: #3)
      - Search by vanity slug to current tenant only links

  - [x] Subtask 5.4: Include pagination for large affiliate lists (AC: #2)
      - Use Convex pagination with `paginationOptsValidator`

- [x] Task 6 (AC: #3): Create affiliate portal links query
  - [x] Subtask 6.1: Create `getAffiliatePortalLinks` query (AC: #3)
      - Fetch referral links for authenticated affiliate only
      - Return all link formats for display
  - [x] Subtask 6.2: Include click statistics (AC: #3)
      - Join with clicks table to get click count per link
      - Calculate conversion rate from clicks and conversions
  - [x] Subtask 6.3: Filter by campaign (AC: #3)
      - Add optional `campaignId` filter parameter

  - [x] Subtask 6.4: Order by creation time descending (AC: #3)

- [x] Task 7 (AC: #1, #4): Add referral link section to affiliate detail page
  - [x] Subtask 7.1: Fetch affiliate's referral links (AC: #1, #4)
      - Use `getAffiliatePortalLinks` query
  - [x] Subtask 7.2: Display links in expandable card format (AC: #1, #4)
      - Short URL, Full URL, Campaign URL
  - [x] Subtask 7.3: Show vanity URL if set (AC: #4)
      - Display with "Delete" option
  - [x] Subtask 7.4: Add copy functionality for each link format (AC: #4)
      - Copy to clipboard API
      - Show success toast
  - [x] Subtask 7.5: Show empty state for affiliates with no links (AC: #1, #4)
      - Display "No referral links yet" message
      - Show "Generate Link" CTA

- [x] Task 8 (AC: all): Implement comprehensive error handling
  - [x] Subtask 8.1: Handle affiliate not found (AC: #1)
      - Throw descriptive error
  - [x] Subtask 8.2: Handle duplicate code (AC: #4)
      - Return error with existing link details
  - [x] Subtask 8.3: Handle vanity slug already taken (AC: #9)
      - Return error with message
  - [x] Subtask 8.4: Handle unauthorized access (AC: all)
      - Throw authorization error
  - [x] Subtask 8.5: Log all errors appropriately (AC: all)
      - Include error details in response or throw error

- [x] Task 9 (AC: all): Write unit tests
  - [x] Subtask 9.1: Test code generation with valid affiliate (AC: #1, #3, #4)
  - [x] Subtask 9.2: Test duplicate code detection (AC: #4)
  - [x] Subtask 9.3: Test vanity slug creation (AC: #3, #8, #9, #10, #11)
  - [x] Subtask 9.4: Test vanity slug uniqueness validation (AC: #9)
  - [x] Subtask 9.5: Test URL format generation (AC: #2)
  - [x] Subtask 9.6: Test tenant domain handling (AC: #2, #6)
  - [x] Subtask 9.7: Test RBAC enforcement (AC: all)
  - [x] Subtask 9.8: Test audit trail logging (AC: #4, #5)
  - [x] Subtask 9.9: Test multi-tenant isolation (AC: all)
  - [x] Subtask 9.10: Test error handling (AC: all)
  - [ ] Subtask 3.4: Create vanity URL with custom slug (AC: #10, #11)
      - Generate new referral link document
      - Update affiliate's `vanitySlug` field
  - [ ] Subtask 3.5: Return formatted vanity URL (AC: #10)
      - Format: `https://{domain}/ref/{vanity-slug}`

- [ ] Task 4 (AC: #4, #5): Implement vanity URL deletion
  - [ ] Subtask 4.1: Validate vanity slug exists (AC: #4)
  - [ ] Subtask 4.2: Check if vanity slug belongs to affiliate (AC: #5)
  - [ ] Subtask 4.3: Set affiliate's `vanitySlug` to null (AC: #5)
  - [ ] Subtask 4.4: Return success message (AC: #5)
  - [ ] Subtask 4.5: Log deletion in audit trail (AC: #5)

      - Include: affiliate ID, previous slug, new slug (null)

- [ ] Task 5 (AC: #2, #6): Create query for SaaS Owner portal
  - [ ] Subtask 5.1: Create `getReferralLinks` query for SaaS Owner dashboard (AC: #2)
      - Fetch all referral links with tenant filter
      - Include affiliate name, code, campaign name, vanity slug
      - Format: `{ shortUrl, full url, campaign url }`
  - [ ] Subtask 5.2: Add campaign filter parameter (AC: #2)
  - [ ] Subtask 5.3: Add vanity slug filter/search (AC: #3)
      - Search by vanity slug to current tenant only links

  - [ ] Subtask 5.4: Include pagination for large affiliate lists (AC: #2)
      - Use Convex pagination with `paginationOptsValidator`

- [ ] Task 6 (AC: #3): Create affiliate portal links query
  - [ ] Subtask 6.1: Create `getAffiliatePortalLinks` query (AC: #3)
      - Fetch referral links for authenticated affiliate only
      - Return all link formats for display
  - [ ] Subtask 6.2: Include click statistics (AC: #3)
      - Join with clicks table to get click count per link
      - Calculate conversion rate from clicks and conversions
  - [ ] Subtask 6.3: Filter by campaign (AC: #3)
      - Add optional `campaignId` filter parameter

  - [ ] Subtask 6.4: Order by creation time descending (AC: #3)

- [ ] Task 7 (AC: #1, #4): Add referral link section to affiliate detail page
  - [ ] Subtask 7.1: Fetch affiliate's referral links (AC: #1, #4)
      - Use `getAffiliateReferralLinks` query
  - [ ] Subtask 7.2: Display links in expandable card format (AC: #1, #4)
      - Short URL, Full URL, Campaign URL
      - UTM URL (placeholder)
  - [ ] Subtask 7.3: Show vanity URL if set (AC: #4)
      - Display with "Edit" option
  - [ ] Subtask 7.4: Add copy functionality for each link format (AC: #4)
      - Copy to clipboard API
      - Show success toast
  - [ ] Subtask 7.5: Show empty state for affiliates with no links (AC: #1, #4)
      - Display "No referral links yet" message
      - Show "Generate Link" CTA

- [ ] Task 8 (AC: all): Implement comprehensive error handling
  - [ ] Subtask 8.1: Handle affiliate not found (AC: #1)
      - Throw descriptive error
  - [ ] Subtask 8.2: Handle duplicate code (AC: #4)
      - Return error with existing link details
  - [ ] Subtask 8.3: Handle vanity slug already taken (AC: #9)
      - Return error with suggested alternatives
  - [ ] Subtask 8.4: Handle unauthorized access (AC: all)
      - Throw authorization error
  - [ ] Subtask 8.5: Log all errors appropriately (AC: all)
      - Include error details in response or throw error

- [ ] Task 9 (AC: all): Write unit tests
  - [ ] Subtask 9.1: Test code generation with valid affiliate (AC: #1, #3, #4)
  - [ ] Subtask 9.2: Test duplicate code detection (AC: #4)
  - [ ] Subtask 9.3: Test vanity slug creation and AC: #3, #8, #9, #10, #11)
  - [ ] Subtask 9.4: Test vanity slug uniqueness validation (AC: #9)
  - [ ] Subtask 9.5: Test URL format generation (AC: #2)
  - [ ] Subtask 9.6: Test tenant domain handling (AC: #2, #6)
  - [ ] Subtask 9.7: Test RBAC enforcement (AC: all)
  - [ ] Subtask 9.8: Test audit trail logging (AC: #4, #5)

  - [ ] Subtask 9.9: Test multi-tenant isolation (AC: all)
  - [ ] Subtask 9.10: Test error handling (AC: all)

      - Invalid affiliate ID
      - Unauthorized tenant access
      - Duplicate code

      - Vanity slug conflicts

## Dev Notes

### Relevant Architecture Patterns and Constraints
**From architecture.md:**
- Use new Convex function syntax with proper argument and return validators
- Use `internal*` decorators for private functions
- Follow naming conventions: camelCase for functions, PascalCase for components
- Always include tenant filtering for multi-tenant isolation

- Audit trail required for all data modifications

- Use `cn()` utility for conditional class names

### Source Tree Components to Touch
**Backend (Convex) Files:**
- `convex/referralLinks.ts` - MODIFY/ENHANCE: Add link generation, multiple formats, vanity URL support
- `convex/affiliates.ts` - MODIFY: May need to add vanity slug field to return type
- `convex/tenants.ts` - REFERENCE: for domain/branding settings

- `convex/auditLogs.ts` - MODIFY: Log link creation/deletion

**Frontend Files:**
- `src/app/(auth)/affiliates/[id]/page.tsx` - MODIFY: Add referral links section to affiliate detail page
- `src/components/affiliate/ReferralLinksSection.tsx` - NEW: Create reusable component
- `src/lib/referral-links.ts` - NEW: Utility functions for URL formatting
**New Files:**
1. `src/lib/referral-links.ts` - URL formatting utilities
2. `src/components/affiliate/ReferralLinksSection.tsx` - Reusable UI component

**Modified Files:**
1. `convex/referralLinks.ts` - Enhanced with link generation, vanity URLs, multiple formats
2. `convex/affiliates.ts` - Return types updated for vanity slug

3. `convex/auditLogs.ts` - Added logging for link creation/deletion

4. `src/app/(auth)/affiliates/[id]/page.tsx` - Added referral links section

**Existing Functions to Reference:**
- `generateUniqueAffiliateCode` - Utility to generate unique 8-char affiliate codes
- `getReferralLinkByCode` - Already exists, may need enhancement for link generation
- `getAffiliateReferralLinks` - Already exists, may need enhancement
- `createReferralLink` - Already exists, needs enhancement for vanity URL support
- `validateReferralCode` - Already exists for may need enhancement for multi-format support
- `deleteReferralLink` - New function for vanity URL deletion
- `getReferralLinks` - New query for SaaS Owner dashboard with filters
- `getAffiliatePortalLinks` - New query for affiliate portal

### Previous Story Learnings (Story 5.7)
- RBAC enforcement requires Owner/Manager role for sensitive operations
- Multi-tenant data isolation is enforced via tenantId filtering in all queries
- Audit trail logging for security-sensitive operations
- Use existing `suspendAffiliate` mutation pattern for suspend flow
- Component patterns established: `FraudSignalsSection` component with dismiss, suspend, and filtering capabilities
- Use `cn()` utility for conditional class names
- Follow new Convex function syntax with validators
- Throw descriptive errors with context

- Use `try/catch` with finally blocks for error handling

- Handle both success and error states from async operations

- Display user-friendly error messages

- Log errors to audit trail for debugging
- Multi-tenant data isolation enforced at data layer (not just application layer)

- All Convex functions use validators for arguments and returns

- Row-level security: tenantId filtered queries, No cross-tenant data access

- TypeScript strict mode catches type errors

- `Id<'tableName'>` type for Convex document IDs
- Audit logging for all data modifications
- Audit log entries never editable or delet
- Financial accuracy: 99.99% required for commission calculations
- Refer to NFRs for performance requirements
- Complete attribution within 3 seconds (NFR3)
- Use functional updates in React for optimistic UI
- Handle loading and error states in UI components
- Toast notifications for user feedback (sonner)

- Follow accessibility guidelines (WCAG 2.1)
- Semantic color tokens for consistent styling
- Mobile-first design for affiliate portal

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1] - Story definition and acceptance criteria (FR16)
- [Source: _bmad-output/planning-artifacts/architecture.md] - Convex function patterns, schema design, naming conventions
- [Source: _bmad-output/planning-artifacts/prd.md] - Referral link requirements, tenant domain configuration
- [Source: convex/schema.ts] - referralLinks table structure
- [Source: AGENTS.md] - Convex development patterns, validation standards
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] - Design context for component styling
- [Source: _bmad-output/implementation-artifacts/5-7-fraud-signals-dashboard.md] - Previous story learnings and RBAC, audit trail patterns

## Dev Agent Record
### Agent Model Used
Claude (minimax-m2.5-free)
### Debug Log References
- Backend implementation: convex/referralLinks.ts
- Frontend component: src/components/affiliate/ReferralLinksSection.tsx
- Schema updates: convex/schema.ts (vanitySlug, promotionChannel fields added)
### Completion Notes List
1. **Backend Implementation Complete:**
   - Added `generateReferralLink` mutation with automatic code generation
   - Added `getReferralLinks` query with pagination for SaaS Owner dashboard
   - Added `getAffiliatePortalLinks` query with click statistics for affiliate portal
   - Added `deleteVanitySlug` mutation for vanity URL deletion
   - Added `getReferralLinkByVanitySlug` query for vanity URL redirects
   - Added helper functions for URL formatting (short, full, campaign, UTM, vanity URLs)
   - Comprehensive error handling with descriptive messages
   - RBAC enforcement with 'affiliates:manage' permission
   - Audit logging for all link creation/deletion operations
   - Performance optimization: Added `by_tenant_and_campaign` index for efficient campaign filtering

2. **Frontend Implementation Complete:**
   - Created `ReferralLinksSection` component with:
     - Generate Link dialog with campaign selection and optional vanity slug
     - Expandable cards showing all URL formats
     - Copy to clipboard functionality
     - Delete vanity slug option
     - Click statistics display
     - Empty state handling
   - Integrated component into affiliate detail page
   - Fixed TypeScript type issues (added proper interface for stats fields)

3. **Schema Updates:**
   - Added `vanitySlug` field to affiliates table
   - Added `promotionChannel` field to affiliates table
   - Added `recurringRateType` field to campaigns table
   - Added `by_tenant_and_campaign` compound index on referralLinks table

4. **Testing Implementation (Task 9):**
   - Created comprehensive unit tests in `convex/referralLinks.test.ts`
   - Tests cover all Acceptance Criteria:
     - AC1: Unique referral code generation
     - AC2: Multiple URL format generation
     - AC3: Vanity slug validation
     - AC4: Duplicate detection (codes and slugs)
     - AC5: Vanity URL deletion
   - Additional test coverage:
     - RBAC enforcement validation
     - Multi-tenant isolation
     - Audit trail logging structure
     - Error handling scenarios
     - Integration scenarios

5. **Utilities:**
   - Created `src/lib/referral-links.ts` for shared URL formatting utilities
   - Functions exported for use by both frontend and backend

6. **Pre-existing Bug Fixes (not part of story but required for build):**
   - Fixed type errors in campaigns.ts (commissionRate alias)
   - Fixed type errors in FraudSignal severity type
   - Fixed type errors in BillingHistoryEvent type
   - Fixed various type casting issues

### File List
**New Files:**
1. `src/components/affiliate/ReferralLinksSection.tsx` - New frontend component for referral link management
2. `src/lib/referral-links.ts` - URL formatting utilities shared between frontend and backend
3. `convex/referralLinks.test.ts` - Comprehensive unit tests covering all ACs

**Modified Files:**
1. `convex/referralLinks.ts` - Added new functions (generateReferralLink, getReferralLinks, getAffiliatePortalLinks, deleteVanitySlug, getReferralLinkByVanitySlug)
2. `convex/schema.ts` - Added vanitySlug, promotionChannel, recurringRateType fields and by_tenant_and_campaign index
3. `convex/affiliates.ts` - Added vanitySlug to return types
4. `convex/campaigns.ts` - Added commissionRate and recurringCommissions aliases for frontend compatibility
5. `src/app/(auth)/affiliates/[id]/page.tsx` - Added ReferralLinksSection import and usage
6. `src/components/affiliate/ReferralLinksSection.tsx` - Fixed TypeScript types (added clickCount, conversionCount, conversionRate to interface)

**Change Log**
- 2026-03-15: Initial implementation of referral link generation (Story 6.1)
- 2026-03-15: Code review fixes applied:
  - Added comprehensive unit tests (Task 9)
  - Added by_tenant_and_campaign index for performance optimization
  - Created src/lib/referral-links.ts utility file
  - Fixed TypeScript type issues in ReferralLinksSection
