/**
 * Dry-Run Domain Errors
 *
 * Domain-specific errors for dry-run validation.
 * Mapped to HTTP responses by DryRunExceptionFilter.
 */

import { type DryRunMode } from '../types/dry-run.types';

export abstract class DryRunValidationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = 'DryRunValidationError';
  }
}

export class MissingModeParameterError extends DryRunValidationError {
  readonly code = 'MISSING_MODE_PARAMETER';
  readonly mode: DryRunMode;
  readonly parameter: string;

  constructor(mode: DryRunMode, parameter: string) {
    super(`Parameter '${parameter}' is required for '${mode}' mode`);
    this.name = 'MissingModeParameterError';
    this.mode = mode;
    this.parameter = parameter;
  }
}

export class InvalidLimitError extends DryRunValidationError {
  readonly code = 'INVALID_LIMIT';
  readonly provided: number;
  readonly min: number;
  readonly max: number;

  constructor(provided: number, min: number, max: number) {
    super(`Limit must be between ${min} and ${max}, got ${provided}`);
    this.name = 'InvalidLimitError';
    this.provided = provided;
    this.min = min;
    this.max = max;
  }
}

export class InvalidSamplePercentError extends DryRunValidationError {
  readonly code = 'INVALID_SAMPLE_PERCENT';
  readonly provided: number;
  readonly min: number;
  readonly max: number;

  constructor(provided: number, min: number, max: number) {
    super(`Sample percent must be between ${min} and ${max}, got ${provided}`);
    this.name = 'InvalidSamplePercentError';
    this.provided = provided;
    this.min = min;
    this.max = max;
  }
}

export class UnknownDryRunModeError extends DryRunValidationError {
  readonly code = 'UNKNOWN_MODE';
  readonly providedMode: string;

  constructor(mode: string) {
    super(`Unknown dry-run mode: '${mode}'`);
    this.name = 'UnknownDryRunModeError';
    this.providedMode = mode;
  }
}
