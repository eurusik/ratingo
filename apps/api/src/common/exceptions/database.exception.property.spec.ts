/**
 * DatabaseException Property-Based Tests
 *
 * Feature: catalog-policy-refactoring
 * Property 4: Database Errors Wrapped in DatabaseException
 * Validates: Requirements 7.1
 */

import * as fc from 'fast-check';
import { DatabaseException } from './database.exception';
import { ErrorCode } from '../enums/error-code.enum';
import { HttpStatus } from '@nestjs/common';

describe('DatabaseException - Property-Based Tests', () => {
  /**
   * Property 4: Database Errors Wrapped in DatabaseException
   *
   * For any database operation that fails, the error SHALL be wrapped
   * in a DatabaseException with the original error preserved.
   * Validates: Requirements 7.1
   */
  describe('Property 4: Database Errors Wrapped in DatabaseException', () => {
    // Arbitrary for generating error messages
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

    // Arbitrary for generating original errors
    const originalErrorArb = fc.record({
      message: fc.string({ minLength: 1, maxLength: 100 }),
      name: fc.constantFrom('Error', 'TypeError', 'PostgresError', 'DrizzleError'),
      stack: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
    });

    it('should preserve the original error in cause property', () => {
      fc.assert(
        fc.property(errorMessageArb, originalErrorArb, (message, errorData) => {
          const originalError = new Error(errorData.message);
          originalError.name = errorData.name;
          if (errorData.stack) {
            originalError.stack = errorData.stack;
          }

          const dbException = new DatabaseException(message, originalError);

          // The cause should be the original error
          expect(dbException.cause).toBe(originalError);
          expect(dbException.cause).toBeInstanceOf(Error);
          expect((dbException.cause as Error).message).toBe(errorData.message);
        }),
        { numRuns: 100 },
      );
    });

    it('should have correct error code DATABASE_ERROR', () => {
      fc.assert(
        fc.property(errorMessageArb, (message) => {
          const dbException = new DatabaseException(message);

          expect(dbException.code).toBe(ErrorCode.DATABASE_ERROR);
        }),
        { numRuns: 100 },
      );
    });

    it('should have HTTP status 500 INTERNAL_SERVER_ERROR', () => {
      fc.assert(
        fc.property(errorMessageArb, (message) => {
          const dbException = new DatabaseException(message);

          expect(dbException.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve the error message', () => {
      fc.assert(
        fc.property(errorMessageArb, (message) => {
          const dbException = new DatabaseException(message);

          expect(dbException.message).toBe(message);
        }),
        { numRuns: 100 },
      );
    });

    it('should include original error stack in combined stack trace', () => {
      fc.assert(
        fc.property(errorMessageArb, (message) => {
          const originalError = new Error('Original database error');
          const dbException = new DatabaseException(message, originalError);

          // Stack should contain "Caused by:" when original error has stack
          if (originalError.stack) {
            expect(dbException.stack).toContain('Caused by:');
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should work with undefined cause', () => {
      fc.assert(
        fc.property(errorMessageArb, (message) => {
          const dbException = new DatabaseException(message);

          expect(dbException.cause).toBeUndefined();
          expect(dbException.message).toBe(message);
          expect(dbException.code).toBe(ErrorCode.DATABASE_ERROR);
        }),
        { numRuns: 100 },
      );
    });

    it('should work with non-Error cause objects', () => {
      fc.assert(
        fc.property(errorMessageArb, fc.string(), (message, causeString) => {
          const dbException = new DatabaseException(message, causeString);

          // Non-Error causes should still be preserved
          expect(dbException.cause).toBe(causeString);
        }),
        { numRuns: 100 },
      );
    });

    it('should support optional details parameter', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          fc.record({
            operation: fc.string(),
            table: fc.string(),
          }),
          (message, details) => {
            const originalError = new Error('DB error');
            const dbException = new DatabaseException(message, originalError, details);

            expect(dbException.details).toEqual(details);
            expect(dbException.cause).toBe(originalError);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
