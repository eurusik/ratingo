import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

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

    // Log based on severity
    if (statusCode >= 500) {
      this.logger.error(
        `${errorResponse.error.code}: ${errorResponse.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${errorResponse.error.code}: ${errorResponse.error.message}`);
    }

    response.status(statusCode).send(errorResponse);
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

    // Handle NestJS HttpException (including ValidationPipe errors)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Explicit mapping for auth errors
      if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
        const code =
          status === HttpStatus.UNAUTHORIZED ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN;
        const message =
          typeof exceptionResponse === 'object' && 'message' in (exceptionResponse as any)
            ? ((exceptionResponse as any).message as string)
            : exception.message;

        return {
          statusCode: status,
          errorResponse: {
            success: false,
            error: {
              code,
              message,
              statusCode: status,
              details:
                typeof exceptionResponse === 'object' && 'message' in (exceptionResponse as any)
                  ? {
                      errors: Array.isArray((exceptionResponse as any).message)
                        ? (exceptionResponse as any).message
                        : [(exceptionResponse as any).message],
                    }
                  : undefined,
            },
          },
        };
      }

      // Handle validation errors from class-validator
      if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        const messages = Array.isArray((exceptionResponse as any).message)
          ? (exceptionResponse as any).message
          : [(exceptionResponse as any).message];

        return {
          statusCode: status,
          errorResponse: {
            success: false,
            error: {
              code: status === 400 ? ErrorCode.VALIDATION_ERROR : ErrorCode.UNKNOWN_ERROR,
              message: messages.join(', '),
              statusCode: status,
              details: { errors: messages },
            },
          },
        };
      }

      const code =
        status === HttpStatus.UNAUTHORIZED
          ? ErrorCode.UNAUTHORIZED
          : status === HttpStatus.FORBIDDEN
            ? ErrorCode.FORBIDDEN
            : ErrorCode.UNKNOWN_ERROR;

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
    const message = isProduction
      ? 'Internal server error'
      : exception instanceof Error
        ? exception.message
        : 'Unknown error occurred';

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
}
