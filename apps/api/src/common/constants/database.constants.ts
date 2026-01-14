/**
 * PostgreSQL error codes.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_ERROR_CODE = {
  UNIQUE_VIOLATION: '23505',
} as const;

/**
 * Database constraint names used in the application.
 * Must match the names defined in database/schema.ts
 */
export const DB_CONSTRAINT = {
  MEDIA_TYPE_SLUG: 'media_type_slug_idx',
} as const;
