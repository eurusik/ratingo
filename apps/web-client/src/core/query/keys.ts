/**
 * Query key factory for TanStack Query.
 *
 * Centralizes all query keys for consistent cache management.
 * Uses nested structure for fine-grained cache invalidation.
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
    trending: (params?: Record<string, unknown>) =>
      [...queryKeys.shows.all, 'trending', params] as const,
    detail: (slug: string) => [...queryKeys.shows.all, 'detail', slug] as const,
    calendar: (params?: { startDate?: string; days?: number }) =>
      [...queryKeys.shows.all, 'calendar', params] as const,
  },

  /** Movies queries. */
  movies: {
    all: ['movies'] as const,
    trending: (params?: Record<string, unknown>) =>
      [...queryKeys.movies.all, 'trending', params] as const,
    nowPlaying: (params?: Record<string, unknown>) =>
      [...queryKeys.movies.all, 'now-playing', params] as const,
    newReleases: (params?: Record<string, unknown>) =>
      [...queryKeys.movies.all, 'new-releases', params] as const,
    detail: (slug: string) => [...queryKeys.movies.all, 'detail', slug] as const,
  },

  /** Catalog-wide queries. */
  catalog: {
    providers: ['catalog', 'providers'] as const,
  },

  /** Home page queries. */
  home: {
    hero: (type?: string) => ['home', 'hero', type] as const,
  },

  /** Search queries. */
  search: {
    results: (query: string) => ['search', query] as const,
  },

  /** Insights queries. */
  insights: {
    movements: (params?: { window?: string; limit?: number }) =>
      ['insights', 'movements', params] as const,
  },

  /** Auth queries. */
  auth: {
    me: ['auth', 'me'] as const,
  },

  /** User media state queries. */
  userMedia: {
    all: ['user-media'] as const,
    state: (mediaId: string) => [...queryKeys.userMedia.all, 'state', mediaId] as const,
    myRatings: (params?: Record<string, unknown>) =>
      [...queryKeys.userMedia.all, 'my-ratings', params] as const,
    myWatchlist: (params?: Record<string, unknown>) =>
      [...queryKeys.userMedia.all, 'my-watchlist', params] as const,
  },

  /** Public user queries. */
  users: {
    profile: (username: string) => ['users', username] as const,
    ratings: (username: string, params?: Record<string, unknown>) =>
      ['users', username, 'ratings', params] as const,
  },

  /** User actions (saved items, subscriptions). */
  userActions: {
    all: ['user-actions'] as const,
    savedItems: {
      all: ['user-actions', 'saved-items'] as const,
      status: (mediaItemId: string) =>
        [...queryKeys.userActions.savedItems.all, 'status', mediaItemId] as const,
      list: (list: string, params?: Record<string, unknown>) =>
        [...queryKeys.userActions.savedItems.all, 'list', list, params] as const,
    },
    subscriptions: {
      all: ['user-actions', 'subscriptions'] as const,
      status: (mediaItemId: string) =>
        [...queryKeys.userActions.subscriptions.all, 'status', mediaItemId] as const,
      list: (params?: Record<string, unknown>) =>
        [...queryKeys.userActions.subscriptions.all, 'list', params] as const,
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
      diff: (runId: string, sampleSize: number) => [...queryKeys.admin.runs.all, 'diff', runId, sampleSize] as const,
    },
  },
} as const;
