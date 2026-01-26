/**
 * Dry-Run Exception Filter Tests
 */

import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { DryRunExceptionFilter } from './dry-run-exception.filter';
import {
  MissingModeParameterError,
  InvalidLimitError,
  InvalidSamplePercentError,
  UnknownDryRunModeError,
} from '../../domain/errors';

describe('DryRunExceptionFilter', () => {
  let filter: DryRunExceptionFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new DryRunExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should return 400 for MissingModeParameterError', () => {
    const error = new MissingModeParameterError('byType', 'mediaType');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'MISSING_MODE_PARAMETER',
        message: "Parameter 'mediaType' is required for 'byType' mode",
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          mode: 'byType',
          requiredParameter: 'mediaType',
        },
      },
    });
  });

  it('should return 400 for InvalidLimitError', () => {
    const error = new InvalidLimitError(20000, 1, 10000);

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_LIMIT',
        message: 'Limit must be between 1 and 10000, got 20000',
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          provided: 20000,
          min: 1,
          max: 10000,
        },
      },
    });
  });

  it('should return 400 for InvalidSamplePercentError', () => {
    const error = new InvalidSamplePercentError(150, 1, 100);

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_SAMPLE_PERCENT',
        message: 'Sample percent must be between 1 and 100, got 150',
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          provided: 150,
          min: 1,
          max: 100,
        },
      },
    });
  });

  it('should return 400 for UnknownDryRunModeError', () => {
    const error = new UnknownDryRunModeError('invalid');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNKNOWN_MODE',
        message: "Unknown dry-run mode: 'invalid'",
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          providedMode: 'invalid',
          validModes: ['sample', 'top', 'byType', 'byCountry'],
        },
      },
    });
  });
});
