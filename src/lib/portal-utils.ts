/**
 * Shared portal utility functions.
 * Extracted from WelcomeBanner.tsx and EarningsHero.tsx to eliminate duplication.
 */

/**
 * Adjust a hex color's brightness by a fixed amount.
 * Positive values lighten, negative values darken.
 *
 * @param hex - Hex color string (e.g., "#1c2260")
 * @param amount - Amount to adjust per channel (-255 to 255)
 * @returns Adjusted hex color string
 */
export function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Darken a hex color by a percentage (0–1).
 *
 * @param hex - Hex color string (e.g., "#1c2260")
 * @param amount - Fraction to darken (0 = no change, 0.3 = 30% darker)
 * @returns Darkened hex color string
 */
export function darkenColor(hex: string, amount: number = 0.3): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.max(0, Math.round(parseInt(result[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(result[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(result[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Determine whether light or dark text is more readable on a given hex background.
 *
 * @param hex - Hex color string
 * @returns "#ffffff" for dark backgrounds, "#0a1628" for light backgrounds
 */
export function getContrastColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "#ffffff";
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#0a1628" : "#ffffff";
}

/**
 * Get the portal display name with a consistent fallback.
 *
 * @param portalName - Optional portal name from tenant branding
 * @returns The provided name or "Affiliate Portal" as default
 */
export function getPortalName(portalName?: string): string {
  return portalName || "Affiliate Portal";
}
