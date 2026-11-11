jest.mock('ky', () => ({
  __esModule: true,
  HTTPError: class HTTPError extends Error {
    constructor(public readonly response: FakeResponse) {
      super('HTTPError');
    }
  },
}));

import { HTTPError } from 'ky';
import { ApiError, isNotFoundError } from '../error';

interface FakeResponse {
  status: number;
  clone: () => { json: () => Promise<unknown> };
}

function httpError(status: number, body: string): HTTPError {
  const ErrorClass = HTTPError as unknown as new (response: FakeResponse) => HTTPError;
  return new ErrorClass({
    status,
    clone: () => ({ json: async () => JSON.parse(body) }),
  });
}

const apiNotFoundBody = JSON.stringify({
  success: false,
  error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found', statusCode: 404 },
});

describe('isNotFoundError', () => {
  it('returns true for an ApiError with status 404', async () => {
    await expect(isNotFoundError(new ApiError('SHOW_NOT_FOUND', 404, 'Not found'))).resolves.toBe(
      true,
    );
  });

  it('returns false for an ApiError with another status', async () => {
    await expect(isNotFoundError(new ApiError('INTERNAL_ERROR', 500, 'Boom'))).resolves.toBe(false);
  });

  it('returns true for an HTTP 404 that carries the API error envelope', async () => {
    await expect(isNotFoundError(httpError(404, apiNotFoundBody))).resolves.toBe(true);
  });

  it('returns false for an HTTP 404 without the API error envelope', async () => {
    await expect(isNotFoundError(httpError(404, '<html>Application not found</html>'))).resolves.toBe(
      false,
    );
  });

  it('returns false for an HTTP 502', async () => {
    await expect(isNotFoundError(httpError(502, apiNotFoundBody))).resolves.toBe(false);
  });

  it('returns false for network and unknown errors', async () => {
    await expect(isNotFoundError(new TypeError('fetch failed'))).resolves.toBe(false);
    await expect(isNotFoundError(null)).resolves.toBe(false);
  });
});
