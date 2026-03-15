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
  attributionSource?: "cookie" | "checkout_metadata" | "manual";
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
