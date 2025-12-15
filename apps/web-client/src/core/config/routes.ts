/**
 * Application route definitions.
 *
 * Centralizes all route paths to prevent magic strings
 * and enable type-safe navigation.
 */
export const routes = {
  /** Home page. */
  home: '/',

  /** Shows routes. */
  shows: {
    list: '/shows',
    detail: (slug: string) => `/shows/${slug}` as const,
  },

  /** Movies routes. */
  movies: {
    list: '/movies',
    detail: (slug: string) => `/movies/${slug}` as const,
  },

  /** Release calendar. */
  calendar: '/calendar',

  /** Search page. */
  search: '/search',

  /** Authentication routes. */
  auth: {
    login: '/login',
    register: '/register',
  },

  /** Current user profile routes (protected). */
  profile: {
    me: '/profile',
    ratings: '/profile/ratings',
    watchlist: '/profile/watchlist',
    settings: '/profile/settings',
  },

  /** Public user profile routes. */
  user: {
    profile: (username: string) => `/u/${username}` as const,
    ratings: (username: string) => `/u/${username}/ratings` as const,
    watchlist: (username: string) => `/u/${username}/watchlist` as const,
  },

  /** Static pages. */
  about: '/about',
  ideas: '/ideas',
} as const;
