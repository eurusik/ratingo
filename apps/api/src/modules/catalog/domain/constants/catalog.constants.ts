/**
 * Domain constants for catalog module.
 * Centralized thresholds and configuration values.
 */

/**
 * Search configuration constants.
 */
export const SEARCH_CONFIG = {
  /** Maximum number of results to return per source */
  RESULTS_LIMIT: 10,
  /** Minimum query length to trigger search */
  MIN_QUERY_LENGTH: 2,
} as const;

/**
 * Slug generation configuration.
 */
export const SLUG_CONFIG = {
  LOWER: true,
  STRICT: true,
  LOCALE: 'uk',
} as const;

/**
 * Thresholds for determining "classic" media status.
 */
export const CLASSIC_THRESHOLDS = {
  /** Minimum ratingo score to be considered a classic */
  RATINGO_SCORE: 80,
  /** Minimum total watchers to be considered a classic */
  TOTAL_WATCHERS: 10_000,
  /** Years since release to be considered classic by age */
  YEARS_OLD: 10,
} as const;

/**
 * Thresholds for determining "new release" status.
 */
export const NEW_RELEASE_THRESHOLDS = {
  /** Days since release to be considered new */
  DAYS: 60,
} as const;

/**
 * Trending algorithm thresholds.
 */
export const TRENDING_THRESHOLDS = {
  /** Minimum freshness score to appear in trending */
  MIN_FRESHNESS: 50,
  /** Minimum live watchers to appear in trending */
  MIN_WATCHERS: 10,
} as const;

/**
 * Trending formula weights for movies.
 * Movies are consumed differently: one-time viewing, short spikes.
 */
export const MOVIE_TRENDING_WEIGHTS = {
  /** Ratingo score weight (quality + popularity + freshness) */
  RATINGO: 0.6,
  /** Popularity score weight (mass appeal) */
  POPULARITY: 0.25,
  /** Live watchers weight with soft saturation */
  WATCHERS: 0.1,
  /** TMDB trending signal weight */
  TMDB: 0.05,
  /** Saturation constant for watchers curve */
  WATCHERS_SATURATION_K: 300,
} as const;

/**
 * Trending formula weights for shows.
 * Shows have ongoing engagement patterns.
 */
export const SHOW_TRENDING_WEIGHTS = {
  /** Ratingo score weight */
  RATINGO: 0.5,
  /** Popularity score weight */
  POPULARITY: 0.25,
  /** Live watchers weight */
  WATCHERS: 0.15,
  /** TMDB trending signal weight */
  TMDB: 0.1,
  /** Saturation constant for watchers curve */
  WATCHERS_SATURATION_K: 100,
} as const;

/**
 * Hero block thresholds.
 * Used for selecting high-quality content for homepage hero section.
 */
export const HERO_THRESHOLDS = {
  /** Minimum quality score to appear in hero */
  MIN_QUALITY_SCORE: 60,
  /** Minimum popularity score to appear in hero */
  MIN_POPULARITY_SCORE: 40,
  /** Days since release to be considered "new" in hero */
  NEW_RELEASE_DAYS: 90,
  /** Years since release to be considered "classic" in hero */
  CLASSIC_YEARS: 5,
} as const;
