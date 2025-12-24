/**
 * TMDB API Response Types
 *
 * Type definitions for TMDB API responses to avoid 'any' types in mappers.
 * These are partial types - only fields we actually use are defined.
 */

/**
 * Production country object from TMDB API
 */
export interface TmdbProductionCountry {
  iso_3166_1: string; // ISO 3166-1 alpha-2 country code
  name: string;
}

/**
 * Genre object from TMDB API
 */
export interface TmdbGenre {
  id: number;
  name: string;
}

/**
 * Video object from TMDB API
 */
export interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  iso_639_1: string; // Language code
  iso_3166_1: string; // Country code
  published_at: string;
}

/**
 * Cast member from TMDB API
 */
export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  order?: number;
  roles?: Array<{ character: string }>; // For TV shows (aggregate_credits)
}

/**
 * Crew member from TMDB API
 */
export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department?: string;
  profile_path: string | null;
}

/**
 * Credits object from TMDB API
 */
export interface TmdbCredits {
  cast?: TmdbCastMember[];
  crew?: TmdbCrewMember[];
}

/**
 * Watch provider object from TMDB API
 */
export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}

/**
 * Watch provider region data from TMDB API
 */
export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
}

/**
 * Release date object from TMDB API
 */
export interface TmdbReleaseDate {
  type: number; // 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
  release_date: string;
  certification?: string;
}

/**
 * Release dates by country from TMDB API
 */
export interface TmdbReleaseDatesCountry {
  iso_3166_1: string;
  release_dates: TmdbReleaseDate[];
}

/**
 * Season object from TMDB API
 */
export interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
}

/**
 * Creator object from TMDB API (TV shows)
 */
export interface TmdbCreator {
  id: number;
  name: string;
  profile_path: string | null;
}

/**
 * External IDs from TMDB API
 */
export interface TmdbExternalIds {
  imdb_id?: string | null;
  tvdb_id?: number | null;
  freebase_id?: string | null;
}

/**
 * Base TMDB API response (common fields for movies and TV shows)
 */
export interface TmdbBaseResponse {
  id: number;
  adult: boolean;
  backdrop_path: string | null;
  poster_path: string | null;
  overview: string;
  original_language: string; // ISO 639-1 code
  popularity: number;
  vote_average: number;
  vote_count: number;
  genres?: TmdbGenre[];
  videos?: {
    results: TmdbVideo[];
  };
  credits?: TmdbCredits;
  aggregate_credits?: TmdbCredits; // For TV shows
  external_ids?: TmdbExternalIds;
  'watch/providers'?: {
    results: Record<string, TmdbWatchProviderRegion>;
  };
}

/**
 * TMDB Movie API response
 */
export interface TmdbMovieResponse extends TmdbBaseResponse {
  title: string;
  original_title: string;
  release_date: string | null;
  runtime: number | null;
  budget: number;
  revenue: number;
  status: string;
  imdb_id?: string | null;
  production_countries?: TmdbProductionCountry[];
  release_dates?: {
    results: TmdbReleaseDatesCountry[];
  };
}

/**
 * TMDB TV Show API response
 */
export interface TmdbShowResponse extends TmdbBaseResponse {
  name: string;
  original_name: string;
  first_air_date: string | null;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  origin_country: string[]; // Array of ISO 3166-1 alpha-2 codes
  created_by?: TmdbCreator[];
  seasons?: TmdbSeason[];
}

/**
 * Union type for TMDB API responses
 */
export type TmdbMediaResponse = TmdbMovieResponse | TmdbShowResponse;
