import { HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../enums/error-code.enum';
import { sanitizeErrorStack } from '../utils/pg-error.utils';

import { AppException } from './app.exception';

/**
 * Exception for database errors (500).
 *
 * Wraps database errors with the original error preserved in the `cause` property.
 * This allows for proper error chain debugging while presenting a clean error to clients.
 *
 * @example
 * try {
 *   await db.query(...);
 * } catch (error) {
 *   throw new DatabaseException('Failed to fetch user', error);
 * }
 */
export class DatabaseException extends AppException {
  /**
   * The original error that caused this exception.
   * Preserved for debugging and logging purposes.
   */
  public readonly cause: unknown;

  /**
   * Creates a new DatabaseException.
   *
   * @param message - Human-readable error message
   * @param cause - The original error that caused this exception (optional)
   * @param details - Additional details for debugging (optional)
   * @param options - Override code/status for client-caused constraint violations (subclasses)
   */
  constructor(
    message: string = 'Database error occurred',
    cause?: unknown,
    details?: Record<string, unknown>,
    options?: { code?: ErrorCode; status?: HttpStatus },
  ) {
    super(
      options?.code ?? ErrorCode.DATABASE_ERROR,
      message,
      options?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
    this.cause = cause;

    // Set the cause on the Error prototype for standard error chaining
    if (cause instanceof Error) {
      // Sanitized: Drizzle query errors embed bound params in their message/stack header
      this.stack = `${this.stack}\nCaused by: ${sanitizeErrorStack(cause)}`;
    }
  }
}

/**
 * Unique constraint violation (23505) surfaced as 409 Conflict.
 * Extends DatabaseException so `instanceof DatabaseException` and `.cause` checks keep working.
 */
export class DatabaseConflictException extends DatabaseException {
  constructor(cause?: unknown, details?: Record<string, unknown>) {
    super('Resource already exists', cause, details, {
      code: ErrorCode.RESOURCE_CONFLICT,
      status: HttpStatus.CONFLICT,
    });
  }
}

/**
 * Invalid input rejected by the database (22P02 invalid text representation,
 * 23503 foreign key violation) surfaced as 400 Bad Request.
 */
export class DatabaseInvalidInputException extends DatabaseException {
  constructor(cause?: unknown, details?: Record<string, unknown>) {
    super('Invalid input', cause, details, {
      code: ErrorCode.INVALID_INPUT,
      status: HttpStatus.BAD_REQUEST,
    });
  }
}
