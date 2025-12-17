import { computeShowVerdict, ShowVerdictInput } from './show-verdict.utils';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { BADGE_KEY } from '../../../shared/cards/domain/card.constants';

// Helper to create external ratings
const makeRatings = (imdb?: number, trakt?: number, tmdb?: number, votes = 500) => ({
  imdb: imdb !== undefined ? { rating: imdb, voteCount: votes } : null,
  trakt: trakt !== undefined ? { rating: trakt, voteCount: votes } : null,
  tmdb: tmdb !== undefined ? { rating: tmdb, voteCount: votes } : null,
});

describe('computeShowVerdict', () => {
  // ═══════════════════════════════════════════════════════════════
  // CONSENSUS RATING (MEDIAN) CALCULATION
  // ═══════════════════════════════════════════════════════════════

  describe('consensus rating calculation', () => {
    it('should use median of all ratings (odd count)', () => {
      // ratings: [7.2, 7.5, 7.8] -> median = 7.5, spread = 0.6 (ok)
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(7.8, 7.5, 7.2, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.context).toContain('7.5');
    });

    it('should use median of all ratings (even count)', () => {
      // ratings: [6.5, 7.0] -> median = 6.75, spread = 0.5
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 7.0, voteCount: 500 },
          trakt: { rating: 6.5, voteCount: 500 },
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('decentRatings');
    });

    it('should handle single rating source', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 1500 },
          trakt: null,
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('criticsLoved');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SPREAD CHECK (OPINIONS DIVERGE)
  // ═══════════════════════════════════════════════════════════════

  describe('spread check', () => {
    it('should return noConsensusYet when spread > 1.0 with low votes', () => {
      // ratings: [5.5, 7.5] -> spread = 2.0, median = 6.5
      // Low votes = noConsensusYet (ratings still forming)
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 7.5, voteCount: 50 },
          trakt: { rating: 5.5, voteCount: 50 },
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('noConsensusYet');
    });

    it('should return mixedReviews when spread > 1.0 with confident votes', () => {
      // ratings: [5.5, 7.5] -> spread = 2.0, median = 6.5
      // High votes = mixedReviews (people genuinely disagree)
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 7.5, voteCount: 500 },
          trakt: { rating: 5.5, voteCount: 500 },
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('mixedReviews');
    });

    it('should return mixedReviews when spread == 1.0 with high votes (1000+)', () => {
      // Rule A: spread == 1.0 with 1000+ votes is also high spread
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 7.5, voteCount: 1000 },
          trakt: { rating: 6.5, voteCount: 500 },
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('mixedReviews');
    });

    it('should NOT block optimistic verdict when spread == 1.0 with low votes (< 1000)', () => {
      // spread = 1.0 but totalVotes < 1000 -> not high spread
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 300 },
          trakt: { rating: 7.0, voteCount: 300 },
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('strongRatings');
    });

    it('should NOT block optimistic verdict when spread < 1.0', () => {
      // ratings: [7.5, 8.0] -> spread = 0.5, median = 7.75
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 8.0, voteCount: 1000 },
          trakt: { rating: 7.5, voteCount: 500 },
          tmdb: null,
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('criticsLoved');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 1: CANCELLED (highest warning)
  // ═══════════════════════════════════════════════════════════════

  describe('cancelled shows', () => {
    it('should return cancelled warning for cancelled show', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.CANCELED,
        externalRatings: makeRatings(8.0, 8.0, 8.0, 5000),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('cancelled');
      expect(result.verdict.context).toBeNull();
      expect(result.statusHint).toBeNull();
    });

    it('should prioritize cancelled over good ratings and NOT show statusHint', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.CANCELED,
        externalRatings: makeRatings(9.0, 9.0, 9.0, 10000),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.messageKey).toBe('cancelled');
      expect(result.statusHint).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 2: QUALITY WARNINGS
  // ═══════════════════════════════════════════════════════════════

  describe('quality warnings', () => {
    it('should return poorRatings for consensus < 5.5 with confident votes', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(4.5, 4.5, 4.5, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('poorRatings');
      expect(result.statusHint).toBeNull();
    });

    it('should return belowAverage for consensus 5.5-6.0 with confident votes', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(5.8, 5.8, 5.8, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('belowAverage');
      expect(result.statusHint).toBeNull();
    });

    it('should return belowAverage for low rating even with low votes', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(4.0, 4.0, 4.0, 50),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('belowAverage');
    });

    it('should NOT show newSeason statusHint for shows with poor ratings (INVARIANT)', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(4.5, 4.5, 4.5, 500),
        lastAirDate: recentDate,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.messageKey).toBe('poorRatings');
      expect(result.statusHint).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 3: QUALITY SIGNALS
  // ═══════════════════════════════════════════════════════════════

  describe('quality signals', () => {
    it('should return criticsLoved for consensus >= 7.5 with 1000+ votes and low spread', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(8.0, 8.0, 8.0, 1000),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('criticsLoved');
    });

    it('should return strongRatings for consensus >= 7.0', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(7.2, 7.2, 7.2, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('strongRatings');
    });

    it('should return decentRatings for consensus 6.5-7.0', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(6.7, 6.7, 6.7, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('decentRatings');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STATUS HINTS
  // ═══════════════════════════════════════════════════════════════

  describe('status hints', () => {
    it('should add newSeason statusHint for recent season with good ratings', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(7.2, 7.2, 7.2, 500),
        lastAirDate: recentDate,
      };

      const result = computeShowVerdict(show);

      // Good quality verdict + recent season = newSeason hint
      expect(result.verdict.type).toBe('quality');
      expect(result.statusHint).not.toBeNull();
      expect(result.statusHint?.messageKey).toBe('newSeason');
    });

    it('should add seriesFinale statusHint for ended show with good ratings', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.ENDED,
        externalRatings: makeRatings(7.5, 7.5, 7.5, 500),
      };

      const result = computeShowVerdict(show);

      // 7.5 >= 7.0 = strongRatings, ended + good quality = seriesFinale hint
      expect(result.verdict.type).toBe('quality');
      expect(result.statusHint).not.toBeNull();
      expect(result.statusHint?.messageKey).toBe('seriesFinale');
    });

    it('should NOT add statusHint for ended show with low ratings', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.ENDED,
        externalRatings: makeRatings(5.0, 5.0, 5.0, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.statusHint).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // LONG RUNNING
  // ═══════════════════════════════════════════════════════════════

  describe('long running shows', () => {
    it('should return longRunning for 5+ seasons when no confident quality rating', () => {
      // longRunning only triggers when quality signals don't apply
      // (i.e., not enough votes for confident rating)
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(6.8, 6.8, 6.8, 50), // low votes
        totalSeasons: 7,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('quality');
      expect(result.verdict.messageKey).toBe('longRunning');
      expect(result.verdict.context).toBe('7 сезонів');
    });

    it('should not return longRunning for cancelled shows', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.CANCELED,
        externalRatings: makeRatings(7.5, 7.5, 7.5, 100),
        totalSeasons: 8,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.messageKey).toBe('cancelled');
    });

    it('should not return longRunning for shows with low ratings', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(5.0, 5.0, 5.0, 500),
        totalSeasons: 10,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('poorRatings'); // 5.0 < 5.5 = poorRatings
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POPULARITY
  // ═══════════════════════════════════════════════════════════════

  describe('popularity verdicts', () => {
    it('should return risingHype for RISING badge', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(6.0, 6.0, 6.0, 100),
        badgeKey: BADGE_KEY.RISING,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('popularity');
      expect(result.verdict.messageKey).toBe('risingHype');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // EARLY REVIEWS
  // ═══════════════════════════════════════════════════════════════

  describe('early reviews', () => {
    it('should return earlyReviews when ratings exist but not confident and rating >= 6.0', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(7.0, 7.0, 7.0, 50),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('earlyReviews');
    });

    it('should return belowAverage warning when early rating is low (< 6.0)', () => {
      const recentDate = new Date();

      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(5.5, 5.5, 5.5, 50),
        lastAirDate: recentDate,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('warning');
      expect(result.verdict.messageKey).toBe('belowAverage');
      expect(result.statusHint).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FALLBACKS
  // ═══════════════════════════════════════════════════════════════

  describe('fallbacks', () => {
    it('should return mixedReviews for consensus 6.0-6.5 with confident votes', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: makeRatings(6.2, 6.2, 6.2, 500),
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBe('mixedReviews');
    });

    it('should return null verdict when no data', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.type).toBe('general');
      expect(result.verdict.messageKey).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RATING SOURCE IN CONTEXT
  // ═══════════════════════════════════════════════════════════════

  describe('rating source in context', () => {
    it('should use source with highest votes in context', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: {
          imdb: { rating: 7.5, voteCount: 10000 },
          trakt: { rating: 7.5, voteCount: 500 },
          tmdb: { rating: 7.5, voteCount: 1000 },
        },
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.context).toContain('IMDb');
    });

    it('should default to IMDb label when no ratings', () => {
      const show: ShowVerdictInput = {
        status: ShowStatus.RETURNING_SERIES,
        externalRatings: null,
      };

      const result = computeShowVerdict(show);

      expect(result.verdict.context).toBeNull();
    });
  });
});
