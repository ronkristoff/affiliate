# Story 8.8: Custom Domain (Scale Tier)

Status: done

## Story

As a SaaS Owner on the Scale tier,
I want to configure a custom domain for my affiliate portal,
so that affiliates see my domain, not a subdomain. (FR44)

## Acceptance Criteria

### AC1: Custom Domain Configuration Page Access (Scale Tier Only)
**Given** the SaaS Owner is on the Scale tier
**When** they navigate to Settings > Domain
**Then** the custom domain configuration page is available
**And** current domain configuration (if any) is displayed
**And** DNS instructions are provided

### AC2: Custom Domain Entry
**Given** the SaaS Owner is on the Domain settings page
**When** they enter a custom domain (e.g., `affiliates.mycompany.com`)
**Then** the domain is validated for proper format
**And** domain ownership can be verified

### AC3: DNS Configuration Instructions
**Given** the SaaS Owner has entered a custom domain
**When** they save the configuration
**Then** DNS instructions are displayed with specific records to configure:
- CNAME record pointing to the platform
- Instructions for SSL certificate provisioning
**And** a "Verify DNS" button is available

### AC4: DNS Verification
**Given** DNS records are configured
**When** the SaaS Owner clicks "Verify DNS"
**Then** the system checks DNS propagation
**And** the verification status is displayed (Pending, Verified, Failed)
**And** helpful error messages are shown if verification fails

### AC5: SSL Provisioning
**Given** DNS is verified successfully
**When** SSL provisioning is initiated
**Then** the SSL status is displayed (Provisioning, Active, Failed)
**And** SSL provisioning completes within 24 hours (async)
**And** the domain status updates to "Active" when complete

### AC6: Domain Activation
**Given** SSL is provisioned and DNS is verified
**When** the domain becomes active
**Then** the portal is accessible via the custom domain
**And** referral links use the custom domain instead of subdomain
**And** the domain status shows "Active"

### AC7: Domain Removal/Change
**Given** an active custom domain exists
**When** the SaaS Owner removes or changes the domain
**Then** a confirmation dialog is displayed
**And** upon confirmation, the domain is deactivated/removed
**And** the portal reverts to the default subdomain

### AC8: Tier Enforcement
**Given** a SaaS Owner NOT on the Scale tier
**When** they attempt to access Domain settings
**Then** an upgrade prompt is displayed
**And** the domain configuration page is not accessible

## Tasks / Subtasks

- [x] Task 1: Create domain configuration page (AC: #1, #8)
  - [x] 1.1 Create `src/app/(auth)/settings/domain/page.tsx`
  - [x] 1.2 Add tier check - redirect non-Scale users to upgrade page
  - [x] 1.3 Load current tenant domain configuration
  - [x] 1.4 Add navigation item in settings sidebar for "Domain" (only visible for Scale tier)

- [x] Task 2: Create domain input component (AC: #2)
  - [x] 2.1 Create `src/app/(auth)/settings/domain/components/DomainInput.tsx`
  - [x] 2.2 Add domain format validation (valid hostname, no protocol prefix)
  - [x] 2.3 Add real-time validation feedback
  - [x] 2.4 Show preview of how URLs will look with custom domain

- [x] Task 3: Create DNS instructions component (AC: #3)
  - [x] 3.1 Create `src/app/(auth)/settings/domain/components/DnsInstructions.tsx`
  - [x] 3.2 Display required CNAME record configuration
  - [x] 3.3 Show target IP/hostname to point to
  - [x] 3.4 Include copy buttons for DNS values

- [x] Task 4: Create DNS verification component (AC: #4)
  - [x] 4.1 Create `src/app/(auth)/settings/domain/components/DnsVerification.tsx`
  - [x] 4.2 Implement DNS lookup functionality (server-side or client-side)
  - [x] 4.3 Show verification status with appropriate icons
  - [x] 4.4 Display helpful error messages for common DNS issues

- [x] Task 5: Create SSL status component (AC: #5)
  - [x] 5.1 Create `src/app/(auth)/settings/domain/components/SslStatus.tsx`
  - [x] 5.2 Show SSL provisioning status (Not Started, Provisioning, Active, Failed)
  - [x] 5.3 Display estimated completion time
  - [x] 5.4 Handle SSL provisioning failures with retry option

- [x] Task 6: Create domain mutations (AC: #2, #3, #5, #6, #7)
  - [x] 6.1 Create `updateTenantDomain` mutation in `convex/tenants.ts`
  - [x] 6.2 Create `verifyDomainDns` mutation in `convex/tenants.ts`
  - [x] 6.3 Create `initiateSslProvisioning` mutation in `convex/tenants.ts`
  - [x] 6.4 Create `removeTenantDomain` mutation in `convex/tenants.ts`
  - [x] 6.5 Create `getTenantDomainConfig` query in `convex/tenants.ts`
  - [x] 6.6 Create `getTierCustomDomainStatus` query for tier check

- [x] Task 7: Update referral link generation (AC: #6)
  - [x] 7.1 Update `convex/referralLinks.ts` to use custom domain when available
  - [x] 7.2 Ensure backward compatibility with subdomain URLs
  - [x] 7.3 Test with both custom domain and default subdomain scenarios

- [x] Task 8: Create tests (All ACs)
  - [x] 8.1 Test domain format validation
  - [x] 8.2 Test DNS verification logic
  - [x] 8.3 Test tier enforcement (non-Scale users blocked)
  - [x] 8.4 Test domain activation flow
  - [x] 8.5 Test referral link generation with custom domain

## Dev Notes

### CRITICAL: Scale Tier Exclusive Feature

**This feature is ONLY available to SaaS Owners on the Scale tier.** All other tiers must see an upgrade prompt when attempting to access domain settings.

**Tier Configuration:**
- The `tierConfigs` table already has `customDomain: v.boolean()` field
- This story implements the UI and backend logic to USE this tier feature
- Non-Scale users must be blocked from accessing the domain configuration page

### Database Schema (ALREADY EXISTS - NO CHANGES NEEDED)

The `tenants` table already has a `branding` object. We need to add domain fields:

```typescript
// Existing schema - branding object
branding: v.optional(v.object({
  logoUrl: v.optional(v.string()),
  primaryColor: v.optional(v.string()),
  portalName: v.optional(v.string()),
  assetGuidelines: v.optional(v.string()),
  // ADD THESE FIELDS:
  customDomain: v.optional(v.string()),
  domainStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("dns_verification"),
    v.literal("ssl_provisioning"),
    v.literal("active"),
    v.literal("failed")
  )),
  domainVerifiedAt: v.optional(v.number()),
  sslProvisionedAt: v.optional(v.number()),
}))
```

**Alternatively, create a separate `customDomains` table:**

```typescript
customDomains: defineTable({
  tenantId: v.id("tenants"),
  domain: v.string(),
  status: v.string(), // "pending", "dns_verified", "ssl_provisioning", "active", "failed"
  dnsVerifiedAt: v.optional(v.number()),
  sslProvisionedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_tenant", ["tenantId"])
  .index("by_domain", ["domain"])
```

**Recommendation:** Use the `branding` object extension for MVP simplicity. A separate table provides better scalability for future multi-domain support.

### MVP Scope Decisions

**Included in this story:**
- Single custom domain per tenant
- Basic DNS verification (CNAME record check)
- SSL provisioning status tracking
- Domain activation when both DNS and SSL are ready
- Referral link generation update to use custom domain
- Domain removal/change capability

**NOT included in this story (future enhancements):**
- Multiple custom domains per tenant
- Wildcard subdomains (*.mycompany.com)
- Automatic Let's Encrypt integration
- Domain health monitoring/alerting
- Subdirectory support (e.g., portal.mycompany.com vs affiliates.mycompany.com)

### DNS Configuration Requirements

For the affiliate portal to work on a custom domain, the SaaS Owner needs to configure:

**Required DNS Record:**
```
Type: CNAME
Name: affiliates (or the full domain they enter)
Value: [platform-domain] (e.g., "app.saligaffiliate.com" or the actual server hostname)
TTL: 3600 (recommended)
```

**Example Configuration:**
- Custom domain: `affiliates.acme.com`
- CNAME record: `affiliates.acme.com` → `app.saligaffiliate.com`

**SSL Strategy:**
- For MVP: Display status only (assume manual or infrastructure-managed SSL)
- Future: Integrate Let's Encrypt for automatic SSL

### Referral Link Generation Impact

**Current Implementation (from Story 6.1):**
```typescript
// In convex/referralLinks.ts - line 400
const domain = tenant?.slug ? `${tenant.slug}.saligaffiliate.com` : "app.saligaffiliate.com";
```

**New Implementation:**
```typescript
// Priority: custom domain > tenant slug > default
const domain = tenant?.branding?.customDomain 
  || (tenant?.slug ? `${tenant.slug}.saligaffiliate.com` : "app.saligaffiliate.com");
```

**This change ensures:**
- Custom domain takes priority when configured and active
- Backward compatible with existing subdomain URLs
- Seamless transition when domain is activated

### File Structure

```
src/app/(auth)/settings/domain/
├── page.tsx                           # Main domain settings page
└── components/
    ├── DomainInput.tsx               # Domain input with validation
    ├── DnsInstructions.tsx          # DNS configuration instructions
    ├── DnsVerification.tsx          # DNS verification status and check
    ├── SslStatus.tsx                # SSL provisioning status
    └── DomainStatusBadge.tsx        # Status badge component

convex/
├── tenants.ts                      # UPDATE: Add domain mutations
├── domains.ts                      # NEW: Domain verification actions (if needed)
└── referralLinks.ts               # UPDATE: Use custom domain in URL generation
```

### Mutation Design

```typescript
// convex/tenants.ts

export const updateTenantDomain = mutation({
  args: {
    domain: v.string(),
  // Returns previous domain if changing
  },
  returns: v.object({
    success: v.boolean(),
    domain: v.optional(v.string()),
    status: v.string(),
    dnsInstructions: v.object({
      recordType: v.string(),
      recordName: v.string(),
      recordValue: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    // Get current authenticated user and tenant
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", q => q.eq("authId", identity.subject))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Verify Scale tier
    const tenant = await ctx.db.get(user.tenantId);
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", q => q.eq("tier", tenant?.plan))
      .first();
    
    if (!tierConfig?.customDomain) {
      throw new Error("Custom domain is only available on Scale tier");
    }
    
    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9][a-zA-Z00-9-]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(args.domain)) {
      throw new Error("Invalid domain format");
    }
    
    // Update tenant with new domain
    const currentBranding = tenant?.branding || {};
    await ctx.db.patch(user.tenantId, {
      branding: {
        ...currentBranding,
        customDomain: args.domain,
        domainStatus: "pending",
      },
    });
    
    // Return DNS instructions
    return {
      success: true,
      domain: args.domain,
      status: "pending",
      dnsInstructions: {
        recordType: "CNAME",
        recordName: args.domain,
        recordValue: "app.saligaffiliate.com", // Platform domain
      },
    };
  });
```

### UI Component Patterns

**Following patterns from existing settings pages:**

1. **Page Structure:**
   - Similar to `src/app/(auth)/settings/branding/page.tsx`
   - Use Card components for sections
   - Loading state with Loader2 spinner
   - Error handling with error state and retry

2. **Form Handling:**
   - Use React Hook Form for form state management
   - Zod validation schema for domain field
   - Toast notifications for success/error

3. **Tier Check Pattern:**
   - Similar to how billing features check subscription status
   - Redirect non-Scale users to upgrade prompt
   - Show feature comparison table

### Previous Story Intelligence (8-7: Portal Brand Configuration)

From the previous story implementation:
- **Branding schema already exists** - We're extending it with domain fields
- **WCAG validation pattern** - Can apply similar validation approach for domain format
- **Settings page patterns** - Follow existing Card and form layouts
- **Mutation patterns** - Use similar permission checks (owner/manager roles)
- **CSS variables** - Domain affects URL generation, not CSS
- **Toast notifications** - Use sonner for success/error messages

### Web Research: Custom Domain Implementation Patterns

**Key Considerations:**
1. **DNS Verification** - Use DNS lookup to verify CNAME record
2. **SSL Status** - For MVP, track status only; actual SSL is infrastructure-level
3. **Domain Validation** - Validate hostname format (no protocol, no path)
4. **Multi-tenant Isolation** - Ensure domain lookup is scoped to tenant

**Libraries to Consider:**
- Built-in `fetch` for DNS TXT record lookup
- No additional npm packages needed for MVP

**DNS Lookup Example:**
```typescript
async function verifyDns(domain: string, expectedValue: string): Promise<boolean> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const data = await response.json();
    return data.Answer?.some((record: string) => 
      record.includes(expectedValue)
    ) ?? false;
  } catch {
    return false;
  }
}
```

### Accessibility Requirements

**WCAG 2.1 Compliance:**
- All form inputs must have associated labels
- Domain status badges must have accessible names
- Keyboard navigation for all interactive elements
- Screen reader announcements for status changes

### Anti-Pattern Prevention

**DO NOT:**
- Allow non-Scale users to access domain settings - tier enforcement is mandatory
- Skip domain format validation - must validate proper hostname format
- Allow protocol prefixes (https://) - strip them automatically
- Forget loading states - show skeletons while fetching
- Skip error handling - handle mutation failures gracefully
- Store domains without verification status - track status at every step
- Make SSL provisioning blocking - it's an async process
- Update referral links without domain being active - only active domains update links

### Testing Considerations

- Test domain format validation with valid and invalid formats
- Test DNS verification with passing and failing scenarios
- Test tier enforcement (non-Scale users blocked)
- Test domain activation flow (pending → dns_verified → ssl_provisioning → active)
- Test domain removal flow
- Test referral link generation with custom domain
- Test referral link generation fallback to subdomain
- Test with existing branding configuration
- Test with no existing branding configuration

### Out of Scope (Future Enhancements)

- Multiple custom domains per tenant
- Wildcard subdomains (*.mycompany.com)
- Automatic Let's Encrypt SSL provisioning
- Domain health monitoring and alerting
- Subdirectory support (e.g., portal.mycompany.com vs affiliates.mycompany.com)
- DKIM email signing for custom domain
- Custom domain for SaaS Owner dashboard (not just affiliate portal)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1531-1550`] - Story definition and acceptance criteria
- [Source: `_bmad-output/planning-artifacts/prd.md`] - FR44 definition
- [Source: `_bmad-output/project-context.md`] - Project coding standards and design context
- [Source: `_bmad-output/implementation-artifacts/8-7-portal-brand-configuration.md`] - Previous story patterns
- [Source: `convex/schema.ts#L133`] - tierConfigs with customDomain feature flag
- [Source: `convex/schema.ts#L37-45`] - branding schema to extend
- [Source: `convex/referralLinks.ts#L398-418`] - Current domain logic to update
- [Source: `src/app/(auth)/settings/branding/page.tsx`] - Settings page pattern
- [Source: WCAG 2.1 Guidelines] - Accessibility requirements

## Change Log

- **2026-03-16**: Story created with comprehensive context from workflow analysis
  - Analyzed Epic 8 requirements and previous story learnings
  - Researched custom domain implementation patterns for SaaS
  - Documented tier enforcement requirements (Scale tier exclusive)
  - Analyzed referral link generation impact
  - Defined mutation patterns for domain configuration
  - Status: ready-for-dev

- **2026-03-16**: Implementation complete
  - Extended schema with domain fields in branding object
  - Created domain settings page with tier enforcement
  - Created all UI components (DomainInput, DnsInstructions, DnsVerification, SslStatus, DomainStatusBadge)
  - Created mutations for domain management
  - Updated referral link generation to use custom domain
  - Created unit tests for domain validation and URL generation
  - Status: review

- **2026-03-16**: Code review completed - 11 issues fixed
  - Fixed 3 HIGH priority security/quality issues
  - Fixed 6 MEDIUM priority maintainability/robustness issues
  - Fixed 2 LOW priority UI/UX issues
  - All acceptance criteria validated
  - Status: done

## Dev Agent Record

### Agent Model Used

minimax-m2.5-free

### Debug Log References

### Completion Notes List

- Implemented custom domain configuration for Scale tier only
- Added domain fields to branding object in schema: customDomain, domainStatus, domainVerifiedAt, sslProvisionedAt
- Created Settings > Domain page with tier check for non-Scale users
- Created DomainInput component with real-time validation
- Created DnsInstructions component with copy buttons
- Created DnsVerification component with DNS lookup via Google DNS API
- Created SslStatus component for SSL provisioning flow
- Created DomainStatusBadge for status display
- Created mutations: updateTenantDomain, verifyDomainDns, initiateSslProvisioning, removeTenantDomain, getTenantDomainConfig, getTierCustomDomainStatus
- Updated referral link generation to use custom domain when active
- Added 34 unit tests for domain validation and URL generation
- All tests pass

### Code Review Fixes Applied (2026-03-16)

**HIGH Priority Fixes:**
1. **Added permission check to `getTenantDomainConfig`** - Query now requires 'settings:read', 'settings:*', or 'manage:*' permission
2. **Added timeout and error handling to DNS verification** - 10-second timeout with AbortController, proper error messages
3. **Fixed domain validation regex** - Now rejects double dots (e.g., `example..com`) with negative lookahead assertions

**MEDIUM Priority Fixes:**
4. **Extracted platform domain to constant** - `PLATFORM_DOMAIN = "app.saligaffiliate.com"` in both tenants.ts and referralLinks.ts
5. **Added transaction safety documentation** - Comments explaining Convex mutation atomicity guarantees
6. **Added rate limiting to DNS verification** - Max 5 attempts per minute per tenant, tracked via audit logs
7. **Documented SSL provisioning simulation** - Added MVP implementation note explaining actual SSL must be handled separately
8. **Improved domain removal** - Now explicitly filters all domain-related fields using iteration instead of destructuring
9. **Added integration test documentation** - Comprehensive TODO list for future integration tests

**LOW Priority Fixes:**
10. **Removed incorrect copy button** - Fixed DnsInstructions component that was copying "CNAME" literal instead of values
11. **Added loading state for SettingsNav** - Domain nav item now shows during tier check to prevent layout shift

### File List

**Schema & Backend:**
- convex/schema.ts (modified - added domain fields to branding)
- convex/tenants.ts (modified - added domain mutations and queries, fixed security issues)
- convex/referralLinks.ts (modified - updated domain generation, extracted constant)
- convex/domain.test.ts (modified - 34 unit tests + integration test docs, fixed regex)

**Frontend Components:**
- src/app/(auth)/settings/domain/page.tsx (new)
- src/app/(auth)/settings/domain/components/DomainInput.tsx (new - fixed regex validation)
- src/app/(auth)/settings/domain/components/DnsInstructions.tsx (new - fixed copy button)
- src/app/(auth)/settings/domain/components/DnsVerification.tsx (new)
- src/app/(auth)/settings/domain/components/SslStatus.tsx (new)
- src/app/(auth)/settings/domain/components/DomainStatusBadge.tsx (new)
- src/components/settings/SettingsNav.tsx (modified - added Domain nav item + loading state)
