/**
 * SaligPay Integration Layer - Mock Client
 * 
 * Mock implementation of SaligPayClient for development and testing.
 * Provides in-memory credential storage, simulated OAuth flow, and deterministic
 * webhook event generation.
 */

import type { 
  SaligPayClient, 
  OAuthCredentials, 
  SaligPayWebhookEvent,
  SaligPayWebhookEventType,
  SubscriptionData,
  PaymentData,
  MockClientOptions
} from './types';
import { 
  SaligPayAuthError, 
  SaligPayValidationError,
  SaligPayWebhookError 
} from './errors';

/**
 * Mock SaligPay Client
 * 
 * Implements SaligPayClient interface for development/testing purposes.
 * Features:
 * - In-memory credential storage (Map-based)
 * - Simulated OAuth flow with configurable tokens
 * - Deterministic webhook event generation for testing
 * - Configurable response delays (default: 200ms)
 * - Console logging for debugging mock interactions
 */
export class MockSaligPayClient implements SaligPayClient {
  private credentials: Map<string, OAuthCredentials> = new Map();
  private options: Required<MockClientOptions>;
  
  /**
   * Create a new MockSaligPayClient instance
   * @param options - Optional configuration options
   */
  constructor(options?: MockClientOptions) {
    this.options = {
      responseDelay: options?.responseDelay ?? 200,
      enableLogging: options?.enableLogging ?? true,
    };
  }
  
  /**
   * Simulate network delay
   */
  private async simulateDelay(): Promise<void> {
    // Add some variance to the delay (±50ms)
    const variance = Math.random() * 100 - 50;
    const delay = Math.max(50, this.options.responseDelay + variance);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Log a message if logging is enabled
   */
  private log(message: string, data?: unknown): void {
    if (this.options.enableLogging) {
      console.log(`[MockSaligPay] ${message}`, data ?? '');
    }
  }
  
  // ==========================================
  // OAuth Methods
  // ==========================================
  
  /**
   * Initiate OAuth flow with mock SaligPay
   * Returns a mock OAuth authorization URL
   */
  async initiateOAuth(tenantId: string): Promise<string> {
    await this.simulateDelay();
    this.log('initiateOAuth called', { tenantId });
    
    // Generate mock state parameter
    const mockState = `mock-state-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    return `https://mock-saligpay.example.com/oauth/authorize?` +
      `client_id=mock-client-id&` +
      `redirect_uri=https://app.saligpay.example.com/oauth/callback&` +
      `response_type=code&` +
      `scope=read write&` +
      `state=${mockState}&` +
      `tenant=${tenantId}`;
  }
  
  /**
   * Handle OAuth callback and exchange authorization code for credentials
   */
  async handleOAuthCallback(code: string, tenantId: string): Promise<OAuthCredentials> {
    await this.simulateDelay();
    this.log('handleOAuthCallback called', { code: '***', tenantId });
    
    // Validate mock code (accept any non-empty string)
    if (!code || code.length < 1) {
      throw new SaligPayAuthError('Invalid authorization code');
    }
    
    // Generate mock credentials
    const credentials: OAuthCredentials = {
      accessToken: `mock-access-token-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      refreshToken: `mock-refresh-token-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
    };
    
    // Store credentials
    this.credentials.set(tenantId, credentials);
    
    this.log('OAuth credentials generated', { tenantId, expiresAt: credentials.expiresAt });
    
    return credentials;
  }
  
  /**
   * Refresh expired OAuth credentials
   */
  async refreshCredentials(refreshToken: string): Promise<OAuthCredentials> {
    await this.simulateDelay();
    this.log('refreshCredentials called', { refreshToken: '***' });
    
    // Validate refresh token format (our mock tokens start with "mock-refresh-token-")
    if (!refreshToken.startsWith('mock-refresh-token-')) {
      throw new SaligPayAuthError('Invalid refresh token');
    }
    
    // Generate new mock credentials
    const credentials: OAuthCredentials = {
      accessToken: `mock-access-token-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      refreshToken: `mock-refresh-token-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      expiresAt: Date.now() + 3600 * 1000,
    };
    
    this.log('Credentials refreshed');
    
    return credentials;
  }
  
  // ==========================================
  // Credential Management
  // ==========================================
  
  /**
   * Retrieve stored OAuth credentials for a tenant
   */
  async getCredentials(tenantId: string): Promise<OAuthCredentials | null> {
    await this.simulateDelay();
    this.log('getCredentials called', { tenantId });
    
    return this.credentials.get(tenantId) ?? null;
  }
  
  /**
   * Update stored OAuth credentials for a tenant
   */
  async updateCredentials(tenantId: string, credentials: OAuthCredentials): Promise<void> {
    await this.simulateDelay();
    this.log('updateCredentials called', { tenantId });
    
    this.credentials.set(tenantId, credentials);
  }
  
  /**
   * Delete stored OAuth credentials for a tenant
   */
  async deleteCredentials(tenantId: string): Promise<void> {
    await this.simulateDelay();
    this.log('deleteCredentials called', { tenantId });
    
    this.credentials.delete(tenantId);
  }
  
  // ==========================================
  // Webhook Methods
  // ==========================================
  
  /**
   * Verify the signature of a webhook payload
   * 
   * For mock mode, validates signature format but accepts any valid-format signature.
   * This simulates real validation without requiring actual cryptographic verification.
   * 
   * Expected signature format: "t=<timestamp>,v1=<signature>"
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    this.log('verifyWebhookSignature called', { 
      hasPayload: !!payload, 
      hasSignature: !!signature 
    });
    
    // Validate payload exists
    if (!payload || payload.length === 0) {
      throw new SaligPayWebhookError('Webhook payload cannot be empty');
    }
    
    // Validate signature format (should be: t=<timestamp>,v1=<signature>)
    if (!signature || signature.length === 0) {
      return false;
    }
    
    // Check for valid signature format
    const signaturePattern = /^t=\d+,v1=[a-f0-9]{64}$/;
    if (!signaturePattern.test(signature)) {
      this.log('Invalid signature format', { signature: signature.substring(0, 20) + '...' });
      return false;
    }
    
    // In mock mode, accept any valid-format signature
    // In real mode, this would verify the cryptographic signature
    this.log('Signature format validated successfully');
    return true;
  }
  
  /**
   * Parse a webhook payload into a structured event
   */
  parseWebhookEvent(payload: string): SaligPayWebhookEvent {
    this.log('parseWebhookEvent called', { payloadLength: payload.length });
    
    try {
      const parsed = JSON.parse(payload);
      
      return {
        id: parsed.id ?? `mock-event-${Date.now()}`,
        type: parsed.type ?? 'payment.updated',
        data: parsed.data ?? {},
        createdAt: parsed.created_at ?? Date.now(),
      };
    } catch {
      // Return a default mock event if parsing fails
      return {
        id: `mock-event-${Date.now()}`,
        type: 'payment.updated',
        data: {},
        createdAt: Date.now(),
      };
    }
  }
  
  // ==========================================
  // API Methods (Epic 14 stubs - returns mock data)
  // ==========================================
  
  /**
   * Get mock subscription details
   */
  async getSubscription(subscriptionId: string): Promise<SubscriptionData> {
    await this.simulateDelay();
    this.log('getSubscription called', { subscriptionId });
    
    // Return mock subscription data
    return {
      id: subscriptionId,
      status: 'active',
      planId: 'mock-plan-basic',
      customerId: `mock-customer-${subscriptionId}`,
      currentPeriodStart: Date.now() - 15 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: Date.now() + 15 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
    };
  }
  
  /**
   * Get mock payment details
   */
  async getPayment(paymentId: string): Promise<PaymentData> {
    await this.simulateDelay();
    this.log('getPayment called', { paymentId });
    
    // Return mock payment data
    return {
      id: paymentId,
      status: 'succeeded',
      amount: 2999, // $29.99
      currency: 'USD',
      customerId: `mock-customer-${paymentId}`,
      subscriptionId: `mock-sub-${paymentId}`,
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      paidAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    };
  }
  
  // ==========================================
  // Utility Methods
  // ==========================================
  
  /**
   * Generate a mock webhook event for testing
   */
  generateMockWebhookEvent(type: SaligPayWebhookEventType): SaligPayWebhookEvent {
    const eventId = `mock-webhook-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const mockData: Record<string, unknown> = {
      event_id: eventId,
    };
    
    switch (type) {
      case 'payment.updated':
        mockData.payment = {
          id: `mock-payment-${Date.now()}`,
          status: 'succeeded',
          amount: 2999,
        };
        break;
      case 'subscription.created':
      case 'subscription.updated':
        mockData.subscription = {
          id: `mock-subscription-${Date.now()}`,
          status: 'active',
          plan_id: 'mock-plan-basic',
        };
        break;
      case 'subscription.cancelled':
        mockData.subscription = {
          id: `mock-subscription-${Date.now()}`,
          status: 'cancelled',
        };
        break;
    }
    
    return {
      id: eventId,
      type,
      data: mockData,
      createdAt: Date.now(),
    };
  }
  
  /**
   * Generate a valid mock signature for testing
   * 
   * Format: "t=<timestamp>,v1=<64-char-hex>"
   */
  generateMockSignature(payload?: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    // Generate a mock 64-character hex signature
    const mockSignature = Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    return `t=${timestamp},v1=${mockSignature}`;
  }
  
  /**
   * Clear all stored credentials (useful for testing)
   */
  clearCredentials(): void {
    this.credentials.clear();
    this.log('All credentials cleared');
  }
  
  /**
   * Get the number of stored credentials (for testing)
   */
  getCredentialsCount(): number {
    return this.credentials.size;
  }
}
