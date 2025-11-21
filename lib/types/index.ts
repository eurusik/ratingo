import type { Show } from '@/db/schema';
// TMDB API Types
export interface TMDBTrendingResponse {
  page: number;
  results: TMDBShow[];
  total_pages: number;
  total_results: number;
}

export type TMDBRecommendationsResponse = TMDBTrendingResponse;

export interface TMDBShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  origin_country: string[];
  original_language: string;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBVideo {
  id: string;
  iso_639_1: string;
  iso_3166_1: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TMDBVideosResponse {
  id: number;
  results: TMDBVideo[];
}

export interface TMDBShowDetails extends TMDBShow {
  created_by: Array<{
    id: number;
    name: string;
  }>;
  episode_run_time: number[];
  genres: Array<{
    id: number;
    name: string;
  }>;
  homepage: string;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: {
    id: number;
    name: string;
    overview: string;
    air_date: string;
    episode_number: number;
    season_number: number;
  } | null;
  next_episode_to_air?: {
    id: number;
    name: string;
    overview: string;
    air_date: string;
    episode_number: number;
    season_number: number;
  } | null;
  networks: Array<{
    id: number;
    name: string;
    logo_path: string;
    origin_country: string;
  }>;
  number_of_episodes: number;
  number_of_seasons: number;
  production_companies: Array<{
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }>;
  seasons: Array<{
    id: number;
    air_date: string;
    episode_count: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
  }>;
  status: string;
  tagline: string;
  type: string;
}

/**
 * Детальні дані фільму з TMDB: заголовок, опис, постери,
 * рейтинги, популярність, дата релізу, тривалість, статус,
 * слоган та жанри.
 */
export interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  release_date: string | null;
  runtime: number | null;
  status: string | null;
  tagline: string | null;
  genres: Array<{ id: number; name: string }> | null;
}

export interface TMDBMovieTranslation {
  titleUk: string | null;
  overviewUk: string | null;
  posterUk: string | null;
}

export interface TMDBShowTranslation {
  titleUk: string | null;
  overviewUk: string | null;
  posterUk: string | null;
}

export interface TMDBExternalIds {
  imdb_id?: string | null;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character?: string | null;
  profile_path?: string | null;
  order?: number | null;
}

export interface WatchProvider {
  id: number;
  name: string;
  logo_path: string | null;
  region: string;
  category: string;
  rank: number | null;
  link: string | null;
}

export interface BackfillOmdbStats {
  processed: number;
  updatedRows: number;
  imdbRatingUpdated: number;
  imdbVotesUpdated: number;
  metacriticUpdated: number;
  missingImdbId: number;
  errors: number;
}

/**
 * Зведена статистика бекфілу метаданих для серіалів:
 * скільки рядків оброблено/оновлено та по категоріях заповнення.
 */
export interface BackfillShowsMetaStats {
  processed: number;
  updatedRows: number;
  videosFilled: number;
  videosStillMissing: number;
  providersFilled: number;
  providersStillMissing: number;
  backdropFilled: number;
  genresFilled: number;
  firstAirDateFilled: number;
  numberOfSeasonsFilled: number;
  numberOfEpisodesFilled: number;
  statusFilled: number;
  taglineFilled: number;
  contentRatingFilled: number;
  errors: number;
}

/**
 * Зведена статистика бекфілу метаданих для фільмів:
 * скільки рядків оброблено/оновлено та по категоріях заповнення.
 */
export interface BackfillMoviesMetaStats {
  processed: number;
  updatedRows: number;
  videosFilled: number;
  videosStillMissing: number;
  providersFilled: number;
  providersStillMissing: number;
  backdropFilled: number;
  genresFilled: number;
  releaseDateFilled: number;
  runtimeFilled: number;
  statusFilled: number;
  taglineFilled: number;
  errors: number;
}

// Trakt API Types
export interface TraktTrendingShow {
  watchers: number;
  show: TraktShow;
}

export interface TraktShow {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    tvdb: number;
    imdb: string;
    tmdb: number;
  };
}

export type TraktRelatedShow = TraktShow;

export interface TraktMovieData {
  watchers?: number;
  movie: {
    ids: { tmdb: number };
    title?: string | null;
    [key: string]: any;
  };
}

// Application Types
export interface ShowWithDetails {
  id: number;
  tmdbId: number;
  imdbId: string | null;
  title: string;
  overview: string | null;
  poster: string | null;
  posterUrl?: string | null;
  backdrop?: string | null;
  backdropUrl?: string | null;
  ratingTmdb: number | null;
  ratingTrakt: number | null;
  trendingScore: number | null;
  updatedAt: Date;
  videos?: TMDBVideo[];
  genres?: Array<{ id: number; name: string }>;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  status?: string;
  firstAirDate?: string;
  lastAirDate?: string;
  tagline?: string;
}

export interface SyncResult {
  success: boolean;
  updated: number;
  added: number;
  timestamp: string;
  errors?: string[];
}

// UI types
export type ShowWithUrl = Show & { posterUrl: string | null };

export interface AiringItem {
  id: number;
  tmdbId: number;
  showId: number | null;
  title: string | null;
  episodeTitle: string | null;
  season: number | null;
  episode: number | null;
  airDate: string | null;
  airDateTs?: number | null;
  network: string | null;
  type: string | null;
  show?: { id: number; tmdbId: number; title: string; poster: string | null } | null;
}
