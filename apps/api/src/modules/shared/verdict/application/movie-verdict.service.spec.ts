import { MovieVerdictService, computeMovieVerdict } from './movie-verdict.service';
import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { BADGE_KEY } from '../../cards/domain/card.constants';
import { RATING_SOURCE } from '../domain/verdict.types';

describe('MovieVerdictService', () => {
  let service: MovieVerdictService;

  beforeEach(() => {
    service = new MovieVerdictService();
  });

  describe('quality warnings', () => {
    it('should return poorRatings for avgRating < 5.5 with confident votes', () => {
      const result = service.compute({
        avgRating: 5.0,
        voteCount: 500,
        ratingSource: RATING_SOURCE.IMDB,
      });

      expect(result.type).toBe('warning');
      expect(result.messageKey).toBe('poorRatings');
      expect(result.context).toBe('IMDb: 5.0');
    });

    it('should return belowAverage for avgRating 5.5-6.0 with confident votes', () => {
      const result = service.compute({
        avgRating: 5.8,
        voteCount: 500,
        ratingSource: RATING_SOURCE.IMDB,
      });

      expect(result.type).toBe('warning');
      expect(result.messageKey).toBe('belowAverage');
    });

    it('should prioritize warnings over release status', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 5.0,
        voteCount: 500,
      });

      expect(result.messageKey).toBe('poorRatings');
    });
  });

  describe('timing verdicts (no ratings yet)', () => {
    it('should return upcomingHit for UPCOMING with high popularity', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.UPCOMING,
        popularity: 70,
      });

      expect(result.type).toBe('release');
      expect(result.messageKey).toBe('upcomingHit');
      expect(result.hintKey).toBe('notifyRelease');
    });

    it('should NOT return upcomingHit for UPCOMING with low popularity', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.UPCOMING,
        popularity: 30,
      });

      expect(result.messageKey).not.toBe('upcomingHit');
    });

    it('should return justReleased for IN_THEATERS without confident ratings', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 7.0,
        voteCount: 50, // not confident
      });

      expect(result.type).toBe('release');
      expect(result.messageKey).toBe('justReleased');
    });

    it('should NOT return justReleased for IN_THEATERS with confident ratings', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 7.5,
        voteCount: 500, // confident
      });

      // Should return quality verdict instead
      expect(result.messageKey).not.toBe('justReleased');
      expect(result.type).toBe('quality');
    });
  });

  describe('quality signals', () => {
    it('should return trendingNow for TRENDING badge', () => {
      const result = service.compute({
        badgeKey: BADGE_KEY.TRENDING,
        avgRating: 7.0,
        voteCount: 500,
      });

      expect(result.type).toBe('popularity');
      expect(result.messageKey).toBe('trendingNow');
    });

    it('should return trendingNow for HIT badge', () => {
      const result = service.compute({
        badgeKey: BADGE_KEY.HIT,
        avgRating: 7.0,
        voteCount: 500,
      });

      expect(result.type).toBe('popularity');
      expect(result.messageKey).toBe('trendingNow');
    });

    it('should return criticsLoved for avgRating >= 7.5 with 1000+ votes', () => {
      const result = service.compute({
        avgRating: 8.0,
        voteCount: 1500,
        ratingSource: RATING_SOURCE.IMDB,
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('criticsLoved');
      expect(result.context).toBe('IMDb: 8.0');
    });

    it('should return strongRatings for avgRating >= 7.0', () => {
      const result = service.compute({
        avgRating: 7.2,
        voteCount: 500,
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('strongRatings');
    });

    it('should return decentRatings for avgRating 6.5-7.0', () => {
      const result = service.compute({
        avgRating: 6.7,
        voteCount: 500,
      });

      expect(result.type).toBe('quality');
      expect(result.messageKey).toBe('decentRatings');
    });
  });

  describe('popularity verdicts', () => {
    it('should return risingHype for RISING badge when no quality verdict applies', () => {
      const result = service.compute({
        badgeKey: BADGE_KEY.RISING,
        avgRating: 6.3, // mixed quality range, not decent/strong
        voteCount: 300,
      });

      expect(result.type).toBe('popularity');
      expect(result.messageKey).toBe('risingHype');
    });
  });

  describe('streaming verdicts', () => {
    it('should return nowStreaming for NEW_ON_STREAMING without any ratings', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
      });

      expect(result.type).toBe('release');
      expect(result.messageKey).toBe('nowStreaming');
    });

    it('should NOT return nowStreaming if ratings exist', () => {
      const result = service.compute({
        releaseStatus: ReleaseStatus.NEW_ON_STREAMING,
        avgRating: 7.0,
        voteCount: 50,
      });

      // Should return earlyReviews instead
      expect(result.messageKey).not.toBe('nowStreaming');
    });
  });

  describe('early reviews', () => {
    it('should return earlyReviews when ratings exist but not confident', () => {
      const result = service.compute({
        avgRating: 7.0,
        voteCount: 50,
      });

      expect(result.type).toBe('general');
      expect(result.messageKey).toBe('earlyReviews');
    });
  });

  describe('fallbacks', () => {
    it('should return mixedReviews for avgRating 6.0-6.5 with confident votes', () => {
      const result = service.compute({
        avgRating: 6.3,
        voteCount: 500,
      });

      expect(result.type).toBe('general');
      expect(result.messageKey).toBe('mixedReviews');
    });

    it('should return null verdict when no data', () => {
      const result = service.compute({});

      expect(result.messageKey).toBeNull();
      expect(result.type).toBe('general');
    });
  });

  describe('rating source in context', () => {
    it('should use provided ratingSource in context', () => {
      const result = service.compute({
        avgRating: 7.5,
        voteCount: 500,
        ratingSource: RATING_SOURCE.TRAKT,
      });

      expect(result.context).toBe('Trakt: 7.5');
    });

    it('should default to IMDb when no ratingSource provided', () => {
      const result = service.compute({
        avgRating: 7.5,
        voteCount: 500,
      });

      expect(result.context).toBe('IMDb: 7.5');
    });
  });

  describe('computeMovieVerdict standalone function', () => {
    it('should work the same as service.compute', () => {
      const input = {
        releaseStatus: ReleaseStatus.IN_THEATERS,
        avgRating: 7.5,
        voteCount: 500,
      };

      const serviceResult = service.compute(input);
      const functionResult = computeMovieVerdict(input);

      expect(functionResult).toEqual(serviceResult);
    });
  });
});
