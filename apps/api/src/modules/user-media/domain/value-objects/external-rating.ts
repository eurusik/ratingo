const KINOBAZA_RATING_MIN = 1;
const KINOBAZA_RATING_MAX = 10;
const KINOBAZA_SCALE_FACTOR = 10;

/**
 * Converts a Kinobaza 1-10 rating to the internal 0-100 scale.
 * Clamps the input to the valid 1-10 range before scaling, so out-of-range
 * values are silently corrected rather than rejected.
 */
export function normalizeKinobazaRating(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating) || rating === 0) return null;
  return Math.round(
    Math.min(KINOBAZA_RATING_MAX, Math.max(KINOBAZA_RATING_MIN, rating)) * KINOBAZA_SCALE_FACTOR,
  );
}
