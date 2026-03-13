/**
 * SaligPay Integration Layer - Client Factory
 * 
 * Factory functions for creating and managing SaligPay client instances.
 * Implements singleton pattern for efficient client reuse.
 */

import type { SaligPayClient, MockClientOptions } from './types';
import { getIntegrationMode } from './config';
import { MockSaligPayClient } from './mock-client';
import { RealSaligPayClient } from './real-client';
import { SaligPayValidationError } from './errors';

/**
 * Singleton client instance
 */
let clientInstance: SaligPayClient | null = null;

/**
 * Singleton mock client instance (for when testing needs a fresh instance)
 */
let mockClientInstance: MockSaligPayClient | null = null;

/**
 * Options for creating the client
 */
export interface CreateClientOptions {
  /** Force creation of a new client instance (useful for testing) */
  forceNew?: boolean;
  /** Options specifically for mock client */
  mockOptions?: MockClientOptions;
}

/**
 * Validate mock client options
 * @param options - The options to validate
 * @throws SaligPayValidationError if options are invalid
 */
function validateMockOptions(options?: MockClientOptions): void {
  if (options === undefined) {
    return;
  }
  
  // Validate responseDelay
  if (options.responseDelay !== undefined) {
    if (typeof options.responseDelay !== 'number') {
      throw new SaligPayValidationError(
        `mockOptions.responseDelay must be a number, received: ${typeof options.responseDelay}`
      );
    }
    if (options.responseDelay < 0) {
      throw new SaligPayValidationError(
        `mockOptions.responseDelay cannot be negative, received: ${options.responseDelay}`
      );
    }
    if (options.responseDelay > 60000) {
      throw new SaligPayValidationError(
        `mockOptions.responseDelay cannot exceed 60000ms (1 minute), received: ${options.responseDelay}`
      );
    }
  }
  
  // Validate enableLogging
  if (options.enableLogging !== undefined && typeof options.enableLogging !== 'boolean') {
    throw new SaligPayValidationError(
      `mockOptions.enableLogging must be a boolean, received: ${typeof options.enableLogging}`
    );
  }
}

/**
 * Create a SaligPay client based on the current integration mode.
 * 
 * This is the factory function that returns the appropriate client
 * (mock or real) based on environment configuration.
 * 
 * @param options - Optional configuration options
 * @returns The appropriate SaligPayClient implementation
 * @throws SaligPayValidationError if options are invalid
 * 
 * @example
 * ```typescript
 * import { createSaligPayClient } from '@/lib/integrations/saligpay';
 * 
 * const client = createSaligPayClient();
 * // In development: returns MockSaligPayClient
 * // In production: returns RealSaligPayClient
 * ```
 */
export function createSaligPayClient(options?: CreateClientOptions): SaligPayClient {
  // Validate options before use
  if (options?.mockOptions) {
    validateMockOptions(options.mockOptions);
  }
  
  const mode = getIntegrationMode();
  
  if (mode === 'real') {
    return new RealSaligPayClient();
  }
  
  // For mock mode, we can optionally use a singleton for efficiency
  if (!options?.forceNew && mockClientInstance) {
    return mockClientInstance;
  }
  
  const mockClient = new MockSaligPayClient(options?.mockOptions);
  
  // Only store as singleton if not forcing new instance
  if (!options?.forceNew) {
    mockClientInstance = mockClient;
  }
  
  return mockClient;
}

/**
 * Get the singleton SaligPay client instance.
 * 
 * Creates the client on first call based on current integration mode,
 * then returns the same instance for all subsequent calls.
 * 
 * This is the recommended way to get a SaligPay client in most use cases.
 * 
 * @returns The singleton SaligPayClient instance
 * 
 * @example
 * ```typescript
 * import { getSaligPayClient } from '@/lib/integrations/saligpay';
 * 
 * const client = getSaligPayClient();
 * const credentials = await client.getCredentials(tenantId);
 * ```
 */
export function getSaligPayClient(): SaligPayClient {
  if (!clientInstance) {
    clientInstance = createSaligPayClient();
  }
  return clientInstance;
}

/**
 * Reset the client instance.
 * 
 * Useful for testing to ensure a fresh client is created on next call.
 * This clears both the main singleton and the mock client singleton.
 */
export function resetSaligPayClient(): void {
  clientInstance = null;
  mockClientInstance = null;
}

/**
 * Get the current integration mode and client type information.
 * Useful for debugging and logging purposes.
 */
export function getClientInfo(): {
  mode: 'mock' | 'real';
  clientType: string;
  isSingleton: boolean;
} {
  const mode = getIntegrationMode();
  
  return {
    mode,
    clientType: mode === 'mock' ? 'MockSaligPayClient' : 'RealSaligPayClient',
    isSingleton: clientInstance !== null,
  };
}

/**
 * Factory for creating clients with specific options.
 * Use this when you need a fresh client instance with custom options.
 * 
 * @param mockOptions - Options to pass to MockSaligPayClient
 * @returns A new SaligPayClient instance
 * @throws SaligPayValidationError if options are invalid
 * 
 * @example
 * ```typescript
 * import { createClientWithOptions } from '@/lib/integrations/saligpay';
 * 
 * // Create a mock client with custom delay
 * const client = createClientWithOptions({
 *   responseDelay: 500,
 *   enableLogging: false,
 * });
 * ```
 */
export function createClientWithOptions(mockOptions?: MockClientOptions): SaligPayClient {
  return createSaligPayClient({ forceNew: true, mockOptions });
}
