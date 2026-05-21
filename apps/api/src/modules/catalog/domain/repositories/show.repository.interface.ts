import { type IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type ShowStatus } from '../../../../common/enums/show-status.enum';
import { type NormalizedSeason } from '../../../ingestion/public';
import { type DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import type {
  ImageData,
  VideoData,
  CreditsData,
  AvailabilityData,
  RatingoStats,
  ExternalRatings,
  GenreInfo,
} from '../types/common.types';
import type {
  TrendingQueryResult,
  CatalogSort,
  SortOrder,
  VoteSource,
  ListContext,
} from '../types/query.types';
import { type DatabaseTransaction } from '../types/transaction.type';

/**
 * Options for trending shows query.
 */
export interface TrendingShowsOptions {
  limit?: number;
  offset?: number;
  minRatingo?: number;
  genres?: string[];
  sort?: CatalogSort;
  order?: SortOrder;
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  /** List context for freshness filtering (default: catalog) */
  context?: ListContext;
}

/**
 * Lightweight trending show item.
 */
export interface TrendingShowItem {
  id: string;
  mediaItemId: string;
  type: MediaType.SHOW;
  slug: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  ingestionStatus: IngestionStatus;
  primaryTrailerKey: string | null;
  poster: ImageData | null;
  backdrop: ImageData | null;
  releaseDate: Date | null;

  isNew: boolean;
  isClassic: boolean;

  stats: RatingoStats;
  externalRatings: ExternalRatings;

  showProgress: {
    lastAirDate: Date | null;
    nextAirDate: Date | null;
    season: number | null;
    episode: number | null;
    label: string | null;
  } | null;

  /** Whether the show has a recent episode (aired within past 7 days). */
  hasRecentEpisode: boolean;
}

/**
 * Show data for listing.
 */
export interface ShowListItem {
  tmdbId: number;
  title: string;
}

/**
 * New episode item for the update feed.
 * Grouped by show - one entry per show with the latest episode.
 */
export interface NewEpisodeItem {
  /** Media item ID (from media_items table, not shows.id) */
  mediaItemId: string;
  slug: string;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  airDate: Date;
}

/**
 * Calendar episode item for the global show calendar.
 */
export interface CalendarEpisode {
  showId: string;
  showSlug: string;
  showTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string | null;
  airDate: Date;
  runtime: number | null;
  stillPath: string | null;
}

/**
 * Episode info for show details.
 */
export interface EpisodeInfo {
  id: string;
  number: number;
  title: string | null;
  airDate: Date | null;
  runtime: number | null;
  stillPath: string | null;
  voteAverage: number | null;
}

/**
 * Season info for show details.
 */
export interface SeasonInfo {
  number: number;
  name: string;
  episodeCount: number;
  posterPath: string | null;
  airDate: Date | null;
  episodes?: EpisodeInfo[];
}

/**
 * Minimal show identity for lightweight lookups (e.g. sync cooldown checks).
 */
export interface ShowIdentity {
  id: string;
  tmdbId: number;
  lastSyncedAt: Date | null;
}

/**
 * Full show details.
 */
export interface ShowDetails {
  id: string;
  /** Internal shows table ID (for episode progress tracking) */
  showId: string;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  ingestionStatus: IngestionStatus;
  poster: ImageData | null;
  backdrop: ImageData | null;
  videos: VideoData[] | null;
  primaryTrailer: VideoData | null;
  credits: CreditsData | null;
  availability: AvailabilityData | null;

  stats: RatingoStats;
  externalRatings: ExternalRatings;

  releaseDate: Date | null;
  lastSyncedAt: Date | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  status: ShowStatus | null;
  lastAirDate: Date | null;
  nextAirDate: Date | null;

  genres: GenreInfo[];
  seasons: SeasonInfo[];
}

/**
 * Abstract interface for Show-specific storage operations.
 */
export interface IShowRepository {
  /**
   * Upserts show details (called by orchestrator).
   */
  upsertDetails(
    tx: DatabaseTransaction,
    mediaId: string,
    details: {
      totalSeasons?: number | null;
      totalEpisodes?: number | null;
      lastAirDate?: Date | null;
      nextAirDate?: Date | null;
      status?: string | null;
      seasons?: NormalizedSeason[];
    },
  ): Promise<void>;

  /**
   * Gets shows for drop-off analysis.
   */
  findShowsForAnalysis(limit: number): Promise<ShowListItem[]>;

  /**
   * Saves drop-off analysis for a show.
   */
  saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void>;

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   */
  getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null>;

  /**
   * Finds shows with new episodes within a recent time window.
   * Groups by show and returns only the latest episode per show.
   *
   * @param days - Number of days to look back
   * @param limit - Max number of shows to return
   */
  findNewEpisodes(days: number, limit: number): Promise<NewEpisodeItem[]>;

  /**
   * Finds episodes airing within a date range for the global or personalized calendar.
   *
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   * @param options.userId - When provided, filters to shows the user is currently watching
   */
  findEpisodesByDateRange(
    startDate: Date,
    endDate: Date,
    options?: { userId?: string | null },
  ): Promise<CalendarEpisode[]>;

  /**
   * Finds trending shows with filtering and pagination.
   */
  findTrending(options: TrendingShowsOptions): Promise<TrendingQueryResult<TrendingShowItem>>;

  /**
   * Finds popular shows (historically popular, no freshness gate).
   */
  findPopular(options: TrendingShowsOptions): Promise<TrendingQueryResult<TrendingShowItem>>;

  /**
   * Finds full show details by slug.
   */
  findBySlug(slug: string): Promise<ShowDetails | null>;

  /**
   * Finds minimal show identity by slug (id, tmdbId, lastSyncedAt).
   * Use this instead of findBySlug when full details are not needed.
   */
  findIdentityBySlug(slug: string): Promise<ShowIdentity | null>;
}

/**
 * Injection token for the Show repository.
 */
export const SHOW_REPOSITORY = Symbol('SHOW_REPOSITORY');
