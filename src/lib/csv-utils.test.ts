import { describe, it, expect } from "vitest";
import {
  generatePayoutCsv,
  escapeCsvField,
} from "./csv-utils";
import type { PayoutCsvRow } from "./csv-utils";

/**
 * Story 13.2: CSV Generation Utility Tests
 *
 * Test Coverage:
 * 1. CSV generation with correct headers and data
 * 2. Field escaping (commas, quotes, newlines)
 * 3. Amount formatting (plain numbers, 2 decimal places)
 * 4. UTF-8 BOM prefix
 * 5. Empty payouts (header-only CSV)
 * 6. Payout method display ("Type - Details" or "Not configured")
 * 7. Special characters in affiliate names
 * 8. Zero amount payout
 */

describe("Story 13.2: CSV Generation Utility", () => {
  // ===========================================================================
  // escapeCsvField
  // ===========================================================================
  describe("escapeCsvField", () => {
    it("should not escape simple fields without special characters", () => {
      expect(escapeCsvField("Jamie Cruz")).toBe("Jamie Cruz");
      expect(escapeCsvField("jamie@example.com")).toBe("jamie@example.com");
    });

    it("should wrap fields containing commas in quotes", () => {
      expect(escapeCsvField("Dela Cruz, Juan")).toBe('"Dela Cruz, Juan"');
    });

    it("should escape double quotes by doubling them", () => {
      expect(escapeCsvField('Juan "The Marketer" Reyes')).toBe(
        '"Juan ""The Marketer"" Reyes"'
      );
    });

    it("should wrap fields containing newlines in quotes", () => {
      expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    });

    it("should handle fields with both commas and quotes", () => {
      expect(escapeCsvField('Smith, John "JD"')).toBe('"Smith, John ""JD"""');
    });

    it("should handle empty string", () => {
      expect(escapeCsvField("")).toBe("");
    });
  });

  // ===========================================================================
  // generatePayoutCsv
  // ===========================================================================
  describe("generatePayoutCsv", () => {
    it("should produce correct CSV format with headers", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Jamie Cruz",
          email: "jamie@example.com",
          amount: 5000,
          payoutMethod: { type: "GCash", details: "0917 123 4567" },
          commissionCount: 3,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      // Strip BOM for line parsing
      const csvNoBom = csv.replace(/^\uFEFF/, "");
      const lines = csvNoBom.split("\n");

      // First line should be the header
      expect(lines[0]).toBe(
        "Affiliate Name,Email,Amount,Payout Method,Commission Count,Notes"
      );

      // Second line should be the data row
      expect(lines[1]).toBe(
        "Jamie Cruz,jamie@example.com,5000.00,GCash - 0917 123 4567,3,"
      );
    });

    it("should include UTF-8 BOM prefix for Excel compatibility", () => {
      const csv = generatePayoutCsv([]);
      // UTF-8 BOM is \uFEFF which is the bytes EF BB BF
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it("should format amounts as plain numbers with 2 decimal places", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 1500,
          payoutMethod: null,
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain("1500.00");
      expect(csv).not.toContain("₱");
      // Amount field should be a plain number without currency formatting
      // Verify the data row has the amount as plain number
      const csvNoBom = csv.replace(/^\uFEFF/, "");
      const dataLine = csvNoBom.split("\n")[1];
      expect(dataLine).toContain("1500.00");
    });

    it("should handle zero amount payout", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 0,
          payoutMethod: null,
          commissionCount: 0,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain("0.00");
    });

    it("should handle decimal amounts correctly", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 1234.5,
          payoutMethod: null,
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain("1234.50");
    });

    it("should show payout method type and details when configured", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 1000,
          payoutMethod: { type: "Bank Transfer", details: "BPI ****1234" },
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain("Bank Transfer - BPI ****1234");
    });

    it("should show 'Not configured' for missing payout method", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 1000,
          payoutMethod: null,
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain("Not configured");
    });

    it("should show 'Not configured' when payoutMethod is undefined", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 1000,
          payoutMethod: undefined,
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain("Not configured");
    });

    it("should generate header-only CSV for empty payouts array", () => {
      const csv = generatePayoutCsv([]);
      // Strip BOM for line parsing
      const csvNoBom = csv.replace(/^\uFEFF/, "");
      const lines = csvNoBom.split("\n");

      // Header line only (no data rows)
      expect(lines[0]).toBe(
        "Affiliate Name,Email,Amount,Payout Method,Commission Count,Notes"
      );
      // Only header line, no data rows
      expect(lines.filter((l) => l.trim().length > 0)).toHaveLength(1);
    });

    it("should handle affiliate name with commas (Dela Cruz, Juan)", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Dela Cruz, Juan",
          email: "juan@example.com",
          amount: 2500,
          payoutMethod: null,
          commissionCount: 2,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain('"Dela Cruz, Juan"');
    });

    it(`should handle affiliate name with quotes (Juan "The Marketer" Reyes)`, () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: 'Juan "The Marketer" Reyes',
          email: "juan@example.com",
          amount: 3000,
          payoutMethod: null,
          commissionCount: 5,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      expect(csv).toContain('"Juan ""The Marketer"" Reyes"');
    });

    it("should handle multiple rows correctly", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Jamie Cruz",
          email: "jamie@example.com",
          amount: 5000,
          payoutMethod: { type: "GCash", details: "0917 123 4567" },
          commissionCount: 3,
        },
        {
          name: "Ramon Santos",
          email: "ramon@example.com",
          amount: 2500,
          payoutMethod: null,
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      // Verify BOM on first character
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      // Strip BOM and check structure
      const csvNoBom = csv.replace(/^\uFEFF/, "");
      const lines = csvNoBom.split("\n");
      // header + 2 data rows
      expect(lines.filter((l) => l.trim().length > 0)).toHaveLength(3);
    });

    it("should have Notes column empty for all rows", () => {
      const payouts: Array<PayoutCsvRow> = [
        {
          name: "Test",
          email: "test@example.com",
          amount: 1000,
          payoutMethod: null,
          commissionCount: 1,
        },
      ];

      const csv = generatePayoutCsv(payouts);
      const dataLine = csv.split("\n")[1];
      // Last field (Notes) should be empty — line ends with comma
      expect(dataLine).toMatch(/,1,$/);
    });
  });
});
