import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  VideoSiteEnum,
  VideoTypeEnum,
  VideoLanguageEnum,
} from '../../../../common/enums/video.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

/**
 * Cast member representation in normalized credits.
 */
export interface CastMember {
  tmdbId: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

/**
 * Crew member representation in normalized credits.
 */
export interface CrewMember {
  tmdbId: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

/**
 * Normalized credits object.
 */
export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

/**
 * Watch provider definition.
 */
export interface WatchProvider {
  providerId: number;
  name: string;
  logoPath: string | null;
  displayPriority?: number;
}

/**
 * Availability for a single region.
 */
export interface WatchProviderRegion {
  link: string | null;
  flatrate?: WatchProvider[]; // TMDB calls this 'flatrate'
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  ads?: WatchProvider[];
  free?: WatchProvider[];
}

/**
 * Map of region code to watch providers availability.
 */
export type WatchProvidersMap = Record<string, WatchProviderRegion>;

/**
 * Normalized episode payload.
 */
export interface NormalizedEpisode {
  tmdbId?: number;
  number: number;
  title: string;
  overview?: string | null;
  airDate?: Date | null;
  runtime?: number | null;
  stillPath?: string | null;
  rating?: number | null;
}

/**
 * Normalized season payload.
 */
export interface NormalizedSeason {
  tmdbId?: number;
  number: number;
  name?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  airDate?: Date | null;
  episodeCount?: number;
  episodes: NormalizedEpisode[];
}

/**
 * Normalized video payload.
 */
export interface NormalizedVideo {
  key: string;
  name: string;
  site: VideoSiteEnum;
  type: VideoTypeEnum;
  official: boolean;
  language: VideoLanguageEnum; // iso_639_1
  country: string; // iso_3166_1
}

/**
 * Represents the "Clean" data structure used internally by our system.
 * All external API responses must be converted to this format before processing.
 */
export interface NormalizedMedia {
  externalIds: {
    tmdbId: number;
    imdbId?: string | null;
    traktId?: number | null;
  };

  type: MediaType;
  title: string;
  originalTitle?: string | null;
  overview?: string | null;

  ingestionStatus?: IngestionStatus;

  /** Generated SEO-friendly slug */
  slug: string;

  posterPath?: string | null;
  backdropPath?: string | null;

  /** Normalized 0-10 scale */
  rating: number;
  voteCount: number;
  popularity: number;

  // External Ratings (Optional)
  ratingImdb?: number | null;
  voteCountImdb?: number | null;
  ratingMetacritic?: number | null;
  ratingRottenTomatoes?: number | null;
  ratingTrakt?: number | null;
  voteCountTrakt?: number | null;

  /** Synthetic score for sorting trending lists. Null if not in trends. */
  trendingScore?: number;

  // Ratingo Score (calculated)
  ratingoScore?: number; // Main composite score (0-1)
  qualityScore?: number; // Rating-based component (0-1)
  popularityScore?: number; // Popularity-based component (0-1)
  freshnessScore?: number; // Time-based component (0-1)

  /** Number of active watchers (Trakt/Realtime) */
  watchersCount?: number;

  /** Total unique watchers all time (Trakt stats) */
  totalWatchers?: number;

  /** First air date for shows */
  releaseDate?: Date | null;
  status?: string | null;
  isAdult: boolean;

  details?: {
    runtime?: number | null;
    budget?: number | null;
    revenue?: number | null;

    totalSeasons?: number | null;
    totalEpisodes?: number | null;
    lastAirDate?: Date | null;
    nextAirDate?: Date | null;
    status?: string | null;
    seasons?: NormalizedSeason[];

    // Release dates (movies only)
    theatricalReleaseDate?: Date | null;
    digitalReleaseDate?: Date | null;
    releases?: Array<{
      country: string;
      type: number;
      date: string;
      certification?: string;
    }>;
  };

  genres: Array<{
    tmdbId: number;
    name: string;
    slug: string;
  }>;

  videos?: NormalizedVideo[];
  credits: Credits;

  watchProviders?: WatchProvidersMap | null;
}
