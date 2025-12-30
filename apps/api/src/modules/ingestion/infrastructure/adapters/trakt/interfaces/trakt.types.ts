export interface EpisodeData {
  number: number;
  title: string;
  rating: number;
  votes: number;
}

export interface SeasonData {
  number: number;
  episodes?: EpisodeData[];
  episode_count?: number;
}

/**
 * Media type literals for Trakt API.
 */
export type TraktMediaType = 'movie' | 'show';

/**
 * Media type constants.
 */
export const TRAKT_MEDIA_TYPE = {
  MOVIE: 'movie' as const,
  SHOW: 'show' as const,
};

/**
 * Endpoint type literals for Trakt API.
 */
export type TraktEndpoint = 'movies' | 'shows';

/**
 * Endpoint constants.
 */
export const TRAKT_ENDPOINT = {
  MOVIES: 'movies' as const,
  SHOWS: 'shows' as const,
};

/**
 * Trakt IDs object.
 */
export interface TraktIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
}

/**
 * Trakt movie object (minimal).
 */
export interface TraktMovie {
  title?: string;
  year?: number;
  ids: TraktIds;
}

/**
 * Trakt show object (minimal).
 */
export interface TraktShow {
  title?: string;
  year?: number;
  ids: TraktIds;
}

/**
 * Trending movie item from /movies/trending.
 */
export interface TraktTrendingMovie {
  watchers: number;
  movie: TraktMovie;
}

/**
 * Trending show item from /shows/trending.
 */
export interface TraktTrendingShow {
  watchers: number;
  show: TraktShow;
}

/**
 * Search result item for movie.
 */
export interface TraktSearchMovieResult {
  type: 'movie';
  score: number;
  movie: TraktMovie;
}

/**
 * Search result item for show.
 */
export interface TraktSearchShowResult {
  type: 'show';
  score: number;
  show: TraktShow;
}

/**
 * User watching item (from /watching endpoint).
 */
export interface TraktWatchingUser {
  username: string;
}

/**
 * Ratings response.
 */
export interface TraktRatingsResponse {
  rating: number;
  votes: number;
  distribution?: Record<string, number>;
}

/**
 * Stats response.
 */
export interface TraktStatsResponse {
  watchers: number;
  plays: number;
  collectors?: number;
  comments?: number;
  lists?: number;
  votes: number;
}
