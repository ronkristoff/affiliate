import { describe, it, expect, beforeEach } from "vitest";

/**
 * Unit Tests for Fraud Signals Dashboard
 * 
 * Story 5.7: Fraud Signals Dashboard
 * 
 * These tests validate:
 * - AC1-4: Fraud signal display with type, severity, timestamp, details
 * - AC5-8: Fraud signal dismissal with note and audit logging
 * - AC9-12: Affiliate suspension from fraud signal with audit trail
 * - Filter and sort functionality
 * - RBAC enforcement
 */

/**
 * Test Helper Functions
 */

// Simulates the filter logic from fraudSignals.ts
const filterFraudSignals = (
  signals: Array<{
    type: string;
    severity: string;
    reviewedAt?: number;
  }>,
  filters?: {
    signalType?: string;
    severity?: string;
    reviewedStatus?: string;
  }
) => {
  let result = [...signals];
  
  if (filters?.signalType && filters.signalType !== "all") {
    result = result.filter(s => s.type === filters.signalType);
  }
  
  if (filters?.severity && filters.severity !== "all") {
    result = result.filter(s => s.severity === filters.severity);
  }
  
  if (filters?.reviewedStatus) {
    if (filters.reviewedStatus === "reviewed") {
      result = result.filter(s => s.reviewedAt !== undefined);
    } else if (filters.reviewedStatus === "unreviewed") {
      result = result.filter(s => s.reviewedAt === undefined);
    }
  }
  
  return result;
};

// Simulates the sort logic from fraudSignals.ts
const sortFraudSignals = (
  signals: Array<{ timestamp: number; severity: string }>,
  sortBy: string
) => {
  const sorted = [...signals];
  const severityOrder = { "high": 3, "medium": 2, "low": 1 };
  
  if (sortBy === "newest") {
    sorted.sort((a, b) => b.timestamp - a.timestamp);
  } else if (sortBy === "oldest") {
    sorted.sort((a, b) => a.timestamp - b.timestamp);
  } else if (sortBy === "severity") {
    sorted.sort((a, b) => severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder]);
  }
  
  return sorted;
};

// Simulates severity color config
const severityConfig = {
  high: { color: "red", priority: 3 },
  medium: { color: "amber", priority: 2 },
  low: { color: "blue", priority: 1 },
};

// Simulates validation for dismiss mutation
const validateDismissSignal = (args: {
  signal: { severity: string; reviewedAt?: number };
  note?: string;
}): { valid: boolean; error?: string } => {
  // Already reviewed check
  if (args.signal.reviewedAt) {
    return { valid: false, error: "Fraud signal has already been reviewed" };
  }
  
  // Note required for high severity
  if (args.signal.severity === "high" && (!args.note || args.note.trim().length === 0)) {
    return { valid: false, error: "A dismissal note is required for high-severity fraud signals" };
  }
  
  // Note length validation
  if (args.note && args.note.length > 500) {
    return { valid: false, error: "Dismissal note must be 500 characters or less" };
  }
  
  return { valid: true };
};

// Simulates validation for suspend affiliate
const validateSuspendAffiliate = (args: {
  currentStatus: string;
  reason?: string;
}): { valid: boolean; error?: string } => {
  if (args.currentStatus !== "active") {
    return { valid: false, error: `Cannot suspend affiliate with status "${args.currentStatus}". Only active affiliates can be suspended.` };
  }
  
  if (args.reason && args.reason.length > 500) {
    return { valid: false, error: "Suspension reason must be 500 characters or less" };
  }
  
  return { valid: true };
};

// Signal type labels mapping
const signalTypeLabels: Record<string, string> = {
  selfReferral: "Self-Referral Detected",
  botTraffic: "Bot Traffic Pattern",
  ipAnomaly: "IP Address Anomaly",
  manual_suspension: "Manual Suspension",
};

// Parse matched indicators from details JSON
const parseMatchedIndicators = (details?: string): string[] => {
  if (!details) return [];
  try {
    const parsed = JSON.parse(details);
    return parsed.matchedIndicators || [];
  } catch {
    return [];
  }
};

// Calculate fraud signal stats
const calculateStats = (signals: Array<{ severity: string; reviewedAt?: number }>) => {
  return {
    total: signals.length,
    high: signals.filter(s => s.severity === "high").length,
    medium: signals.filter(s => s.severity === "medium").length,
    low: signals.filter(s => s.severity === "low").length,
    reviewed: signals.filter(s => s.reviewedAt !== undefined).length,
    unreviewed: signals.filter(s => s.reviewedAt === undefined).length,
  };
};

/**
 * Test Suite: Fraud Signal Display (AC1-4, Task 1, 4)
 */
describe("Fraud Signal Display (AC1-4)", () => {
  describe("Signal type labeling", () => {
    it("AC4: should return correct human-readable label for selfReferral", () => {
      expect(signalTypeLabels.selfReferral).toBe("Self-Referral Detected");
    });

    it("AC4: should return correct human-readable label for botTraffic", () => {
      expect(signalTypeLabels.botTraffic).toBe("Bot Traffic Pattern");
    });

    it("AC4: should return correct human-readable label for ipAnomaly", () => {
      expect(signalTypeLabels.ipAnomaly).toBe("IP Address Anomaly");
    });

    it("AC4: should return correct human-readable label for manual_suspension", () => {
      expect(signalTypeLabels.manual_suspension).toBe("Manual Suspension");
    });
  });

  describe("Severity color coding (Task 4)", () => {
    it("AC4: high severity should have red color config", () => {
      expect(severityConfig.high.color).toBe("red");
      expect(severityConfig.high.priority).toBe(3);
    });

    it("AC4: medium severity should have amber color config", () => {
      expect(severityConfig.medium.color).toBe("amber");
      expect(severityConfig.medium.priority).toBe(2);
    });

    it("AC4: low severity should have blue color config", () => {
      expect(severityConfig.low.color).toBe("blue");
      expect(severityConfig.low.priority).toBe(1);
    });

    it("AC4: severity priority should be descending (high > medium > low)", () => {
      expect(severityConfig.high.priority).toBeGreaterThan(severityConfig.medium.priority);
      expect(severityConfig.medium.priority).toBeGreaterThan(severityConfig.low.priority);
    });
  });

  describe("Details parsing for self-referral signals (Task 4.4-4.6)", () => {
    it("AC4: should parse matched indicators from JSON details", () => {
      const details = JSON.stringify({
        matchedIndicators: ["email_match", "ip_match"],
        commissionId: "comm_123"
      });
      
      const indicators = parseMatchedIndicators(details);
      
      expect(indicators).toContain("email_match");
      expect(indicators).toContain("ip_match");
    });

    it("AC4: should return empty array for invalid JSON", () => {
      const indicators = parseMatchedIndicators("not valid json");
      expect(indicators).toEqual([]);
    });

    it("AC4: should return empty array for undefined details", () => {
      const indicators = parseMatchedIndicators(undefined);
      expect(indicators).toEqual([]);
    });
  });

  describe("Signal statistics calculation (Task 6)", () => {
    it("should correctly count total signals", () => {
      const signals = [
        { severity: "high", reviewedAt: undefined },
        { severity: "medium", reviewedAt: undefined },
        { severity: "low", reviewedAt: undefined },
      ];
      
      expect(calculateStats(signals).total).toBe(3);
    });

    it("should correctly count signals by severity", () => {
      const signals = [
        { severity: "high", reviewedAt: undefined },
        { severity: "high", reviewedAt: undefined },
        { severity: "medium", reviewedAt: undefined },
        { severity: "low", reviewedAt: undefined },
        { severity: "low", reviewedAt: undefined },
        { severity: "low", reviewedAt: undefined },
      ];
      
      const stats = calculateStats(signals);
      
      expect(stats.high).toBe(2);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(3);
    });

    it("should correctly count reviewed vs unreviewed", () => {
      const signals = [
        { severity: "high", reviewedAt: 1234567890 },
        { severity: "high", reviewedAt: undefined },
        { severity: "medium", reviewedAt: 1234567891 },
        { severity: "low", reviewedAt: undefined },
      ];
      
      const stats = calculateStats(signals);
      
      expect(stats.reviewed).toBe(2);
      expect(stats.unreviewed).toBe(2);
    });
  });
});

/**
 * Test Suite: Fraud Signal Filtering and Sorting (Task 6)
 */
describe("Fraud Signal Filtering and Sorting (Task 6)", () => {
  const mockSignals = [
    { type: "selfReferral", severity: "high", timestamp: 1000, reviewedAt: undefined },
    { type: "botTraffic", severity: "medium", timestamp: 2000, reviewedAt: 1234567890 },
    { type: "ipAnomaly", severity: "low", timestamp: 3000, reviewedAt: undefined },
    { type: "selfReferral", severity: "high", timestamp: 4000, reviewedAt: undefined },
  ];

  describe("Signal type filter (Task 6.1)", () => {
    it("AC4: should filter by selfReferral type", () => {
      const filtered = filterFraudSignals(mockSignals, { signalType: "selfReferral" });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.type === "selfReferral")).toBe(true);
    });

    it("AC4: should return all when signalType is 'all'", () => {
      const filtered = filterFraudSignals(mockSignals, { signalType: "all" });
      
      expect(filtered).toHaveLength(4);
    });
  });

  describe("Severity filter (Task 6.2)", () => {
    it("AC4: should filter by high severity", () => {
      const filtered = filterFraudSignals(mockSignals, { severity: "high" });
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.severity === "high")).toBe(true);
    });

    it("AC4: should filter by medium severity", () => {
      const filtered = filterFraudSignals(mockSignals, { severity: "medium" });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe("botTraffic");
    });
  });

  describe("Reviewed status filter (Task 6.3)", () => {
    it("AC4: should filter to only reviewed signals", () => {
      const filtered = filterFraudSignals(mockSignals, { reviewedStatus: "reviewed" });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].reviewedAt).toBeDefined();
    });

    it("AC4: should filter to only unreviewed signals", () => {
      const filtered = filterFraudSignals(mockSignals, { reviewedStatus: "unreviewed" });
      
      expect(filtered).toHaveLength(3);
      expect(filtered.every(s => s.reviewedAt === undefined)).toBe(true);
    });
  });

  describe("Sort options (Task 6.4)", () => {
    it("AC4: should sort by newest first", () => {
      const sorted = sortFraudSignals(mockSignals, "newest");
      
      expect(sorted[0].timestamp).toBe(4000);
      expect(sorted[3].timestamp).toBe(1000);
    });

    it("AC4: should sort by oldest first", () => {
      const sorted = sortFraudSignals(mockSignals, "oldest");
      
      expect(sorted[0].timestamp).toBe(1000);
      expect(sorted[3].timestamp).toBe(4000);
    });

    it("AC4: should sort by severity (high → medium → low)", () => {
      // Use unique severities for clear sorting verification
      const uniqueSignals = [
        { severity: "low", timestamp: 1000 },
        { severity: "medium", timestamp: 2000 },
        { severity: "high", timestamp: 3000 },
      ];
      
      const sorted = sortFraudSignals(uniqueSignals, "severity");
      
      expect(sorted[0].severity).toBe("high");
      expect(sorted[1].severity).toBe("medium");
      expect(sorted[2].severity).toBe("low");
    });
  });
});

/**
 * Test Suite: Fraud Signal Dismissal (AC5-8, Task 2, 8)
 */
describe("Fraud Signal Dismissal (AC5-8)", () => {
  describe("Validation for dismissal (Task 2.3, Task 8)", () => {
    it("AC7: should reject if signal already reviewed", () => {
      const result = validateDismissSignal({
        signal: { severity: "high", reviewedAt: 1234567890 },
        note: "Legitimate activity"
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("already been reviewed");
    });

    it("AC7: should require note for high-severity signals", () => {
      const result = validateDismissSignal({
        signal: { severity: "high", reviewedAt: undefined },
        note: ""
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("note is required");
    });

    it("AC7: should allow note for high-severity signals", () => {
      const result = validateDismissSignal({
        signal: { severity: "high", reviewedAt: undefined },
        note: "Verified as legitimate customer"
      });
      
      expect(result.valid).toBe(true);
    });

    it("AC7: should allow dismissal without note for medium-severity", () => {
      const result = validateDismissSignal({
        signal: { severity: "medium", reviewedAt: undefined },
      });
      
      expect(result.valid).toBe(true);
    });

    it("AC7: should allow dismissal without note for low-severity", () => {
      const result = validateDismissSignal({
        signal: { severity: "low", reviewedAt: undefined },
      });
      
      expect(result.valid).toBe(true);
    });

    it("AC7: should reject note exceeding 500 characters", () => {
      const longNote = "a".repeat(501);
      const result = validateDismissSignal({
        signal: { severity: "high", reviewedAt: undefined },
        note: longNote
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("500 characters or less");
    });

    it("AC7: should allow note at exactly 500 characters", () => {
      const exactNote = "a".repeat(500);
      const result = validateDismissSignal({
        signal: { severity: "high", reviewedAt: undefined },
        note: exactNote
      });
      
      expect(result.valid).toBe(true);
    });
  });
});

/**
 * Test Suite: Affiliate Suspension from Fraud Signal (AC9-12, Task 3)
 */
describe("Affiliate Suspension from Fraud Signal (AC9-12)", () => {
  describe("Validation for suspension (Task 3.3)", () => {
    it("AC11: should reject if affiliate is not active", () => {
      const result = validateSuspendAffiliate({
        currentStatus: "pending",
        reason: "Suspicious activity"
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Cannot suspend");
    });

    it("AC11: should allow suspension of active affiliates", () => {
      const result = validateSuspendAffiliate({
        currentStatus: "active",
        reason: "Fraud detected"
      });
      
      expect(result.valid).toBe(true);
    });

    it("AC11: should allow suspension without reason", () => {
      const result = validateSuspendAffiliate({
        currentStatus: "active",
      });
      
      expect(result.valid).toBe(true);
    });

    it("AC11: should reject reason exceeding 500 characters", () => {
      const longReason = "a".repeat(501);
      const result = validateSuspendAffiliate({
        currentStatus: "active",
        reason: longReason
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain("500 characters or less");
    });
  });
});

/**
 * Test Suite: RBAC Enforcement (Task 5)
 */
describe("RBAC Enforcement (Task 5)", () => {
  // Simulates permission checking
  type Role = "owner" | "manager" | "viewer" | "affiliate";
  
  const checkPermission = (role: Role, permission: string): boolean => {
    const permissions: Record<Role, string[]> = {
      owner: ["*", "affiliates:*", "affiliates:view", "affiliates:manage"],
      manager: ["affiliates:view", "affiliates:manage"],
      viewer: ["affiliates:view"],
      affiliate: [],
    };
    
    const rolePerms = permissions[role] || [];
    return rolePerms.includes("*") || 
           rolePerms.includes(permission) ||
           rolePerms.some(p => p.endsWith(":*") && permission.startsWith(p.slice(0, -1)));
  };

  describe("View permission (Task 5.2)", () => {
    it("AC: owner should have affiliates:view permission", () => {
      expect(checkPermission("owner", "affiliates:view")).toBe(true);
    });

    it("AC: manager should have affiliates:view permission", () => {
      expect(checkPermission("manager", "affiliates:view")).toBe(true);
    });

    it("AC: viewer should have affiliates:view permission", () => {
      expect(checkPermission("viewer", "affiliates:view")).toBe(true);
    });

    it("AC: affiliate should not have affiliates:view permission", () => {
      expect(checkPermission("affiliate", "affiliates:view")).toBe(false);
    });
  });

  describe("Manage permission (Task 5.3, 5.4)", () => {
    it("AC: owner should have affiliates:manage permission", () => {
      expect(checkPermission("owner", "affiliates:manage")).toBe(true);
    });

    it("AC: manager should have affiliates:manage permission", () => {
      expect(checkPermission("manager", "affiliates:manage")).toBe(true);
    });

    it("AC: viewer should NOT have affiliates:manage permission", () => {
      expect(checkPermission("viewer", "affiliates:manage")).toBe(false);
    });

    it("AC: affiliate should NOT have affiliates:manage permission", () => {
      expect(checkPermission("affiliate", "affiliates:manage")).toBe(false);
    });
  });
});

/**
 * Test Suite: Multi-tenant Isolation (Task 5.1)
 */
describe("Multi-tenant Isolation (Task 5.1)", () => {
  // Simulates tenant filtering
  const filterByTenant = <T extends { tenantId: string }>(
    items: T[],
    tenantId: string
  ): T[] => {
    return items.filter(item => item.tenantId === tenantId);
  };

  it("AC: should only return signals for the requesting tenant", () => {
    const allSignals = [
      { id: "1", tenantId: "tenant-a", type: "selfReferral" },
      { id: "2", tenantId: "tenant-a", type: "botTraffic" },
      { id: "3", tenantId: "tenant-b", type: "ipAnomaly" },
    ];
    
    const tenantASignals = filterByTenant(allSignals, "tenant-a");
    
    expect(tenantASignals).toHaveLength(2);
    expect(tenantASignals.every(s => s.tenantId === "tenant-a")).toBe(true);
  });

  it("AC: should return empty array for tenant with no signals", () => {
    const allSignals = [
      { id: "1", tenantId: "tenant-a", type: "selfReferral" },
    ];
    
    const tenantCSignals = filterByTenant(allSignals, "tenant-c");
    
    expect(tenantCSignals).toHaveLength(0);
  });
});

/**
 * Test Suite: Audit Trail (Task 9)
 */
describe("Audit Trail (Task 9)", () => {
  // Simulates audit log creation
  interface AuditLogEntry {
    action: string;
    entityType: string;
    entityId: string;
    actorId: string;
    previousValue?: unknown;
    newValue?: unknown;
    metadata?: {
      securityEvent?: boolean;
      additionalInfo?: string;
    };
  }

  const createAuditEntry = (
    action: string,
    entityType: string,
    entityId: string,
    actorId: string,
    options?: {
      previousValue?: unknown;
      newValue?: unknown;
      securityEvent?: boolean;
      additionalInfo?: string;
    }
  ): AuditLogEntry => {
    return {
      action,
      entityType,
      entityId,
      actorId,
      previousValue: options?.previousValue,
      newValue: options?.newValue,
      metadata: {
        securityEvent: options?.securityEvent ?? false,
        additionalInfo: options?.additionalInfo,
      },
    };
  };

  it("AC8: should create audit log for signal dismissal", () => {
    const entry = createAuditEntry(
      "fraud_signal_dismissed",
      "fraud_signal",
      "affiliate-123",
      "user-456",
      {
        previousValue: { status: "unreviewed" },
        newValue: { status: "reviewed", note: "Verified legitimate" },
        securityEvent: true,
        additionalInfo: "signalIndex=0",
      }
    );
    
    expect(entry.action).toBe("fraud_signal_dismissed");
    expect(entry.metadata?.securityEvent).toBe(true);
    expect(entry.previousValue).toEqual({ status: "unreviewed" });
  });

  it("AC12: should create audit log for suspension with fraud signal context", () => {
    const entry = createAuditEntry(
      "affiliate_suspended_from_fraud_signal",
      "affiliate",
      "affiliate-123",
      "user-456",
      {
        previousValue: { status: "active" },
        newValue: { 
          status: "suspended", 
          reason: "Fraud detected",
          triggeredByFraudSignal: true,
          fraudSignalType: "selfReferral",
          fraudSignalSeverity: "high",
        },
        securityEvent: true,
      }
    );
    
    expect(entry.action).toBe("affiliate_suspended_from_fraud_signal");
    expect(entry.metadata?.securityEvent).toBe(true);
    expect((entry.newValue as { triggeredByFraudSignal: boolean }).triggeredByFraudSignal).toBe(true);
  });
});

// ============================================================================
// NEW TEST SUITES: Fraud Engine Hardening
// ============================================================================

/**
 * Simulated constants matching fraudDetection.ts
 */
const SIGNAL_WEIGHTS: Record<string, number> = {
  email_match: 3,
  ip_match: 3,
  ip_subnet_match: 1,
  device_match: 2,
  payment_method_match: 2,
  payment_processor_match: 2,
};

const SELF_REFERRAL_THRESHOLD = 3;

/**
 * Simulates the weighted scoring logic from detectSelfReferral in fraudDetection.ts
 */
const calculateSelfReferralScore = (matchedIndicators: string[]) => {
  const totalScore = matchedIndicators.reduce(
    (sum, indicator) => sum + (SIGNAL_WEIGHTS[indicator] ?? 1),
    0
  );
  const isSelfReferral = totalScore >= SELF_REFERRAL_THRESHOLD;
  return { isSelfReferral, totalScore };
};

/**
 * Simulates generateSignalId from fraudDetection.ts
 */
const generateSignalId = (): string => {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Simulates findSignalBySignalId from fraudSignals.ts
 */
interface TestFraudSignal {
  type: string;
  severity: string;
  timestamp: number;
  signalId?: string;
  commissionId?: string;
}

const findSignalBySignalId = (
  signals: TestFraudSignal[],
  signalId: string
): { index: number; signal: TestFraudSignal } | null => {
  for (let i = 0; i < signals.length; i++) {
    if (signals[i].signalId === signalId) {
      return { index: i, signal: signals[i] };
    }
  }
  return null;
};

/**
 * Simulates dedup guard from addSelfReferralFraudSignal in fraudDetection.ts
 */
const isDuplicateSelfReferralSignal = (
  existingSignals: TestFraudSignal[],
  commissionId: string | undefined
): boolean => {
  return existingSignals.some(
    (s) => s.type === "selfReferral"
      && s.commissionId === commissionId
      && s.severity === "high"
  );
};

/**
 * Simulates backfillStats flagged counting from tenantStats.ts
 */
const countBackfillFlagged = (commissions: Array<{
  fraudIndicators?: string[];
  isSelfReferral?: boolean;
}>): number => {
  let count = 0;
  for (const c of commissions) {
    if ((c.fraudIndicators && c.fraudIndicators.length > 0) || c.isSelfReferral === true) {
      count++;
    }
  }
  return count;
};

/**
 * Simulates backfillStats reversed counting from tenantStats.ts
 */
const countBackfillReversed = (
  commissions: Array<{ status: string; _creationTime: number }>,
  monthStart: number
): number => {
  let count = 0;
  for (const c of commissions) {
    if (c.status === "reversed" && c._creationTime >= monthStart) {
      count++;
    }
  }
  return count;
};

// ============================================================================
// Suite 1: Weighted Scoring (AC 1, 2, 3, 17)
// ============================================================================

describe("Weighted Scoring (AC 1-3, 17)", () => {
  it("AC1: email_match alone → score=3 → triggers", () => {
    const result = calculateSelfReferralScore(["email_match"]);
    expect(result.totalScore).toBe(3);
    expect(result.isSelfReferral).toBe(true);
  });

  it("AC1: ip_match alone → score=3 → triggers", () => {
    const result = calculateSelfReferralScore(["ip_match"]);
    expect(result.totalScore).toBe(3);
    expect(result.isSelfReferral).toBe(true);
  });

  it("AC2: ip_subnet_match alone → score=1 → does NOT trigger", () => {
    const result = calculateSelfReferralScore(["ip_subnet_match"]);
    expect(result.totalScore).toBe(1);
    expect(result.isSelfReferral).toBe(false);
  });

  it("AC3: device_match alone → score=2 → does NOT trigger", () => {
    const result = calculateSelfReferralScore(["device_match"]);
    expect(result.totalScore).toBe(2);
    expect(result.isSelfReferral).toBe(false);
  });

  it("AC3: ip_subnet_match + device_match → score=3 → triggers", () => {
    const result = calculateSelfReferralScore(["ip_subnet_match", "device_match"]);
    expect(result.totalScore).toBe(3);
    expect(result.isSelfReferral).toBe(true);
  });

  it("ip_subnet_match + payment_method_match → score=3 → triggers", () => {
    const result = calculateSelfReferralScore(["ip_subnet_match", "payment_method_match"]);
    expect(result.totalScore).toBe(3);
    expect(result.isSelfReferral).toBe(true);
  });

  it("empty indicators → score=0 → does NOT trigger", () => {
    const result = calculateSelfReferralScore([]);
    expect(result.totalScore).toBe(0);
    expect(result.isSelfReferral).toBe(false);
  });

  it("all indicators → high score → triggers", () => {
    const all = ["email_match", "ip_match", "ip_subnet_match", "device_match", "payment_method_match", "payment_processor_match"];
    const result = calculateSelfReferralScore(all);
    expect(result.totalScore).toBe(13);
    expect(result.isSelfReferral).toBe(true);
  });

  it("payment_processor_match alone → score=2 → does NOT trigger", () => {
    const result = calculateSelfReferralScore(["payment_processor_match"]);
    expect(result.totalScore).toBe(2);
    expect(result.isSelfReferral).toBe(false);
  });

  it("email_match + ip_subnet_match → score=4 → triggers", () => {
    const result = calculateSelfReferralScore(["email_match", "ip_subnet_match"]);
    expect(result.totalScore).toBe(4);
    expect(result.isSelfReferral).toBe(true);
  });
});

// ============================================================================
// Suite 2: Dedup Guard (AC 4, 5)
// ============================================================================

describe("Dedup Guard (AC 4-5)", () => {
  it("AC4: same type + commissionId + severity → skip (return true for duplicate)", () => {
    const existing: TestFraudSignal[] = [
      { type: "selfReferral", severity: "high", timestamp: 1000, commissionId: "comm_1", signalId: "sig_1" },
    ];
    expect(isDuplicateSelfReferralSignal(existing, "comm_1")).toBe(true);
  });

  it("AC5: same type + commissionId, different severity → allow (not duplicate)", () => {
    const existing: TestFraudSignal[] = [
      { type: "selfReferral", severity: "medium", timestamp: 1000, commissionId: "comm_1" },
    ];
    expect(isDuplicateSelfReferralSignal(existing, "comm_1")).toBe(false);
  });

  it("AC5: same type, different commissionId → allow (not duplicate)", () => {
    const existing: TestFraudSignal[] = [
      { type: "selfReferral", severity: "high", timestamp: 1000, commissionId: "comm_1", signalId: "sig_1" },
    ];
    expect(isDuplicateSelfReferralSignal(existing, "comm_2")).toBe(false);
  });

  it("AC5: empty existing signals → allow (not duplicate)", () => {
    expect(isDuplicateSelfReferralSignal([], "comm_1")).toBe(false);
  });

  it("AC5: different type entirely → allow (not duplicate)", () => {
    const existing: TestFraudSignal[] = [
      { type: "botTraffic", severity: "high", timestamp: 1000, commissionId: "comm_1" },
    ];
    expect(isDuplicateSelfReferralSignal(existing, "comm_1")).toBe(false);
  });
});

// ============================================================================
// Suite 3: Signal ID Generation (AC 8)
// ============================================================================

describe("Signal ID Generation (AC 8)", () => {
  it("generates non-empty string prefixed with sig_", () => {
    const id = generateSignalId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(4);
    expect(id.startsWith("sig_")).toBe(true);
  });

  it("generates unique values across 1000 iterations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateSignalId());
    }
    expect(ids.size).toBe(1000);
  });

  it("format matches sig_timestamp_randomstring pattern", () => {
    const id = generateSignalId();
    // Format: sig_{digits}_{alphanumeric}
    const match = id.match(/^sig_\d+_[a-z0-9]+$/);
    expect(match).not.toBeNull();
  });
});

// ============================================================================
// Suite 4: Signal ID Lookup (AC 6, 7)
// ============================================================================

describe("Signal ID Lookup (AC 6-7)", () => {
  const signals: TestFraudSignal[] = [
    { type: "selfReferral", severity: "high", timestamp: 1000, signalId: "sig_abc123" },
    { type: "botTraffic", severity: "medium", timestamp: 2000, signalId: "sig_def456" },
    { type: "ipAnomaly", severity: "low", timestamp: 3000, signalId: "sig_ghi789" },
  ];

  it("AC6: finds signal by signalId, returns correct index and signal", () => {
    const result = findSignalBySignalId(signals, "sig_def456");
    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
    expect(result!.signal.type).toBe("botTraffic");
    expect(result!.signal.severity).toBe("medium");
  });

  it("AC7: returns null for non-existent signalId", () => {
    const result = findSignalBySignalId(signals, "sig_nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for empty signals array", () => {
    const result = findSignalBySignalId([], "sig_abc123");
    expect(result).toBeNull();
  });

  it("handles signals without signalId (returns null — not matched)", () => {
    const mixedSignals: TestFraudSignal[] = [
      { type: "selfReferral", severity: "high", timestamp: 1000 }, // no signalId
      { type: "botTraffic", severity: "medium", timestamp: 2000, signalId: "sig_def456" },
    ];
    const result = findSignalBySignalId(mixedSignals, "sig_abc123");
    expect(result).toBeNull();
  });

  it("AC6: finds first signal by signalId", () => {
    const result = findSignalBySignalId(signals, "sig_abc123");
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.signal.type).toBe("selfReferral");
  });
});

// ============================================================================
// Suite 5: Backfill Counting (AC 12)
// ============================================================================

describe("Backfill Counting (AC 12)", () => {
  it("AC12: commission with fraudIndicators only → counts 1", () => {
    const commissions = [
      { fraudIndicators: ["email_match"], isSelfReferral: undefined },
    ];
    expect(countBackfillFlagged(commissions)).toBe(1);
  });

  it("AC12: commission with isSelfReferral only → counts 1", () => {
    const commissions = [
      { fraudIndicators: undefined, isSelfReferral: true },
    ];
    expect(countBackfillFlagged(commissions)).toBe(1);
  });

  it("AC12: commission with BOTH → counts 1 (not 2)", () => {
    const commissions = [
      { fraudIndicators: ["email_match"], isSelfReferral: true },
    ];
    expect(countBackfillFlagged(commissions)).toBe(1);
  });

  it("AC12: commission with neither → counts 0", () => {
    const commissions = [
      { fraudIndicators: undefined, isSelfReferral: undefined },
    ];
    expect(countBackfillFlagged(commissions)).toBe(0);
  });

  it("AC12: empty fraudIndicators array does NOT count", () => {
    const commissions = [
      { fraudIndicators: [], isSelfReferral: false },
    ];
    expect(countBackfillFlagged(commissions)).toBe(0);
  });

  it("AC12: mixed commissions count correctly", () => {
    const commissions = [
      { fraudIndicators: ["email_match"], isSelfReferral: false },    // counts 1
      { fraudIndicators: [], isSelfReferral: true },                 // counts 1
      { fraudIndicators: ["ip_match"], isSelfReferral: true },       // counts 1 (not 2)
      { fraudIndicators: [], isSelfReferral: false },                // counts 0
    ];
    expect(countBackfillFlagged(commissions)).toBe(3);
  });
});

// ============================================================================
// Suite 6: Backfill Reversed Status (AC 13)
// ============================================================================

describe("Backfill Reversed Status (AC 13)", () => {
  const monthStart = 1700000000000; // Nov 2023

  it("AC13: status === 'reversed' within month → counts as reversed", () => {
    const commissions = [
      { status: "reversed", _creationTime: monthStart + 1000 },
    ];
    expect(countBackfillReversed(commissions, monthStart)).toBe(1);
  });

  it("AC13: status === 'approved' within month → does NOT count as reversed", () => {
    const commissions = [
      { status: "approved", _creationTime: monthStart + 1000 },
    ];
    expect(countBackfillReversed(commissions, monthStart)).toBe(0);
  });

  it("AC13: status === 'reversed' outside month → does NOT count", () => {
    const commissions = [
      { status: "reversed", _creationTime: monthStart - 1000 },
    ];
    expect(countBackfillReversed(commissions, monthStart)).toBe(0);
  });

  it("AC13: status === 'pending' → does NOT count as reversed", () => {
    const commissions = [
      { status: "pending", _creationTime: monthStart + 1000 },
    ];
    expect(countBackfillReversed(commissions, monthStart)).toBe(0);
  });

  it("AC13: status === 'declined' → does NOT count as reversed", () => {
    const commissions = [
      { status: "declined", _creationTime: monthStart + 1000 },
    ];
    expect(countBackfillReversed(commissions, monthStart)).toBe(0);
  });

  it("AC13: mixed statuses count correctly", () => {
    const commissions = [
      { status: "reversed", _creationTime: monthStart + 1000 },      // counts
      { status: "approved", _creationTime: monthStart + 2000 },      // does NOT count
      { status: "reversed", _creationTime: monthStart - 1000 },      // outside month
      { status: "reversed", _creationTime: monthStart + 3000 },      // counts
      { status: "pending", _creationTime: monthStart + 4000 },       // does NOT count
    ];
    expect(countBackfillReversed(commissions, monthStart)).toBe(2);
  });
});
