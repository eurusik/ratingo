import * as fc from 'fast-check';

// ky is ESM-only — mock the module so utils.ts can resolve { HTTPError }.
// jest.mock is hoisted, so the class must be defined inside the factory.
jest.mock('ky', () => {
  class HTTPError extends Error {
    response: { status: number };
    constructor(status: number) {
      super(`HTTP ${status}`);
      this.response = { status };
      Object.setPrototypeOf(this, HTTPError.prototype);
    }
  }
  return { __esModule: true, HTTPError };
});

// Re-import the mocked HTTPError so we can construct instances in tests.
import { HTTPError } from 'ky';

import { retryUnlessUnauthorized } from '../utils';

function makeHTTPError(status: number): InstanceType<typeof HTTPError> {
  // The real HTTPError takes (response, request, options), but our mock
  // accepts a single status number for convenience.
  return new (HTTPError as any)(status);
}

function nonUnauthorizedStatusArb(): fc.Arbitrary<number> {
  return fc.integer({ min: 100, max: 599 }).filter((s) => s !== 401);
}

describe('retryUnlessUnauthorized', () => {
  it('returns false for 401 HTTPError regardless of failureCount', () => {
    fc.assert(
      fc.property(fc.nat({ max: 100 }), (failureCount) => {
        expect(retryUnlessUnauthorized(failureCount, makeHTTPError(401))).toBe(false);
      }),
    );
  });

  it('returns true for non-401 HTTPError when failureCount < 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }),
        nonUnauthorizedStatusArb(),
        (failureCount, status) => {
          expect(retryUnlessUnauthorized(failureCount, makeHTTPError(status))).toBe(true);
        },
      ),
    );
  });

  it('returns false for non-401 HTTPError when failureCount >= 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        nonUnauthorizedStatusArb(),
        (failureCount, status) => {
          expect(retryUnlessUnauthorized(failureCount, makeHTTPError(status))).toBe(false);
        },
      ),
    );
  });

  it('delegates to count check for non-HTTPError', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.oneof(
          fc.constant(new Error('network')),
          fc.constant(null),
          fc.constant(undefined),
          fc.string().map((s) => new Error(s)),
        ),
        (failureCount, error) => {
          const expected = failureCount < 2;
          expect(retryUnlessUnauthorized(failureCount, error)).toBe(expected);
        },
      ),
    );
  });

  it('boundary: failureCount=1 retries, failureCount=2 stops', () => {
    const error = new Error('network');
    expect(retryUnlessUnauthorized(1, error)).toBe(true);
    expect(retryUnlessUnauthorized(2, error)).toBe(false);
  });
});
