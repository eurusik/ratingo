import { BADGE_KEY, BADGE_PRIORITY, PRIMARY_CTA } from './card.constants';
import type { PrimaryCta } from './card.constants';
import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import type { CardBadge, CardMeta, CardSignals } from './card.types';

const BADGE_REASON = {
  NEW_EPISODE: 'watching+hasNewEpisode',
  CONTINUE: 'continuePoint',
  IN_WATCHLIST: 'planned',
  TRENDING: 'isTrending',
  NEW_RELEASE: 'newReleaseWindow',
  RISING: 'trendDelta=up',
} as const;

/**
 * Extracts a simple continue point from user progress payload.
 *
 * @param progress - Progress payload containing season -> episode mapping
 * @returns Continue point or null
 */
export function extractContinuePoint(
  progress: {
    seasons?: Record<number, number> | Record<string, number>;
  } | null,
): { season: number; episode: number } | null {
  if (!progress?.seasons) return null;

  const entries = Object.entries(progress.seasons)
    .map(([season, episode]) => ({ season: Number(season), episode: Number(episode) }))
    .filter((x) => Number.isFinite(x.season) && Number.isFinite(x.episode));

  if (!entries.length) return null;

  const maxSeason = Math.max(...entries.map((e) => e.season));
  const maxSeasonEntry = entries.find((e) => e.season === maxSeason);

  if (!maxSeasonEntry) return null;

  return {
    season: maxSeasonEntry.season,
    episode: maxSeasonEntry.episode,
  };
}

/**
 * Selects a single badge for a card based on canonical priority.
 */
export function selectBadge(signals: CardSignals): CardBadge | null {
  if (signals.userState === USER_MEDIA_STATE.WATCHING && signals.hasNewEpisode) {
    return {
      key: BADGE_KEY.NEW_EPISODE,
      priority: BADGE_PRIORITY.NEW_EPISODE,
      reason: BADGE_REASON.NEW_EPISODE,
    };
  }

  if (signals.continuePoint) {
    return {
      key: BADGE_KEY.CONTINUE,
      priority: BADGE_PRIORITY.CONTINUE,
      reason: BADGE_REASON.CONTINUE,
    };
  }

  if (signals.userState === USER_MEDIA_STATE.PLANNED) {
    return {
      key: BADGE_KEY.IN_WATCHLIST,
      priority: BADGE_PRIORITY.IN_WATCHLIST,
      reason: BADGE_REASON.IN_WATCHLIST,
    };
  }

  if (signals.isTrending) {
    return {
      key: BADGE_KEY.TRENDING,
      priority: BADGE_PRIORITY.TRENDING,
      reason: BADGE_REASON.TRENDING,
    };
  }

  if (signals.isNewRelease) {
    return {
      key: BADGE_KEY.NEW_RELEASE,
      priority: BADGE_PRIORITY.NEW_RELEASE,
      reason: BADGE_REASON.NEW_RELEASE,
    };
  }

  if (signals.trendDelta === 'up') {
    return {
      key: BADGE_KEY.RISING,
      priority: BADGE_PRIORITY.RISING,
      reason: BADGE_REASON.RISING,
    };
  }

  return null;
}

/**
 * Selects a primary CTA for a card.
 */
export function selectPrimaryCta(signals: CardSignals, badgeKey: CardMeta['badgeKey']): PrimaryCta {
  if (badgeKey === BADGE_KEY.NEW_EPISODE || badgeKey === BADGE_KEY.CONTINUE) {
    return PRIMARY_CTA.CONTINUE;
  }

  if (!signals.hasUserEntry) {
    return PRIMARY_CTA.SAVE;
  }

  return PRIMARY_CTA.OPEN;
}

/**
 * Builds card metadata for a media card.
 */
export function buildCardMeta(signals: CardSignals): CardMeta {
  const badge = selectBadge(signals);

  return {
    badgeKey: badge?.key ?? null,
    primaryCta: selectPrimaryCta(signals, badge?.key ?? null),
    continue: signals.continuePoint ?? null,
  };
}
