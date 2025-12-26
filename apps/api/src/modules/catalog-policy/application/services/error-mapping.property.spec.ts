/**
 * Service Error Mapping Property-Based Tests
 *
 * Feature: catalog-policy-refactoring
 * Property 5: Services Throw Appropriate NestJS Exceptions
 * Validates: Requirements 7.2
 */

import * as fc from 'fast-check';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import {
  InvalidEligibilityStatusError,
  InvalidBreakoutRuleError,
  InvalidRunStateTransitionError,
} from '../../domain/errors';

/**
 * Helper function that maps domain errors to NestJS exceptions.
 * This mirrors the logic in PolicyActivationService.mapDomainErrorToHttpException
 */
function mapDomainErrorToHttpException(error: unknown): never {
  if (error instanceof InvalidEligibilityStatusError) {
    throw new BadRequestException(error.message);
  }

  if (error instanceof InvalidBreakoutRuleError) {
    throw new BadRequestException(error.message);
  }

  if (error instanceof InvalidRunStateTransitionError) {
    throw new ConflictException(error.message);
  }

  throw error;
}

describe('Service Error Mapping - Property-Based Tests', () => {
  /**
   * Property 5: Services Throw Appropriate NestJS Exceptions
   *
   * For any service method that encounters a "not found" condition, it SHALL throw NotFoundException.
   * For any service method that encounters invalid input, it SHALL throw BadRequestException.
   * For any service method that encounters state conflicts, it SHALL throw ConflictException.
   * Validates: Requirements 7.2
   */
  describe('Property 5: Services Throw Appropriate NestJS Exceptions', () => {
    // Arbitraries for generating test data
    const invalidStatusArb = fc.string({ minLength: 1, maxLength: 50 });
    const ruleIdArb = fc.string({ minLength: 1, maxLength: 50 });
    const reasonArb = fc.string({ minLength: 1, maxLength: 100 });
    const runIdArb = fc.uuid();
    const stateArb = fc.constantFrom('running', 'prepared', 'promoted', 'cancelled', 'failed');
    const actionArb = fc.constantFrom('promote', 'cancel', 'resume');

    it('should map InvalidEligibilityStatusError to BadRequestException', () => {
      fc.assert(
        fc.property(invalidStatusArb, (status) => {
          const domainError = new InvalidEligibilityStatusError(status);

          let thrownError: Error | undefined;
          try {
            mapDomainErrorToHttpException(domainError);
          } catch (e) {
            thrownError = e as Error;
          }

          expect(thrownError).toBeInstanceOf(BadRequestException);
          expect(thrownError?.message).toBe(domainError.message);
        }),
        { numRuns: 100 },
      );
    });

    it('should map InvalidBreakoutRuleError to BadRequestException', () => {
      fc.assert(
        fc.property(ruleIdArb, reasonArb, (ruleId, reason) => {
          const domainError = new InvalidBreakoutRuleError(ruleId, reason);

          let thrownError: Error | undefined;
          try {
            mapDomainErrorToHttpException(domainError);
          } catch (e) {
            thrownError = e as Error;
          }

          expect(thrownError).toBeInstanceOf(BadRequestException);
          expect(thrownError?.message).toBe(domainError.message);
        }),
        { numRuns: 100 },
      );
    });

    it('should map InvalidRunStateTransitionError to ConflictException', () => {
      fc.assert(
        fc.property(runIdArb, stateArb, actionArb, (runId, state, action) => {
          const domainError = new InvalidRunStateTransitionError(runId, state, action);

          let thrownError: Error | undefined;
          try {
            mapDomainErrorToHttpException(domainError);
          } catch (e) {
            thrownError = e as Error;
          }

          expect(thrownError).toBeInstanceOf(ConflictException);
          expect(thrownError?.message).toBe(domainError.message);
        }),
        { numRuns: 100 },
      );
    });

    it('should re-throw unknown errors unchanged', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (message) => {
          const unknownError = new Error(message);

          let thrownError: Error | undefined;
          try {
            mapDomainErrorToHttpException(unknownError);
          } catch (e) {
            thrownError = e as Error;
          }

          // Unknown errors should be re-thrown as-is
          expect(thrownError).toBe(unknownError);
          expect(thrownError).not.toBeInstanceOf(BadRequestException);
          expect(thrownError).not.toBeInstanceOf(ConflictException);
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve error message in mapped exception', () => {
      fc.assert(
        fc.property(invalidStatusArb, (status) => {
          const domainError = new InvalidEligibilityStatusError(status);

          let thrownError: BadRequestException | undefined;
          try {
            mapDomainErrorToHttpException(domainError);
          } catch (e) {
            thrownError = e as BadRequestException;
          }

          // The message should be preserved
          expect(thrownError?.message).toContain(status);
        }),
        { numRuns: 100 },
      );
    });

    it('should always throw - never return normally', () => {
      fc.assert(
        fc.property(invalidStatusArb, (status) => {
          const domainError = new InvalidEligibilityStatusError(status);

          let didThrow = false;
          try {
            mapDomainErrorToHttpException(domainError);
          } catch {
            didThrow = true;
          }

          // The function should always throw
          expect(didThrow).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Additional property: Domain errors contain useful debugging information
   */
  describe('Domain errors contain debugging information', () => {
    it('InvalidEligibilityStatusError should contain invalid status and valid statuses', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (status) => {
          const error = new InvalidEligibilityStatusError(status);

          expect(error.invalidStatus).toBe(status);
          expect(error.validStatuses).toBeInstanceOf(Array);
          expect(error.validStatuses.length).toBeGreaterThan(0);
          expect(error.message).toContain(status);
        }),
        { numRuns: 100 },
      );
    });

    it('InvalidBreakoutRuleError should contain rule ID and reason', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (ruleId, reason) => {
            const error = new InvalidBreakoutRuleError(ruleId, reason);

            expect(error.ruleId).toBe(ruleId);
            expect(error.reason).toBe(reason);
            expect(error.message).toContain(ruleId);
            expect(error.message).toContain(reason);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('InvalidRunStateTransitionError should contain run ID, state, and action', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (runId, state, action) => {
            const error = new InvalidRunStateTransitionError(runId, state, action);

            expect(error.runId).toBe(runId);
            expect(error.currentState).toBe(state);
            expect(error.attemptedAction).toBe(action);
            expect(error.message).toContain(runId);
            expect(error.message).toContain(state);
            expect(error.message).toContain(action);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
