/**
 * Encryption utilities for sensitive credential storage
 * 
 * Uses Node.js crypto module for AES-256-GCM encryption.
 * In production, the encryption key should be set via ENCRYPTION_KEY environment variable.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM authentication tag
const SALT_LENGTH = 32; // 32 bytes for salt
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Get the encryption key from environment or derive a warning key for development
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (key) {
    // Use the provided key (must be 64 hex characters = 32 bytes)
    if (key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    return Buffer.from(key, 'hex');
  }
  
  // Development fallback - use a deterministic key based on app secret
  // WARNING: This is NOT secure for production!
  const appSecret = process.env.AUTH_SECRET || 'dev-secret-change-in-production';
  const salt = crypto.createHash('sha256').update('salig-affiliate-encryption').digest();
  return crypto.pbkdf2Sync(appSecret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext string
 * 
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: base64(salt:iv:authTag:ciphertext)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive a key using the salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
  
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypt an encrypted string
 * 
 * @param encryptedText - The encrypted string in base64 format
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return '';
  }
  
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Derive the same key using the salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. The encryption key may be incorrect.');
  }
}

/**
 * Hash a value for comparison (one-way)
 * Useful for storing values that don't need to be retrieved but need to be compared
 * 
 * @param value - The value to hash
 * @returns Hashed string
 */
export function hash(value: string): string {
  if (!value) {
    return '';
  }
  
  const key = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const hash = crypto.pbkdf2Sync(value, salt, 100000, KEY_LENGTH, 'sha256');
  
  // Combine salt and hash
  const combined = Buffer.concat([salt, hash]);
  return combined.toString('base64');
}

/**
 * Verify a hashed value
 * 
 * @param value - The value to verify
 * @param hashedValue - The hashed value to compare against
 * @returns True if the value matches
 */
export function verify(value: string, hashedValue: string): boolean {
  if (!value || !hashedValue) {
    return false;
  }
  
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(hashedValue, 'base64');
    
    const salt = combined.subarray(0, SALT_LENGTH);
    const storedHash = combined.subarray(SALT_LENGTH);
    
    const hash = crypto.pbkdf2Sync(value, salt, 100000, KEY_LENGTH, 'sha256');
    
    return crypto.timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}

/**
 * Generate a random token for OAuth state parameter
 * 
 * @param length - Optional length (default: 32)
 * @returns Random token string
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}
