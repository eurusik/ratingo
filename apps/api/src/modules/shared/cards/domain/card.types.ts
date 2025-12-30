import type { BadgeKey, CardListContext, CardUserState, PrimaryCta } from './card.constants';

/**
 * User context for card rendering (abstraction over user-media state).
 */
export interface CardUserContext {
  state: CardUserState | null;
  progress: {
    seasons?: Record<number, number>;
  } | null;
}

// Re-export for convenience
export type { CardUserState, BadgeKey } from './card.constants';

export interface ContinuePoint {
  season: number;
  episode: number;
}

export interface CardBadge {
  key: BadgeKey;
  priority: number;
  reason?: string;
}

export interface CardMeta {
  badgeKey: BadgeKey | null;
  primaryCta: PrimaryCta;
  continue: ContinuePoint | null;
  listContext?: CardListContext;
}

export interface CardItemSignals {
  hasUserEntry: boolean;
  userState?: CardUserState | null;
  continuePoint?: ContinuePoint | null;
  hasNewEpisode?: boolean;
  isNewRelease?: boolean;
  isHit?: boolean;
  trendDelta?: 'up' | 'down' | 'stable' | null;
  isTrending?: boolean;
}
