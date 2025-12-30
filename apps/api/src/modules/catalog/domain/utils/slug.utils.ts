import slugify from 'slugify';
import { SLUG_CONFIG } from '../constants/catalog.constants';

/**
 * Generates a URL-friendly slug from a title.
 * Falls back to tmdb-{id} format if title is empty.
 *
 * @param title - Media title
 * @param tmdbId - TMDB ID for fallback
 * @returns URL-friendly slug
 */
export function generateSlug(title: string | null | undefined, tmdbId: number): string {
  const input = title?.trim() || `tmdb-${tmdbId}`;

  return slugify(input, {
    lower: SLUG_CONFIG.LOWER,
    strict: SLUG_CONFIG.STRICT,
    locale: SLUG_CONFIG.LOCALE,
  });
}
