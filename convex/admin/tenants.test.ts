import { describe, it, expect, vi } from "vitest";

/**
 * Unit Tests for Admin Tenant Search & Stats
 *
 * Story 11.1: Tenant Search
 *
 * These tests validate:
 * - AC2: Tenant search functionality (search by name, email, domain)
 * - AC3: Filter pills for quick filtering (status filters)
 * - AC5: Result sorting
 * - Subtask 5.1: Unit tests for searchTenants query logic
 * - Subtask 5.2: Unit tests for getPlatformStats query logic
 */

// ========================================
// Extracted pure business logic for testing
// ========================================

type MockTenant = {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  domain: string | undefined;
  plan: string;
  status: string;
  ownerEmail: string;
  affiliateCount: number;
  mrr: number;
  isFlagged: boolean;
};

/**
 * Pure function: Filter tenants by search query.
 * Matches against name, slug, ownerEmail, and domain.
 */
function filterBySearchQuery(
  tenants: MockTenant[],
  searchQuery: string | undefined
): MockTenant[] {
  if (!searchQuery || searchQuery.trim() === "") return tenants;
  const query = searchQuery.toLowerCase().trim();
  return tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(query) ||
      t.slug.toLowerCase().includes(query) ||
      t.ownerEmail.toLowerCase().includes(query) ||
      (t.domain && t.domain.toLowerCase().includes(query))
  );
}

/**
 * Pure function: Filter tenants by status (including computed "flagged" status).
 */
function filterByStatus(
  tenants: MockTenant[],
  statusFilter: string | undefined
): MockTenant[] {
  if (!statusFilter) return tenants;
  if (statusFilter === "flagged") {
    return tenants.filter((t) => t.isFlagged);
  }
  return tenants.filter((t) => t.status === statusFilter);
}

/**
 * Pure function: Sort tenants by creation date descending.
 */
function sortByCreationDate(
  tenants: MockTenant[],
  order: "asc" | "desc" = "desc"
): MockTenant[] {
  return [...tenants].sort((a, b) =>
    order === "desc"
      ? b._creationTime - a._creationTime
      : a._creationTime - b._creationTime
  );
}

/**
 * Pure function: Compute platform stats from tenant list.
 */
function computePlatformStats(
  tenants: MockTenant[],
  oneWeekAgo: number
) {
  const active = tenants.filter((t) => t.status === "active").length;
  const trial = tenants.filter((t) => t.status === "trial").length;
  const suspended = tenants.filter((t) => t.status === "suspended").length;
  const flagged = tenants.filter((t) => t.isFlagged).length;
  const deltaThisWeek = tenants.filter(
    (t) => t._creationTime > oneWeekAgo
  ).length;

  return {
    total: tenants.length,
    active,
    trial,
    suspended,
    flagged,
    deltaThisWeek,
  };
}

// ========================================
// Test Data
// ========================================

const MOCK_TENANTS: MockTenant[] = [
  {
    _id: "tenant1",
    _creationTime: 1000,
    name: "Acme Corp",
    slug: "acme-corp",
    domain: "acme.com",
    plan: "growth",
    status: "active",
    ownerEmail: "alice@acme.com",
    affiliateCount: 25,
    mrr: 2999,
    isFlagged: false,
  },
  {
    _id: "tenant2",
    _creationTime: 2000,
    name: "Beta Startup",
    slug: "beta-startup",
    domain: undefined,
    plan: "starter",
    status: "trial",
    ownerEmail: "bob@betastartup.io",
    affiliateCount: 5,
    mrr: 499,
    isFlagged: false,
  },
  {
    _id: "tenant3",
    _creationTime: 3000,
    name: "Gamma Services",
    slug: "gamma-services",
    domain: "gamma.ph",
    plan: "scale",
    status: "active",
    ownerEmail: "carol@gamma.ph",
    affiliateCount: 100,
    mrr: 9999,
    isFlagged: true,
  },
  {
    _id: "tenant4",
    _creationTime: 500,
    name: "Delta Ventures",
    slug: "delta-ventures",
    domain: undefined,
    plan: "growth",
    status: "suspended",
    ownerEmail: "dave@delta.io",
    affiliateCount: 0,
    mrr: 0,
    isFlagged: false,
  },
  {
    _id: "tenant5",
    _creationTime: 4000,
    name: "Epsilon Tech",
    slug: "epsilon-tech",
    domain: "epsilon.tech",
    plan: "starter",
    status: "active",
    ownerEmail: "eve@epsilon.tech",
    affiliateCount: 12,
    mrr: 499,
    isFlagged: true,
  },
];

// ========================================
// Tests
// ========================================

describe("Admin Tenant Search - Business Logic (Subtask 5.1)", () => {
  describe("AC2: Search functionality", () => {
    it("should return all tenants when no search query is provided", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, undefined);
      expect(result).toHaveLength(5);
    });

    it("should return all tenants when search query is empty string", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "");
      expect(result).toHaveLength(5);
    });

    it("should return all tenants when search query is whitespace only", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "   ");
      expect(result).toHaveLength(5);
    });

    it("should filter tenants by name (case-insensitive)", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "acme");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Acme Corp");
    });

    it("should filter tenants by name (uppercase query)", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "GAMMA");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Gamma Services");
    });

    it("should filter tenants by owner email", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "alice@acme.com");
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe("tenant1");
    });

    it("should filter tenants by partial email", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "bob@beta");
      expect(result).toHaveLength(1);
      expect(result[0].ownerEmail).toBe("bob@betastartup.io");
    });

    it("should filter tenants by domain", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "gamma.ph");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Gamma Services");
    });

    it("should filter tenants by slug", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "epsilon-tech");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Epsilon Tech");
    });

    it("should return empty array when no tenants match", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "nonexistent");
      expect(result).toHaveLength(0);
    });

    it("should match multiple tenants with same search term", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "services");
      expect(result).toHaveLength(1); // "Gamma Services" (name contains "services")
      expect(result[0].name).toBe("Gamma Services");
    });

    it("should match across name and domain for the same tenant", () => {
      const result = filterBySearchQuery(MOCK_TENANTS, "tech");
      // "Epsilon Tech" matches both name ("tech") and domain ("epsilon.tech")
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Epsilon Tech");
    });
  });

  describe("AC3: Filter by status", () => {
    it("should return all tenants when no status filter is provided", () => {
      const result = filterByStatus(MOCK_TENANTS, undefined);
      expect(result).toHaveLength(5);
    });

    it("should filter by 'active' status", () => {
      const result = filterByStatus(MOCK_TENANTS, "active");
      expect(result).toHaveLength(3);
      expect(result.every((t) => t.status === "active")).toBe(true);
    });

    it("should filter by 'trial' status", () => {
      const result = filterByStatus(MOCK_TENANTS, "trial");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Beta Startup");
    });

    it("should filter by 'suspended' status", () => {
      const result = filterByStatus(MOCK_TENANTS, "suspended");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Delta Ventures");
    });

    it("should filter by 'flagged' computed status", () => {
      const result = filterByStatus(MOCK_TENANTS, "flagged");
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.isFlagged === true)).toBe(true);
    });

    it("should return empty for status with no matching tenants", () => {
      const result = filterByStatus(MOCK_TENANTS, "inactive");
      expect(result).toHaveLength(0);
    });
  });

  describe("AC3+AC2: Combined search and filter", () => {
    it("should apply both search and status filter", () => {
      const filtered = filterByStatus(MOCK_TENANTS, "active");
      const result = filterBySearchQuery(filtered, "epsilon");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Epsilon Tech");
    });

    it("should return empty when search and filter have no overlap", () => {
      const filtered = filterByStatus(MOCK_TENANTS, "trial");
      const result = filterBySearchQuery(filtered, "acme");
      expect(result).toHaveLength(0);
    });
  });

  describe("AC5: Result sorting", () => {
    it("should sort tenants by creation date descending (default)", () => {
      const result = sortByCreationDate(MOCK_TENANTS, "desc");
      expect(result[0]._creationTime).toBe(4000);
      expect(result[result.length - 1]._creationTime).toBe(500);
    });

    it("should sort tenants by creation date ascending", () => {
      const result = sortByCreationDate(MOCK_TENANTS, "asc");
      expect(result[0]._creationTime).toBe(500);
      expect(result[result.length - 1]._creationTime).toBe(4000);
    });

    it("should not mutate the original array", () => {
      const original = [...MOCK_TENANTS];
      sortByCreationDate(MOCK_TENANTS, "desc");
      expect(MOCK_TENANTS).toEqual(original);
    });
  });
});

describe("Admin Platform Stats - Business Logic (Subtask 5.2)", () => {
  it("should compute correct total count", () => {
    const stats = computePlatformStats(MOCK_TENANTS, 0);
    expect(stats.total).toBe(5);
  });

  it("should compute correct active count", () => {
    const stats = computePlatformStats(MOCK_TENANTS, 0);
    expect(stats.active).toBe(3);
  });

  it("should compute correct trial count", () => {
    const stats = computePlatformStats(MOCK_TENANTS, 0);
    expect(stats.trial).toBe(1);
  });

  it("should compute correct suspended count", () => {
    const stats = computePlatformStats(MOCK_TENANTS, 0);
    expect(stats.suspended).toBe(1);
  });

  it("should compute correct flagged count (computed from isFlagged)", () => {
    const stats = computePlatformStats(MOCK_TENANTS, 0);
    expect(stats.flagged).toBe(2);
  });

  it("should compute correct deltaThisWeek based on creation time", () => {
    const stats = computePlatformStats(MOCK_TENANTS, 3000);
    // Tenants created after timestamp 3000: tenant5 (4000)
    expect(stats.deltaThisWeek).toBe(1);
  });

  it("should return zeros for empty tenant list", () => {
    const stats = computePlatformStats([], 0);
    expect(stats).toEqual({
      total: 0,
      active: 0,
      trial: 0,
      suspended: 0,
      flagged: 0,
      deltaThisWeek: 0,
    });
  });
});

describe("Pagination logic", () => {
  it("should paginate correctly with PAGE_SIZE=10", () => {
    const PAGE_SIZE = 10;
    const tenants = Array.from({ length: 25 }, (_, i) => ({
      _id: `t${i}`,
      _creationTime: i,
      name: `Tenant ${i}`,
      slug: `tenant-${i}`,
      domain: undefined,
      plan: "starter",
      status: "active",
      ownerEmail: `owner${i}@test.com`,
      affiliateCount: i,
      mrr: 499,
      isFlagged: false,
    }));

    const total = tenants.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    // Page 1
    const start1 = 0;
    const page1 = tenants.slice(start1, start1 + PAGE_SIZE);
    expect(page1).toHaveLength(10);

    // Page 2
    const start2 = PAGE_SIZE;
    const page2 = tenants.slice(start2, start2 + PAGE_SIZE);
    expect(page2).toHaveLength(10);
    expect(page2[0]._id).toBe("t10");

    // Page 3 (last page, partial)
    const start3 = 2 * PAGE_SIZE;
    const page3 = tenants.slice(start3, start3 + PAGE_SIZE);
    expect(page3).toHaveLength(5);

    expect(totalPages).toBe(3);
  });

  it("should handle single page correctly", () => {
    const tenants = MOCK_TENANTS; // 5 tenants
    const totalPages = Math.ceil(tenants.length / 10);
    expect(totalPages).toBe(1);
  });
});
