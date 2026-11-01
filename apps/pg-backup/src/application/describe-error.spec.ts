import { describeError } from './describe-error';

describe('describeError', () => {
  it('uses the message of an error', () => {
    expect(describeError(new Error('pg_dump exited with code 1'))).toBe(
      'pg_dump exited with code 1',
    );
  });

  it('prefixes a system error code missing from the message', () => {
    const error = Object.assign(new Error('connection lost'), { code: 'ECONNRESET' });

    expect(describeError(error)).toBe('ECONNRESET connection lost');
  });

  it('does not repeat a code already in the message', () => {
    const error = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

    expect(describeError(error)).toBe('write EPIPE');
  });

  it('stringifies non-errors', () => {
    expect(describeError('boom')).toBe('boom');
  });
});
