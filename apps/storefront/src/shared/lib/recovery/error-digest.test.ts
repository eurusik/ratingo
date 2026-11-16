import { errorDigest } from './error-digest';

describe('errorDigest', () => {
  it('reads the digest Next attaches to server errors', () => {
    expect(errorDigest(Object.assign(new Error('boom'), { digest: '8f3a2c1d' }))).toBe('8f3a2c1d');
  });

  it.each([
    ['an error without a digest', new Error('boom')],
    ['a non-string digest', Object.assign(new Error('boom'), { digest: 42 })],
    ['a thrown string', 'boom'],
    ['nothing', undefined],
  ])('returns nothing for %s', (_label, error) => {
    expect(errorDigest(error)).toBeUndefined();
  });
});
