import { PG_ERROR_CODE } from '../constants/database.constants';

/**
 * Drizzle-wrapped PostgreSQL error structure.
 * postgres.js uses 'constraint_name' (not 'constraint') for the PostgreSQL 'n' field.
 */
interface DrizzlePostgresError {
  code?: string;
  message?: string;
  detail?: string;
  constraint_name?: string;
  cause?: {
    code?: string;
    message?: string;
    detail?: string;
    constraint_name?: string;
  };
}

/**
 * Extracted PostgreSQL error details.
 */
export interface PgErrorDetails {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
}

/**
 * Extracts PostgreSQL error details from a Drizzle-wrapped error.
 * PostgreSQL errors are often wrapped in the 'cause' property by Drizzle.
 *
 * @param error - Unknown error to extract details from
 * @returns Extracted PostgreSQL error details
 */
export function extractPgError(error: unknown): PgErrorDetails {
  const err = error as DrizzlePostgresError;
  const pgError = err.cause ?? err;

  return {
    code: pgError.code ?? err.code,
    message: pgError.message ?? err.message,
    detail: pgError.detail ?? err.detail,
    constraint: pgError.constraint_name ?? err.constraint_name,
  };
}

/**
 * Checks if error is a PostgreSQL unique constraint violation.
 *
 * @param error - Unknown error to check
 * @param constraint - Optional specific constraint name to match
 * @returns True if error is a unique violation (optionally on specific constraint)
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const { code, constraint: errorConstraint } = extractPgError(error);

  if (code !== PG_ERROR_CODE.UNIQUE_VIOLATION) {
    return false;
  }

  if (constraint !== undefined) {
    return errorConstraint === constraint;
  }

  return true;
}

/**
 * Checks if error is a slug collision (unique violation on media_type_slug constraint).
 *
 * @param error - Unknown error to check
 * @param constraintName - Constraint name for slug uniqueness
 * @returns True if error is a slug collision
 */
export function isSlugCollision(error: unknown, constraintName: string): boolean {
  return isUniqueViolation(error, constraintName);
}
