/**
 * SaligPay Integration Layer - Custom Error Types
 * 
 * Provides specific error classes for different failure scenarios,
 * enabling consumers to handle errors programmatically.
 */

/**
 * Base error class for all SaligPay integration errors
 */
export class SaligPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaligPayError';
  }
}

/**
 * Error thrown when OAuth authentication fails
 */
export class SaligPayAuthError extends SaligPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SaligPayAuthError';
  }
}

/**
 * Error thrown when input validation fails
 */
export class SaligPayValidationError extends SaligPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SaligPayValidationError';
  }
}

/**
 * Error thrown when a method is not yet implemented (Epic 14 placeholder)
 */
export class SaligPayNotImplementedError extends SaligPayError {
  constructor(feature: string = 'This feature') {
    super(`${feature} is not implemented yet. See Epic 14: SaligPay Real Integration`);
    this.name = 'SaligPayNotImplementedError';
  }
}

/**
 * Error thrown when credential operations fail
 */
export class SaligPayCredentialError extends SaligPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SaligPayCredentialError';
  }
}

/**
 * Error thrown when webhook processing fails
 */
export class SaligPayWebhookError extends SaligPayError {
  constructor(message: string) {
    super(message);
    this.name = 'SaligPayWebhookError';
  }
}

/**
 * Error thrown when API calls fail
 */
export class SaligPayApiError extends SaligPayError {
  public statusCode?: number;
  
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'SaligPayApiError';
    this.statusCode = statusCode;
  }
}
