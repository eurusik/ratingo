/**
 * Dry-Run Exception Filter
 *
 * Maps domain validation errors to HTTP 400 responses.
 */

import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { type FastifyReply } from 'fastify';

import {
  DryRunValidationError,
  MissingModeParameterError,
  InvalidLimitError,
  InvalidSamplePercentError,
  UnknownDryRunModeError,
} from '../../domain/errors';

@Catch(DryRunValidationError)
export class DryRunExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DryRunExceptionFilter.name);

  catch(exception: DryRunValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    this.logger.warn(`Dry-run validation error: ${exception.code} - ${exception.message}`);

    const errorResponse = this.buildErrorResponse(exception);

    void response.status(HttpStatus.BAD_REQUEST).send(errorResponse);
  }

  private buildErrorResponse(exception: DryRunValidationError): {
    success: false;
    error: {
      code: string;
      message: string;
      statusCode: number;
      details?: Record<string, unknown>;
    };
  } {
    const baseResponse = {
      success: false as const,
      error: {
        code: exception.code,
        message: exception.message,
        statusCode: HttpStatus.BAD_REQUEST,
      },
    };

    // Add specific details based on error type
    if (exception instanceof MissingModeParameterError) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          details: {
            mode: exception.mode,
            requiredParameter: exception.parameter,
          },
        },
      };
    }

    if (exception instanceof InvalidLimitError) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          details: {
            provided: exception.provided,
            min: exception.min,
            max: exception.max,
          },
        },
      };
    }

    if (exception instanceof InvalidSamplePercentError) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          details: {
            provided: exception.provided,
            min: exception.min,
            max: exception.max,
          },
        },
      };
    }

    if (exception instanceof UnknownDryRunModeError) {
      return {
        ...baseResponse,
        error: {
          ...baseResponse.error,
          details: {
            providedMode: exception.providedMode,
            validModes: ['sample', 'top', 'byType', 'byCountry'],
          },
        },
      };
    }

    return baseResponse;
  }
}
