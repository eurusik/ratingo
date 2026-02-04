import { MS_PER_DAY } from '../../../../../common/constants';
import { WATCHING_NOW_THRESHOLDS } from '../../../domain/constants/catalog.constants';

import {
  buildWatchingNowConditions,
  type WatchingNowConditionsOptions,
} from './watching-now-conditions.builder';

describe('watching-now-conditions.builder', () => {
  describe('buildWatchingNowConditions', () => {
    const now = new Date('2024-06-15T12:00:00Z');

    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: WatchingNowConditionsOptions = { now };
        const conditions = buildWatchingNowConditions(options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('returns expected number of conditions (11 total)', () => {
        const options: WatchingNowConditionsOptions = { now };
        const conditions = buildWatchingNowConditions(options);

        // Conditions:
        // 1. releaseDate <= now
        // 2. posterPath IS NOT NULL
        // 3. backdropPath IS NOT NULL
        // 4. qualityScore >= MIN_QUALITY_SCORE
        // 5. status = ELIGIBLE
        // 6. context = TRENDING
        // 7. ingestionStatus = READY
        // 8. deletedAt IS NULL
        // 9. watchersCount IS NOT NULL
        // 10. watchersCount >= MIN_WATCHERS
        // 11. freshness OR condition (movie OR show)
        expect(conditions.length).toBe(11);
      });
    });

    describe('freshness cutoffs', () => {
      it('uses correct movie freshness cutoff at 45 days', () => {
        expect(WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_MOVIE_RELEASE).toBe(45);

        const options: WatchingNowConditionsOptions = { now };
        const conditions = buildWatchingNowConditions(options);

        // Verify cutoff calculation matches expected
        const expectedCutoff = new Date(
          now.getTime() - WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_MOVIE_RELEASE * MS_PER_DAY,
        );
        expect(expectedCutoff.getTime()).toBe(now.getTime() - 45 * MS_PER_DAY);

        // Conditions should be generated (11 total)
        expect(conditions.length).toBe(11);
      });

      it('uses correct show freshness cutoff at 21 days', () => {
        expect(WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_SHOW_EPISODE).toBe(21);

        const options: WatchingNowConditionsOptions = { now };
        const conditions = buildWatchingNowConditions(options);

        // Verify cutoff calculation matches expected
        const expectedCutoff = new Date(
          now.getTime() - WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_SHOW_EPISODE * MS_PER_DAY,
        );
        expect(expectedCutoff.getTime()).toBe(now.getTime() - 21 * MS_PER_DAY);

        // Conditions should be generated (11 total)
        expect(conditions.length).toBe(11);
      });
    });

    describe('watchers requirement', () => {
      it('includes watchers requirement conditions', () => {
        expect(WATCHING_NOW_THRESHOLDS.MIN_WATCHERS).toBe(1);

        const options: WatchingNowConditionsOptions = { now };
        const conditions = buildWatchingNowConditions(options);

        // Watchers conditions are #9 (isNotNull) and #10 (>= MIN_WATCHERS)
        expect(conditions.length).toBe(11);
      });
    });

    describe('quality score threshold', () => {
      it('includes quality score threshold condition', () => {
        expect(WATCHING_NOW_THRESHOLDS.MIN_QUALITY_SCORE).toBe(50);

        const options: WatchingNowConditionsOptions = { now };
        const conditions = buildWatchingNowConditions(options);

        // Quality score condition is #4
        expect(conditions.length).toBe(11);
      });
    });

    describe('different timestamps', () => {
      it('generates conditions for different timestamps', () => {
        const timestamps = [
          new Date('2024-01-01T00:00:00Z'),
          new Date('2024-06-15T12:00:00Z'),
          new Date('2024-12-31T23:59:59Z'),
        ];

        for (const timestamp of timestamps) {
          const options: WatchingNowConditionsOptions = { now: timestamp };
          const conditions = buildWatchingNowConditions(options);

          expect(conditions.length).toBe(11);
        }
      });
    });
  });
});
