import type { Show } from '@/db/schema';
// TMDB API Types
export interface TMDBTrendingResponse {
  page: number;
  results: TMDBShow[];
  total_pages: number;
  total_results: number;
}

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
