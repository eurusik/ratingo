jest.mock('ky', () => ({
  __esModule: true,
  HTTPError: class HTTPError extends Error {
    constructor(public readonly response: { status: number }) {
      super('HTTPError');
    }
  },
}));

import { HTTPError } from 'ky';
import { ApiError, isNotFoundError } from '../error';

function httpError(status: number): HTTPError {
  const ErrorClass = HTTPError as unknown as new (response: { status: number }) => HTTPError;
  return new ErrorClass({ status });
}

describe('isNotFoundError', () => {
  it('returns true for an ApiError with status 404', () => {
    expect(isNotFoundError(new ApiError('SHOW_NOT_FOUND', 404, 'Not found'))).toBe(true);
  });

  it('returns false for an ApiError with another status', () => {
    expect(isNotFoundError(new ApiError('INTERNAL_ERROR', 500, 'Boom'))).toBe(false);
  });

  it('returns true for an HTTPError with a 404 response', () => {
    expect(isNotFoundError(httpError(404))).toBe(true);
  });

  it('returns false for an HTTPError with a 502 response', () => {
    expect(isNotFoundError(httpError(502))).toBe(false);
  });

  it('returns false for network and unknown errors', () => {
    expect(isNotFoundError(new TypeError('fetch failed'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
