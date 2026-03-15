import { typedV } from "convex-helpers/validators";
import schema from "./schema";

export const requireEnv = (name: string) => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing environment variable \`${name}\``);
  }
  return value;
};

export const vv = typedV(schema);

/**
 * Generate a device fingerprint from browser characteristics.
 * Used for self-referral detection (Story 5.6).
 * 
 * This is a simple hash-based fingerprint. In production, you might want to use
 * a more sophisticated library like FingerprintJS.
 */
export function generateDeviceFingerprint(data: {
  userAgent?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
}): string {
  // Combine all available data
  const fingerprintData = [
    data.userAgent || "",
    data.screenResolution || "",
    data.timezone || "",
    data.language || "",
    data.platform || "",
  ].join("|");

  // Simple hash function (DJB2 variant)
  let hash = 5381;
  for (let i = 0; i < fingerprintData.length; i++) {
    hash = ((hash << 5) + hash) + fingerprintData.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(16);
}

/**
 * Parse payment method details to extract last 4 digits and processor ID.
 * Used for self-referral detection (Story 5.6).
 */
export function parsePaymentMethodDetails(details: string): {
  lastDigits?: string;
  processorId?: string;
} {
  // Try to extract last 4 digits (common format: ****1234 or ••••1234)
  const lastDigitsMatch = details.match(/(?:[*•·]+\s*|ending\s*(?:in\s*)?)([\d]{4})/i);
  const lastDigits = lastDigitsMatch ? lastDigitsMatch[1] : undefined;
  
  // Try to extract processor ID (e.g., "PayPal", "stripe_acc_xxx")
  const processorMatch = details.match(/(paypal|stripe|square|checkout\.com|razorpay)/i);
  const processorId = processorMatch ? processorMatch[1].toLowerCase() : undefined;
  
  return {
    lastDigits,
    processorId,
  };
}
