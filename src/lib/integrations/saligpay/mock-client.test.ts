import { describe, it, expect, beforeEach } from "vitest";
import { MockSaligPayClient } from "./mock-client";

describe("MockSaligPayClient", () => {
  let client: MockSaligPayClient;

  beforeEach(() => {
    client = new MockSaligPayClient({
      responseDelay: 0,
      enableLogging: false,
    });
  });

  describe("OAuth Methods", () => {
    describe("initiateOAuth", () => {
      it("should return a mock OAuth URL", async () => {
        const url = await client.initiateOAuth("tenant-123");
        
        expect(url).toContain("https://mock-saligpay.example.com/oauth/authorize");
        expect(url).toContain("client_id=mock-client-id");
        expect(url).toContain("tenant=tenant-123");
        expect(url).toContain("state=");
      });

      it("should include different state for each call", async () => {
        const url1 = await client.initiateOAuth("tenant-123");
        const url2 = await client.initiateOAuth("tenant-123");
        
        // Extract state parameters
        const state1 = url1.match(/state=([^&]+)/)?.[1];
        const state2 = url2.match(/state=([^&]+)/)?.[1];
        
        expect(state1).not.toBe(state2);
      });
    });

    describe("handleOAuthCallback", () => {
      it("should return credentials on valid callback", async () => {
        const credentials = await client.handleOAuthCallback("auth-code-123", "tenant-123");
        
        expect(credentials.accessToken).toContain("mock-access-token-");
        expect(credentials.refreshToken).toContain("mock-refresh-token-");
        expect(credentials.expiresAt).toBeGreaterThan(Date.now());
      });

      it("should throw on empty code", async () => {
        await expect(
          client.handleOAuthCallback("", "tenant-123")
        ).rejects.toThrow("Invalid authorization code");
      });

      it("should store credentials for tenant", async () => {
        const credentials = await client.handleOAuthCallback("auth-code", "tenant-123");
        
        const stored = await client.getCredentials("tenant-123");
        expect(stored).toEqual(credentials);
      });
    });

    describe("refreshCredentials", () => {
      it("should refresh credentials with valid token", async () => {
        // First get credentials
        await client.handleOAuthCallback("auth-code", "tenant-123");
        const stored = await client.getCredentials("tenant-123");
        
        // Refresh
        const refreshed = await client.refreshCredentials(stored!.refreshToken);
        
        expect(refreshed.accessToken).not.toBe(stored!.accessToken);
        expect(refreshed.refreshToken).not.toBe(stored!.refreshToken);
        expect(refreshed.expiresAt).toBeGreaterThan(Date.now());
      });

      it("should throw on invalid refresh token", async () => {
        await expect(
          client.refreshCredentials("invalid-token")
        ).rejects.toThrow("Invalid refresh token");
      });
    });
  });

  describe("Credential Management", () => {
    describe("getCredentials", () => {
      it("should return null for tenant without credentials", async () => {
        const result = await client.getCredentials("new-tenant");
        expect(result).toBeNull();
      });

      it("should return stored credentials", async () => {
        await client.handleOAuthCallback("code", "tenant-123");
        const result = await client.getCredentials("tenant-123");
        
        expect(result).not.toBeNull();
        expect(result?.accessToken).toContain("mock-access-token-");
      });
    });

    describe("updateCredentials", () => {
      it("should update credentials for tenant", async () => {
        await client.updateCredentials("tenant-123", {
          accessToken: "new-access",
          refreshToken: "new-refresh",
          expiresAt: Date.now() + 3600000,
        });
        
        const result = await client.getCredentials("tenant-123");
        expect(result?.accessToken).toBe("new-access");
      });
    });

    describe("deleteCredentials", () => {
      it("should delete credentials for tenant", async () => {
        await client.handleOAuthCallback("code", "tenant-123");
        await client.deleteCredentials("tenant-123");
        
        const result = await client.getCredentials("tenant-123");
        expect(result).toBeNull();
      });
    });
  });

  describe("Webhook Methods", () => {
    describe("verifyWebhookSignature", () => {
      it("should validate correct signature format", () => {
        const payload = JSON.stringify({ event: "test" });
        const signature = client.generateMockSignature(payload);
        
        const result = client.verifyWebhookSignature(payload, signature);
        expect(result).toBe(true);
      });

      it("should reject empty payload", () => {
        expect(() => {
          client.verifyWebhookSignature("", "t=123,v1=abc");
        }).toThrow("Webhook payload cannot be empty");
      });

      it("should reject invalid signature format", () => {
        const payload = JSON.stringify({ event: "test" });
        
        expect(client.verifyWebhookSignature(payload, "")).toBe(false);
        expect(client.verifyWebhookSignature(payload, "invalid")).toBe(false);
      });
    });

    describe("parseWebhookEvent", () => {
      it("should parse valid JSON payload", () => {
        const payload = JSON.stringify({
          id: "event-123",
          type: "payment.updated",
          data: { amount: 100 },
          created_at: 1234567890,
        });
        
        const event = client.parseWebhookEvent(payload);
        
        expect(event.id).toBe("event-123");
        expect(event.type).toBe("payment.updated");
        expect(event.data.amount).toBe(100);
      });

      it("should handle invalid JSON gracefully", () => {
        const event = client.parseWebhookEvent("not-json");
        
        expect(event.type).toBe("payment.updated");
        expect(event.id).toContain("mock-event-");
      });
    });
  });

  describe("API Methods", () => {
    describe("getSubscription", () => {
      it("should return mock subscription data", async () => {
        const subscription = await client.getSubscription("sub-123");
        
        expect(subscription.id).toBe("sub-123");
        expect(subscription.status).toBe("active");
        expect(subscription.planId).toBe("mock-plan-basic");
      });
    });

    describe("getPayment", () => {
      it("should return mock payment data", async () => {
        const payment = await client.getPayment("pay-123");
        
        expect(payment.id).toBe("pay-123");
        expect(payment.status).toBe("succeeded");
        expect(payment.amount).toBe(2999);
        expect(payment.currency).toBe("USD");
      });
    });
  });

  describe("Utility Methods", () => {
    describe("generateMockWebhookEvent", () => {
      it("should generate valid mock events", () => {
        const event = client.generateMockWebhookEvent("payment.updated");
        
        expect(event.id).toContain("mock-webhook-");
        expect(event.type).toBe("payment.updated");
        expect(event.data).toBeDefined();
      });
    });

    describe("generateMockSignature", () => {
      it("should generate valid signature format", () => {
        const signature = client.generateMockSignature();
        
        expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      });
    });

    describe("clearCredentials", () => {
      it("should clear all stored credentials", async () => {
        await client.handleOAuthCallback("code1", "tenant-1");
        await client.handleOAuthCallback("code2", "tenant-2");
        
        expect(client.getCredentialsCount()).toBe(2);
        
        client.clearCredentials();
        
        expect(client.getCredentialsCount()).toBe(0);
      });
    });

    describe("getCredentialsCount", () => {
      it("should return 0 for new client", () => {
        expect(client.getCredentialsCount()).toBe(0);
      });

      it("should return correct count after adding credentials", async () => {
        await client.handleOAuthCallback("code", "tenant-1");
        await client.handleOAuthCallback("code", "tenant-2");
        
        expect(client.getCredentialsCount()).toBe(2);
      });
    });
  });
});
