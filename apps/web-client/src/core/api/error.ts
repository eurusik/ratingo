/**
 * API error types and classes.
 *
 * Provides typed error handling for API responses.
 */

import { HTTPError } from 'ky';
import { ErrorCode } from './error-codes';

/** Structure of API error response from backend. */
export interface ApiErrorDetail {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Custom error class for API failures.
 *
 * @example
 * try {
 *   await apiGet('/path');
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     console.log(error.code, error.statusCode);
 *   }
 * }
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Creates ApiError from backend error response.
   *
   * @param error - Error detail from API response
   */
  static fromResponse(error: ApiErrorDetail): ApiError {
    return new ApiError(error.code, error.statusCode, error.message, error.details);
  }
}

/** Auth error messages from i18n dict. */
export interface AuthErrorMessages {
  invalidCredentials: string;
  emailAlreadyExists: string;
  usernameTaken: string;
  tooManyRequests: string;
  unknownError: string;
}

/**
 * Maps API errors to user-friendly i18n messages for auth forms.
 *
 * @param error - Caught error from API call
 * @param messages - Auth error messages from `dict.auth.errors`
 * @returns User-friendly error message
 */
export function mapAuthError(error: unknown, messages: AuthErrorMessages): string {
  if (error instanceof ApiError) {
    if (error.code === ErrorCode.UNAUTHORIZED) {
      return messages.invalidCredentials;
    }

    if (error.code === ErrorCode.EMAIL_ALREADY_EXISTS) {
      return messages.emailAlreadyExists;
    }

    if (error.code === ErrorCode.USERNAME_ALREADY_EXISTS) {
      return messages.usernameTaken;
    }

    if (error.code === ErrorCode.RATE_LIMITED) {
      return messages.tooManyRequests;
    }
  }

  return messages.unknownError;
}

/**
 * Extracts error code from API error or HTTPError.
 *
 * @param error - Error to parse
 * @returns Error code or null if not parseable
 *
 * @example
 * const code = await getApiErrorCode(error);
 * if (code === 'ALREADY_EXISTS') { ... }
 */
export async function getApiErrorCode(error: unknown): Promise<string | null> {
  if (error instanceof ApiError) {
    return error.code;
  }

  if (error instanceof HTTPError) {
    try {
      const body = await error.response.clone().json();
      return body?.error?.code ?? null;
    } catch {
      return null;
    }
  }

  return null;
}
