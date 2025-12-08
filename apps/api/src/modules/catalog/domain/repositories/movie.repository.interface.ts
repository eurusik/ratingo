import { ReleaseInfo } from '../../../../database/schema';

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
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
  rating: number;
  voteCount: number;
  releaseDate: Date | null;
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  runtime: number | null;
  // Scores
  ratingoScore: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
}

/**
 * Options for now playing query.
 */
export interface NowPlayingOptions {
  limit?: number;
  offset?: number;
  /** Number of days to look back (default: 30) */
  daysBack?: number;
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
    }
  ): Promise<void>;
}

export const MOVIE_REPOSITORY = Symbol('MOVIE_REPOSITORY');
