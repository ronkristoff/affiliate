import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SparklineChart } from "./SparklineChart";

describe("SparklineChart", () => {
  describe("Rendering with valid data", () => {
    it("renders with valid data array", () => {
      const data = [10, 20, 15, 25, 30];
      const { container } = render(<SparklineChart data={data} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with negative values", () => {
      const data = [-10, -5, 0, 5, 10];
      const { container } = render(<SparklineChart data={data} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with large values", () => {
      const data = [1000000, 2000000, 1500000, 3000000];
      const { container } = render(<SparklineChart data={data} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("renders with decimal values", () => {
      const data = [1.5, 2.3, 1.8, 3.1, 2.9];
      const { container } = render(<SparklineChart data={data} />);
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("Edge cases", () => {
    it("returns null for empty array", () => {
      const { container } = render(<SparklineChart data={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null for single element array", () => {
      const { container } = render(<SparklineChart data={[5]} />);
      // Single element returns null - not enough data for a line
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Props handling", () => {
    it("accepts custom color prop", () => {
      const data = [1, 2, 3, 4, 5];
      const { container } = render(<SparklineChart data={data} color="#FF0000" />);
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts custom height prop", () => {
      const data = [1, 2, 3, 4, 5];
      const { container } = render(<SparklineChart data={data} height={60} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts custom strokeWidth prop", () => {
      const data = [1, 2, 3, 4, 5];
      const { container } = render(<SparklineChart data={data} strokeWidth={3} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts showArea prop", () => {
      const data = [1, 2, 3, 4, 5];
      const { container } = render(<SparklineChart data={data} showArea={true} />);
      expect(container.firstChild).toBeTruthy();
    });

    it("accepts className prop", () => {
      const data = [1, 2, 3, 4, 5];
      const { container } = render(<SparklineChart data={data} className="test-class" />);
      expect(container.firstChild).toBeTruthy();
    });
  });
});
