export { generateSlug } from '../../../../common/utils/slug.util';

/**
 * Checks if slug already has the tmdbId suffix.
 */
export function hasTmdbIdSuffix(slug: string, tmdbId: number): boolean {
  return slug.endsWith(`-${tmdbId}`);
}

/**
 * Generates a unique slug by appending tmdbId suffix.
 * Handles edge case where slug already has the suffix to avoid double-suffixing.
 */
export function generateUniqueSlug(baseSlug: string, tmdbId: number): string {
  return hasTmdbIdSuffix(baseSlug, tmdbId) ? baseSlug : `${baseSlug}-${tmdbId}`;
}

/**
 * Creates a fallback slug when original slug is missing or empty.
 */
export function createFallbackSlug(tmdbId: number): string {
  return `tmdb-${tmdbId}`;
}

/**
 * Creates a retry slug for collision scenario.
 * Uses fallback slug if original is missing.
 */
export function createRetrySlug(originalSlug: string | undefined, tmdbId: number): string {
  const baseSlug = originalSlug || createFallbackSlug(tmdbId);
  return generateUniqueSlug(baseSlug, tmdbId);
}
