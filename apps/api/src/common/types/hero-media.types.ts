import { MediaType } from '../enums/media-type.enum';

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
  tmdb: ExternalRating | null;
  imdb: ExternalRating | null;
  trakt: ExternalRating | null;
  metacritic: { rating: number } | null;
  rottenTomatoes: { rating: number } | null;
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

/**
 * Show progress information for hero items.
 */
export interface HeroShowProgress {
  season: number | null;
  episode: number | null;
  label: string | null;
  lastAirDate: Date | null;
  nextAirDate: Date | null;
}

/**
 * Hero media item for homepage showcase.
 * Shared type used by both catalog (producer) and home (consumer) modules.
 */
export interface HeroMediaItem {
  id: string;
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  primaryTrailerKey: string | null;
  poster: ImageData | null;
  backdrop: ImageData | null;
  releaseDate: Date | null;
  isNew: boolean;
  isClassic: boolean;
  stats: RatingoStats;
  externalRatings: ExternalRatings;
  showProgress?: HeroShowProgress | null;
}
