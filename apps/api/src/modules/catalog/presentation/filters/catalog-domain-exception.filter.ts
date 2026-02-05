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

import { type ErrorResponseDto } from '../../../../common/dtos/error-response.dto';
import { ErrorResponseBuilder } from '../../../../common/utils/error-response.builder';
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
    body: ErrorResponseDto;
  } {
    if (exception instanceof MovieNotFoundError || exception instanceof ShowNotFoundError) {
      return this.createResponse(exception, HttpStatus.NOT_FOUND, { slug: exception.slug });
    }

    return this.createResponse(exception, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private createResponse(
    exception: CaughtError,
    statusCode: number,
    details?: Record<string, unknown>,
  ): { statusCode: number; body: ErrorResponseDto } {
    return {
      statusCode,
      body: ErrorResponseBuilder.build(exception, statusCode, details),
    };
  }
}
