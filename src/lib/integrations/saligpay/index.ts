/**
 * SaligPay Integration Layer
 * 
 * This module provides a configurable integration layer that switches between
 * mock and real SaligPay implementations based on environment configuration.
 * 
 * Usage:
 * ```typescript
 * import { getSaligPayClient, getIntegrationMode, isMockMode } from '@/lib/integrations/saligpay';
 * 
 * // Get the client instance (singleton)
 * const client = getSaligPayClient();
 * 
 * // Check current integration mode
 * const mode = getIntegrationMode();
 * const isMock = isMockMode();
 * ```
 */

// Re-export types
export type { 
  IntegrationMode, 
  OAuthCredentials, 
  SaligPayClient, 
  SaligPayWebhookEvent, 
  SubscriptionData, 
  PaymentData,
  MockClientOptions,
  OAuthConfig,
  SaligPayWebhookEventType
} from './types';

// Re-export error classes
export {
  SaligPayError,
  SaligPayAuthError,
  SaligPayValidationError,
  SaligPayNotImplementedError,
  SaligPayCredentialError,
  SaligPayWebhookError,
  SaligPayApiError,
} from './errors';

// Re-export config functions
export { 
  getIntegrationMode, 
  getConvexIntegrationMode,
  isMockMode, 
  isRealMode,
  isConvexMockMode,
  isConvexRealMode,
  isValidMode,
  validateMode 
} from './config';

// Re-export factory functions
export { 
  createSaligPayClient, 
  getSaligPayClient, 
  resetSaligPayClient,
  createClientWithOptions,
  getClientInfo
} from './factory';

// Re-export client classes
export { MockSaligPayClient } from './mock-client';
export { RealSaligPayClient } from './real-client';
