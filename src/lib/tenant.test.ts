import { describe, it, expect } from "vitest";
import {
  isTrialActive,
  hasPlan,
  isTenantActive,
  getTenantDisplayName,
  formatTrialDays,
  type TenantContext,
} from "./tenant";

describe("Tenant Utilities", () => {
  const mockTenant: TenantContext = {
    tenantId: "test-tenant-id" as any,
    name: "Test Company",
    slug: "test-company",
    plan: "starter",
    status: "active",
    isTrial: true,
    trialDaysRemaining: 10,
    branding: {
      portalName: "Test Portal",
      primaryColor: "#007bff",
    },
  };

  describe("isTrialActive", () => {
    it("should return true when trial is active", () => {
      expect(isTrialActive(mockTenant)).toBe(true);
    });

    it("should return false when trial is not active", () => {
      const nonTrialTenant = { ...mockTenant, isTrial: false };
      expect(isTrialActive(nonTrialTenant)).toBe(false);
    });

    it("should return false when tenant is null", () => {
      expect(isTrialActive(null)).toBe(false);
      expect(isTrialActive(undefined)).toBe(false);
    });
  });

  describe("hasPlan", () => {
    it("should return true when plan matches", () => {
      expect(hasPlan(mockTenant, "starter")).toBe(true);
    });

    it("should return false when plan does not match", () => {
      expect(hasPlan(mockTenant, "pro")).toBe(false);
    });

    it("should return false when tenant is null", () => {
      expect(hasPlan(null, "starter")).toBe(false);
    });
  });

  describe("isTenantActive", () => {
    it("should return true when status is active", () => {
      expect(isTenantActive(mockTenant)).toBe(true);
    });

    it("should return false when status is not active", () => {
      const inactiveTenant = { ...mockTenant, status: "suspended" };
      expect(isTenantActive(inactiveTenant)).toBe(false);
    });

    it("should return false when tenant is null", () => {
      expect(isTenantActive(null)).toBe(false);
    });
  });

  describe("getTenantDisplayName", () => {
    it("should return portal name when available", () => {
      expect(getTenantDisplayName(mockTenant)).toBe("Test Portal");
    });

    it("should return tenant name when portal name is not available", () => {
      const tenantWithoutPortal = { ...mockTenant, branding: {} };
      expect(getTenantDisplayName(tenantWithoutPortal)).toBe("Test Company");
    });

    it("should return 'Unknown' when tenant is null", () => {
      expect(getTenantDisplayName(null)).toBe("Unknown");
      expect(getTenantDisplayName(undefined)).toBe("Unknown");
    });
  });

  describe("formatTrialDays", () => {
    it("should format days correctly", () => {
      expect(formatTrialDays(10)).toBe("10 days remaining");
      expect(formatTrialDays(1)).toBe("1 day remaining");
    });

    it("should return 'Trial expired' when days is 0 or negative", () => {
      expect(formatTrialDays(0)).toBe("Trial expired");
      expect(formatTrialDays(-1)).toBe("Trial expired");
    });

    it("should return empty string when days is undefined", () => {
      expect(formatTrialDays(undefined)).toBe("");
    });
  });
});
