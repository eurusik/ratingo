/**
 * Error codes for the Journal module.
 */
export const JOURNAL_ERRORS = {
  /** Post with the specified slug or ID was not found */
  POST_NOT_FOUND: 'JOURNAL_POST_NOT_FOUND',
  /** A post with this slug already exists */
  SLUG_ALREADY_EXISTS: 'JOURNAL_SLUG_EXISTS',
  /** The provided post type is not valid */
  INVALID_POST_TYPE: 'JOURNAL_INVALID_TYPE',
  /** The uploaded image type is not allowed */
  INVALID_IMAGE_TYPE: 'JOURNAL_INVALID_IMAGE_TYPE',
  /** The uploaded image exceeds the maximum size */
  IMAGE_TOO_LARGE: 'JOURNAL_IMAGE_TOO_LARGE',
  /** Invalid post state (e.g., published without publishedAt) */
  INVALID_POST_STATE: 'JOURNAL_INVALID_POST_STATE',
} as const;

export type JournalErrorCode = (typeof JOURNAL_ERRORS)[keyof typeof JOURNAL_ERRORS];
