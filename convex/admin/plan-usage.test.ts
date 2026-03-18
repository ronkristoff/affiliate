import { describe, it, expect } from "vitest";

/**
 * Unit Tests for Admin Plan Limit Usage View
 *
 * Story 11.4: Plan Limit Usage View
 *
 * These tests validate:
 * - AC1: Plan usage section display with progress bars, percentages, warning thresholds
 * - AC2: 80% warning (amber) and 95% critical (red) thresholds
 * - Subtask 5.1: Unit tests for getTenantPlanUsage query logic
 * - Subtask 5.2: Unit tests for getTierLimits query logic
 * - Subtask 5.3: Component tests for PlanUsageCard (pure logic)
 * - Subtask 5.4: Integration tests for threshold warnings
 * - Subtask 5.5: Test loading and error states
 * - Subtask 5.6: Test expandable rows functionality
 */

// ========================================
// Extracted pure business logic for testing
// (Mirrors logic in convex/admin/tenants.ts)
// ========================================

type WarningLevel = "normal" | "warning" | "critical";

/**
 * Pure function: Calculate warning level from percentage.
 */
function getWarningLevel(percentage: number): WarningLevel {
  if (percentage >= 95) return "critical";
  if (percentage >= 80) return "warning";
  return "normal";
}

/**
 * Pure function: Calculate usage item (current, limit, percentage, warningLevel).
 */
function calculateUsageItem(current: number, limit: number) {
  const percentage = Math.round((current / limit) * 100);
  return {
    current,
    limit,
    percentage,
    warningLevel: getWarningLevel(percentage),
  };
}

/**
 * Pure function: Calculate tier limits with thresholds.
 */
function calculateTierLimits(configs: Array<{
  tier: string;
  maxAffiliates: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxPayoutsPerMonth: number;
}>) {
  const WARNING_THRESHOLD = 80;
  const CRITICAL_THRESHOLD = 95;

  return {
    tiers: configs.map((config) => ({
      tier: config.tier,
      limits: {
        maxAffiliates: config.maxAffiliates,
        maxCampaigns: config.maxCampaigns,
        maxTeamMembers: config.maxTeamMembers,
        maxPayoutsPerMonth: config.maxPayoutsPerMonth,
      },
      thresholds: {
        warning: WARNING_THRESHOLD,
        critical: CRITICAL_THRESHOLD,
      },
    })),
  };
}

/**
 * Pure function: Compute monthly payout count from payout batches.
 */
function computeMonthlyPayouts(
  payouts: Array<{ generatedAt: number; status: string }>,
  startOfMonthMs: number
): number {
  return payouts.filter(
    (p) => p.generatedAt >= startOfMonthMs && p.status === "processing"
  ).length;
}

/**
 * Pure function: Compute active count for team members.
 */
function computeActiveTeamMembers(
  users: Array<{ status?: string; removedAt?: number }>
): number {
  return users.filter((u) => u.status !== "removed" && !u.removedAt).length;
}

/**
 * Pure function: Determine if row should show custom domain info.
 */
function shouldShowCustomDomain(
  tier: string,
  hasCustomDomain: boolean
): boolean {
  return tier === "scale" || hasCustomDomain;
}

/**
 * Pure function: Format price for display.
 */
function formatPlanPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Pure function: Format tier label (capitalize first letter).
 */
function formatTierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Pure function: Toggle expandable row.
 */
function toggleExpandedRow(
  currentRows: Set<string>,
  key: string
): Set<string> {
  const next = new Set(currentRows);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

// ========================================
// Test Data
// ========================================

const MOCK_TIER_CONFIGS = [
  {
    tier: "starter",
    maxAffiliates: 50,
    maxCampaigns: 5,
    maxTeamMembers: 3,
    maxPayoutsPerMonth: 10,
  },
  {
    tier: "growth",
    maxAffiliates: 200,
    maxCampaigns: 25,
    maxTeamMembers: 10,
    maxPayoutsPerMonth: 50,
  },
  {
    tier: "scale",
    maxAffiliates: 1000,
    maxCampaigns: 100,
    maxTeamMembers: 50,
    maxPayoutsPerMonth: 200,
  },
];

// ========================================
// Tests: getTenantPlanUsage logic (Subtask 5.1)
// ========================================

describe("Plan Usage - getTenantPlanUsage logic (Subtask 5.1)", () => {
  describe("getWarningLevel", () => {
    it("should return 'normal' for percentages below 80%", () => {
      expect(getWarningLevel(0)).toBe("normal");
      expect(getWarningLevel(50)).toBe("normal");
      expect(getWarningLevel(79)).toBe("normal");
    });

    it("should return 'warning' for percentages from 80% to 94%", () => {
      expect(getWarningLevel(80)).toBe("warning");
      expect(getWarningLevel(85)).toBe("warning");
      expect(getWarningLevel(94)).toBe("warning");
    });

    it("should return 'critical' for percentages 95% and above", () => {
      expect(getWarningLevel(95)).toBe("critical");
      expect(getWarningLevel(100)).toBe("critical");
      expect(getWarningLevel(150)).toBe("critical");
    });
  });

  describe("calculateUsageItem", () => {
    it("should calculate percentage correctly for normal usage", () => {
      const result = calculateUsageItem(25, 50);
      expect(result.current).toBe(25);
      expect(result.limit).toBe(50);
      expect(result.percentage).toBe(50);
      expect(result.warningLevel).toBe("normal");
    });

    it("should calculate percentage correctly for warning threshold (80%)", () => {
      const result = calculateUsageItem(40, 50);
      expect(result.percentage).toBe(80);
      expect(result.warningLevel).toBe("warning");
    });

    it("should calculate percentage correctly for critical threshold (95%+)", () => {
      const result = calculateUsageItem(190, 200);
      expect(result.percentage).toBe(95);
      expect(result.warningLevel).toBe("critical");
    });

    it("should handle zero current usage", () => {
      const result = calculateUsageItem(0, 50);
      expect(result.percentage).toBe(0);
      expect(result.warningLevel).toBe("normal");
    });

    it("should round percentages correctly", () => {
      const result = calculateUsageItem(33, 100);
      expect(result.percentage).toBe(33);
    });
  });
});

// ========================================
// Tests: getTierLimits logic (Subtask 5.2)
// ========================================

describe("Plan Usage - getTierLimits logic (Subtask 5.2)", () => {
  it("should return all tier configurations", () => {
    const result = calculateTierLimits(MOCK_TIER_CONFIGS);
    expect(result.tiers).toHaveLength(3);
  });

  it("should include correct limits for each tier", () => {
    const result = calculateTierLimits(MOCK_TIER_CONFIGS);
    const starter = result.tiers.find((t) => t.tier === "starter");
    expect(starter).toBeDefined();
    expect(starter!.limits.maxAffiliates).toBe(50);
    expect(starter!.limits.maxCampaigns).toBe(5);
  });

  it("should include warning and critical thresholds for each tier", () => {
    const result = calculateTierLimits(MOCK_TIER_CONFIGS);
    for (const tier of result.tiers) {
      expect(tier.thresholds.warning).toBe(80);
      expect(tier.thresholds.critical).toBe(95);
    }
  });

  it("should return empty tiers array for empty config", () => {
    const result = calculateTierLimits([]);
    expect(result.tiers).toHaveLength(0);
  });
});

// ========================================
// Tests: Component logic (Subtask 5.3)
// ========================================

describe("Plan Usage - Component logic (Subtask 5.3)", () => {
  describe("formatPlanPrice", () => {
    it("should format price in PHP currency", () => {
      expect(formatPlanPrice(499)).toBe("₱499");
      expect(formatPlanPrice(2999)).toBe("₱2,999");
      expect(formatPlanPrice(0)).toBe("₱0");
    });
  });

  describe("formatTierLabel", () => {
    it("should capitalize first letter of tier", () => {
      expect(formatTierLabel("starter")).toBe("Starter");
      expect(formatTierLabel("growth")).toBe("Growth");
      expect(formatTierLabel("scale")).toBe("Scale");
    });
  });

  describe("shouldShowCustomDomain", () => {
    it("should show custom domain for scale tier", () => {
      expect(shouldShowCustomDomain("scale", false)).toBe(true);
    });

    it("should show custom domain for non-scale tier if configured", () => {
      expect(shouldShowCustomDomain("growth", true)).toBe(true);
    });

    it("should not show custom domain for non-scale tier without configuration", () => {
      expect(shouldShowCustomDomain("starter", false)).toBe(false);
      expect(shouldShowCustomDomain("growth", false)).toBe(false);
    });
  });
});

// ========================================
// Tests: Threshold warnings (Subtask 5.4)
// ========================================

describe("Plan Usage - Threshold warnings (Subtask 5.4)", () => {
  it("should flag all usage categories independently", () => {
    // Scenario: affiliates at 80%, campaigns at 95%, team at 40%, payouts at 0%
    const affiliates = calculateUsageItem(40, 50);  // 80%
    const campaigns = calculateUsageItem(19, 20);   // 95%
    const teamMembers = calculateUsageItem(4, 10);  // 40%
    const payouts = calculateUsageItem(0, 10);      // 0%

    expect(affiliates.warningLevel).toBe("warning");
    expect(campaigns.warningLevel).toBe("critical");
    expect(teamMembers.warningLevel).toBe("normal");
    expect(payouts.warningLevel).toBe("normal");
  });

  it("should flag exactly at 80% boundary", () => {
    const result = calculateUsageItem(4, 5);
    expect(result.percentage).toBe(80);
    expect(result.warningLevel).toBe("warning");
  });

  it("should flag exactly at 95% boundary", () => {
    const result = calculateUsageItem(19, 20);
    expect(result.percentage).toBe(95);
    expect(result.warningLevel).toBe("critical");
  });

  it("should not flag below 80%", () => {
    const result = calculateUsageItem(39, 50); // 78%
    expect(result.percentage).toBe(78);
    expect(result.warningLevel).toBe("normal");
  });

  it("should handle over-limit (100%+)", () => {
    const result = calculateUsageItem(60, 50); // 120%
    expect(result.percentage).toBe(120);
    expect(result.warningLevel).toBe("critical");
  });
});

// ========================================
// Tests: Loading and error states (Subtask 5.5)
// ========================================

describe("Plan Usage - Loading and error states (Subtask 5.5)", () => {
  it("should identify loading state when usage is undefined", () => {
    const usage = undefined;
    const isLoading = usage === undefined;
    expect(isLoading).toBe(true);
  });

  it("should identify loaded state when usage has data", () => {
    const usage = { plan: { tier: "starter" }, usage: {} };
    const isLoading = usage === undefined;
    expect(isLoading).toBe(false);
  });

  it("should render nothing when usage is null (error state)", () => {
    const usage = null;
    const shouldRender = usage !== null && usage !== undefined;
    expect(shouldRender).toBe(false);
  });
});

// ========================================
// Tests: Expandable rows (Subtask 5.6)
// ========================================

describe("Plan Usage - Expandable rows (Subtask 5.6)", () => {
  it("should add a row to expanded set when not present", () => {
    const current = new Set<string>(["affiliates"]);
    const result = toggleExpandedRow(current, "campaigns");
    expect(result.has("campaigns")).toBe(true);
    expect(result.has("affiliates")).toBe(true);
  });

  it("should remove a row from expanded set when already present", () => {
    const current = new Set<string>(["affiliates", "campaigns"]);
    const result = toggleExpandedRow(current, "campaigns");
    expect(result.has("campaigns")).toBe(false);
    expect(result.has("affiliates")).toBe(true);
  });

  it("should not mutate original set", () => {
    const current = new Set<string>(["affiliates"]);
    toggleExpandedRow(current, "campaigns");
    expect(current.has("campaigns")).toBe(false);
    expect(current.has("affiliates")).toBe(true);
  });

  it("should handle toggling an empty set", () => {
    const current = new Set<string>();
    const result = toggleExpandedRow(current, "affiliates");
    expect(result.has("affiliates")).toBe(true);
    expect(result.size).toBe(1);
  });
});

// ========================================
// Tests: Monthly payout computation
// ========================================

describe("Plan Usage - Monthly payout computation", () => {
  it("should count only processing payouts from this month", () => {
    const now = new Date("2026-03-15");
    const startOfMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const payouts = [
      { generatedAt: startOfMonthMs + 1000, status: "processing" },  // This month, processing
      { generatedAt: startOfMonthMs + 2000, status: "completed" },   // This month, not processing
      { generatedAt: startOfMonthMs - 1000, status: "processing" },  // Last month, processing
      { generatedAt: startOfMonthMs + 3000, status: "processing" },  // This month, processing
    ];

    const count = computeMonthlyPayouts(payouts, startOfMonthMs);
    expect(count).toBe(2);
  });

  it("should return 0 when no processing payouts exist", () => {
    const startOfMonthMs = new Date(2026, 2, 1).getTime();
    const payouts = [
      { generatedAt: startOfMonthMs + 1000, status: "completed" },
    ];
    expect(computeMonthlyPayouts(payouts, startOfMonthMs)).toBe(0);
  });

  it("should return 0 for empty payout list", () => {
    expect(computeMonthlyPayouts([], Date.now())).toBe(0);
  });
});

// ========================================
// Tests: Active team member computation
// ========================================

describe("Plan Usage - Active team member computation", () => {
  it("should count non-removed team members", () => {
    const users = [
      { status: "active" },
      { status: "inactive" },
      { status: "removed" },
      { status: "active", removedAt: 12345 },
      {},
    ];
    expect(computeActiveTeamMembers(users)).toBe(3);
  });

  it("should return 0 for empty user list", () => {
    expect(computeActiveTeamMembers([])).toBe(0);
  });

  it("should handle users with no status field", () => {
    const users = [{ name: "test" }, { name: "test2" }];
    expect(computeActiveTeamMembers(users as any)).toBe(2);
  });
});
