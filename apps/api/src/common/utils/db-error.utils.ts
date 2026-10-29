import { Logger } from '@nestjs/common';

import { PG_ERROR_CODE } from '../constants/database.constants';
import { AppException } from '../exceptions/app.exception';
import {
  DatabaseConflictException,
  DatabaseException,
  DatabaseInvalidInputException,
} from '../exceptions/database.exception';

import { extractPgError, sanitizeErrorStack, stripQueryParams } from './pg-error.utils';

/**
 * Extracts relevant details from a PostgreSQL error for logging.
 * Reads the underlying pg error (Drizzle wraps it in `.cause`; postgres.js uses
 * `constraint_name` / `table_name`).
 */
function extractPgErrorDetails(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) return {};

  const { code, detail, constraint, table } = extractPgError(error);

  const details: Record<string, unknown> = {};
  if (code) details.pgCode = code;
  if (detail) details.pgDetail = detail;
  if (constraint) details.constraint = constraint;
  if (table) details.table = table;

  return details;
}

/**
 * Builds a log-safe message. Drizzle's `DrizzleQueryError` message embeds the bound
 * parameters ("Failed query: ...\nparams: ...") which may contain user data/secrets,
 * so prefer the underlying pg message and strip any `params:` section.
 */
function safeErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const pgMessage = extractPgError(error).message;
    if (pgMessage && (error as { cause?: unknown }).cause) return stripQueryParams(pgMessage);
  }
  const msg = error instanceof Error ? error.message : String(error);
  return stripQueryParams(msg);
}

/**
 * Maps a PostgreSQL error to a client-appropriate exception.
 * - 23505 unique violation -> 409
 * - 22P02 invalid text representation / 23503 foreign key violation -> 400
 * - everything else -> 500 DatabaseException
 * All variants extend DatabaseException and keep the original error as `cause`.
 */
function toDatabaseException(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): DatabaseException {
  const code = typeof error === 'object' && error !== null ? extractPgError(error).code : undefined;

  switch (code) {
    case PG_ERROR_CODE.UNIQUE_VIOLATION:
      return new DatabaseConflictException(error, context);
    case PG_ERROR_CODE.INVALID_TEXT_REPRESENTATION:
    case PG_ERROR_CODE.FOREIGN_KEY_VIOLATION:
      return new DatabaseInvalidInputException(error, context);
    default:
      return new DatabaseException(`Failed to ${operation}`, error, context);
  }
}

/**
 * Wraps a database operation with consistent error handling and logging.
 *
 * Logs PostgreSQL error details (code, detail, constraint, table) from the unwrapped error
 * (never the bound query params) and throws a DatabaseException with the original error as cause.
 * Unique violations become 409, invalid input / FK violations become 400 (both subclasses of
 * DatabaseException).
 *
 * @param operation - Human-readable operation name for logging
 * @param logger - NestJS Logger instance
 * @param fn - Async function to execute
 * @param context - Optional context for error details
 * @returns Result of the function
 * @throws DatabaseException (500) / DatabaseConflictException (409) / DatabaseInvalidInputException (400)
 *
 * @example
 * return withDbError('list notifications', this.logger, async () => {
 *   return this.db.select().from(schema.notifications).where(...);
 * }, { userId });
 */
export async function withDbError<T>(
  operation: string,
  logger: Logger,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Re-throw application exceptions (NotFoundException, ForbiddenException, etc.) as-is
    if (error instanceof AppException) throw error;

    const msg = safeErrorMessage(error);
    const pgDetails = extractPgErrorDetails(error);
    const stack = sanitizeErrorStack(error);

    // Log with full PostgreSQL error details
    const logContext = { ...context, ...pgDetails };
    const contextStr = Object.keys(logContext).length > 0 ? ` ${JSON.stringify(logContext)}` : '';

    logger.error(`${operation} failed: ${msg}${contextStr}`, stack);

    throw toDatabaseException(operation, error, context);
  }
}
