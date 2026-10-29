/**
 * Content class constants.
 * Use these instead of magic strings throughout the codebase.
 *
 * Lives in shared/contracts (not catalog-policy) because NormalizedMedia
 * carries it: ingestion's published types must not import catalog-policy.
 */
export const ContentClassValues = {
  MAINSTREAM: 'mainstream',
  ANIME: 'anime',
  DOCUMENTARY: 'documentary',
  REALITY: 'reality',
  KIDS: 'kids',
} as const;

/**
 * Content class enum values.
 * Matches the content_class_enum in database schema.
 */
export type ContentClass = (typeof ContentClassValues)[keyof typeof ContentClassValues];
