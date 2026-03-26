import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FunnelChart } from "./FunnelChart";

describe("FunnelChart", () => {
  describe("Rendering with data", () => {
    it("renders funnel title", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
        />
      );
      expect(screen.getByText("Conversion Funnel")).toBeTruthy();
    });

    it("displays overall rate percentage", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
        />
      );
      expect(screen.getByText("5.0%")).toBeTruthy();
    });

    it("displays funnel stages labels", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
        />
      );
      expect(screen.getByText("Clicks")).toBeTruthy();
      expect(screen.getByText("Conversions")).toBeTruthy();
      expect(screen.getByText("Commissions")).toBeTruthy();
    });

    it("displays rate labels between stages", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
        />
      );
      expect(screen.getByText("Click → Conversion")).toBeTruthy();
      expect(screen.getByText("Conversion → Commission")).toBeTruthy();
    });

    it("displays organic conversions when provided", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
          organicConversions={25}
        />
      );
      expect(screen.getByText(/organic conversions/i)).toBeTruthy();
    });
  });

  describe("Edge cases", () => {
    it("handles zero clicks gracefully", () => {
      render(
        <FunnelChart
          totalClicks={0}
          totalConversions={0}
          totalCommissions={0}
          clickToConversionRate={0}
          conversionToCommissionRate={0}
          overallRate={0}
        />
      );
      expect(screen.getByText("Conversion Funnel")).toBeTruthy();
    });

    it("handles very large numbers", () => {
      render(
        <FunnelChart
          totalClicks={10000000}
          totalConversions={500000}
          totalCommissions={100000}
          clickToConversionRate={5}
          conversionToCommissionRate={20}
          overallRate={1}
        />
      );
      expect(screen.getByText("10,000,000")).toBeTruthy();
    });

    it("hides sensitive data when canViewSensitiveData is false", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
          canViewSensitiveData={false}
        />
      );
      // Should show "—" instead of the actual commission value
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  describe("Loading state", () => {
    it("shows skeleton when isLoading is true", () => {
      render(
        <FunnelChart
          totalClicks={0}
          totalConversions={0}
          totalCommissions={0}
          clickToConversionRate={0}
          conversionToCommissionRate={0}
          overallRate={0}
          isLoading={true}
        />
      );
      // Check for skeleton elements with animate-pulse
      const skeletonElements = document.querySelectorAll(".animate-pulse");
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
  });

  describe("Props handling", () => {
    it("accepts all required props without error", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
          organicConversions={10}
          isLoading={false}
          canViewSensitiveData={true}
        />
      );
      expect(screen.getByText("Conversion Funnel")).toBeTruthy();
    });

    it("uses default values for optional props", () => {
      render(
        <FunnelChart
          totalClicks={1000}
          totalConversions={100}
          totalCommissions={50}
          clickToConversionRate={10}
          conversionToCommissionRate={50}
          overallRate={5}
        />
      );
      // organicConversions defaults to 0, so organic text should not appear
      expect(screen.queryByText(/organic/)).toBeNull();
      // canViewSensitiveData defaults to true
      expect(screen.getByText("Conversion Funnel")).toBeTruthy();
    });
  });
});
