/**
 * External ratings row (IMDb, TMDB, Trakt, RT).
 * Moved from hero to details section.
 */

import type { ExternalRatings } from '../types';
import { RatingBadge } from './rating-badge';

interface ExternalRatingsRowProps {
  externalRatings?: ExternalRatings | null;
  /** Exclude rating if it matches primary (to avoid duplication) */
  excludeRating?: number | null;
}

export function ExternalRatingsRow({ externalRatings, excludeRating }: ExternalRatingsRowProps) {
  if (!externalRatings) return null;

  // Helper to check if rating is valid (not null, undefined, or 0)
  const isValidRating = (rating?: number | null): rating is number =>
    typeof rating === 'number' && rating > 0;

  const hasAnyRating =
    isValidRating(externalRatings.imdb?.rating) ||
    isValidRating(externalRatings.tmdb?.rating) ||
    isValidRating(externalRatings.trakt?.rating) ||
    isValidRating(externalRatings.rottenTomatoes?.rating);

  if (!hasAnyRating) return null;

  return (
    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
      {isValidRating(externalRatings.imdb?.rating) && externalRatings.imdb!.rating !== excludeRating && (
        <RatingBadge source="IMDb" rating={externalRatings.imdb!.rating} />
      )}

      {isValidRating(externalRatings.tmdb?.rating) && externalRatings.tmdb!.rating !== excludeRating && (
        <RatingBadge source="TMDB" rating={externalRatings.tmdb!.rating} />
      )}

      {isValidRating(externalRatings.trakt?.rating) && externalRatings.trakt!.rating !== excludeRating && (
        <RatingBadge source="Trakt" rating={externalRatings.trakt!.rating} />
      )}

      {isValidRating(externalRatings.rottenTomatoes?.rating) && (
        <RatingBadge source="RT" rating={externalRatings.rottenTomatoes!.rating} isPercentage />
      )}
    </div>
  );
}
