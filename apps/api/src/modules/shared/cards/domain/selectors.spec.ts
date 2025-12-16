import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import { BADGE_KEY, CARD_LIST_CONTEXT, PRIMARY_CTA } from './card.constants';
import { buildCardMeta, extractContinuePoint, selectBadge, selectPrimaryCta } from './selectors';

describe('cards selectors', () => {
  describe('extractContinuePoint', () => {
    it('returns null when progress is null', () => {
      expect(extractContinuePoint(null)).toBeNull();
    });

    it('returns null when seasons is missing', () => {
      expect(extractContinuePoint({})).toBeNull();
    });

    it('returns continue point for numeric season keys', () => {
      expect(extractContinuePoint({ seasons: { 1: 3, 2: 1 } })).toEqual({ season: 2, episode: 1 });
    });

    it('returns continue point for string season keys', () => {
      expect(extractContinuePoint({ seasons: { '1': 3, '10': 2 } })).toEqual({
        season: 10,
        episode: 2,
      });
    });

    it('ignores non-numeric values', () => {
      expect(extractContinuePoint({ seasons: { a: 1, '2': 4 } as any })).toEqual({
        season: 2,
        episode: 4,
      });
    });
  });

  describe('selectBadge', () => {
    it('prefers NEW_EPISODE over CONTINUE', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          hasNewEpisode: true,
          continuePoint: { season: 1, episode: 2 },
        },
        CARD_LIST_CONTEXT.TRENDING_LIST,
      );
      expect(badge?.key).toBe(BADGE_KEY.NEW_EPISODE);
    });

    it('returns null in NEW_RELEASES_LIST when item is not a new release', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isNewRelease: false,
        },
        CARD_LIST_CONTEXT.NEW_RELEASES_LIST,
      );
      expect(badge).toBeNull();
    });

    it('returns TRENDING in TRENDING_LIST even when item is new release', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isTrending: true,
          isNewRelease: true,
        },
        CARD_LIST_CONTEXT.TRENDING_LIST,
      );
      expect(badge?.key).toBe(BADGE_KEY.TRENDING);
    });

    it('prefers CONTINUE over TRENDING_LIST context', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          continuePoint: { season: 1, episode: 1 },
          isTrending: true,
        },
        CARD_LIST_CONTEXT.TRENDING_LIST,
      );
      expect(badge?.key).toBe(BADGE_KEY.CONTINUE);
    });

    it('returns NEW_RELEASE in NEW_RELEASES_LIST even when item is trending', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isTrending: true,
          isNewRelease: true,
        },
        CARD_LIST_CONTEXT.NEW_RELEASES_LIST,
      );
      expect(badge?.key).toBe(BADGE_KEY.NEW_RELEASE);
    });

    it('returns NEW_RELEASE in DEFAULT even when item is trending', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isTrending: true,
          isNewRelease: true,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.NEW_RELEASE);
    });

    it('returns CONTINUE when continuePoint exists', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          continuePoint: { season: 1, episode: 2 },
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.CONTINUE);
    });

    it('returns IN_WATCHLIST when planned and no continuePoint', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.PLANNED,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.IN_WATCHLIST);
    });

    it('suppresses IN_WATCHLIST in USER_LIBRARY context', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.PLANNED,
        },
        CARD_LIST_CONTEXT.USER_LIBRARY,
      );
      expect(badge).toBeNull();
    });

    it('suppresses context-derived badges in CONTINUE_LIST context', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          isTrending: true,
          isNewRelease: true,
          trendDelta: 'up',
        },
        CARD_LIST_CONTEXT.CONTINUE_LIST,
      );
      expect(badge).toBeNull();
    });

    it('keeps CONTINUE badge in CONTINUE_LIST context when continuePoint exists', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          continuePoint: { season: 1, episode: 2 },
        },
        CARD_LIST_CONTEXT.CONTINUE_LIST,
      );
      expect(badge?.key).toBe(BADGE_KEY.CONTINUE);
    });

    it('keeps NEW_EPISODE badge in CONTINUE_LIST context', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          hasNewEpisode: true,
        },
        CARD_LIST_CONTEXT.CONTINUE_LIST,
      );
      expect(badge?.key).toBe(BADGE_KEY.NEW_EPISODE);
    });

    it('returns null when no signals match', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.WATCHING,
          hasNewEpisode: false,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge).toBeNull();
    });

    it('returns HIT when isHit is true and no higher priority badges', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isHit: true,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.HIT);
    });

    it('prefers IN_WATCHLIST over HIT', () => {
      const badge = selectBadge(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.PLANNED,
          isHit: true,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.IN_WATCHLIST);
    });

    it('prefers HIT over NEW_RELEASE', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isHit: true,
          isNewRelease: true,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.HIT);
    });

    it('prefers HIT over TRENDING in DEFAULT context', () => {
      const badge = selectBadge(
        {
          hasUserEntry: false,
          userState: null,
          isHit: true,
          isTrending: true,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );
      expect(badge?.key).toBe(BADGE_KEY.HIT);
    });
  });

  describe('selectPrimaryCta', () => {
    it('returns CONTINUE for CONTINUE badge', () => {
      const cta = selectPrimaryCta({ hasUserEntry: true }, BADGE_KEY.CONTINUE);
      expect(cta).toBe(PRIMARY_CTA.CONTINUE);
    });

    it('returns SAVE when user entry is missing', () => {
      const cta = selectPrimaryCta({ hasUserEntry: false }, null);
      expect(cta).toBe(PRIMARY_CTA.SAVE);
    });

    it('returns OPEN when user entry exists and no continue badges', () => {
      const cta = selectPrimaryCta({ hasUserEntry: true }, null);
      expect(cta).toBe(PRIMARY_CTA.OPEN);
    });
  });

  describe('buildCardMeta', () => {
    it('builds meta without badgeReason in production payload', () => {
      const meta = buildCardMeta(
        {
          hasUserEntry: true,
          userState: USER_MEDIA_STATE.PLANNED,
        },
        CARD_LIST_CONTEXT.DEFAULT,
      );

      expect(meta.badgeKey).toBe(BADGE_KEY.IN_WATCHLIST);
      expect(meta.primaryCta).toBe(PRIMARY_CTA.OPEN);
      expect(meta).not.toHaveProperty('badgeReason');
      expect(meta.listContext).toBe(CARD_LIST_CONTEXT.DEFAULT);
    });
  });
});
