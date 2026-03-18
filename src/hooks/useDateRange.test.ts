import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDateRange, getQueryDateRange, formatDateRangeLabel, dateInputToTimestamp, timestampToDateInput, getMaxDateInput } from "./useDateRange";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("useDateRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("range");
    mockSearchParams.delete("start");
    mockSearchParams.delete("end");
  });

  describe("initialization", () => {
    it("should default to 30 days when no URL params present", () => {
      const { result } = renderHook(() => useDateRange());

      expect(result.current.dateRange).toBeDefined();
      expect(result.current.dateRange?.label).toBe("Last 30 days");
      expect(result.current.dateRange?.isCustom).toBe(false);
      expect(result.current.dateRange?.preset).toBe("30d");
      expect(result.current.isCustomRange).toBe(false);
      expect(result.current.preset).toBe("30d");
    });

    it("should parse 7d preset from URL", () => {
      mockSearchParams.set("range", "7d");

      const { result } = renderHook(() => useDateRange());

      expect(result.current.dateRange?.label).toBe("Last 7 days");
      expect(result.current.dateRange?.preset).toBe("7d");
    });

    it("should parse 90d preset from URL", () => {
      mockSearchParams.set("range", "90d");

      const { result } = renderHook(() => useDateRange());

      expect(result.current.dateRange?.label).toBe("Last 90 days");
      expect(result.current.dateRange?.preset).toBe("90d");
    });

    it("should parse custom range from URL", () => {
      const start = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const end = Date.now();
      mockSearchParams.set("start", start.toString());
      mockSearchParams.set("end", end.toString());

      const { result } = renderHook(() => useDateRange());

      expect(result.current.dateRange?.isCustom).toBe(true);
      expect(result.current.isCustomRange).toBe(true);
      expect(result.current.dateRange?.start).toBe(start);
      expect(result.current.dateRange?.end).toBe(end);
    });
  });

  describe("setDateRange", () => {
    it("should update state and URL for preset range", () => {
      const { result } = renderHook(() => useDateRange());

      const newRange = {
        start: Date.now() - 7 * 24 * 60 * 60 * 1000,
        end: Date.now(),
        label: "Last 7 days",
        isCustom: false,
        preset: "7d",
      };

      act(() => {
        result.current.setDateRange(newRange);
      });

      expect(result.current.dateRange).toEqual(newRange);
      expect(mockPush).toHaveBeenCalledWith("?range=7d", { scroll: false });
    });

    it("should update state and URL for custom range", () => {
      const { result } = renderHook(() => useDateRange());

      const start = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const end = Date.now();
      const newRange = {
        start,
        end,
        label: "Nov 1 - Nov 15, 2024",
        isCustom: true,
      };

      act(() => {
        result.current.setDateRange(newRange);
      });

      expect(result.current.dateRange).toEqual(newRange);
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining(`start=${start}`),
        { scroll: false }
      );
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining(`end=${end}`),
        { scroll: false }
      );
    });

    it("should remove custom params when setting preset", () => {
      mockSearchParams.set("start", "123456");
      mockSearchParams.set("end", "789012");

      const { result } = renderHook(() => useDateRange());

      const newRange = {
        start: Date.now() - 7 * 24 * 60 * 60 * 1000,
        end: Date.now(),
        label: "Last 7 days",
        isCustom: false,
        preset: "7d",
      };

      act(() => {
        result.current.setDateRange(newRange);
      });

      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("start="),
        { scroll: false }
      );
    });
  });

  describe("customStart and customEnd", () => {
    it("should return null for custom dates when using preset", () => {
      mockSearchParams.set("range", "30d");

      const { result } = renderHook(() => useDateRange());

      expect(result.current.customStart).toBeNull();
      expect(result.current.customEnd).toBeNull();
    });

    it("should return timestamps for custom dates when using custom range", () => {
      const start = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const end = Date.now();
      mockSearchParams.set("start", start.toString());
      mockSearchParams.set("end", end.toString());

      const { result } = renderHook(() => useDateRange());

      expect(result.current.customStart).toBe(start);
      expect(result.current.customEnd).toBe(end);
    });
  });

  describe("last month calculation", () => {
    it("should correctly calculate last month range in January", () => {
      // Mock Date to be January 15, 2024
      const mockDate = new Date("2024-01-15T00:00:00Z");
      vi.setSystemTime(mockDate);

      mockSearchParams.set("range", "lastMonth");

      const { result } = renderHook(() => useDateRange());

      const expectedStart = new Date("2023-12-01T00:00:00Z").getTime();
      const expectedEnd = new Date("2023-12-31T23:59:59.999Z").getTime();

      // Check that start is Dec 1, 2023 and end is Dec 31, 2023
      const startDate = new Date(result.current.dateRange!.start);
      const endDate = new Date(result.current.dateRange!.end);

      expect(startDate.getMonth()).toBe(11); // December (0-indexed)
      expect(startDate.getFullYear()).toBe(2023);
      expect(endDate.getMonth()).toBe(11); // December
      expect(endDate.getFullYear()).toBe(2023);

      vi.useRealTimers();
    });
  });
});

describe("getQueryDateRange", () => {
  it("should return undefined when dateRange is undefined", () => {
    expect(getQueryDateRange(undefined)).toBeUndefined();
  });

  it("should return start and end when dateRange is defined", () => {
    const dateRange = {
      start: 1234567890,
      end: 1234569999,
      label: "Test Range",
      isCustom: false,
    };

    const result = getQueryDateRange(dateRange);

    expect(result).toEqual({ start: 1234567890, end: 1234569999 });
  });
});

describe("formatDateRangeLabel", () => {
  it("should format date range correctly", () => {
    const start = new Date("2024-01-15").getTime();
    const end = new Date("2024-02-20").getTime();

    const result = formatDateRangeLabel(start, end);

    expect(result).toContain("Jan");
    expect(result).toContain("Feb");
    expect(result).toContain("2024");
  });
});

describe("dateInputToTimestamp", () => {
  it("should return 0 for empty string", () => {
    expect(dateInputToTimestamp("")).toBe(0);
  });

  it("should convert date input to end-of-day timestamp", () => {
    const result = dateInputToTimestamp("2024-01-15");
    const date = new Date(result);

    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
  });
});

describe("timestampToDateInput", () => {
  it("should return empty string for 0 timestamp", () => {
    expect(timestampToDateInput(0)).toBe("");
  });

  it("should convert timestamp to YYYY-MM-DD format", () => {
    const timestamp = new Date("2024-01-15T12:30:00").getTime();
    const result = timestampToDateInput(timestamp);

    expect(result).toBe("2024-01-15");
  });
});

describe("getMaxDateInput", () => {
  it("should return today's date in YYYY-MM-DD format", () => {
    const result = getMaxDateInput();
    const today = new Date().toISOString().split("T")[0];

    expect(result).toBe(today);
  });
});
