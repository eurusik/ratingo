/**
 * GlobalRequirementsDto Property-Based Tests
 *
 * Feature: global-quality-gate
 * Property 9: DTO Validation Correctness
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { GlobalRequirementsDto, RatingSourceEnum } from './global-requirements.dto';

describe('GlobalRequirementsDto - Property-Based Tests', () => {
  // Helper to get all validation error messages
  const getValidationMessages = (errors: ValidationError[]): string[] => {
    const messages: string[] = [];
    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }
      if (error.children && error.children.length > 0) {
        messages.push(...getValidationMessages(error.children));
      }
    }
    return messages;
  };

  // Arbitraries for valid data
  const validRatingSourceArb = fc.constantFrom(
    RatingSourceEnum.IMDB,
    RatingSourceEnum.METACRITIC,
    RatingSourceEnum.RT,
    RatingSourceEnum.TRAKT,
  );

  const validGlobalRequirementsArb = fc.record({
    minImdbVotes: fc.option(fc.nat({ max: 1000000 }), { nil: undefined }),
    minTraktVotes: fc.option(fc.nat({ max: 100000 }), { nil: undefined }),
    minQualityScoreNormalized: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), {
      nil: undefined,
    }),
    requireAnyOfRatingsPresent: fc.option(
      fc.array(validRatingSourceArb, { minLength: 1, maxLength: 4 }),
      { nil: undefined },
    ),
  });

  /**
   * Property 9: DTO Validation Correctness
   * Validates: Requirements 5.1-5.5
   */
  describe('Property 9: DTO Validation Correctness', () => {
    it('should accept valid global requirements', () => {
      fc.assert(
        fc.property(validGlobalRequirementsArb, (requirementsData) => {
          const dto = plainToInstance(GlobalRequirementsDto, requirementsData);
          const errors = validateSync(dto);

          expect(errors.length).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should accept empty requirements object', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {});
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept empty array for requireAnyOfRatingsPresent', () => {
      // Empty array should be accepted (engine skips check)
      const dto = plainToInstance(GlobalRequirementsDto, {
        requireAnyOfRatingsPresent: [],
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should reject negative minImdbVotes', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.integer({ min: -1000000, max: -1 }),
          (requirementsData, invalidVotes) => {
            const invalidData = {
              ...requirementsData,
              minImdbVotes: invalidVotes,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
            const messages = getValidationMessages(errors);
            expect(messages.some((m) => m.toLowerCase().includes('min'))).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject non-integer minImdbVotes', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.double({ min: 0.1, max: 1000, noInteger: true }),
          (requirementsData, invalidVotes) => {
            const invalidData = {
              ...requirementsData,
              minImdbVotes: invalidVotes,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject negative minTraktVotes', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.integer({ min: -100000, max: -1 }),
          (requirementsData, invalidVotes) => {
            const invalidData = {
              ...requirementsData,
              minTraktVotes: invalidVotes,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
            const messages = getValidationMessages(errors);
            expect(messages.some((m) => m.toLowerCase().includes('min'))).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject non-integer minTraktVotes', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.double({ min: 0.1, max: 1000, noInteger: true }),
          (requirementsData, invalidVotes) => {
            const invalidData = {
              ...requirementsData,
              minTraktVotes: invalidVotes,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject minQualityScoreNormalized > 1', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.double({ min: 1.01, max: 100 }),
          (requirementsData, invalidScore) => {
            const invalidData = {
              ...requirementsData,
              minQualityScoreNormalized: invalidScore,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject minQualityScoreNormalized < 0', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.double({ min: -100, max: -0.01 }),
          (requirementsData, invalidScore) => {
            const invalidData = {
              ...requirementsData,
              minQualityScoreNormalized: invalidScore,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject invalid rating sources', () => {
      // Generate invalid rating sources (not in RatingSourceEnum)
      const invalidRatingSourceArb = fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => s !== 'imdb' && s !== 'metacritic' && s !== 'rt' && s !== 'trakt');

      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.array(invalidRatingSourceArb, { minLength: 1, maxLength: 3 }),
          (requirementsData, invalidSources) => {
            const invalidData = {
              ...requirementsData,
              requireAnyOfRatingsPresent: invalidSources,
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject non-array requireAnyOfRatingsPresent', () => {
      const invalidData = {
        requireAnyOfRatingsPresent: 'imdb', // Should be array
      };
      const dto = plainToInstance(GlobalRequirementsDto, invalidData);
      const errors = validateSync(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  /**
   * Additional validation tests for edge cases
   */
  describe('Edge Cases', () => {
    it('should accept minImdbVotes = 0', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minImdbVotes: 0,
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept minTraktVotes = 0', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minTraktVotes: 0,
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept minQualityScoreNormalized = 0', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minQualityScoreNormalized: 0,
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept minQualityScoreNormalized = 1', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minQualityScoreNormalized: 1,
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept all fields set to valid values', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minImdbVotes: 3000,
        minTraktVotes: 1000,
        minQualityScoreNormalized: 0.6,
        requireAnyOfRatingsPresent: [RatingSourceEnum.IMDB, RatingSourceEnum.METACRITIC],
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });
  });
});
