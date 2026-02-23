/**
 * API error codes matching backend ErrorCode enum.
 *
 * Keep in sync with: apps/api/src/common/enums/error-code.enum.ts
 */
export const ErrorCode = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Not found errors (404)
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  REPLY_NOT_FOUND: 'REPLY_NOT_FOUND',

  // Conflict errors (409)
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS: 'USERNAME_ALREADY_EXISTS',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
  REPORT_ALREADY_EXISTS: 'REPORT_ALREADY_EXISTS',

  // Business rule violations (400)
  REPLY_MAX_DEPTH_EXCEEDED: 'REPLY_MAX_DEPTH_EXCEEDED',

  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
