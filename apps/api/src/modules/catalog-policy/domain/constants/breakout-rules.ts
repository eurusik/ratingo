/**
 * Default breakout rules for content class exclusion override.
 *
 * Breakout rules allow excluded content to become eligible if it meets
 * specific quality/popularity thresholds.
 */

import { BreakoutRule } from '../types/policy.types';
import { CANONICAL_PROVIDERS } from './provider-mapping';

/**
 * Anime Global Hit - allows popular anime on major streaming platforms.
 *
 * Requirements:
 * - 50,000+ IMDB votes (global popularity signal)
 * - Available on Netflix, HBO Max, Prime Video, Disney+, or Apple TV+
 */
export const ANIME_GLOBAL_HIT: BreakoutRule = {
  id: 'ANIME_GLOBAL_HIT',
  name: 'Anime Global Hit',
  priority: 10,
  requirements: {
    minImdbVotes: 50000,
    requireAnyOfProviders: [
      CANONICAL_PROVIDERS.NETFLIX,
      CANONICAL_PROVIDERS.HBO_MAX,
      CANONICAL_PROVIDERS.PRIME_VIDEO,
      CANONICAL_PROVIDERS.DISNEY_PLUS,
      CANONICAL_PROVIDERS.APPLE_TV_PLUS,
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
