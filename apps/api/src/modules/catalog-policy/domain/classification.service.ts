/**
 * Content Classification Service
 *
 * Pure functions for classifying media content based on genres and origin metadata.
 * Content_Class is a higher-level semantic classification derived from genres + origin,
 * NOT a direct TMDB genre mapping.
 */

import { TMDB_GENRE_IDS } from './constants/genre-mapping.constants';

/**
 * Content class constants.
 * Use these instead of magic strings throughout the codebase.
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

/**
 * Input for content classification.
 */
export interface ClassificationInput {
  originCountries: string[] | null;
  originalLanguage: string | null;
  genreIds: number[];
}

/**
 * Pure function: classifies media content based on genres and origin metadata.
 *
 * Classification rules (in priority order):
 * 1. Animation (16) + JP origin/language → anime
 * 2. Documentary (99) → documentary
 * 3. Reality (10764) → reality
 * 4. Kids (10762) ONLY → kids (FAMILY excluded - too broad)
 * 5. Default → mainstream
 *
 * Design Decision: FAMILY (10751) is NOT auto-classified as kids because:
 * - FAMILY includes many mainstream films (Home Alone, Paddington, etc.)
 * - Auto-excluding would remove large portion of catalog
 * - Future: add target_audience field for more precise kids classification
 *
 * @param input - Media item metadata
 * @returns Content class
 */
export function classifyContent(input: ClassificationInput): ContentClass {
  const { originCountries, originalLanguage, genreIds } = input;

  // Handle null/undefined genreIds gracefully
  const safeGenreIds = genreIds ?? [];

  // Rule 1: Anime = Animation + Japanese origin
  if (safeGenreIds.includes(TMDB_GENRE_IDS.ANIMATION)) {
    const isJapanese =
      (originCountries && originCountries.includes('JP')) || originalLanguage === 'ja';

    if (isJapanese) {
      return ContentClassValues.ANIME;
    }
  }

  // Rule 2: Documentary
  if (safeGenreIds.includes(TMDB_GENRE_IDS.DOCUMENTARY)) {
    return ContentClassValues.DOCUMENTARY;
  }

  // Rule 3: Reality
  if (safeGenreIds.includes(TMDB_GENRE_IDS.REALITY)) {
    return ContentClassValues.REALITY;
  }

  // Rule 4: Kids - ONLY explicit Kids genre, NOT Family
  // Family (10751) stays mainstream until target_audience is implemented
  if (safeGenreIds.includes(TMDB_GENRE_IDS.KIDS)) {
    return ContentClassValues.KIDS;
  }

  // Rule 5: Default
  return ContentClassValues.MAINSTREAM;
}

/**
 * Valid content class values for validation.
 */
export const VALID_CONTENT_CLASSES: ContentClass[] = Object.values(ContentClassValues);

/**
 * Validates if a string is a valid ContentClass.
 *
 * @param value - Value to validate
 * @returns True if valid ContentClass
 */
export function isValidContentClass(value: unknown): value is ContentClass {
  return typeof value === 'string' && VALID_CONTENT_CLASSES.includes(value as ContentClass);
}
