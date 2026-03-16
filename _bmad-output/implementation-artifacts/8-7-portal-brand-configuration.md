# Story 8.7: Portal Brand Configuration

Status: done

## Story

As a SaaS Owner,
I want to configure the affiliate portal with my brand identity,
so that affiliates see my branding, not salig-affiliate's. (FR43)

## Acceptance Criteria

### AC1: Branding Settings Page Access
**Given** the SaaS Owner is on the Settings page
**When** they navigate to Settings > Branding
**Then** the brand configuration interface is displayed
**And** current branding settings (if any) are pre-populated

### AC2: Logo Upload
**Given** the SaaS Owner is on the Branding page
**When** they upload a logo image
**Then** the logo is validated (file type: PNG, JPG, SVG, WebP; max size: 2MB)
**And** the logo is stored securely
**And** a preview of the logo is shown in the interface
**And** the logo is immediately visible on the affiliate portal

### AC3: Brand Color Configuration
**Given** the SaaS Owner is on the Branding page
**When** they select a primary brand color using a color picker
**Then** WCAG contrast validation is performed against white (#ffffff) text
**And** a warning is displayed if contrast ratio is below 4.5:1 (AA standard)
**And** the color is saved and applied to the affiliate portal

### AC4: Portal Name Configuration
**Given** the SaaS Owner is on the Branding page
**When** they set a custom portal name
**Then** the name is saved and displayed in the portal header
**And** the name replaces generic "Affiliate Portal" text

### AC5: Live Preview
**Given** the SaaS Owner has made branding changes
**When** they view the preview section
**Then** a live preview shows how the portal will look with their branding
**And** the preview updates in real-time as they make changes

### AC6: Save Changes
**Given** the SaaS Owner has configured branding settings
**When** they click "Save Changes"
**Then** all branding fields are validated
**And** the branding is saved to the database
**And** a success message is displayed
**And** the affiliate portal immediately reflects the new branding

### AC7: Reset to Defaults
**Given** the SaaS Owner wants to revert branding changes
**When** they click "Reset to Defaults"
**Then** a confirmation dialog is displayed
**And** upon confirmation, all branding fields are cleared
**And** the portal uses default salig-affiliate branding (or no branding)

## Tasks / Subtasks

- [x] Task 1: Create branding configuration page (AC: #1)
  - [x] 1.1 Create `src/app/(auth)/settings/branding/page.tsx`
  - [x] 1.2 Add navigation item in settings sidebar for "Branding"
  - [x] 1.3 Load current tenant branding using existing tenant query
  - [x] 1.4 Implement loading state while fetching branding data

- [x] Task 2: Create logo upload component (AC: #2)
  - [x] 2.1 Create `src/app/(auth)/settings/branding/components/LogoUpload.tsx`
  - [x] 2.2 Add file input with drag-and-drop support
  - [x] 2.3 Implement file validation (type, size)
  - [x] 2.4 Create preview component showing uploaded logo
  - [x] 2.5 Integrate with Convex file storage or external URL storage
  - [x] 2.6 Handle upload progress and errors

- [x] Task 3: Create color picker component (AC: #3)
  - [x] 3.1 Create `src/app/(auth)/settings/branding/components/ColorPicker.tsx`
  - [x] 3.2 Use shadcn/ui input or custom color picker
  - [x] 3.3 Implement WCAG contrast validation utility
  - [x] 3.4 Display contrast ratio and AA/AAA compliance badge
  - [x] 3.5 Show warning if contrast ratio < 4.5:1
  - [x] 3.6 Provide suggested accessible colors if current color fails

- [x] Task 4: Create portal name input component (AC: #4)
  - [x] 4.1 Create `src/app/(auth)/settings/branding/components/PortalNameInput.tsx`
  - [x] 4.2 Add text input with character limit (e.g., 50 characters)
  - [x] 4.3 Show character count
  - [x] 4.4 Validate for empty or invalid characters

- [x] Task 5: Create live preview component (AC: #5)
  - [x] 5.1 Create `src/app/(auth)/settings/branding/components/BrandingPreview.tsx`
  - [x] 5.2 Show mockup of affiliate portal header with branding
  - [x] 5.3 Update preview in real-time as user makes changes
  - [x] 5.4 Show sample buttons/elements with tenant's brand color

- [x] Task 6: Create branding mutation (AC: #6)
  - [x] 6.1 Create `updateTenantBranding` mutation in `convex/tenants.ts`
  - [x] 6.2 Validate all branding fields (logoUrl, primaryColor, portalName)
  - [x] 6.3 Validate color format (#hex)
  - [x] 6.4 Update tenant branding object
  - [x] 6.5 Return success/error response

- [x] Task 7: Implement save functionality (AC: #6)
  - [x] 7.1 Create form submission handler in branding page
  - [x] 7.2 Call `updateTenantBranding` mutation with form data
  - [x] 7.3 Handle loading state during save
  - [x] 7.4 Display success toast on completion
  - [x] 7.5 Handle and display validation errors

- [x] Task 8: Implement reset to defaults (AC: #7)
  - [x] 8.1 Add "Reset to Defaults" button
  - [x] 8.2 Create confirmation dialog using AlertDialog component
  - [x] 8.3 Call mutation with null/empty branding values
  - [x] 8.4 Update form state and preview
  - [x] 8.5 Display success message

- [x] Task 9: Update affiliate portal components (AC: #2, #3, #4)
  - [x] 9.1 Verify PortalHeader uses tenant branding logo and name
  - [x] 9.2 Verify CSS variables are applied from tenant branding
  - [x] 9.3 Test that changes propagate immediately to portal

## Review Follow-ups (AI) - FIXED

All code review issues have been addressed:

- [x] **[CRITICAL][AI-Review] AC2 Compliance - Implement actual file upload** [convex/branding.ts:1, src/app/(auth)/settings/branding/components/LogoUpload.tsx:1]
  - Implemented drag-and-drop file upload with proper validation
  - Added file type checking (PNG, JPG, SVG, WebP)
  - Added 2MB size limit enforcement
  - Created upload progress indicator

- [x] **[HIGH][AI-Review] Missing Test Coverage** [convex/branding.test.ts:1]
  - Created comprehensive test suite with 28 test cases
  - Tests cover logo validation, WCAG contrast, portal name, permissions

- [x] **[MEDIUM][AI-Review] Accessibility Violation in ColorPicker** [src/app/(auth)/settings/branding/components/ColorPicker.tsx:191]
  - Added type="button" attribute
  - Added aria-label for screen readers
  - Added focus ring styles for keyboard navigation

- [x] **[MEDIUM][AI-Review] Incomplete File Validation** [src/app/(auth)/settings/branding/components/LogoUpload.tsx:32]
  - Added file type validation against allowed types
  - Added file extension validation
  - Added proper error messages

- [x] **[MEDIUM][AI-Review] Unused State Variables** [src/app/(auth)/settings/branding/components/LogoUpload.tsx:24-25]
  - Implemented drag-and-drop using isDragging state
  - Implemented upload progress using isUploading state

- [x] **[MEDIUM][AI-Review] Missing Error Handling for Image Load** [src/app/(auth)/settings/branding/components/LogoUpload.tsx:73]
  - Added handleImageError function with toast notification
  - Clears invalid URL from state on error

- [x] **[LOW][AI-Review] Incomplete JSDoc Comments** [convex/tenants.ts:305, convex/tenants.ts:406]
  - Updated JSDoc to include 'settings:*' permission

- [x] **[LOW][AI-Review] Unused Imports** [src/app/(auth)/settings/branding/components/LogoUpload.tsx:4, src/app/(auth)/settings/branding/components/PortalNameInput.tsx:6]
  - Removed unused Upload import (now used)
  - Removed unused Textarea import

## Dev Notes

### CRITICAL: White-Label Architecture

**This is a WHITE-LABEL feature. The affiliate portal MUST reflect the SaaS Owner's brand, NOT salig-affiliate's.**

**Current State:**
- Tenant branding schema already exists with fields: `logoUrl`, `primaryColor`, `portalName`, `assetGuidelines`
- Affiliate portal components already reference tenant branding (PortalHeader, sidebar, etc.)
- CSS variables are already used for theming

**This Story Completes:**
- SaaS Owner interface to CONFIGURE their branding
- Logo upload/storage mechanism
- WCAG-compliant color selection
- Real-time preview of branding changes

### Database Schema (ALREADY EXISTS)

```typescript
// convex/schema.ts - Already defined
tenants: defineTable({
  // ... other fields
  branding: v.optional(v.object({
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    portalName: v.optional(v.string()),
    assetGuidelines: v.optional(v.string()),
  })),
})
```

**NO SCHEMA CHANGES NEEDED** - We're building the UI to populate existing fields.

### WCAG Contrast Validation Algorithm

**Contrast Ratio Formula:**
```typescript
// Based on WCAG 2.1 specification
function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG Requirements:
// - AA Normal Text: >= 4.5:1
// - AA Large Text: >= 3:1
// - AAA Normal Text: >= 7:1
// - AAA Large Text: >= 4.5:1
```

**For Brand Colors:**
- We validate against WHITE text (#ffffff) since brand color is typically used as background
- Minimum acceptable ratio: 4.5:1 (AA for normal text)
- Warning displayed if below 4.5:1
- Badge showing AA/AAA compliance if passing

### CSS Variable Theming System

**Current Implementation Pattern:**
The affiliate portal uses CSS custom properties for theming. Brand colors are applied via:

```typescript
// In portal components (ALREADY IMPLEMENTED)
const primaryColor = tenant.branding?.primaryColor || "#10409a"; // Default brand

// Applied inline or via CSS variables
style={{ "--brand": primaryColor }}
```

**CSS Variables Used:**
```css
:root {
  --brand: #10409a;           /* Tenant's primary color */
  --brand-light: #eff6ff;     /* Light variant (computed or hardcoded) */
  --brand-dark: #0c2e6e;      /* Dark variant (computed or hardcoded) */
  --text-heading: #1a1a2e;
  --text-body: #474747;
  --text-muted: #6b7280;
  --bg-page: #f8fafc;
  --bg-surface: #ffffff;
  --border: #e5e7eb;
}
```

**This Story Adds:**
- Interface to SET `primaryColor` value
- Validation to ensure accessibility
- Automatic computation of light/dark variants (optional enhancement)

### Logo Storage Strategy

**Option 1: Convex File Storage (RECOMMENDED for MVP)**
```typescript
// Upload logo to Convex storage
const storageId = await ctx.storage.store(fileBlob);
const logoUrl = await ctx.storage.getUrl(storageId);

// Store in tenant branding
await ctx.db.patch(tenantId, {
  branding: {
    ...existingBranding,
    logoUrl, // Store the Convex storage URL
  }
});
```

**Option 2: External URL (SIMPLER for MVP)**
```typescript
// SaaS Owner provides external URL (e.g., Cloudinary, S3, or their CDN)
// Just store the URL directly
await ctx.db.patch(tenantId, {
  branding: {
    ...existingBranding,
    logoUrl: "https://example.com/logo.png",
  }
});
```

**Recommendation:** Use **Option 2 (External URL)** for initial MVP. Add Convex file upload as enhancement post-launch. This reduces complexity while still achieving the core goal.

### File Structure

```
src/app/(auth)/settings/branding/
├── page.tsx                              # Main branding settings page
└── components/
    ├── LogoUpload.tsx                    # Logo upload component
    ├── ColorPicker.tsx                   # Color picker with WCAG validation
    ├── PortalNameInput.tsx               # Portal name input
    ├── BrandingPreview.tsx               # Live preview of branding
    └── ContrastValidator.tsx             # WCAG contrast validation display

convex/
├── tenants.ts                            # UPDATE: Add updateTenantBranding mutation
└── schema.ts                             # NO CHANGES - schema already exists

src/components/ui/
└── (potentially add color-picker component if needed)
```

### Mutation Design

```typescript
// convex/tenants.ts

export const updateTenantBranding = mutation({
  args: {
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    portalName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    branding: v.optional(v.object({
      logoUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      portalName: v.optional(v.string()),
    })),
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
    
    if (!user || (user.role !== "owner" && user.role !== "manager")) {
      throw new Error("Not authorized to update branding");
    }
    
    // Validate color format if provided
    if (args.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(args.primaryColor)) {
      throw new Error("Invalid color format. Use #RRGGBB");
    }
    
    // Validate portal name length if provided
    if (args.portalName && args.portalName.length > 50) {
      throw new Error("Portal name must be 50 characters or less");
    }
    
    // Update tenant branding
    const currentTenant = await ctx.db.get(user.tenantId);
    const updatedBranding = {
      ...currentTenant?.branding,
      logoUrl: args.logoUrl ?? currentTenant?.branding?.logoUrl,
      primaryColor: args.primaryColor ?? currentTenant?.branding?.primaryColor,
      portalName: args.portalName ?? currentTenant?.branding?.portalName,
    };
    
    await ctx.db.patch(user.tenantId, {
      branding: updatedBranding,
    });
    
    return {
      success: true,
      branding: updatedBranding,
    };
  },
});
```

### UI Component Patterns

**Following patterns from existing settings pages:**

1. **Page Structure:**
   - Similar to `src/app/(auth)/settings/page.tsx`
   - Use Card components for sections
   - Loading state with Loader2 spinner
   - Error handling with error state and retry

2. **Form Handling:**
   - Use React Hook Form for form state management
   - Zod validation schema for branding fields
   - Toast notifications for success/error

3. **Color Picker:**
   - Use shadcn/ui Input with type="color" OR
   - Use external library like `react-color` (if installed)
   - Display hex value alongside picker
   - Show contrast ratio badge in real-time

### Previous Story Intelligence (8-6: Brand Asset Library)

From the previous story implementation:
- **Session management pattern:** Fetch from session/context
- **Tenant context:** Use `getTenantContext` or similar query
- **Loading states:** Use Loader2 spinner component
- **Error handling:** Display error banner with retry button
- **Toast notifications:** Use sonner for success/error messages
- **CSS variables:** Applied via style prop on root element
- **White-label requirement:** No salig-affiliate branding visible

### Accessibility Requirements

**WCAG 2.1 Compliance:**
- All form inputs must have associated labels
- Color picker must show contrast ratio
- Warning displayed if color fails AA standard (4.5:1)
- Keyboard navigation for all interactive elements
- Screen reader announcements for validation errors

### Anti-Pattern Prevention

**DO NOT:**
- Hardcode branding values - all must come from database
- Skip WCAG validation - contrast checking is MANDATORY
- Allow invalid color formats - validate hex format server-side
- Forget loading states - show skeletons while fetching
- Skip error handling - handle mutation failures gracefully
- Show salig-affiliate branding on the SaaS Owner's portal
- Store logos without validation - check file type and size

### Testing Considerations

- Test logo upload with various file types and sizes
- Test color picker with valid and invalid hex colors
- Test WCAG contrast validation with passing and failing colors
- Test portal name character limit
- Test save functionality with all fields
- Test save with partial fields (some empty)
- Test reset to defaults functionality
- Test that changes immediately propagate to affiliate portal
- Test with no existing branding (defaults)
- Test with existing branding (pre-populated values)

### Out of Scope (Future Enhancements)

- Advanced logo manipulation (crop, resize, filters)
- Automatic generation of light/dark color variants
- Font selection (beyond default Poppins)
- Custom CSS injection
- Branding templates/presets
- Branding history/versioning
- A/B testing different brand configurations

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1510-1528`] - Story definition and acceptance criteria
- [Source: `_bmad-output/planning-artifacts/prd.md#L743`] - FR43 definition
- [Source: `_bmad-output/project-context.md`] - Project coding standards and design context
- [Source: `_bmad-output/implementation-artifacts/8-6-brand-asset-library.md`] - Previous story patterns
- [Source: `convex/schema.ts`] - Database schema (branding already defined)
- [Source: `convex/tenants.ts`] - Existing tenant queries/mutations
- [Source: `src/app/(auth)/settings/page.tsx`] - Settings page pattern
- [Source: `src/components/affiliate/PortalHeader.tsx`] - Portal branding usage
- [Source: WCAG 2.1 Guidelines] - Contrast ratio requirements

## Change Log

- **2026-03-16**: Story created with comprehensive context from workflow analysis
  - Analyzed Epic 8 requirements and previous story learnings
  - Researched WCAG contrast validation algorithms
  - Researched white-label theming best practices with CSS variables
  - Documented existing branding schema (no changes needed)
  - Defined mutation pattern for updating tenant branding
  - Status: ready-for-dev

- **2026-03-16**: Story implementation completed
  - Implemented branding settings page with all components
  - Added WCAG-compliant color picker with contrast validation
  - Created live preview showing portal appearance
  - Implemented save and reset functionality
  - Added mutations for branding update and reset
  - Status: review

- **2026-03-16**: Code Review Completed - Fixes Applied
  - Fixed AC2 non-compliance: Implemented proper file upload with drag-and-drop
  - Added comprehensive test coverage (28 test cases)
  - Fixed accessibility violations in ColorPicker
  - Added proper error handling for image loading failures
  - Created branding.ts module for file upload action
  - Fixed JSDoc comments to match actual permission checks
  - Status: review

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **2026-03-16**: Story implementation completed
  - Created branding settings page at `src/app/(auth)/settings/branding/page.tsx`
  - Created LogoUpload component with URL-based logo input (MVP approach - external URL storage)
  - Created ColorPicker component with WCAG 2.1 contrast validation (AA/AAA badges, warning for low contrast, color suggestions)
  - Created PortalNameInput component with 50-character limit and character count
  - Created BrandingPreview component with live preview of portal header, stats cards, and sample buttons
  - Created `updateTenantBranding` mutation in `convex/tenants.ts` with proper validation (color format, URL, length)
  - Created `resetTenantBranding` mutation to reset branding to defaults
  - Created `getCurrentUserTenantBranding` query for fetching branding without passing tenantId
  - Updated SettingsNav to include Branding link
  - Implemented save functionality with loading states and toast notifications
  - Implemented reset to defaults with confirmation dialog
  - Verified existing PortalHeader already uses branding props correctly
  - Status: review

- **2026-03-16**: Code Review Fixes Applied (Post-Review)
  - **[CRITICAL] AC2 Compliance**: Implemented actual file upload with drag-and-drop support, file type validation (PNG, JPG, SVG, WebP), and 2MB size limit
  - **[HIGH] Test Coverage**: Created comprehensive test suite in `convex/branding.test.ts` covering logo validation, WCAG contrast, portal name, and permissions
  - **[MEDIUM] LogoUpload Enhancements**: Added drag-and-drop functionality, proper file validation, upload progress indicator, and user-friendly error messages
  - **[MEDIUM] Accessibility Fix**: Added proper button attributes (type="button", aria-label) and focus styles to ColorPicker suggestion button
  - **[MEDIUM] Image Error Handling**: Added toast notification and state clearing when logo image fails to load
  - **[MEDIUM] Code Cleanup**: Removed unused imports from PortalNameInput and fixed JSDoc comments in tenants.ts
  - **[MEDIUM] File Upload Action**: Created `convex/branding.ts` with `uploadTenantLogo` action for handling file uploads with permission checks
  - **[LOW] Internal Helpers**: Added `_getUserByAuthIdInternal` query in users.ts and `_checkPermissionInternal` query in permissions.ts for action support
  - Status: review

### File List

- `src/app/(auth)/settings/branding/page.tsx` - Main branding settings page
- `src/app/(auth)/settings/branding/components/LogoUpload.tsx` - Logo upload component with drag-and-drop
- `src/app/(auth)/settings/branding/components/ColorPicker.tsx` - Color picker with WCAG validation
- `src/app/(auth)/settings/branding/components/PortalNameInput.tsx` - Portal name input
- `src/app/(auth)/settings/branding/components/BrandingPreview.tsx` - Live preview component
- `convex/tenants.ts` - Added `updateTenantBranding`, `resetTenantBranding`, `getCurrentUserTenantBranding`, `_updateTenantLogoInternal`, `_logAuditEventInternal`
- `convex/branding.ts` - Added `uploadTenantLogo` action for file uploads
- `convex/branding.test.ts` - Comprehensive test suite for branding features
- `convex/users.ts` - Added `_getUserByAuthIdInternal` query
- `convex/permissions.ts` - Added `_checkPermissionInternal` query
- `src/components/settings/SettingsNav.tsx` - Added Branding navigation item
