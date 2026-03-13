import { describe, it, expect } from "vitest";
import { hasPermission, getRolePermissions, isOwner, isManager, isViewer, ROLE_PERMISSIONS, buildPermission } from "./permissions";
import type { Role } from "./permissions";

// Import the permissionMatches function for testing (not exported, but we can test through hasPermission)
// This tests the internal logic indirectly

describe("Permissions", () => {
  describe("hasPermission", () => {
    it("should return true for owner with any permission", () => {
      expect(hasPermission("owner", "manage:*")).toBe(true);
      expect(hasPermission("owner", "campaigns:create")).toBe(true);
      expect(hasPermission("owner", "view:*")).toBe(true);
    });

    it("should return true for manager with allowed permissions", () => {
      expect(hasPermission("manager", "campaigns:create")).toBe(true);
      expect(hasPermission("manager", "affiliates:view")).toBe(true);
      expect(hasPermission("manager", "commissions:manage")).toBe(true);
    });

    it("should return false for manager with disallowed permissions", () => {
      expect(hasPermission("manager", "billing:*")).toBe(false);
      expect(hasPermission("manager", "users:*")).toBe(false);
      expect(hasPermission("manager", "settings:manage")).toBe(false);
    });

    it("should return true for viewer with view permissions", () => {
      expect(hasPermission("viewer", "view:*")).toBe(true);
      expect(hasPermission("viewer", "campaigns:view")).toBe(true);
    });

    it("should return false for viewer with manage permissions", () => {
      expect(hasPermission("viewer", "campaigns:create")).toBe(false);
      expect(hasPermission("viewer", "manage:*")).toBe(false);
    });

    it("should handle wildcard permissions correctly", () => {
      expect(hasPermission("owner", "campaigns:anything")).toBe(true);
      expect(hasPermission("manager", "campaigns:anything")).toBe(true);
      expect(hasPermission("viewer", "campaigns:anything")).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for owner", () => {
      const permissions = getRolePermissions("owner");
      expect(permissions).toContain("manage:*");
      expect(permissions).toContain("billing:*");
      expect(permissions.length).toBeGreaterThan(5);
    });

    it("should return limited permissions for manager", () => {
      const permissions = getRolePermissions("manager");
      expect(permissions).toContain("campaigns:*");
      expect(permissions).not.toContain("billing:*");
    });

    it("should return only view permissions for viewer", () => {
      const permissions = getRolePermissions("viewer");
      expect(permissions.every(p => p.includes("view"))).toBe(true);
    });
  });

  describe("role checks", () => {
    it("should correctly identify owner", () => {
      expect(isOwner("owner")).toBe(true);
      expect(isOwner("manager")).toBe(false);
      expect(isOwner("viewer")).toBe(false);
    });

    it("should correctly identify manager", () => {
      expect(isManager("manager")).toBe(true);
      expect(isManager("owner")).toBe(false);
      expect(isManager("viewer")).toBe(false);
    });

    it("should correctly identify viewer", () => {
      expect(isViewer("viewer")).toBe(true);
      expect(isViewer("owner")).toBe(false);
      expect(isViewer("manager")).toBe(false);
    });
  });

  describe("ROLE_PERMISSIONS constant", () => {
    it("should have owner, manager, and viewer roles", () => {
      expect(ROLE_PERMISSIONS).toHaveProperty("owner");
      expect(ROLE_PERMISSIONS).toHaveProperty("manager");
      expect(ROLE_PERMISSIONS).toHaveProperty("viewer");
    });

    it("should have permissions as arrays", () => {
      expect(Array.isArray(ROLE_PERMISSIONS.owner)).toBe(true);
      expect(Array.isArray(ROLE_PERMISSIONS.manager)).toBe(true);
      expect(Array.isArray(ROLE_PERMISSIONS.viewer)).toBe(true);
    });
  });

  describe("permission wildcard matching", () => {
    it("should match exact permissions", () => {
      // Owner has manage:* which matches manage:campaigns
      expect(hasPermission("owner", "manage:campaigns")).toBe(true);
      // Manager has campaigns:* which matches campaigns:create
      expect(hasPermission("manager", "campaigns:create")).toBe(true);
      // Viewer has view:* which matches view:dashboard
      expect(hasPermission("viewer", "view:dashboard")).toBe(true);
    });

    it("should not match when permission is not granted", () => {
      // Viewer does not have manage:* or campaigns:manage
      expect(hasPermission("viewer", "campaigns:manage")).toBe(false);
      // Manager does not have billing:* or settings:manage
      expect(hasPermission("manager", "billing:manage")).toBe(false);
    });

    it("should handle colon-separated wildcards correctly", () => {
      // campaigns:* should match campaigns:anything
      expect(hasPermission("manager", "campaigns:anything")).toBe(true);
      // affiliates:* should match affiliates:approve
      expect(hasPermission("manager", "affiliates:approve")).toBe(true);
      // commissions:* should match commissions:review
      expect(hasPermission("manager", "commissions:review")).toBe(true);
    });
  });

  describe("role-specific permission scenarios", () => {
    it("viewer should have view-only permissions", () => {
      expect(hasPermission("viewer", "view:*")).toBe(true);
      expect(hasPermission("viewer", "campaigns:view")).toBe(true);
      expect(hasPermission("viewer", "affiliates:view")).toBe(true);
      expect(hasPermission("viewer", "commissions:view")).toBe(true);
      expect(hasPermission("viewer", "payouts:view")).toBe(true);
    });

    it("manager should have management permissions but not billing", () => {
      expect(hasPermission("manager", "manage:campaigns")).toBe(true);
      expect(hasPermission("manager", "manage:affiliates")).toBe(true);
      expect(hasPermission("manager", "manage:commissions")).toBe(true);
      expect(hasPermission("manager", "billing:*")).toBe(false);
      expect(hasPermission("manager", "billing:manage")).toBe(false);
      expect(hasPermission("manager", "settings:*")).toBe(false);
    });

    it("owner should have all permissions including billing and settings", () => {
      expect(hasPermission("owner", "manage:*")).toBe(true);
      expect(hasPermission("owner", "billing:*")).toBe(true);
      expect(hasPermission("owner", "settings:*")).toBe(true);
      expect(hasPermission("owner", "users:*")).toBe(true);
    });
  });
});
