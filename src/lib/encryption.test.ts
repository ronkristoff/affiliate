import { describe, it, expect, beforeEach } from "vitest";
import { encrypt, decrypt, generateToken, hash, verify } from "./encryption";

describe("Encryption Utilities", () => {
  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt a string correctly", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
      
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt different values to different outputs", () => {
      const encrypted1 = encrypt("value1");
      const encrypted2 = encrypt("value2");
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should handle empty strings", () => {
      expect(encrypt("")).toBe("");
      expect(decrypt("")).toBe("");
    });

    it("should handle special characters", () => {
      const plaintext = "Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", () => {
      const plaintext = "Unicode: 你好世界 🌍 émojis 🎉";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", () => {
      const plaintext = "x".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("generateToken", () => {
    it("should generate tokens of default length", () => {
      const token = generateToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);
    });

    it("should generate unique tokens", () => {
      const token1 = generateToken();
      const token2 = generateToken();
      
      expect(token1).not.toBe(token2);
    });

    it("should generate tokens of specified length", () => {
      const token = generateToken(64);
      // base64url encoding: roughly 4/3 of the byte length
      expect(token.length).toBeGreaterThanOrEqual(80);
    });
  });

  describe("hash/verify", () => {
    it("should hash a value and verify it correctly", () => {
      const value = "my-secret-value";
      const hashed = hash(value);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(value);
      
      expect(verify(value, hashed)).toBe(true);
    });

    it("should return false for incorrect values", () => {
      const value = "correct-value";
      const wrongValue = "wrong-value";
      const hashed = hash(value);
      
      expect(verify(wrongValue, hashed)).toBe(false);
    });

    it("should handle empty values", () => {
      expect(hash("")).toBe("");
      expect(verify("", hash(""))).toBe(false); // Empty hash won't match
    });

    it("should produce different hashes for same value (due to salt)", () => {
      const value = "same-value";
      const hash1 = hash(value);
      const hash2 = hash(value);
      
      // Hashes should be different due to random salt
      expect(hash1).not.toBe(hash2);
      
      // But both should verify the original value
      expect(verify(value, hash1)).toBe(true);
      expect(verify(value, hash2)).toBe(true);
    });
  });
});
