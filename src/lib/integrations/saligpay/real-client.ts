/**
 * SaligPay Integration Layer - Real Client Stub
 * 
 * Real implementation stub of SaligPayClient for production mode.
 * All methods throw "Not implemented" errors as actual implementation
 * will be done in Epic 14.
 * 
 * This stub prevents accidental mock usage in production by throwing
 * clear errors when methods are called.
 * 
 * @see Epic 14: SaligPay Real Integration
 */

import type { 
  SaligPayClient, 
  OAuthCredentials, 
  SaligPayWebhookEvent,
  SubscriptionData,
  PaymentData
} from './types';
import { SaligPayNotImplementedError, SaligPayValidationError } from './errors';

/**
 * Real SaligPay Client Stub
 * 
 * This class implements the SaligPayClient interface but all methods
 * throw errors indicating they need to be implemented in Epic 14.
 * 
 * This ensures type safety while preventing accidental use in production
 * before the real integration is complete.
 */
export class RealSaligPayClient implements SaligPayClient {
  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async initiateOAuth(_tenantId: string): Promise<string> {
    throw new SaligPayNotImplementedError('initiateOAuth');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async handleOAuthCallback(_code: string, _tenantId: string): Promise<OAuthCredentials> {
    throw new SaligPayNotImplementedError('handleOAuthCallback');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async refreshCredentials(_refreshToken: string): Promise<OAuthCredentials> {
    throw new SaligPayNotImplementedError('refreshCredentials');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async getCredentials(_tenantId: string): Promise<OAuthCredentials | null> {
    throw new SaligPayNotImplementedError('getCredentials');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async updateCredentials(_tenantId: string, _credentials: OAuthCredentials): Promise<void> {
    throw new SaligPayNotImplementedError('updateCredentials');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async deleteCredentials(_tenantId: string): Promise<void> {
    throw new SaligPayNotImplementedError('deleteCredentials');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    throw new SaligPayNotImplementedError('verifyWebhookSignature');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  parseWebhookEvent(_payload: string): SaligPayWebhookEvent {
    throw new SaligPayNotImplementedError('parseWebhookEvent');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async getSubscription(_subscriptionId: string): Promise<SubscriptionData> {
    throw new SaligPayNotImplementedError('getSubscription');
  }

  /**
   * @throws SaligPayNotImplementedError - Not implemented until Epic 14
   */
  async getPayment(_paymentId: string): Promise<PaymentData> {
    throw new SaligPayNotImplementedError('getPayment');
  }
}

/**
 * Utility function to check if the real client is properly configured
 * This can be called to verify that credentials are available before
 * attempting to use the real client.
 * 
 * @throws SaligPayNotImplementedError - Not implemented until Epic 14
 */
export async function isRealClientConfigured(): Promise<boolean> {
  throw new SaligPayNotImplementedError('isRealClientConfigured');
}

/**
 * Get the SaligPay API base URL from environment
 * 
 * This is a stub for Epic 14. In the future, this will:
 * 1. Check SALIGPAY_API_URL environment variable
 * 2. Validate the URL format
 * 3. Return the configured API URL
 * 
 * @throws SaligPayNotImplementedError - Not implemented until Epic 14
 * @throws SaligPayValidationError - If environment variable is not set (future behavior)
 * 
 * @see Epic 14: SaligPay Real Integration
 */
export function getSaligPayApiUrl(): string {
  // Stub implementation - always throws for Epic 14
  throw new SaligPayNotImplementedError('getSaligPayApiUrl');
}
