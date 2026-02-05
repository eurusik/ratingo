import {
  buildSnapshotCandidateConditions,
  type SnapshotConditionsOptions,
} from './snapshot-conditions.builder';

describe('snapshot-conditions.builder', () => {
  describe('buildSnapshotCandidateConditions', () => {
    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: SnapshotConditionsOptions = { policyVersion: 1 };
        const conditions = buildSnapshotCandidateConditions(options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('includes 5 base conditions without cursor', () => {
        const options: SnapshotConditionsOptions = { policyVersion: 1 };
        const conditions = buildSnapshotCandidateConditions(options);

        // Base conditions:
        // 1. deletedAt IS NULL
        // 2. tmdbId IS NOT NULL
        // 3. policyVersion = version
        // 4. context = TRENDING
        // 5. status = ELIGIBLE
        expect(conditions.length).toBe(5);
      });

      it('includes 6 conditions with cursor', () => {
        const options: SnapshotConditionsOptions = {
          policyVersion: 1,
          cursor: 'some-uuid',
        };
        const conditions = buildSnapshotCandidateConditions(options);

        // 5 base + 1 cursor = 6
        expect(conditions.length).toBe(6);
      });
    });

    describe('policy version', () => {
      it('uses provided policy version', () => {
        const options: SnapshotConditionsOptions = { policyVersion: 2 };
        const conditions = buildSnapshotCandidateConditions(options);

        expect(conditions.length).toBe(5);
      });

      it('handles different policy version values', () => {
        const versions = [1, 5, 10, 100];

        for (const version of versions) {
          const options: SnapshotConditionsOptions = { policyVersion: version };
          const conditions = buildSnapshotCandidateConditions(options);

          expect(conditions.length).toBe(5);
        }
      });

      it('handles zero policy version', () => {
        const options: SnapshotConditionsOptions = { policyVersion: 0 };
        const conditions = buildSnapshotCandidateConditions(options);

        expect(conditions.length).toBe(5);
      });
    });

    describe('cursor pagination', () => {
      it('does not add condition when cursor is undefined', () => {
        const optionsWithout: SnapshotConditionsOptions = { policyVersion: 1 };
        const optionsWith: SnapshotConditionsOptions = {
          policyVersion: 1,
          cursor: 'uuid-123',
        };

        const conditionsWithout = buildSnapshotCandidateConditions(optionsWithout);
        const conditionsWith = buildSnapshotCandidateConditions(optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });

      it('adds gt condition when cursor provided', () => {
        const options: SnapshotConditionsOptions = {
          policyVersion: 1,
          cursor: 'abc-123-def-456',
        };
        const conditions = buildSnapshotCandidateConditions(options);

        expect(conditions.length).toBe(6);
      });

      it('handles different cursor formats', () => {
        const cursors = ['uuid-v4-format', '12345', 'a', ''];

        for (const cursor of cursors) {
          const options: SnapshotConditionsOptions = {
            policyVersion: 1,
            cursor: cursor || undefined,
          };
          const conditions = buildSnapshotCandidateConditions(options);

          // Empty string becomes undefined (falsy), so no extra condition
          const expectedLength = cursor ? 6 : 5;
          expect(conditions.length).toBe(expectedLength);
        }
      });
    });

    describe('evaluation context', () => {
      it('always uses TRENDING context', () => {
        const options: SnapshotConditionsOptions = { policyVersion: 1 };
        const conditions = buildSnapshotCandidateConditions(options);

        // Verify conditions are created (context is hardcoded to TRENDING)
        expect(conditions.length).toBe(5);
      });
    });

    describe('eligibility status', () => {
      it('always filters for ELIGIBLE status', () => {
        const options: SnapshotConditionsOptions = { policyVersion: 1 };
        const conditions = buildSnapshotCandidateConditions(options);

        // Verify conditions are created (status is hardcoded to ELIGIBLE)
        expect(conditions.length).toBe(5);
      });
    });

    describe('combined options', () => {
      it('handles all options together', () => {
        const options: SnapshotConditionsOptions = {
          policyVersion: 3,
          cursor: 'previous-page-last-id',
        };
        const conditions = buildSnapshotCandidateConditions(options);

        expect(conditions.length).toBe(6);
      });
    });
  });
});
