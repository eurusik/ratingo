/**
 * Image data with multiple sizes.
 */
export interface ImageData {
  small: string;
  medium: string;
  large: string;
  original: string;
}

/**
 * External rating with optional vote count.
 */
export interface ExternalRating {
  rating: number;
  voteCount?: number | null;
}

/**
 * External ratings from various sources.
 */
export interface ExternalRatings {
  tmdb?: ExternalRating | null;
  imdb?: ExternalRating | null;
  trakt?: ExternalRating | null;
  metacritic?: { rating: number } | null;
  rottenTomatoes?: { rating: number } | null;
}

/**
 * Ratingo stats for media items.
 */
export interface RatingoStats {
  ratingoScore: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
  liveWatchers: number | null;
  totalWatchers: number | null;
}
