/**
 * SaligPay Integration Layer - Type Definitions
 * 
 * Shared TypeScript interfaces for both mock and real SaligPay implementations.
 * This ensures type safety across all integration variants.
 */

/**
 * Integration mode for the SaligPay client
 */
export type IntegrationMode = 'mock' | 'real';

/**
 * OAuth credentials received from SaligPay after successful authentication
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Webhook event types from SaligPay
 */
export type SaligPayWebhookEventType = 
  | 'payment.updated' 
  | 'subscription.created' 
  | 'subscription.updated' 
  | 'subscription.cancelled';

/**
 * Parsed webhook event from SaligPay
 */
export interface SaligPayWebhookEvent {
  id: string;
  type: SaligPayWebhookEventType;
  data: Record<string, unknown>;
  createdAt: number;
}

/**
 * Subscription data from SaligPay API
 */
export interface SubscriptionData {
  id: string;
  status: string;
  planId?: string;
  customerId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  [key: string]: unknown;
}

/**
 * Payment data from SaligPay API
 */
export interface PaymentData {
  id: string;
  status: string;
  amount: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  createdAt?: number;
  paidAt?: number;
  [key: string]: unknown;
}

/**
 * OAuth configuration for initiating the OAuth flow
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
}

/**
 * Options for configuring the mock client
 */
export interface MockClientOptions {
  /** Delay in milliseconds for simulated network latency (default: 200) */
  responseDelay?: number;
  /** Whether to log mock interactions to console (default: true) */
  enableLogging?: boolean;
}

/**
 * SaligPay Client Interface
 * 
 * This interface must be implemented by both MockSaligPayClient and RealSaligPayClient.
 * It provides all methods required for OAuth flow, credential management, webhook handling,
 * and API interactions with SaligPay.
 */
export interface SaligPayClient {
  // ==========================================
  // OAuth Methods
  // ==========================================

  /**
   * Initiate OAuth flow with SaligPay
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to the OAuth authorization URL
   */
  initiateOAuth(tenantId: string): Promise<string>;

  /**
   * Handle OAuth callback and exchange authorization code for credentials
   * @param code - Authorization code from OAuth callback
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to OAuth credentials
   */
  handleOAuthCallback(code: string, tenantId: string): Promise<OAuthCredentials>;

  /**
   * Refresh expired OAuth credentials
   * @param refreshToken - The refresh token
   * @returns Promise resolving to new OAuth credentials
   */
  refreshCredentials(refreshToken: string): Promise<OAuthCredentials>;

  // ==========================================
  // Credential Management
  // ==========================================

  /**
   * Retrieve stored OAuth credentials for a tenant
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to credentials or null if not found
   */
  getCredentials(tenantId: string): Promise<OAuthCredentials | null>;

  /**
   * Update stored OAuth credentials for a tenant
   * @param tenantId - The tenant identifier
   * @param credentials - The OAuth credentials to store
   */
  updateCredentials(tenantId: string, credentials: OAuthCredentials): Promise<void>;

  /**
   * Delete stored OAuth credentials for a tenant
   * @param tenantId - The tenant identifier
   */
  deleteCredentials(tenantId: string): Promise<void>;

  // ==========================================
  // Webhook Methods
  // ==========================================

  /**
   * Verify the signature of a webhook payload
   * @param payload - Raw webhook payload string
   * @param signature - Signature header from SaligPay
   * @returns True if signature is valid, false otherwise
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Parse a webhook payload into a structured event
   * @param payload - Raw webhook payload string
   * @returns Parsed webhook event
   */
  parseWebhookEvent(payload: string): SaligPayWebhookEvent;

  // ==========================================
  // API Methods (for Epic 14)
  // ==========================================

  /**
   * Get subscription details from SaligPay
   * @param subscriptionId - The subscription identifier
   * @returns Promise resolving to subscription data
   */
  getSubscription(subscriptionId: string): Promise<SubscriptionData>;

  /**
   * Get payment details from SaligPay
   * @param paymentId - The payment identifier
   * @returns Promise resolving to payment data
   */
  getPayment(paymentId: string): Promise<PaymentData>;
}