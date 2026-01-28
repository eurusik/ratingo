/**
 * Policy Activation Exception Filter
 *
 * Maps domain activation errors to HTTP responses.
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
  PolicyActivationError,
  PolicyAlreadyActiveError,
  RunAlreadyInProgressError,
  PromotionNotAllowedError,
  InvalidContextError,
  NoActivePolicyError,
  PolicyNotFoundError,
  RunNotFoundError,
} from '../../domain/errors';
import { type ErrorResponseDto } from '../dto/error-response.dto';
import { ErrorResponseBuilder } from '../utils';

type CaughtError = PolicyActivationError | PolicyNotFoundError | RunNotFoundError;

@Catch(PolicyActivationError, PolicyNotFoundError, RunNotFoundError)
export class PolicyActivationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PolicyActivationExceptionFilter.name);

  catch(exception: CaughtError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const { statusCode, errorResponse } = this.buildResponse(exception);

    this.logger.warn(`Policy activation error: ${errorResponse.error.code} - ${exception.message}`);

    void response.status(statusCode).send(errorResponse);
  }

  private buildResponse(exception: CaughtError): {
    statusCode: number;
    errorResponse: ErrorResponseDto;
  } {
    if (exception instanceof PolicyNotFoundError) {
      return this.createResponse(exception, HttpStatus.NOT_FOUND, {
        policyId: exception.policyId,
      });
    }

    if (exception instanceof RunNotFoundError) {
      return this.createResponse(exception, HttpStatus.NOT_FOUND, {
        runId: exception.runId,
      });
    }

    if (exception instanceof PolicyAlreadyActiveError) {
      return this.createResponse(exception, HttpStatus.CONFLICT, {
        policyId: exception.policyId,
      });
    }

    if (exception instanceof RunAlreadyInProgressError) {
      return this.createResponse(exception, HttpStatus.CONFLICT, {
        policyId: exception.policyId,
        existingRunId: exception.existingRunId,
      });
    }

    if (exception instanceof PromotionNotAllowedError) {
      return this.createResponse(exception, HttpStatus.UNPROCESSABLE_ENTITY, {
        runId: exception.runId,
        reason: exception.reason,
        ...exception.details,
      });
    }

    if (exception instanceof InvalidContextError) {
      return this.createResponse(exception, HttpStatus.BAD_REQUEST, {
        providedContext: exception.providedContext,
        validContexts: exception.validContexts,
      });
    }

    if (exception instanceof NoActivePolicyError) {
      return this.createResponse(exception, HttpStatus.PRECONDITION_FAILED);
    }

    // Fallback for generic PolicyActivationError
    return this.createResponse(exception, HttpStatus.BAD_REQUEST);
  }

  private createResponse(
    exception: CaughtError,
    statusCode: number,
    details?: Record<string, unknown>,
  ): { statusCode: number; errorResponse: ErrorResponseDto } {
    return {
      statusCode,
      errorResponse: ErrorResponseBuilder.build(exception, statusCode, details),
    };
  }
}
