/**
 * Error Response Builder
 *
 * Utility for building standardized error responses.
 */

import { type ErrorResponseDto } from '../dtos/error-response.dto';

interface ErrorWithCode {
  code: string;
  message: string;
}

/**
 * Builds standardized error response objects.
 */
export const ErrorResponseBuilder = {
  /**
   * Build error response from an error with code.
   */
  build(
    error: ErrorWithCode,
    statusCode: number,
    details?: Record<string, unknown>,
  ): ErrorResponseDto {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode,
        ...(details && { details }),
      },
    };
  },

  /**
   * Build error response with custom code (for errors without code property).
   */
  buildWithCode(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ): ErrorResponseDto {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        ...(details && { details }),
      },
    };
  },
};
