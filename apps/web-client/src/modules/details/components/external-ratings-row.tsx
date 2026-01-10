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

  const hasAnyRating =
    externalRatings.imdb?.rating ||
    externalRatings.tmdb?.rating ||
    externalRatings.trakt?.rating ||
    externalRatings.rottenTomatoes?.rating;

  if (!hasAnyRating) return null;

  return (
    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
      {externalRatings.imdb?.rating != null &&
        externalRatings.imdb.rating !== excludeRating && (
          <RatingBadge source="IMDb" rating={externalRatings.imdb.rating} />
        )}

      {externalRatings.tmdb?.rating != null &&
        externalRatings.tmdb.rating !== excludeRating && (
          <RatingBadge source="TMDB" rating={externalRatings.tmdb.rating} />
        )}

      {externalRatings.trakt?.rating != null &&
        externalRatings.trakt.rating !== excludeRating && (
          <RatingBadge source="Trakt" rating={externalRatings.trakt.rating} />
        )}

      {externalRatings.rottenTomatoes?.rating != null && (
        <RatingBadge
          source="RT"
          rating={externalRatings.rottenTomatoes.rating}
          isPercentage
        />
      )}
    </div>
  );
}
