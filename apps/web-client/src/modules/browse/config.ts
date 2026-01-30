/**
 * Browse categories configuration.
 * Single source of truth for all browse pages.
 *
 * API Structure:
 * - /api/catalog/movies/trending
 * - /api/catalog/movies/now-playing
 * - /api/catalog/movies/new-releases
 * - /api/catalog/movies/new-on-digital
 * - /api/catalog/shows/trending
 * - /api/catalog/search
 */

import type { Route } from 'next';

export type BrowseCategory =
  | 'shows-trending' // Shows trending
  | 'shows-popular' // Shows popular (hits)
  | 'movies-trending' // Movies trending
  | 'movies-popular' // Movies popular (hits)
  | 'movies-now-playing' // Movies in theaters
  | 'movies-new-releases' // Movies recently released
  | 'movies-digital' // Movies new on digital
  | 'shows' // All shows (trending)
  | 'movies'; // All movies (trending)

export type PoolType = 'trending' | 'popular';

export const CATALOG_SORT = {
  RATINGO: 'ratingo',
  RELEASE_DATE: 'releaseDate',
} as const;

export type CatalogSort = (typeof CATALOG_SORT)[keyof typeof CATALOG_SORT];

export const CATALOG_SORT_OPTIONS = [CATALOG_SORT.RATINGO, CATALOG_SORT.RELEASE_DATE] as const;

export const DEFAULT_CATALOG_SORT = CATALOG_SORT.RATINGO;

export interface CategoryConfig {
  /** URL slug */
  slug: BrowseCategory;
  /** i18n key for title */
  titleKey: string;
  /** i18n key for description (SEO) */
  descriptionKey: string;
  /** API method name in catalogApi */
  apiMethod:
    | 'getTrendingShows'
    | 'getPopularShows'
    | 'getTrendingMovies'
    | 'getPopularMovies'
    | 'getNowPlayingMovies'
    | 'getNewReleasesMovies'
    | 'getNewOnDigitalMovies';
  /** Media type for card rendering */
  mediaType: 'movie' | 'show';
  /** Items per page */
  pageSize: number;
  /** Pool type (trending or popular) - if set, shows pool selector */
  pool?: PoolType;
  /** Counterpart category for pool switching */
  poolCounterpart?: BrowseCategory;
}

/**
 * Category configurations.
 * Easy to extend with new categories.
 */
export const BROWSE_CATEGORIES: Record<BrowseCategory, CategoryConfig> = {
  // Shows
  'shows-trending': {
    slug: 'shows-trending',
    titleKey: 'browse.showsTrending.title',
    descriptionKey: 'browse.showsTrending.description',
    apiMethod: 'getTrendingShows',
    mediaType: 'show',
    pageSize: 24,
    pool: 'trending',
    poolCounterpart: 'shows-popular',
  },
  'shows-popular': {
    slug: 'shows-popular',
    titleKey: 'browse.showsPopular.title',
    descriptionKey: 'browse.showsPopular.description',
    apiMethod: 'getPopularShows',
    mediaType: 'show',
    pageSize: 24,
    pool: 'popular',
    poolCounterpart: 'shows-trending',
  },
  shows: {
    slug: 'shows',
    titleKey: 'browse.shows.title',
    descriptionKey: 'browse.shows.description',
    apiMethod: 'getTrendingShows',
    mediaType: 'show',
    pageSize: 24,
  },

  // Movies
  movies: {
    slug: 'movies',
    titleKey: 'browse.movies.title',
    descriptionKey: 'browse.movies.description',
    apiMethod: 'getTrendingMovies',
    mediaType: 'movie',
    pageSize: 24,
  },
  'movies-trending': {
    slug: 'movies-trending',
    titleKey: 'browse.moviesTrending.title',
    descriptionKey: 'browse.moviesTrending.description',
    apiMethod: 'getTrendingMovies',
    mediaType: 'movie',
    pageSize: 24,
    pool: 'trending',
    poolCounterpart: 'movies-popular',
  },
  'movies-popular': {
    slug: 'movies-popular',
    titleKey: 'browse.moviesPopular.title',
    descriptionKey: 'browse.moviesPopular.description',
    apiMethod: 'getPopularMovies',
    mediaType: 'movie',
    pageSize: 24,
    pool: 'popular',
    poolCounterpart: 'movies-trending',
  },
  'movies-now-playing': {
    slug: 'movies-now-playing',
    titleKey: 'browse.moviesNowPlaying.title',
    descriptionKey: 'browse.moviesNowPlaying.description',
    apiMethod: 'getNowPlayingMovies',
    mediaType: 'movie',
    pageSize: 24,
  },
  'movies-new-releases': {
    slug: 'movies-new-releases',
    titleKey: 'browse.moviesNewReleases.title',
    descriptionKey: 'browse.moviesNewReleases.description',
    apiMethod: 'getNewReleasesMovies',
    mediaType: 'movie',
    pageSize: 24,
  },
  'movies-digital': {
    slug: 'movies-digital',
    titleKey: 'browse.moviesDigital.title',
    descriptionKey: 'browse.moviesDigital.description',
    apiMethod: 'getNewOnDigitalMovies',
    mediaType: 'movie',
    pageSize: 24,
  },
};

/**
 * API methods that support sort/filter parameters.
 */
const FILTERABLE_API_METHODS = [
  'getTrendingShows',
  'getPopularShows',
  'getTrendingMovies',
  'getPopularMovies',
] as const;

/**
 * Check if category supports filters (sort, year, etc).
 */
export function categorySupportsFilters(config: CategoryConfig): boolean {
  return (FILTERABLE_API_METHODS as readonly string[]).includes(config.apiMethod);
}

/**
 * Check if category has pool selector (trending/popular toggle).
 */
export function categoryHasPoolSelector(config: CategoryConfig): boolean {
  return config.pool !== undefined && config.poolCounterpart !== undefined;
}

/**
 * Get category config by slug.
 */
export function getCategoryConfig(slug: string): CategoryConfig | null {
  return BROWSE_CATEGORIES[slug as BrowseCategory] ?? null;
}

/**
 * Get all valid category slugs.
 */
export function getValidCategorySlugs(): BrowseCategory[] {
  return Object.keys(BROWSE_CATEGORIES) as BrowseCategory[];
}

/**
 * Build browse page URL.
 */
export function buildBrowseUrl(category: BrowseCategory, page?: number): Route {
  const base = `/browse/${category}`;
  return (page && page > 1 ? `${base}?page=${page}` : base) as Route;
}
