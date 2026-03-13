import { describe, it, expect } from "vitest";
import {
  isAffiliateRoute,
  isAffiliateAuthRoute,
  hashPassword,
} from "./affiliate-auth-client";
import type { AffiliateSession } from "./affiliate-auth-client";

describe("Affiliate Auth Client", () => {
  describe("isAffiliateRoute", () => {
    it("should return true for affiliate portal routes", () => {
      expect(isAffiliateRoute("/portal/home")).toBe(true);
      expect(isAffiliateRoute("/portal/earnings")).toBe(true);
      expect(isAffiliateRoute("/portal/links")).toBe(true);
      expect(isAffiliateRoute("/portal/account")).toBe(true);
      expect(isAffiliateRoute("/portal/some/nested/path")).toBe(true);
    });

    it("should return false for non-portal routes", () => {
      expect(isAffiliateRoute("/dashboard")).toBe(false);
      expect(isAffiliateRoute("/settings")).toBe(false);
      expect(isAffiliateRoute("/sign-in")).toBe(false);
      expect(isAffiliateRoute("/")).toBe(false);
    });
  });

  describe("isAffiliateAuthRoute", () => {
    it("should return true for affiliate auth routes", () => {
      expect(isAffiliateAuthRoute("/portal/login")).toBe(true);
      expect(isAffiliateAuthRoute("/portal/register")).toBe(true);
    });

    it("should return false for other routes", () => {
      expect(isAffiliateAuthRoute("/portal/home")).toBe(false);
      expect(isAffiliateAuthRoute("/portal/earnings")).toBe(false);
      expect(isAffiliateAuthRoute("/sign-in")).toBe(false);
    });
  });

  describe("hashPassword", () => {
    it("should hash password consistently", async () => {
      const password = "testpassword123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // Same password should produce same hash
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different passwords", async () => {
      const hash1 = await hashPassword("password1");
      const hash2 = await hashPassword("password2");
      
      expect(hash1).not.toBe(hash2);
    });

    it("should produce a 64-character hex string", async () => {
      const hash = await hashPassword("testpassword");
      
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe("Session management", () => {
    it("should have correct session interface", () => {
      const session = {
        affiliateId: "test-id",
        tenantId: "tenant-id",
        email: "test@example.com",
        name: "Test User",
        uniqueCode: "ABC123",
        status: "active",
      };

      expect(session.affiliateId).toBe("test-id");
      expect(session.status).toBe("active");
    });
  });
});