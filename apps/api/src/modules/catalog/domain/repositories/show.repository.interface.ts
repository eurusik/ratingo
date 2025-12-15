import { DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import { NormalizedSeason } from '../../../ingestion/domain/models/normalized-media.model';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { Video } from '../../../../database/schema';
import {
  CreditsDto,
  ImageDto,
  AvailabilityDto,
  ExternalRatingsDto,
  RatingoStatsDto,
} from '../../presentation/dtos/common.dto';
import {
  CatalogListQueryDto,
  CatalogSort,
  SortOrder,
  VoteSource,
} from '../../presentation/dtos/catalog-list-query.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';

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
}

/**
 * Helper type for list queries that also return total count.
 */
export type WithTotal<T> = T[] & { total?: number };

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
  poster: ImageDto | null;
  backdrop: ImageDto | null;
  releaseDate: Date | null;

  isNew: boolean;
  isClassic: boolean;

  stats: RatingoStatsDto;
  externalRatings: ExternalRatingsDto;

  showProgress: {
    lastAirDate: Date | null;
    nextAirDate: Date | null;
    season: number | null;
    episode: number | null;
    label: string | null;
  } | null;
}

/**
 * Show data for listing.
 */
export interface ShowListItem {
  tmdbId: number;
  title: string;
}

/**
 * Calendar episode item for the global show calendar.
 */
export interface CalendarEpisode {
  showId: string;
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
 * Full show details.
 */
export interface ShowDetails {
  id: string;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  ingestionStatus: IngestionStatus;
  poster?: ImageDto | null;
  backdrop?: ImageDto | null;
  videos?: Video[] | null;
  primaryTrailer?: Video | null;
  credits?: CreditsDto | null;
  availability?: AvailabilityDto | null;

  stats: {
    ratingoScore: number | null;
    qualityScore: number | null;
    popularityScore: number | null;
    liveWatchers: number | null;
    totalWatchers: number | null;
  };

  externalRatings: {
    tmdb: { rating: number; voteCount?: number | null } | null;
    imdb: { rating: number; voteCount?: number | null } | null;
    trakt: { rating: number; voteCount?: number | null } | null;
    metacritic: { rating: number; voteCount?: number | null } | null;
    rottenTomatoes: { rating: number; voteCount?: number | null } | null;
  };

  totalSeasons: number | null;
  totalEpisodes: number | null;
  status: ShowStatus | null;
  lastAirDate: Date | null;
  nextAirDate: Date | null;

  genres: Array<{ id: string; name: string; slug: string }>;

  seasons: Array<{
    number: number;
    name: string;
    episodeCount: number;
    posterPath: string | null;
    airDate: Date | null;
  }>;
}

/**
 * Abstract interface for Show-specific storage operations.
 * Extends catalog functionality with show-specific queries.
 */
export interface IShowRepository {
  /**
   * Upserts show details (called by orchestrator).
   *
   * @param {any} tx - Transaction handle
   * @param {string} mediaId - Media item id
   * @param {{ totalSeasons?: number | null; totalEpisodes?: number | null; lastAirDate?: Date | null; nextAirDate?: Date | null; status?: string | null; seasons?: NormalizedSeason[] }} details - Details payload
   * @returns {Promise<void>} Nothing
   */
  upsertDetails(
    tx: any, // We use 'any' here to avoid exposing Drizzle types to domain, implementation casts it
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
   * Returns shows that need analysis (no analysis or outdated).
   *
   * @param {number} limit - Max shows
   * @returns {Promise<ShowListItem[]>} Shows list
   */
  findShowsForAnalysis(limit: number): Promise<ShowListItem[]>;

  /**
   * Saves drop-off analysis for a show.
   *
   * @param {number} tmdbId - TMDB ID
   * @param {DropOffAnalysis} analysis - Analysis payload
   * @returns {Promise<void>} Nothing
   */
  saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void>;

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<DropOffAnalysis | null>} Analysis or null
   */
  getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null>;

  /**
   * Finds episodes airing within a date range for the global calendar.
   *
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<CalendarEpisode[]>} Episodes list
   */
  findEpisodesByDateRange(startDate: Date, endDate: Date): Promise<CalendarEpisode[]>;

  /**
   * Finds trending shows with filtering and pagination.
   *
   * @param {TrendingShowsOptions} options - Query options
   * @returns {Promise<WithTotal<TrendingShowItem>>} Shows list
   */
  findTrending(options: TrendingShowsOptions): Promise<WithTotal<TrendingShowItem>>;

  /**
   * Finds full show details by slug.
   *
   * @param {string} slug - Show slug
   * @returns {Promise<ShowDetails | null>} Show details or null
   */
  findBySlug(slug: string): Promise<ShowDetails | null>;
}

/**
 * Injection token for the Show repository.
 */
export const SHOW_REPOSITORY = Symbol('SHOW_REPOSITORY');
