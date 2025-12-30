import type { ImageData, ExternalRatings } from '../../../../common/types';

/**
 * Media type for rise/fall items.
 */
export type RiseFallMediaType = 'movie' | 'show';

/**
 * Statistics for a media item's watcher movement.
 */
export type RiseFallStats = {
  /** Absolute change in watchers count (current window growth - previous window growth) */
  deltaWatchers: number;
  /** Percentage change relative to previous window growth */
  deltaPercent: number | null;
  /** Current total watchers count */
  currentWatchers: number;
  /** Watchers added in the current window */
  growthCurrent: number;
  /** Watchers added in the previous window */
  growthPrev: number;
  /** Item is new to trends (no previous history) */
  isNewInTrends?: boolean;
};

/**
 * Domain model for a media item in rise/fall rankings.
 */
export type RiseFallItem = {
  id: string;
  mediaItemId: string;
  type: RiseFallMediaType;
  slug: string;
  title: string;
  originalTitle: string | null;
  poster: ImageData | null;
  backdrop: ImageData | null;
  stats: RiseFallStats;
  externalRatings?: ExternalRatings;
};
