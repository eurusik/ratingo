import { avatarProblem } from './avatar-file';

const MEGABYTE = 1024 * 1024;

describe('avatarProblem', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts a small %s', (type) => {
    expect(avatarProblem({ type, size: MEGABYTE })).toBeNull();
  });

  it('rejects other image formats', () => {
    expect(avatarProblem({ type: 'image/gif', size: MEGABYTE })).toBe('type');
  });

  it('rejects files over 5 MB', () => {
    expect(avatarProblem({ type: 'image/png', size: 5 * MEGABYTE + 1 })).toBe('size');
  });
});
