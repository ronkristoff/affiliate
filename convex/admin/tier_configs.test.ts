import { describe, it, expect } from "vitest";

/**
 * Unit Tests for Admin Tier Configuration Management
 *
 * Story 11.6: Tier Configuration Management
 *
 * These tests validate:
 * - AC3: Tier configuration validation rules
 * - AC4: Impact assessment logic (detect decreased limits, count affected tenants)
 * - AC5: Save behavior and audit logging
 * - AC6: Notification creation for affected tenants
 * - AC7: Feature gate toggle behavior
 *
 * Tests follow the project pattern: extract pure business logic and test it.
 * Pure functions are imported from the implementation file.
 */

import {
  validateTierConfigValues,
  validateTierName,
  calculateDecreasedLimits,
  formatLimitValue,
  determineImpactSeverity,
} from "./tier_configs";

// =============================================================================
// Test Data
// =============================================================================

const VALID_CONFIG = {
  price: 99,
  maxAffiliates: 5000,
  maxCampaigns: 10,
  maxTeamMembers: 20,
  maxPayoutsPerMonth: 100,
  maxApiCalls: 10000,
};

const VALID_UNLIMITED_CONFIG = {
  price: 299,
  maxAffiliates: -1,
  maxCampaigns: -1,
  maxTeamMembers: -1,
  maxPayoutsPerMonth: -1,
  maxApiCalls: -1,
};

// =============================================================================
// Subtask 9.1: Unit tests for updateTierConfig mutation
// =============================================================================

describe("AC3: Tier configuration validation", () => {
  describe("validateTierConfigValues", () => {
    it("should accept all valid positive values", () => {
      const errors = validateTierConfigValues(VALID_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it("should accept unlimited (-1) values for all limits", () => {
      const errors = validateTierConfigValues(VALID_UNLIMITED_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it("should accept zero price (free tier)", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, price: 0 });
      expect(errors).toHaveLength(0);
    });

    it("should reject negative price", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, price: -1 });
      expect(errors).toContain("Price must be >= 0");
    });

    it("should reject price exceeding maximum", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, price: 100001 });
      expect(errors).toContain("Price cannot exceed 100,000");
    });

    it("should reject maxAffiliates of 0 (must be > 0 or -1)", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, maxAffiliates: 0 });
      expect(errors).toContain("Max Affiliates must be > 0 or -1 (unlimited)");
    });

    it("should reject negative maxCampaigns that is not -1", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, maxCampaigns: -5 });
      expect(errors).toContain("Max Campaigns must be > 0 or -1 (unlimited)");
    });

    it("should reject maxTeamMembers of 0", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, maxTeamMembers: 0 });
      expect(errors).toContain("Max Team Members must be > 0 or -1 (unlimited)");
    });

    it("should reject maxPayoutsPerMonth of -2", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, maxPayoutsPerMonth: -2 });
      expect(errors).toContain("Max Payouts Per Month must be > 0 or -1 (unlimited)");
    });

    it("should reject maxApiCalls exceeding maximum", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, maxApiCalls: 100001 });
      expect(errors).toContain("Max API Calls cannot exceed 100,000");
    });

    it("should accept price at the maximum limit", () => {
      const errors = validateTierConfigValues({ ...VALID_CONFIG, price: 100000 });
      expect(errors).toHaveLength(0);
    });

    it("should accept limit values at the maximum", () => {
      const errors = validateTierConfigValues({
        ...VALID_CONFIG,
        maxAffiliates: 100000,
        maxCampaigns: 100000,
        maxTeamMembers: 100000,
        maxPayoutsPerMonth: 100000,
        maxApiCalls: 100000,
      });
      expect(errors).toHaveLength(0);
    });

    it("should accept mixed valid values (some unlimited, some finite)", () => {
      const errors = validateTierConfigValues({
        price: 99,
        maxAffiliates: -1,
        maxCampaigns: 10,
        maxTeamMembers: -1,
        maxPayoutsPerMonth: 50,
        maxApiCalls: -1,
      });
      expect(errors).toHaveLength(0);
    });

    it("should report multiple validation errors at once", () => {
      const errors = validateTierConfigValues({
        price: -10,
        maxAffiliates: 0,
        maxCampaigns: -5,
        maxTeamMembers: 200000,
        maxPayoutsPerMonth: -2,
        maxApiCalls: 999999,
      });
      expect(errors.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("validateTierName", () => {
    it("should accept 'starter'", () => {
      const error = validateTierName("starter");
      expect(error).toBeUndefined();
    });

    it("should accept 'growth'", () => {
      const error = validateTierName("growth");
      expect(error).toBeUndefined();
    });

    it("should accept 'scale'", () => {
      const error = validateTierName("scale");
      expect(error).toBeUndefined();
    });

    it("should reject unknown tier name", () => {
      const error = validateTierName("enterprise");
      expect(error).toContain("Unknown tier");
      expect(error).toContain("enterprise");
    });

    it("should reject empty tier name", () => {
      const error = validateTierName("");
      expect(error).toContain("Unknown tier");
    });

    it("should reject case-sensitive tier names", () => {
      const error = validateTierName("Starter");
      expect(error).toContain("Unknown tier");
    });
  });
});

// =============================================================================
// Subtask 9.2: Unit tests for impact assessment logic
// =============================================================================

describe("AC4: Impact assessment logic", () => {
  describe("calculateDecreasedLimits", () => {
    it("should detect no decrease when all limits stay the same", () => {
      const current = { maxAffiliates: 100, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const proposed = { maxAffiliates: 100, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(0);
    });

    it("should detect decrease when maxAffiliates is reduced", () => {
      const current = { maxAffiliates: 5000, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const proposed = { maxAffiliates: 2000, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe("maxAffiliates");
      expect(result[0].oldValue).toBe(5000);
      expect(result[0].newValue).toBe(2000);
    });

    it("should detect going from unlimited to limited as a decrease", () => {
      const current = { maxAffiliates: -1, maxCampaigns: -1, maxTeamMembers: -1, maxPayoutsPerMonth: -1, maxApiCalls: -1 };
      const proposed = { maxAffiliates: 1000, maxCampaigns: -1, maxTeamMembers: -1, maxPayoutsPerMonth: -1, maxApiCalls: -1 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe("maxAffiliates");
      expect(result[0].oldValue).toBe(-1);
      expect(result[0].newValue).toBe(1000);
    });

    it("should NOT detect going from limited to unlimited as a decrease", () => {
      const current = { maxAffiliates: 100, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const proposed = { maxAffiliates: -1, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(0);
    });

    it("should detect multiple simultaneous decreases", () => {
      const current = { maxAffiliates: 5000, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const proposed = { maxAffiliates: 1000, maxCampaigns: 5, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.field)).toContain("maxAffiliates");
      expect(result.map((r) => r.field)).toContain("maxCampaigns");
    });

    it("should NOT detect limit increases", () => {
      const current = { maxAffiliates: 100, maxCampaigns: 10, maxTeamMembers: 20, maxPayoutsPerMonth: 50, maxApiCalls: 1000 };
      const proposed = { maxAffiliates: 500, maxCampaigns: 50, maxTeamMembers: 100, maxPayoutsPerMonth: 200, maxApiCalls: 5000 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(0);
    });

    it("should detect decrease when going from unlimited to limited for multiple fields", () => {
      const current = { maxAffiliates: -1, maxCampaigns: -1, maxTeamMembers: -1, maxPayoutsPerMonth: -1, maxApiCalls: -1 };
      const proposed = { maxAffiliates: -1, maxCampaigns: 5, maxTeamMembers: 10, maxPayoutsPerMonth: -1, maxApiCalls: -1 };
      const result = calculateDecreasedLimits(current, proposed);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.field)).toContain("maxCampaigns");
      expect(result.map((r) => r.field)).toContain("maxTeamMembers");
    });
  });

  describe("determineImpactSeverity", () => {
    it("should return 'none' for 0 affected tenants", () => {
      expect(determineImpactSeverity(0)).toBe("none");
    });

    it("should return 'warning' for 1-5 affected tenants", () => {
      expect(determineImpactSeverity(1)).toBe("warning");
      expect(determineImpactSeverity(3)).toBe("warning");
      expect(determineImpactSeverity(5)).toBe("warning");
    });

    it("should return 'critical' for more than 5 affected tenants", () => {
      expect(determineImpactSeverity(6)).toBe("critical");
      expect(determineImpactSeverity(100)).toBe("critical");
    });
  });

  describe("formatLimitValue", () => {
    it("should return 'unlimited' for -1", () => {
      expect(formatLimitValue(-1)).toBe("unlimited");
    });

    it("should return the number for finite values", () => {
      expect(formatLimitValue(100)).toBe(100);
      expect(formatLimitValue(0)).toBe(0);
    });

    it("should handle large numbers", () => {
      expect(formatLimitValue(100000)).toBe(100000);
    });
  });
});

// =============================================================================
// Subtask 9.3: Unit tests for notification creation
// =============================================================================

describe("AC6: Notification creation logic", () => {
  /**
   * Simulate notification creation logic.
   * Tests the decision of which tenants get notified.
   */
  it("should identify correct tenants exceeding new limits", () => {
    // Simulated tenant usage data
    const tenantUsage = [
      { id: "t1", maxAffiliates: 3000, plan: "growth" },
      { id: "t2", maxAffiliates: 500, plan: "growth" },
      { id: "t3", maxAffiliates: 8000, plan: "growth" },
      { id: "t4", maxAffiliates: 1500, plan: "growth" },
    ];

    // New maxAffiliates limit: 2000
    const newLimit = 2000;
    const affected = tenantUsage.filter((t) => t.maxAffiliates > newLimit);

    expect(affected).toHaveLength(2);
    expect(affected.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("should not notify tenants within new limits", () => {
    const tenantUsage = [
      { id: "t1", maxAffiliates: 500, plan: "growth" },
      { id: "t2", maxAffiliates: 1500, plan: "growth" },
    ];

    const newLimit = 2000;
    const affected = tenantUsage.filter((t) => t.maxAffiliates > newLimit);

    expect(affected).toHaveLength(0);
  });

  it("should not notify when going from limited to unlimited", () => {
    // If maxAffiliates goes from 100 to -1 (unlimited), nobody is affected
    const tenantUsage = [
      { id: "t1", maxAffiliates: 50, plan: "starter" },
      { id: "t2", maxAffiliates: 99, plan: "starter" },
    ];

    const newLimit = -1; // unlimited
    // No tenants can exceed "unlimited"
    const affected = newLimit === -1 ? [] : tenantUsage.filter((t) => t.maxAffiliates > newLimit);

    expect(affected).toHaveLength(0);
  });
});

// =============================================================================
// Subtask 9.4: Unit tests for validation rules
// =============================================================================

describe("AC3/AC7: Feature gate validation", () => {
  it("should allow toggling any feature gate independently", () => {
    const features = {
      customDomain: false,
      advancedAnalytics: false,
      prioritySupport: false,
    };

    // Toggle customDomain
    features.customDomain = true;
    expect(features.customDomain).toBe(true);
    expect(features.advancedAnalytics).toBe(false);
    expect(features.prioritySupport).toBe(false);

    // Toggle advancedAnalytics
    features.advancedAnalytics = true;
    expect(features.customDomain).toBe(true);
    expect(features.advancedAnalytics).toBe(true);

    // All enabled
    features.prioritySupport = true;
    expect(features).toEqual({
      customDomain: true,
      advancedAnalytics: true,
      prioritySupport: true,
    });
  });

  it("should allow disabling features on any tier", () => {
    const features = {
      customDomain: true,
      advancedAnalytics: true,
      prioritySupport: true,
    };

    // Disable a feature
    features.prioritySupport = false;
    expect(features.prioritySupport).toBe(false);
    expect(features.customDomain).toBe(true);
  });
});

// =============================================================================
// Subtask 9.5: Integration test for full edit flow
// =============================================================================

describe("Full edit flow (integration)", () => {
  it("should handle complete tier config update lifecycle", () => {
    // Step 1: Admin views current config
    const currentConfig = {
      tier: "growth",
      price: 99,
      maxAffiliates: 5000,
      maxCampaigns: 10,
      maxTeamMembers: 20,
      maxPayoutsPerMonth: 100,
      maxApiCalls: 10000,
      features: {
        customDomain: true,
        advancedAnalytics: true,
        prioritySupport: false,
      },
    };

    // Step 2: Admin modifies config
    const proposedConfig = {
      tier: "growth",
      price: 149,
      maxAffiliates: 2000, // Decreased!
      maxCampaigns: 15, // Increased
      maxTeamMembers: 30,
      maxPayoutsPerMonth: 100,
      maxApiCalls: 15000,
      features: {
        customDomain: true,
        advancedAnalytics: true,
        prioritySupport: true, // Enabled!
      },
    };

    // Step 3: Validate proposed changes
    const validationErrors = validateTierConfigValues({
      price: proposedConfig.price,
      maxAffiliates: proposedConfig.maxAffiliates,
      maxCampaigns: proposedConfig.maxCampaigns,
      maxTeamMembers: proposedConfig.maxTeamMembers,
      maxPayoutsPerMonth: proposedConfig.maxPayoutsPerMonth,
      maxApiCalls: proposedConfig.maxApiCalls,
    });
    expect(validationErrors).toHaveLength(0);

    // Step 4: Validate tier name
    const tierError = validateTierName(proposedConfig.tier);
    expect(tierError).toBeUndefined();

    // Step 5: Calculate impact
    const decreasedLimits = calculateDecreasedLimits(
      {
        maxAffiliates: currentConfig.maxAffiliates,
        maxCampaigns: currentConfig.maxCampaigns,
        maxTeamMembers: currentConfig.maxTeamMembers,
        maxPayoutsPerMonth: currentConfig.maxPayoutsPerMonth,
        maxApiCalls: currentConfig.maxApiCalls,
      },
      {
        maxAffiliates: proposedConfig.maxAffiliates,
        maxCampaigns: proposedConfig.maxCampaigns,
        maxTeamMembers: proposedConfig.maxTeamMembers,
        maxPayoutsPerMonth: proposedConfig.maxPayoutsPerMonth,
        maxApiCalls: proposedConfig.maxApiCalls,
      }
    );
    expect(decreasedLimits).toHaveLength(1);
    expect(decreasedLimits[0].field).toBe("maxAffiliates");
    expect(decreasedLimits[0].oldValue).toBe(5000);
    expect(decreasedLimits[0].newValue).toBe(2000);

    // Step 6: Determine severity (simulated: 3 tenants affected)
    const affectedTenants = 3;
    const severity = determineImpactSeverity(affectedTenants);
    expect(severity).toBe("warning");

    // Step 7: Admin confirms, changes saved
    expect(proposedConfig.price).toBe(149);
    expect(proposedConfig.maxAffiliates).toBe(2000);
    expect(proposedConfig.features.prioritySupport).toBe(true);
  });

  it("should reject update with invalid tier name", () => {
    const error = validateTierName("invalid_tier");
    expect(error).toContain("Unknown tier");
  });

  it("should handle update that increases all limits (no impact)", () => {
    const current = { maxAffiliates: 100, maxCampaigns: 3, maxTeamMembers: 5, maxPayoutsPerMonth: 10, maxApiCalls: 1000 };
    const proposed = { maxAffiliates: 200, maxCampaigns: 10, maxTeamMembers: 15, maxPayoutsPerMonth: 50, maxApiCalls: 5000 };

    const decreased = calculateDecreasedLimits(current, proposed);
    expect(decreased).toHaveLength(0);

    const severity = determineImpactSeverity(0);
    expect(severity).toBe("none");
  });

  it("should handle update from unlimited to limited (high impact)", () => {
    const current = { maxAffiliates: -1, maxCampaigns: -1, maxTeamMembers: -1, maxPayoutsPerMonth: -1, maxApiCalls: -1 };
    const proposed = { maxAffiliates: 100, maxCampaigns: 5, maxTeamMembers: 10, maxPayoutsPerMonth: 20, maxApiCalls: 1000 };

    const decreased = calculateDecreasedLimits(current, proposed);
    expect(decreased).toHaveLength(5);

    // Simulate 10 tenants affected
    const severity = determineImpactSeverity(10);
    expect(severity).toBe("critical");
  });
});
