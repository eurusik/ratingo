/**
 * Creates deterministic hash for batch query key.
 * Sorts IDs ascending, dedupes, joins with comma separator.
 *
 * @param mediaItemIds - Array of media item IDs
 * @returns Deterministic hash string
 *
 * @example
 * createBatchHash(['c', 'a', 'b', 'a']) // Returns 'a,b,c'
 */
export function createBatchHash(mediaItemIds: string[]): string {
  return [...new Set(mediaItemIds)].sort().join(',');
}

/**
 * Query key factory for TanStack Query.
 *
 * Centralizes all query keys for consistent cache management.
 * Uses nested structure for fine-grained cache invalidation.
 *
 * All query key functions use primitive values only (string, number, null)
 * to ensure predictable cache hits. Undefined values are normalized to null.
 *
 * @example
 * // Invalidate all shows queries
 * queryClient.invalidateQueries({ queryKey: queryKeys.shows.all });
 *
 * // Invalidate specific show
 * queryClient.invalidateQueries({ queryKey: queryKeys.shows.detail('breaking-bad') });
 */
export const queryKeys = {
  /** Shows queries. */
  shows: {
    all: ['shows'] as const,
    trending: (limit?: number, offset?: number, sort?: string) =>
      [...queryKeys.shows.all, 'trending', limit ?? null, offset ?? null, sort ?? null] as const,
    detail: (slug: string) => [...queryKeys.shows.all, 'detail', slug] as const,
    calendar: (startDate?: string, days?: number) =>
      [...queryKeys.shows.all, 'calendar', startDate ?? null, days ?? null] as const,
  },

  /** Movies queries. */
  movies: {
    all: ['movies'] as const,
    trending: (limit?: number, offset?: number, sort?: string) =>
      [...queryKeys.movies.all, 'trending', limit ?? null, offset ?? null, sort ?? null] as const,
    nowPlaying: (limit?: number, offset?: number) =>
      [...queryKeys.movies.all, 'now-playing', limit ?? null, offset ?? null] as const,
    newReleases: (limit?: number, offset?: number) =>
      [...queryKeys.movies.all, 'new-releases', limit ?? null, offset ?? null] as const,
    detail: (slug: string) => [...queryKeys.movies.all, 'detail', slug] as const,
  },

  /** Catalog-wide queries. */
  catalog: {
    providers: ['catalog', 'providers'] as const,
  },

  /** Home page queries. */
  home: {
    hero: (type?: string) => ['home', 'hero', type ?? null] as const,
  },

  /** Search queries. */
  search: {
    results: (query: string) => ['search', query] as const,
  },

  /** Insights queries. */
  insights: {
    movements: (window?: string, limit?: number) =>
      ['insights', 'movements', window ?? null, limit ?? null] as const,
  },

  /** Auth queries. */
  auth: {
    me: ['auth', 'me'] as const,
  },

  /** User media state queries. */
  userMedia: {
    all: ['user-media'] as const,
    state: (mediaId: string) => [...queryKeys.userMedia.all, 'state', mediaId] as const,
    myRatings: (limit?: number, offset?: number) =>
      [...queryKeys.userMedia.all, 'my-ratings', limit ?? null, offset ?? null] as const,
    myWatchlist: (limit?: number, offset?: number) =>
      [...queryKeys.userMedia.all, 'my-watchlist', limit ?? null, offset ?? null] as const,
  },

  /** Public user queries. */
  users: {
    profile: (username: string) => ['users', username] as const,
    ratings: (username: string, limit?: number, offset?: number) =>
      ['users', username, 'ratings', limit ?? null, offset ?? null] as const,
  },

  /** User actions (saved items, subscriptions). */
  userActions: {
    all: ['user-actions'] as const,
    savedItems: {
      all: ['user-actions', 'saved-items'] as const,
      status: (mediaItemId: string) =>
        [...queryKeys.userActions.savedItems.all, 'status', mediaItemId] as const,
      batch: (mediaIdsHash: string) =>
        [...queryKeys.userActions.savedItems.all, 'batch', mediaIdsHash] as const,
      list: (list: string, limit?: number, offset?: number) =>
        [
          ...queryKeys.userActions.savedItems.all,
          'list',
          list,
          limit ?? null,
          offset ?? null,
        ] as const,
    },
    subscriptions: {
      all: ['user-actions', 'subscriptions'] as const,
      status: (mediaItemId: string) =>
        [...queryKeys.userActions.subscriptions.all, 'status', mediaItemId] as const,
      list: (limit?: number, offset?: number) =>
        [
          ...queryKeys.userActions.subscriptions.all,
          'list',
          limit ?? null,
          offset ?? null,
        ] as const,
    },
    notifications: {
      all: ['user-actions', 'notifications'] as const,
      list: (limit?: number, offset?: number) =>
        [
          ...queryKeys.userActions.notifications.all,
          'list',
          limit ?? null,
          offset ?? null,
        ] as const,
      unreadCount: () => [...queryKeys.userActions.notifications.all, 'unread-count'] as const,
    },
  },

  /** Admin queries. */
  admin: {
    all: ['admin'] as const,
    policies: {
      all: ['admin', 'policies'] as const,
      detail: (policyId: string) => [...queryKeys.admin.policies.all, 'detail', policyId] as const,
    },
    runs: {
      all: ['admin', 'runs'] as const,
      status: (runId: string) => [...queryKeys.admin.runs.all, 'status', runId] as const,
      diff: (runId: string, sampleSize: number) =>
        [...queryKeys.admin.runs.all, 'diff', runId, sampleSize] as const,
    },
  },
} as const;
