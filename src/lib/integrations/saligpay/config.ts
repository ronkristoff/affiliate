/**
 * SaligPay Integration Layer - Configuration
 * 
 * Functions for determining and managing the integration mode (mock vs real).
 * Uses a dual-environment approach supporting both Next.js and Convex environments.
 */

import type { IntegrationMode } from './types';
import { SaligPayValidationError } from './errors';

/**
 * Get the current integration mode from Next.js environment.
 * 
 * Priority order:
 * 1. `INTEGRATION_MODE` environment variable (explicit override)
 * 2. `NODE_ENV === 'production'` → real mode
 * 3. Default → mock mode
 * 
 * @returns The current integration mode ('mock' or 'real')
 */
export function getIntegrationMode(): IntegrationMode {
  // Check explicit override first
  const explicitMode = process.env.INTEGRATION_MODE;
  if (explicitMode === 'mock' || explicitMode === 'real') {
    return explicitMode;
  }
  
  // Check NODE_ENV for production
  if (process.env.NODE_ENV === 'production') {
    return 'real';
  }
  
  // Default to mock for development/testing
  return 'mock';
}

/**
 * Get the integration mode from Convex environment variables.
 * 
 * This function is designed to be called from Convex actions/mutations
 * where process.env is not available. Pass the INTEGRATION_MODE value
 * from ctx.secrets or environment configuration.
 * 
 * @param convexEnvMode - The INTEGRATION_MODE value from Convex environment
 * @returns The validated integration mode ('mock' or 'real')
 * 
 * @example
 * ```typescript
 * // In a Convex action
 * export const myAction = action({
 *   args: {},
 *   returns: v.null(),
 *   handler: async (ctx, args) => {
 *     // Get mode from Convex environment
 *     const mode = getConvexIntegrationMode(process.env.INTEGRATION_MODE);
 *     // ... use mode
 *   },
 * });
 * ```
 */
export function getConvexIntegrationMode(convexEnvMode: string | undefined): IntegrationMode {
  if (!convexEnvMode) {
    // Default to mock if not set in Convex environment
    return 'mock';
  }
  
  if (convexEnvMode === 'mock' || convexEnvMode === 'real') {
    return convexEnvMode;
  }
  
  console.warn(
    `Invalid INTEGRATION_MODE value in Convex environment: "${convexEnvMode}". ` +
    `Expected "mock" or "real". Using default: "mock"`
  );
  
  return 'mock';
}

/**
 * Check if the current integration mode is mock
 * @returns True if in mock mode, false otherwise
 */
export function isMockMode(): boolean {
  return getIntegrationMode() === 'mock';
}

/**
 * Check if the current integration mode is real
 * @returns True if in real mode, false otherwise
 */
export function isRealMode(): boolean {
  return getIntegrationMode() === 'real';
}

/**
 * Check if the current integration mode is mock (for Convex)
 * @param convexEnvMode - The INTEGRATION_MODE value from Convex environment
 * @returns True if in mock mode, false otherwise
 */
export function isConvexMockMode(convexEnvMode: string | undefined): boolean {
  return getConvexIntegrationMode(convexEnvMode) === 'mock';
}

/**
 * Check if the current integration mode is real (for Convex)
 * @param convexEnvMode - The INTEGRATION_MODE value from Convex environment
 * @returns True if in real mode, false otherwise
 */
export function isConvexRealMode(convexEnvMode: string | undefined): boolean {
  return getConvexIntegrationMode(convexEnvMode) === 'real';
}

/**
 * Validate if a given mode string is valid
 * @param mode - The mode string to validate
 * @returns True if valid ('mock' or 'real'), false otherwise
 */
export function isValidMode(mode: string): mode is IntegrationMode {
  return mode === 'mock' || mode === 'real';
}

/**
 * Get the integration mode with validation
 * @param modeString - The mode string from environment
 * @returns The validated integration mode or default 'mock'
 * @throws SaligPayValidationError if mode is invalid and throwOnInvalid is true
 */
export function validateMode(
  modeString: string | undefined, 
  options?: { throwOnInvalid?: boolean }
): IntegrationMode {
  if (!modeString) {
    return getIntegrationMode();
  }
  
  if (isValidMode(modeString)) {
    return modeString;
  }
  
  const errorMessage = 
    `Invalid INTEGRATION_MODE value: "${modeString}". ` +
    `Expected "mock" or "real". Using default: "mock"`;
  
  if (options?.throwOnInvalid) {
    throw new SaligPayValidationError(errorMessage);
  }
  
  console.warn(errorMessage);
  
  return 'mock';
}
