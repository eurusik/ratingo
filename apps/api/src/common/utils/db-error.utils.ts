import { Logger } from '@nestjs/common';

import { DatabaseException } from '../exceptions/database.exception';

/**
 * PostgreSQL error interface for typed error handling.
 */
interface PostgresError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
  schema?: string;
}

/**
 * Checks if error is a PostgreSQL error with additional properties.
 */
function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && 'code' in error;
}

/**
 * Extracts relevant details from a PostgreSQL error for logging.
 */
function extractPgErrorDetails(error: unknown): Record<string, unknown> {
  if (!isPostgresError(error)) {
    return {};
  }

  const details: Record<string, unknown> = {};

  if (error.code) details.pgCode = error.code;
  if (error.detail) details.pgDetail = error.detail;
  if (error.constraint) details.constraint = error.constraint;
  if (error.table) details.table = error.table;

  return details;
}

/**
 * Wraps a database operation with consistent error handling and logging.
 *
 * Logs the full PostgreSQL error details (code, detail, constraint, table)
 * and throws a DatabaseException with the original error as cause.
 *
 * @param operation - Human-readable operation name for logging
 * @param logger - NestJS Logger instance
 * @param fn - Async function to execute
 * @param context - Optional context for error details
 * @returns Result of the function
 * @throws DatabaseException with original error as cause
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
    const msg = error instanceof Error ? error.message : String(error);
    const pgDetails = extractPgErrorDetails(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // Log with full PostgreSQL error details
    const logContext = { ...context, ...pgDetails };
    const contextStr = Object.keys(logContext).length > 0 ? ` ${JSON.stringify(logContext)}` : '';

    logger.error(`${operation} failed: ${msg}${contextStr}`, stack);

    throw new DatabaseException(`Failed to ${operation}`, error, context);
  }
}
