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
