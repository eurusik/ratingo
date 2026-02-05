/**
 * Catalog Domain Exception Filter Tests
 */

import { type ArgumentsHost, HttpStatus } from '@nestjs/common';

import { type FastifyReply } from 'fastify';

import { CatalogDomainError, MovieNotFoundError, ShowNotFoundError } from '../../domain/errors';

import { CatalogDomainExceptionFilter } from './catalog-domain-exception.filter';

describe('CatalogDomainExceptionFilter', () => {
  let filter: CatalogDomainExceptionFilter;
  let mockResponse: { status: jest.Mock; send: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new CatalogDomainExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: (): FastifyReply => mockResponse as unknown as FastifyReply,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle MovieNotFoundError with 404', () => {
    const error = new MovieNotFoundError('the-matrix');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'MOVIE_NOT_FOUND',
        message: error.message,
        statusCode: HttpStatus.NOT_FOUND,
        details: { slug: 'the-matrix' },
      },
    });
  });

  it('should handle ShowNotFoundError with 404', () => {
    const error = new ShowNotFoundError('breaking-bad');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'SHOW_NOT_FOUND',
        message: error.message,
        statusCode: HttpStatus.NOT_FOUND,
        details: { slug: 'breaking-bad' },
      },
    });
  });

  it('should log warning with error code and message', () => {
    const warnSpy = jest.spyOn(filter['logger'], 'warn');
    const error = new MovieNotFoundError('test-slug');

    filter.catch(error, mockHost);

    expect(warnSpy).toHaveBeenCalledWith(
      'Catalog domain error: MOVIE_NOT_FOUND - Movie with slug "test-slug" not found',
    );
  });

  it('should handle generic CatalogDomainError with 500', () => {
    class UnknownCatalogError extends CatalogDomainError {
      readonly code = 'UNKNOWN_CATALOG_ERROR';
      constructor() {
        super('Something went wrong');
        this.name = 'UnknownCatalogError';
      }
    }
    const error = new UnknownCatalogError();

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNKNOWN_CATALOG_ERROR',
        message: 'Something went wrong',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    });
  });
});
