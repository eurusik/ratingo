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
    errorResponse: {
      success: false;
      error: {
        code: string;
        message: string;
        statusCode: number;
        details?: Record<string, unknown>;
      };
    };
  } {
    if (exception instanceof PolicyNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        errorResponse: {
          success: false,
          error: {
            code: 'POLICY_NOT_FOUND',
            message: exception.message,
            statusCode: HttpStatus.NOT_FOUND,
            details: { policyId: exception.policyId },
          },
        },
      };
    }

    if (exception instanceof RunNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        errorResponse: {
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: exception.message,
            statusCode: HttpStatus.NOT_FOUND,
            details: { runId: exception.runId },
          },
        },
      };
    }

    if (exception instanceof PolicyAlreadyActiveError) {
      return {
        statusCode: HttpStatus.CONFLICT,
        errorResponse: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.CONFLICT,
            details: { policyId: exception.policyId },
          },
        },
      };
    }

    if (exception instanceof RunAlreadyInProgressError) {
      return {
        statusCode: HttpStatus.CONFLICT,
        errorResponse: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.CONFLICT,
            details: {
              policyId: exception.policyId,
              existingRunId: exception.existingRunId,
            },
          },
        },
      };
    }

    if (exception instanceof PromotionNotAllowedError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        errorResponse: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            details: {
              runId: exception.runId,
              reason: exception.reason,
              ...exception.details,
            },
          },
        },
      };
    }

    if (exception instanceof InvalidContextError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        errorResponse: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.BAD_REQUEST,
            details: {
              providedContext: exception.providedContext,
              validContexts: exception.validContexts,
            },
          },
        },
      };
    }

    if (exception instanceof NoActivePolicyError) {
      return {
        statusCode: HttpStatus.PRECONDITION_FAILED,
        errorResponse: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.PRECONDITION_FAILED,
          },
        },
      };
    }

    // Generic PolicyActivationError fallback
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      errorResponse: {
        success: false,
        error: {
          code: (exception as PolicyActivationError).code,
          message: exception.message,
          statusCode: HttpStatus.BAD_REQUEST,
        },
      },
    };
  }
}
