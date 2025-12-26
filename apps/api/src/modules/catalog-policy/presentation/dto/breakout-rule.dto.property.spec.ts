/**
 * BreakoutRuleDto Property-Based Tests
 *
 * Feature: catalog-policy-refactoring
 * Property 3: Invalid BreakoutRules Are Rejected
 * Validates: Requirements 4.2, 4.3
 */

import 'reflect-metadata';
import * as fc from 'fast-check';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import {
  BreakoutRuleDto,
  BreakoutRuleRequirementsDto,
  VALID_RATING_SOURCES,
} from './breakout-rule.dto';

describe('BreakoutRuleDto - Property-Based Tests', () => {
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
  // Use alphanumeric strings to avoid whitespace-only strings
  const validIdArb = fc
    .stringMatching(/^[a-zA-Z0-9_-]+$/)
    .filter((s) => s.length >= 1 && s.length <= 50);
  const validNameArb = fc
    .stringMatching(/^[a-zA-Z0-9_ -]+$/)
    .filter((s) => s.trim().length >= 1 && s.length <= 100);
  const validPriorityArb = fc.nat({ max: 1000 });
  const validRatingSourceArb = fc.constantFrom(...VALID_RATING_SOURCES);

  // Use noNaN option to exclude NaN values from double generation
  const validRequirementsArb = fc.record({
    minImdbVotes: fc.option(fc.nat({ max: 1000000 }), { nil: undefined }),
    minTraktVotes: fc.option(fc.nat({ max: 100000 }), { nil: undefined }),
    minQualityScoreNormalized: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), {
      nil: undefined,
    }),
    requireAnyOfProviders: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }), {
      nil: undefined,
    }),
    requireAnyOfRatingsPresent: fc.option(
      fc.array(validRatingSourceArb, { minLength: 1, maxLength: 4 }),
      { nil: undefined },
    ),
  });

  const validBreakoutRuleArb = fc.record({
    id: validIdArb,
    name: validNameArb,
    priority: validPriorityArb,
    requirements: validRequirementsArb,
  });

  /**
   * Property 3: Invalid BreakoutRules Are Rejected
   * Validates: Requirements 4.2, 4.3
   */
  describe('Property 3: Invalid BreakoutRules Are Rejected', () => {
    it('should accept valid breakout rules', () => {
      fc.assert(
        fc.property(validBreakoutRuleArb, (ruleData) => {
          const dto = plainToInstance(BreakoutRuleDto, ruleData);
          const errors = validateSync(dto);

          expect(errors.length).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject breakout rules with empty id', () => {
      fc.assert(
        fc.property(validBreakoutRuleArb, (ruleData) => {
          const invalidData = { ...ruleData, id: '' };
          const dto = plainToInstance(BreakoutRuleDto, invalidData);
          const errors = validateSync(dto);

          expect(errors.length).toBeGreaterThan(0);
          const messages = getValidationMessages(errors);
          expect(messages.some((m) => m.includes('id'))).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject breakout rules with empty name', () => {
      fc.assert(
        fc.property(validBreakoutRuleArb, (ruleData) => {
          const invalidData = { ...ruleData, name: '' };
          const dto = plainToInstance(BreakoutRuleDto, invalidData);
          const errors = validateSync(dto);

          expect(errors.length).toBeGreaterThan(0);
          const messages = getValidationMessages(errors);
          expect(messages.some((m) => m.includes('name'))).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject breakout rules with negative priority', () => {
      fc.assert(
        fc.property(validBreakoutRuleArb, (ruleData) => {
          const invalidData = { ...ruleData, priority: -1 };
          const dto = plainToInstance(BreakoutRuleDto, invalidData);
          const errors = validateSync(dto);

          expect(errors.length).toBeGreaterThan(0);
          const messages = getValidationMessages(errors);
          expect(messages.some((m) => m.includes('priority'))).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject requirements with invalid rating sources', () => {
      // Generate invalid rating sources (not in VALID_RATING_SOURCES)
      const invalidRatingSourceArb = fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !VALID_RATING_SOURCES.includes(s as any));

      fc.assert(
        fc.property(
          validBreakoutRuleArb,
          fc.array(invalidRatingSourceArb, { minLength: 1, maxLength: 3 }),
          (ruleData, invalidSources) => {
            const invalidData = {
              ...ruleData,
              requirements: {
                ...ruleData.requirements,
                requireAnyOfRatingsPresent: invalidSources,
              },
            };
            const dto = plainToInstance(BreakoutRuleDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject requirements with minQualityScoreNormalized > 1', () => {
      fc.assert(
        fc.property(
          validBreakoutRuleArb,
          fc.double({ min: 1.01, max: 100 }),
          (ruleData, invalidScore) => {
            const invalidData = {
              ...ruleData,
              requirements: {
                ...ruleData.requirements,
                minQualityScoreNormalized: invalidScore,
              },
            };
            const dto = plainToInstance(BreakoutRuleDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject requirements with minQualityScoreNormalized < 0', () => {
      fc.assert(
        fc.property(
          validBreakoutRuleArb,
          fc.double({ min: -100, max: -0.01 }),
          (ruleData, invalidScore) => {
            const invalidData = {
              ...ruleData,
              requirements: {
                ...ruleData.requirements,
                minQualityScoreNormalized: invalidScore,
              },
            };
            const dto = plainToInstance(BreakoutRuleDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject requirements with negative minImdbVotes', () => {
      fc.assert(
        fc.property(
          validBreakoutRuleArb,
          fc.integer({ min: -1000000, max: -1 }),
          (ruleData, invalidVotes) => {
            const invalidData = {
              ...ruleData,
              requirements: {
                ...ruleData.requirements,
                minImdbVotes: invalidVotes,
              },
            };
            const dto = plainToInstance(BreakoutRuleDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject requirements with negative minTraktVotes', () => {
      fc.assert(
        fc.property(
          validBreakoutRuleArb,
          fc.integer({ min: -100000, max: -1 }),
          (ruleData, invalidVotes) => {
            const invalidData = {
              ...ruleData,
              requirements: {
                ...ruleData.requirements,
                minTraktVotes: invalidVotes,
              },
            };
            const dto = plainToInstance(BreakoutRuleDto, invalidData);
            const errors = validateSync(dto);

            expect(errors.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Additional Property: Valid requirements are accepted
   */
  describe('Property: Valid Requirements Are Accepted', () => {
    it('should accept valid requirements with all optional fields', () => {
      fc.assert(
        fc.property(validRequirementsArb, (requirementsData) => {
          const dto = plainToInstance(BreakoutRuleRequirementsDto, requirementsData);
          const errors = validateSync(dto);

          expect(errors.length).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should accept empty requirements object', () => {
      const dto = plainToInstance(BreakoutRuleRequirementsDto, {});
      const errors = validateSync(dto);

      expect(errors.length).toBe(0);
    });
  });
});
