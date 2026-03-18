import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/template-utils";

/**
 * Unit Tests for Client-side Template Utilities
 * Story 10.7: Email Template Customization
 *
 * These tests mirror the backend template function tests
 * to ensure consistency between server and client rendering.
 */

describe("Client-side template-utils", () => {
  describe("renderTemplate", () => {
    it("should replace single variable", () => {
      const result = renderTemplate("Hello {{name}}", { name: "Jamie" });
      expect(result).toBe("Hello Jamie");
    });

    it("should replace multiple variables", () => {
      const result = renderTemplate(
        "{{greeting}} {{name}}, your balance is {{amount}}",
        { greeting: "Hi", name: "Jamie", amount: "$500.00" }
      );
      expect(result).toBe("Hi Jamie, your balance is $500.00");
    });

    it("should leave unknown variables as-is", () => {
      const result = renderTemplate("Hello {{name}}, {{unknown_var}}", {
        name: "Jamie",
      });
      expect(result).toBe("Hello Jamie, {{unknown_var}}");
    });

    it("should handle numbers correctly", () => {
      const result = renderTemplate("Count: {{count}}", { count: 42 });
      expect(result).toBe("Count: 42");
    });

    it("should handle empty string value", () => {
      const result = renderTemplate("Name: {{name}}", { name: "" });
      expect(result).toBe("Name: ");
    });

    it("should handle undefined value", () => {
      const result = renderTemplate("Name: {{name}}", { name: undefined });
      expect(result).toBe("Name: {{name}}");
    });
  });

  describe("validateTemplateVariables", () => {
    it("should return valid when all required variables present", () => {
      const result = validateTemplateVariables(
        ["affiliate_name", "portal_name"],
        ["affiliate_name", "portal_name", "referral_link"],
        "Welcome {{affiliate_name}} to {{portal_name}}!"
      );
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should detect missing required variables", () => {
      const result = validateTemplateVariables(
        ["affiliate_name", "portal_name"],
        ["affiliate_name", "portal_name", "referral_link"],
        "Welcome {{affiliate_name}}!"
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("portal_name");
    });

    it("should detect unknown variables", () => {
      const result = validateTemplateVariables(
        ["name"],
        ["name"],
        "Hello {{name}}, unknown {{fake_var}}"
      );
      expect(result.valid).toBe(false);
      expect(result.invalidSyntax).toContain("Unknown variable: {{fake_var}}");
    });

    it("should allow optional variables to be missing", () => {
      const result = validateTemplateVariables(
        ["affiliate_name"],
        ["affiliate_name", "referral_link"],
        "Welcome {{affiliate_name}}!"
      );
      expect(result.valid).toBe(true);
    });
  });
});
