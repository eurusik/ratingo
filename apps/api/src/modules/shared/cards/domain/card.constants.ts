/**
 * Supported badge keys for media cards.
 */
export const BADGE_KEY = {
  NEW_EPISODE: 'NEW_EPISODE',
  CONTINUE: 'CONTINUE',
  IN_WATCHLIST: 'IN_WATCHLIST',
  NEW_RELEASE: 'NEW_RELEASE',
  RISING: 'RISING',
  TRENDING: 'TRENDING',
} as const;

export type BadgeKey = (typeof BADGE_KEY)[keyof typeof BADGE_KEY];

export const BADGE_KEY_VALUES: BadgeKey[] = Object.values(BADGE_KEY);

/**
 * Supported primary CTAs for media cards.
 */
export const PRIMARY_CTA = {
  SAVE: 'SAVE',
  CONTINUE: 'CONTINUE',
  OPEN: 'OPEN',
} as const;

export type PrimaryCta = (typeof PRIMARY_CTA)[keyof typeof PRIMARY_CTA];

export const PRIMARY_CTA_VALUES: PrimaryCta[] = Object.values(PRIMARY_CTA);

export const CARD_LIST_CONTEXT = {
  TRENDING_LIST: 'TRENDING_LIST',
  NEW_RELEASES_LIST: 'NEW_RELEASES_LIST',
  DEFAULT: 'DEFAULT',
} as const;

export type CardListContext = (typeof CARD_LIST_CONTEXT)[keyof typeof CARD_LIST_CONTEXT];

export const CARD_LIST_CONTEXT_VALUES: CardListContext[] = Object.values(CARD_LIST_CONTEXT);

/**
 * Badge priority values for debugging and deterministic selection.
 */
export const BADGE_PRIORITY = {
  NEW_EPISODE: 100,
  CONTINUE: 90,
  IN_WATCHLIST: 80,
  NEW_RELEASE: 60,
  RISING: 40,
  TRENDING: 20,
} as const;

/**
 * Defines the recency window for the NEW_RELEASE badge.
 */
export const CARD_NEW_RELEASE_WINDOW_DAYS = 14;
