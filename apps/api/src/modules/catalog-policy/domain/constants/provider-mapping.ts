/**
 * Maps TMDB provider IDs to canonical IDs for breakout rule matching.
 *
 * Uses providerId (stable, global) instead of name (can change, localized).
 * Whitelist approach: unmapped providers are ignored.
 */

/** Canonical provider IDs for policy configuration. */
export const CANONICAL_PROVIDERS = {
  // Global streaming
  NETFLIX: 'netflix',
  HBO_MAX: 'hbo_max',
  PRIME_VIDEO: 'prime_video',
  DISNEY_PLUS: 'disney_plus',
  APPLE_TV_PLUS: 'apple_tv_plus',
  PARAMOUNT_PLUS: 'paramount_plus',
  PEACOCK: 'peacock',
  HULU: 'hulu',
  CRUNCHYROLL: 'crunchyroll',
  MUBI: 'mubi',

  // Ukrainian providers
  MEGOGO: 'megogo',
  SWEET_TV: 'sweet_tv',
} as const;

export type CanonicalProviderId = (typeof CANONICAL_PROVIDERS)[keyof typeof CANONICAL_PROVIDERS];

/**
 * TMDB provider ID → canonical ID mapping.
 *
 * @see https://developer.themoviedb.org/reference/watch-providers-list
 */
export const PROVIDER_ID_TO_CANONICAL: Record<number, CanonicalProviderId> = {
  // Netflix
  8: CANONICAL_PROVIDERS.NETFLIX,

  // HBO Max / Max
  384: CANONICAL_PROVIDERS.HBO_MAX,
  1899: CANONICAL_PROVIDERS.HBO_MAX,

  // Prime Video
  9: CANONICAL_PROVIDERS.PRIME_VIDEO,
  119: CANONICAL_PROVIDERS.PRIME_VIDEO,

  // Disney+
  337: CANONICAL_PROVIDERS.DISNEY_PLUS,

  // Apple TV+
  350: CANONICAL_PROVIDERS.APPLE_TV_PLUS,

  // Paramount+
  531: CANONICAL_PROVIDERS.PARAMOUNT_PLUS,

  // Peacock
  386: CANONICAL_PROVIDERS.PEACOCK,
  387: CANONICAL_PROVIDERS.PEACOCK,

  // Hulu
  15: CANONICAL_PROVIDERS.HULU,

  // Crunchyroll
  283: CANONICAL_PROVIDERS.CRUNCHYROLL,

  // MUBI
  11: CANONICAL_PROVIDERS.MUBI,

  // Ukrainian
  484: CANONICAL_PROVIDERS.MEGOGO,
  1773: CANONICAL_PROVIDERS.SWEET_TV,
};

/**
 * Resolves canonical provider ID from TMDB provider ID.
 *
 * @param {number} tmdbProviderId - TMDB provider ID
 * @returns {CanonicalProviderId | undefined} Canonical ID or undefined if not in whitelist
 */
export function resolveCanonicalProvider(tmdbProviderId: number): CanonicalProviderId | undefined {
  return PROVIDER_ID_TO_CANONICAL[tmdbProviderId];
}
