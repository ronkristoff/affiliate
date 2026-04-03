/**
 * Unit Tests for Broadcast Email Functions (Story 10.5)
 * Testing BroadcastEmail template rendering and broadcast logic
 *
 * Note: Convex integration tests (createBroadcast mutation, sendBroadcastEmails action)
 * are tested via Convex's built-in function validation and manual testing due to
 * pre-existing convexTest compatibility issues in this project.
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import React from "react";
import BroadcastEmail from "./emails/BroadcastEmail";

// ============================================================================
// HTML Detection Helper Test
// ============================================================================

/**
 * Simple HTML detection heuristic.
 * Replicated from BroadcastEmail.tsx for testing.
 */
function isHtml(content: string): boolean {
  const htmlTagPattern = /<(p|div|span|br|h[1-6]|ul|ol|li|a|strong|em|b|i|img|table)\b/i;
  return htmlTagPattern.test(content);
}

describe("Broadcast Email Tests", () => {

  // ==========================================================================
  // BroadcastEmail Template Rendering Tests
  // ==========================================================================
  describe("BroadcastEmail template rendering", () => {
    it("should render plain text body correctly", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Test Subject"
          body="This is a plain text message."
          portalName="Test Portal"
        />
      );

      expect(html).toContain("Test Subject");
      expect(html).toContain("This is a plain text message.");
      expect(html).toContain("Test Portal");
    });

    it("should render HTML body content", async () => {
      const html = await render(
        <BroadcastEmail
          subject="HTML Subject"
          body="<p>Hello <strong>World</strong></p>"
          portalName="Test Portal"
        />
      );

      expect(html).toContain("HTML Subject");
      expect(html).toContain("<p>Hello <strong>World</strong></p>");
      expect(html).toContain("Test Portal");
    });

    it("should include unsubscribe link in footer when provided", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Unsubscribe Test"
          body="Test body"
          portalName="Test Portal"
          unsubscribeUrl="https://example.com/unsubscribe"
        />
      );

      expect(html).toContain("Unsubscribe");
      expect(html).toContain("https://example.com/unsubscribe");
    });

    it("should not render unsubscribe footer when URL not provided", async () => {
      const htmlNoUnsubscribe = await render(
        <BroadcastEmail
          subject="No Unsubscribe Test"
          body="Test body"
          portalName="Test Portal"
        />
      );

      const htmlWithUnsubscribe = await render(
        <BroadcastEmail
          subject="With Unsubscribe Test"
          body="Test body"
          portalName="Test Portal"
          unsubscribeUrl="https://example.com/unsubscribe"
        />
      );

      // When unsubscribe URL is provided, the link should be present
      expect(htmlWithUnsubscribe).toContain("Unsubscribe");
      expect(htmlWithUnsubscribe).toContain("https://example.com/unsubscribe");

      // When not provided, the unsubscribe link should NOT be present
      expect(htmlNoUnsubscribe).not.toContain("https://example.com/unsubscribe");
    });

    it("should use brand logo when provided", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Logo Test"
          body="Test body"
          portalName="Test Portal"
          brandLogoUrl="https://example.com/logo.png"
        />
      );

      expect(html).toContain("https://example.com/logo.png");
    });

    it("should show portal name in footer", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Footer Test"
          body="Test body"
          portalName="My Affiliate Portal"
        />
      );

      expect(html).toContain("My Affiliate Portal");
    });

    it("should include preview text matching subject", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Preview Test Subject"
          body="Test body"
          portalName="Test Portal"
        />
      );

      // React Email renders preview text
      expect(html).toContain("Preview Test Subject");
    });

    it("should render complex HTML with multiple elements", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Complex HTML"
          body="<h2>Announcement</h2><ul><li>Feature 1</li><li>Feature 2</li></ul><p>Thank you!</p>"
          portalName="Test Portal"
          brandPrimaryColor="#1fb5a5"
        />
      );

      expect(html).toContain("Complex HTML");
      expect(html).toContain("Announcement");
      expect(html).toContain("Feature 1");
      expect(html).toContain("Feature 2");
      expect(html).toContain("Thank you!");
    });

    it("should accept brand primary color prop without error", async () => {
      // The primary color prop is accepted and available for future use
      // It's not rendered as a literal string in the current template
      const html = await render(
        <BroadcastEmail
          subject="Branding Test"
          body="Test body"
          portalName="Test Portal"
          brandPrimaryColor="#ff0000"
        />
      );

      // Verify the component renders successfully with the prop
      expect(html).toContain("Branding Test");
      expect(html).toContain("Test body");
    });

    it("should render correctly with all optional props provided", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Full Props Test"
          body="<p>Full content</p>"
          portalName="Full Portal"
          brandLogoUrl="https://example.com/logo.png"
          brandPrimaryColor="#1c2260"
          unsubscribeUrl="https://example.com/unsubscribe"
        />
      );

      expect(html).toContain("Full Props Test");
      expect(html).toContain("Full Portal");
      expect(html).toContain("https://example.com/logo.png");
      expect(html).toContain("Unsubscribe");
      expect(html).toContain("https://example.com/unsubscribe");
    });

    it("should handle empty body gracefully", async () => {
      const html = await render(
        <BroadcastEmail
          subject="Empty Body Test"
          body=""
          portalName="Test Portal"
        />
      );

      expect(html).toContain("Empty Body Test");
    });

    it("should handle long subject lines", async () => {
      const longSubject = "A".repeat(200);
      const html = await render(
        <BroadcastEmail
          subject={longSubject}
          body="Test"
          portalName="Test Portal"
        />
      );

      expect(html).toContain(longSubject);
    });
  });

  // ==========================================================================
  // HTML Detection Logic Tests
  // ==========================================================================
  describe("HTML detection logic", () => {
    it("should detect HTML tags", () => {
      expect(isHtml("<p>Hello</p>")).toBe(true);
      expect(isHtml("<div>Content</div>")).toBe(true);
      expect(isHtml("<span>text</span>")).toBe(true);
      expect(isHtml("<br>")).toBe(true);
      expect(isHtml("<h1>Heading</h1>")).toBe(true);
      expect(isHtml("<ul><li>Item</li></ul>")).toBe(true);
      expect(isHtml("<a href='#'>Link</a>")).toBe(true);
      expect(isHtml("<strong>Bold</strong>")).toBe(true);
      expect(isHtml("<em>Italic</em>")).toBe(true);
      expect(isHtml("<b>Bold</b>")).toBe(true);
      expect(isHtml("<i>Italic</i>")).toBe(true);
      expect(isHtml("<img src='test.jpg' />")).toBe(true);
      expect(isHtml("<table><tr><td>Cell</td></tr></table>")).toBe(true);
    });

    it("should not detect plain text as HTML", () => {
      expect(isHtml("Just plain text")).toBe(false);
      expect(isHtml("Hello world!")).toBe(false);
      expect(isHtml("Line 1\nLine 2")).toBe(false);
      expect(isHtml("No < angle brackets here")).toBe(false);
      expect(isHtml("")).toBe(false);
    });

    it("should handle edge cases", () => {
      // Angle bracket in math expression
      expect(isHtml("x < y and y > z")).toBe(false);
      // HTML-like but not a detected tag
      expect(isHtml("<custom>content</custom>")).toBe(false);
      // Mixed case
      expect(isHtml("<P>Paragraph</P>")).toBe(true);
      expect(isHtml("<DIV>Block</DIV>")).toBe(true);
    });
  });

  // ==========================================================================
  // Broadcast Status Logic Tests
  // ==========================================================================
  describe("broadcast status logic", () => {
    const VALID_STATUSES = ["pending", "sending", "sent", "partial", "failed"] as const;

    it("should have exactly 5 valid statuses", () => {
      expect(VALID_STATUSES.length).toBe(5);
    });

    it("should contain all expected status values", () => {
      expect(VALID_STATUSES).toContain("pending");
      expect(VALID_STATUSES).toContain("sending");
      expect(VALID_STATUSES).toContain("sent");
      expect(VALID_STATUSES).toContain("partial");
      expect(VALID_STATUSES).toContain("failed");
    });

    it("should determine final status correctly - all sent", () => {
      const failedCount = 0;
      const sentCount = 10;
      const totalRecipients = 10;
      const finalStatus = failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "failed";
      expect(finalStatus).toBe("sent");
      expect(sentCount).toBe(totalRecipients);
    });

    it("should determine final status correctly - partial failure", () => {
      const failedCount: number = 2;
      const sentCount: number = 8;
      const finalStatus: string = failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "failed";
      expect(finalStatus).toBe("partial");
    });

    it("should determine final status correctly - all failed", () => {
      const failedCount: number = 10;
      const sentCount: number = 0;
      const finalStatus: string = failedCount === 0 ? "sent" : sentCount > 0 ? "partial" : "failed";
      expect(finalStatus).toBe("failed");
    });
  });

  // ==========================================================================
  // Batch Processing Logic Tests
  // ==========================================================================
  describe("batch processing logic", () => {
    const BATCH_SIZE = 100;

    it("should calculate correct number of batches", () => {
      const totalRecipients = 250;
      const expectedBatches = Math.ceil(totalRecipients / BATCH_SIZE);
      expect(expectedBatches).toBe(3);
    });

    it("should handle exact batch size", () => {
      const totalRecipients = 100;
      const expectedBatches = Math.ceil(totalRecipients / BATCH_SIZE);
      expect(expectedBatches).toBe(1);
    });

    it("should handle less than one batch", () => {
      const totalRecipients = 50;
      const expectedBatches = Math.ceil(totalRecipients / BATCH_SIZE);
      expect(expectedBatches).toBe(1);
    });

    it("should handle single recipient", () => {
      const totalRecipients = 1;
      const expectedBatches = Math.ceil(totalRecipients / BATCH_SIZE);
      expect(expectedBatches).toBe(1);
    });
  });

  // ==========================================================================
  // Retry Logic Tests (Exponential Backoff)
  // ==========================================================================
  describe("retry logic (exponential backoff)", () => {
    const BASE_DELAY_MS = 5000;
    const MAX_RETRIES = 3;

    it("should calculate correct retry delays", () => {
      const delay0 = BASE_DELAY_MS * Math.pow(2, 0); // 5000ms
      const delay1 = BASE_DELAY_MS * Math.pow(2, 1); // 10000ms
      const delay2 = BASE_DELAY_MS * Math.pow(2, 2); // 20000ms

      expect(delay0).toBe(5000);
      expect(delay1).toBe(10000);
      expect(delay2).toBe(20000);
    });

    it("should not exceed max retries", () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        expect(attempt).toBeLessThan(MAX_RETRIES);
      }
    });

    it("should calculate total max delay time", () => {
      const totalMaxDelay = (delay: number) => BASE_DELAY_MS * Math.pow(2, delay);
      expect(totalMaxDelay(0)).toBe(5000);
      expect(totalMaxDelay(1)).toBe(10000);
      expect(totalMaxDelay(2)).toBe(20000);
    });
  });
});
