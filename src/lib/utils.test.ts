import { describe, it, expect } from "vitest";
import {
  getEffectiveRecurringRate,
  getRecurringRateDescription,
  DEFAULT_REDUCED_RATE_PERCENTAGE,
} from "./utils";

describe("getEffectiveRecurringRate", () => {
  it("should return commission rate when recurringRateType is undefined", () => {
    expect(getEffectiveRecurringRate(10)).toBe(10);
  });

  it("should return commission rate when recurringRateType is 'same'", () => {
    expect(getEffectiveRecurringRate(10, "same")).toBe(10);
    expect(getEffectiveRecurringRate(25, "same")).toBe(25);
  });

  it("should return reduced rate when recurringRateType is 'reduced'", () => {
    expect(getEffectiveRecurringRate(10, "reduced")).toBe(5);
    expect(getEffectiveRecurringRate(20, "reduced")).toBe(10);
    expect(getEffectiveRecurringRate(15, "reduced")).toBe(7.5);
  });

  it("should use DEFAULT_REDUCED_RATE_PERCENTAGE constant for reduced calculation", () => {
    // Verify the constant is used correctly (50% default)
    expect(DEFAULT_REDUCED_RATE_PERCENTAGE).toBe(50);
    expect(getEffectiveRecurringRate(100, "reduced")).toBe(50);
  });

  it("should return custom recurring rate when recurringRateType is 'custom'", () => {
    expect(getEffectiveRecurringRate(10, "custom", 5)).toBe(5);
    expect(getEffectiveRecurringRate(10, "custom", 8)).toBe(8);
    expect(getEffectiveRecurringRate(10, "custom", 15)).toBe(15);
  });

  it("should fall back to commission rate when custom rate is not provided", () => {
    expect(getEffectiveRecurringRate(10, "custom")).toBe(10);
    expect(getEffectiveRecurringRate(10, "custom", undefined)).toBe(10);
  });

  it("should handle edge cases correctly", () => {
    // Zero commission rate
    expect(getEffectiveRecurringRate(0, "same")).toBe(0);
    expect(getEffectiveRecurringRate(0, "reduced")).toBe(0);

    // Very high commission rate
    expect(getEffectiveRecurringRate(100, "reduced")).toBe(50);

    // Decimal rates
    expect(getEffectiveRecurringRate(10.5, "reduced")).toBe(5.25);
  });
});

describe("getRecurringRateDescription", () => {
  it("should return description for 'same' rate type", () => {
    expect(getRecurringRateDescription("same", undefined, 10)).toBe(
      "Same as initial (10%)"
    );
    expect(getRecurringRateDescription("same", undefined, 25)).toBe(
      "Same as initial (25%)"
    );
  });

  it("should return description for 'reduced' rate type", () => {
    expect(getRecurringRateDescription("reduced", undefined, 10)).toBe(
      "Reduced (5.0%)"
    );
    expect(getRecurringRateDescription("reduced", undefined, 20)).toBe(
      "Reduced (10.0%)"
    );
  });

  it("should handle reduced rate with decimals correctly", () => {
    expect(getRecurringRateDescription("reduced", undefined, 15)).toBe(
      "Reduced (7.5%)"
    );
    expect(getRecurringRateDescription("reduced", undefined, 7)).toBe(
      "Reduced (3.5%)"
    );
  });

  it("should return description for 'custom' rate type", () => {
    expect(getRecurringRateDescription("custom", 5, 10)).toBe("Custom (5%)");
    expect(getRecurringRateDescription("custom", 8, 10)).toBe("Custom (8%)");
    expect(getRecurringRateDescription("custom", 0, 10)).toBe("Custom (0%)");
  });

  it("should fall back to 0% when custom rate is not provided", () => {
    expect(getRecurringRateDescription("custom")).toBe("Custom (0%)");
    expect(getRecurringRateDescription("custom", undefined, 10)).toBe(
      "Custom (0%)"
    );
  });

  it("should handle undefined rate type", () => {
    expect(getRecurringRateDescription(undefined, undefined, 10)).toBe(
      "Same as initial (10%)"
    );
  });

  it("should display with correct formatting for all scenarios", () => {
    // Verify the descriptions are user-friendly
    const sameDesc = getRecurringRateDescription("same", undefined, 15);
    const reducedDesc = getRecurringRateDescription("reduced", undefined, 15);
    const customDesc = getRecurringRateDescription("custom", 7, 15);

    expect(sameDesc).toContain("Same as initial");
    expect(sameDesc).toContain("15%");

    expect(reducedDesc).toContain("Reduced");
    expect(reducedDesc).toContain("7.5%");

    expect(customDesc).toContain("Custom");
    expect(customDesc).toContain("7%");
  });
});
