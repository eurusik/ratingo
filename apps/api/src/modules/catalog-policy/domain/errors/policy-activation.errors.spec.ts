/**
 * Policy Activation Errors Tests
 */

import {
  PolicyActivationError,
  PolicyAlreadyActiveError,
  RunAlreadyInProgressError,
  PromotionNotAllowedError,
  InvalidContextError,
  NoActivePolicyError,
} from './policy.errors';

describe('PolicyActivationError', () => {
  describe('PolicyAlreadyActiveError', () => {
    it('should have correct code', () => {
      const error = new PolicyAlreadyActiveError('policy-123');
      expect(error.code).toBe('POLICY_ALREADY_ACTIVE');
    });

    it('should have correct message', () => {
      const error = new PolicyAlreadyActiveError('policy-123');
      expect(error.message).toBe('Policy policy-123 is already active');
    });

    it('should store policyId', () => {
      const error = new PolicyAlreadyActiveError('policy-123');
      expect(error.policyId).toBe('policy-123');
    });

    it('should be instance of PolicyActivationError', () => {
      const error = new PolicyAlreadyActiveError('policy-123');
      expect(error).toBeInstanceOf(PolicyActivationError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('RunAlreadyInProgressError', () => {
    it('should have correct code', () => {
      const error = new RunAlreadyInProgressError('policy-123', 'run-456');
      expect(error.code).toBe('RUN_ALREADY_IN_PROGRESS');
    });

    it('should have correct message', () => {
      const error = new RunAlreadyInProgressError('policy-123', 'run-456');
      expect(error.message).toBe(
        'A run is already in progress for policy policy-123 (runId: run-456)',
      );
    });

    it('should store policyId and existingRunId', () => {
      const error = new RunAlreadyInProgressError('policy-123', 'run-456');
      expect(error.policyId).toBe('policy-123');
      expect(error.existingRunId).toBe('run-456');
    });

    it('should be instance of PolicyActivationError', () => {
      const error = new RunAlreadyInProgressError('policy-123', 'run-456');
      expect(error).toBeInstanceOf(PolicyActivationError);
    });
  });

  describe('PromotionNotAllowedError', () => {
    it('should have correct code', () => {
      const error = new PromotionNotAllowedError('run-123', 'status is running');
      expect(error.code).toBe('PROMOTION_NOT_ALLOWED');
    });

    it('should have correct message', () => {
      const error = new PromotionNotAllowedError('run-123', 'status is running');
      expect(error.message).toBe('Cannot promote run run-123: status is running');
    });

    it('should store runId and reason', () => {
      const error = new PromotionNotAllowedError('run-123', 'coverage below threshold');
      expect(error.runId).toBe('run-123');
      expect(error.reason).toBe('coverage below threshold');
    });

    it('should store optional details', () => {
      const error = new PromotionNotAllowedError('run-123', 'coverage below threshold', {
        coverage: 0.95,
        threshold: 1.0,
      });
      expect(error.details).toEqual({ coverage: 0.95, threshold: 1.0 });
    });

    it('should be instance of PolicyActivationError', () => {
      const error = new PromotionNotAllowedError('run-123', 'reason');
      expect(error).toBeInstanceOf(PolicyActivationError);
    });
  });

  describe('InvalidContextError', () => {
    it('should have correct code', () => {
      const error = new InvalidContextError('invalid', ['catalog', 'trending']);
      expect(error.code).toBe('INVALID_CONTEXT');
    });

    it('should have correct message', () => {
      const error = new InvalidContextError('invalid', ['catalog', 'trending']);
      expect(error.message).toBe("Invalid context 'invalid'. Must be one of: catalog, trending");
    });

    it('should store providedContext and validContexts', () => {
      const error = new InvalidContextError('bad', ['catalog', 'trending']);
      expect(error.providedContext).toBe('bad');
      expect(error.validContexts).toEqual(['catalog', 'trending']);
    });

    it('should be instance of PolicyActivationError', () => {
      const error = new InvalidContextError('bad', ['catalog']);
      expect(error).toBeInstanceOf(PolicyActivationError);
    });
  });

  describe('NoActivePolicyError', () => {
    it('should have correct code', () => {
      const error = new NoActivePolicyError();
      expect(error.code).toBe('NO_ACTIVE_POLICY');
    });

    it('should have correct message', () => {
      const error = new NoActivePolicyError();
      expect(error.message).toBe(
        'No active policy found. Cannot perform operation without active policy.',
      );
    });

    it('should be instance of PolicyActivationError', () => {
      const error = new NoActivePolicyError();
      expect(error).toBeInstanceOf(PolicyActivationError);
    });
  });
});
