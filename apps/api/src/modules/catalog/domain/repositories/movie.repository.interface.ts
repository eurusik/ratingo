import { MovieStatus } from '../../../../common/enums/movie-status.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import type { CardMeta } from '../../../shared/cards/domain/card.types';
import { DatabaseTransaction } from '../types/transaction.type';
import type {
  ImageData,
  VideoData,
  CreditsData,
  AvailabilityData,
  GenreInfo,
  RatingoStats,
  ExternalRatings,
} from '../types/common.types';

/**
 * Release info for movies (theatrical/digital releases by region).
 */
export interface ReleaseInfo {
  country: string;
  type: number;
  date: string;
  certification?: string;
}

/**
 * Movie with media item data for catalog queries.
 */
export interface MovieWithMedia {
  id: string;
  mediaItemId: string;
  tmdbId: number;
  title: string;
  slug: string;
  overview: string | null;
  ingestionStatus: IngestionStatus;
  poster: ImageData | null;
  backdrop: ImageData | null;
  popularity: number;
  releaseDate: Date | null;
  videos: VideoData[] | null;

  stats: RatingoStats;
  externalRatings: ExternalRatings;

  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  runtime: number | null;

  genres: GenreInfo[];
}

/**
 * Helper type for list queries that also return total count.
 */
export type WithTotal<T> = T[] & { total?: number };

/**
 * Trending movie item extends base list item with derived flags.
 */
export type TrendingMovieItem = MovieWithMedia & {
  isNew: boolean;
  isClassic: boolean;
};

/**
 * Sort options for catalog queries.
 * Using string literals to match presentation layer DTO.
 */
export type CatalogSort = 'trending' | 'popularity' | 'ratingo' | 'releaseDate' | 'tmdbPopularity';

/**
 * Sort order.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Vote source for filtering.
 */
export type VoteSource = 'tmdb' | 'trakt';

/**
 * Options for now playing query.
 */
export interface NowPlayingOptions {
  limit?: number;
  offset?: number;
  /** Number of days to look back (default: 30) */
  daysBack?: number;
  /** Sort order (default: popularity) */
  sort?: CatalogSort;
  order?: SortOrder;
  genres?: string[];
  minRatingo?: number;
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
}

/**
 * Movie details - full information for detail page.
 */
export interface MovieDetails {
  id: string;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  ingestionStatus: IngestionStatus;
  poster: ImageData | null;
  backdrop: ImageData | null;
  releaseDate: Date | null;
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  videos: VideoData[] | null;
  primaryTrailer: VideoData | null;
  credits: CreditsData | null;
  availability: AvailabilityData | null;

  runtime: number | null;
  budget: number | null;
  revenue: number | null;
  status: MovieStatus | null;

  stats: RatingoStats;
  externalRatings: ExternalRatings;
  genres: GenreInfo[];

  card?: CardMeta;
}

/**
 * Abstract interface for Movie-specific storage operations.
 */
export interface IMovieRepository {
  /**
   * Finds movies currently in theaters (isNowPlaying = true).
   */
  findNowPlaying(options?: NowPlayingOptions): Promise<WithTotal<MovieWithMedia>>;

  /**
   * Finds movies recently released in theaters.
   */
  findNewReleases(options?: NowPlayingOptions): Promise<WithTotal<MovieWithMedia>>;

  /**
   * Finds movies recently released on digital platforms.
   */
  findNewOnDigital(options?: NowPlayingOptions): Promise<WithTotal<MovieWithMedia>>;

  /**
   * Finds trending movies sorted by popularity and rating.
   */
  findTrending(options: NowPlayingOptions): Promise<WithTotal<TrendingMovieItem>>;

  /**
   * Sets isNowPlaying flag for movies.
   */
  setNowPlaying(tmdbIds: number[]): Promise<void>;

  /**
   * Updates release dates for a movie.
   */
  updateReleaseDates(
    mediaItemId: string,
    data: {
      theatricalReleaseDate?: Date | null;
      digitalReleaseDate?: Date | null;
      releases?: ReleaseInfo[];
    },
  ): Promise<void>;

  /**
   * Upserts movie details transactionally.
   */
  upsertDetails(
    tx: DatabaseTransaction,
    mediaId: string,
    details: {
      runtime?: number | null;
      budget?: number | null;
      revenue?: number | null;
      status?: string | null;
      theatricalReleaseDate?: Date | null;
      digitalReleaseDate?: Date | null;
      releases?: ReleaseInfo[];
    },
  ): Promise<void>;

  /**
   * Finds full movie details by slug.
   */
  findBySlug(slug: string): Promise<MovieDetails | null>;
}

/**
 * Injection token for the Movie repository.
 */
export const MOVIE_REPOSITORY = Symbol('MOVIE_REPOSITORY');
