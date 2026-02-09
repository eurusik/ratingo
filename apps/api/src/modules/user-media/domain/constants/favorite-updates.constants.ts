/**
 * Default options for the "Updates for Your Favorites" section.
 *
 * Only shows rated at or above the threshold are included.
 * Episodes within the lookback/lookahead windows qualify as "recent" or "upcoming".
 */

/** Minimum user rating (0-100) for a show to appear in favorites updates. */
export const FAVORITE_UPDATES_RATING_THRESHOLD = 60;

/** How many days back to look for recently aired episodes. */
export const FAVORITE_UPDATES_DAYS_BACK = 14;

/** How many days ahead to look for upcoming episodes. */
export const FAVORITE_UPDATES_DAYS_AHEAD = 30;

/** Maximum number of favorite update items to return. */
export const FAVORITE_UPDATES_LIMIT = 10;
