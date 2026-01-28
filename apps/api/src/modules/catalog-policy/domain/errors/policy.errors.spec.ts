import {
  InvalidEligibilityStatusError,
  InvalidRunStatusError,
  InvalidBreakoutRuleError,
  InvalidRunStateTransitionError,
  RunNotFoundError,
  PolicyNotFoundError,
  PolicyValidationError,
} from './policy.errors';
import { EligibilityStatus, RunStatus } from '../constants/evaluation.constants';

describe('Policy Domain Errors', () => {
  describe('InvalidEligibilityStatusError', () => {
    it('should include invalid status in message', () => {
      const error = new InvalidEligibilityStatusError('UNKNOWN');

      expect(error.message).toContain('UNKNOWN');
      expect(error.invalidStatus).toBe('UNKNOWN');
    });

    it('should list all valid statuses in message', () => {
      const error = new InvalidEligibilityStatusError('bad');
      const validStatuses = Object.values(EligibilityStatus);

      for (const status of validStatuses) {
        expect(error.message).toContain(status);
      }
      expect(error.validStatuses).toEqual(validStatuses);
    });

    it('should have correct error name', () => {
      const error = new InvalidEligibilityStatusError('x');
      expect(error.name).toBe('InvalidEligibilityStatusError');
    });

    it('should be instanceof Error', () => {
      const error = new InvalidEligibilityStatusError('x');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('InvalidRunStatusError', () => {
    it('should include invalid status in message', () => {
      const error = new InvalidRunStatusError('completed');

      expect(error.message).toContain('completed');
      expect(error.invalidStatus).toBe('completed');
    });

    it('should list all valid statuses in message', () => {
      const error = new InvalidRunStatusError('bad');
      const validStatuses = Object.values(RunStatus);

      for (const status of validStatuses) {
        expect(error.message).toContain(status);
      }
      expect(error.validStatuses).toEqual(validStatuses);
    });

    it('should mention legacy migration in message', () => {
      const error = new InvalidRunStatusError('pending');
      expect(error.message).toContain('Legacy values must be migrated');
    });

    it('should have correct error name', () => {
      const error = new InvalidRunStatusError('x');
      expect(error.name).toBe('InvalidRunStatusError');
    });
  });

  describe('InvalidBreakoutRuleError', () => {
    it('should include rule id and reason in message', () => {
      const error = new InvalidBreakoutRuleError('rule-1', 'priority must be non-negative');

      expect(error.message).toContain('rule-1');
      expect(error.message).toContain('priority must be non-negative');
      expect(error.ruleId).toBe('rule-1');
      expect(error.reason).toBe('priority must be non-negative');
    });

    it('should have correct error name', () => {
      const error = new InvalidBreakoutRuleError('x', 'y');
      expect(error.name).toBe('InvalidBreakoutRuleError');
    });
  });

  describe('InvalidRunStateTransitionError', () => {
    it('should include run id, state, and action in message', () => {
      const error = new InvalidRunStateTransitionError('run-123', 'promoted', 'cancel');

      expect(error.message).toContain('run-123');
      expect(error.message).toContain('promoted');
      expect(error.message).toContain('cancel');
      expect(error.runId).toBe('run-123');
      expect(error.currentState).toBe('promoted');
      expect(error.attemptedAction).toBe('cancel');
    });

    it('should format message correctly', () => {
      const error = new InvalidRunStateTransitionError('run-1', 'failed', 'promote');
      expect(error.message).toBe("Cannot promote run 'run-1' in state 'failed'");
    });

    it('should have correct error name', () => {
      const error = new InvalidRunStateTransitionError('x', 'y', 'z');
      expect(error.name).toBe('InvalidRunStateTransitionError');
    });
  });

  describe('RunNotFoundError', () => {
    it('should include run id in message', () => {
      const error = new RunNotFoundError('run-123');

      expect(error.message).toContain('run-123');
      expect(error.runId).toBe('run-123');
    });

    it('should have correct error name', () => {
      const error = new RunNotFoundError('x');
      expect(error.name).toBe('RunNotFoundError');
    });
  });

  describe('PolicyNotFoundError', () => {
    it('should include policy id in message', () => {
      const error = new PolicyNotFoundError('policy-123');

      expect(error.message).toContain('policy-123');
      expect(error.policyId).toBe('policy-123');
    });

    it('should have correct error name', () => {
      const error = new PolicyNotFoundError('x');
      expect(error.name).toBe('PolicyNotFoundError');
    });
  });

  describe('PolicyValidationError', () => {
    it('should include message', () => {
      const error = new PolicyValidationError('Countries cannot be both allowed and blocked');

      expect(error.message).toBe('Countries cannot be both allowed and blocked');
    });

    it('should include optional details', () => {
      const details = { overlappingCountries: ['US', 'GB'] };
      const error = new PolicyValidationError('Error', details);

      expect(error.details).toEqual(details);
    });

    it('should have undefined details when not provided', () => {
      const error = new PolicyValidationError('Error');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name', () => {
      const error = new PolicyValidationError('x');
      expect(error.name).toBe('PolicyValidationError');
    });
  });
});
