import { describe, it, expect } from "vitest";
import {
  isInfrastructureError,
  withDegradation,
  isDegraded,
  type DegradedResponse,
} from "./lib/gracefulDegradation";

describe("isInfrastructureError", () => {
  it("returns true for timeout error", () => {
    const error = new Error("timeout");
    error.name = "TimeoutError";
    expect(isInfrastructureError(error)).toBe(true);
  });

  it("returns true for HTTP 503 error", () => {
    const error = new Error("Service Unavailable");
    Object.assign(error, { status: 503 });
    expect(isInfrastructureError(error)).toBe(true);
  });

  it("returns false for auth error (HTTP 401)", () => {
    const error = new Error("Unauthorized");
    Object.assign(error, { status: 401 });
    expect(isInfrastructureError(error)).toBe(false);
  });

  it("returns false for validation error (HTTP 400)", () => {
    const error = new Error("Bad Request");
    Object.assign(error, { status: 400 });
    expect(isInfrastructureError(error)).toBe(false);
  });

  it("returns true for data not found (unknown errors default to infrastructure for safety)", () => {
    // Generic error with no infrastructure indicators defaults to infrastructure (safe default)
    const error = new Error("Document not found");
    expect(isInfrastructureError(error)).toBe(true);
  });
});

describe("withDegradation", () => {
  it("returns data directly on success (not wrapped)", async () => {
    const result = await withDegradation(
      async () => ({ data: "hello" }),
      { data: "fallback" },
      "test reason",
    );
    expect(result).toEqual({ data: "hello" });
    expect(isDegraded(result)).toBe(false);
  });

  it("returns DegradedResponse on infrastructure error", async () => {
    const infraError = new Error("Service Unavailable");
    Object.assign(infraError, { status: 503 });

    const result = await withDegradation(
      async () => { throw infraError; },
      { data: "fallback" },
      "test reason",
    );

    expect(isDegraded(result)).toBe(true);
    if (isDegraded(result)) {
      expect(result._degraded).toBe(true);
      expect(result._degradedAt).toBeTypeOf("number");
      expect(result._fallbackReason).toBe("test reason");
      expect(result.data).toEqual({ data: "fallback" });
    }
  });

  it("returns DegradedResponse on network error", async () => {
    const result = await withDegradation(
      async () => { throw new Error("ECONNREFUSED"); },
      { data: "fallback" },
      "network failure",
    );

    expect(isDegraded(result)).toBe(true);
    if (isDegraded(result)) {
      expect(result._fallbackReason).toBe("network failure");
    }
  });

  it("re-throws auth errors (does NOT degrade)", async () => {
    const authError = new Error("Unauthorized");
    Object.assign(authError, { status: 401 });

    await expect(
      withDegradation(
        async () => { throw authError; },
        { data: "fallback" },
        "test reason",
      ),
    ).rejects.toThrow("Unauthorized");
  });

  it("re-throws validation errors (does NOT degrade)", async () => {
    const validationError = new Error("Bad Request");
    Object.assign(validationError, { status: 400 });

    await expect(
      withDegradation(
        async () => { throw validationError; },
        { data: "fallback" },
        "test reason",
      ),
    ).rejects.toThrow("Bad Request");
  });

  it("uses default fallback reason when none provided", async () => {
    const result = await withDegradation(
      async () => { throw new Error("fetch failed"); },
      { data: "default" },
    );

    expect(isDegraded(result)).toBe(true);
    if (isDegraded(result)) {
      expect(result._fallbackReason).toBe("Service temporarily unavailable");
    }
  });
});

describe("isDegraded", () => {
  it("returns true for degraded response", () => {
    const response: DegradedResponse<string> = {
      data: "test",
      _degraded: true,
      _degradedAt: Date.now(),
      _fallbackReason: "test",
    };
    expect(isDegraded(response)).toBe(true);
  });

  it("returns false for normal response", () => {
    expect(isDegraded("normal data")).toBe(false);
    expect(isDegraded(null)).toBe(false);
  });

  it("returns false for response with _degraded: false", () => {
    expect(isDegraded({ _degraded: false })).toBe(false);
  });
});

describe("DegradedResponse shape", () => {
  it("has correct shape after degradation", async () => {
    const result = await withDegradation(
      async () => { throw new Error("ECONNREFUSED"); },
      "fallback data",
      "connection failed",
    );

    if (isDegraded(result)) {
      expect(result).toHaveProperty("_degraded", true);
      expect(result).toHaveProperty("_degradedAt");
      expect(typeof result._degradedAt).toBe("number");
      expect(result).toHaveProperty("_fallbackReason");
      expect(typeof result._fallbackReason).toBe("string");
      expect(result).toHaveProperty("data");
      expect(result.data).toBe("fallback data");
    } else {
      // Should never happen
      expect.unreachable("Expected degraded response");
    }
  });
});
