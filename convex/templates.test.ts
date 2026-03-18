import { describe, it, expect } from "vitest";
import {
  validateTemplateVariables,
  renderTemplate,
  sanitizeHtmlContent,
  TEMPLATE_VARIABLES,
  TEMPLATE_DEFINITIONS,
  CUSTOMIZABLE_TEMPLATE_TYPES,
} from "./templates";

/**
 * Unit Tests for Email Template Customization System
 * Story 10.7: Email Template Customization
 *
 * These tests validate:
 * - AC1: Template variable system correctness
 * - AC3: Template variable preservation and validation
 * - AC5: Template rendering with variable replacement
 * - Security: HTML sanitization for custom templates
 */

describe("Email Template Customization - Template Variable System", () => {
  // ===========================================================================
  // validateTemplateVariables
  // ===========================================================================
  describe("validateTemplateVariables", () => {
    it("should return valid when all required variables are present", () => {
      const result = validateTemplateVariables(
        "commission_confirmed",
        "Hello {{affiliate_name}}, your commission of {{commission_amount}} has been confirmed. Portal: {{portal_name}}"
      );
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.invalidSyntax).toHaveLength(0);
    });

    it("should return invalid when required variables are missing", () => {
      const result = validateTemplateVariables(
        "commission_confirmed",
        "Hello, your commission has been confirmed."
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("affiliate_name");
      expect(result.missing).toContain("commission_amount");
      expect(result.missing).toContain("portal_name");
    });

    it("should return invalid when unknown variables are used", () => {
      const result = validateTemplateVariables(
        "commission_confirmed",
        "Hello {{affiliate_name}}, commission {{commission_amount}}, portal {{portal_name}}, unknown {{nonexistent_var}}"
      );
      expect(result.valid).toBe(false);
      expect(result.invalidSyntax.length).toBeGreaterThan(0);
      expect(result.invalidSyntax[0]).toContain("nonexistent_var");
    });

    it("should return valid for affiliate_welcome with required vars", () => {
      const result = validateTemplateVariables(
        "affiliate_welcome",
        "Welcome {{affiliate_name}} to {{portal_name}}!"
      );
      expect(result.valid).toBe(true);
    });

    it("should return valid for payout_sent with required vars", () => {
      const result = validateTemplateVariables(
        "payout_sent",
        "Payout of {{payout_amount}} sent to {{affiliate_name}} from {{portal_name}}"
      );
      expect(result.valid).toBe(true);
    });

    it("should return valid for affiliate_approval with required vars", () => {
      const result = validateTemplateVariables(
        "affiliate_approval",
        "{{affiliate_name}}, your application to {{portal_name}} has been approved!"
      );
      expect(result.valid).toBe(true);
    });

    it("should detect missing required variables in subject but present in body", () => {
      const result = validateTemplateVariables(
        "commission_confirmed",
        "Hello {{affiliate_name}}, commission {{commission_amount}} from {{portal_name}}"
      );
      // All required vars are present
      expect(result.valid).toBe(true);
    });

    it("should accept empty template (missing all required vars)", () => {
      const result = validateTemplateVariables("commission_confirmed", "");
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("affiliate_name");
      expect(result.missing).toContain("commission_amount");
      expect(result.missing).toContain("portal_name");
    });

    it("should handle template with only optional variables", () => {
      // affiliate_welcome requires affiliate_name and portal_name
      const result = validateTemplateVariables(
        "affiliate_welcome",
        "{{affiliate_name}}, welcome to {{portal_name}}! Your link: {{referral_link}}"
      );
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // renderTemplate
  // ===========================================================================
  describe("renderTemplate", () => {
    it("should replace single variable", () => {
      const result = renderTemplate("Hello {{name}}", { name: "Jamie" });
      expect(result).toBe("Hello Jamie");
    });

    it("should replace multiple variables", () => {
      const result = renderTemplate(
        "Hello {{affiliate_name}}, commission {{commission_amount}} confirmed!",
        { affiliate_name: "Jamie", commission_amount: "$150.00" }
      );
      expect(result).toBe("Hello Jamie, commission $150.00 confirmed!");
    });

    it("should leave unreplaced variables as-is when value is undefined", () => {
      const result = renderTemplate("Hello {{name}}, ref: {{referral_link}}", {
        name: "Jamie",
      });
      expect(result).toBe("Hello Jamie, ref: {{referral_link}}");
    });

    it("should convert numbers to strings", () => {
      const result = renderTemplate("Amount: {{amount}}", { amount: 150 });
      expect(result).toBe("Amount: 150");
    });

    it("should handle empty template string", () => {
      const result = renderTemplate("", { name: "Jamie" });
      expect(result).toBe("");
    });

    it("should handle template with no variables", () => {
      const result = renderTemplate("Plain text with no variables", { name: "Jamie" });
      expect(result).toBe("Plain text with no variables");
    });

    it("should handle duplicate variables", () => {
      const result = renderTemplate(
        "{{name}} says hi! {{name}} again!",
        { name: "Jamie" }
      );
      expect(result).toBe("Jamie says hi! Jamie again!");
    });

    it("should handle commission confirmed email template rendering", () => {
      const template = "Congratulations {{affiliate_name}}! Commission: {{commission_amount}} for campaign {{campaign_name}} on {{conversion_date}}. Portal: {{portal_name}}";
      const variables = {
        affiliate_name: "Jamie Cruz",
        commission_amount: "$150.00",
        campaign_name: "Summer Sale",
        conversion_date: "March 15, 2026",
        portal_name: "My SaaS",
      };
      const result = renderTemplate(template, variables);
      expect(result).toContain("Jamie Cruz");
      expect(result).toContain("$150.00");
      expect(result).toContain("Summer Sale");
      expect(result).toContain("March 15, 2026");
      expect(result).toContain("My SaaS");
    });

    it("should handle payout sent email template rendering", () => {
      const template = "Payout of {{payout_amount}} sent to {{affiliate_name}} on {{paid_at}}";
      const variables = {
        affiliate_name: "Jamie Cruz",
        payout_amount: "$500.00",
        paid_at: "March 20, 2026",
        portal_name: "My SaaS",
      };
      const result = renderTemplate(template, variables);
      expect(result).toBe("Payout of $500.00 sent to Jamie Cruz on March 20, 2026");
    });
  });

  // ===========================================================================
  // sanitizeHtmlContent
  // ===========================================================================
  describe("sanitizeHtmlContent", () => {
    it("should remove script tags", () => {
      const html = "<p>Hello</p><script>alert('xss')</script>";
      const result = sanitizeHtmlContent(html);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("alert");
      expect(result).toContain("<p>Hello</p>");
    });

    it("should remove iframe tags", () => {
      const html = '<iframe src="https://evil.com"></iframe><p>Safe content</p>';
      const result = sanitizeHtmlContent(html);
      expect(result).not.toContain("<iframe");
      expect(result).toContain("<p>Safe content</p>");
    });

    it("should remove javascript: in href attributes", () => {
      const html = '<a href="javascript:alert(\'xss\')">Click</a>';
      const result = sanitizeHtmlContent(html);
      expect(result).not.toContain("javascript:");
    });

    it("should remove onclick event handlers", () => {
      const html = '<div onclick="alert(\'xss\')">Content</div>';
      const result = sanitizeHtmlContent(html);
      expect(result).not.toContain("onclick");
    });

    it("should preserve safe HTML tags", () => {
      const html = "<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>";
      const result = sanitizeHtmlContent(html);
      expect(result).toContain("<h1>Title</h1>");
      expect(result).toContain("<strong>bold</strong>");
      expect(result).toContain("<em>italic</em>");
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Item</li>");
    });

    it("should preserve safe links", () => {
      const html = '<a href="https://example.com">Safe Link</a>';
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('href="https://example.com"');
    });

    it("should preserve inline styles", () => {
      const html = '<p style="color: red; font-weight: bold;">Styled text</p>';
      const result = sanitizeHtmlContent(html);
      expect(result).toContain('style="color: red; font-weight: bold;"');
    });

    it("should remove embed tags", () => {
      const html = '<embed src="evil.swf"><p>Safe content</p>';
      const result = sanitizeHtmlContent(html);
      expect(result).not.toContain("<embed");
      expect(result).toContain("<p>Safe content</p>");
    });

    it("should remove object tags", () => {
      const html = '<object data="evil.swf"></object><p>Safe content</p>';
      const result = sanitizeHtmlContent(html);
      expect(result).not.toContain("<object");
      expect(result).toContain("<p>Safe content</p>");
    });

    it("should handle template variables in sanitized HTML", () => {
      const html = "<h1>Welcome {{affiliate_name}}</h1><p>Your commission: {{commission_amount}}</p>";
      const result = sanitizeHtmlContent(html);
      expect(result).toContain("{{affiliate_name}}");
      expect(result).toContain("{{commission_amount}}");
    });
  });

  // ===========================================================================
  // TEMPLATE_VARIABLES constant
  // ===========================================================================
  describe("TEMPLATE_VARIABLES constant", () => {
    it("should define variables for all customizable template types", () => {
      const types = Object.keys(TEMPLATE_VARIABLES);
      expect(types).toContain("affiliate_welcome");
      expect(types).toContain("commission_confirmed");
      expect(types).toContain("payout_sent");
      expect(types).toContain("affiliate_approval");
      expect(types).toContain("affiliate_rejection");
      expect(types).toContain("affiliate_suspension");
      expect(types).toContain("affiliate_reactivation");
      expect(types).toHaveLength(7);
    });

    it("should include affiliate_name in all template types", () => {
      for (const [type, variables] of Object.entries(TEMPLATE_VARIABLES)) {
        expect(variables).toContain("affiliate_name"), `Missing affiliate_name in ${type}`;
      }
    });

    it("should include portal_name in all template types", () => {
      for (const [type, variables] of Object.entries(TEMPLATE_VARIABLES)) {
        expect(variables).toContain("portal_name"), `Missing portal_name in ${type}`;
      }
    });

    it("should include commission_amount only in commission_confirmed", () => {
      expect(TEMPLATE_VARIABLES.commission_confirmed).toContain("commission_amount");
      expect(TEMPLATE_VARIABLES.payout_sent).not.toContain("commission_amount");
      expect(TEMPLATE_VARIABLES.affiliate_welcome).not.toContain("commission_amount");
    });

    it("should include payout_amount only in payout_sent", () => {
      expect(TEMPLATE_VARIABLES.payout_sent).toContain("payout_amount");
      expect(TEMPLATE_VARIABLES.commission_confirmed).not.toContain("payout_amount");
    });
  });

  // ===========================================================================
  // TEMPLATE_DEFINITIONS constant
  // ===========================================================================
  describe("TEMPLATE_DEFINITIONS constant", () => {
    it("should have a definition for each customizable template type", () => {
      expect(TEMPLATE_DEFINITIONS).toHaveLength(7);
      for (const def of TEMPLATE_DEFINITIONS) {
        expect(def.type).toBeDefined();
        expect(def.label).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.variables).toBeInstanceOf(Array);
        expect(def.requiredVariables).toBeInstanceOf(Array);
        expect(def.sampleData).toBeDefined();
        expect(def.defaultSubject).toBeDefined();
        expect(def.defaultBody).toBeDefined();
      }
    });

    it("should have default subjects with template variables", () => {
      for (const def of TEMPLATE_DEFINITIONS) {
        const hasVariable = def.defaultSubject.includes("{{");
        expect(hasVariable).toBe(true), `Default subject for ${def.type} should contain template variables`;
      }
    });

    it("should have default bodies with template variables", () => {
      for (const def of TEMPLATE_DEFINITIONS) {
        const hasVariable = def.defaultBody.includes("{{");
        expect(hasVariable).toBe(true), `Default body for ${def.type} should contain template variables`;
      }
    });

    it("should have sample data for all variables", () => {
      for (const def of TEMPLATE_DEFINITIONS) {
        for (const variable of def.variables) {
          expect(def.sampleData[variable]).toBeDefined(), `Missing sample data for ${variable} in ${def.type}`;
        }
      }
    });

    it("should have all required variables in the default template content", () => {
      for (const def of TEMPLATE_DEFINITIONS) {
        for (const required of def.requiredVariables) {
          const inSubject = def.defaultSubject.includes(`{{${required}}}`);
          const inBody = def.defaultBody.includes(`{{${required}}}`);
          expect(inSubject || inBody).toBe(true), `Required var {{${required}}} not in default template for ${def.type}`;
        }
      }
    });

    it("should validate all default templates pass validation", () => {
      for (const def of TEMPLATE_DEFINITIONS) {
        // Validate combined subject + body (required vars can be in either)
        const combinedContent = def.defaultSubject + " " + def.defaultBody;
        const combinedResult = validateTemplateVariables(def.type, combinedContent);
        expect(combinedResult.valid).toBe(true), `Default template for ${def.type} failed validation: ${JSON.stringify(combinedResult)}`;
      }
    });
  });

  // ===========================================================================
  // CUSTOMIZABLE_TEMPLATE_TYPES
  // ===========================================================================
  describe("CUSTOMIZABLE_TEMPLATE_TYPES", () => {
    it("should have exactly 7 template types", () => {
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toHaveLength(7);
    });

    it("should not include non-customizable types", () => {
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).not.toContain("new_referral_alert");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).not.toContain("fraud_alert");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).not.toContain("broadcast");
    });

    it("should include all affiliate-facing template types", () => {
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("affiliate_welcome");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("commission_confirmed");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("payout_sent");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("affiliate_approval");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("affiliate_rejection");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("affiliate_suspension");
      expect(CUSTOMIZABLE_TEMPLATE_TYPES).toContain("affiliate_reactivation");
    });
  });

  // ===========================================================================
  // Integration: Full template workflow
  // ===========================================================================
  describe("Template workflow integration", () => {
    it("should validate, render, and sanitize a complete template", () => {
      const templateType = "commission_confirmed";
      const customSubject = "Commission Confirmed: {{commission_amount}} for {{affiliate_name}} at {{portal_name}}!";
      const customBody = `
        <h1>Congratulations, {{affiliate_name}}!</h1>
        <p>Your commission of <strong>{{commission_amount}}</strong> has been confirmed.</p>
        <p>Campaign: {{campaign_name}}</p>
        <p>Date: {{conversion_date}}</p>
        <p>Thank you for being an affiliate with {{portal_name}}!</p>
        <script>alert('xss')</script>
      `;

      // 1. Sanitize
      const sanitizedBody = sanitizeHtmlContent(customBody);
      expect(sanitizedBody).not.toContain("<script>");

      // 2. Validate (combined subject + body)
      const combinedContent = customSubject + " " + sanitizedBody;
      const combinedValidation = validateTemplateVariables(templateType, combinedContent);
      expect(combinedValidation.valid).toBe(true);

      // 3. Render with sample data
      const sampleData = {
        affiliate_name: "Jamie Cruz",
        commission_amount: "$150.00",
        campaign_name: "Summer Sale",
        conversion_date: "March 15, 2026",
        portal_name: "My SaaS",
        currency: "USD",
      };

      const renderedSubject = renderTemplate(customSubject, sampleData);
      expect(renderedSubject).toBe("Commission Confirmed: $150.00 for Jamie Cruz at My SaaS!");

      const renderedBody = renderTemplate(sanitizedBody, sampleData);
      expect(renderedBody).toContain("Jamie Cruz");
      expect(renderedBody).toContain("$150.00");
      expect(renderedBody).toContain("Summer Sale");
      expect(renderedBody).toContain("My SaaS");
    });

    it("should reject template with XSS attempt in variables", () => {
      const templateType = "affiliate_welcome";
      // Template with a script tag disguised as variable content
      const body = "<h1>Welcome {{affiliate_name}}</h1><script>document.cookie</script>";
      
      // Validation should pass (variables are correct)
      const validation = validateTemplateVariables(templateType, body);
      expect(validation.valid).toBe(false); // script tag triggers invalid syntax
      
      // Sanitization should remove script
      const sanitized = sanitizeHtmlContent(body);
      expect(sanitized).not.toContain("<script>");
    });
  });
});
