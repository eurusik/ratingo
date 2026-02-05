import { BADGE_KEY, type BadgeKey } from '../../cards/domain/card.constants';

/**
 * Popularity signal for verdict computation.
 * Decoupled from cards module - verdict only cares about semantic meaning.
 */
export const POPULARITY_SIGNAL = {
  TRENDING: 'trending',
  HIT: 'hit',
  RISING: 'rising',
} as const;

export type PopularitySignal = (typeof POPULARITY_SIGNAL)[keyof typeof POPULARITY_SIGNAL] | null;

/**
 * Maps card badge key to verdict popularity signal.
 * Pure function - no side effects.
 */
export function mapBadgeToPopularitySignal(
  badgeKey: BadgeKey | null | undefined,
): PopularitySignal {
  if (badgeKey === BADGE_KEY.TRENDING) return POPULARITY_SIGNAL.TRENDING;
  if (badgeKey === BADGE_KEY.HIT) return POPULARITY_SIGNAL.HIT;
  if (badgeKey === BADGE_KEY.RISING) return POPULARITY_SIGNAL.RISING;
  return null;
}
