/**
 * Catalog Domain Exception Filter
 *
 * Maps domain errors to HTTP responses.
 */

import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { type FastifyReply } from 'fastify';

import { CatalogDomainError, MovieNotFoundError, ShowNotFoundError } from '../../domain/errors';

type CaughtError = CatalogDomainError;

@Catch(CatalogDomainError)
export class CatalogDomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CatalogDomainExceptionFilter.name);

  catch(exception: CaughtError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const { statusCode, body } = this.buildResponse(exception);

    this.logger.warn(`Catalog domain error: ${exception.code} - ${exception.message}`);

    void response.status(statusCode).send(body);
  }

  private buildResponse(exception: CaughtError): {
    statusCode: number;
    body: {
      success: false;
      error: {
        code: string;
        message: string;
        statusCode: number;
        details?: Record<string, unknown>;
      };
    };
  } {
    if (exception instanceof MovieNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.NOT_FOUND,
            details: { slug: exception.slug },
          },
        },
      };
    }

    if (exception instanceof ShowNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            statusCode: HttpStatus.NOT_FOUND,
            details: { slug: exception.slug },
          },
        },
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      },
    };
  }
}
