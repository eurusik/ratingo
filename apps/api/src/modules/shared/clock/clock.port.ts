/**
 * Clock Port - Abstraction for time operations.
 *
 * Enables testability by allowing time to be mocked in tests.
 */

export const CLOCK_PORT = Symbol('CLOCK_PORT');

export interface IClockPort {
  now(): Date;
}

/**
 * System clock implementation using real time.
 */
export class SystemClock implements IClockPort {
  now(): Date {
    return new Date();
  }
}
