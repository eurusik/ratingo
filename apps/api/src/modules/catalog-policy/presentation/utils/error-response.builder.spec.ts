/**
 * Error Response Builder Tests
 */

import { ErrorResponseBuilder } from './error-response.builder';

describe('ErrorResponseBuilder', () => {
  describe('build', () => {
    it('should build error response from error with code', () => {
      const error = { code: 'TEST_ERROR', message: 'Test error message' };

      const result = ErrorResponseBuilder.build(error, 400);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          statusCode: 400,
        },
      });
    });

    it('should include details when provided', () => {
      const error = { code: 'TEST_ERROR', message: 'Test error message' };
      const details = { field: 'value', count: 42 };

      const result = ErrorResponseBuilder.build(error, 400, details);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          statusCode: 400,
          details: { field: 'value', count: 42 },
        },
      });
    });

    it('should not include details key when undefined', () => {
      const error = { code: 'TEST_ERROR', message: 'Test error message' };

      const result = ErrorResponseBuilder.build(error, 404, undefined);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          statusCode: 404,
        },
      });
      expect('details' in result.error).toBe(false);
    });

    it('should handle different status codes', () => {
      const error = { code: 'NOT_FOUND', message: 'Not found' };

      const result = ErrorResponseBuilder.build(error, 404);

      expect(result.error.statusCode).toBe(404);
    });
  });

  describe('buildWithCode', () => {
    it('should build error response with custom code', () => {
      const result = ErrorResponseBuilder.buildWithCode('CUSTOM_CODE', 'Custom message', 422);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'CUSTOM_CODE',
          message: 'Custom message',
          statusCode: 422,
        },
      });
    });

    it('should include details when provided', () => {
      const details = { reason: 'validation failed' };

      const result = ErrorResponseBuilder.buildWithCode(
        'VALIDATION_ERROR',
        'Validation failed',
        400,
        details,
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 400,
          details: { reason: 'validation failed' },
        },
      });
    });
  });
});
