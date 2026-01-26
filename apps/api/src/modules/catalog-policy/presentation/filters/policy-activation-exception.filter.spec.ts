/**
 * Policy Activation Exception Filter Tests
 */

import { HttpStatus } from '@nestjs/common';
import { PolicyActivationExceptionFilter } from './policy-activation-exception.filter';
import {
  PolicyAlreadyActiveError,
  RunAlreadyInProgressError,
  PromotionNotAllowedError,
  InvalidContextError,
  NoActivePolicyError,
  PolicyNotFoundError,
  RunNotFoundError,
} from '../../domain/errors';

describe('PolicyActivationExceptionFilter', () => {
  let filter: PolicyActivationExceptionFilter;
  let mockResponse: { status: jest.Mock; send: jest.Mock };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new PolicyActivationExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    };
  });

  it('should handle PolicyNotFoundError with 404', () => {
    const error = new PolicyNotFoundError('policy-123');

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'POLICY_NOT_FOUND',
        message: error.message,
        statusCode: HttpStatus.NOT_FOUND,
        details: { policyId: 'policy-123' },
      },
    });
  });

  it('should handle RunNotFoundError with 404', () => {
    const error = new RunNotFoundError('run-456');

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'RUN_NOT_FOUND',
        message: error.message,
        statusCode: HttpStatus.NOT_FOUND,
        details: { runId: 'run-456' },
      },
    });
  });

  it('should handle PolicyAlreadyActiveError with 409', () => {
    const error = new PolicyAlreadyActiveError('policy-123');

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'POLICY_ALREADY_ACTIVE',
        message: error.message,
        statusCode: HttpStatus.CONFLICT,
        details: { policyId: 'policy-123' },
      },
    });
  });

  it('should handle RunAlreadyInProgressError with 409', () => {
    const error = new RunAlreadyInProgressError('policy-123', 'run-456');

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'RUN_ALREADY_IN_PROGRESS',
        message: error.message,
        statusCode: HttpStatus.CONFLICT,
        details: {
          policyId: 'policy-123',
          existingRunId: 'run-456',
        },
      },
    });
  });

  it('should handle PromotionNotAllowedError with 422', () => {
    const error = new PromotionNotAllowedError('run-123', 'coverage below threshold', {
      coverage: 0.95,
    });

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'PROMOTION_NOT_ALLOWED',
        message: error.message,
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        details: {
          runId: 'run-123',
          reason: 'coverage below threshold',
          coverage: 0.95,
        },
      },
    });
  });

  it('should handle InvalidContextError with 400', () => {
    const error = new InvalidContextError('invalid', ['catalog', 'trending']);

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_CONTEXT',
        message: error.message,
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          providedContext: 'invalid',
          validContexts: ['catalog', 'trending'],
        },
      },
    });
  });

  it('should handle NoActivePolicyError with 412', () => {
    const error = new NoActivePolicyError();

    filter.catch(error, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.PRECONDITION_FAILED);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NO_ACTIVE_POLICY',
        message: error.message,
        statusCode: HttpStatus.PRECONDITION_FAILED,
      },
    });
  });
});
