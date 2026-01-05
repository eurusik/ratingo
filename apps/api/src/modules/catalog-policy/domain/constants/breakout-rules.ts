/**
 * Default breakout rules for content class exclusion override.
 *
 * Breakout rules allow excluded content to become eligible if it meets
 * specific quality/popularity thresholds.
 *
 * Note: Provider IDs are canonical IDs from provider_registry table.
 */

import { type BreakoutRule } from '../types/policy.types';

/**
 * Canonical provider IDs for breakout rules.
 * These match the IDs in provider_registry table.
 */
const PROVIDERS = {
  NETFLIX: 'netflix',
  MAX: 'max',
  PRIME_VIDEO: 'prime_video',
  DISNEY_PLUS: 'disney_plus',
  APPLE_TV_PLUS: 'apple_tv_plus',
} as const;

/**
 * Anime Global Hit - allows popular anime on major streaming platforms.
 *
 * Requirements:
 * - 50,000+ IMDB votes (global popularity signal)
 * - Available on Netflix, Max, Prime Video, Disney+, or Apple TV+
 */
export const ANIME_GLOBAL_HIT: BreakoutRule = {
  id: 'ANIME_GLOBAL_HIT',
  name: 'Anime Global Hit',
  priority: 10,
  requirements: {
    minImdbVotes: 50000,
    requireAnyOfProviders: [
      PROVIDERS.NETFLIX,
      PROVIDERS.MAX,
      PROVIDERS.PRIME_VIDEO,
      PROVIDERS.DISNEY_PLUS,
      PROVIDERS.APPLE_TV_PLUS,
    ],
  },
};

/**
 * Anime Trakt Hit - allows anime with strong Trakt community engagement.
 *
 * Requirements:
 * - 10,000+ Trakt votes (community engagement)
 * - 25,000+ IMDB votes (baseline popularity)
 */
export const ANIME_TRAKT_HIT: BreakoutRule = {
  id: 'ANIME_TRAKT_HIT',
  name: 'Anime Trakt Hit',
  priority: 11,
  requirements: {
    minTraktVotes: 10000,
    minImdbVotes: 25000,
  },
};

/** Default breakout rules for anime content class exclusion. */
export const DEFAULT_ANIME_BREAKOUT_RULES: BreakoutRule[] = [ANIME_GLOBAL_HIT, ANIME_TRAKT_HIT];
