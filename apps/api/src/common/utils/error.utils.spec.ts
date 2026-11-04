import { errorMessage, toError } from './error.utils';

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to the error name when the message is empty', () => {
    expect(errorMessage(new TypeError())).toBe('TypeError');
  });

  it('returns strings as is', () => {
    expect(errorMessage('boom')).toBe('boom');
  });

  it('uses the message of error-like objects', () => {
    expect(errorMessage({ message: 'upstream failed', status: 503 })).toBe('upstream failed');
  });

  it('does not serialize other object fields, so bound params never reach logs', () => {
    expect(errorMessage({ params: ['user@example.com', 'hunter2'] })).toBe('[object Object]');
  });

  it('stringifies primitives, null and undefined', () => {
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });
});

describe('toError', () => {
  it('returns the same Error instance', () => {
    const error = new Error('boom');
    expect(toError(error)).toBe(error);
  });

  it('wraps non-Error values with a readable message', () => {
    const wrapped = toError({ message: 'upstream failed' });
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe('upstream failed');
  });
});
