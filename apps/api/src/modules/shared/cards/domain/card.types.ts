import type { BadgeKey, CardListContext, PrimaryCta } from './card.constants';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';

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
  userState?: UserMediaState['state'] | null;
  continuePoint?: ContinuePoint | null;
  hasNewEpisode?: boolean;
  isNewRelease?: boolean;
  trendDelta?: 'up' | 'down' | 'stable' | null;
  isTrending?: boolean;
}
