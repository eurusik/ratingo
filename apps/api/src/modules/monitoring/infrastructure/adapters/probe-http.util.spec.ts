import { HttpStatus } from '@nestjs/common';

import * as fc from 'fast-check';

import { type FetchResult, HttpError } from '@/common/http/resilient-http.client';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';

import { mapHttpFailure } from './probe-http.util';

function failedResult(error: Error): FetchResult<unknown> {
  return { data: null, success: false, attempts: 1, error };
}

const AUTH_STATUSES = [HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN];

describe('mapHttpFailure - property-based', () => {
  it('maps 401/403 to invalid and preserves the status code', () => {
    fc.assert(
      fc.property(fc.constantFrom(...AUTH_STATUSES), (status) => {
        const result = mapHttpFailure(failedResult(new HttpError('nope', status)));
        expect(result.status).toBe(API_KEY_STATUS.INVALID);
        expect(result.statusCode).toBe(status);
      }),
    );
  });

  it('maps 429 to degraded', () => {
    const result = mapHttpFailure(
      failedResult(new HttpError('slow down', HttpStatus.TOO_MANY_REQUESTS)),
    );
    expect(result.status).toBe(API_KEY_STATUS.DEGRADED);
    expect(result.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('maps any other HTTP status to unknown', () => {
    const otherStatus = fc
      .integer({ min: 400, max: 599 })
      .filter((s) => ![...AUTH_STATUSES, HttpStatus.TOO_MANY_REQUESTS].includes(s));

    fc.assert(
      fc.property(otherStatus, (status) => {
        const result = mapHttpFailure(failedResult(new HttpError('err', status)));
        expect(result.status).toBe(API_KEY_STATUS.UNKNOWN);
        expect(result.statusCode).toBe(status);
      }),
    );
  });

  it('maps non-HTTP (network) errors to unknown with no status code', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (message) => {
        const result = mapHttpFailure(failedResult(new Error(message)));
        expect(result.status).toBe(API_KEY_STATUS.UNKNOWN);
        expect(result.statusCode).toBeNull();
      }),
    );
  });
});
