/**
 * Shared formatting utilities for the application.
 * Extracted from PayoutsClient.tsx for reuse across components.
 */

/**
 * Format a number as Philippine Peso currency with full precision.
 * @param amount - The amount to format
 * @param currency - The currency code (default: PHP)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as Philippine Peso currency with compact display (no decimals).
 * @param amount - The amount to format
 * @param currency - The currency code (default: PHP)
 * @returns Formatted compact currency string
 */
export function formatCurrencyCompact(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a timestamp as a human-readable date string.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

/**
 * Format a timestamp as a detailed date-time string.
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date-time string (e.g., "Jan 15, 2024, 2:30 PM")
 */
export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

/**
 * Format a number as a compact string without currency symbol.
 * E.g., 1200 → "1.2K", 3500000 → "3.5M", 500 → "500"
 * @param n - The number to format
 * @returns Compact number string
 */
export function formatNumberCompact(n: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Get initials from a name (first letter of first two words).
 * @param name - The full name
 * @returns Uppercase initials (max 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a timestamp as a relative time string (e.g., "2h ago", "3d ago").
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return formatDate(timestamp);
}
