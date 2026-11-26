import * as fc from 'fast-check';

import { JOB_FAILURE_CLASSES, JobFailureClass } from '../constants/job-failure-class.constants';
import { type FailureSignal } from '../entities/failure-signal.entity';

import { classOfHttpStatus, classifyJobFailure } from './classify-job-failure.policy';

const signal = (overrides: Partial<FailureSignal> = {}): FailureSignal => ({
  errorName: 'Error',
  httpStatus: null,
  errorCode: null,
  message: '',
  ...overrides,
});

const signalArb: fc.Arbitrary<FailureSignal> = fc.record({
  errorName: fc.oneof(
    fc.constantFrom('Error', 'TypeError', 'TraktApiException', 'DatabaseException', 'AbortError'),
    fc.string({ maxLength: 30 }),
  ),
  httpStatus: fc.option(fc.integer({ min: 100, max: 599 }), { nil: null }),
  errorCode: fc.option(
    fc.oneof(fc.constantFrom('ECONNRESET', 'ETIMEDOUT', '23505', '57014'), fc.string()),
    { nil: null },
  ),
  message: fc.oneof(
    fc.constantFrom('Too Many Requests', 'Request timeout', 'Not Found', 'socket hang up'),
    fc.string({ maxLength: 200 }),
  ),
});

const decisiveStatusArb = fc.constantFrom(401, 403, 404, 407, 408, 410, 429, 502, 503, 504);
const plainErrorNameArb = fc.constantFrom('Error', 'TraktApiException', 'TmdbApiException');

describe('classifyJobFailure', () => {
  it('always returns one of the known classes', () => {
    fc.assert(
      fc.property(signalArb, (input) => {
        expect(JOB_FAILURE_CLASSES).toContain(classifyJobFailure(input));
      }),
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(signalArb, (input) => {
        expect(classifyJobFailure(input)).toBe(classifyJobFailure({ ...input }));
      }),
    );
  });

  it('lets a known HTTP status decide over the message and the error code', () => {
    fc.assert(
      fc.property(
        plainErrorNameArb,
        decisiveStatusArb,
        fc.option(fc.string(), { nil: null }),
        fc.string({ maxLength: 200 }),
        (errorName, httpStatus, errorCode, message) => {
          expect(classifyJobFailure({ errorName, httpStatus, errorCode, message })).toBe(
            classOfHttpStatus(httpStatus),
          );
        },
      ),
    );
  });

  it('lets a database error type decide over the status and the message', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('DatabaseException', 'PostgresError', 'DrizzleQueryError'),
        fc.option(decisiveStatusArb, { nil: null }),
        fc.string({ maxLength: 200 }),
        (errorName, httpStatus, message) => {
          expect(classifyJobFailure(signal({ errorName, httpStatus, message }))).toBe(
            JobFailureClass.DATABASE,
          );
        },
      ),
    );
  });

  it.each([
    [{ httpStatus: 429 }, JobFailureClass.RATE_LIMIT],
    [{ httpStatus: 401 }, JobFailureClass.ACCESS_DENIED],
    [{ httpStatus: 404 }, JobFailureClass.NOT_FOUND],
    [{ httpStatus: 408 }, JobFailureClass.TIMEOUT],
    [{ httpStatus: 503 }, JobFailureClass.NETWORK],
    [{ errorName: 'AbortError' }, JobFailureClass.TIMEOUT],
    [{ errorCode: 'ECONNREFUSED' }, JobFailureClass.NETWORK],
    [{ errorCode: 'ETIMEDOUT' }, JobFailureClass.TIMEOUT],
    [{ errorCode: '40P01' }, JobFailureClass.DATABASE],
    [
      { message: 'Rate limiter queue full (100). Too many concurrent requests.' },
      JobFailureClass.RATE_LIMIT,
    ],
    [{ message: 'Trakt API: Client ID is not configured' }, JobFailureClass.OTHER],
    [{ message: 'OMDb API: API key is required' }, JobFailureClass.ACCESS_DENIED],
    [{ message: 'connect timed out after 15000ms' }, JobFailureClass.TIMEOUT],
    [{ message: 'fetch failed' }, JobFailureClass.NETWORK],
    [{ message: 'Show 429 not found in catalog' }, JobFailureClass.NOT_FOUND],
    [{ message: 'upstream answered status 429' }, JobFailureClass.RATE_LIMIT],
    [{ httpStatus: 500, message: 'Request failed' }, JobFailureClass.OTHER],
  ])('classifies %j as %s', (overrides, expected) => {
    expect(classifyJobFailure(signal(overrides))).toBe(expected);
  });
});
