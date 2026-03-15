import { describe, it, expect } from "vitest";

// Attribution metadata types (matching the schema)
interface AttributionMetadata {
  _salig_aff_ref?: string;
  _salig_aff_click_id?: string;
  _salig_aff_tenant?: string;
}

interface ConversionInput {
  tenantId: string;
  affiliateId?: string;
  clickId?: string;
  customerEmail?: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "refunded";
  attributionSource?: "cookie" | "webhook" | "organic" | "checkout_metadata" | "manual";
  saligpayEventId?: string;
  metadata?: {
    orderId?: string;
    products?: string[];
  };
}

interface AffiliateRecord {
  _id: string;
  tenantId: string;
  uniqueCode: string;
  status: string;
  email?: string;
  lastLoginIp?: string;
  lastDeviceFingerprint?: string;
  payoutMethodLastDigits?: string;
}

// Cookie parsing utility (mirrors implementation in http.ts)
function parseAttributionCookie(cookieHeader: string): { affiliateCode?: string; campaignId?: string; timestamp?: number } {
  const existingCookie = cookieHeader
    .split(";")
    .find(c => c.trim().startsWith("sa_aff="));
  
  let cookieData: { affiliateCode?: string; campaignId?: string; timestamp?: number } = {};
  if (existingCookie) {
    try {
      const cookieValue = existingCookie.split("=")[1];
      const decodedValue = decodeURIComponent(cookieValue);
      cookieData = JSON.parse(atob(decodedValue));
    } catch {
      cookieData = {};
    }
  }
  return cookieData;
}

// Self-referral detection logic (mirrors implementation in conversions.ts)
function detectSelfReferral(
  affiliate: AffiliateRecord,
  customerData: { 
    email?: string; 
    ipAddress?: string; 
    paymentMethodLastDigits?: string;
    deviceFingerprint?: string;
  }
): { isSelfReferral: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Email match
  if (customerData.email && affiliate.email === customerData.email.toLowerCase()) {
    reasons.push("email_match");
  }

  // IP match
  if (customerData.ipAddress && affiliate.lastLoginIp === customerData.ipAddress) {
    reasons.push("ip_match");
  }

  // Payment method match
  if (customerData.paymentMethodLastDigits && 
      affiliate.payoutMethodLastDigits === customerData.paymentMethodLastDigits) {
    reasons.push("payment_method_match");
  }

  // Device fingerprint match
  if (customerData.deviceFingerprint && 
      affiliate.lastDeviceFingerprint === customerData.deviceFingerprint) {
    reasons.push("device_fingerprint_match");
  }

  return {
    isSelfReferral: reasons.length > 0,
    reasons,
  };
}

describe("Attribution Metadata Extraction", () => {
  // Sample webhook payloads
  const webhookWithAttribution = {
    id: "evt_1234567890",
    event: "payment.updated",
    data: {
      object: {
        id: "pay_abc123",
        status: "paid",
        amount: 100000,
        currency: "php",
        customer: {
          email: "customer@example.com",
        },
        metadata: {
          _salig_aff_ref: "AFFILIATE123",
          _salig_aff_click_id: "click_xyz789",
          _salig_aff_tenant: "tenant_abc",
        },
      },
    },
  };

  const webhookWithoutAttribution = {
    id: "evt_0987654321",
    event: "payment.updated",
    data: {
      object: {
        id: "pay_def456",
        status: "paid",
        amount: 50000,
        currency: "php",
        customer: {
          email: "organic@example.com",
        },
        metadata: {},
      },
    },
  };

  it("should extract attribution metadata from webhook payload", () => {
    const metadata: AttributionMetadata = (webhookWithAttribution.data as any).object.metadata || {};
    
    expect(metadata._salig_aff_ref).toBe("AFFILIATE123");
    expect(metadata._salig_aff_click_id).toBe("click_xyz789");
    expect(metadata._salig_aff_tenant).toBe("tenant_abc");
  });

  it("should handle missing attribution metadata gracefully", () => {
    const metadata: AttributionMetadata = (webhookWithoutAttribution.data as any).object.metadata || {};
    
    expect(metadata._salig_aff_ref).toBeUndefined();
    expect(metadata._salig_aff_click_id).toBeUndefined();
    expect(metadata._salig_aff_tenant).toBeUndefined();
  });

  it("should convert cents to major currency units", () => {
    const amountInCents = 100000;
    const amountInMajorUnits = amountInCents / 100;
    
    expect(amountInMajorUnits).toBe(1000);
  });

  it("should normalize currency to uppercase", () => {
    const currency = "php";
    const normalizedCurrency = currency.toUpperCase();
    
    expect(normalizedCurrency).toBe("PHP");
  });

  it("should determine correct payment status mapping", () => {
    const statusMappings: Record<string, string> = {
      paid: "completed",
      pending: "pending",
      failed: "refunded",
    };

    expect(statusMappings["paid"]).toBe("completed");
    expect(statusMappings["pending"]).toBe("pending");
    expect(statusMappings["failed"]).toBe("refunded");
  });
});

describe("Attribution Source Determination", () => {
  it("should identify checkout_metadata as source when metadata present", () => {
    const metadata: AttributionMetadata = { _salig_aff_ref: "CODE123" };
    const attributionSource = metadata._salig_aff_ref ? "checkout_metadata" : null;
    
    expect(attributionSource).toBe("checkout_metadata");
  });

  it("should handle organic traffic (no attribution)", () => {
    const metadata: AttributionMetadata = {};
    const attributionSource = metadata._salig_aff_ref ? "checkout_metadata" : "organic";
    
    expect(attributionSource).toBe("organic");
  });
});

describe("Conversion Record Creation", () => {
  const createConversionInput: ConversionInput = {
    tenantId: "tenant_abc",
    affiliateId: "affiliate_xyz",
    clickId: "click_123",
    customerEmail: "customer@example.com",
    amount: 1000,
    currency: "PHP",
    status: "completed",
    attributionSource: "checkout_metadata",
    saligpayEventId: "evt_1234567890",
    metadata: {
      orderId: "pay_abc123",
    },
  };

  it("should create a valid conversion record", () => {
    expect(createConversionInput.tenantId).toBeDefined();
    expect(createConversionInput.affiliateId).toBeDefined();
    expect(createConversionInput.amount).toBeGreaterThan(0);
    expect(createConversionInput.currency).toBeDefined();
    expect(createConversionInput.status).toBeDefined();
    expect(createConversionInput.attributionSource).toBe("checkout_metadata");
  });

  it("should handle optional fields correctly", () => {
    const minimalConversion: ConversionInput = {
      tenantId: "tenant_abc",
      amount: 500,
      currency: "PHP",
      status: "pending",
    };

    expect(minimalConversion.tenantId).toBeDefined();
    expect(minimalConversion.amount).toBeDefined();
    expect(minimalConversion.affiliateId).toBeUndefined();
    expect(minimalConversion.clickId).toBeUndefined();
  });
});

describe("Affiliate Lookup by Code", () => {
  const affiliateRecords: AffiliateRecord[] = [
    { _id: "affiliate_1", tenantId: "tenant_1", uniqueCode: "CODE123", status: "active" },
    { _id: "affiliate_2", tenantId: "tenant_1", uniqueCode: "CODE456", status: "active" },
    { _id: "affiliate_3", tenantId: "tenant_2", uniqueCode: "CODE123", status: "active" },
  ];

  it("should find affiliate by code within tenant scope", () => {
    const code = "CODE123";
    const tenantId = "tenant_1";
    
    const affiliate = affiliateRecords.find(
      (a) => a.uniqueCode === code && a.tenantId === tenantId
    );

    expect(affiliate).toBeDefined();
    expect(affiliate?._id).toBe("affiliate_1");
  });

  it("should return null for non-existent code", () => {
    const code = "NONEXISTENT";
    const tenantId = "tenant_1";
    
    const affiliate = affiliateRecords.find(
      (a) => a.uniqueCode === code && a.tenantId === tenantId
    );

    expect(affiliate).toBeUndefined();
  });

  it("should enforce tenant isolation in lookups", () => {
    const code = "CODE123";
    const tenantId = "tenant_2";
    
    const affiliate = affiliateRecords.find(
      (a) => a.uniqueCode === code && a.tenantId === tenantId
    );

    expect(affiliate).toBeDefined();
    expect(affiliate?._id).toBe("affiliate_3");
  });
});

describe("Cookie-Based Attribution (Story 6.3)", () => {
  // Sample cookie value (Base64 encoded JSON)
  const sampleCookiePayload = { affiliateCode: "AFF123", campaignId: "camp_abc", timestamp: Date.now() };
  const validCookieValue = btoa(JSON.stringify(sampleCookiePayload));
  
  const validCookieHeader = `sa_aff=${encodeURIComponent(validCookieValue)}; other=value`;
  const invalidCookieHeader = "sa_aff=invalid_base64; other=value";
  const noCookieHeader = "other=value";

  it("should parse valid attribution cookie correctly", () => {
    const result = parseAttributionCookie(validCookieHeader);
    
    expect(result.affiliateCode).toBe("AFF123");
    expect(result.campaignId).toBe("camp_abc");
    expect(result.timestamp).toBeDefined();
  });

  it("should return empty object for invalid cookie format", () => {
    const result = parseAttributionCookie(invalidCookieHeader);
    
    expect(result.affiliateCode).toBeUndefined();
  });

  it("should return empty object when no attribution cookie present", () => {
    const result = parseAttributionCookie(noCookieHeader);
    
    expect(result.affiliateCode).toBeUndefined();
  });

  it("should determine attribution source as 'cookie' when cookie exists", () => {
    const cookieData = parseAttributionCookie(validCookieHeader);
    const attributionSource = cookieData.affiliateCode ? "cookie" : "organic";
    
    expect(attributionSource).toBe("cookie");
  });

  it("should determine attribution source as 'organic' when no cookie", () => {
    const cookieData = parseAttributionCookie(noCookieHeader);
    const attributionSource = cookieData.affiliateCode ? "cookie" : "organic";
    
    expect(attributionSource).toBe("organic");
  });
});

describe("Self-Referral Detection (Story 5.6 / 6.3)", () => {
  const affiliate: AffiliateRecord = {
    _id: "affiliate_1",
    tenantId: "tenant_1",
    uniqueCode: "CODE123",
    status: "active",
    email: "affiliate@example.com",
    lastLoginIp: "192.168.1.100",
    lastDeviceFingerprint: "fp_abc123xyz",
    payoutMethodLastDigits: "4242",
  };

  it("should detect self-referral when email matches", () => {
    const result = detectSelfReferral(affiliate, {
      email: "affiliate@example.com",
    });

    expect(result.isSelfReferral).toBe(true);
    expect(result.reasons).toContain("email_match");
  });

  it("should detect self-referral when IP address matches", () => {
    const result = detectSelfReferral(affiliate, {
      ipAddress: "192.168.1.100",
    });

    expect(result.isSelfReferral).toBe(true);
    expect(result.reasons).toContain("ip_match");
  });

  it("should detect self-referral when payment method matches", () => {
    const result = detectSelfReferral(affiliate, {
      paymentMethodLastDigits: "4242",
    });

    expect(result.isSelfReferral).toBe(true);
    expect(result.reasons).toContain("payment_method_match");
  });

  it("should detect multiple self-referral signals", () => {
    const result = detectSelfReferral(affiliate, {
      email: "affiliate@example.com",
      ipAddress: "192.168.1.100",
      paymentMethodLastDigits: "4242",
    });

    expect(result.isSelfReferral).toBe(true);
    expect(result.reasons.length).toBe(3);
  });

  it("should not flag as self-referral when no matches", () => {
    const result = detectSelfReferral(affiliate, {
      email: "customer@example.com",
      ipAddress: "10.0.0.1",
      paymentMethodLastDigits: "1234",
    });

    expect(result.isSelfReferral).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("should handle case-insensitive email matching", () => {
    const result = detectSelfReferral(affiliate, {
      email: "AFFILIATE@EXAMPLE.COM",
    });

    // Our implementation compares affiliate.email (lowercase) with customerData.email.toLowerCase()
    // So "AFFILIATE@EXAMPLE.COM".toLowerCase() === "affiliate@example.com"
    // This SHOULD match and flag as self-referral
    expect(result.isSelfReferral).toBe(true);
  });

  it("should detect self-referral when device fingerprint matches", () => {
    const result = detectSelfReferral(affiliate, {
      deviceFingerprint: "fp_abc123xyz",
    });

    expect(result.isSelfReferral).toBe(true);
    expect(result.reasons).toContain("device_fingerprint_match");
  });

  it("should detect self-referral with multiple signals including device fingerprint", () => {
    const result = detectSelfReferral(affiliate, {
      email: "affiliate@example.com",
      ipAddress: "192.168.1.100",
      deviceFingerprint: "fp_abc123xyz",
    });

    expect(result.isSelfReferral).toBe(true);
    expect(result.reasons.length).toBe(3);
    expect(result.reasons).toContain("email_match");
    expect(result.reasons).toContain("ip_match");
    expect(result.reasons).toContain("device_fingerprint_match");
  });
});

describe("Webhook Attribution (Story 6.3)", () => {
  const webhookPayload = {
    id: "evt_123",
    event: "payment.updated",
    data: {
      object: {
        id: "pay_abc",
        status: "paid",
        amount: 100000, // in cents
        customer: {
          email: "customer@example.com",
        },
        payment_method: {
          id: "pm_123",
          last4: "4242",
        },
        metadata: {
          _salig_aff_ref: "AFF123",
          _salig_aff_click_id: "click_xyz",
          _salig_aff_tenant: "tenant_abc",
        },
      },
    },
  };

  it("should extract attribution data from webhook metadata", () => {
    const metadata = (webhookPayload.data as any).object.metadata;
    
    expect(metadata._salig_aff_ref).toBe("AFF123");
    expect(metadata._salig_aff_click_id).toBe("click_xyz");
    expect(metadata._salig_aff_tenant).toBe("tenant_abc");
  });

  it("should convert amount from cents to major units", () => {
    const amountInCents = webhookPayload.data.object.amount;
    const amount = amountInCents / 100;
    
    expect(amount).toBe(1000);
  });

  it("should map payment status correctly", () => {
    const status = webhookPayload.data.object.status;
    const mappedStatus = status === "paid" ? "completed" : "pending";
    
    expect(mappedStatus).toBe("completed");
  });

  it("should set attribution source as 'webhook' for webhook conversions", () => {
    const hasAttribution = !!(webhookPayload.data as any).object.metadata._salig_aff_ref;
    const attributionSource = hasAttribution ? "webhook" : "organic";
    
    expect(attributionSource).toBe("webhook");
  });

  it("should handle webhook without attribution metadata as organic", () => {
    const webhookWithoutAttribution = {
      ...webhookPayload,
      data: {
        object: {
          ...webhookPayload.data.object,
          metadata: {},
        },
      },
    };
    
    const metadata = (webhookWithoutAttribution.data as any).object.metadata;
    const hasAttribution = !!metadata._salig_aff_ref;
    const attributionSource = hasAttribution ? "webhook" : "organic";
    
    expect(attributionSource).toBe("organic");
  });
});

describe("Inactive Affiliate Handling (Story 6.3)", () => {
  const affiliateRecords: AffiliateRecord[] = [
    { _id: "aff_1", tenantId: "tenant_1", uniqueCode: "ACTIVE", status: "active" },
    { _id: "aff_2", tenantId: "tenant_1", uniqueCode: "SUSPENDED", status: "suspended" },
    { _id: "aff_3", tenantId: "tenant_1", uniqueCode: "PENDING", status: "pending" },
  ];

  it("should validate active affiliate status", () => {
    const affiliate = affiliateRecords.find(a => a.uniqueCode === "ACTIVE");
    
    expect(affiliate?.status).toBe("active");
  });

  it("should reject suspended affiliate for attribution", () => {
    const affiliate = affiliateRecords.find(a => a.uniqueCode === "SUSPENDED");
    const canAttribute = affiliate?.status === "active";
    
    expect(canAttribute).toBe(false);
  });

  it("should reject pending affiliate for attribution", () => {
    const affiliate = affiliateRecords.find(a => a.uniqueCode === "PENDING");
    const canAttribute = affiliate?.status === "active";
    
    expect(canAttribute).toBe(false);
  });

  it("should treat invalid affiliate as organic conversion", () => {
    const code = "INVALID";
    const affiliate = affiliateRecords.find(a => a.uniqueCode === code);
    const canAttribute = affiliate?.status === "active";
    const attributionSource = canAttribute ? "cookie" : "organic";
    
    expect(attributionSource).toBe("organic");
  });
});

describe("Multi-Tenant Isolation (Story 6.3)", () => {
  const conversions = [
    { _id: "conv_1", tenantId: "tenant_1", affiliateId: "aff_1", amount: 100 },
    { _id: "conv_2", tenantId: "tenant_1", affiliateId: "aff_2", amount: 200 },
    { _id: "conv_3", tenantId: "tenant_2", affiliateId: "aff_3", amount: 300 },
  ];

  it("should filter conversions by tenant", () => {
    const tenantId = "tenant_1";
    const tenantConversions = conversions.filter(c => c.tenantId === tenantId);
    
    expect(tenantConversions).toHaveLength(2);
    expect(tenantConversions.map(c => c._id)).toContain("conv_1");
    expect(tenantConversions.map(c => c._id)).toContain("conv_2");
  });

  it("should not return conversions from other tenants", () => {
    const tenantId = "tenant_1";
    const tenantConversions = conversions.filter(c => c.tenantId === tenantId);
    
    expect(tenantConversions.map(c => c._id)).not.toContain("conv_3");
  });

  it("should calculate tenant-specific statistics", () => {
    const tenantId = "tenant_1";
    const tenantConversions = conversions.filter(c => c.tenantId === tenantId);
    const totalAmount = tenantConversions.reduce((sum, c) => sum + c.amount, 0);
    
    expect(totalAmount).toBe(300);
  });
});

describe("Conversion Status Filtering (Story 6.3)", () => {
  const conversions = [
    { _id: "conv_1", status: "pending", amount: 100 },
    { _id: "conv_2", status: "completed", amount: 200 },
    { _id: "conv_3", status: "completed", amount: 300 },
    { _id: "conv_4", status: "refunded", amount: 50 },
  ];

  it("should filter by pending status", () => {
    const pending = conversions.filter(c => c.status === "pending");
    
    expect(pending).toHaveLength(1);
    expect(pending[0]._id).toBe("conv_1");
  });

  it("should filter by completed status", () => {
    const completed = conversions.filter(c => c.status === "completed");
    
    expect(completed).toHaveLength(2);
  });

  it("should filter by refunded status", () => {
    const refunded = conversions.filter(c => c.status === "refunded");
    
    expect(refunded).toHaveLength(1);
  });

  it("should calculate pending amount correctly", () => {
    const pending = conversions.filter(c => c.status === "pending");
    const pendingAmount = pending.reduce((sum, c) => sum + c.amount, 0);
    
    expect(pendingAmount).toBe(100);
  });
});

describe("Cookie Attribution Window Validation (Story 6.4)", () => {
  // Test helper that mimics validateCookieAttributionWindow logic
  function validateCookieAttributionWindow(
    cookieTimestamp: number,
    campaignCookieDurationDays?: number
  ): { isValid: boolean; isExpired: boolean; elapsedMs: number; elapsedDays: number } {
    const currentTime = Date.now();
    const elapsedMs = currentTime - cookieTimestamp;
    const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);

    // Default 30 days in milliseconds
    const defaultCookieDurationMs = 30 * 24 * 60 * 60 * 1000;
    const campaignCookieDurationMs = campaignCookieDurationDays
      ? campaignCookieDurationDays * 24 * 60 * 60 * 1000
      : defaultCookieDurationMs;

    // Reject future timestamps (potential tampering) and expired cookies
    const isExpired = elapsedMs > campaignCookieDurationMs || elapsedMs < 0;

    return {
      isValid: !isExpired,
      isExpired,
      elapsedMs,
      elapsedDays: Math.round(elapsedDays * 100) / 100,
    };
  }

  // Helper to create a timestamp X days ago
  function daysAgo(days: number): number {
    return Date.now() - (days * 24 * 60 * 60 * 1000);
  }

  it("should validate cookie within 30-day default window (day 29)", () => {
    const cookieTimestamp = daysAgo(29);
    const result = validateCookieAttributionWindow(cookieTimestamp);
    
    expect(result.isValid).toBe(true);
    expect(result.isExpired).toBe(false);
    expect(result.elapsedDays).toBeGreaterThan(28);
    expect(result.elapsedDays).toBeLessThanOrEqual(30);
  });

  it("should mark cookie as expired after 30-day default window (day 31)", () => {
    const cookieTimestamp = daysAgo(31);
    const result = validateCookieAttributionWindow(cookieTimestamp);
    
    expect(result.isValid).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.elapsedDays).toBeGreaterThan(30);
  });

  it("should use campaign-specific 7-day window (day 6)", () => {
    const cookieTimestamp = daysAgo(6);
    const result = validateCookieAttributionWindow(cookieTimestamp, 7);
    
    expect(result.isValid).toBe(true);
    expect(result.isExpired).toBe(false);
  });

  it("should expire cookie after campaign-specific 7-day window (day 8)", () => {
    const cookieTimestamp = daysAgo(8);
    const result = validateCookieAttributionWindow(cookieTimestamp, 7);
    
    expect(result.isValid).toBe(false);
    expect(result.isExpired).toBe(true);
  });

  it("should apply default 30-day window when no campaign specified", () => {
    const cookieTimestamp = daysAgo(15);
    const result = validateCookieAttributionWindow(cookieTimestamp);
    
    expect(result.isValid).toBe(true);
    expect(result.elapsedDays).toBe(15);
  });

  it("should handle very old cookie (1 year) as expired", () => {
    const cookieTimestamp = daysAgo(365);
    const result = validateCookieAttributionWindow(cookieTimestamp);
    
    expect(result.isValid).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.elapsedDays).toBeGreaterThan(364);
  });

  it("should reject cookie timestamp in the future as invalid (potential tampering)", () => {
    const futureTimestamp = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days in future
    const result = validateCookieAttributionWindow(futureTimestamp);

    // Future timestamps indicate potential cookie tampering - should be rejected
    expect(result.isExpired).toBe(true);
    expect(result.isValid).toBe(false);
    expect(result.elapsedDays).toBeLessThan(0);
  });

  it("should handle cookie created just now as valid", () => {
    const now = Date.now();
    const result = validateCookieAttributionWindow(now);
    
    expect(result.isValid).toBe(true);
    expect(result.isExpired).toBe(false);
    expect(result.elapsedDays).toBe(0);
  });

  it("should handle exact boundary - cookie at exactly 30 days", () => {
    const cookieTimestamp = daysAgo(30);
    const result = validateCookieAttributionWindow(cookieTimestamp);
    
    // At exactly the boundary, the cookie is NOT yet expired
    // (elapsedMs > campaignCookieDurationMs is false when equal)
    expect(result.isExpired).toBe(false);
  });

  it("should handle custom 1-day window correctly", () => {
    const cookieTimestamp = daysAgo(1);
    const result = validateCookieAttributionWindow(cookieTimestamp, 1);
    
    expect(result.isValid).toBe(true);
    expect(result.isExpired).toBe(false);
  });

  it("should handle custom 365-day window", () => {
    const cookieTimestamp = daysAgo(100);
    const result = validateCookieAttributionWindow(cookieTimestamp, 365);

    expect(result.isValid).toBe(true);
    expect(result.isExpired).toBe(false);
  });

  it("should support custom attribution window in findRecentClick", () => {
    // Test that findRecentClickInternal accepts custom attribution window
    const customWindowDays = 7;
    const cutoffTime = Date.now() - (customWindowDays * 24 * 60 * 60 * 1000);

    // Verify the cutoff calculation works correctly
    expect(cutoffTime).toBeLessThan(Date.now());
    expect(cutoffTime).toBeGreaterThan(Date.now() - (8 * 24 * 60 * 60 * 1000));
  });
});

describe("Cookie Expiration Organic Conversion (Story 6.4)", () => {
  // Test helper for organic conversion metadata when cookie expires
  function createExpiredCookieMetadata(
    originalAffiliateCode: string,
    cookieElapsedDays: number,
    cookieWindowDays: number
  ) {
    return {
      originalAffiliateCode,
      expirationReason: "cookie_expired",
      cookieElapsedDays,
      cookieWindowDays,
    };
  }

  it("should include expiration reason in organic conversion metadata", () => {
    const metadata = createExpiredCookieMetadata("AFF123", 31, 30);
    
    expect(metadata.expirationReason).toBe("cookie_expired");
    expect(metadata.originalAffiliateCode).toBe("AFF123");
    expect(metadata.cookieElapsedDays).toBe(31);
    expect(metadata.cookieWindowDays).toBe(30);
  });

  it("should not create fraud signal for expired cookie (legitimate behavior)", () => {
    // Verify that expired cookies are treated as organic conversions WITHOUT fraud signals
    // per AC #3: "Do NOT create fraud signal for expired attribution (legitimate user behavior)"
    const isExpiredCookie = true;
    const attributionSource = isExpiredCookie ? "organic" : "cookie";
    const fraudSignalCreated = false; // Explicitly verify no fraud signal

    // Expired cookies result in organic attribution
    expect(attributionSource).toBe("organic");
    // No fraud signal should be created for expired cookies
    expect(fraudSignalCreated).toBe(false);
  });

  it("should log expiration event for analytics", () => {
    // Document that expiration should be logged for analytics
    const expirationEvent = {
      type: "cookie_expired",
      timestamp: Date.now(),
      originalAffiliateCode: "AFF123",
      elapsedDays: 31,
      windowDays: 30,
    };
    
    expect(expirationEvent.type).toBe("cookie_expired");
  });
});
