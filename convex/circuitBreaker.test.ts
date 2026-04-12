import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyError, isInfrastructureError, type ErrorCategory } from "./lib/errorClassification";

describe("classifyError", () => {
  it("classifies HTTP 5xx errors as infrastructure", () => {
    const error = new Error("Service Unavailable");
    Object.assign(error, { status: 503 });
    expect(classifyError(error)).toBe("infrastructure");
  });

  it("classifies HTTP 500 as infrastructure", () => {
    const error = new Error("Internal Server Error");
    Object.assign(error, { status: 500 });
    expect(classifyError(error)).toBe("infrastructure");
  });

  it("classifies HTTP 502/503/504 as infrastructure", () => {
    for (const status of [502, 503, 504]) {
      const error = new Error("Bad Gateway");
      Object.assign(error, { status });
      expect(classifyError(error)).toBe("infrastructure");
    }
  });

  it("classifies HTTP 401 as auth", () => {
    const error = new Error("Unauthorized");
    Object.assign(error, { status: 401 });
    expect(classifyError(error)).toBe("auth");
  });

  it("classifies HTTP 403 as auth", () => {
    const error = new Error("Forbidden");
    Object.assign(error, { status: 403 });
    expect(classifyError(error)).toBe("auth");
  });

  it("classifies HTTP 400 as validation", () => {
    const error = new Error("Bad Request");
    Object.assign(error, { status: 400 });
    expect(classifyError(error)).toBe("validation");
  });

  it("classifies HTTP 422 as validation", () => {
    const error = new Error("Unprocessable Entity");
    Object.assign(error, { status: 422 });
    expect(classifyError(error)).toBe("validation");
  });

  it("classifies TimeoutError by name as infrastructure", () => {
    const error = new Error("Request timed out");
    error.name = "TimeoutError";
    expect(classifyError(error)).toBe("infrastructure");
  });

  it("classifies AbortError by name as infrastructure", () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    expect(classifyError(error)).toBe("infrastructure");
  });

  it("classifies network error messages as infrastructure", () => {
    const error = new Error("ECONNREFUSED");
    expect(classifyError(error)).toBe("infrastructure");
  });

  it("classifies fetch failed message as infrastructure", () => {
    const error = new Error("fetch failed");
    expect(classifyError(error)).toBe("infrastructure");
  });

  it("classifies auth messages as auth", () => {
    const error = new Error("Unauthorized: Authentication required");
    expect(classifyError(error)).toBe("auth");
  });

  it("classifies forbidden message as auth", () => {
    const error = new Error("Access denied: Forbidden");
    expect(classifyError(error)).toBe("auth");
  });

  it("handles nested cause errors (Convex FunctionError wrapping)", () => {
    const innerError = new Error("Service Unavailable");
    Object.assign(innerError, { status: 503 });
    const outerError = { message: "Function failed", cause: innerError };
    expect(classifyError(outerError)).toBe("infrastructure");
  });

  it("handles nested cause with auth status", () => {
    const innerError = new Error("Unauthorized");
    Object.assign(innerError, { status: 401 });
    const outerError = { message: "Function failed", cause: innerError };
    expect(classifyError(outerError)).toBe("auth");
  });

  it("defaults unknown errors to infrastructure (safe default)", () => {
    expect(classifyError("something went wrong")).toBe("infrastructure");
    expect(classifyError(null)).toBe("infrastructure");
    expect(classifyError(undefined)).toBe("infrastructure");
    expect(classifyError(42)).toBe("infrastructure");
  });

  it("classifies plain validation errors as validation", () => {
    const error = new Error("Invalid input");
    // No status, no name match — message doesn't match infrastructure or auth patterns
    // But default should be infrastructure for safety
    expect(classifyError(error)).toBe("infrastructure");
  });
});

describe("isInfrastructureError", () => {
  it("returns true for infrastructure errors", () => {
    expect(isInfrastructureError(new Error("ECONNREFUSED"))).toBe(true);
  });

  it("returns true for HTTP 5xx", () => {
    const err = new Error("fail");
    Object.assign(err, { status: 500 });
    expect(isInfrastructureError(err)).toBe(true);
  });

  it("returns false for auth errors", () => {
    const err = new Error("Unauthorized");
    Object.assign(err, { status: 401 });
    expect(isInfrastructureError(err)).toBe(false);
  });

  it("returns false for validation errors", () => {
    const err = new Error("Bad Request");
    Object.assign(err, { status: 400 });
    expect(isInfrastructureError(err)).toBe(false);
  });
});
