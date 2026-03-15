/**
 * Referral Link Utilities
 * 
 * Shared utility functions for URL formatting and referral link generation.
 * Used by both frontend and backend for consistent URL generation.
 * 
 * Story 6.1: Referral Link Generation
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
 * Validate vanity slug format.
 * Alphanumeric, hyphens, underscores only. Length: 3-50 characters.
 */
export function isValidVanitySlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

/**
 * Build short URL format: https://{domain}/ref/{code}
 */
export function buildShortUrl(domain: string, code: string): string {
  return `https://${domain}/ref/${code}`;
}

/**
 * Build full URL format: https://{domain}/ref/{code}?ref={affiliate-name}
 */
export function buildFullUrl(domain: string, code: string, affiliateName: string): string {
  const encodedName = encodeURIComponent(affiliateName.toLowerCase().replace(/\s+/g, "-"));
  return `https://${domain}/ref/${code}?ref=${encodedName}`;
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
 * Build vanity URL format: https://{domain}/ref/{vanity-slug}
 */
export function buildVanityUrl(domain: string, vanitySlug: string): string {
  return `https://${domain}/ref/${vanitySlug}`;
}

/**
 * Build all URL formats for a referral link.
 */
export interface ReferralUrlSet {
  shortUrl: string;
  fullUrl: string;
  campaignUrl?: string;
  utmUrl?: string;
  vanityUrl?: string;
}

/**
 * Generate all URL formats for a referral link.
 */
export function buildAllUrls(
  domain: string,
  code: string,
  affiliateName: string,
  options?: {
    campaignSlug?: string;
    utmSource?: string;
    vanitySlug?: string;
  }
): ReferralUrlSet {
  const urls: ReferralUrlSet = {
    shortUrl: buildShortUrl(domain, code),
    fullUrl: buildFullUrl(domain, code, affiliateName),
  };

  if (options?.campaignSlug) {
    urls.campaignUrl = buildCampaignUrl(domain, code, options.campaignSlug);
  }

  if (options?.utmSource) {
    urls.utmUrl = buildUtmUrl(domain, code, options.utmSource);
  }

  if (options?.vanitySlug) {
    urls.vanityUrl = buildVanityUrl(domain, options.vanitySlug);
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
 * Extract vanity slug from a URL path.
 * Supports formats: /ref/{slug}, /ref/{slug}?...
 */
export function extractVanitySlug(urlPath: string): string | null {
  const match = urlPath.match(/\/ref\/([a-z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Check if a string looks like a referral code (8 alphanumeric chars).
 */
export function isReferralCode(value: string): boolean {
  return /^[A-Z0-9]{8}$/.test(value.toUpperCase());
}

/**
 * Get domain for tenant.
 * Falls back to default domain if no custom slug is configured.
 */
export function getTenantDomain(slug?: string | null): string {
  if (slug) {
    return `${slug}.saligaffiliate.com`;
  }
  return "app.saligaffiliate.com";
}
