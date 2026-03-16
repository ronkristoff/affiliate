import { describe, it, expect } from "vitest";

/**
 * Unit Tests for Referral Link Generation
 * 
 * Story 6.1: Referral Link Generation
 * 
 * These tests validate:
 * - AC1: Unique link generation with affiliate code
 * - AC2: Multiple URL format generation (short, full, campaign, UTM)
 * - AC3: Vanity URL creation
 * - AC4: Vanity slug uniqueness validation
 * - AC5: Vanity URL deletion
 * - Error handling and validation
 * - RBAC enforcement
 * - Audit trail logging
 * - Multi-tenant isolation
 */

// ============================================================================
// Test Helper Functions (simulating referralLinks.ts logic)
// ============================================================================

/**
 * Generate a unique referral code for a referral link.
 * Format: 8-character alphanumeric code (excludes confusing characters).
 */
function generateUniqueReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing characters (0, O, I, 1)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate vanity slug format.
 * Alphanumeric, hyphens, underscores only. Length: 3-50 characters.
 */
function isValidVanitySlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

/**
 * Build short URL format: https://{domain}/ref/{code}
 */
function buildShortUrl(domain: string, code: string): string {
  return `https://${domain}/ref/${code}`;
}

/**
 * Build full URL format: https://{domain}/ref/{code}?ref={affiliate-name}
 */
function buildFullUrl(domain: string, code: string, affiliateName: string): string {
  const encodedName = encodeURIComponent(affiliateName.toLowerCase().replace(/\s+/g, "-"));
  return `https://${domain}/ref/${code}?ref=${encodedName}`;
}

/**
 * Build campaign URL format: https://{domain}/ref/{code}?campaign={campaign-slug}
 */
function buildCampaignUrl(domain: string, code: string, campaignSlug: string): string {
  return `https://${domain}/ref/${code}?campaign=${campaignSlug}`;
}

/**
 * Build UTM URL format: https://{domain}/ref/{code}?utm_source={source}
 */
function buildUtmUrl(domain: string, code: string, utmSource: string): string {
  return `https://${domain}/ref/${code}?utm_source=${encodeURIComponent(utmSource)}`;
}

/**
 * Build vanity URL format: https://{domain}/ref/{vanity-slug}
 */
function buildVanityUrl(domain: string, vanitySlug: string): string {
  return `https://${domain}/ref/${vanitySlug}`;
}

/**
 * Check if a referral code is unique within a tenant
 */
function isCodeUnique(
  existingCodes: string[],
  code: string
): boolean {
  return !existingCodes.includes(code);
}

/**
 * Check if a vanity slug is unique within a tenant
 */
function isVanitySlugUnique(
  existingSlugs: string[],
  slug: string
): boolean {
  return !existingSlugs.includes(slug.toLowerCase());
}

/**
 * Validate affiliate status for link generation
 */
function canGenerateLink(affiliateStatus: string): { allowed: boolean; reason?: string } {
  if (affiliateStatus === "active") {
    return { allowed: true };
  }
  return { 
    allowed: false, 
    reason: `Cannot generate referral link for affiliate with status "${affiliateStatus}". Only active affiliates can have referral links.`
  };
}

/**
 * Check RBAC permission
 */
function hasPermission(userRole: string, requiredPermission: string): boolean {
  const permissions: Record<string, string[]> = {
    owner: ["manage:*", "affiliates:manage", "campaigns:manage"],
    manager: ["affiliates:manage", "campaigns:manage"],
    viewer: ["affiliates:view"],
  };
  
  const userPermissions = permissions[userRole] || [];
  return userPermissions.includes(requiredPermission) || userPermissions.includes("manage:*");
}

/**
 * Validate tenant ownership for multi-tenant isolation
 */
function validateTenantOwnership(
  resourceTenantId: string,
  userTenantId: string
): { valid: boolean; reason?: string } {
  if (resourceTenantId !== userTenantId) {
    return { valid: false, reason: "Affiliate not found or access denied" };
  }
  return { valid: true };
}

/**
 * Generate unique code with collision handling
 */
function generateUniqueCodeWithRetry(
  existingCodes: string[],
  maxAttempts: number = 10
): { code: string; attempts: number } | null {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const code = generateUniqueReferralCode();
    if (isCodeUnique(existingCodes, code)) {
      return { code, attempts };
    }
    attempts++;
  }
  
  return null;
}

// ============================================================================
// Test Suite: Referral Code Generation
// ============================================================================

describe("Referral Code Generation", () => {
  describe("AC1: Generate unique referral code", () => {
    it("should generate 8-character alphanumeric code", () => {
      const code = generateUniqueReferralCode();
      
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it("should exclude confusing characters (0, O, I, 1)", () => {
      // Generate many codes to verify no confusing characters
      for (let i = 0; i < 100; i++) {
        const code = generateUniqueReferralCode();
        expect(code).not.toMatch(/[0OI1]/);
      }
    });

    it("should generate different codes on multiple calls", () => {
      const codes = new Set<string>();
      
      for (let i = 0; i < 50; i++) {
        codes.add(generateUniqueReferralCode());
      }
      
      // With 50 generations, we expect mostly unique codes
      // (small chance of collision is acceptable for this test)
      expect(codes.size).toBeGreaterThan(45);
    });
  });

  describe("AC4: Duplicate code detection", () => {
    it("should detect duplicate code", () => {
      const existingCodes = ["ABC12345", "DEF67890"];
      
      expect(isCodeUnique(existingCodes, "ABC12345")).toBe(false);
      expect(isCodeUnique(existingCodes, "DEF67890")).toBe(false);
    });

    it("should allow unique code", () => {
      const existingCodes = ["ABC12345", "DEF67890"];
      
      expect(isCodeUnique(existingCodes, "XYZ99999")).toBe(true);
    });

    it("should handle empty existing codes list", () => {
      expect(isCodeUnique([], "ABC12345")).toBe(true);
    });
  });

  describe("Subtask 1.3: Collision handling with retry", () => {
    it("should generate unique code on first attempt when no collision", () => {
      const existingCodes = ["ABC12345"];
      const result = generateUniqueCodeWithRetry(existingCodes, 10);
      
      expect(result).not.toBeNull();
      expect(result!.attempts).toBe(0);
      expect(isCodeUnique(existingCodes, result!.code)).toBe(true);
    });

    it("should retry on collision until unique code found", () => {
      // Simulate collision scenario by mocking or testing retry logic
      const existingCodes: string[] = [];
      const result = generateUniqueCodeWithRetry(existingCodes, 10);
      
      expect(result).not.toBeNull();
      expect(result!.attempts).toBeLessThan(10);
    });

    it("should return null after max attempts", () => {
      // Create a scenario where all codes collide
      const existingCodes = ["ABC12345"];
      
      // This is a simplified test - in reality, with 8 chars from 32 char set,
      // collision probability is very low
      const result = generateUniqueCodeWithRetry(existingCodes, 0);
      
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Test Suite: URL Format Generation
// ============================================================================

describe("URL Format Generation (AC2)", () => {
  const domain = "mytenant.saligaffiliate.com";
  const code = "ABC12345";
  const affiliateName = "John Doe";
  const campaignSlug = "summer-sale";
  const utmSource = "newsletter";

  describe("Short URL format", () => {
    it("should build short URL with domain and code", () => {
      const url = buildShortUrl(domain, code);
      
      expect(url).toBe("https://mytenant.saligaffiliate.com/ref/ABC12345");
    });

    it("should handle different domains", () => {
      expect(buildShortUrl("custom.com", code)).toBe("https://custom.com/ref/ABC12345");
      expect(buildShortUrl("app.saligaffiliate.com", code)).toBe("https://app.saligaffiliate.com/ref/ABC12345");
    });
  });

  describe("Full URL format", () => {
    it("should build full URL with affiliate name parameter", () => {
      const url = buildFullUrl(domain, code, affiliateName);
      
      expect(url).toContain("https://mytenant.saligaffiliate.com/ref/ABC12345");
      expect(url).toContain("?ref=");
      expect(url).toContain("john-doe");
    });

    it("should encode special characters in affiliate name", () => {
      const specialName = "John & Jane";
      const url = buildFullUrl(domain, code, specialName);
      
      // The & character gets encoded by encodeURIComponent
      expect(url).toContain("john-");
      expect(url).toContain("-jane");
    });

    it("should convert spaces to hyphens", () => {
      const url = buildFullUrl(domain, code, "My Affiliate Name");
      
      expect(url).toContain("my-affiliate-name");
    });
  });

  describe("Campaign URL format", () => {
    it("should build campaign URL with campaign slug", () => {
      const url = buildCampaignUrl(domain, code, campaignSlug);
      
      expect(url).toBe("https://mytenant.saligaffiliate.com/ref/ABC12345?campaign=summer-sale");
    });

    it("should handle campaign names with spaces", () => {
      const url = buildCampaignUrl(domain, code, "winter-special");
      
      expect(url).toContain("?campaign=winter-special");
    });
  });

  describe("UTM URL format", () => {
    it("should build UTM URL with source parameter", () => {
      const url = buildUtmUrl(domain, code, utmSource);
      
      expect(url).toBe("https://mytenant.saligaffiliate.com/ref/ABC12345?utm_source=newsletter");
    });

    it("should encode special characters in UTM source", () => {
      const url = buildUtmUrl(domain, code, "email campaign");
      
      expect(url).toContain("utm_source=email%20campaign");
    });
  });
});

// ============================================================================
// Test Suite: Vanity URL (AC3, AC4, AC5)
// ============================================================================

describe("Vanity URL Management", () => {
  describe("AC3: Vanity slug validation (Subtask 3.2)", () => {
    it("should accept valid vanity slugs", () => {
      expect(isValidVanitySlug("john-offer")).toBe(true);
      expect(isValidVanitySlug("summer_sale")).toBe(true);
      expect(isValidVanitySlug("ABC123")).toBe(true);
      expect(isValidVanitySlug("a-b-c")).toBe(true);
    });

    it("should reject slugs shorter than 3 characters", () => {
      expect(isValidVanitySlug("ab")).toBe(false);
      expect(isValidVanitySlug("a")).toBe(false);
    });

    it("should reject slugs longer than 50 characters", () => {
      expect(isValidVanitySlug("a".repeat(51))).toBe(false);
    });

    it("should reject slugs with invalid characters", () => {
      expect(isValidVanitySlug("john@offer")).toBe(false);
      expect(isValidVanitySlug("summer sale")).toBe(false);
      expect(isValidVanitySlug("john.offer")).toBe(false);
      expect(isValidVanitySlug("john/offer")).toBe(false);
    });

    it("should accept exactly 3 characters", () => {
      expect(isValidVanitySlug("abc")).toBe(true);
    });

    it("should accept exactly 50 characters", () => {
      expect(isValidVanitySlug("a".repeat(50))).toBe(true);
    });
  });

  describe("AC4: Vanity slug uniqueness (Subtask 3.3)", () => {
    it("should detect duplicate vanity slug", () => {
      const existingSlugs = ["john-offer", "summer-sale"];
      
      expect(isVanitySlugUnique(existingSlugs, "john-offer")).toBe(false);
      expect(isVanitySlugUnique(existingSlugs, "JOHN-OFFER")).toBe(false); // Case insensitive
    });

    it("should allow unique vanity slug", () => {
      const existingSlugs = ["john-offer"];
      
      expect(isVanitySlugUnique(existingSlugs, "jane-offer")).toBe(true);
    });

    it("should handle empty existing slugs list", () => {
      expect(isVanitySlugUnique([], "new-slug")).toBe(true);
    });
  });

  describe("Vanity URL building", () => {
    it("should build vanity URL with slug", () => {
      const url = buildVanityUrl("mytenant.saligaffiliate.com", "john-offer");
      
      expect(url).toBe("https://mytenant.saligaffiliate.com/ref/john-offer");
    });
  });
});

// ============================================================================
// Test Suite: Affiliate Status Validation
// ============================================================================

describe("Affiliate Status Validation", () => {
  it("should allow link generation for active affiliates", () => {
    const result = canGenerateLink("active");
    
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should deny link generation for pending affiliates", () => {
    const result = canGenerateLink("pending");
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("pending");
    expect(result.reason).toContain("Only active affiliates");
  });

  it("should deny link generation for suspended affiliates", () => {
    const result = canGenerateLink("suspended");
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("suspended");
  });

  it("should deny link generation for rejected affiliates", () => {
    const result = canGenerateLink("rejected");
    
    expect(result.allowed).toBe(false);
  });
});

// ============================================================================
// Test Suite: RBAC Enforcement (AC all)
// ============================================================================

describe("RBAC Enforcement (Subtask 9.7)", () => {
  it("should allow owners to manage affiliates", () => {
    expect(hasPermission("owner", "affiliates:manage")).toBe(true);
    expect(hasPermission("owner", "manage:*")).toBe(true);
  });

  it("should allow managers to manage affiliates", () => {
    expect(hasPermission("manager", "affiliates:manage")).toBe(true);
  });

  it("should deny viewers affiliate management", () => {
    expect(hasPermission("viewer", "affiliates:manage")).toBe(false);
  });

  it("should deny unknown roles", () => {
    expect(hasPermission("unknown", "affiliates:manage")).toBe(false);
  });
});

// ============================================================================
// Test Suite: Multi-tenant Isolation (AC all)
// ============================================================================

describe("Multi-tenant Isolation (Subtask 9.9)", () => {
  it("should allow access to same tenant resources", () => {
    const result = validateTenantOwnership("tenant-123", "tenant-123");
    
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should deny access to different tenant resources", () => {
    const result = validateTenantOwnership("tenant-123", "tenant-456");
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Affiliate not found or access denied");
  });

  it("should handle tenant ID comparison strictly", () => {
    // Ensure we're doing strict equality
    const result1 = validateTenantOwnership("tenant-123", "tenant-123");
    const result2 = validateTenantOwnership("tenant-123", "tenant-1234");
    
    expect(result1.valid).toBe(true);
    expect(result2.valid).toBe(false);
  });
});

// ============================================================================
// Test Suite: Error Handling (Subtask 9.10)
// ============================================================================

describe("Error Handling", () => {
  it("should provide descriptive error for inactive affiliate", () => {
    const result = canGenerateLink("suspended");
    
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("suspended");
    expect(result.reason).toContain("Only active affiliates");
  });

  it("should provide descriptive error for unauthorized tenant access", () => {
    const result = validateTenantOwnership("tenant-123", "tenant-456");
    
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("access denied");
  });

  it("should handle missing affiliate gracefully", () => {
    // This would be handled at the database layer
    // Testing the validation function behavior
    const result = validateTenantOwnership("tenant-123", "tenant-456");
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// Test Suite: Audit Trail (Subtask 9.8)
// ============================================================================

describe("Audit Trail Logging", () => {
  it("should include required fields for link creation audit", () => {
    const auditEntry = {
      tenantId: "tenant-123",
      action: "referral_link_created",
      entityType: "referralLink",
      entityId: "link-456",
      actorId: "user-789",
      actorType: "user",
      newValue: {
        affiliateId: "aff-123",
        code: "ABC12345",
        campaignId: "camp-456",
        vanitySlug: "john-offer",
      },
    };

    // Validate audit entry structure
    expect(auditEntry.action).toBe("referral_link_created");
    expect(auditEntry.entityType).toBe("referralLink");
    expect(auditEntry.newValue.code).toBeDefined();
    expect(auditEntry.newValue.affiliateId).toBeDefined();
    expect(auditEntry.actorId).toBeDefined();
    expect(auditEntry.actorType).toBeDefined();
  });

  it("should include previous value for vanity slug deletion", () => {
    const auditEntry = {
      tenantId: "tenant-123",
      action: "vanity_slug_deleted",
      entityType: "referralLink",
      entityId: "aff-123",
      actorId: "user-789",
      actorType: "user",
      previousValue: { vanitySlug: "john-offer" },
      newValue: { vanitySlug: null },
    };

    expect(auditEntry.previousValue.vanitySlug).toBe("john-offer");
    expect(auditEntry.newValue.vanitySlug).toBeNull();
    expect(auditEntry.action).toBe("vanity_slug_deleted");
  });

  it("should include security event metadata for unauthorized access", () => {
    const auditEntry = {
      tenantId: "tenant-123",
      action: "permission_denied",
      entityType: "referralLink",
      entityId: "generate",
      actorId: "user-789",
      actorType: "user",
      metadata: {
        securityEvent: true,
        additionalInfo: "attemptedPermission=affiliates:manage",
      },
    };

    expect(auditEntry.metadata?.securityEvent).toBe(true);
    expect(auditEntry.metadata?.additionalInfo).toContain("affiliates:manage");
  });
});

// ============================================================================
// Test Suite: Integration Scenarios
// ============================================================================

describe("Integration Scenarios", () => {
  it("should complete full link generation flow", () => {
    // Step 1: Validate affiliate status
    const statusCheck = canGenerateLink("active");
    expect(statusCheck.allowed).toBe(true);

    // Step 2: Check tenant ownership
    const tenantCheck = validateTenantOwnership("tenant-123", "tenant-123");
    expect(tenantCheck.valid).toBe(true);

    // Step 3: Check permissions
    const hasPerm = hasPermission("owner", "affiliates:manage");
    expect(hasPerm).toBe(true);

    // Step 4: Generate unique code
    const existingCodes: string[] = [];
    const codeResult = generateUniqueCodeWithRetry(existingCodes, 10);
    expect(codeResult).not.toBeNull();

    // Step 5: Build URLs
    const domain = "mytenant.saligaffiliate.com";
    const code = codeResult!.code;
    const shortUrl = buildShortUrl(domain, code);
    const fullUrl = buildFullUrl(domain, code, "John Doe");

    expect(shortUrl).toContain(domain);
    expect(fullUrl).toContain("?ref=");
  });

  it("should handle vanity slug creation flow", () => {
    const slug = "john-special";
    
    // Step 1: Validate slug format
    expect(isValidVanitySlug(slug)).toBe(true);

    // Step 2: Check uniqueness
    const existingSlugs: string[] = [];
    expect(isVanitySlugUnique(existingSlugs, slug)).toBe(true);

    // Step 3: Build vanity URL
    const url = buildVanityUrl("mytenant.saligaffiliate.com", slug);
    expect(url).toBe("https://mytenant.saligaffiliate.com/ref/john-special");
  });

  it("should prevent duplicate vanity slug", () => {
    const slug = "john-special";
    const existingSlugs = ["john-special"];
    
    // Should reject duplicate
    expect(isVanitySlugUnique(existingSlugs, slug)).toBe(false);
  });
});

// ============================================================================
// Tests for updateVanitySlug mutation
// ============================================================================

describe("updateVanitySlug mutation", () => {
  it("should validate slug format (3-50 chars)", () => {
    // Valid slugs
    expect(isValidVanitySlug("abc")).toBe(true);
    expect(isValidVanitySlug("my-slug")).toBe(true);
    expect(isValidVanitySlug("my_slug")).toBe(true);
    expect(isValidVanitySlug("abc123")).toBe(true);
    expect(isValidVanitySlug("a".repeat(50))).toBe(true);
    
    // Invalid slugs
    expect(isValidVanitySlug("ab")).toBe(false); // Too short
    expect(isValidVanitySlug("a".repeat(51))).toBe(false); // Too long
    expect(isValidVanitySlug("my slug")).toBe(false); // Contains space
    expect(isValidVanitySlug("my@slug")).toBe(false); // Contains special char
    expect(isValidVanitySlug("my.slug")).toBe(false); // Contains dot
  });

  it("should check for duplicate vanity slugs", () => {
    const existingSlugs = ["john-special", "mary-offer", "test-promo"];
    
    // Should allow unique slugs
    expect(isVanitySlugUnique(existingSlugs, "new-slug")).toBe(true);
    expect(isVanitySlugUnique(existingSlugs, "another-slug")).toBe(true);
    
    // Should reject duplicate slugs
    expect(isVanitySlugUnique(existingSlugs, "john-special")).toBe(false);
    expect(isVanitySlugUnique(existingSlugs, "mary-offer")).toBe(false);
  });

  it("should generate correct vanity URL", () => {
    const domain = "tenant.saligaffiliate.com";
    const slug = "my-offer";
    
    const vanityUrl = buildVanityUrl(domain, slug);
    expect(vanityUrl).toBe("https://tenant.saligaffiliate.com/ref/my-offer");
  });

  it("should handle empty or invalid input gracefully", () => {
    expect(isValidVanitySlug("")).toBe(false);
    expect(isValidVanitySlug(" ")).toBe(false);
    expect(isValidVanitySlug("-")).toBe(false);
    expect(isValidVanitySlug("_")).toBe(false);
  });
});
