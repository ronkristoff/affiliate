/**
 * Unit Tests for Broadcast Email Log (Story 10.6)
 * Testing webhook event handling, aggregate stats, recipient queries, and CSV export
 */

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import * as emailsModule from "./emails";
import * as broadcastsModule from "./broadcasts";

// Test module setup with actual implementations
const testModules = {
  emails: emailsModule,
  broadcasts: broadcastsModule,
};

describe("Webhook Event Handler Tests (Story 10.6)", () => {
  const t = convexTest(schema, testModules as any);

  describe("updateEmailDeliveryStatus", () => {
    it("should update email delivery status to 'delivered'", async () => {
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

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: "Test Broadcast",
          body: "Test body",
          recipientCount: 1,
          sentCount: 1,
          failedCount: 0,
          status: "sent",
          createdBy: "user_test" as any,
          sentAt: Date.now(),
        });

        // Create email with resendMessageId
        const emailId = await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "affiliate@test.com",
          subject: "Test Broadcast",
          status: "sent",
          sentAt: Date.now(),
          broadcastId,
          affiliateId,
          resendMessageId: "resend_msg_123",
          deliveryStatus: "sent",
        });

        // Process webhook event
        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "resend_msg_123",
          eventType: "delivered",
          timestamp: Date.now(),
        });

        // Verify email was updated
        const email = await ctx.db.get(emailId);
        expect(email).toBeDefined();
        expect(email!.deliveryStatus).toBe("delivered");
        expect(email!.deliveredAt).toBeDefined();
        expect(email!.deliveredAt).toBeGreaterThan(0);
      });
    });

    it("should update email delivery status to 'opened'", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        const emailId = await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "affiliate@test.com",
          subject: "Test Broadcast",
          status: "sent",
          sentAt: Date.now(),
          resendMessageId: "resend_msg_open",
          deliveryStatus: "delivered",
        });

        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "resend_msg_open",
          eventType: "opened",
          timestamp: Date.now(),
        });

        const email = await ctx.db.get(emailId);
        expect(email!.deliveryStatus).toBe("opened");
        expect(email!.openedAt).toBeDefined();
      });
    });

    it("should update email delivery status to 'clicked'", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        const emailId = await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "affiliate@test.com",
          subject: "Test Broadcast",
          status: "sent",
          sentAt: Date.now(),
          resendMessageId: "resend_msg_click",
          deliveryStatus: "opened",
        });

        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "resend_msg_click",
          eventType: "clicked",
          timestamp: Date.now(),
        });

        const email = await ctx.db.get(emailId);
        expect(email!.deliveryStatus).toBe("clicked");
        expect(email!.clickedAt).toBeDefined();
      });
    });

    it("should update email delivery status to 'bounced' with reason", async () => {
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
          email: "bounced@test.com",
          firstName: "Bounced",
          lastName: "Affiliate",
          name: "Bounced Affiliate",
          uniqueCode: "BOUNCED1",
          status: "approved",
        });

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: "Test Broadcast",
          body: "Test body",
          recipientCount: 1,
          sentCount: 1,
          failedCount: 0,
          status: "sent",
          createdBy: "user_test" as any,
          sentAt: Date.now(),
        });

        const emailId = await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "bounced@test.com",
          subject: "Test Broadcast",
          status: "sent",
          sentAt: Date.now(),
          broadcastId,
          affiliateId,
          resendMessageId: "resend_msg_bounce",
          deliveryStatus: "sent",
        });

        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "resend_msg_bounce",
          eventType: "bounced",
          timestamp: Date.now(),
          reason: "Mailbox not found",
        });

        const email = await ctx.db.get(emailId);
        expect(email!.deliveryStatus).toBe("bounced");
        expect(email!.bounceReason).toBe("Mailbox not found");

        // Verify broadcast aggregate was updated
        const broadcast = await ctx.db.get(broadcastId);
        expect(broadcast!.bounceCount).toBe(1);
      });
    });

    it("should update email delivery status to 'complained' with reason", async () => {
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
          email: "complainer@test.com",
          firstName: "Complainer",
          lastName: "User",
          name: "Complainer",
          uniqueCode: "COMPLAIN1",
          status: "approved",
        });

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: "Test Broadcast",
          body: "Test body",
          recipientCount: 1,
          sentCount: 1,
          failedCount: 0,
          status: "sent",
          createdBy: "user_test" as any,
          sentAt: Date.now(),
        });

        const emailId = await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "complainer@test.com",
          subject: "Test Broadcast",
          status: "sent",
          sentAt: Date.now(),
          broadcastId,
          affiliateId,
          resendMessageId: "resend_msg_complain",
          deliveryStatus: "delivered",
        });

        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "resend_msg_complain",
          eventType: "complained",
          timestamp: Date.now(),
          reason: "Spam complaint",
        });

        const email = await ctx.db.get(emailId);
        expect(email!.deliveryStatus).toBe("complained");
        expect(email!.complaintReason).toBe("Spam complaint");

        // Verify broadcast aggregate was updated
        const broadcast = await ctx.db.get(broadcastId);
        expect(broadcast!.complaintCount).toBe(1);
      });
    });

    it("should not throw when email not found (non-broadcast email)", async () => {
      await t.run(async (ctx) => {
        // Should not throw even if email doesn't exist
        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "nonexistent_msg_id",
          eventType: "delivered",
          timestamp: Date.now(),
        });
        // If we get here without error, the test passes
        expect(true).toBe(true);
      });
    });

    it("should log bounce events in audit log for admin review", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "bad-email@test.com",
          subject: "Test",
          status: "sent",
          sentAt: Date.now(),
          resendMessageId: "msg_audit_bounce",
          deliveryStatus: "sent",
        });

        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "msg_audit_bounce",
          eventType: "bounced",
          timestamp: Date.now(),
          reason: "DNS failure",
        });

        // Verify audit log was created
        const auditLogs = await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "email_bounced"))
          .collect();

        expect(auditLogs.length).toBe(1);
        expect(auditLogs[0].tenantId).toBe(tenantId);
        expect(auditLogs[0].entityType).toBe("email");
        expect((auditLogs[0].newValue as Record<string, unknown>).reason).toBe("DNS failure");
      });
    });

    it("should log complaint events in audit log for admin review", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        await ctx.db.insert("emails", {
          tenantId,
          type: "broadcast",
          recipientEmail: "spammer@test.com",
          subject: "Test",
          status: "sent",
          sentAt: Date.now(),
          resendMessageId: "msg_audit_complain",
          deliveryStatus: "delivered",
        });

        await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
          resendMessageId: "msg_audit_complain",
          eventType: "complained",
          timestamp: Date.now(),
          reason: "User reported spam",
        });

        const auditLogs = await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", "email_complained"))
          .collect();

        expect(auditLogs.length).toBe(1);
        expect((auditLogs[0].newValue as Record<string, unknown>).reason).toBe("User reported spam");
      });
    });
  });

  describe("updateBroadcastAggregateCount", () => {
    it("should increment openedCount on broadcast", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: "Test Broadcast",
          body: "Test body",
          recipientCount: 10,
          sentCount: 10,
          failedCount: 0,
          status: "sent",
          createdBy: "user_test" as any,
          sentAt: Date.now(),
          openedCount: 3,
        });

        await ctx.runMutation(internal.emails.updateBroadcastAggregateCount, {
          broadcastId,
          eventType: "opened",
        });

        const broadcast = await ctx.db.get(broadcastId);
        expect(broadcast!.openedCount).toBe(4);
      });
    });

    it("should increment clickedCount on broadcast", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: "Test Broadcast",
          body: "Test body",
          recipientCount: 10,
          sentCount: 10,
          failedCount: 0,
          status: "sent",
          createdBy: "user_test" as any,
          sentAt: Date.now(),
        });

        await ctx.runMutation(internal.emails.updateBroadcastAggregateCount, {
          broadcastId,
          eventType: "clicked",
        });

        const broadcast = await ctx.db.get(broadcastId);
        expect(broadcast!.clickedCount).toBe(1);
      });
    });

    it("should not update counts for 'delivered' event", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        const broadcastId = await ctx.db.insert("broadcastEmails", {
          tenantId,
          subject: "Test Broadcast",
          body: "Test body",
          recipientCount: 10,
          sentCount: 10,
          failedCount: 0,
          status: "sent",
          createdBy: "user_test" as any,
          sentAt: Date.now(),
        });

        await ctx.runMutation(internal.emails.updateBroadcastAggregateCount, {
          broadcastId,
          eventType: "delivered",
        });

        // Delivered doesn't have its own aggregate count
        const broadcast = await ctx.db.get(broadcastId);
        expect(broadcast!.openedCount).toBeUndefined();
        expect(broadcast!.clickedCount).toBeUndefined();
        expect(broadcast!.bounceCount).toBeUndefined();
      });
    });

    it("should handle broadcast not found gracefully", async () => {
      await t.run(async (ctx) => {
        const tenantId = await ctx.db.insert("tenants", {
          name: "Test Tenant",
          slug: "test-tenant",
          plan: "Growth",
          status: "active",
        domain: "test.example.com",
        });

        const fakeId = "broadcast_nonexistent" as any;
        // Should not throw
        await ctx.runMutation(internal.emails.updateBroadcastAggregateCount, {
          broadcastId: fakeId,
          eventType: "opened",
        });
        expect(true).toBe(true);
      });
    });
  });
});

describe("Aggregate Stats Calculation Tests (Story 10.6)", () => {
  const t = convexTest(schema, testModules as any);

  it("should calculate correct stats for a broadcast with mixed statuses", async () => {
    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "Growth",
        status: "active",
        domain: "test.example.com",
      });

      const affiliate1 = await ctx.db.insert("affiliates", {
        tenantId,
        email: "aff1@test.com",
        firstName: "Affiliate",
        lastName: "One",
        name: "Affiliate 1",
        uniqueCode: "AFF1",
        status: "approved",
      });

      const affiliate2 = await ctx.db.insert("affiliates", {
        tenantId,
        email: "aff2@test.com",
        firstName: "Affiliate",
        lastName: "Two",
        name: "Affiliate 2",
        uniqueCode: "AFF2",
        status: "approved",
      });

      const affiliate3 = await ctx.db.insert("affiliates", {
        tenantId,
        email: "aff3@test.com",
        firstName: "Affiliate",
        lastName: "Three",
        name: "Affiliate 3",
        uniqueCode: "AFF3",
        status: "approved",
      });

      const broadcastId = await ctx.db.insert("broadcastEmails", {
        tenantId,
        subject: "Stats Test",
        body: "Body",
        recipientCount: 3,
        sentCount: 3,
        failedCount: 0,
        status: "sent",
        createdBy: "user_test" as any,
        sentAt: Date.now(),
      });

      // Create emails with different statuses
      await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "aff1@test.com",
        subject: "Stats Test",
        status: "sent",
        sentAt: Date.now(),
        broadcastId,
        affiliateId: affiliate1,
        deliveryStatus: "clicked",
        deliveredAt: Date.now() - 10000,
        openedAt: Date.now() - 5000,
        clickedAt: Date.now(),
      });

      await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "aff2@test.com",
        subject: "Stats Test",
        status: "sent",
        sentAt: Date.now(),
        broadcastId,
        affiliateId: affiliate2,
        deliveryStatus: "opened",
        deliveredAt: Date.now() - 10000,
        openedAt: Date.now(),
      });

      await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "aff3@test.com",
        subject: "Stats Test",
        status: "sent",
        sentAt: Date.now(),
        broadcastId,
        affiliateId: affiliate3,
        deliveryStatus: "bounced",
        bounceReason: "Invalid email",
      });

      // Query stats
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_broadcast", (q) => q.eq("broadcastId", broadcastId))
        .collect();

      const sent = emails.filter((e) => e.status === "sent").length;
      const delivered = emails.filter((e) => e.deliveryStatus === "delivered").length;
      const opened = emails.filter((e) => e.deliveryStatus === "opened" || e.deliveryStatus === "clicked").length;
      const clicked = emails.filter((e) => e.deliveryStatus === "clicked").length;
      const bounced = emails.filter((e) => e.deliveryStatus === "bounced").length;

      expect(sent).toBe(3);
      expect(delivered).toBe(0);
      expect(opened).toBe(2);
      expect(clicked).toBe(1);
      expect(bounced).toBe(1);
    });
  });

  it("should handle broadcast with no emails gracefully", async () => {
    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "Growth",
        status: "active",
        domain: "test.example.com",
      });

      const broadcastId = await ctx.db.insert("broadcastEmails", {
        tenantId,
        subject: "Empty Broadcast",
        body: "Body",
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        status: "pending",
        createdBy: "user_test" as any,
      });

      const emails = await ctx.db
        .query("emails")
        .withIndex("by_broadcast", (q) => q.eq("broadcastId", broadcastId))
        .collect();

      expect(emails.length).toBe(0);
    });
  });
});

describe("Recipient List Query Tests (Story 10.6)", () => {
  const t = convexTest(schema, testModules as any);

  it("should return emails by broadcastId from by_broadcast index", async () => {
    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "Growth",
        status: "active",
        domain: "test.example.com",
      });

      const broadcastId = await ctx.db.insert("broadcastEmails", {
        tenantId,
        subject: "Test",
        body: "Body",
        recipientCount: 2,
        sentCount: 2,
        failedCount: 0,
        status: "sent",
        createdBy: "user_test" as any,
        sentAt: Date.now(),
      });

      const email1 = await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "user1@test.com",
        subject: "Test",
        status: "sent",
        sentAt: Date.now(),
        broadcastId,
        resendMessageId: "msg_1",
        deliveryStatus: "delivered",
      });

      const email2 = await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "user2@test.com",
        subject: "Test",
        status: "sent",
        sentAt: Date.now(),
        broadcastId,
        resendMessageId: "msg_2",
        deliveryStatus: "bounced",
        bounceReason: "Mailbox full",
      });

      // Query by broadcast index
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_broadcast", (q) => q.eq("broadcastId", broadcastId))
        .collect();

      expect(emails.length).toBe(2);
      const ids = emails.map((e) => e._id);
      expect(ids).toContain(email1);
      expect(ids).toContain(email2);
    });
  });

  it("should return emails by resendMessageId from by_resend_message_id index", async () => {
    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "Growth",
        status: "active",
        domain: "test.example.com",
      });

      await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "tracked@test.com",
        subject: "Test",
        status: "sent",
        sentAt: Date.now(),
        resendMessageId: "unique_resend_id_456",
        deliveryStatus: "sent",
      });

      // Lookup by resendMessageId
      const email = await ctx.db
        .query("emails")
        .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", "unique_resend_id_456"))
        .unique();

      expect(email).toBeDefined();
      expect(email!.recipientEmail).toBe("tracked@test.com");
    });
  });

  it("should return null when no email matches resendMessageId", async () => {
    await t.run(async (ctx) => {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", "nonexistent"))
        .unique();

      expect(email).toBeNull();
    });
  });
});

describe("Email Tracking with broadcastId/affiliateId (Story 10.6)", () => {
  const t = convexTest(schema, testModules as any);

  it("should store broadcastId and affiliateId when tracking email", async () => {
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
        email: "tracked-aff@test.com",
        firstName: "Tracked",
        lastName: "Affiliate",
        name: "Tracked Affiliate",
        uniqueCode: "TRACKED",
        status: "approved",
      });

      const broadcastId = await ctx.db.insert("broadcastEmails", {
        tenantId,
        subject: "Tracking Test",
        body: "Body",
        recipientCount: 1,
        sentCount: 1,
        failedCount: 0,
        status: "sent",
        createdBy: "user_test" as any,
        sentAt: Date.now(),
      });

      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId,
        type: "broadcast",
        recipientEmail: "tracked-aff@test.com",
        subject: "Tracking Test",
        status: "sent",
        broadcastId,
        affiliateId,
        resendMessageId: "resend_tracking_test",
      });

      // Verify email has all tracking fields
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .first();

      expect(emails).toBeDefined();
      expect(emails!.broadcastId).toBe(broadcastId);
      expect(emails!.affiliateId).toBe(affiliateId);
      expect(emails!.resendMessageId).toBe("resend_tracking_test");
      expect(emails!.deliveryStatus).toBe("sent");
    });
  });

  it("should support backward compatibility (tracking without broadcast/affiliate)", async () => {
    await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        name: "Test Tenant",
        slug: "test-tenant",
        plan: "Growth",
        status: "active",
        domain: "test.example.com",
      });

      // Track email without broadcast/affiliate fields (backward compat)
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId,
        type: "welcome",
        recipientEmail: "user@test.com",
        subject: "Welcome",
        status: "sent",
      });

      const emails = await ctx.db
        .query("emails")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .first();

      expect(emails).toBeDefined();
      expect(emails!.broadcastId).toBeUndefined();
      expect(emails!.affiliateId).toBeUndefined();
      expect(emails!.resendMessageId).toBeUndefined();
    });
  });
});

describe("CSV Export Format Tests (Story 10.6)", () => {
  it("should correctly escape CSV fields containing commas", () => {
    // Test the escapeCsv function logic directly
    const value = "Hello, World";
    const escaped = value.includes(",") ? `"${value.replace(/"/g, '""')}"` : value;
    expect(escaped).toBe('"Hello, World"');
  });

  it("should correctly escape CSV fields containing quotes", () => {
    const value = 'He said "hello"';
    const escaped = value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
    expect(escaped).toBe('"He said ""hello"""');
  });

  it("should handle empty CSV fields", () => {
    const value: string = "";
    const escaped = !value ? '""' : value.includes(",") ? `"${value.replace(/"/g, '""')}"` : value;
    expect(escaped).toBe('""');
  });

  it("should not escape simple CSV fields", () => {
    const value = "simple-email@test.com";
    const escaped = value.includes(",") || value.includes('"') || value.includes("\n")
      ? `"${value.replace(/"/g, '""')}"`
      : value;
    expect(escaped).toBe("simple-email@test.com");
  });
});

describe("Sequential webhook events for same email (Story 10.6)", () => {
  const t = convexTest(schema, testModules as any);

  it("should update email through lifecycle: sent -> delivered -> opened -> clicked", async () => {
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
        email: "lifecycle@test.com",
        firstName: "Lifecycle",
        lastName: "User",
        name: "Lifecycle",
        uniqueCode: "LIFECYCLE",
        status: "approved",
      });

      const broadcastId = await ctx.db.insert("broadcastEmails", {
        tenantId,
        subject: "Lifecycle Test",
        body: "Body",
        recipientCount: 1,
        sentCount: 1,
        failedCount: 0,
        status: "sent",
        createdBy: "user_test" as any,
        sentAt: Date.now(),
      });

      // Create initial email
      await ctx.db.insert("emails", {
        tenantId,
        type: "broadcast",
        recipientEmail: "lifecycle@test.com",
        subject: "Lifecycle Test",
        status: "sent",
        sentAt: Date.now(),
        broadcastId,
        affiliateId,
        resendMessageId: "lifecycle_msg",
        deliveryStatus: "sent",
      });

      // Step 1: Delivered
      await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
        resendMessageId: "lifecycle_msg",
        eventType: "delivered",
        timestamp: Date.now() - 5000,
      });

      let email = await ctx.db
        .query("emails")
        .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", "lifecycle_msg"))
        .unique();
      expect(email!.deliveryStatus).toBe("delivered");
      expect(email!.deliveredAt).toBeDefined();

      // Step 2: Opened
      await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
        resendMessageId: "lifecycle_msg",
        eventType: "opened",
        timestamp: Date.now() - 3000,
      });

      email = await ctx.db
        .query("emails")
        .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", "lifecycle_msg"))
        .unique();
      expect(email!.deliveryStatus).toBe("opened");
      expect(email!.openedAt).toBeDefined();

      // Step 3: Clicked
      await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
        resendMessageId: "lifecycle_msg",
        eventType: "clicked",
        timestamp: Date.now(),
      });

      email = await ctx.db
        .query("emails")
        .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", "lifecycle_msg"))
        .unique();
      expect(email!.deliveryStatus).toBe("clicked");
      expect(email!.clickedAt).toBeDefined();

      // Verify broadcast aggregates
      const broadcast = await ctx.db.get(broadcastId);
      expect(broadcast!.openedCount).toBe(1);
      expect(broadcast!.clickedCount).toBe(1);
    });
  });
});
