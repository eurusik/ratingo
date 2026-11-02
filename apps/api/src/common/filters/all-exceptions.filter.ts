import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import { type FastifyReply } from 'fastify';

import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from '../exceptions/app.exception';
import { type ApiErrorResponse } from '../interfaces/api-response.interface';

type ExceptionResponseMessage = string | string[];

const EXPECTED_CLIENT_ERROR_STATUSES: ReadonlySet<number> = new Set([
  HttpStatus.UNAUTHORIZED,
  HttpStatus.NOT_FOUND,
]);

function hasMessageField(value: unknown): value is { message?: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value;
}

function extractExceptionResponseMessage(value: unknown): ExceptionResponseMessage | undefined {
  if (!hasMessageField(value)) return undefined;
  const msg = value.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg) && msg.every((x) => typeof x === 'string')) return msg as string[];
  return undefined;
}

/**
 * Global exception filter that catches all exceptions.
 * Formats errors into a standardized API response format.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const { statusCode, errorResponse } = this.buildErrorResponse(exception);

    this.logException(exception, errorResponse);

    response.status(statusCode).send(errorResponse);
  }

  private logException(exception: unknown, { error }: ApiErrorResponse): void {
    const message = `${error.code}: ${error.message}`;

    if (error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    } else if (EXPECTED_CLIENT_ERROR_STATUSES.has(error.statusCode)) {
      this.logger.debug(message);
    } else {
      this.logger.warn(message);
    }
  }

  private buildErrorResponse(exception: unknown): {
    statusCode: number;
    errorResponse: ApiErrorResponse;
  } {
    // Handle our custom AppException
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        errorResponse: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: exception.getStatus(),
            details: exception.details,
          },
        },
      };
    }

    // Handle ThrottlerException explicitly (rate limiting)
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        errorResponse: {
          success: false,
          error: {
            code: ErrorCode.RATE_LIMITED,
            message: 'Too many requests. Please try again later.',
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
          },
        },
      };
    }

    // Handle NestJS HttpException (including ValidationPipe errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Explicit mapping for auth errors
      if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
        const code =
          status === HttpStatus.UNAUTHORIZED ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN;
        const extracted = extractExceptionResponseMessage(exceptionResponse);
        const message = typeof extracted === 'string' ? extracted : exception.message;

        return {
          statusCode: status,
          errorResponse: {
            success: false,
            error: {
              code,
              message,
              statusCode: status,
              details: extracted
                ? { errors: Array.isArray(extracted) ? extracted : [extracted] }
                : undefined,
            },
          },
        };
      }

      // Handle validation errors from class-validator
      if (extractExceptionResponseMessage(exceptionResponse)) {
        const extracted = extractExceptionResponseMessage(exceptionResponse)!;
        const messages = Array.isArray(extracted) ? extracted : [extracted];

        return {
          statusCode: status,
          errorResponse: {
            success: false,
            error: {
              code:
                status === 400 ? ErrorCode.VALIDATION_ERROR : this.mapHttpStatusToErrorCode(status),
              message: messages.join(', '),
              statusCode: status,
              details: { errors: messages },
            },
          },
        };
      }

      const code = this.mapHttpStatusToErrorCode(status);

      return {
        statusCode: status,
        errorResponse: {
          success: false,
          error: {
            code,
            message: exception.message,
            statusCode: status,
          },
        },
      };
    }

    // Handle unknown errors
    // Mask internal error details in production-like environments
    const isProduction = process.env.NODE_ENV === 'production';
    const message = this.resolveUnknownErrorMessage(exception, isProduction);

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorResponse: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      },
    };
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    const map: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.RESOURCE_NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.VALIDATION_ERROR,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.INTERNAL_ERROR,
      [HttpStatus.BAD_GATEWAY]: ErrorCode.EXTERNAL_API_ERROR,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
      [HttpStatus.GATEWAY_TIMEOUT]: ErrorCode.EXTERNAL_API_ERROR,
    };
    return map[status] ?? ErrorCode.UNKNOWN_ERROR;
  }

  private resolveUnknownErrorMessage(exception: unknown, isProduction: boolean): string {
    if (isProduction) return 'Internal server error';
    if (exception instanceof Error) {
      const { message } = exception;
      return message;
    }
    return 'Unknown error occurred';
  }
}
