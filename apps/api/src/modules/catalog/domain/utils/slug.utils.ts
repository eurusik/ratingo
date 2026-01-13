import slugify from 'slugify';

import { SLUG_CONFIG } from '../constants/catalog.constants';

// Minimum slug length to be considered valid (avoid "2", "a", etc.)
const MIN_SLUG_LENGTH = 3;

// Pattern for slugs that are only digits (high collision risk)
const DIGITS_ONLY_PATTERN = /^\d+$/;

/**
 * Generates a URL-friendly slug from a title.
 * Falls back to tmdb-{id} format if:
 * - Title is empty/null
 * - Resulting slug is empty (e.g., Chinese-only titles)
 * - Resulting slug is too short (< 3 chars)
 * - Resulting slug is digits-only (high collision risk)
 *
 * @param title - Media title
 * @param tmdbId - TMDB ID for fallback
 * @returns URL-friendly slug
 */
export function generateSlug(title: string | null | undefined, tmdbId: number): string {
  const trimmedTitle = title?.trim();

  // No title — use tmdb-{id}
  if (!trimmedTitle) {
    return `tmdb-${tmdbId}`;
  }

  const baseSlug = slugify(trimmedTitle, {
    lower: SLUG_CONFIG.LOWER,
    strict: SLUG_CONFIG.STRICT,
    locale: SLUG_CONFIG.LOCALE,
  });

  // Empty slug (e.g., Chinese-only title "城市印象：深圳")
  // Too short (e.g., "2", "a")
  // Digits-only (e.g., "2", "1984" — high collision risk)
  if (!baseSlug || baseSlug.length < MIN_SLUG_LENGTH || DIGITS_ONLY_PATTERN.test(baseSlug)) {
    return `tmdb-${tmdbId}`;
  }

  return baseSlug;
}

/**
 * Generates a unique slug by appending tmdbId suffix.
 * Used when base slug collides with existing record.
 *
 * @param baseSlug - Original slug that caused collision
 * @param tmdbId - TMDB ID to append
 * @returns Unique slug with tmdbId suffix
 */
export function generateUniqueSlug(baseSlug: string, tmdbId: number): string {
  return `${baseSlug}-${tmdbId}`;
}
