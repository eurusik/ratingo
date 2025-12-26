/**
 * Status Validation Property-Based Tests
 *
 * Feature: catalog-policy-refactoring
 * Property 7: Unexpected Values Cause Explicit Errors
 * Validates: Requirements 7.5
 */

import * as fc from 'fast-check';
import { validateStatus, isValidEligibilityStatus } from './status.validation';
import { EligibilityStatus, EligibilityStatusType } from '../constants/evaluation.constants';
import { InvalidEligibilityStatusError } from '../errors/policy.errors';

describe('Status Validation - Property-Based Tests', () => {
  // Canonical lowercase status values
  const CANONICAL_STATUSES: EligibilityStatusType[] = [
    EligibilityStatus.PENDING,
    EligibilityStatus.ELIGIBLE,
    EligibilityStatus.INELIGIBLE,
    EligibilityStatus.REVIEW,
  ];

  // Arbitraries for generating test data
  const canonicalStatusArb = fc.constantFrom(...CANONICAL_STATUSES);

  // Generate strings that are NOT valid statuses
  const invalidStatusArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !CANONICAL_STATUSES.includes(s as EligibilityStatusType));

  // Generate uppercase versions of valid statuses
  const uppercaseStatusArb = fc.constantFrom('PENDING', 'ELIGIBLE', 'INELIGIBLE', 'REVIEW');

  // Generate mixed case versions
  const mixedCaseStatusArb = fc.constantFrom(
    'Pending',
    'PENDING',
    'Eligible',
    'ELIGIBLE',
    'Ineligible',
    'INELIGIBLE',
    'Review',
    'REVIEW',
    'pEnDiNg',
    'eLiGiBlE',
  );

  /**
   * Property 7: Unexpected Values Cause Explicit Errors
   *
   * For any status not in canonical set, system throws explicit error.
   * Validates: Requirements 7.5
   */
  describe('Property 7: Unexpected Values Cause Explicit Errors', () => {
    it('should accept all canonical lowercase status values', () => {
      fc.assert(
        fc.property(canonicalStatusArb, (status) => {
          // Should not throw for valid statuses
          const result = validateStatus(status);
          expect(result).toBe(status);
          expect(CANONICAL_STATUSES).toContain(result);
        }),
        { numRuns: 100 },
      );
    });

    it('should throw InvalidEligibilityStatusError for uppercase status values', () => {
      fc.assert(
        fc.property(uppercaseStatusArb, (status) => {
          // Uppercase versions should throw
          expect(() => validateStatus(status)).toThrow(InvalidEligibilityStatusError);

          try {
            validateStatus(status);
          } catch (error) {
            expect(error).toBeInstanceOf(InvalidEligibilityStatusError);
            expect((error as InvalidEligibilityStatusError).invalidStatus).toBe(status);
            expect((error as InvalidEligibilityStatusError).validStatuses).toEqual(
              CANONICAL_STATUSES,
            );
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should throw InvalidEligibilityStatusError for mixed case status values', () => {
      fc.assert(
        fc.property(mixedCaseStatusArb, (status) => {
          // Mixed case versions should throw
          expect(() => validateStatus(status)).toThrow(InvalidEligibilityStatusError);
        }),
        { numRuns: 100 },
      );
    });

    it('should throw InvalidEligibilityStatusError for arbitrary invalid strings', () => {
      fc.assert(
        fc.property(invalidStatusArb, (status) => {
          // Any string not in canonical set should throw
          expect(() => validateStatus(status)).toThrow(InvalidEligibilityStatusError);

          try {
            validateStatus(status);
          } catch (error) {
            expect(error).toBeInstanceOf(InvalidEligibilityStatusError);
            expect((error as InvalidEligibilityStatusError).invalidStatus).toBe(status);
            // Error message should include the invalid status
            expect((error as Error).message).toContain(status);
            // Error message should list valid statuses
            for (const validStatus of CANONICAL_STATUSES) {
              expect((error as Error).message).toContain(validStatus);
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should never silently convert or fix invalid status values', () => {
      fc.assert(
        fc.property(invalidStatusArb, (status) => {
          // The function should either return the exact input (if valid)
          // or throw an error - never return a "fixed" value
          let result: string | undefined;
          let threw = false;

          try {
            result = validateStatus(status);
          } catch {
            threw = true;
          }

          // For invalid input, it must throw
          expect(threw).toBe(true);
          expect(result).toBeUndefined();
        }),
        { numRuns: 100 },
      );
    });

    it('should have consistent behavior between validateStatus and isValidEligibilityStatus', () => {
      // Test with valid statuses
      fc.assert(
        fc.property(canonicalStatusArb, (status) => {
          const isValid = isValidEligibilityStatus(status);
          let validateThrew = false;

          try {
            validateStatus(status);
          } catch {
            validateThrew = true;
          }

          // If isValid returns true, validateStatus should not throw
          expect(isValid).toBe(true);
          expect(validateThrew).toBe(false);
        }),
        { numRuns: 100 },
      );

      // Test with invalid statuses
      fc.assert(
        fc.property(invalidStatusArb, (status) => {
          const isValid = isValidEligibilityStatus(status);
          let validateThrew = false;

          try {
            validateStatus(status);
          } catch {
            validateThrew = true;
          }

          // If isValid returns false, validateStatus should throw
          expect(isValid).toBe(false);
          expect(validateThrew).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
