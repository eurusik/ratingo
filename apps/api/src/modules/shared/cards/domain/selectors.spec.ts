import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import { BADGE_KEY, PRIMARY_CTA } from './card.constants';
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
      const badge = selectBadge({
        hasUserEntry: true,
        userState: USER_MEDIA_STATE.WATCHING,
        hasNewEpisode: true,
        continuePoint: { season: 1, episode: 2 },
        isTrending: true,
      });
      expect(badge?.key).toBe(BADGE_KEY.NEW_EPISODE);
    });

    it('prefers TRENDING over NEW_RELEASE when both signals are present', () => {
      const badge = selectBadge({
        hasUserEntry: false,
        userState: null,
        isTrending: true,
        isNewRelease: true,
      });
      expect(badge?.key).toBe(BADGE_KEY.TRENDING);
    });

    it('returns CONTINUE when continuePoint exists', () => {
      const badge = selectBadge({
        hasUserEntry: true,
        userState: USER_MEDIA_STATE.WATCHING,
        continuePoint: { season: 1, episode: 2 },
      });
      expect(badge?.key).toBe(BADGE_KEY.CONTINUE);
    });

    it('returns IN_WATCHLIST when planned and no continuePoint', () => {
      const badge = selectBadge({
        hasUserEntry: true,
        userState: USER_MEDIA_STATE.PLANNED,
      });
      expect(badge?.key).toBe(BADGE_KEY.IN_WATCHLIST);
    });

    it('returns null when no signals match', () => {
      const badge = selectBadge({
        hasUserEntry: true,
        userState: USER_MEDIA_STATE.WATCHING,
        hasNewEpisode: false,
      });
      expect(badge).toBeNull();
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
      const meta = buildCardMeta({
        hasUserEntry: true,
        userState: USER_MEDIA_STATE.PLANNED,
      });

      expect(meta.badgeKey).toBe(BADGE_KEY.IN_WATCHLIST);
      expect(meta.primaryCta).toBe(PRIMARY_CTA.OPEN);
      expect(meta).not.toHaveProperty('badgeReason');
    });
  });
});
