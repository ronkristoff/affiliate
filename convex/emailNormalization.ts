/**
 * Email Normalization Utility
 *
 * Normalizes email addresses for consistent lead matching.
 * Handles Gmail-specific normalization (dots, plus aliases, googlemail.com).
 * Pure function — no DB access. Static import safe for mutations/queries.
 */

/**
 * Normalize an email address for consistent lead matching.
 *
 * Rules:
 * 1. Lowercase the entire email
 * 2. If domain is gmail.com or googlemail.com:
 *    - Normalize domain to gmail.com
 *    - Remove dots from local part
 *    - Strip + aliases (everything from + to @)
 * 3. All other domains: lowercase only
 *
 * @param email - Raw email address
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return email;
  }

  const lower = email.toLowerCase().trim();
  const atIndex = lower.indexOf("@");
  if (atIndex === -1) {
    return lower;
  }

  const localPart = lower.slice(0, atIndex);
  const domain = lower.slice(atIndex + 1);

  // Gmail normalization
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Remove dots from local part and strip + aliases
    const normalizedLocal = localPart.replace(/\./g, "").replace(/\+.*$/, "");
    return `${normalizedLocal}@gmail.com`;
  }

  // All other domains: lowercase only
  return lower;
}
