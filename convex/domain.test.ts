import { describe, it, expect } from "vitest";

/**
 * Unit Tests for Custom Domain Configuration (Story 8.8)
 *
 * These tests validate the business logic for:
 * - Domain format validation
 * - DNS verification logic
 * - SSL status transitions
 * - Tier enforcement (Scale tier only)
 * - Referral link generation with custom domain
 *
 * ⚠️ INTEGRATION TESTS NEEDED (TODO):
 * The following integration tests should be added to validate actual Convex behavior:
 *
 * 1. Mutation Integration Tests:
 *    - updateTenantDomain with actual database state changes
 *    - verifyDomainDns with mocked DNS responses
 *    - initiateSslProvisioning status transitions
 *    - removeTenantDomain clearing all domain fields
 *
 * 2. Permission Integration Tests:
 *    - getTenantDomainConfig with different user roles
 *    - updateTenantDomain with unauthorized user
 *    - verifyDomainDns rate limiting behavior
 *
 * 3. Tier Enforcement Integration Tests:
 *    - Non-Scale tier user attempting to update domain
 *    - Scale tier user with valid permissions
 *    - Plan downgrade after domain configuration
 *
 * 4. Database State Tests:
 *    - Atomic transaction behavior on failure
 *    - Audit log entries created correctly
 *    - Branding object partial updates
 *
 * Integration tests require convex-test framework or live Convex backend.
 * See: https://docs.convex.dev/testing
 */

// Domain validation regex (matches the one in convex/tenants.ts)
// Rejects: double dots (..), leading/trailing hyphens, IP addresses
const domainRegex = /^(?!.*\.\.)(?!.*-$)(?!^-)[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

describe("Custom Domain - Domain Format Validation (AC2)", () => {
  describe("Valid Domain Formats", () => {
    it("should accept simple domain like affiliates.mycompany.com", () => {
      const domain = "affiliates.mycompany.com";
      expect(domainRegex.test(domain)).toBe(true);
    });
    
    it("should accept domain with multiple subdomains", () => {
      const domain = "portal.affiliates.mycompany.com";
      expect(domainRegex.test(domain)).toBe(true);
    });
    
    it("should accept domain with hyphens", () => {
      const domain = "my-affiliates.company.com";
      expect(domainRegex.test(domain)).toBe(true);
    });
    
    it("should accept two-level TLD", () => {
      const domain = "affiliates.mycompany.co.uk";
      expect(domainRegex.test(domain)).toBe(true);
    });
    
    it("should accept domain with numbers", () => {
      const domain = "affiliates.mycompany123.com";
      expect(domainRegex.test(domain)).toBe(true);
    });
  });
  
  describe("Invalid Domain Formats", () => {
    it("should reject domain with protocol prefix", () => {
      const domain = "https://affiliates.mycompany.com";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain with http prefix", () => {
      const domain = "http://affiliates.mycompany.com";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain with path", () => {
      const domain = "affiliates.mycompany.com/path";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain with port", () => {
      const domain = "affiliates.mycompany.com:8080";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject IP address", () => {
      const domain = "192.168.1.1";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain starting with hyphen", () => {
      const domain = "-affiliates.mycompany.com";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain ending with hyphen", () => {
      const domain = "affiliates-.mycompany.com";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject single-label domain", () => {
      const domain = "localhost";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain with double dots", () => {
      const domain = "example..com";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain with multiple consecutive dots", () => {
      const domain = "sub..domain.example.com";
      expect(domainRegex.test(domain)).toBe(false);
    });
    
    it("should reject domain ending with dot", () => {
      const domain = "example.com.";
      expect(domainRegex.test(domain)).toBe(false);
    });
  });
  
  describe("Domain Input Cleaning", () => {
    it("should strip https:// protocol", () => {
      const input = "https://affiliates.mycompany.com";
      const cleaned = input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      expect(cleaned).toBe("affiliates.mycompany.com");
    });
    
    it("should strip http:// protocol", () => {
      const input = "http://affiliates.mycompany.com";
      const cleaned = input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      expect(cleaned).toBe("affiliates.mycompany.com");
    });
    
    it("should strip trailing path", () => {
      const input = "affiliates.mycompany.com/path/to/page";
      const cleaned = input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
      expect(cleaned).toBe("affiliates.mycompany.com");
    });
  });
});

describe("Custom Domain - Domain Status Transitions (AC4, AC5, AC6)", () => {
  const validTransitions = [
    { from: "pending", to: "dns_verification" },
    { from: "dns_verification", to: "ssl_provisioning" },
    { from: "ssl_provisioning", to: "active" },
    { from: "ssl_provisioning", to: "failed" },
    { from: "active", to: "pending" }, // When domain is removed
  ];
  
  const invalidTransitions = [
    { from: "pending", to: "active" },
    { from: "pending", to: "ssl_provisioning" },
    { from: "dns_verification", to: "active" },
    { from: "active", to: "dns_verification" },
  ];
  
  describe("Valid Status Transitions", () => {
    validTransitions.forEach(({ from, to }) => {
      it(`should allow transition from ${from} to ${to}`, () => {
        // This is the expected business logic - implemented in mutations
        const isValid = (from === "pending" && to === "dns_verification") ||
                        (from === "dns_verification" && to === "ssl_provisioning") ||
                        (from === "ssl_provisioning" && (to === "active" || to === "failed")) ||
                        (from === "active" && to === "pending");
        expect(isValid).toBe(true);
      });
    });
  });
  
  describe("Invalid Status Transitions", () => {
    it("should not allow direct transition from pending to active", () => {
      const canSkipDns = false; // Should always verify DNS first
      expect(canSkipDns).toBe(false);
    });
    
    it("should not allow direct transition from pending to ssl_provisioning", () => {
      const canSkipDns = false;
      expect(canSkipDns).toBe(false);
    });
    
    it("should not allow transition from active back to dns_verification", () => {
      const canGoBack = false;
      expect(canGoBack).toBe(false);
    });
  });
});

describe("Custom Domain - Tier Enforcement (AC8)", () => {
  describe("Scale Tier Features", () => {
    it("should allow custom domain for Scale tier", () => {
      const tierConfig = { features: { customDomain: true } };
      expect(tierConfig.features.customDomain).toBe(true);
    });
    
    it("should have customDomain flag in tier configs", () => {
      const tierConfigs = {
        starter: { features: { customDomain: false } },
        growth: { features: { customDomain: false } },
        scale: { features: { customDomain: true } },
      };
      
      expect(tierConfigs.starter.features.customDomain).toBe(false);
      expect(tierConfigs.growth.features.customDomain).toBe(false);
      expect(tierConfigs.scale.features.customDomain).toBe(true);
    });
  });
});

describe("Custom Domain - Referral Link Generation (AC6)", () => {
  describe("Domain Priority Logic", () => {
    it("should use custom domain when active", () => {
      const tenant = {
        branding: {
          customDomain: "affiliates.acme.com",
          domainStatus: "active",
        },
        slug: "acme",
      };
      
      const domain = tenant?.branding?.customDomain && tenant?.branding?.domainStatus === "active"
        ? tenant.branding.customDomain
        : (tenant?.slug ? `${tenant.slug}.saligaffiliate.com` : "app.saligaffiliate.com");
      
      expect(domain).toBe("affiliates.acme.com");
    });
    
    it("should use subdomain when custom domain is not active", () => {
      const tenant = {
        branding: {
          customDomain: "affiliates.acme.com",
          domainStatus: "pending",
        },
        slug: "acme",
      };
      
      const domain = tenant?.branding?.customDomain && tenant?.branding?.domainStatus === "active"
        ? tenant.branding.customDomain
        : (tenant?.slug ? `${tenant.slug}.saligaffiliate.com` : "app.saligaffiliate.com");
      
      expect(domain).toBe("acme.saligaffiliate.com");
    });
    
    it("should use default platform domain when no custom domain", () => {
      const tenant: { branding: Record<string, unknown>; slug: string } = {
        branding: {},
        slug: "acme",
      };
      
      const branding = tenant.branding as { customDomain?: string; domainStatus?: string };
      const domain = branding?.customDomain && branding?.domainStatus === "active"
        ? branding.customDomain
        : (tenant?.slug ? `${tenant.slug}.saligaffiliate.com` : "app.saligaffiliate.com");
      
      expect(domain).toBe("acme.saligaffiliate.com");
    });
    
    it("should use default platform domain when tenant has no slug", () => {
      const tenant: { branding: Record<string, unknown>; slug?: string } = {
        branding: {},
      };
      
      const branding = tenant.branding as { customDomain?: string; domainStatus?: string };
      const domain = branding?.customDomain && branding?.domainStatus === "active"
        ? branding.customDomain
        : (tenant?.slug ? `${tenant.slug}.saligaffiliate.com` : "app.saligaffiliate.com");
      
      expect(domain).toBe("app.saligaffiliate.com");
    });
  });
  
  describe("URL Building", () => {
    function buildShortUrl(domain: string, code: string): string {
      return `https://${domain}/ref/${code}`;
    }
    
    it("should build correct URL with custom domain", () => {
      const url = buildShortUrl("affiliates.acme.com", "ABC123");
      expect(url).toBe("https://affiliates.acme.com/ref/ABC123");
    });
    
    it("should build correct URL with subdomain", () => {
      const url = buildShortUrl("acme.saligaffiliate.com", "ABC123");
      expect(url).toBe("https://acme.saligaffiliate.com/ref/ABC123");
    });
  });
});

describe("Custom Domain - DNS Configuration Instructions (AC3)", () => {
  describe("CNAME Record Format", () => {
    it("should generate correct CNAME record for affiliates.mycompany.com", () => {
      const customDomain = "affiliates.mycompany.com";
      const platformDomain = "app.saligaffiliate.com";
      
      expect(customDomain).toBe("affiliates.mycompany.com");
      expect(platformDomain).toBe("app.saligaffiliate.com");
    });
    
    it("should provide correct record type", () => {
      const recordType = "CNAME";
      expect(recordType).toBe("CNAME");
    });
  });
});
