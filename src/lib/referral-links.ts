/**
 * Referral Link Utilities
 * 
 * Shared utility functions for URL formatting and referral link generation.
 * Used by both frontend and backend for consistent URL generation.
 * 
 * Story 6.1: Referral Link Generation
 * Updated: Tenant Domain Rework - Removed subdomain, Full, Vanity URL formats
 */

/**
 * Generate a unique referral code.
 * Format: 8-character alphanumeric code (excludes confusing characters: 0, O, I, 1).
 */
export function generateUniqueReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Build short URL format: https://{domain}/ref/{code}
 */
export function buildShortUrl(domain: string, code: string): string {
  return `https://${domain}/ref/${code}`;
}

/**
 * Build campaign URL format: https://{domain}/ref/{code}?campaign={campaign-slug}
 */
export function buildCampaignUrl(domain: string, code: string, campaignSlug: string): string {
  return `https://${domain}/ref/${code}?campaign=${encodeURIComponent(campaignSlug)}`;
}

/**
 * Build UTM URL format: https://{domain}/ref/{code}?utm_source={source}
 */
export function buildUtmUrl(domain: string, code: string, utmSource: string): string {
  return `https://${domain}/ref/${code}?utm_source=${encodeURIComponent(utmSource)}`;
}

/**
 * Build all URL formats for a referral link.
 */
export interface ReferralUrlSet {
  shortUrl: string;
  campaignUrl?: string;
  utmUrl?: string;
}

/**
 * Generate all URL formats for a referral link.
 */
export function buildAllUrls(
  domain: string,
  code: string,
  options?: {
    campaignSlug?: string;
    utmSource?: string;
  }
): ReferralUrlSet {
  const urls: ReferralUrlSet = {
    shortUrl: buildShortUrl(domain, code),
  };

  if (options?.campaignSlug) {
    urls.campaignUrl = buildCampaignUrl(domain, code, options.campaignSlug);
  }

  if (options?.utmSource) {
    urls.utmUrl = buildUtmUrl(domain, code, options.utmSource);
  }

  return urls;
}

/**
 * Extract referral code from a URL path.
 * Supports formats: /ref/{code}, /ref/{code}?...
 */
export function extractReferralCode(urlPath: string): string | null {
  const match = urlPath.match(/\/ref\/([A-Z0-9]+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Check if a string looks like a referral code (8 alphanumeric chars).
 */
export function isReferralCode(value: string): boolean {
  return /^[A-Z0-9]{8}$/.test(value.toUpperCase());
}

/**
 * Get domain for tenant.
 * Returns the tenant's verified domain for building referral URLs.
 */
export function getTenantDomain(tenant: { domain: string }): string {
  return tenant.domain;
}
