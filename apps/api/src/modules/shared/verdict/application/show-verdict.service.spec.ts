import { ShowVerdictService, computeShowVerdict } from './show-verdict.service';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { BADGE_KEY } from '../../cards/domain/card.constants';

describe('ShowVerdictService', () => {
  let service: ShowVerdictService;

  beforeEach(() => {
    service = new ShowVerdictService();
  });

  describe('cancelled shows', () => {
    it('should return cancelled verdict for CANCELED status', () => {
      const result = service.compute({
        status: ShowStatus.CANCELED,
        externalRatings: { imdb: { rating: 8.0, voteCount: 1000 } },
      });

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('cancelled');
      expect(result.statusHint).toBeNull();
    });
  });

  describe('quality warnings', () => {
    it('should return poorRatings for consensus < 5.5 with confident votes', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 5.0, voteCount: 500 },
          tmdb: { rating: 5.2, voteCount: 300 },
        },
      });

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('poorRatings');
    });

    it('should return belowAverage for consensus 5.5-6.0 with confident votes', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 5.8, voteCount: 500 },
          tmdb: { rating: 5.7, voteCount: 300 },
        },
      });

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('belowAverage');
    });
  });

  describe('high spread (opinions diverge)', () => {
    it('should return mixedReviews for high spread with confident votes', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 500 },
          trakt: { rating: 6.5, voteCount: 300 },
          tmdb: { rating: 7.0, voteCount: 200 },
        },
      });

      // spread = 8.0 - 6.5 = 1.5 > 1.0
      expect(result.verdict.messageKey).toBe('mixedReviews');
    });

    it('should return noConsensusYet for high spread with low votes', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 50 },
          trakt: { rating: 6.5, voteCount: 30 },
          tmdb: { rating: 7.0, voteCount: 20 },
        },
      });

      // spread = 1.5 but totalVotes < 200
      expect(result.verdict.messageKey).toBe('noConsensusYet');
    });

    it('should return mixedReviews for spread == 1.0 with 1000+ votes', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 800 },
          trakt: { rating: 7.0, voteCount: 500 },
        },
      });

      // spread = 1.0, totalVotes = 1300 >= 1000
      expect(result.verdict.messageKey).toBe('mixedReviews');
    });
  });

  describe('quality signals', () => {
    it('should return trendingNow for TRENDING badge', () => {
      const result = service.compute({
        badgeKey: BADGE_KEY.TRENDING,
        externalRatings: { imdb: { rating: 7.5, voteCount: 500 } },
      });

      expect(result.verdict.type).toBe('popularity');
      expect(result.verdict.messageKey).toBe('trendingNow');
    });

    it('should return trendingNow for HIT badge', () => {
      const result = service.compute({
        badgeKey: BADGE_KEY.HIT,
        externalRatings: { imdb: { rating: 7.5, voteCount: 500 } },
      });

      expect(result.verdict.type).toBe('popularity');
      expect(result.verdict.messageKey).toBe('trendingNow');
    });

    it('should return criticsLoved for consensus >= 7.5 with 1000+ votes and low spread', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 800 },
          trakt: { rating: 7.8, voteCount: 400 },
          tmdb: { rating: 7.9, voteCount: 300 },
        },
      });

      // consensus ~7.9, totalVotes = 1500, spread = 0.2
      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('criticsLoved');
    });

    it('should return strongRatings for consensus >= 7.0', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 7.2, voteCount: 300 },
          tmdb: { rating: 7.3, voteCount: 200 },
        },
      });

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('strongRatings');
    });

    it('should return decentRatings for consensus 6.5-7.0', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 6.7, voteCount: 300 },
          tmdb: { rating: 6.8, voteCount: 200 },
        },
      });

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('decentRatings');
    });
  });

  describe('long running shows', () => {
    it('should return longRunning for 5+ seasons with decent quality', () => {
      const result = service.compute({
        totalSeasons: 7,
        externalRatings: { imdb: { rating: 6.8, voteCount: 100 } },
      });

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('longRunning');
      expect(result.verdict.context).toBe('7 сезонів');
    });

    it('should not return longRunning for cancelled shows', () => {
      const result = service.compute({
        status: ShowStatus.CANCELED,
        totalSeasons: 7,
        externalRatings: { imdb: { rating: 7.0, voteCount: 500 } },
      });

      expect(result.verdict.messageKey).toBe('cancelled');
    });
  });

  describe('popularity verdicts', () => {
    it('should return risingHype for RISING badge', () => {
      const result = service.compute({
        badgeKey: BADGE_KEY.RISING,
        externalRatings: { imdb: { rating: 6.8, voteCount: 100 } },
      });

      expect(result.verdict.type).toBe('popularity');
      expect(result.verdict.messageKey).toBe('risingHype');
    });
  });

  describe('early reviews', () => {
    it('should return earlyReviews when ratings exist but not confident and rating >= 6.0', () => {
      const result = service.compute({
        externalRatings: { imdb: { rating: 7.0, voteCount: 50 } },
      });

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('earlyReviews');
    });

    it('should return belowAverage warning when early rating is low (< 6.0)', () => {
      const result = service.compute({
        externalRatings: { imdb: { rating: 5.5, voteCount: 50 } },
      });

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('belowAverage');
    });
  });

  describe('status hints', () => {
    it('should add newSeason hint for returning series with recent lastAirDate', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      const result = service.compute({
        status: ShowStatus.RETURNING_SERIES,
        lastAirDate: recentDate,
        externalRatings: { imdb: { rating: 7.5, voteCount: 500 } },
      });

      expect(result.statusHint?.messageKey).toBe('newSeason');
    });

    it('should add seriesFinale hint for ended shows with good quality', () => {
      const result = service.compute({
        status: ShowStatus.ENDED,
        externalRatings: { imdb: { rating: 7.5, voteCount: 500 } },
      });

      expect(result.statusHint?.messageKey).toBe('seriesFinale');
    });

    it('should NOT add status hint for warnings', () => {
      const result = service.compute({
        status: ShowStatus.CANCELED,
        externalRatings: { imdb: { rating: 8.0, voteCount: 1000 } },
      });

      expect(result.verdict.messageKey).toBe('cancelled');
      expect(result.statusHint).toBeNull();
    });
  });

  describe('fallbacks', () => {
    it('should return mixedReviews for consensus 6.0-6.5 with confident votes', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 6.3, voteCount: 300 },
          tmdb: { rating: 6.2, voteCount: 200 },
        },
      });

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('mixedReviews');
    });

    it('should return null verdict when no data', () => {
      const result = service.compute({});

      expect(result.verdict.messageKey).toBeNull();
    });
  });

  describe('rating source in context', () => {
    it('should use source with highest votes in context', () => {
      const result = service.compute({
        externalRatings: {
          imdb: { rating: 7.5, voteCount: 100 },
          trakt: { rating: 7.3, voteCount: 500 },
          tmdb: { rating: 7.4, voteCount: 200 },
        },
      });

      // Trakt has highest votes
      expect(result.verdict.context).toContain('Trakt');
    });
  });

  describe('computeShowVerdict standalone function', () => {
    it('should work the same as service.compute', () => {
      const input = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: { imdb: { rating: 7.5, voteCount: 500 } },
      };

      const serviceResult = service.compute(input);
      const functionResult = computeShowVerdict(input);

      expect(functionResult).toEqual(serviceResult);
    });
  });
});
