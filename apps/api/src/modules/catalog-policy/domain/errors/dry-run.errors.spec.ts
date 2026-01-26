/**
 * Dry-Run Errors Tests
 */

import {
  DryRunValidationError,
  MissingModeParameterError,
  InvalidLimitError,
  InvalidSamplePercentError,
  UnknownDryRunModeError,
} from './dry-run.errors';

describe('DryRunValidationError', () => {
  describe('MissingModeParameterError', () => {
    it('should have correct code', () => {
      const error = new MissingModeParameterError('byType', 'mediaType');
      expect(error.code).toBe('MISSING_MODE_PARAMETER');
    });

    it('should have correct message', () => {
      const error = new MissingModeParameterError('byType', 'mediaType');
      expect(error.message).toBe("Parameter 'mediaType' is required for 'byType' mode");
    });

    it('should store mode and parameter', () => {
      const error = new MissingModeParameterError('byCountry', 'country');
      expect(error.mode).toBe('byCountry');
      expect(error.parameter).toBe('country');
    });

    it('should be instance of DryRunValidationError', () => {
      const error = new MissingModeParameterError('byType', 'mediaType');
      expect(error).toBeInstanceOf(DryRunValidationError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('InvalidLimitError', () => {
    it('should have correct code', () => {
      const error = new InvalidLimitError(20000, 1, 10000);
      expect(error.code).toBe('INVALID_LIMIT');
    });

    it('should have correct message', () => {
      const error = new InvalidLimitError(20000, 1, 10000);
      expect(error.message).toBe('Limit must be between 1 and 10000, got 20000');
    });

    it('should store provided, min, max values', () => {
      const error = new InvalidLimitError(-5, 1, 10000);
      expect(error.provided).toBe(-5);
      expect(error.min).toBe(1);
      expect(error.max).toBe(10000);
    });

    it('should be instance of DryRunValidationError', () => {
      const error = new InvalidLimitError(0, 1, 100);
      expect(error).toBeInstanceOf(DryRunValidationError);
    });
  });

  describe('InvalidSamplePercentError', () => {
    it('should have correct code', () => {
      const error = new InvalidSamplePercentError(150, 1, 100);
      expect(error.code).toBe('INVALID_SAMPLE_PERCENT');
    });

    it('should have correct message', () => {
      const error = new InvalidSamplePercentError(150, 1, 100);
      expect(error.message).toBe('Sample percent must be between 1 and 100, got 150');
    });

    it('should store provided, min, max values', () => {
      const error = new InvalidSamplePercentError(0, 1, 100);
      expect(error.provided).toBe(0);
      expect(error.min).toBe(1);
      expect(error.max).toBe(100);
    });

    it('should be instance of DryRunValidationError', () => {
      const error = new InvalidSamplePercentError(200, 1, 100);
      expect(error).toBeInstanceOf(DryRunValidationError);
    });
  });

  describe('UnknownDryRunModeError', () => {
    it('should have correct code', () => {
      const error = new UnknownDryRunModeError('invalid');
      expect(error.code).toBe('UNKNOWN_MODE');
    });

    it('should have correct message', () => {
      const error = new UnknownDryRunModeError('random');
      expect(error.message).toBe("Unknown dry-run mode: 'random'");
    });

    it('should store providedMode', () => {
      const error = new UnknownDryRunModeError('test');
      expect(error.providedMode).toBe('test');
    });

    it('should be instance of DryRunValidationError', () => {
      const error = new UnknownDryRunModeError('bad');
      expect(error).toBeInstanceOf(DryRunValidationError);
    });
  });
});
