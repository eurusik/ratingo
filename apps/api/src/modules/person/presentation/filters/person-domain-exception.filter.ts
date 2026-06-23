/**
 * Person Domain Exception Filter
 *
 * Maps person domain errors to HTTP responses.
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { type FastifyReply } from 'fastify';

import { type ErrorResponseDto } from '../../../../common/dtos/error-response.dto';
import { ErrorResponseBuilder } from '../../../../common/utils/error-response.builder';
import { PersonDomainError, PersonNotFoundError } from '../../domain/errors';

@Catch(PersonDomainError)
export class PersonDomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PersonDomainExceptionFilter.name);

  catch(exception: PersonDomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const { statusCode, body } = this.buildResponse(exception);

    this.logger.warn(`Person domain error: ${exception.code} - ${exception.message}`);

    void response.status(statusCode).send(body);
  }

  private buildResponse(exception: PersonDomainError): {
    statusCode: number;
    body: ErrorResponseDto;
  } {
    if (exception instanceof PersonNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        body: ErrorResponseBuilder.build(exception, HttpStatus.NOT_FOUND, {
          tmdbId: exception.tmdbId,
        }),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: ErrorResponseBuilder.build(exception, HttpStatus.INTERNAL_SERVER_ERROR),
    };
  }
}
