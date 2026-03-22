// Pure function for computing affiliate segments from table data.
// Segments are computed client-side to prevent count divergence with table totals.

export interface AffiliateRow {
  _id: string;
  name: string;
  email: string;
  uniqueCode: string;
  status: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalCommissions: number;
}

export interface SegmentSummary {
  topPerformers: number;
  risingStars: number;
  needsAttention: number;
  inactive: number;
  topPerformersList: AffiliateRow[];
  risingStarsList: AffiliateRow[];
  needsAttentionList: AffiliateRow[];
  inactiveList: AffiliateRow[];
}

const CONVERSION_RATE_TOP = 5; // >= 5%
const CONVERSION_RATE_RISING = 2; // >= 2% and < 5%
const CONVERSION_RATE_LOW = 1; // < 1%
const MIN_CLICKS_FOR_LOW_RATE = 100; // Needs at least 100 clicks to be flagged

export function computeAffiliateSegments(affiliates: AffiliateRow[]): SegmentSummary {
  const topPerformersList: AffiliateRow[] = [];
  const risingStarsList: AffiliateRow[] = [];
  const needsAttentionList: AffiliateRow[] = [];
  const inactiveList: AffiliateRow[] = [];

  for (const affiliate of affiliates) {
    // Only classify active affiliates
    if (affiliate.status !== "active") continue;

    const { clicks, conversions, conversionRate } = affiliate;

    // Top Performers: active + conversions > 0 + conversionRate >= 5%
    if (conversions > 0 && conversionRate >= CONVERSION_RATE_TOP) {
      topPerformersList.push(affiliate);
      continue;
    }

    // Rising Stars: active + clicks > 0 + conversionRate >= 2% and < 5% + conversions > 0
    if (
      clicks > 0 &&
      conversionRate >= CONVERSION_RATE_RISING &&
      conversionRate < CONVERSION_RATE_TOP &&
      conversions > 0
    ) {
      risingStarsList.push(affiliate);
      continue;
    }

    // Needs Attention: active + clicks > 100 + conversionRate < 1%
    if (clicks > MIN_CLICKS_FOR_LOW_RATE && conversionRate < CONVERSION_RATE_LOW) {
      needsAttentionList.push(affiliate);
      continue;
    }

    // Inactive: active + clicks = 0
    if (clicks === 0) {
      inactiveList.push(affiliate);
      continue;
    }
  }

  // Sort each segment by commissions descending
  const sortByCommissions = (a: AffiliateRow, b: AffiliateRow) => b.totalCommissions - a.totalCommissions;
  topPerformersList.sort(sortByCommissions);
  risingStarsList.sort(sortByCommissions);
  needsAttentionList.sort(sortByCommissions);

  return {
    topPerformers: topPerformersList.length,
    risingStars: risingStarsList.length,
    needsAttention: needsAttentionList.length,
    inactive: inactiveList.length,
    topPerformersList,
    risingStarsList,
    needsAttentionList,
    inactiveList,
  };
}

// Pure function for aging bucket calculation
export function getAgeBucket(creationTime: number, now: number): string {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  const age = now - creationTime;

  if (age <= SEVEN_DAYS) return "0-7 days";
  if (age <= THIRTY_DAYS) return "8-30 days";
  if (age <= NINETY_DAYS) return "31-90 days";
  return "90+ days";
}

// Currency formatting helper (Philippine Peso)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

// Truncation warning threshold check
export function shouldShowTruncationWarning(
  resultsLength: number,
  totalEstimated: number,
  threshold: number = 0.8
): boolean {
  if (totalEstimated <= 0) return false;
  return resultsLength / totalEstimated < threshold;
}
