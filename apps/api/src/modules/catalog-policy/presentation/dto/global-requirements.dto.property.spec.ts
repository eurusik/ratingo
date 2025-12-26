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
import { GlobalRequirementsDto, MinVotesAnyOfDto } from './global-requirements.dto';
import { RatingSource, VoteSource } from '../../domain/types/policy.types';

const RATING_SOURCES: RatingSource[] = ['imdb', 'metacritic', 'rt', 'trakt'];
const VOTE_SOURCES: VoteSource[] = ['imdb', 'trakt'];

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
  const validRatingSourceArb = fc.constantFrom(...RATING_SOURCES);
  const validVoteSourceArb = fc.constantFrom(...VOTE_SOURCES);

  const validMinVotesAnyOfArb = fc.record({
    sources: fc.array(validVoteSourceArb, { minLength: 1, maxLength: 2 }),
    min: fc.nat({ max: 1000000 }),
  });

  const validGlobalRequirementsArb = fc.record({
    minQualityScoreNormalized: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), {
      nil: undefined,
    }),
    requireAnyOfRatingsPresent: fc.option(
      fc.array(validRatingSourceArb, { minLength: 1, maxLength: 4 }),
      { nil: undefined },
    ),
    minVotesAnyOf: fc.option(validMinVotesAnyOfArb, { nil: undefined }),
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
      // Generate invalid rating sources (not in RATING_SOURCES)
      const invalidRatingSourceArb = fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !RATING_SOURCES.includes(s as RatingSource));

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

    it('should reject invalid vote sources in minVotesAnyOf', () => {
      const invalidVoteSourceArb = fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !VOTE_SOURCES.includes(s as VoteSource));

      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.array(invalidVoteSourceArb, { minLength: 1, maxLength: 2 }),
          fc.nat({ max: 100000 }),
          (requirementsData, invalidSources, min) => {
            const invalidData = {
              ...requirementsData,
              minVotesAnyOf: { sources: invalidSources, min },
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject negative min in minVotesAnyOf', () => {
      fc.assert(
        fc.property(
          validGlobalRequirementsArb,
          fc.integer({ min: -100000, max: -1 }),
          (requirementsData, invalidMin) => {
            const invalidData = {
              ...requirementsData,
              minVotesAnyOf: { sources: ['imdb'], min: invalidMin },
            };
            const dto = plainToInstance(GlobalRequirementsDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Additional validation tests for edge cases
   */
  describe('Edge Cases', () => {
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

    it('should accept minVotesAnyOf with min = 0', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minVotesAnyOf: { sources: ['imdb', 'trakt'], min: 0 },
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept all fields set to valid values', () => {
      const dto = plainToInstance(GlobalRequirementsDto, {
        minQualityScoreNormalized: 0.6,
        requireAnyOfRatingsPresent: ['imdb', 'metacritic'],
        minVotesAnyOf: { sources: ['imdb', 'trakt'], min: 3000 },
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('MinVotesAnyOfDto', () => {
    it('should accept valid minVotesAnyOf', () => {
      const dto = plainToInstance(MinVotesAnyOfDto, {
        sources: ['imdb', 'trakt'],
        min: 5000,
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept single source', () => {
      const dto = plainToInstance(MinVotesAnyOfDto, {
        sources: ['imdb'],
        min: 1000,
      });
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });
  });
});
