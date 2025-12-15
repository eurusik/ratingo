/**
 * Shared types for details pages.
 */

export type BadgeKey = 'TRENDING' | 'NEW_RELEASE' | 'RISING' | 'NEW_EPISODE';

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

export interface ExternalRatings {
  imdb?: { rating: number; voteCount?: number };
  tmdb?: { rating: number; voteCount?: number };
  trakt?: { rating: number; voteCount?: number };
}
