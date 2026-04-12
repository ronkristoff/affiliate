import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRateLimitKey, extractIp, ENDPOINT_CONFIGS, RateLimitError } from "./lib/rateLimiter";

describe("buildRateLimitKey", () => {
  it("constructs click tracking keys", () => {
    expect(buildRateLimitKey("click", "ABC123")).toBe("click:ABC123");
    expect(buildRateLimitKey("click:global", "192.168.1.1")).toBe("click:global:192.168.1.1");
  });

  it("constructs conversion tracking keys", () => {
    expect(buildRateLimitKey("conversion", "tenant123")).toBe("conversion:tenant123");
    expect(buildRateLimitKey("conversion:global", "10.0.0.1")).toBe("conversion:global:10.0.0.1");
  });

  it("constructs coupon validation keys", () => {
    expect(buildRateLimitKey("coupon", "tenant456")).toBe("coupon:tenant456");
  });

  it("constructs broadcast keys", () => {
    expect(buildRateLimitKey("broadcast", "tenant789")).toBe("broadcast:tenant789");
  });

  it("constructs DNS verification keys", () => {
    expect(buildRateLimitKey("dns", "tenant999")).toBe("dns:tenant999");
  });
});

describe("extractIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(extractIp(req)).toBe("203.0.113.50");
  });

  it("handles single IP in x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    expect(extractIp(req)).toBe("192.168.1.1");
  });

  it("trims whitespace around IP", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  10.0.0.1  , 20.0.0.2" },
    });
    expect(extractIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no x-forwarded-for header", () => {
    const req = new Request("http://localhost");
    expect(extractIp(req)).toBe("unknown");
  });

  it("returns 'unknown' when header is empty", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "" },
    });
    expect(extractIp(req)).toBe("unknown");
  });
});

describe("ENDPOINT_CONFIGS", () => {
  it("has valid configs for all 7 endpoint types", () => {
    const expectedEndpoints = [
      "click", "click:global", "conversion", "conversion:global",
      "coupon", "broadcast", "bulk", "export", "dns",
    ];

    for (const endpoint of expectedEndpoints) {
      const config = ENDPOINT_CONFIGS[endpoint];
      expect(config).toBeDefined();
      expect(config.limit).toBeGreaterThan(0);
      expect(config.windowDurationMs).toBeGreaterThan(0);
    }
  });

  it("has generous limits for conversion tracking", () => {
    expect(ENDPOINT_CONFIGS.conversion.limit).toBe(60);
  });

  it("has strict limits for broadcast creation", () => {
    expect(ENDPOINT_CONFIGS.broadcast.limit).toBe(1);
    expect(ENDPOINT_CONFIGS.broadcast.windowDurationMs).toBe(300_000); // 5 min
  });

  it("has strict limits for export", () => {
    expect(ENDPOINT_CONFIGS.export.limit).toBe(3);
  });

  it("has per-minute DNS verification limits", () => {
    expect(ENDPOINT_CONFIGS.dns.limit).toBe(5);
  });
});

describe("RateLimitError", () => {
  it("has correct properties", () => {
    const error = new RateLimitError("click:ABC123", Date.now() + 30000);
    expect(error.name).toBe("RateLimitError");
    expect(error.statusCode).toBe(429);
    expect(error.key).toBe("click:ABC123");
    expect(error.resetsAt).toBeGreaterThan(Date.now());
    expect(error.message).toContain("click:ABC123");
  });
});
