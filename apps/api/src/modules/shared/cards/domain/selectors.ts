import { BADGE_KEY, BADGE_PRIORITY, CARD_LIST_CONTEXT, PRIMARY_CTA } from './card.constants';
import type { CardListContext } from './card.constants';
import type { PrimaryCta } from './card.constants';
import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import type { CardBadge, CardItemSignals, CardMeta } from './card.types';

const BADGE_REASON = {
  NEW_EPISODE: 'watching+hasNewEpisode',
  CONTINUE: 'continuePoint',
  IN_WATCHLIST: 'planned',
  HIT: 'qualityScore>=85',
  TRENDING: 'isTrending',
  NEW_RELEASE: 'newReleaseWindow',
  IN_THEATERS: 'inTheatersContext',
  NEW_ON_STREAMING: 'newOnStreamingContext',
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
export function selectBadge(signals: CardItemSignals, ctx: CardListContext): CardBadge | null {
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

  if (ctx === CARD_LIST_CONTEXT.CONTINUE_LIST) {
    return null;
  }

  if (ctx !== CARD_LIST_CONTEXT.USER_LIBRARY && signals.userState === USER_MEDIA_STATE.PLANNED) {
    return {
      key: BADGE_KEY.IN_WATCHLIST,
      priority: BADGE_PRIORITY.IN_WATCHLIST,
      reason: BADGE_REASON.IN_WATCHLIST,
    };
  }

  // HIT badge for high-quality content (qualityScore >= 85)
  if (signals.isHit) {
    return {
      key: BADGE_KEY.HIT,
      priority: BADGE_PRIORITY.HIT,
      reason: BADGE_REASON.HIT,
    };
  }

  if (ctx === CARD_LIST_CONTEXT.TRENDING_LIST) {
    return {
      key: BADGE_KEY.TRENDING,
      priority: BADGE_PRIORITY.TRENDING,
      reason: BADGE_REASON.TRENDING,
    };
  }

  if (ctx === CARD_LIST_CONTEXT.NEW_RELEASES_LIST && signals.isNewRelease) {
    return {
      key: BADGE_KEY.NEW_RELEASE,
      priority: BADGE_PRIORITY.NEW_RELEASE,
      reason: BADGE_REASON.NEW_RELEASE,
    };
  }

  if (ctx === CARD_LIST_CONTEXT.IN_THEATERS_LIST) {
    return {
      key: BADGE_KEY.IN_THEATERS,
      priority: BADGE_PRIORITY.IN_THEATERS,
      reason: BADGE_REASON.IN_THEATERS,
    };
  }

  if (ctx === CARD_LIST_CONTEXT.NEW_ON_STREAMING_LIST) {
    return {
      key: BADGE_KEY.NEW_ON_STREAMING,
      priority: BADGE_PRIORITY.NEW_ON_STREAMING,
      reason: BADGE_REASON.NEW_ON_STREAMING,
    };
  }

  if (ctx === CARD_LIST_CONTEXT.DEFAULT) {
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

    if (signals.isTrending) {
      return {
        key: BADGE_KEY.TRENDING,
        priority: BADGE_PRIORITY.TRENDING,
        reason: BADGE_REASON.TRENDING,
      };
    }
  }

  return null;
}

/**
 * Selects a primary CTA for a card.
 */
export function selectPrimaryCta(
  signals: CardItemSignals,
  badgeKey: CardMeta['badgeKey'],
): PrimaryCta {
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
export function buildCardMeta(signals: CardItemSignals, ctx: CardListContext): CardMeta {
  const badge = selectBadge(signals, ctx);

  return {
    badgeKey: badge?.key ?? null,
    primaryCta: selectPrimaryCta(signals, badge?.key ?? null),
    continue: signals.continuePoint ?? null,
    listContext: ctx,
  };
}
