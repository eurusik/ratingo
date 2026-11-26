import { DatabaseException } from '@/common/exceptions/database.exception';
import { MdblistApiException, TmdbApiException } from '@/common/exceptions/external-api.exception';
import { NotFoundException } from '@/common/exceptions/not-found.exception';
import { HttpError } from '@/common/http/resilient-http.client';
import { ErrorCode } from '@/common/enums/error-code.enum';

import { toFailureSignal } from './failure-signal.mapper';

describe('toFailureSignal', () => {
  it('reads the upstream status of an external API error, not its own 502', () => {
    expect(toFailureSignal(new TmdbApiException('Too Many Requests', 429))).toEqual({
      errorName: 'TmdbApiException',
      httpStatus: 429,
      errorCode: null,
      message: 'TMDB API: Too Many Requests',
    });
  });

  it('has no status for an external API error without an upstream status', () => {
    expect(toFailureSignal(new MdblistApiException('API key is required')).httpStatus).toBeNull();
  });

  it('reads the status of a raw HTTP error and of an app exception', () => {
    expect(toFailureSignal(new HttpError('Request timeout', 408)).httpStatus).toBe(408);
    expect(
      toFailureSignal(new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND, 'missing')).httpStatus,
    ).toBe(404);
  });

  it('reads the error code from the error or its cause', () => {
    const network = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }),
    });
    expect(toFailureSignal(network).errorCode).toBe('ECONNREFUSED');
    expect(toFailureSignal(new DatabaseException('x')).errorName).toBe('DatabaseException');
  });

  it('describes a thrown non-error value', () => {
    expect(toFailureSignal('boom')).toEqual({
      errorName: 'string',
      httpStatus: null,
      errorCode: null,
      message: 'boom',
    });
  });
});
