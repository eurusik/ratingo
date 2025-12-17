import { computeMovieVerdict } from './movie-verdict.utils';
import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { BADGE_KEY } from '../../../shared/cards/domain/card.constants';

describe('computeMovieVerdict', () => {
  describe('PRIORITY 1: Quality Warnings (requires confidence)', () => {
    it('returns poorRatings when avgRating < 5.5 AND has confident votes', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 5.0,
        voteCount: 500, // confident
      });

      expect(result.type).toBe('warning');
      expect(result.messageKey).toBe('poorRatings');
      expect(result.hintKey).toBe('decideToWatch');
    });

    it('does NOT return poorRatings when voteCount is low (no confidence)', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 5.0,
        voteCount: 50, // not confident
      });

      expect(result.type).not.toBe('warning');
      expect(result.messageKey).not.toBe('poorRatings');
    });

    it('does NOT use ratingoScore for warnings (niche content protection)', () => {
      // This is the key fix: low ratingoScore but good avgRating should NOT warn
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        ratingoScore: 26, // very low (niche content)
        avgRating: 7.8, // but good rating!
        voteCount: 72, // not enough for confidence
      });

      expect(result.type).not.toBe('warning');
    });

    it('returns belowAverage when avgRating < 6.0 AND has confident votes', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 5.8,
        voteCount: 300, // confident
      });

      expect(result.type).toBe('warning');
      expect(result.messageKey).toBe('belowAverage');
    });

    it('shows warning even for new_on_streaming when confident', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
        avgRating: 5.0,
        voteCount: 500, // confident
      });

      expect(result.type).toBe('warning');
      expect(result.messageKey).toBe('poorRatings');
    });
  });

  describe('PRIORITY 2: Timing (upcoming/in_theaters)', () => {
    it('returns upcomingHit for upcoming movie with high popularity', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.UPCOMING,
        popularity: 60,
      });

      expect(result.type).toBe('release');
      expect(result.messageKey).toBe('upcomingHit');
      expect(result.hintKey).toBe('notifyRelease');
    });

    it('does not return upcomingHit for low popularity upcoming movie', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.UPCOMING,
        popularity: 30,
      });

      expect(result.messageKey).not.toBe('upcomingHit');
    });

    it('returns justReleased for in_theaters movie without confident ratings', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        ratingoScore: 70,
        // no voteCount = no confidence
      });

      expect(result.type).toBe('release');
      expect(result.messageKey).toBe('justReleased');
      expect(result.hintKey).toBe('forLater');
    });

    it('returns quality verdict for in_theaters movie WITH confident ratings', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 7.6,
        voteCount: 13000, // confident
      });

      // Quality > timing when we have confident data
      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('criticsLoved');
    });

    it('returns strongRatings for in_theaters with good but not great ratings', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 7.2,
        voteCount: 500, // confident but not enough for criticsLoved
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('strongRatings');
    });
  });

  describe('PRIORITY 3: Quality Signals', () => {
    it('returns trendingNow for TRENDING badge', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        ratingoScore: 70,
        badgeKey: BADGE_KEY.TRENDING,
      });

      expect(result.type).toBe('popularity');
      expect(result.messageKey).toBe('trendingNow');
    });

    it('returns trendingNow for HIT badge', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        ratingoScore: 70,
        badgeKey: BADGE_KEY.HIT,
      });

      expect(result.type).toBe('popularity');
      expect(result.messageKey).toBe('trendingNow');
    });

    it('returns criticsLoved when avgRating >= 7.5 and voteCount >= 1000', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        ratingoScore: 60,
        avgRating: 7.8,
        voteCount: 5000,
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('criticsLoved');
      expect(result.context).toBe('IMDb: 7.8');
    });

    it('does not return criticsLoved when voteCount < 1000', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 7.8,
        voteCount: 500, // confident but not enough for criticsLoved
      });

      expect(result.messageKey).not.toBe('criticsLoved');
    });

    it('returns strongRatings when avgRating >= 7.0 AND confident', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 7.2,
        voteCount: 500, // confident
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('strongRatings');
    });

    it('returns risingHype for RISING badge', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        ratingoScore: 65,
        badgeKey: BADGE_KEY.RISING,
      });

      expect(result.type).toBe('popularity');
      expect(result.messageKey).toBe('risingHype');
    });
  });

  describe('PRIORITY 4: New on Streaming / Early Reviews', () => {
    it('returns nowStreaming ONLY when NO ratings exist', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
        // no avgRating - truly no data
      });

      expect(result.type).toBe('release');
      expect(result.messageKey).toBe('nowStreaming');
      expect(result.hintKey).toBe('forLater');
    });

    it('returns earlyReviews when ratings exist but no confidence', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
        avgRating: 6.8,
        voteCount: 100, // not confident
      });

      expect(result.type).toBe('general');
      expect(result.messageKey).toBe('earlyReviews');
      expect(result.context).toBe('IMDb: 6.8');
    });

    it('prioritizes quality over timing for new_on_streaming when confident', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
        avgRating: 7.2,
        voteCount: 500, // confident
      });

      expect(result.messageKey).toBe('strongRatings');
      expect(result.messageKey).not.toBe('nowStreaming');
    });
  });

  describe('PRIORITY 5: Fallbacks', () => {
    it('returns mixedReviews for average scores when confident', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 6.3,
        voteCount: 500, // confident
      });

      expect(result.type).toBe('general');
      expect(result.messageKey).toBe('mixedReviews');
    });

    it('returns decentRatings for 6.5-7.0 range when confident', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 6.8,
        voteCount: 500, // confident
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('decentRatings');
    });
  });

  describe('Context formatting', () => {
    it('includes IMDb rating in context when available for warnings', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        avgRating: 5.2,
        voteCount: 500, // confident
      });

      expect(result.context).toBe('IMDb: 5.2');
    });

    it('returns null context when avgRating not available', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        voteCount: 50, // not confident, no avgRating
      });

      expect(result.context).toBeNull();
    });
  });

  describe('Real-world scenarios', () => {
    it('new_on_streaming with good rating and confidence shows quality', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
        avgRating: 7.2,
        voteCount: 500, // confident
      });

      // Should show quality, not timing
      expect(result.messageKey).toBe('strongRatings');
    });

    it('Bad movie in theaters still shows warning when confident', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 4.5,
        voteCount: 1000, // confident
      });

      expect(result.type).toBe('warning');
      expect(result.messageKey).toBe('poorRatings');
    });

    it('Highly anticipated upcoming movie shows upcomingHit', () => {
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.UPCOMING,
        popularity: 80,
      });

      expect(result.messageKey).toBe('upcomingHit');
    });

    it('Niche content with low ratingoScore but good avgRating shows earlyReviews', () => {
      // This is the key scenario that was broken before
      const result = computeMovieVerdict({
        releaseStatus: ReleaseStatus.STREAMING,
        ratingoScore: 26.7, // very low (niche, low popularity)
        avgRating: 7.8, // but good rating!
        voteCount: 72, // not enough for confidence
      });

      // Should NOT show warning - shows earlyReviews instead
      expect(result.type).not.toBe('warning');
      expect(result.messageKey).toBe('earlyReviews');
      expect(result.context).toBe('IMDb: 7.8');
    });
  });
});
