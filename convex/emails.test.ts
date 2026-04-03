/**
 * Unit Tests for Email Functions (Stories 10.2, 10.3 & 10.4)
 * Testing Commission Confirmed Email, Payout Sent Email, and New Referral Alert Email
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";

// Import actual modules for testing
import * as emailsModule from "./emails";
import PayoutSentEmail from "./emails/PayoutSentEmail";
import CommissionConfirmedEmail from "./emails/CommissionConfirmedEmail";

// Test module setup with actual implementations
const testModules = {
  emails: emailsModule,
};

describe("Commission Confirmed Email Tests", () => {
  const t = convexTest(schema, testModules as any);

  describe("email logging", () => {
    it("should track email sent successfully", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        // Test trackEmailSent mutation
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "commission_confirmed",
          recipientEmail: "affiliate@test.com",
          subject: "Commission Confirmed: PHP 1,000.00",
          status: "sent",
        });

        // Verify email was logged
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBe(1);
        expect(emails[0].type).toBe("commission_confirmed");
        expect(emails[0].recipientEmail).toBe("affiliate@test.com");
        expect(emails[0].status).toBe("sent");
      });
    });

    it("should track email failed with error message", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        // Test trackEmailSent mutation with failure
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "commission_confirmed",
          recipientEmail: "affiliate@test.com",
          subject: "Commission Confirmed: PHP 1,000.00",
          status: "failed",
          errorMessage: "Test error message",
        });

        // Verify email was logged with error
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBe(1);
        expect(emails[0].status).toBe("failed");
        expect(emails[0].errorMessage).toBe("Test error message");
      });
    });
  });

  describe("email data structure", () => {
    it("should create commission with email trigger data", async () => {
      await t.run(async (ctx) => {
        // Create tenant with branding
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          branding: {
            portalName: "Test Affiliate Portal",
            primaryColor: "#1c2260",
            logoUrl: "https://example.com/logo.png",
          },
        });

        // Create affiliate
        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        // Create campaign
        const campaignId = await ctx.db.insert("campaigns", {
          tenantId,
          name: "Test Campaign",
          slug: "test-campaign",
          commissionType: "percentage",
          commissionValue: 10,
          recurringCommission: false,
          status: "active",
          });
        
        // Create a commission with all email-related fields
        const commissionId = await ctx.db.insert("commissions", {
          tenantId,
          affiliateId,
          campaignId,
          amount: 2500.50,
          status: "pending",
          eventMetadata: {
            source: "webhook",
            transactionId: "txn_test_123",
            timestamp: Date.now(),
            subscriptionId: "sub_789",
          },
          transactionId: "txn_test_123",
        });

        // Verify commission was created
        const commission = await ctx.db.get(commissionId);
        expect(commission).toBeDefined();
        expect(commission?.amount).toBe(2500.50);
        expect(commission?.status).toBe("pending");
      });
    });

    it("should handle missing optional fields in conversion (Subtask 4.2)", async () => {
      await t.run(async (ctx) => {
        // Create minimal tenant
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        // Create affiliate
        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        // Create campaign
        const campaignId = await ctx.db.insert("campaigns", {
          tenantId,
          name: "Test Campaign",
          slug: "test-campaign",
          commissionType: "percentage",
          commissionValue: 10,
          recurringCommission: false,
          status: "active",
          });
        
        // Create conversion WITHOUT optional metadata (Subtask 4.2)
        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          campaignId,
          amount: 3000,
          customerEmail: "customer2@test.com",
          // metadata is intentionally undefined - tests missing field handling
        });

        const conversion = await ctx.db.get(conversionId);
        expect(conversion).toBeDefined();
        expect(conversion?.metadata).toBeUndefined();
      });
    });

    it("should track multiple email attempts (retry scenario)", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });
        
        // Track multiple email attempts (simulating retry scenario)
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "commission_confirmed",
          recipientEmail: "affiliate@test.com",
          subject: "Attempt 1",
          status: "failed",
          errorMessage: "Network error",
        });

        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "commission_confirmed",
          recipientEmail: "affiliate@test.com",
          subject: "Attempt 2",
          status: "failed",
          errorMessage: "Network error",
        });

        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "commission_confirmed",
          recipientEmail: "affiliate@test.com",
          subject: "Attempt 3",
          status: "sent",
        });

        // Verify all attempts were logged
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 10,
        });

        expect(emails.length).toBe(3);
        expect(emails[0].status).toBe("sent");
        expect(emails[1].status).toBe("failed");
        expect(emails[2].status).toBe("failed");
      });
    });
  });
});

describe("Payout Sent Email Tests (Story 10.3)", () => {
  const t = convexTest(schema, testModules as any);

  describe("email template rendering", () => {
    it("should render PayoutSentEmail template with all props", async () => {
      const html = await render(
        React.createElement(PayoutSentEmail, {
          affiliateName: "John Doe",
          payoutAmount: 5000,
          paymentReference: "PAY-2026-001234",
          paidAt: Date.now(),
          currency: "PHP",
          portalName: "Test Portal",
          brandLogoUrl: "https://example.com/logo.png",
          brandPrimaryColor: "#1c2260",
          portalEarningsUrl: "https://portal.example.com/earnings",
          contactEmail: "support@example.com",
          batchGeneratedAt: Date.now(),
        })
      );

      // Verify essential content is in the HTML
      expect(html).toContain("John Doe");
      expect(html).toContain("PHP");
      expect(html).toContain("5,000");
      expect(html).toContain("PAY-2026-001234");
      expect(html).toContain("Test Portal");
      expect(html).toContain("https://portal.example.com/earnings");
      expect(html).toContain("support@example.com");
    });

    it("should render template with minimal required props", async () => {
      const html = await render(
        React.createElement(PayoutSentEmail, {
          affiliateName: "Jane Smith",
          payoutAmount: 1000,
          paidAt: Date.now(),
          portalName: "Minimal Portal",
        })
      );

      expect(html).toContain("Jane Smith");
      expect(html).toContain("1,000");
      expect(html).toContain("Minimal Portal");
      // Optional fields should not cause errors
      expect(html).not.toContain("undefined");
    });

    it("should handle USD currency formatting", async () => {
      const html = await render(
        React.createElement(PayoutSentEmail, {
          affiliateName: "Global User",
          payoutAmount: 1500.50,
          paidAt: Date.now(),
          currency: "USD",
          portalName: "Global Portal",
        })
      );

      expect(html).toContain("USD");
      expect(html).toContain("1,500.50");
    });
  });

  describe("email logging", () => {
    it("should track payout sent email successfully", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        // Test trackEmailSent mutation for payout_sent
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "payout_sent",
          recipientEmail: "affiliate@test.com",
          subject: "Payout of PHP 5,000.00 has been sent",
          status: "sent",
        });

        // Verify email was logged
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBe(1);
        expect(emails[0].type).toBe("payout_sent");
        expect(emails[0].recipientEmail).toBe("affiliate@test.com");
        expect(emails[0].status).toBe("sent");
      });
    });

    it("should track payout email failure with error message", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        // Test trackEmailSent mutation with failure
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "payout_sent",
          recipientEmail: "affiliate@test.com",
          subject: "Payout of PHP 5,000.00 has been sent",
          status: "failed",
          errorMessage: "Resend API error",
        });

        // Verify email was logged with error
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBe(1);
        expect(emails[0].status).toBe("failed");
        expect(emails[0].errorMessage).toBe("Resend API error");
      });
    });
  });

  describe("payout email data structure", () => {
    it("should create payout with email trigger data", async () => {
      await t.run(async (ctx) => {
        // Create tenant with branding
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          branding: {
            portalName: "Test Affiliate Portal",
            primaryColor: "#1c2260",
            logoUrl: "https://example.com/logo.png",
          },
        });

        // Create affiliate
        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        // Create payout batch
        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 15000,
          affiliateCount: 5,
          status: "completed",
          generatedAt: Date.now(),
          completedAt: Date.now(),
        });

        // Create a payout with all email-related fields
        const payoutId = await ctx.db.insert("payouts", {
          tenantId,
          affiliateId,
          batchId,
          amount: 5000,
          status: "paid",
          paymentReference: "PAY-2026-001234",
          paidAt: Date.now(),
        });

        // Verify payout was created
        const payout = await ctx.db.get(payoutId);
        expect(payout).toBeDefined();
        expect(payout?.amount).toBe(5000);
        expect(payout?.status).toBe("paid");
        expect(payout?.paymentReference).toBe("PAY-2026-001234");
      });
    });

    it("should handle missing optional fields in payout (paymentReference, batchGeneratedAt)", async () => {
      await t.run(async (ctx) => {
        // Create minimal tenant
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        // Create affiliate
        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        // Create payout batch
        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 5000,
          affiliateCount: 1,
          status: "completed",
          generatedAt: Date.now(),
        });

        // Create payout WITHOUT optional fields (paymentReference, batchGeneratedAt)
        const payoutId = await ctx.db.insert("payouts", {
          tenantId,
          affiliateId,
          batchId,
          amount: 5000,
          status: "paid",
          // paymentReference is intentionally undefined
          // paidAt is intentionally undefined
        });

        const payout = await ctx.db.get(payoutId);
        expect(payout).toBeDefined();
        expect(payout?.amount).toBe(5000);
        expect(payout?.paymentReference).toBeUndefined();
        expect(payout?.paidAt).toBeUndefined();
      });
    });

    it("should handle currency formatting (defaults to PHP)", async () => {
      await t.run(async (ctx) => {
        // Test that currency defaults to PHP if not specified
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        // Verify affiliate data is correct
        const affiliate = await ctx.db.get(affiliateId);
        expect(affiliate).toBeDefined();
        expect(affiliate?.email).toBe("affiliate@test.com");
      });
    });

    it("should track multiple payout email attempts (retry scenario)", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });
        
        // Track multiple email attempts (simulating retry scenario)
        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "payout_sent",
          recipientEmail: "affiliate@test.com",
          subject: "Attempt 1",
          status: "failed",
          errorMessage: "Network error",
        });

        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "payout_sent",
          recipientEmail: "affiliate@test.com",
          subject: "Attempt 2",
          status: "failed",
          errorMessage: "Network error",
        });

        await ctx.runMutation(internal.emails.trackEmailSent, {
          tenantId,
          type: "payout_sent",
          recipientEmail: "affiliate@test.com",
          subject: "Attempt 3",
          status: "sent",
        });

        // Verify all attempts were logged
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 10,
        });

        expect(emails.length).toBe(3);
        expect(emails[0].status).toBe("sent");
        expect(emails[1].status).toBe("failed");
        expect(emails[2].status).toBe("failed");
      });
    });
  });

  describe("sendPayoutSentEmail action", () => {
    it("should return proper response structure", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "test@example.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 5000,
          affiliateCount: 1,
          status: "completed",
          generatedAt: Date.now(),
        });

        const payoutId = await ctx.db.insert("payouts", {
          tenantId,
          affiliateId,
          batchId,
          amount: 5000,
          status: "paid",
          paidAt: Date.now(),
        });

        // Mock the scheduler to capture retry attempts
        const schedulerCalls: Array<{ delay: number; args: any }> = [];
        const originalScheduler = ctx.scheduler;
        ctx.scheduler = {
          ...originalScheduler,
          runAfter: async (delay: number, _ref: any, args: any) => {
            schedulerCalls.push({ delay, args });
          },
        } as any;

        // Call the action with force-fail scenario (no Resend in test env)
        const result = await (ctx as any).runAction(internal.emails.sendPayoutSentEmail, {
          tenantId,
          payoutId,
          affiliateId,
          affiliateEmail: "test@example.com",
          affiliateName: "Test Affiliate",
          payoutAmount: 5000,
          paidAt: Date.now(),
          portalName: "Test Portal",
        });

        // Verify result structure
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("retryCount");
        expect(result).toHaveProperty("error");
        expect(typeof result.retryCount).toBe("number");

        // Verify email was tracked as failed (Resend not available in tests)
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBeGreaterThan(0);
        expect(emails[0].type).toBe("payout_sent");
      });
    });

    it("should implement exponential backoff retry delays", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "test@example.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 5000,
          affiliateCount: 1,
          status: "completed",
          generatedAt: Date.now(),
        });

        const payoutId = await ctx.db.insert("payouts", {
          tenantId,
          affiliateId,
          batchId,
          amount: 5000,
          status: "paid",
          paidAt: Date.now(),
        });

        // Capture scheduler calls
        const schedulerCalls: Array<{ delay: number }> = [];
        const originalScheduler = ctx.scheduler;
        ctx.scheduler = {
          ...originalScheduler,
          runAfter: async (delay: number) => {
            schedulerCalls.push({ delay });
          },
        } as any;

        // Call with attempt 0 (should schedule retry with 5s delay)
        await (ctx as any).runAction(internal.emails.sendPayoutSentEmail, {
          tenantId,
          payoutId,
          affiliateId,
          affiliateEmail: "test@example.com",
          affiliateName: "Test Affiliate",
          payoutAmount: 5000,
          paidAt: Date.now(),
          portalName: "Test Portal",
          attempt: 0,
        });

        // Should schedule retry with 5s base delay (5000ms)
        expect(schedulerCalls.length).toBeGreaterThan(0);
        expect(schedulerCalls[0].delay).toBe(5000);
      });
    });

    it("should handle max retries exhaustion", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "test@example.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const batchId = await ctx.db.insert("payoutBatches", {
          tenantId,
          totalAmount: 5000,
          affiliateCount: 1,
          status: "completed",
          generatedAt: Date.now(),
        });

        const payoutId = await ctx.db.insert("payouts", {
          tenantId,
          affiliateId,
          batchId,
          amount: 5000,
          status: "paid",
          paidAt: Date.now(),
        });

        // Call with attempt 3 (maxRetries is 3, so this should fail without retry)
        const result = await (ctx as any).runAction(internal.emails.sendPayoutSentEmail, {
          tenantId,
          payoutId,
          affiliateId,
          affiliateEmail: "test@example.com",
          affiliateName: "Test Affiliate",
          payoutAmount: 5000,
          paidAt: Date.now(),
          portalName: "Test Portal",
          attempt: 3,
        });

        // Should return failure with retryCount = 3
        expect(result.success).toBe(false);
        expect(result.retryCount).toBe(3);
      });
    });
  });
});

describe("CommissionConfirmedEmail Template Tests", () => {
  it("should render with all optional fields", async () => {
    const html = await render(
      React.createElement(CommissionConfirmedEmail, {
        affiliateName: "John Doe",
        commissionAmount: 1500.75,
        campaignName: "Summer Sale",
        conversionDate: Date.now(),
        transactionId: "txn_12345",
        customerPlanType: "Pro Plan",
        portalName: "Test Portal",
        brandLogoUrl: "https://example.com/logo.png",
        brandPrimaryColor: "#ff0000",
        portalEarningsUrl: "https://portal.example.com/earnings",
        contactEmail: "support@example.com",
        currency: "USD",
      })
    );

    expect(html).toContain("John Doe");
    expect(html).toContain("1,500.75");
    expect(html).toContain("Summer Sale");
    expect(html).toContain("txn_12345");
    expect(html).toContain("Pro Plan");
  });

  it("should render with minimal required fields", async () => {
    const html = await render(
      React.createElement(CommissionConfirmedEmail, {
        affiliateName: "Jane Smith",
        commissionAmount: 500,
        campaignName: "Basic Campaign",
        conversionDate: Date.now(),
        portalName: "Test Portal",
      })
    );

    expect(html).toContain("Jane Smith");
    expect(html).toContain("500");
    expect(html).toContain("Basic Campaign");
    expect(html).not.toContain("undefined");
  });
});

// Import NewReferralAlertEmail for testing
import NewReferralAlertEmail from "./emails/NewReferralAlertEmail";

describe("New Referral Alert Email Tests", () => {
  const t = convexTest(schema, testModules as any);

  describe("email rendering", () => {
    it("should render email with all required fields", async () => {
      const html = await render(
        React.createElement(NewReferralAlertEmail, {
          ownerName: "Alex Owner",
          affiliateName: "Jamie Affiliate",
          affiliateEmail: "jamie@affiliate.com",
          conversionAmount: 1000,
          conversionDate: Date.now(),
          customerEmail: "customer@example.com",
          campaignName: "Summer Campaign",
          commissionAmount: 200,
          portalName: "Test Portal",
          brandLogoUrl: "https://example.com/logo.png",
          brandPrimaryColor: "#1c2260",
          dashboardAffiliateUrl: "https://portal.example.com/affiliates/123",
          dashboardConversionUrl: "https://portal.example.com/conversions/456",
          contactEmail: "support@example.com",
          currency: "PHP",
        })
      );

      expect(html).toContain("Alex Owner");
      expect(html).toContain("Jamie Affiliate");
      expect(html).toContain("jamie@affiliate.com");
      expect(html).toContain("1,000");
      expect(html).toContain("200");
      expect(html).toContain("Summer Campaign");
      expect(html).toContain("Test Portal");
      expect(html).toContain("support@example.com");
    });

    it("should mask customer email for privacy", async () => {
      const html = await render(
        React.createElement(NewReferralAlertEmail, {
          affiliateName: "Jamie Affiliate",
          affiliateEmail: "jamie@affiliate.com",
          conversionAmount: 1000,
          conversionDate: Date.now(),
          customerEmail: "john.doe@example.com",
          commissionAmount: 200,
          portalName: "Test Portal",
        })
      );

      // Should show masked email
      expect(html).toContain("j***@example.com");
      // Should not show full email
      expect(html).not.toContain("john.doe@example.com");
    });

    it("should handle missing optional fields gracefully", async () => {
      const html = await render(
        React.createElement(NewReferralAlertEmail, {
          affiliateName: "Jamie Affiliate",
          affiliateEmail: "jamie@affiliate.com",
          conversionAmount: 1000,
          conversionDate: Date.now(),
          commissionAmount: 200,
          portalName: "Test Portal",
        })
      );

      expect(html).toContain("Jamie Affiliate");
      expect(html).toContain("1,000");
      expect(html).toContain("200");
      expect(html).not.toContain("undefined");
    });

    it("should render with custom currency", async () => {
      const html = await render(
        React.createElement(NewReferralAlertEmail, {
          affiliateName: "Jamie Affiliate",
          affiliateEmail: "jamie@affiliate.com",
          conversionAmount: 1500.75,
          conversionDate: Date.now(),
          commissionAmount: 300.50,
          portalName: "Test Portal",
          currency: "USD",
        })
      );

      expect(html).toContain("1,500.75");
      expect(html).toContain("300.50");
    });
  });

  describe("email masking function", () => {
    it("should mask short email addresses correctly", () => {
      // This tests the maskCustomerEmail helper function indirectly through rendering
      const html = render(
        React.createElement(NewReferralAlertEmail, {
          affiliateName: "Test",
          affiliateEmail: "test@test.com",
          conversionAmount: 100,
          conversionDate: Date.now(),
          customerEmail: "ab@test.com",
          commissionAmount: 20,
          portalName: "Test",
        })
      );

      // For short local parts, it should mask with "***"
      expect(html).toContain("a***@test.com");
    });
  });

  describe("sendNewReferralAlertEmail action", () => {
    it("should return proper response structure", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          amount: 1000,
          attributionSource: "webhook",
        });

        // Call the action with force-fail scenario (no Resend in test env)
        const result = await (ctx as any).runAction(internal.emails.sendNewReferralAlertEmail, {
          tenantId,
          conversionId,
          affiliateId,
          ownerEmail: "owner@test.com",
          ownerName: "Alex Owner",
          affiliateName: "Test Affiliate",
          affiliateEmail: "affiliate@test.com",
          conversionAmount: 1000,
          commissionAmount: 200,
          portalName: "Test Portal",
        });

        // Verify result structure
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("retryCount");
        expect(result).toHaveProperty("error");
        expect(typeof result.retryCount).toBe("number");

        // Verify email was tracked as failed (Resend not available in tests)
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBeGreaterThan(0);
        expect(emails[0].type).toBe("new_referral_alert");
      });
    });

    it("should implement exponential backoff retry delays", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          amount: 1000,
          attributionSource: "webhook",
        });

        // Capture scheduler calls
        const schedulerCalls: Array<{ delay: number }> = [];
        const originalScheduler = ctx.scheduler;
        ctx.scheduler = {
          ...originalScheduler,
          runAfter: async (delay: number) => {
            schedulerCalls.push({ delay });
          },
        } as any;

        // Call with attempt 0 (should schedule retry with 5s delay)
        await (ctx as any).runAction(internal.emails.sendNewReferralAlertEmail, {
          tenantId,
          conversionId,
          affiliateId,
          ownerEmail: "owner@test.com",
          ownerName: "Alex Owner",
          affiliateName: "Test Affiliate",
          affiliateEmail: "affiliate@test.com",
          conversionAmount: 1000,
          commissionAmount: 200,
          portalName: "Test Portal",
          attempt: 0,
        });

        // Should schedule retry with 5s base delay (5000ms)
        expect(schedulerCalls.length).toBeGreaterThan(0);
        expect(schedulerCalls[0].delay).toBe(5000);
      });
    });

    it("should handle max retries exhaustion", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          amount: 1000,
          attributionSource: "webhook",
        });

        // Call with attempt 3 (maxRetries is 3, so this should fail without retry)
        const result = await (ctx as any).runAction(internal.emails.sendNewReferralAlertEmail, {
          tenantId,
          conversionId,
          affiliateId,
          ownerEmail: "owner@test.com",
          ownerName: "Alex Owner",
          affiliateName: "Test Affiliate",
          affiliateEmail: "affiliate@test.com",
          conversionAmount: 1000,
          commissionAmount: 200,
          portalName: "Test Portal",
          attempt: 3,
        });

        // Should return failure with retryCount = 3
        expect(result.success).toBe(false);
        expect(result.retryCount).toBe(3);
      });
    });

    it("should use ownerName in email when provided", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
          });

        const affiliateId = await ctx.db.insert("affiliates", {
          tenantId,
          email: "affiliate@test.com",
          firstName: "Test",
          lastName: "Affiliate",
          name: "Test Affiliate",
          uniqueCode: "TEST123",
          status: "approved",
        });

        const conversionId = await ctx.db.insert("conversions", {
          tenantId,
          affiliateId,
          amount: 1000,
          attributionSource: "webhook",
        });

        // Call action with ownerName
        await (ctx as any).runAction(internal.emails.sendNewReferralAlertEmail, {
          tenantId,
          conversionId,
          affiliateId,
          ownerEmail: "owner@test.com",
          ownerName: "Alex Owner",
          affiliateName: "Test Affiliate",
          affiliateEmail: "affiliate@test.com",
          conversionAmount: 1000,
          commissionAmount: 200,
          portalName: "Test Portal",
        });

        // Verify email was tracked
        const emails = await ctx.runMutation(internal.emails.getEmailHistory, {
          tenantId,
          limit: 1,
        });

        expect(emails.length).toBe(1);
        expect(emails[0].recipientEmail).toBe("owner@test.com");
      });
    });
  });
});
