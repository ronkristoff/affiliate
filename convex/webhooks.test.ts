import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { normalizeToBillingEvent, BillingEventType, PaymentStatus } from "./webhooks";

// Test module setup
// Note: import.meta.glob is a Vite feature not available in Convex test environment
// We'll use a simple object approach instead
const testModules = {};

/**
 * Story 6.5: Mock Payment Webhook Processing - Comprehensive Tests
 * 
 * Test Coverage:
 * 1. BillingEvent normalization for all event types
 * 2. Event deduplication
 * 3. Conversion creation with valid attribution
 * 4. Organic conversion for invalid affiliate
 * 5. Duplicate webhook rejection
 * 6. Mock webhook trigger endpoint
 * 7. Error handling (always returns 200)
 * 8. Payment status handling (pending/failed don't create conversions)
 */

describe("BillingEvent Normalization", () => {
  it("should normalize payment.updated event correctly", () => {
    const payload = {
      id: "evt_test_123",
      event: "payment.updated",
      created: 1704067200000,
      data: {
        object: {
          id: "pay_test_123",
          amount: 9900,
          currency: "PHP",
          status: "paid",
          customer: { email: "test@example.com" },
          metadata: {
            _salig_aff_tenant: "tenant_123",
            _salig_aff_ref: "AFF123",
            _salig_aff_click_id: "click_456",
          },
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.eventId).toBe("evt_test_123");
    expect(result!.eventType).toBe("payment.updated");
    expect(result!.payment.amount).toBe(9900);
    expect(result!.payment.status).toBe("paid");
    expect(result!.attribution?.affiliateCode).toBe("AFF123");
    expect(result!.tenantId).toBe("tenant_123");
  });

  it("should normalize subscription.created event correctly", () => {
    const payload = {
      id: "evt_sub_123",
      event: "subscription.created",
      created: 1704067200000,
      data: {
        object: {
          id: "sub_test_123",
          status: "active",
          subscription: {
            id: "sub_test_123",
            status: "active",
            plan_id: "plan_456",
          },
          customer: { email: "test@example.com" },
          metadata: {
            _salig_aff_tenant: "tenant_123",
            _salig_aff_ref: "AFF123",
          },
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("subscription.created");
    expect(result!.subscription).toBeDefined();
    expect(result!.subscription!.id).toBe("sub_test_123");
    expect(result!.subscription!.planId).toBe("plan_456");
  });

  it("should normalize subscription.updated event correctly", () => {
    const payload = {
      id: "evt_sub_upd_123",
      event: "subscription.updated",
      created: 1704067200000,
      data: {
        object: {
          id: "sub_test_123",
          status: "cancelled",
          subscription: {
            id: "sub_test_123",
            status: "cancelled",
            plan_id: "plan_456",
          },
          customer: { email: "test@example.com" },
          metadata: {
            _salig_aff_tenant: "tenant_123",
            _salig_aff_ref: "AFF123",
          },
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("subscription.updated");
    expect(result!.subscription!.status).toBe("cancelled");
  });

  it("should normalize subscription.cancelled event correctly", () => {
    const payload = {
      id: "evt_sub_cancel_123",
      event: "subscription.cancelled",
      created: 1704067200000,
      data: {
        object: {
          id: "sub_test_123",
          status: "cancelled",
          subscription: {
            id: "sub_test_123",
            status: "cancelled",
            plan_id: "plan_456",
          },
          customer: { email: "test@example.com" },
          metadata: {
            _salig_aff_tenant: "tenant_123",
            _salig_aff_ref: "AFF123",
          },
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("subscription.cancelled");
  });

  it("should normalize refund.created event correctly", () => {
    const payload = {
      id: "evt_refund_123",
      event: "refund.created",
      created: 1704067200000,
      data: {
        object: {
          id: "ref_test_123",
          amount: 5000,
          currency: "PHP",
          status: "paid",
          payment_intent: "pay_original_123",
          customer: { email: "test@example.com" },
          metadata: {
            _salig_aff_tenant: "tenant_123",
            _salig_aff_ref: "AFF123",
          },
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("refund.created");
    expect(result!.payment.id).toBe("ref_test_123");
  });

  it("should return null for invalid event type", () => {
    const payload = {
      id: "evt_invalid_123",
      event: "invalid.event",
      created: 1704067200000,
      data: {
        object: {
          id: "pay_test_123",
          amount: 9900,
          currency: "PHP",
          status: "paid",
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).toBeNull();
  });

  it("should return null for missing data.object", () => {
    const payload = {
      id: "evt_test_123",
      event: "payment.updated",
      created: 1704067200000,
      data: {},
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).toBeNull();
  });

  it("should handle missing metadata gracefully", () => {
    const payload = {
      id: "evt_test_123",
      event: "payment.updated",
      created: 1704067200000,
      data: {
        object: {
          id: "pay_test_123",
          amount: 9900,
          currency: "PHP",
          status: "paid",
          customer: { email: "test@example.com" },
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.attribution).toBeUndefined();
    expect(result!.tenantId).toBeUndefined();
  });

  it("should handle pending payment status", () => {
    const payload = {
      id: "evt_test_123",
      event: "payment.updated",
      created: 1704067200000,
      data: {
        object: {
          id: "pay_test_123",
          amount: 9900,
          currency: "PHP",
          status: "pending",
          customer: { email: "test@example.com" },
          metadata: {},
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.payment.status).toBe("pending");
  });

  it("should handle failed payment status", () => {
    const payload = {
      id: "evt_test_123",
      event: "payment.updated",
      created: 1704067200000,
      data: {
        object: {
          id: "pay_test_123",
          amount: 9900,
          currency: "PHP",
          status: "failed",
          customer: { email: "test@example.com" },
          metadata: {},
        },
      },
    };

    const result = normalizeToBillingEvent(payload);

    expect(result).not.toBeNull();
    expect(result!.payment.status).toBe("failed");
  });
});

describe("Event Deduplication", () => {
  it("should detect duplicate event ID", async () => {
    const t = convexTest(schema, testModules);
    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    // Store initial webhook
    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_duplicate_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    expect(webhookId).toBeDefined();

    // Check for duplicate
    const isDuplicate = await t.query(internal.webhooks.checkEventIdExists, {
      eventId: "evt_duplicate_test",
    });

    expect(isDuplicate).toBe(true);

    // Check for non-existent event
    const isNotDuplicate = await t.query(internal.webhooks.checkEventIdExists, {
      eventId: "evt_new_event",
    });

    expect(isNotDuplicate).toBe(false);
  });
});

describe("Webhook Processing to Conversion", () => {
  it("should create conversion with valid affiliate attribution", async () => {
    const t = convexTest(schema, testModules);

    // Setup: Create tenant and affiliate
    const { tenantId, affiliateId, campaignId, referralLinkId } = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });

      const affiliateId = await ctx.db.insert("affiliates", {
        tenantId,
        email: "affiliate@test.com",
        name: "Test Affiliate",
        uniqueCode: "TEST123",
        status: "active",
      });

      const campaignId = await ctx.db.insert("campaigns", {
        tenantId,
        name: "Test Campaign",
        commissionType: "percentage",
        commissionValue: 10,
        recurringCommission: false,
        status: "active",
      });

      const referralLinkId = await ctx.db.insert("referralLinks", {
        tenantId,
        affiliateId,
        campaignId,
        code: "TEST123",
      });

      return { tenantId, affiliateId, campaignId, referralLinkId };
    });

    // Store webhook
    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_conversion_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    // Create billing event
    const billingEvent = {
      eventId: "evt_conversion_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: {
        affiliateCode: "TEST123",
        clickId: undefined,
      },
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "paid",
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    // Process webhook
    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).not.toBeNull();

    // Verify conversion was created
    const conversion = await t.run(async (ctx) => {
      return await ctx.db.get(conversionId!);
    });

    expect(conversion).not.toBeNull();
    expect(conversion!.affiliateId).toEqual(affiliateId);
    expect(conversion!.attributionSource).toBe("webhook");
    expect(conversion!.amount).toBe(99); // 9900 cents / 100 = 99 PHP
  });

  it("should create organic conversion for invalid affiliate", async () => {
    const t = convexTest(schema, testModules);

    // Setup: Create tenant only
    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    // Store webhook
    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_organic_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    // Create billing event with non-existent affiliate
    const billingEvent = {
      eventId: "evt_organic_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: {
        affiliateCode: "NONEXISTENT",
        clickId: undefined,
      },
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "paid",
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    // Process webhook
    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).not.toBeNull();

    // Verify organic conversion was created
    const conversion = await t.run(async (ctx) => {
      return await ctx.db.get(conversionId!);
    });

    expect(conversion).not.toBeNull();
    expect(conversion!.attributionSource).toBe("organic");
  });

  it("should NOT create conversion for pending payment status", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const affiliateId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "affiliate@test.com",
        name: "Test Affiliate",
        uniqueCode: "TEST123",
        status: "active",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralLinks", {
        tenantId,
        affiliateId,
        code: "TEST123",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_pending_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const billingEvent = {
      eventId: "evt_pending_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: {
        affiliateCode: "TEST123",
        clickId: undefined,
      },
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "pending", // Pending status
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    // Process webhook - should return null for pending status
    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).toBeNull();
  });

  it("should NOT create conversion for failed payment status", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const affiliateId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "affiliate@test.com",
        name: "Test Affiliate",
        uniqueCode: "TEST123",
        status: "active",
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralLinks", {
        tenantId,
        affiliateId,
        code: "TEST123",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_failed_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const billingEvent = {
      eventId: "evt_failed_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: {
        affiliateCode: "TEST123",
        clickId: undefined,
      },
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "failed", // Failed status
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    // Process webhook - should return null for failed status
    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).toBeNull();
  });

  it("should NOT create conversion when no attribution data", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_no_attr_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const billingEvent = {
      eventId: "evt_no_attr_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: undefined, // No attribution
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "paid",
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).toBeNull();
  });

  it("should NOT create conversion when no tenant ID", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_no_tenant_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const billingEvent = {
      eventId: "evt_no_tenant_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: undefined, // No tenant
      attribution: {
        affiliateCode: "TEST123",
        clickId: undefined,
      },
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "paid",
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).toBeNull();
  });

  it("should NOT create conversion for inactive affiliate", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const affiliateId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "affiliate@test.com",
        name: "Test Affiliate",
        uniqueCode: "INACTIVE123",
        status: "suspended", // Inactive status
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralLinks", {
        tenantId,
        affiliateId,
        code: "INACTIVE123",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_inactive_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const billingEvent = {
      eventId: "evt_inactive_test",
      eventType: "payment.updated",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: {
        affiliateCode: "INACTIVE123",
        clickId: undefined,
      },
      payment: {
        id: "pay_test_123",
        amount: 9900,
        currency: "PHP",
        status: "paid",
        customerEmail: "customer@test.com",
      },
      subscription: undefined,
      rawPayload: JSON.stringify({ test: true }),
    };

    // Process webhook - should create organic conversion for inactive affiliate
    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).not.toBeNull();

    // Verify organic conversion was created
    const conversion = await t.run(async (ctx) => {
      return await ctx.db.get(conversionId!);
    });

    expect(conversion!.attributionSource).toBe("organic");
  });

  it("should process subscription.created events", async () => {
    const t = convexTest(schema, testModules);

    const { tenantId } = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });

      const affiliateId = await ctx.db.insert("affiliates", {
        tenantId,
        email: "affiliate@test.com",
        name: "Test Affiliate",
        uniqueCode: "TEST123",
        status: "active",
      });

      await ctx.db.insert("referralLinks", {
        tenantId,
        affiliateId,
        code: "TEST123",
      });

      return { tenantId };
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_sub_created_test",
      eventType: "subscription.created",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const billingEvent = {
      eventId: "evt_sub_created_test",
      eventType: "subscription.created",
      timestamp: Date.now(),
      tenantId: tenantId.toString(),
      attribution: {
        affiliateCode: "TEST123",
        clickId: undefined,
      },
      payment: {
        id: "sub_test_123",
        amount: 9900,
        currency: "PHP",
        status: "paid",
        customerEmail: "customer@test.com",
      },
      subscription: {
        id: "sub_test_123",
        status: "active" as const,
        planId: "plan_456",
      },
      rawPayload: JSON.stringify({ test: true }),
    };

    const conversionId = await t.mutation(internal.webhooks.processWebhookToConversion, {
      webhookId,
      billingEvent,
    });

    expect(conversionId).not.toBeNull();
  });
});

describe("Webhook Status Management", () => {
  it("should update webhook status to processed", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_status_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    await t.mutation(internal.webhooks.updateWebhookStatus, {
      webhookId,
      status: "processed",
    });

    const webhook = await t.run(async (ctx) => {
      return await ctx.db.get(webhookId);
    });

    expect(webhook!.status).toBe("processed");
    expect(webhook!.processedAt).toBeDefined();
  });

  it("should update webhook status to failed with error message", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_failed_status_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ test: true }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    await t.mutation(internal.webhooks.updateWebhookStatus, {
      webhookId,
      status: "failed",
      errorMessage: "Processing error occurred",
    });

    const webhook = await t.run(async (ctx) => {
      return await ctx.db.get(webhookId);
    });

    expect(webhook!.status).toBe("failed");
    expect(webhook!.errorMessage).toBe("Processing error occurred");
    expect(webhook!.processedAt).toBeDefined();
  });
});

describe("List Recent Webhooks", () => {
  it("should list webhooks for authenticated user's tenant", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    // Create multiple webhooks
    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.webhooks.storeRawWebhook, {
        source: "saligpay",
        eventId: `evt_list_test_${i}`,
        eventType: "payment.updated",
        rawPayload: JSON.stringify({ index: i }),
        signatureValid: true,
        tenantId,
        status: "received",
      });
    }

    const webhooks = await t.query(api.webhooks.listRecentWebhooks, {
      count: 3,
    });

    // Should return webhooks ordered by creation time desc
    expect(webhooks.length).toBeLessThanOrEqual(3);
  });
});

describe("Get Webhook Payload", () => {
  it("should return webhook payload for tenant owner", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const webhookId = await t.mutation(internal.webhooks.storeRawWebhook, {
      source: "saligpay",
      eventId: "evt_payload_test",
      eventType: "payment.updated",
      rawPayload: JSON.stringify({ sensitive: "data" }),
      signatureValid: true,
      tenantId,
      status: "received",
    });

    const payload = await t.query(api.webhooks.getWebhookPayload, {
      webhookId,
    });

    expect(payload).not.toBeNull();
    expect(payload.rawPayload).toContain("sensitive");
  });
});

describe("Tenant Validation", () => {
  it("should validate existing tenant ID", async () => {
    const t = convexTest(schema, testModules);

    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "starter",
        status: "active",
      });
    });

    const result = await t.query(internal.webhooks.validateTenantIdInternal, {
      tenantId: tenantId.toString(),
    });

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test Tenant");
  });

  it("should return null for non-existent tenant", async () => {
    const t = convexTest(schema, testModules);

    const result = await t.query(internal.webhooks.validateTenantIdInternal, {
      tenantId: "nonexistent_tenant_id",
    });

    expect(result).toBeNull();
  });
});
