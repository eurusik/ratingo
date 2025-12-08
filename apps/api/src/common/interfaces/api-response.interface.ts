import { ErrorCode } from '../enums/error-code.enum';

/**
 * Standard API error details.
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

/**
 * Standard API success response.
 */
export interface ApiSuccessResponse<T = any> {
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
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
