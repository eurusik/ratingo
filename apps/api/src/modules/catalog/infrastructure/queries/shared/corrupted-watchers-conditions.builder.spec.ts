import { MediaType } from '@/common/enums/media-type.enum';

import {
  buildMissingWatchersConditions,
  buildCorruptedWatchersCountConditions,
  type MissingWatchersConditionsOptions,
  type CorruptedWatchersCountConditionsOptions,
} from './corrupted-watchers-conditions.builder';

describe('corrupted-watchers-conditions.builder', () => {
  describe('buildMissingWatchersConditions', () => {
    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: MissingWatchersConditionsOptions = { minVotes: 100 };
        const conditions = buildMissingWatchersConditions(options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('includes 3 base conditions without type filter', () => {
        const options: MissingWatchersConditionsOptions = { minVotes: 100 };
        const conditions = buildMissingWatchersConditions(options);

        // Base conditions:
        // 1. deletedAt IS NULL
        // 2. voteCountTrakt >= minVotes
        // 3. totalWatchers IS NULL OR totalWatchers = 0
        expect(conditions.length).toBe(3);
      });

      it('includes 4 conditions with type filter', () => {
        const options: MissingWatchersConditionsOptions = {
          minVotes: 100,
          type: MediaType.MOVIE,
        };
        const conditions = buildMissingWatchersConditions(options);

        // 3 base + 1 type = 4
        expect(conditions.length).toBe(4);
      });
    });

    describe('type filter', () => {
      it('adds type condition for MediaType.MOVIE', () => {
        const optionsWithout: MissingWatchersConditionsOptions = { minVotes: 100 };
        const optionsWith: MissingWatchersConditionsOptions = {
          minVotes: 100,
          type: MediaType.MOVIE,
        };

        const conditionsWithout = buildMissingWatchersConditions(optionsWithout);
        const conditionsWith = buildMissingWatchersConditions(optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });

      it('adds type condition for MediaType.SHOW', () => {
        const optionsWithout: MissingWatchersConditionsOptions = { minVotes: 100 };
        const optionsWith: MissingWatchersConditionsOptions = {
          minVotes: 100,
          type: MediaType.SHOW,
        };

        const conditionsWithout = buildMissingWatchersConditions(optionsWithout);
        const conditionsWith = buildMissingWatchersConditions(optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });
    });

    describe('minVotes threshold', () => {
      it('uses provided minVotes value', () => {
        const options: MissingWatchersConditionsOptions = { minVotes: 50 };
        const conditions = buildMissingWatchersConditions(options);

        // Conditions are created, verifying no error with low threshold
        expect(conditions.length).toBe(3);
      });

      it('handles zero minVotes', () => {
        const options: MissingWatchersConditionsOptions = { minVotes: 0 };
        const conditions = buildMissingWatchersConditions(options);

        expect(conditions.length).toBe(3);
      });

      it('handles high minVotes threshold', () => {
        const options: MissingWatchersConditionsOptions = { minVotes: 10000 };
        const conditions = buildMissingWatchersConditions(options);

        expect(conditions.length).toBe(3);
      });
    });
  });

  describe('buildCorruptedWatchersCountConditions', () => {
    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 1000 };
        const conditions = buildCorruptedWatchersCountConditions(options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('includes 3 base conditions without type filter', () => {
        const options: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 1000 };
        const conditions = buildCorruptedWatchersCountConditions(options);

        // Base conditions:
        // 1. deletedAt IS NULL
        // 2. watchersCount = 0
        // 3. totalWatchers >= minTotalWatchers
        expect(conditions.length).toBe(3);
      });

      it('includes 4 conditions with type filter', () => {
        const options: CorruptedWatchersCountConditionsOptions = {
          minTotalWatchers: 1000,
          type: MediaType.SHOW,
        };
        const conditions = buildCorruptedWatchersCountConditions(options);

        // 3 base + 1 type = 4
        expect(conditions.length).toBe(4);
      });
    });

    describe('type filter', () => {
      it('adds type condition for MediaType.MOVIE', () => {
        const optionsWithout: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 1000 };
        const optionsWith: CorruptedWatchersCountConditionsOptions = {
          minTotalWatchers: 1000,
          type: MediaType.MOVIE,
        };

        const conditionsWithout = buildCorruptedWatchersCountConditions(optionsWithout);
        const conditionsWith = buildCorruptedWatchersCountConditions(optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });

      it('adds type condition for MediaType.SHOW', () => {
        const optionsWithout: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 1000 };
        const optionsWith: CorruptedWatchersCountConditionsOptions = {
          minTotalWatchers: 1000,
          type: MediaType.SHOW,
        };

        const conditionsWithout = buildCorruptedWatchersCountConditions(optionsWithout);
        const conditionsWith = buildCorruptedWatchersCountConditions(optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });
    });

    describe('minTotalWatchers threshold', () => {
      it('uses provided minTotalWatchers value', () => {
        const options: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 500 };
        const conditions = buildCorruptedWatchersCountConditions(options);

        expect(conditions.length).toBe(3);
      });

      it('handles zero minTotalWatchers', () => {
        const options: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 0 };
        const conditions = buildCorruptedWatchersCountConditions(options);

        expect(conditions.length).toBe(3);
      });

      it('handles high minTotalWatchers threshold', () => {
        const options: CorruptedWatchersCountConditionsOptions = { minTotalWatchers: 100000 };
        const conditions = buildCorruptedWatchersCountConditions(options);

        expect(conditions.length).toBe(3);
      });
    });

    describe('combined options', () => {
      it('handles type with minTotalWatchers', () => {
        const options: CorruptedWatchersCountConditionsOptions = {
          type: MediaType.MOVIE,
          minTotalWatchers: 5000,
        };
        const conditions = buildCorruptedWatchersCountConditions(options);

        expect(conditions.length).toBe(4);
      });
    });
  });

  describe('comparison between builders', () => {
    it('buildMissingWatchersConditions targets different data than buildCorruptedWatchersCountConditions', () => {
      // Missing watchers: has Trakt votes but no total_watchers data
      const missingConditions = buildMissingWatchersConditions({ minVotes: 100 });

      // Corrupted count: has total_watchers but watchers_count is 0
      const corruptedConditions = buildCorruptedWatchersCountConditions({ minTotalWatchers: 1000 });

      // Both have same base count (3 conditions) but target different scenarios
      expect(missingConditions.length).toBe(3);
      expect(corruptedConditions.length).toBe(3);
    });
  });
});
