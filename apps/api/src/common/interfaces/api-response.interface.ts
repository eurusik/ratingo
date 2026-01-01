import { type ErrorCode } from '../enums/error-code.enum';

/**
 * Standard API error details.
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Standard API success response.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard API error response.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Union type for all API responses.
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
