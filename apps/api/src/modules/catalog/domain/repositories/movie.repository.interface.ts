import { ReleaseInfo, Video } from '../../../../database/schema';
import { CreditsDto, ImageDto, AvailabilityDto } from '../../presentation/dtos/common.dto';
import { MovieStatus } from '../../../../common/enums/movie-status.enum';
import {
  CatalogListQueryDto,
  CatalogSort,
  SortOrder,
  VoteSource,
} from '../../presentation/dtos/catalog-list-query.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

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
  poster?: ImageDto | null;
  backdrop?: ImageDto | null;
  popularity: number;
  releaseDate: Date | null;
  videos?: Video[] | null;

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

  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  runtime: number | null;

  genres: Array<{ id: string; name: string; slug: string }>;
}

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
 * Movie details.
 */
export interface MovieDetails {
  id: string;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  ingestionStatus: IngestionStatus;
  poster?: ImageDto | null;
  backdrop?: ImageDto | null;
  releaseDate: Date | null;
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

  runtime: number | null;
  budget: number | null;
  revenue: number | null;
  status: MovieStatus | null;

  genres: Array<{ id: string; name: string; slug: string }>;
}

/**
 * Abstract interface for Movie-specific storage operations.
 */
export interface IMovieRepository {
  /**
   * Finds movies currently in theaters (isNowPlaying = true).
   * Data is synced from TMDB /movie/now_playing endpoint.
   */
  findNowPlaying(options?: NowPlayingOptions): Promise<MovieWithMedia[]>;

  /**
   * Finds movies recently released in theaters.
   * Uses theatricalReleaseDate within the specified period.
   */
  findNewReleases(options?: NowPlayingOptions): Promise<MovieWithMedia[]>;

  /**
   * Finds movies recently released on digital platforms.
   * Returns movies with digital release in the last N days.
   */
  findNewOnDigital(options?: NowPlayingOptions): Promise<MovieWithMedia[]>;

  /**
   * Finds trending movies sorted by popularity and rating.
   */
  findTrending(options: CatalogListQueryDto): Promise<any[]>;

  /**
   * Sets isNowPlaying flag for movies.
   * Called by SYNC_NOW_PLAYING job.
   *
   * @param tmdbIds - TMDB IDs of movies currently playing
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
    tx: any,
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

export const MOVIE_REPOSITORY = Symbol('MOVIE_REPOSITORY');
