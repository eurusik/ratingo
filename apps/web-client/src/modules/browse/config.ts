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
  | 'trending'           // Shows trending (main)
  | 'movies-trending'    // Movies trending
  | 'movies-now-playing' // Movies in theaters
  | 'movies-new-releases'// Movies recently released
  | 'movies-digital'     // Movies new on digital
  | 'shows'              // All shows (trending)
  | 'movies';            // All movies (trending)

export interface CategoryConfig {
  /** URL slug */
  slug: BrowseCategory;
  /** i18n key for title */
  titleKey: string;
  /** i18n key for description (SEO) */
  descriptionKey: string;
  /** API method name in catalogApi */
  apiMethod: 'getTrendingShows' | 'getTrendingMovies' | 'getNowPlayingMovies' | 'getNewReleasesMovies' | 'getNewOnDigitalMovies';
  /** Media type for card rendering */
  mediaType: 'movie' | 'show';
  /** Items per page */
  pageSize: number;
}

/**
 * Category configurations.
 * Easy to extend with new categories.
 */
export const BROWSE_CATEGORIES: Record<BrowseCategory, CategoryConfig> = {
  // Shows
  trending: {
    slug: 'trending',
    titleKey: 'browse.trending.title',
    descriptionKey: 'browse.trending.description',
    apiMethod: 'getTrendingShows',
    mediaType: 'show',
    pageSize: 24,
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
