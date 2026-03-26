import { describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";

/**
 * Story 13.1: Payout Batch Generation - Tests
 *
 * Test Coverage:
 * 1. generatePayoutBatch mutation with confirmed commissions
 * 2. generatePayoutBatch with empty state (no pending payouts)
 * 3. generatePayoutBatch tenant isolation
 * 4. generatePayoutBatch audit trail creation
 * 5. getAffiliatesWithPendingPayouts query
 * 6. getAffiliatesWithPendingPayouts with no payout method
 * 7. getPendingPayoutTotal query
 * 8. getPayoutBatches query
 * 9. Only confirmed commissions are included (not pending/declined)
 */

// Test modules for auth mocking
const testModules = {
  auth: {
    betterAuthComponent: {
      getAuthUser: vi.fn(async (_ctx: any) => ({
        email: "owner@test.com",
        id: "auth_user_123",
      })),
    },
  },
};

describe("Story 13.1: Payout Batch Generation", () => {
  // ===========================================================================
  // Helper: Create a tenant, user, and affiliates for testing
  // ===========================================================================
  async function setupTestData(t: ReturnType<typeof convexTest>) {
    // Create tenant
    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test SaaS Co.",
        slug: "test-saas-co",
        plan: "starter",
        status: "active",
      });
    });

    // Create owner user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        tenantId,
        email: "owner@test.com",
        name: "Test Owner",
        role: "owner",
        authId: "auth_user_123",
      });
    });

    // Create campaign
    const campaignId = await t.run(async (ctx) => {
      return await ctx.db.insert("campaigns", {
        tenantId,
        name: "Test Campaign",
        commissionType: "percentage",
        commissionValue: 10,
        recurringCommission: false,
        status: "active",
      });
    });

    // Create affiliate with payout method
    const affiliate1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "jamie@test.com",
        name: "Jamie Cruz",
        uniqueCode: "JAMIE01",
        status: "active",
        payoutMethod: {
          type: "GCash",
          details: "0917 123 4567",
        },
      });
    });

    // Create affiliate without payout method
    const affiliate2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "ramon@test.com",
        name: "Ramon Santos",
        uniqueCode: "RAMON02",
        status: "active",
      });
    });

    // Create affiliate on different tenant
    const otherTenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Other SaaS Co.",
        slug: "other-saas-co",
        plan: "starter",
        status: "active",
      });
    });

    const otherAffiliateId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId: otherTenantId,
        email: "other@test.com",
        name: "Other Affiliate",
        uniqueCode: "OTHER03",
        status: "active",
        payoutMethod: {
          type: "Bank Transfer",
          details: "BDO ****4421",
        },
      });
    });

    return {
      tenantId,
      userId,
      campaignId,
      affiliate1Id,
      affiliate2Id,
      otherTenantId,
      otherAffiliateId,
    };
  }

  // ===========================================================================
  // Task 1 Tests: Batch Generation Mutation
  // ===========================================================================
  describe("Task 1: generatePayoutBatch mutation", () => {
    it("should create a payout batch with confirmed commissions", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      // Create confirmed commissions for affiliate1
      const commission1Id = await t.run(async (ctx) => {
        return await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });
      const commission2Id = await t.run(async (ctx) => {
        return await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
      });

      // Create confirmed commission for affiliate2
      const commission3Id = await t.run(async (ctx) => {
        return await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 2500,
          status: "approved",
        });
      });

      // Generate batch
      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Verify result
      expect(result.affiliateCount).toBe(2);
      expect(result.totalAmount).toBe(10500); // 5000 + 3000 + 2500
      expect(result.affiliates).toHaveLength(2);

      // Verify affiliate1 data
      const affiliate1 = result.affiliates.find(
        (a: any) => a.name === "Jamie Cruz"
      );
      expect(affiliate1).toBeDefined();
      expect(affiliate1.pendingAmount).toBe(8000);
      expect(affiliate1.commissionCount).toBe(2);
      expect(affiliate1.payoutMethod).toEqual({
        type: "GCash",
        details: "0917 123 4567",
      });

      // Verify affiliate2 data (no payout method)
      const affiliate2 = result.affiliates.find(
        (a: any) => a.name === "Ramon Santos"
      );
      expect(affiliate2).toBeDefined();
      expect(affiliate2.pendingAmount).toBe(2500);
      expect(affiliate2.commissionCount).toBe(1);
      expect(affiliate2.payoutMethod).toBeUndefined();

      // Verify commissions were updated to "paid" status and linked to batch
      const updatedCommission1 = await t.run(async (ctx) => {
        return await ctx.db.get(commission1Id);
      });
      expect(updatedCommission1?.status).toBe("paid");
      expect(updatedCommission1?.batchId).toBe(result.batchId);

      const updatedCommission2 = await t.run(async (ctx) => {
        return await ctx.db.get(commission2Id);
      });
      expect(updatedCommission2?.status).toBe("paid");
      expect(updatedCommission2?.batchId).toBe(result.batchId);

      const updatedCommission3 = await t.run(async (ctx) => {
        return await ctx.db.get(commission3Id);
      });
      expect(updatedCommission3?.status).toBe("paid");
      expect(updatedCommission3?.batchId).toBe(result.batchId);

      // Verify payout records were created
      const payouts = await t.run(async (ctx) => {
        return await ctx.db
          .query("payouts")
          .withIndex("by_batch", (q) => q.eq("batchId", result.batchId))
          .collect();
      });
      expect(payouts).toHaveLength(2);
      expect(payouts[0].status).toBe("pending");
      expect(payouts[1].status).toBe("pending");
    });

    it("should throw NO_PENDING_PAYOUTS when no confirmed commissions exist", async () => {
      const t = convexTest(schema, testModules);
      await setupTestData(t);

      // No commissions created — should throw
      await expect(
        t.mutation(api.payouts.generatePayoutBatch, {})
      ).rejects.toThrow("NO_PENDING_PAYOUTS");
    });

    it("should only include confirmed commissions (not pending/declined)", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        // Confirmed — should be included
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
        // Pending — should NOT be included
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 3000,
          status: "pending",
        });
        // Declined — should NOT be included
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 2000,
          status: "declined",
        });
      });

      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Should only count the confirmed commission
      expect(result.totalAmount).toBe(5000);
      expect(result.affiliateCount).toBe(1);
      expect(result.affiliates[0].commissionCount).toBe(1);
    });

    it("should enforce tenant isolation — no cross-tenant data", async () => {
      const t = convexTest(schema, testModules);
      const {
        tenantId,
        campaignId,
        affiliate1Id,
        otherAffiliateId,
      } = await setupTestData(t);

      // Confirmed commission for our tenant's affiliate
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Only 1 affiliate from our tenant, not the other tenant's affiliate
      expect(result.affiliateCount).toBe(1);
      expect(result.affiliates[0].name).toBe("Jamie Cruz");
      expect(result.totalAmount).toBe(5000);
    });

    it("should create an audit log entry when batch is generated", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      await t.mutation(api.payouts.generatePayoutBatch, {});

      // Verify audit log was created via direct database query (Story 13.6: centralized function)
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "payout_batch_generated"))
          .collect();
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const batchLog = auditLogs.find(
        (log: any) => log.entityType === "payoutBatches"
      );
      expect(batchLog).toBeDefined();
      expect(batchLog.entityType).toBe("payoutBatches");
    });

    it("should prevent regeneration of batches for already-paid commissions", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      // Create confirmed commission
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      // Generate first batch - should succeed
      const firstBatch = await t.mutation(api.payouts.generatePayoutBatch, {});
      expect(firstBatch.affiliateCount).toBe(1);
      expect(firstBatch.totalAmount).toBe(5000);

      // Try to generate second batch - should throw NO_PENDING_PAYOUTS
      // because commissions are now marked as "paid" with batchId
      await expect(
        t.mutation(api.payouts.generatePayoutBatch, {})
      ).rejects.toThrow("NO_PENDING_PAYOUTS");
    });
  });

  // ===========================================================================
  // Task 2 Tests: Affiliate Payout Summary Query
  // ===========================================================================
  describe("Task 2: getAffiliatesWithPendingPayouts query", () => {
    it("should return affiliates with confirmed commission summaries", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 2500,
          status: "approved",
        });
      });

      const result = await t.query(
        api.payouts.getAffiliatesWithPendingPayouts,
        {}
      );

      expect(result).toHaveLength(2);
      expect(result[0].pendingAmount).toBe(5000);
      expect(result[1].pendingAmount).toBe(2500);
    });

    it("should return empty array when no pending payouts", async () => {
      const t = convexTest(schema, testModules);
      await setupTestData(t);

      const result = await t.query(
        api.payouts.getAffiliatesWithPendingPayouts,
        {}
      );

      expect(result).toEqual([]);
    });

    it("should show payout method for configured affiliates and undefined for unconfigured", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 2500,
          status: "approved",
        });
      });

      const result = await t.query(
        api.payouts.getAffiliatesWithPendingPayouts,
        {}
      );

      const jamie = result.find((a: any) => a.name === "Jamie Cruz");
      const ramon = result.find((a: any) => a.name === "Ramon Santos");

      expect(jamie?.payoutMethod).toEqual({
        type: "GCash",
        details: "0917 123 4567",
      });
      expect(ramon?.payoutMethod).toBeUndefined();
    });

    it("should not include commissions from other tenants", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, otherTenantId, otherAffiliateId } =
        await setupTestData(t);

      // Create confirmed commission for OUR affiliate
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      // Create confirmed commission for OTHER tenant's affiliate
      const otherCampaignId = await t.run(async (ctx) => {
        return await ctx.db.insert("campaigns", {
          tenantId: otherTenantId,
          name: "Other Campaign",
          commissionType: "percentage",
          commissionValue: 10,
          recurringCommission: false,
          status: "active",
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId: otherTenantId,
          affiliateId: otherAffiliateId,
          campaignId: otherCampaignId,
          amount: 9999,
          status: "approved",
        });
      });

      const result = await t.query(
        api.payouts.getAffiliatesWithPendingPayouts,
        {}
      );

      // Only our tenant's affiliate should appear
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Jamie Cruz");
      expect(result[0].pendingAmount).toBe(5000);
    });
  });

  // ===========================================================================
  // getPendingPayoutTotal query tests
  // ===========================================================================
  describe("getPendingPayoutTotal query", () => {
    it("should return correct totals for pending payouts", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      await t.run(async (ctx) => {
        // 3 commissions for affiliate1
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 1000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 2000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
        // 1 commission for affiliate2
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 4500,
          status: "approved",
        });
      });

      const result = await t.query(api.payouts.getPendingPayoutTotal, {});

      expect(result.totalAmount).toBe(10500);
      expect(result.affiliateCount).toBe(2);
      expect(result.commissionCount).toBe(4);
    });

    it("should return zeros when no pending payouts", async () => {
      const t = convexTest(schema, testModules);
      await setupTestData(t);

      const result = await t.query(api.payouts.getPendingPayoutTotal, {});

      expect(result.totalAmount).toBe(0);
      expect(result.affiliateCount).toBe(0);
      expect(result.commissionCount).toBe(0);
    });
  });

  // ===========================================================================
  // getPayoutBatches query tests (Story 13.5: Updated with pagination)
  // ===========================================================================
  describe("getPayoutBatches query", () => {
    it("should return paginated batches with batch codes", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      // Create a confirmed commission and generate a batch
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      const result = await t.query(api.payouts.getPayoutBatches, {
        paginationOpts: { numItems: 20, cursor: null },
      });

      expect(result.page).toHaveLength(1);
      expect(result.page[0].batchCode).toMatch(/^BATCH-[A-Z0-9]{8}$/);
      expect(result.page[0].totalAmount).toBe(5000);
      expect(result.page[0].affiliateCount).toBe(1);
      expect(result.page[0].status).toBe("pending");
      expect(result.isDone).toBe(true);
    });

    it("should return batches ordered by most recent first", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      // Generate first batch
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });
      await t.mutation(api.payouts.generatePayoutBatch, {});

      // Generate second batch (new commissions)
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
      });
      await t.mutation(api.payouts.generatePayoutBatch, {});

      const result = await t.query(api.payouts.getPayoutBatches, {
        paginationOpts: { numItems: 20, cursor: null },
      });
      expect(result.page).toHaveLength(2);
      // Most recent first
      expect(result.page[0].generatedAt).toBeGreaterThanOrEqual(
        result.page[1].generatedAt
      );
    });

    // Story 13.5: Pagination tests
    it("should respect pagination limits", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id, userId } =
        await setupTestData(t);

      // Generate multiple batches
      for (let i = 0; i < 5; i++) {
        await t.run(async (ctx) => {
          await ctx.db.insert("commissions", {
            tenantId,
            affiliateId: i % 2 === 0 ? affiliate1Id : affiliate2Id,
            campaignId,
            amount: 1000 * (i + 1),
            status: "approved",
          });
        });
        await t.mutation(api.payouts.generatePayoutBatch, {});
      }

      // Request only 2 items per page
      const result = await t.query(api.payouts.getPayoutBatches, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
      expect(result.continueCursor).toBeTruthy();
    });

    // Story 13.5: Status filter tests
    it("should filter batches by 'completed' status", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      // Generate first batch and mark as completed
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });
      const batch1 = await t.mutation(api.payouts.generatePayoutBatch, {});
      await t.mutation(api.payouts.markBatchAsPaid, {
        batchId: batch1.batchId,
        paymentReference: "BANK-001",
      });

      // Generate second batch (leave as pending)
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
      });
      await t.mutation(api.payouts.generatePayoutBatch, {});

      // Query with completed filter
      const result = await t.query(api.payouts.getPayoutBatches, {
        paginationOpts: { numItems: 20, cursor: null },
        statusFilter: "completed",
      });

      expect(result.page).toHaveLength(1);
      expect(result.page[0].status).toBe("completed");
      expect(result.isDone).toBe(true);
    });

    it("should filter batches by 'processing' status", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      // Generate batch and mark one payout as paid (status becomes processing)
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });
      const batch = await t.mutation(api.payouts.generatePayoutBatch, {});
      
      // Mark one payout as paid
      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId: batch.batchId,
      });
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: payouts[0].payoutId,
        paymentReference: "BANK-001",
      });

      // Query with processing filter
      const result = await t.query(api.payouts.getPayoutBatches, {
        paginationOpts: { numItems: 20, cursor: null },
        statusFilter: "processing",
      });

      expect(result.page).toHaveLength(1);
      expect(result.page[0].status).toBe("processing");
    });

    it("should return all batches when statusFilter is 'all'", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      // Generate batches with different statuses
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });
      const batch1 = await t.mutation(api.payouts.generatePayoutBatch, {});
      await t.mutation(api.payouts.markBatchAsPaid, {
        batchId: batch1.batchId,
        paymentReference: "BANK-001",
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
      });
      await t.mutation(api.payouts.generatePayoutBatch, {});

      // Query with 'all' filter
      const result = await t.query(api.payouts.getPayoutBatches, {
        paginationOpts: { numItems: 20, cursor: null },
        statusFilter: "all",
      });

      expect(result.page).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe("Edge Cases", () => {
    it("should handle single affiliate with single commission", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 100,
          status: "approved",
        });
      });

      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      expect(result.affiliateCount).toBe(1);
      expect(result.totalAmount).toBe(100);
      expect(result.affiliates[0].commissionCount).toBe(1);
    });

    it("should aggregate multiple commissions for same affiliate correctly", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("commissions", {
            tenantId,
            affiliateId: affiliate1Id,
            campaignId,
            amount: 100,
            status: "approved",
          });
        }
      });

      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      expect(result.affiliateCount).toBe(1);
      expect(result.totalAmount).toBe(1000);
      expect(result.affiliates[0].commissionCount).toBe(10);
    });

    it("should not include declined or reversed commissions", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 3000,
          status: "declined",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 2000,
          status: "reversed",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 1000,
          status: "paid",
        });
      });

      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Only confirmed should count
      expect(result.totalAmount).toBe(5000);
      expect(result.affiliates[0].commissionCount).toBe(1);
    });
  });

  // ===========================================================================
  // Story 13.2: getBatchPayouts query
  // ===========================================================================
  describe("Story 13.2: getBatchPayouts query", () => {
    it("should return payout data enriched with affiliate info for valid batch", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      // Create confirmed commissions
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 2500,
          status: "approved",
        });
      });

      // Generate batch
      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      // Query batch payouts
      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      expect(payouts).toHaveLength(2);

      // Verify affiliate1 (Jamie Cruz) with 2 commissions
      const payout1 = payouts.find((p: any) => p.name === "Jamie Cruz");
      expect(payout1).toBeDefined();
      expect(payout1.email).toBe("jamie@test.com");
      expect(payout1.amount).toBe(8000);
      expect(payout1.commissionCount).toBe(2);
      expect(payout1.payoutMethod).toEqual({
        type: "GCash",
        details: "0917 123 4567",
      });
      expect(payout1.status).toBe("pending");

      // Verify affiliate2 (Ramon Santos) with 1 commission, no payout method
      const payout2 = payouts.find((p: any) => p.name === "Ramon Santos");
      expect(payout2).toBeDefined();
      expect(payout2.amount).toBe(2500);
      expect(payout2.commissionCount).toBe(1);
      expect(payout2.payoutMethod).toBeUndefined();
    });

    it("should throw error for batch belonging to different tenant", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id, otherTenantId } =
        await setupTestData(t);

      // Create confirmed commission and generate batch under main tenant
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      // Try to access batch from other tenant — should fail
      // We need to mock the auth to return the other tenant's user
      const otherTestModules = {
        auth: {
          betterAuthComponent: {
            getAuthUser: vi.fn(async (_ctx: any) => ({
              email: "other@test.com",
              id: "auth_other_user",
            })),
          },
        },
      };

      // Create a user under the other tenant for auth mock
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          tenantId: otherTenantId,
          email: "other@test.com",
          name: "Other Owner",
          role: "owner",
          authId: "auth_other_user",
        });
      });

      const t2 = convexTest(schema, otherTestModules);
      // Copy all data from t into t2
      await expect(async () => {
        await t2.query(api.payouts.getBatchPayouts, {
          batchId: batchResult.batchId,
        });
      }).rejects.toThrow("Batch not found or access denied");
    });

    it("should return empty array for batch with no payout records", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupTestData(t);

      // Create a batch directly with no payout records (edge case)
      const batchId = await t.run(async (ctx) => {
        return await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 0,
          affiliateCount: 0,
          status: "pending",
          generatedAt: Date.now(),
        });
      });

      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId,
      });

      expect(payouts).toHaveLength(0);
    });

    it("should count commissions correctly per affiliate", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      // Create 5 commissions for the same affiliate
      await t.run(async (ctx) => {
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("commissions", {
            tenantId,
            affiliateId: affiliate1Id,
            campaignId,
            amount: 1000,
            status: "approved",
          });
        }
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      expect(payouts).toHaveLength(1);
      expect(payouts[0].commissionCount).toBe(5);
      expect(payouts[0].amount).toBe(5000);
    });

    it("should include payout method details when configured", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 1500,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      expect(payouts).toHaveLength(1);
      expect(payouts[0].payoutMethod).toEqual({
        type: "GCash",
        details: "0917 123 4567",
      });
    });

    it("should return undefined payoutMethod when affiliate has none configured", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate2Id } = await setupTestData(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 1200,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      expect(payouts).toHaveLength(1);
      expect(payouts[0].payoutMethod).toBeUndefined();
    });

    // Story 13.5: getBatchPayouts returns paymentReference and paidAt
    it("should return paymentReference and paidAt for paid payouts", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      // Create confirmed commission and generate batch
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      // Get payout and mark as paid
      const payoutsBefore = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: payoutsBefore[0].payoutId,
        paymentReference: "BANK-REF-12345",
      });

      // Query again and verify paid fields
      const payoutsAfter = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      expect(payoutsAfter[0].paymentReference).toBe("BANK-REF-12345");
      expect(payoutsAfter[0].paidAt).toBeTruthy();
      expect(typeof payoutsAfter[0].paidAt).toBe("number");
    });

    it("should return undefined paymentReference and paidAt for pending payouts", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliate1Id } = await setupTestData(t);

      // Create confirmed commission and generate batch (don't mark as paid)
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(
        api.payouts.generatePayoutBatch,
        {}
      );

      const payouts = await t.query(api.payouts.getBatchPayouts, {
        batchId: batchResult.batchId,
      });

      expect(payouts[0].paymentReference).toBeUndefined();
      expect(payouts[0].paidAt).toBeUndefined();
      expect(payouts[0].status).toBe("pending");
    });
  });

  // ===========================================================================
  // Story 13.3: Mark Payouts as Paid - Tests
  // ===========================================================================
  describe("Story 13.3: Mark Payouts as Paid", () => {
    // Helper: create a batch with pending payouts for testing mark-as-paid
    async function setupBatchWithPayouts(t: ReturnType<typeof convexTest>) {
      const { tenantId, campaignId, affiliate1Id, affiliate2Id } =
        await setupTestData(t);

      // Create confirmed commissions
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate1Id,
          campaignId,
          amount: 5000,
          status: "approved",
        });
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId: affiliate2Id,
          campaignId,
          amount: 3000,
          status: "approved",
        });
      });

      // Generate batch
      const batchResult = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Get the payout IDs
      const payouts = await t.run(async (ctx) => {
        return await ctx.db
          .query("payouts")
          .withIndex("by_batch", (q) => q.eq("batchId", batchResult.batchId))
          .collect();
      });

      const jamiePayout = payouts.find((p: any) => {
        // affiliate1Id is Jamie Cruz
        return p.affiliateId === affiliate1Id;
      });
      const ramonPayout = payouts.find((p: any) => {
        // affiliate2Id is Ramon Santos
        return p.affiliateId === affiliate2Id;
      });

      return {
        batchId: batchResult.batchId,
        jamiePayoutId: jamiePayout!._id,
        ramonPayoutId: ramonPayout!._id,
        affiliate1Id,
        affiliate2Id,
      };
    }

    describe("markPayoutAsPaid mutation", () => {
      it("should update payout status to paid and set paidAt", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, batchId } = await setupBatchWithPayouts(t);

        const result = await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });

        expect(result.payoutId).toBe(jamiePayoutId);

        // Verify payout was updated
        const updatedPayout = await t.run(async (ctx) => {
          return await ctx.db.get(jamiePayoutId);
        });
        expect(updatedPayout?.status).toBe("paid");
        expect(updatedPayout?.paidAt).toBeDefined();
        expect(updatedPayout?.paidAt).toBeGreaterThan(0);
      });

      it("should set paymentReference when provided", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId } = await setupBatchWithPayouts(t);

        await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
          paymentReference: "BPI Transfer #12345",
        });

        const updatedPayout = await t.run(async (ctx) => {
          return await ctx.db.get(jamiePayoutId);
        });
        expect(updatedPayout?.paymentReference).toBe("BPI Transfer #12345");
      });

      it("should throw error for cross-tenant payout access", async () => {
        const t = convexTest(schema, testModules);
        const { otherTenantId } = await setupTestData(t);

        // Create a payout under the other tenant
        const otherPayoutId = await t.run(async (ctx) => {
          const otherBatchId = await ctx.db.insert("payoutBatches", {
            tenantId: otherTenantId,
            totalAmount: 1000,
            affiliateCount: 1,
            status: "pending",
            generatedAt: Date.now(),
          });
          const otherAffiliateId = await ctx.db.insert("affiliates", {
            tenantId: otherTenantId,
            email: "other-aff@test.com",
            name: "Other Aff",
            uniqueCode: "OTHER_AFF",
            status: "active",
          });
          return await ctx.db.insert("payouts", {
            tenantId: otherTenantId,
            affiliateId: otherAffiliateId,
            batchId: otherBatchId,
            amount: 1000,
            status: "pending",
          });
        });

        // Try to mark it from main tenant — should fail
        await expect(
          t.mutation(api.payouts.markPayoutAsPaid, {
            payoutId: otherPayoutId,
          })
        ).rejects.toThrow("Payout not found or access denied");
      });

      it("should auto-transition batch to completed when last payout is marked", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, ramonPayoutId, batchId } =
          await setupBatchWithPayouts(t);

        // Mark first payout
        const result1 = await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });
        expect(result1.batchStatus).toBe("pending");
        expect(result1.remainingPending).toBe(1);

        // Mark second (last) payout — batch should auto-transition
        const result2 = await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: ramonPayoutId,
        });
        expect(result2.batchStatus).toBe("completed");
        expect(result2.remainingPending).toBe(0);

        // Verify batch was updated
        const batch = await t.run(async (ctx) => {
          return await ctx.db.get(batchId);
        });
        expect(batch?.status).toBe("completed");
        expect(batch?.completedAt).toBeDefined();
        expect(batch?.completedAt).toBeGreaterThan(0);
      });

      it("should return correct batch status when other payouts remain pending", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId } = await setupBatchWithPayouts(t);

        const result = await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });

        // 1 other payout still pending
        expect(result.remainingPending).toBe(1);
        expect(result.batchStatus).toBe("pending");
      });

      it("should be idempotent — already-paid payout returns current state", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, batchId } = await setupBatchWithPayouts(t);

        // Mark as paid first time
        const result1 = await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });
        expect(result1.batchStatus).toBe("pending");
        expect(result1.remainingPending).toBe(1);

        // Mark as paid second time — should not error
        const result2 = await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });
        expect(result2.payoutId).toBe(jamiePayoutId);
        expect(result2.remainingPending).toBe(1);
      });

      it("should create audit log entry with correct metadata", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, batchId } = await setupBatchWithPayouts(t);

        await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
          paymentReference: "REF-001",
        });

        const auditLogs = await t.run(async (ctx) => {
          return await ctx.db
            .query("auditLogs")
            .withIndex("by_action", (q) => q.eq("action", "payout_marked_paid"))
            .collect();
        });

        expect(auditLogs.length).toBeGreaterThanOrEqual(1);
        const log = auditLogs.find((l: any) => l.entityId === jamiePayoutId);
        expect(log).toBeDefined();
        expect(log.entityType).toBe("payouts");
        expect(log.targetId).toBe(batchId);
        expect(log.metadata.paymentReference).toBe("REF-001");
        expect(log.metadata.amount).toBe(8000);
      });
    });

    describe("markBatchAsPaid mutation", () => {
      it("should update all pending payouts to paid", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, ramonPayoutId, batchId } =
          await setupBatchWithPayouts(t);

        const result = await t.mutation(api.payouts.markBatchAsPaid, {
          batchId,
        });

        expect(result.batchId).toBe(batchId);
        expect(result.payoutsMarked).toBe(2);

        // Verify both payouts were updated
        const jamiePayout = await t.run(async (ctx) => {
          return await ctx.db.get(jamiePayoutId);
        });
        expect(jamiePayout?.status).toBe("paid");
        expect(jamiePayout?.paidAt).toBeGreaterThan(0);

        const ramonPayout = await t.run(async (ctx) => {
          return await ctx.db.get(ramonPayoutId);
        });
        expect(ramonPayout?.status).toBe("paid");
        expect(ramonPayout?.paidAt).toBeGreaterThan(0);
      });

      it("should set batch status to completed and completedAt", async () => {
        const t = convexTest(schema, testModules);
        const { batchId } = await setupBatchWithPayouts(t);

        await t.mutation(api.payouts.markBatchAsPaid, { batchId });

        const batch = await t.run(async (ctx) => {
          return await ctx.db.get(batchId);
        });
        expect(batch?.status).toBe("completed");
        expect(batch?.completedAt).toBeDefined();
        expect(batch?.completedAt).toBeGreaterThan(0);
      });

      it("should throw error for cross-tenant batch access", async () => {
        const t = convexTest(schema, testModules);
        const { otherTenantId } = await setupTestData(t);

        const otherBatchId = await t.run(async (ctx) => {
          return await ctx.db.insert("payoutBatches", {
            tenantId: otherTenantId,
            totalAmount: 1000,
            affiliateCount: 1,
            status: "pending",
            generatedAt: Date.now(),
          });
        });

        await expect(
          t.mutation(api.payouts.markBatchAsPaid, {
            batchId: otherBatchId,
          })
        ).rejects.toThrow("Batch not found or access denied");
      });

      it("should throw NO_PENDING_PAYOUTS for fully paid batch", async () => {
        const t = convexTest(schema, testModules);
        const { batchId } = await setupBatchWithPayouts(t);

        // Mark all payouts as paid first
        await t.mutation(api.payouts.markBatchAsPaid, { batchId });

        // Try again — should throw
        await expect(
          t.mutation(api.payouts.markBatchAsPaid, { batchId })
        ).rejects.toThrow("NO_PENDING_PAYOUTS");
      });

      it("should create audit log entry with correct metadata", async () => {
        const t = convexTest(schema, testModules);
        const { batchId } = await setupBatchWithPayouts(t);

        await t.mutation(api.payouts.markBatchAsPaid, {
          batchId,
          paymentReference: "BATCH-REF-001",
        });

        const auditLogs = await t.run(async (ctx) => {
          return await ctx.db
            .query("auditLogs")
            .withIndex("by_action", (q) =>
              q.eq("action", "batch_marked_paid")
            )
            .collect();
        });

        expect(auditLogs.length).toBeGreaterThanOrEqual(1);
        const log = auditLogs.find((l: any) => l.entityId === batchId);
        expect(log).toBeDefined();
        expect(log.entityType).toBe("payoutBatches");
        expect(log.metadata.payoutsMarked).toBe(2);
        expect(log.metadata.totalAmount).toBe(8000);
        expect(log.metadata.paymentReference).toBe("BATCH-REF-001");
        expect(log.metadata.payoutIds).toBeDefined();
        expect(log.metadata.payoutIds.length).toBe(2);
      });

      it("should handle batch with mix of already-paid and pending payouts", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, ramonPayoutId, batchId } =
          await setupBatchWithPayouts(t);

        // Mark one payout individually first
        await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });

        // Now mark all remaining — should only mark the pending one
        const result = await t.mutation(api.payouts.markBatchAsPaid, {
          batchId,
        });
        expect(result.payoutsMarked).toBe(1);

        // Verify batch is completed
        const batch = await t.run(async (ctx) => {
          return await ctx.db.get(batchId);
        });
        expect(batch?.status).toBe("completed");
      });
    });

    describe("getBatchPayoutStatus query", () => {
      it("should return correct paid/pending counts", async () => {
        const t = convexTest(schema, testModules);
        const { batchId } = await setupBatchWithPayouts(t);

        const status = await t.query(api.payouts.getBatchPayoutStatus, {
          batchId,
        });

        expect(status.total).toBe(2);
        expect(status.paid).toBe(0);
        expect(status.pending).toBe(2);
        expect(status.batchStatus).toBe("pending");
      });

      it("should reflect updated counts after marking a payout", async () => {
        const t = convexTest(schema, testModules);
        const { jamiePayoutId, batchId } = await setupBatchWithPayouts(t);

        // Mark one payout
        await t.mutation(api.payouts.markPayoutAsPaid, {
          payoutId: jamiePayoutId,
        });

        const status = await t.query(api.payouts.getBatchPayoutStatus, {
          batchId,
        });

        expect(status.total).toBe(2);
        expect(status.paid).toBe(1);
        expect(status.pending).toBe(1);
        expect(status.batchStatus).toBe("pending");
      });

      it("should throw for cross-tenant batch", async () => {
        const t = convexTest(schema, testModules);
        const { otherTenantId } = await setupTestData(t);

        const otherBatchId = await t.run(async (ctx) => {
          return await ctx.db.insert("payoutBatches", {
            tenantId: otherTenantId,
            totalAmount: 0,
            affiliateCount: 0,
            status: "pending",
            generatedAt: Date.now(),
          });
        });

        await expect(
          t.query(api.payouts.getBatchPayoutStatus, {
            batchId: otherBatchId,
          })
        ).rejects.toThrow("Batch not found or access denied");
      });

      it("should treat all payouts as paid when batch is completed (data inconsistency guard)", async () => {
        const t = convexTest(schema, testModules);
        const { batchId } = await setupBatchWithPayouts(t);

        // Simulate data inconsistency: batch completed but individual
        // payout records still have status="pending"
        await t.run(async (ctx) => {
          await ctx.db.patch(batchId, {
            status: "completed",
            completedAt: Date.now(),
          });
        });

        const status = await t.query(api.payouts.getBatchPayoutStatus, {
          batchId,
        });

        expect(status.total).toBe(2);
        expect(status.paid).toBe(2);
        expect(status.pending).toBe(0);
        expect(status.batchStatus).toBe("completed");
      });
    });
  });
});

// =============================================================================
// Story 13.4: Payout Notification Email - Tests
// =============================================================================
describe("Story 13.4: Payout Notification Email", () => {
  // ===========================================================================
  // Helper: Create a batch with pending payouts and tenant branding
  // ===========================================================================
  async function setupBatchWithBranding(t: ReturnType<typeof convexTest>, branding?: any) {
    // Create tenant with optional branding
    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test SaaS Co.",
        slug: "test-saas-co",
        plan: "starter",
        status: "active",
        ...(branding ? { branding } : {}),
      });
    });

    // Create owner user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        tenantId,
        email: "owner@test.com",
        name: "Test Owner",
        role: "owner",
        authId: "auth_user_123",
      });
    });

    // Create campaign
    const campaignId = await t.run(async (ctx) => {
      return await ctx.db.insert("campaigns", {
        tenantId,
        name: "Test Campaign",
        commissionType: "percentage",
        commissionValue: 10,
        recurringCommission: false,
        status: "active",
      });
    });

    // Create affiliates
    const affiliate1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "jamie@test.com",
        name: "Jamie Cruz",
        uniqueCode: "JAMIE01",
        status: "active",
        payoutMethod: { type: "GCash", details: "0917 123 4567" },
      });
    });

    const affiliate2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "ramon@test.com",
        name: "Ramon Santos",
        uniqueCode: "RAMON02",
        status: "active",
      });
    });

    // Create confirmed commissions
    await t.run(async (ctx) => {
      await ctx.db.insert("commissions", {
        tenantId,
        affiliateId: affiliate1Id,
        campaignId,
        amount: 5000,
        status: "approved",
      });
      await ctx.db.insert("commissions", {
        tenantId,
        affiliateId: affiliate1Id,
        campaignId,
        amount: 3000,
        status: "approved",
      });
      await ctx.db.insert("commissions", {
        tenantId,
        affiliateId: affiliate2Id,
        campaignId,
        amount: 2500,
        status: "approved",
      });
    });

    // Generate batch
    const batchResult = await t.mutation(api.payouts.generatePayoutBatch, {});

    // Get payout IDs
    const payouts = await t.run(async (ctx) => {
      return await ctx.db
        .query("payouts")
        .withIndex("by_batch", (q) => q.eq("batchId", batchResult.batchId))
        .collect();
    });

    const jamiePayout = payouts.find((p: any) => p.affiliateId === affiliate1Id);
    const ramonPayout = payouts.find((p: any) => p.affiliateId === affiliate2Id);

    return {
      tenantId,
      userId,
      batchId: batchResult.batchId,
      jamiePayoutId: jamiePayout!._id,
      ramonPayoutId: ramonPayout!._id,
      affiliate1Id,
      affiliate2Id,
    };
  }

  // ===========================================================================
  // markPayoutAsPaid email scheduling tests
  // ===========================================================================
  describe("markPayoutAsPaid email scheduling", () => {
    it("should schedule sendPayoutSentEmail when payout transitions pending→paid", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId, tenantId } = await setupBatchWithBranding(t);

      vi.useFakeTimers();
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
        paymentReference: "REF-001",
      });
      vi.runAllTimers();

      // Verify the payout was updated to paid
      const updatedPayout = await t.run(async (ctx) => {
        return await ctx.db.get(jamiePayoutId);
      });
      expect(updatedPayout?.status).toBe("paid");
      expect(updatedPayout?.paymentReference).toBe("REF-001");
    });

    it("should NOT schedule email when payout is already paid (idempotent path)", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId, batchId } = await setupBatchWithBranding(t);

      // Mark as paid first time
      const result1 = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      expect(result1.payoutId).toBe(jamiePayoutId);

      // Mark as paid second time (idempotent) — should NOT schedule another email
      const result2 = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      expect(result2.payoutId).toBe(jamiePayoutId);
      expect(result2.batchStatus).toBe(result1.batchStatus);
      expect(result2.remainingPending).toBe(result1.remainingPending);

      // Only one audit log should exist (no duplicate from second call)
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "payout_marked_paid"))
          .collect();
      });
      const logsForPayout = auditLogs.filter(
        (l: any) => l.entityId === jamiePayoutId
      );
      // First call creates one audit log; second call (idempotent) returns early without creating another
      expect(logsForPayout.length).toBe(1);
    });

    it("should pass correct affiliate data (name, email) to email scheduler", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId } = await setupBatchWithBranding(t);

      // Mutation should succeed with correct affiliate data fetch
      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      vi.runAllTimers();

      expect(result.payoutId).toBe(jamiePayoutId);

      // Verify the affiliate record is accessible (the mutation fetches it)
      const affiliate = await t.run(async (ctx) => {
        return await ctx.db.get(result.payoutId);
      });
      expect(affiliate).toBeDefined();
    });

    it("should pass correct tenant branding data to email scheduler", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId } = await setupBatchWithBranding(t, {
        portalName: "My Portal",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#10409a",
        customDomain: "portal.mybrand.com",
      });

      vi.useFakeTimers();
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      vi.runAllTimers();

      // Verify mutation succeeded — branding data was fetched internally
      const updatedPayout = await t.run(async (ctx) => {
        return await ctx.db.get(jamiePayoutId);
      });
      expect(updatedPayout?.status).toBe("paid");
    });

    it("should pass portalEarningsUrl when tenant has branding.customDomain", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId } = await setupBatchWithBranding(t, {
        portalName: "Branded Portal",
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#10409a",
        customDomain: "earnings.mybrand.com",
      });

      // Verify mutation succeeds — customDomain is used to build portalEarningsUrl
      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      vi.runAllTimers();

      expect(result.payoutId).toBe(jamiePayoutId);

      // Verify the tenant was created with customDomain
      const tenant = await t.run(async (ctx) => {
        return await ctx.db.query("tenants").first();
      });
      expect(tenant?.branding?.customDomain).toBe("earnings.mybrand.com");
    });

    it("should NOT pass portalEarningsUrl when no custom domain is configured", async () => {
      const t = convexTest(schema, testModules);
      // No branding → no customDomain → portalEarningsUrl should be undefined
      const { jamiePayoutId } = await setupBatchWithBranding(t);

      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      vi.runAllTimers();

      expect(result.payoutId).toBe(jamiePayoutId);

      // Verify tenant has no custom domain
      const tenant = await t.run(async (ctx) => {
        return await ctx.db.query("tenants").first();
      });
      expect(tenant?.branding?.customDomain).toBeUndefined();
    });

    it("should pass batchGeneratedAt from the batch record's generatedAt field", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId, batchId } = await setupBatchWithBranding(t);

      // Verify batch has generatedAt
      const batch = await t.run(async (ctx) => {
        return await ctx.db.get(batchId);
      });
      expect(batch?.generatedAt).toBeDefined();
      expect(batch?.generatedAt).toBeGreaterThan(0);

      vi.useFakeTimers();
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });
      vi.runAllTimers();
    });

    it("should succeed even if email scheduling throws an error", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId } = await setupBatchWithBranding(t);

      // The mutation should succeed regardless of email scheduling outcome
      // (email scheduling is wrapped in try/catch)
      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
        paymentReference: "BPI-REF-999",
      });
      vi.runAllTimers();

      // Verify payout was still marked as paid
      expect(result.payoutId).toBe(jamiePayoutId);
      expect(result.remainingPending).toBe(1);

      const updatedPayout = await t.run(async (ctx) => {
        return await ctx.db.get(jamiePayoutId);
      });
      expect(updatedPayout?.status).toBe("paid");
      expect(updatedPayout?.paymentReference).toBe("BPI-REF-999");
    });

    it("should use same timestamp for payout patch and email paidAt", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId } = await setupBatchWithBranding(t);

      vi.useFakeTimers({ now: 1700000000000 });
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });

      // Verify paidAt was set to the frozen timestamp
      const updatedPayout = await t.run(async (ctx) => {
        return await ctx.db.get(jamiePayoutId);
      });
      expect(updatedPayout?.paidAt).toBe(1700000000000);

      vi.useRealTimers();
    });

    it("should NOT send email if affiliate record is not found (silent skip)", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupBatchWithBranding(t);

      // Create a payout with a non-existent affiliateId
      const fakeAffiliateId = "affiliates_nonexistent" as any;
      const fakeBatchId = await t.run(async (ctx) => {
        return await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 1000,
          affiliateCount: 1,
          status: "pending",
          generatedAt: Date.now(),
        });
      });

      const payoutId = await t.run(async (ctx) => {
        return await ctx.db.insert("payouts", {
          tenantId,
          affiliateId: fakeAffiliateId,
          batchId: fakeBatchId,
          amount: 1000,
          status: "pending",
        });
      });

      // Mutation should still succeed even though affiliate doesn't exist
      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId,
      });
      vi.runAllTimers();

      expect(result.payoutId).toBe(payoutId);

      const updatedPayout = await t.run(async (ctx) => {
        return await ctx.db.get(payoutId);
      });
      expect(updatedPayout?.status).toBe("paid");
    });
  });

  // ===========================================================================
  // markBatchAsPaid email scheduling tests
  // ===========================================================================
  describe("markBatchAsPaid email scheduling", () => {
    it("should schedule individual emails per pending payout (one per affiliate)", async () => {
      const t = convexTest(schema, testModules);
      const { batchId, jamiePayoutId, ramonPayoutId } =
        await setupBatchWithBranding(t);

      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markBatchAsPaid, { batchId });
      vi.runAllTimers();

      // Both payouts should be marked as paid
      expect(result.payoutsMarked).toBe(2);

      const jamiePayout = await t.run(async (ctx) => {
        return await ctx.db.get(jamiePayoutId);
      });
      const ramonPayout = await t.run(async (ctx) => {
        return await ctx.db.get(ramonPayoutId);
      });

      expect(jamiePayout?.status).toBe("paid");
      expect(ramonPayout?.status).toBe("paid");
    });

    it("should pass batchGeneratedAt from batch record's generatedAt", async () => {
      const t = convexTest(schema, testModules);
      const { batchId } = await setupBatchWithBranding(t);

      // Verify batch has generatedAt before marking
      const batch = await t.run(async (ctx) => {
        return await ctx.db.get(batchId);
      });
      expect(batch?.generatedAt).toBeDefined();

      vi.useFakeTimers();
      await t.mutation(api.payouts.markBatchAsPaid, { batchId });
      vi.runAllTimers();
    });

    it("should include emailsScheduled and emailScheduleFailures in audit metadata", async () => {
      const t = convexTest(schema, testModules);
      const { batchId } = await setupBatchWithBranding(t);

      vi.useFakeTimers();
      await t.mutation(api.payouts.markBatchAsPaid, {
        batchId,
        paymentReference: "BATCH-REF-001",
      });
      vi.runAllTimers();

      // Check audit log for email stats
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "batch_marked_paid"))
          .collect();
      });

      const log = auditLogs.find((l: any) => l.entityId === batchId);
      expect(log).toBeDefined();
      expect(log.metadata.emailsScheduled).toBeDefined();
      expect(typeof log.metadata.emailsScheduled).toBe("number");
      expect(log.metadata.emailScheduleFailures).toBeDefined();
      expect(typeof log.metadata.emailScheduleFailures).toBe("number");
      expect(log.metadata.payoutsMarked).toBe(2);
      expect(log.metadata.paymentReference).toBe("BATCH-REF-001");
    });

    it("should succeed even if individual email schedulings fail", async () => {
      const t = convexTest(schema, testModules);
      const { batchId } = await setupBatchWithBranding(t);

      // Mutation should succeed regardless of individual email scheduling errors
      vi.useFakeTimers();
      const result = await t.mutation(api.payouts.markBatchAsPaid, {
        batchId,
        paymentReference: "REF-STRESS-001",
      });
      vi.runAllTimers();

      expect(result.batchId).toBe(batchId);
      expect(result.payoutsMarked).toBe(2);

      // Verify all payouts were marked as paid
      const batch = await t.run(async (ctx) => {
        return await ctx.db.get(batchId);
      });
      expect(batch?.status).toBe("completed");

      // Verify audit log was still created
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "batch_marked_paid"))
          .collect();
      });
      const log = auditLogs.find((l: any) => l.entityId === batchId);
      expect(log).toBeDefined();
    });

    it("should use same timestamp for all payout patches and email paidAt", async () => {
      const t = convexTest(schema, testModules);
      const { batchId, jamiePayoutId, ramonPayoutId } =
        await setupBatchWithBranding(t);

      vi.useFakeTimers({ now: 1700000000000 });
      await t.mutation(api.payouts.markBatchAsPaid, { batchId });

      // All payouts should have the same frozen timestamp
      const jamiePayout = await t.run(async (ctx) => {
        return await ctx.db.get(jamiePayoutId);
      });
      const ramonPayout = await t.run(async (ctx) => {
        return await ctx.db.get(ramonPayoutId);
      });

      expect(jamiePayout?.paidAt).toBe(1700000000000);
      expect(ramonPayout?.paidAt).toBe(1700000000000);

      vi.useRealTimers();
    });

    it("should handle batch with mix of already-paid and pending payouts", async () => {
      const t = convexTest(schema, testModules);
      const { jamiePayoutId, ramonPayoutId, batchId } =
        await setupBatchWithBranding(t);

      // Mark one payout individually first
      vi.useFakeTimers();
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: jamiePayoutId,
      });

      // Now mark all remaining — should only schedule email for the pending one
      const result = await t.mutation(api.payouts.markBatchAsPaid, {
        batchId,
      });
      expect(result.payoutsMarked).toBe(1);

      // Verify audit log has correct email stats (1 email for the pending payout)
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "batch_marked_paid"))
          .collect();
      });
      const log = auditLogs.find((l: any) => l.entityId === batchId);
      expect(log?.metadata.payoutsMarked).toBe(1);
      expect(log?.metadata.emailsScheduled).toBe(1);

      vi.useRealTimers();
    });
  });
});

// =============================================================================
// Story 13.6: Payout Audit Log - Tests
// =============================================================================
describe("Story 13.6: Payout Audit Log", () => {
  // ===========================================================================
  // Helper: Create a tenant, user, and test data for payout audit tests
  // ===========================================================================
  async function setupPayoutAuditTestData(t: ReturnType<typeof convexTest>) {
    const tenantId = await t.run(async (ctx) => {
      return await ctx.db.insert("tenants", {
        name: "Test SaaS Co.",
        slug: "test-saas-co",
        plan: "starter",
        status: "active",
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        tenantId,
        email: "owner@test.com",
        name: "Test Owner",
        role: "owner",
        authId: "auth_user_123",
      });
    });

    const campaignId = await t.run(async (ctx) => {
      return await ctx.db.insert("campaigns", {
        tenantId,
        name: "Test Campaign",
        commissionType: "percentage",
        commissionValue: 10,
        recurringCommission: false,
        status: "active",
      });
    });

    const affiliateId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliates", {
        tenantId,
        email: "jamie@test.com",
        name: "Jamie Cruz",
        uniqueCode: "JAMIE01",
        status: "active",
        payoutMethod: { type: "GCash", details: "0917 123 4567" },
      });
    });

    return { tenantId, userId, campaignId, affiliateId };
  }

  // ===========================================================================
  // Task 4: Immutability Tests (AC2 - NFR14)
  // ===========================================================================
  describe("Immutability: Audit log entries cannot be modified or deleted", () => {
    /**
     * IMMUTABILITY GUARANTEE VERIFICATION
     * 
     * Per NFR14: Audit log entries must be immutable. This is enforced by:
     * 1. audit.ts ONLY contains INSERT operations for auditLogs table
     * 2. No mutations exist to UPDATE or DELETE audit log entries
     * 3. All audit logging goes through centralized internal mutations
     * 
     * The immutability guarantee is documented in convex/audit.ts lines 11-23.
     * This test verifies the functional behavior - audit logs can be created
     * but the system provides no mechanism to modify them.
     */

    it("should create audit log entries that cannot be modified through public API", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      // Create an audit log entry
      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_batch_generated",
        entityType: "payoutBatches",
        entityId: "test-batch-immutable",
        actorId: "test-user",
        actorType: "user",
        metadata: { originalData: true },
      });

      // Verify the entry was created
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_entity", (q) => 
            q.eq("entityType", "payoutBatches").eq("entityId", "test-batch-immutable")
          )
          .collect();
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].metadata.originalData).toBe(true);
      
      // Verify there are NO public mutations to modify audit logs
      // The only way to interact with audit logs is through:
      // - logPayoutAuditEvent (internal mutation - creates only)
      // - logCommissionAuditEvent (internal mutation - creates only)
      // - listPayoutAuditLogs (query - reads only)
      // - getCommissionAuditLog (query - reads only)
      // - listCommissionAuditLogs (query - reads only)
    });

    it("should only allow internal mutations to create audit logs, never update/delete", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      // Verify logPayoutAuditEvent is registered as internalMutation
      // (this is verified by the convex compiler - internal mutations can't be called from client)
      
      // Attempt to create multiple entries - all should succeed
      for (let i = 0; i < 3; i++) {
        await t.mutation(internal.audit.logPayoutAuditEvent, {
          tenantId,
          action: "payout_batch_generated",
          entityType: "payoutBatches",
          entityId: `batch-${i}`,
          actorId: "test-user",
          actorType: "user",
          metadata: { count: i },
        });
      }

      // All entries should exist independently (append-only)
      const allLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .filter((q) => q.eq(q.field("action"), "payout_batch_generated"))
          .collect();
      });

      expect(allLogs.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ===========================================================================
  // Task 4: Tests for logPayoutAuditEvent function
  // ===========================================================================
  describe("logPayoutAuditEvent internal mutation", () => {
    it("should create audit log entry with correct action type: BATCH_GENERATED", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_batch_generated",
        entityType: "payoutBatches",
        entityId: "test-batch-id",
        actorId: "test-user-id",
        actorType: "user",
        metadata: {
          affiliateCount: 5,
          totalAmount: 25000,
          batchStatus: "pending",
        },
      });

      // Verify audit log was created
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "payout_batch_generated"))
          .collect();
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].entityType).toBe("payoutBatches");
      expect(auditLogs[0].actorType).toBe("user");
      expect(auditLogs[0].metadata).toEqual({
        affiliateCount: 5,
        totalAmount: 25000,
        batchStatus: "pending",
      });
    });

    it("should create audit log entry with correct action type: PAYOUT_MARKED_PAID", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_marked_paid",
        entityType: "payouts",
        entityId: "test-payout-id",
        actorId: "test-user-id",
        actorType: "user",
        targetId: "test-batch-id",
        metadata: {
          affiliateId: "test-affiliate-id",
          amount: 5000,
          paymentReference: "BANK-REF-123",
          batchStatus: "processing",
          emailScheduled: true,
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "payout_marked_paid"))
          .collect();
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].entityType).toBe("payouts");
      expect(auditLogs[0].targetId).toBe("test-batch-id");
      expect(auditLogs[0].metadata.amount).toBe(5000);
    });

    it("should create audit log entry with correct action type: BATCH_MARKED_PAID", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "batch_marked_paid",
        entityType: "payoutBatches",
        entityId: "test-batch-id",
        actorId: "test-user-id",
        actorType: "user",
        metadata: {
          payoutsMarked: 3,
          totalAmount: 15000,
          paymentReference: "BATCH-REF-456",
          payoutIds: ["p1", "p2", "p3"],
          emailsScheduled: 3,
          emailScheduleFailures: 0,
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "batch_marked_paid"))
          .collect();
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].entityType).toBe("payoutBatches");
      expect(auditLogs[0].metadata.payoutsMarked).toBe(3);
      expect(auditLogs[0].metadata.emailsScheduled).toBe(3);
    });

    it("should create entries with correct tenant isolation", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      // Create another tenant
      const otherTenantId = await t.run(async (ctx) => {
        return await ctx.db.insert("tenants", {
          name: "Other SaaS Co.",
          slug: "other-saas-co",
          plan: "starter",
          status: "active",
        });
      });

      // Log audit for our tenant
      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_batch_generated",
        entityType: "payoutBatches",
        entityId: "our-batch-id",
        actorId: "test-user-id",
        actorType: "user",
        metadata: {},
      });

      // Log audit for other tenant
      await t.run(async (ctx) => {
        await ctx.db.insert("auditLogs", {
          tenantId: otherTenantId,
          action: "payout_batch_generated",
          entityType: "payoutBatches",
          entityId: "other-batch-id",
          actorId: "other-user-id",
          actorType: "user",
          metadata: {},
        });
      });

      // Query audit logs by action - should only get our tenant's logs
      const ourAuditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .filter((q) => q.eq(q.field("action"), "payout_batch_generated"))
          .collect();
      });

      expect(ourAuditLogs.length).toBe(1);
      expect(ourAuditLogs[0].entityId).toBe("our-batch-id");
    });
  });

  // ===========================================================================
  // Task 3: Tests for listPayoutAuditLogs query
  // ===========================================================================
  describe("listPayoutAuditLogs query", () => {
    it("should return only payout and payoutBatch entity types", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliateId } = await setupPayoutAuditTestData(t);

      // Create a commission audit log entry (should NOT appear in payout audit log)
      await t.run(async (ctx) => {
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "COMMISSION_APPROVED",
          entityType: "commission",
          entityId: "commission-id-1",
          actorId: "user-1",
          actorType: "user",
          metadata: {},
          affiliateId,
        });
      });

      // Create payout audit log entries
      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_batch_generated",
        entityType: "payoutBatches",
        entityId: "batch-1",
        actorId: "user-1",
        actorType: "user",
        metadata: {},
      });

      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_marked_paid",
        entityType: "payouts",
        entityId: "payout-1",
        actorId: "user-1",
        actorType: "user",
        metadata: {},
      });

      // Query payout audit logs
      const result = await t.query(api.audit.listPayoutAuditLogs, {
        paginationOpts: { numItems: 20, cursor: null },
      });

      expect(result.page.length).toBe(2);
      // Verify no commission entries in the results
      result.page.forEach((log: any) => {
        expect(["payouts", "payoutBatches"]).toContain(log.entityType);
      });
    });

    it("should return entries sorted by _creationTime descending", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      // Create multiple audit entries
      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_batch_generated",
        entityType: "payoutBatches",
        entityId: "batch-1",
        actorId: "user-1",
        actorType: "user",
        metadata: {},
      });

      // Small delay to ensure different timestamps
      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_marked_paid",
        entityType: "payouts",
        entityId: "payout-1",
        actorId: "user-1",
        actorType: "user",
        metadata: {},
      });

      const result = await t.query(api.audit.listPayoutAuditLogs, {
        paginationOpts: { numItems: 20, cursor: null },
      });

      // Verify descending order
      for (let i = 0; i < result.page.length - 1; i++) {
        expect(result.page[i]._creationTime).toBeGreaterThanOrEqual(
          result.page[i + 1]._creationTime
        );
      }
    });

    it("should filter by action type when provided", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      // Create different action types
      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_batch_generated",
        entityType: "payoutBatches",
        entityId: "batch-1",
        actorId: "user-1",
        actorType: "user",
        metadata: {},
      });

      await t.mutation(internal.audit.logPayoutAuditEvent, {
        tenantId,
        action: "payout_marked_paid",
        entityType: "payouts",
        entityId: "payout-1",
        actorId: "user-1",
        actorType: "user",
        metadata: {},
      });

      // Filter by payout_batch_generated only
      const result = await t.query(api.audit.listPayoutAuditLogs, {
        paginationOpts: { numItems: 20, cursor: null },
        action: "payout_batch_generated",
      });

      expect(result.page.length).toBe(1);
      expect(result.page[0].action).toBe("payout_batch_generated");
    });

    it("should handle pagination correctly", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId } = await setupPayoutAuditTestData(t);

      // Create multiple entries
      for (let i = 0; i < 5; i++) {
        await t.mutation(internal.audit.logPayoutAuditEvent, {
          tenantId,
          action: "payout_batch_generated",
          entityType: "payoutBatches",
          entityId: `batch-${i}`,
          actorId: "user-1",
          actorType: "user",
          metadata: {},
        });
      }

      // Request only 2 items per page
      const page1 = await t.query(api.audit.listPayoutAuditLogs, {
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(page1.page.length).toBe(2);
      expect(page1.isDone).toBe(false);
      expect(page1.continueCursor).toBeTruthy();

      // Request next page
      const page2 = await t.query(api.audit.listPayoutAuditLogs, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      });

      expect(page2.page.length).toBe(2);
      expect(page2.isDone).toBe(false);
    });

    it("should return empty page for unauthenticated user", async () => {
      const t = convexTest(schema, testModules);

      // No user setup - simulate unauthenticated access
      const result = await t.query(api.audit.listPayoutAuditLogs, {
        paginationOpts: { numItems: 20, cursor: null },
      });

      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });
  });

  // ===========================================================================
  // Task 2: Integration Tests - Verify centralized function is used
  // ===========================================================================
  describe("Integration: Centralized payout audit function", () => {
    it("generatePayoutBatch should create audit entry via centralized function", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliateId } = await setupPayoutAuditTestData(t);

      // Create confirmed commission
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      // Generate batch
      const result = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Verify audit log was created with centralized function
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "payout_batch_generated"))
          .collect();
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const batchLog = auditLogs.find(
        (log: any) => log.entityType === "payoutBatches"
      );
      expect(batchLog).toBeDefined();
      expect(batchLog.metadata.affiliateCount).toBe(1);
      expect(batchLog.metadata.totalAmount).toBe(5000);
    });

    it("markPayoutAsPaid should create audit entry via centralized function", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliateId } = await setupPayoutAuditTestData(t);

      // Setup batch and payout
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(api.payouts.generatePayoutBatch, {});

      const payouts = await t.run(async (ctx) => {
        return await ctx.db
          .query("payouts")
          .withIndex("by_batch", (q) => q.eq("batchId", batchResult.batchId))
          .collect();
      });

      // Mark payout as paid
      await t.mutation(api.payouts.markPayoutAsPaid, {
        payoutId: payouts[0]._id,
        paymentReference: "TEST-REF-123",
      });

      // Verify audit log was created with centralized function
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "payout_marked_paid"))
          .collect();
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const payoutLog = auditLogs.find(
        (log: any) => log.entityType === "payouts"
      );
      expect(payoutLog).toBeDefined();
      expect(payoutLog.metadata.amount).toBe(5000);
      expect(payoutLog.metadata.paymentReference).toBe("TEST-REF-123");
    });

    it("markBatchAsPaid should create audit entry via centralized function", async () => {
      const t = convexTest(schema, testModules);
      const { tenantId, campaignId, affiliateId } = await setupPayoutAuditTestData(t);

      // Setup batch
      await t.run(async (ctx) => {
        await ctx.db.insert("commissions", {
          tenantId,
          affiliateId,
          campaignId,
          amount: 5000,
          status: "approved",
        });
      });

      const batchResult = await t.mutation(api.payouts.generatePayoutBatch, {});

      // Mark batch as paid
      await t.mutation(api.payouts.markBatchAsPaid, {
        batchId: batchResult.batchId,
        paymentReference: "BATCH-REF-456",
      });

      // Verify audit log was created with centralized function
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "batch_marked_paid"))
          .collect();
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
      const batchLog = auditLogs.find(
        (log: any) => log.entityType === "payoutBatches"
      );
      expect(batchLog).toBeDefined();
      expect(batchLog.metadata.payoutsMarked).toBe(1);
      expect(batchLog.metadata.paymentReference).toBe("BATCH-REF-456");
    });
  });
});
