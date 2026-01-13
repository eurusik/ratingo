import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';

import {
  validatePostState,
  isValidPostState,
  getPostState,
  PostState,
} from './post-state.validation';
import { JOURNAL_ERRORS } from '../domain/constants/journal-errors';

/**
 * For any post in the database, the state SHALL be one of:
 * - (isDraft=true, publishedAt=null) - Draft
 * - (isDraft=false, publishedAt!=null) - Published or Scheduled
 *
 * Invalid combinations SHALL be rejected on create/update:
 * - isDraft=false with publishedAt=null
 * - isDraft=true with publishedAt!=null
 */
describe('PostStateValidation - Property Tests', () => {
  // --- Arbitraries ---

  /** Generates a valid draft state: isDraft=true, publishedAt=null */
  const validDraftStateArb = fc.constant({ isDraft: true, publishedAt: null });

  /** Generates a valid published/scheduled state: isDraft=false, publishedAt=Date */
  const validPublishedStateArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .map((date) => ({ isDraft: false, publishedAt: date }));

  /** Generates any valid post state */
  const validPostStateArb = fc.oneof(validDraftStateArb, validPublishedStateArb);

  /** Generates invalid state: isDraft=false with publishedAt=null */
  const invalidPublishedWithoutDateArb = fc.constant({ isDraft: false, publishedAt: null });

  /** Generates invalid state: isDraft=true with publishedAt=Date */
  const invalidDraftWithDateArb = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
    .map((date) => ({ isDraft: true, publishedAt: date }));

  /** Generates any invalid post state */
  const invalidPostStateArb = fc.oneof(invalidPublishedWithoutDateArb, invalidDraftWithDateArb);

  // --- Property Tests ---

  describe('Property 15: Post state invariant', () => {
    /**
     * Valid states should be accepted.
     * For any valid state (draft or published/scheduled), validation should pass.
     */
    it('should accept valid draft state (isDraft=true, publishedAt=null)', () => {
      fc.assert(
        fc.property(validDraftStateArb, ({ isDraft, publishedAt }) => {
          // Should not throw
          expect(() => validatePostState(isDraft, publishedAt)).not.toThrow();
          expect(isValidPostState(isDraft, publishedAt)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should accept valid published/scheduled state (isDraft=false, publishedAt=Date)', () => {
      fc.assert(
        fc.property(validPublishedStateArb, ({ isDraft, publishedAt }) => {
          // Should not throw
          expect(() => validatePostState(isDraft, publishedAt)).not.toThrow();
          expect(isValidPostState(isDraft, publishedAt)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should accept all valid post states', () => {
      fc.assert(
        fc.property(validPostStateArb, ({ isDraft, publishedAt }) => {
          expect(() => validatePostState(isDraft, publishedAt)).not.toThrow();
          expect(isValidPostState(isDraft, publishedAt)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Invalid states should be rejected.
     * For any invalid state, validation should throw BadRequestException.
     */
    it('should reject invalid state: isDraft=false with publishedAt=null', () => {
      fc.assert(
        fc.property(invalidPublishedWithoutDateArb, ({ isDraft, publishedAt }) => {
          expect(() => validatePostState(isDraft, publishedAt)).toThrow(BadRequestException);
          expect(isValidPostState(isDraft, publishedAt)).toBe(false);

          try {
            validatePostState(isDraft, publishedAt);
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (error as BadRequestException).getResponse() as {
              code: string;
              message: string;
            };
            expect(response.code).toBe(JOURNAL_ERRORS.INVALID_POST_STATE);
            expect(response.message).toBe('Published posts must have a publication date');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should reject invalid state: isDraft=true with publishedAt=Date', () => {
      fc.assert(
        fc.property(invalidDraftWithDateArb, ({ isDraft, publishedAt }) => {
          expect(() => validatePostState(isDraft, publishedAt)).toThrow(BadRequestException);
          expect(isValidPostState(isDraft, publishedAt)).toBe(false);

          try {
            validatePostState(isDraft, publishedAt);
          } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException);
            const response = (error as BadRequestException).getResponse() as {
              code: string;
              message: string;
            };
            expect(response.code).toBe(JOURNAL_ERRORS.INVALID_POST_STATE);
            expect(response.message).toBe('Draft posts cannot have a publication date');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should reject all invalid post states', () => {
      fc.assert(
        fc.property(invalidPostStateArb, ({ isDraft, publishedAt }) => {
          expect(() => validatePostState(isDraft, publishedAt)).toThrow(BadRequestException);
          expect(isValidPostState(isDraft, publishedAt)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Exhaustive coverage: exactly 2 valid and 2 invalid combinations.
     */
    it('should have exactly 2 valid state combinations', () => {
      const allCombinations = [
        { isDraft: true, publishedAt: null },
        { isDraft: true, publishedAt: new Date() },
        { isDraft: false, publishedAt: null },
        { isDraft: false, publishedAt: new Date() },
      ];

      const validCount = allCombinations.filter(({ isDraft, publishedAt }) =>
        isValidPostState(isDraft, publishedAt),
      ).length;

      expect(validCount).toBe(2);
    });

    /**
     * getPostState should correctly identify draft, published, and scheduled states.
     */
    it('should correctly identify draft state', () => {
      fc.assert(
        fc.property(validDraftStateArb, ({ isDraft, publishedAt }) => {
          const state = getPostState(isDraft, publishedAt);
          expect(state).toBe('draft');
        }),
        { numRuns: 100 },
      );
    });

    it('should correctly identify published vs scheduled state based on date', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

      // Past date = published
      expect(getPostState(false, pastDate)).toBe('published');

      // Future date = scheduled
      expect(getPostState(false, futureDate)).toBe('scheduled');
    });

    it('should throw for invalid states when calling getPostState', () => {
      fc.assert(
        fc.property(invalidPostStateArb, ({ isDraft, publishedAt }) => {
          expect(() => getPostState(isDraft, publishedAt)).toThrow(BadRequestException);
        }),
        { numRuns: 100 },
      );
    });
  });
});
