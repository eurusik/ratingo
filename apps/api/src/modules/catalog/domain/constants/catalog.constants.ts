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
 * Freshness score floor (minimum value for very old content).
 * Matches score.config.ts freshnessMinFloor * 100.
 */
export const FRESHNESS_FLOOR = 20;

/**
 * List context for freshness filtering.
 * - home: stricter freshness (exclude floor/classics)
 * - catalog: permissive (show all eligible content)
 */
export const LIST_CONTEXT = {
  HOME: 'home',
  CATALOG: 'catalog',
} as const;

/**
 * Popular pool thresholds.
 * Used for "Hits" tab - historically popular content without freshness gate.
 */
export const POPULAR_THRESHOLDS = {
  /** Minimum total watchers for movies to appear in popular */
  MIN_TOTAL_WATCHERS_MOVIES: 5000,
  /** Minimum total watchers for shows to appear in popular */
  MIN_TOTAL_WATCHERS_SHOWS: 5000,
} as const;

/**
 * Trending algorithm thresholds.
 */
export const TRENDING_THRESHOLDS = {
  /** Minimum freshness score to appear in trending (strict) */
  MIN_FRESHNESS: 50,
  /** Minimum freshness score for popularity sort (softer, ~3-4 year old content ok) */
  MIN_FRESHNESS_POPULARITY: 30,
  /** Minimum live watchers for shows to appear in trending (strong live signal) */
  MIN_WATCHERS_SHOWS: 10,
  /** Minimum live watchers for movies to appear in trending (weaker live signal) */
  MIN_WATCHERS_MOVIES: 2,
} as const;

/**
 * Context-based freshness thresholds.
 * Used to filter content based on where it's displayed.
 */
export const CONTEXT_FRESHNESS = {
  /**
   * Home context: stricter filtering to exclude finished classics.
   * ratingo: > FRESHNESS_FLOOR (exclude floor)
   */
  home: {
    trending: TRENDING_THRESHOLDS.MIN_FRESHNESS,
    popularity: TRENDING_THRESHOLDS.MIN_FRESHNESS_POPULARITY,
    ratingo: FRESHNESS_FLOOR + 1, // > floor, exclude classics
    releaseDate: 0,
    tmdbPopularity: 0,
  },
  /**
   * Catalog context: permissive, show all eligible content.
   * Trending uses softer threshold (~7 months) to include quality older releases.
   */
  catalog: {
    trending: TRENDING_THRESHOLDS.MIN_FRESHNESS_POPULARITY,
    popularity: TRENDING_THRESHOLDS.MIN_FRESHNESS_POPULARITY,
    ratingo: 0, // no gate - show classics
    releaseDate: 0,
    tmdbPopularity: 0,
  },
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
 * Fallback formula for items without live watchers data.
 * Uses total_watchers (historical) with log compression.
 *
 * When watchers_count = 0 but total_watchers has data, we use:
 * LEAST(LN(1 + total_watchers) * LOG_MULTIPLIER, MAX_SIGNAL)
 *
 * Examples:
 * - total_watchers = 100    → 13.8
 * - total_watchers = 1,000  → 20.7
 * - total_watchers = 10,000 → 25 (capped)
 * - total_watchers = 100,000 → 25 (capped)
 */
export const WATCHERS_FALLBACK = {
  /** Multiplier for log-compressed total_watchers */
  LOG_MULTIPLIER: 3,
  /** Maximum signal value for fallback (25/100 scale) */
  MAX_SIGNAL: 25,
} as const;

/**
 * Hero block thresholds.
 * Used for selecting high-quality content for homepage hero section.
 */
export const HERO_THRESHOLDS = {
  /** Minimum quality score to appear in hero */
  MIN_QUALITY_SCORE: 60,
  /** Minimum popularity score to appear in hero (strict pass) */
  MIN_POPULARITY_SCORE: 40,
  /** Minimum popularity score for fallback pass (relaxed) */
  MIN_POPULARITY_SCORE_FALLBACK: 25,
  /** Days since release to be considered "new" in hero */
  NEW_RELEASE_DAYS: 90,
  /** Years since release to be considered "classic" in hero */
  CLASSIC_YEARS: 5,
  /**
   * Maximum days since last episode for shows to appear in Hero.
   * Shows pass if: lastAirDate ≤ 90 days OR nextAirDate exists.
   * This allows shows between seasons (with announced next episode) to stay in Hero.
   * Excludes finished/dormant shows that are just being rewatched.
   */
  MAX_DAYS_SINCE_LAST_EPISODE: 90,
  /**
   * Buffer for fallback query to account for potential duplicates.
   * Fetches (remaining + buffer) items, then slices to exact count.
   */
  FALLBACK_BUFFER: 2,
} as const;

/**
 * "Watching Now" (Зараз дивляться) thresholds.
 * Used for the Top-3 live watchers block on homepage.
 *
 * Shows FRESH content with active live watchers - excludes "eternal" shows
 * like Friends that are always being watched but aren't new/relevant.
 */
export const WATCHING_NOW_THRESHOLDS = {
  /** Maximum days since movie release to be considered "fresh" (30-60 days) */
  MAX_DAYS_SINCE_MOVIE_RELEASE: 45,
  /** Maximum days since last episode for shows (14-30 days) */
  MAX_DAYS_SINCE_SHOW_EPISODE: 21,
  /** Minimum live watchers required (strong signal of actual viewing) */
  MIN_WATCHERS: 1,
  /** Minimum quality score (sanity check) */
  MIN_QUALITY_SCORE: 50,
} as const;
