/**
 * Shared types for details pages.
 */

export type BadgeKey = 'TRENDING' | 'NEW_RELEASE' | 'RISING' | 'NEW_EPISODE' | 'CONTINUE' | 'IN_WATCHLIST';

export interface Provider {
  id: number;
  name: string;
  logo?: string;
  type: 'stream' | 'rent' | 'buy';
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
}

export interface ImageSet {
  small: string;
  medium: string;
  large: string;
  original: string;
}

export interface Stats {
  ratingoScore: number;
  qualityScore?: number;
  popularityScore?: number;
  liveWatchers?: number;
  totalWatchers?: number;
}

export interface RatingSource {
  rating: number;
  voteCount?: number;
}

export interface ExternalRatings {
  imdb?: RatingSource;
  tmdb?: RatingSource;
  trakt?: RatingSource;
  metacritic?: RatingSource;
  rottenTomatoes?: RatingSource;
}
