/// <reference types="vitest/globals" />
import {
  computeAffiliateSegments,
  getAgeBucket,
  formatCurrency,
  shouldShowTruncationWarning,
  type AffiliateRow,
} from "./affiliate-segments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAffiliate(overrides: Partial<AffiliateRow> & { _id: string }): AffiliateRow {
  return {
    name: "Test Affiliate",
    email: "test@example.com",
    uniqueCode: "TESTCODE",
    status: "active",
    clicks: 0,
    conversions: 0,
    conversionRate: 0,
    totalCommissions: 0,
    ...overrides,
  };
}

const MS_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// computeAffiliateSegments
// ---------------------------------------------------------------------------

describe("computeAffiliateSegments", () => {
  it("returns all zeros and empty lists for an empty array", () => {
    const result = computeAffiliateSegments([]);
    expect(result).toEqual({
      topPerformers: 0,
      risingStars: 0,
      needsAttention: 0,
      inactive: 0,
      topPerformersList: [],
      risingStarsList: [],
      needsAttentionList: [],
      inactiveList: [],
    });
  });

  // --- Top Performers -------------------------------------------------------

  it("classifies active affiliate with >= 5% conversion rate and conversions > 0 as top performer", () => {
    const affiliates = [
      makeAffiliate({
        _id: "tp1",
        clicks: 200,
        conversions: 20,
        conversionRate: 10,
        totalCommissions: 500,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.topPerformers).toBe(1);
    expect(result.topPerformersList).toHaveLength(1);
    expect(result.topPerformersList[0]._id).toBe("tp1");
  });

  it("classifies affiliate at exactly 5% threshold as top performer", () => {
    const affiliates = [
      makeAffiliate({
        _id: "tp-exact",
        clicks: 100,
        conversions: 5,
        conversionRate: 5,
        totalCommissions: 100,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.topPerformers).toBe(1);
  });

  it("does not classify affiliate with 5% rate but 0 conversions as top performer", () => {
    // conversionRate can be non-zero due to rounding while conversions is 0
    const affiliates = [
      makeAffiliate({
        _id: "no-conv",
        clicks: 100,
        conversions: 0,
        conversionRate: 5,
        totalCommissions: 0,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.topPerformers).toBe(0);
  });

  // --- Rising Stars ---------------------------------------------------------

  it("classifies active affiliate with >= 2% and < 5% rate, clicks > 0, conversions > 0 as rising star", () => {
    const affiliates = [
      makeAffiliate({
        _id: "rs1",
        clicks: 200,
        conversions: 6,
        conversionRate: 3,
        totalCommissions: 150,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.risingStars).toBe(1);
    expect(result.risingStarsList[0]._id).toBe("rs1");
  });

  it("classifies affiliate at exactly 2% threshold as rising star", () => {
    const affiliates = [
      makeAffiliate({
        _id: "rs-exact-2",
        clicks: 100,
        conversions: 2,
        conversionRate: 2,
        totalCommissions: 50,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.risingStars).toBe(1);
  });

  it("classifies affiliate just below 5% as rising star (not top performer)", () => {
    const affiliates = [
      makeAffiliate({
        _id: "rs-4.9",
        clicks: 1000,
        conversions: 49,
        conversionRate: 4.9,
        totalCommissions: 200,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.risingStars).toBe(1);
    expect(result.topPerformers).toBe(0);
  });

  // --- Needs Attention ------------------------------------------------------

  it("classifies active affiliate with > 100 clicks and < 1% conversion rate as needs attention", () => {
    const affiliates = [
      makeAffiliate({
        _id: "na1",
        clicks: 500,
        conversions: 2,
        conversionRate: 0.4,
        totalCommissions: 10,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.needsAttention).toBe(1);
    expect(result.needsAttentionList[0]._id).toBe("na1");
  });

  it("does not classify affiliate with exactly 100 clicks as needs attention (requires > 100)", () => {
    const affiliates = [
      makeAffiliate({
        _id: "na-100",
        clicks: 100,
        conversions: 0,
        conversionRate: 0,
        totalCommissions: 0,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.needsAttention).toBe(0);
    // 0 clicks here? no, clicks is 100, but rate is 0% — not > 100 clicks so not needs-attention
    // and clicks !== 0 so not inactive either → falls through to no segment
    expect(result.inactive).toBe(0);
    expect(result.topPerformers).toBe(0);
    expect(result.risingStars).toBe(0);
  });

  it("does not classify affiliate with exactly 1% rate as needs attention (requires < 1%)", () => {
    const affiliates = [
      makeAffiliate({
        _id: "na-1pct",
        clicks: 200,
        conversions: 2,
        conversionRate: 1,
        totalCommissions: 10,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.needsAttention).toBe(0);
  });

  // --- Inactive -------------------------------------------------------------

  it("classifies active affiliate with 0 clicks as inactive", () => {
    const affiliates = [
      makeAffiliate({
        _id: "in1",
        clicks: 0,
        conversions: 0,
        conversionRate: 0,
        totalCommissions: 0,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.inactive).toBe(1);
    expect(result.inactiveList[0]._id).toBe("in1");
  });

  // --- Non-active affiliates excluded ---------------------------------------

  it("excludes suspended affiliates from all segments", () => {
    const affiliates = [
      makeAffiliate({
        _id: "suspended",
        status: "suspended",
        clicks: 200,
        conversions: 20,
        conversionRate: 10,
        totalCommissions: 500,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.topPerformers).toBe(0);
    expect(result.risingStars).toBe(0);
    expect(result.needsAttention).toBe(0);
    expect(result.inactive).toBe(0);
  });

  it("excludes pending affiliates from all segments", () => {
    const affiliates = [
      makeAffiliate({
        _id: "pending",
        status: "pending",
        clicks: 0,
        conversions: 0,
        conversionRate: 0,
        totalCommissions: 0,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.inactive).toBe(0);
  });

  it("excludes rejected affiliates from all segments", () => {
    const affiliates = [
      makeAffiliate({
        _id: "rejected",
        status: "rejected",
        clicks: 500,
        conversions: 1,
        conversionRate: 0.2,
        totalCommissions: 5,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.needsAttention).toBe(0);
  });

  // --- Sorting by commissions descending within segments --------------------

  it("sorts top performers by totalCommissions descending", () => {
    const affiliates = [
      makeAffiliate({
        _id: "low",
        clicks: 200,
        conversions: 20,
        conversionRate: 10,
        totalCommissions: 100,
      }),
      makeAffiliate({
        _id: "high",
        clicks: 200,
        conversions: 20,
        conversionRate: 10,
        totalCommissions: 500,
      }),
      makeAffiliate({
        _id: "mid",
        clicks: 200,
        conversions: 20,
        conversionRate: 10,
        totalCommissions: 300,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.topPerformersList.map((a) => a._id)).toEqual(["high", "mid", "low"]);
  });

  it("sorts rising stars by totalCommissions descending", () => {
    const affiliates = [
      makeAffiliate({
        _id: "rs-low",
        clicks: 200,
        conversions: 6,
        conversionRate: 3,
        totalCommissions: 50,
      }),
      makeAffiliate({
        _id: "rs-high",
        clicks: 200,
        conversions: 6,
        conversionRate: 3,
        totalCommissions: 200,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.risingStarsList.map((a) => a._id)).toEqual(["rs-high", "rs-low"]);
  });

  it("sorts needs attention by totalCommissions descending", () => {
    const affiliates = [
      makeAffiliate({
        _id: "na-low",
        clicks: 500,
        conversions: 2,
        conversionRate: 0.4,
        totalCommissions: 5,
      }),
      makeAffiliate({
        _id: "na-high",
        clicks: 500,
        conversions: 1,
        conversionRate: 0.2,
        totalCommissions: 15,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    expect(result.needsAttentionList.map((a) => a._id)).toEqual(["na-high", "na-low"]);
  });

  // --- Mixed scenarios ------------------------------------------------------

  it("correctly classifies a mix of affiliates into separate segments", () => {
    const affiliates = [
      // Top performer
      makeAffiliate({
        _id: "tp",
        clicks: 200,
        conversions: 20,
        conversionRate: 10,
        totalCommissions: 1000,
      }),
      // Rising star
      makeAffiliate({
        _id: "rs",
        clicks: 200,
        conversions: 6,
        conversionRate: 3,
        totalCommissions: 200,
      }),
      // Needs attention
      makeAffiliate({
        _id: "na",
        clicks: 500,
        conversions: 2,
        conversionRate: 0.4,
        totalCommissions: 10,
      }),
      // Inactive
      makeAffiliate({
        _id: "ia",
        clicks: 0,
        conversions: 0,
        conversionRate: 0,
        totalCommissions: 0,
      }),
      // Suspended — excluded
      makeAffiliate({
        _id: "su",
        status: "suspended",
        clicks: 100,
        conversions: 10,
        conversionRate: 10,
        totalCommissions: 500,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);

    expect(result.topPerformers).toBe(1);
    expect(result.risingStars).toBe(1);
    expect(result.needsAttention).toBe(1);
    expect(result.inactive).toBe(1);

    expect(result.topPerformersList[0]._id).toBe("tp");
    expect(result.risingStarsList[0]._id).toBe("rs");
    expect(result.needsAttentionList[0]._id).toBe("na");
    expect(result.inactiveList[0]._id).toBe("ia");
  });

  // --- Edge: active affiliate that falls into no segment --------------------

  it("active affiliate with clicks between 1-100 and 0 conversions falls into no segment", () => {
    const affiliates = [
      makeAffiliate({
        _id: "edge",
        clicks: 50,
        conversions: 0,
        conversionRate: 0,
        totalCommissions: 0,
      }),
    ];
    const result = computeAffiliateSegments(affiliates);
    // Not inactive (clicks > 0), not needs attention (clicks <= 100)
    // Not top performer or rising star (conversions = 0)
    expect(result.inactive).toBe(0);
    expect(result.needsAttention).toBe(0);
    expect(result.topPerformers).toBe(0);
    expect(result.risingStars).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getAgeBucket
// ---------------------------------------------------------------------------

describe("getAgeBucket", () => {
  it("returns '0-7 days' for 0 days old", () => {
    const now = Date.now();
    expect(getAgeBucket(now, now)).toBe("0-7 days");
  });

  it("returns '0-7 days' for exactly 7 days", () => {
    const now = Date.now();
    const creationTime = now - 7 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("0-7 days");
  });

  it("returns '8-30 days' for 8 days old", () => {
    const now = Date.now();
    const creationTime = now - 8 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("8-30 days");
  });

  it("returns '8-30 days' for exactly 30 days", () => {
    const now = Date.now();
    const creationTime = now - 30 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("8-30 days");
  });

  it("returns '31-90 days' for 31 days old", () => {
    const now = Date.now();
    const creationTime = now - 31 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("31-90 days");
  });

  it("returns '31-90 days' for exactly 90 days", () => {
    const now = Date.now();
    const creationTime = now - 90 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("31-90 days");
  });

  it("returns '90+ days' for 91 days old", () => {
    const now = Date.now();
    const creationTime = now - 91 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("90+ days");
  });

  it("returns '90+ days' for very old entries (365 days)", () => {
    const now = Date.now();
    const creationTime = now - 365 * MS_DAY;
    expect(getAgeBucket(creationTime, now)).toBe("90+ days");
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe("formatCurrency", () => {
  it('formats 0 as "₱0.00"', () => {
    expect(formatCurrency(0)).toBe("₱0.00");
  });

  it('formats 1000 with thousands separator', () => {
    expect(formatCurrency(1000)).toBe("₱1,000.00");
  });

  it("formats large numbers with proper grouping", () => {
    expect(formatCurrency(1234567.89)).toBe("₱1,234,567.89");
  });

  it("formats small decimal values", () => {
    expect(formatCurrency(0.5)).toBe("₱0.50");
  });

  it("formats negative values with a minus sign", () => {
    const result = formatCurrency(-1234.56);
    // Intl.NumberFormat may produce "-₱1,234.56" or "₱-1,234.56" depending on locale
    expect(result).toContain("1,234.56");
    expect(result).toContain("-");
  });
});

// ---------------------------------------------------------------------------
// shouldShowTruncationWarning
// ---------------------------------------------------------------------------

describe("shouldShowTruncationWarning", () => {
  it("returns false when ratio equals threshold (80/100 at 0.8)", () => {
    expect(shouldShowTruncationWarning(80, 100)).toBe(false);
  });

  it("returns true when ratio is below threshold (79/100 at 0.8)", () => {
    expect(shouldShowTruncationWarning(79, 100)).toBe(true);
  });

  it("returns true when ratio is well below threshold (50/100 at 0.8)", () => {
    expect(shouldShowTruncationWarning(50, 100)).toBe(true);
  });

  it("returns false when ratio is above threshold (100/100 at 0.8)", () => {
    expect(shouldShowTruncationWarning(100, 100)).toBe(false);
  });

  it("returns false when totalEstimated is 0 (0/0)", () => {
    expect(shouldShowTruncationWarning(0, 0)).toBe(false);
  });

  it("returns false when totalEstimated is negative", () => {
    expect(shouldShowTruncationWarning(0, -5)).toBe(false);
  });

  it("returns false when results equal total at large scale (5000/5000)", () => {
    expect(shouldShowTruncationWarning(5000, 5000)).toBe(false);
  });

  it("returns true when ratio is below custom threshold (40/100 at 0.5)", () => {
    expect(shouldShowTruncationWarning(40, 100, 0.5)).toBe(true);
  });

  it("returns false when ratio equals custom threshold (50/100 at 0.5)", () => {
    expect(shouldShowTruncationWarning(50, 100, 0.5)).toBe(false);
  });

  it("returns false when ratio exceeds custom threshold (60/100 at 0.5)", () => {
    expect(shouldShowTruncationWarning(60, 100, 0.5)).toBe(false);
  });
});
