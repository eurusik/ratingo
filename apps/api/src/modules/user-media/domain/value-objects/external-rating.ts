const EXTERNAL_RATING_MIN = 0.5;
const EXTERNAL_RATING_MAX = 10;
const EXTERNAL_RATING_SCALE_FACTOR = 10;

/**
 * Converts a 0.5-10 external rating to the internal 0-100 scale.
 * Clamps the input to the valid 0.5-10 range before scaling, so out-of-range
 * values are silently corrected rather than rejected.
 * Zero is treated as a sentinel meaning "unset" and returns null.
 */
export function normalizeExternalRating(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating) || rating === 0) return null;
  return Math.round(
    Math.min(EXTERNAL_RATING_MAX, Math.max(EXTERNAL_RATING_MIN, rating)) *
      EXTERNAL_RATING_SCALE_FACTOR,
  );
}
