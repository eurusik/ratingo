/**
 * Single external rating item.
 */
export type ExternalRatingItem = {
  rating: number;
  voteCount?: number | null;
};

/**
 * External ratings from various sources.
 * Domain/application type - use ExternalRatingsDto for API responses.
 */
export type ExternalRatings = {
  tmdb?: ExternalRatingItem | null;
  imdb?: ExternalRatingItem | null;
  trakt?: ExternalRatingItem | null;
  metacritic?: ExternalRatingItem | null;
  rottenTomatoes?: ExternalRatingItem | null;
};
