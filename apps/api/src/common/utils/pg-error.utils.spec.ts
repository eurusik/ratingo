import { PG_ERROR_CODE } from '../constants/database.constants';

import { extractPgError, isSlugCollision, isUniqueViolation } from './pg-error.utils';

describe('pg-error.utils', () => {
  describe('extractPgError', () => {
    it('should extract error details from direct error', () => {
      const error = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (slug)=(test-slug) already exists',
        constraint_name: 'media_type_slug_idx',
      };

      const result = extractPgError(error);

      expect(result).toEqual({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (slug)=(test-slug) already exists',
        constraint: 'media_type_slug_idx',
      });
    });

    it('should extract error details from cause-wrapped error (Drizzle pattern)', () => {
      const error = {
        message: 'Drizzle wrapper message',
        cause: {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
          detail: 'Key (slug)=(test-slug) already exists',
          constraint_name: 'media_type_slug_idx',
        },
      };

      const result = extractPgError(error);

      expect(result).toEqual({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (slug)=(test-slug) already exists',
        constraint: 'media_type_slug_idx',
      });
    });

    it('should prefer cause values over direct values', () => {
      const error = {
        code: 'WRAPPER_CODE',
        message: 'wrapper message',
        cause: {
          code: '23505',
          message: 'actual pg message',
        },
      };

      const result = extractPgError(error);

      expect(result.code).toBe('23505');
      expect(result.message).toBe('actual pg message');
    });

    it('should handle empty error', () => {
      const result = extractPgError({});

      expect(result).toEqual({
        code: undefined,
        message: undefined,
        detail: undefined,
        constraint: undefined,
      });
    });

    it('should handle non-object error', () => {
      const result = extractPgError('string error');

      expect(result).toEqual({
        code: undefined,
        message: undefined,
        detail: undefined,
        constraint: undefined,
      });
    });
  });

  describe('isUniqueViolation', () => {
    it('should return true for unique violation error', () => {
      const error = { code: PG_ERROR_CODE.UNIQUE_VIOLATION };

      expect(isUniqueViolation(error)).toBe(true);
    });

    it('should return true for unique violation in cause', () => {
      const error = { cause: { code: PG_ERROR_CODE.UNIQUE_VIOLATION } };

      expect(isUniqueViolation(error)).toBe(true);
    });

    it('should return false for other error codes', () => {
      const error = { code: '23503' }; // foreign_key_violation

      expect(isUniqueViolation(error)).toBe(false);
    });

    it('should return false for error without code', () => {
      const error = { message: 'some error' };

      expect(isUniqueViolation(error)).toBe(false);
    });

    describe('with constraint filter', () => {
      it('should return true when constraint matches', () => {
        const error = {
          code: PG_ERROR_CODE.UNIQUE_VIOLATION,
          constraint_name: 'media_type_slug_idx',
        };

        expect(isUniqueViolation(error, 'media_type_slug_idx')).toBe(true);
      });

      it('should return false when constraint does not match', () => {
        const error = {
          code: PG_ERROR_CODE.UNIQUE_VIOLATION,
          constraint_name: 'other_constraint',
        };

        expect(isUniqueViolation(error, 'media_type_slug_idx')).toBe(false);
      });

      it('should return false when constraint is undefined', () => {
        const error = {
          code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        };

        expect(isUniqueViolation(error, 'media_type_slug_idx')).toBe(false);
      });
    });
  });

  describe('isSlugCollision', () => {
    const SLUG_CONSTRAINT = 'media_type_slug_idx';

    it('should return true for slug collision error', () => {
      const error = {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: SLUG_CONSTRAINT,
      };

      expect(isSlugCollision(error, SLUG_CONSTRAINT)).toBe(true);
    });

    it('should return true for slug collision in cause', () => {
      const error = {
        cause: {
          code: PG_ERROR_CODE.UNIQUE_VIOLATION,
          constraint_name: SLUG_CONSTRAINT,
        },
      };

      expect(isSlugCollision(error, SLUG_CONSTRAINT)).toBe(true);
    });

    it('should return false for unique violation on different constraint', () => {
      const error = {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: 'users_email_unique',
      };

      expect(isSlugCollision(error, SLUG_CONSTRAINT)).toBe(false);
    });

    it('should return false for non-unique-violation error', () => {
      const error = {
        code: '23503',
        constraint_name: SLUG_CONSTRAINT,
      };

      expect(isSlugCollision(error, SLUG_CONSTRAINT)).toBe(false);
    });
  });
});
