/**
 * Home module constants.
 */

/**
 * Hero block configuration.
 */
export const HERO_CONFIG = {
  /** Default number of items to display in hero block */
  DEFAULT_LIMIT: 4,
} as const;

/**
 * "Watching Now" (Зараз дивляться) block configuration.
 * Shows Top-3 items with most live watchers among FRESH content only.
 */
export const WATCHING_NOW_CONFIG = {
  /**
   * Number of items to fetch from DB.
   * Fetch more than needed (6) because frontend filters out hero duplicates.
   * After filtering, at least 3 unique items should remain for display.
   */
  DEFAULT_LIMIT: 6,
} as const;
