import { toServiceVersion } from './service-version';

describe('toServiceVersion', () => {
  it('shortens a commit SHA to its first seven characters', () => {
    expect(toServiceVersion('abcdef1234567890')).toBe('abcdef1');
  });

  it('falls back to local without a commit SHA', () => {
    expect(toServiceVersion(undefined)).toBe('local');
  });
});
