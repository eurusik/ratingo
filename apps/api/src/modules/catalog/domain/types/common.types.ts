/**
 * Common domain types for catalog module.
 * These types are domain-specific and don't depend on presentation or infrastructure layers.
 */

import {
  type VideoSiteEnum,
  type VideoTypeEnum,
  type VideoLanguageEnum,
} from '../../../../common/enums/video.enum';

/**
 * Genre information for media items.
 */
export interface GenreInfo {
  id: string;
  name: string;
  slug: string;
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
 * Image data with multiple sizes for media items.
 */
export interface ImageData {
  small: string;
  medium: string;
  large: string;
  original: string;
}

/**
 * Video/trailer data for media items.
 */
export interface VideoData {
  key: string;
  name: string;
  site: VideoSiteEnum;
  type: VideoTypeEnum;
  official: boolean;
  language: VideoLanguageEnum;
  country: string;
}

/**
 * Cast member data.
 */
export interface CastMember {
  personId: string;
  slug: string | null;
  tmdbId: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

/**
 * Crew member data.
 */
export interface CrewMember {
  personId: string;
  slug: string | null;
  tmdbId: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

/**
 * Credits data for media items.
 */
export interface CreditsData {
  cast: CastMember[];
  crew: CrewMember[];
}

/**
 * Watch provider data.
 */
export interface WatchProvider {
  providerId: number;
  name: string;
  logo?: ImageData | null;
  displayPriority?: number;
}

/**
 * Availability data for media items.
 */
export interface AvailabilityData {
  region: 'UA' | 'US' | null;
  isFallback: boolean;
  link: string | null;
  stream?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  ads?: WatchProvider[];
  free?: WatchProvider[];
}
