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
import { DRY_RUN_MODES } from '../dto/constants';
import { type ErrorResponseDto } from '../dto/error-response.dto';
import { ErrorResponseBuilder } from '../utils';

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

  private buildErrorResponse(exception: DryRunValidationError): ErrorResponseDto {
    const details = this.extractDetails(exception);

    return ErrorResponseBuilder.build(exception, HttpStatus.BAD_REQUEST, details);
  }

  private extractDetails(exception: DryRunValidationError): Record<string, unknown> | undefined {
    if (exception instanceof MissingModeParameterError) {
      return {
        mode: exception.mode,
        requiredParameter: exception.parameter,
      };
    }

    if (exception instanceof InvalidLimitError) {
      return {
        provided: exception.provided,
        min: exception.min,
        max: exception.max,
      };
    }

    if (exception instanceof InvalidSamplePercentError) {
      return {
        provided: exception.provided,
        min: exception.min,
        max: exception.max,
      };
    }

    if (exception instanceof UnknownDryRunModeError) {
      return {
        providedMode: exception.providedMode,
        validModes: [...DRY_RUN_MODES],
      };
    }

    return undefined;
  }
}
