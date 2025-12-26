import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
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
   */
  constructor(
    message: string = 'Database error occurred',
    cause?: unknown,
    details?: Record<string, any>,
  ) {
    super(ErrorCode.DATABASE_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR, details);
    this.cause = cause;

    // Set the cause on the Error prototype for standard error chaining
    if (cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}
