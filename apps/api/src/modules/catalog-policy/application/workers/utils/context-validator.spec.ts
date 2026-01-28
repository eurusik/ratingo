import { Logger } from '@nestjs/common';

import { EvaluationContext } from '../../../domain/constants/evaluation.constants';

import { validateContextPayload } from './context-validator';

describe('validateContextPayload', () => {
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  describe('when context is missing', () => {
    it('should return false for empty payload', () => {
      const payload = {};
      const jobInfo = { runId: 'run-123', policyVersion: 1 };

      const result = validateContextPayload(payload, jobInfo, mockLogger);

      expect(result).toBe(false);
    });

    it('should return false for undefined context', () => {
      const payload = { context: undefined };
      const jobInfo = { runId: 'run-123', policyVersion: 1 };

      const result = validateContextPayload(payload, jobInfo, mockLogger);

      expect(result).toBe(false);
    });

    it('should log error with job info', () => {
      const payload = {};
      const jobInfo = { runId: 'run-123', policyVersion: 1, mediaItemId: 'item-456' };

      validateContextPayload(payload, jobInfo, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'MISSING_CONTEXT_IN_JOB_PAYLOAD - this is a bug, not a runtime issue',
        expect.objectContaining({
          runId: 'run-123',
          policyVersion: 1,
          mediaItemId: 'item-456',
          message: 'Job payload missing required context field',
        }),
      );
    });

    it('should handle partial job info', () => {
      const payload = {};
      const jobInfo = { runId: 'run-123' };

      validateContextPayload(payload, jobInfo, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ runId: 'run-123' }),
      );
    });
  });

  describe('when context is present', () => {
    it('should return true for CATALOG context', () => {
      const payload = { context: EvaluationContext.CATALOG };
      const jobInfo = { runId: 'run-123' };

      const result = validateContextPayload(payload, jobInfo, mockLogger);

      expect(result).toBe(true);
    });

    it('should return true for TRENDING context', () => {
      const payload = { context: EvaluationContext.TRENDING };
      const jobInfo = { runId: 'run-123' };

      const result = validateContextPayload(payload, jobInfo, mockLogger);

      expect(result).toBe(true);
    });

    it('should return true for HOMEPAGE context', () => {
      const payload = { context: EvaluationContext.HOMEPAGE };
      const jobInfo = { runId: 'run-123' };

      const result = validateContextPayload(payload, jobInfo, mockLogger);

      expect(result).toBe(true);
    });

    it('should not log error when context is valid', () => {
      const payload = { context: EvaluationContext.CATALOG };
      const jobInfo = { runId: 'run-123' };

      validateContextPayload(payload, jobInfo, mockLogger);

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it.each([
      EvaluationContext.CATALOG,
      EvaluationContext.TRENDING,
      EvaluationContext.HOMEPAGE,
      EvaluationContext.NOW_PLAYING,
      EvaluationContext.NEW_DIGITAL,
      EvaluationContext.SEARCH,
    ])('should return true for %s context', (context) => {
      const payload = { context };
      const jobInfo = { runId: 'run-123' };

      const result = validateContextPayload(payload, jobInfo, mockLogger);

      expect(result).toBe(true);
    });
  });

  describe('type narrowing', () => {
    it('should narrow type when returning true', () => {
      const payload: { context?: typeof EvaluationContext.CATALOG } = {
        context: EvaluationContext.CATALOG,
      };
      const jobInfo = { runId: 'run-123' };

      if (validateContextPayload(payload, jobInfo, mockLogger)) {
        // TypeScript should recognize payload.context as defined here
        expect(payload.context).toBe(EvaluationContext.CATALOG);
      }
    });
  });
});
