/**
 * Simple credential obfuscation for SaligPay tokens
 * 
 * This provides basic obfuscation for stored credentials.
 * For production, use proper encryption with environment-configured keys.
 * 
 * Note: Uses a simple reversible encoding for development.
 * In production, this should be replaced with proper AES-256-GCM encryption.
 */

// Simple XOR-based obfuscation with base64 encoding
// NOT secure for production - use proper encryption in Story 14.5
const OBFUSCATION_KEY = "salig-affiliate-dev-key-2024";

function xorEncode(text: string, key: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Obfuscate a string (simple encoding, not true encryption)
 */
export function obfuscate(plaintext: string): string {
  if (!plaintext) {
    return "";
  }
  
  const encoded = xorEncode(plaintext, OBFUSCATION_KEY);
  return btoa(encoded);
}

/**
 * De-obfuscate a string
 */
export function deobfuscate(obfuscatedText: string): string {
  if (!obfuscatedText) {
    return "";
  }
  
  try {
    const decoded = atob(obfuscatedText);
    return xorEncode(decoded, OBFUSCATION_KEY);
  } catch {
    // If decoding fails, return empty string
    return "";
  }
}
