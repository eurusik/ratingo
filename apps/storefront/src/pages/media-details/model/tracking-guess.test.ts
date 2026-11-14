import { guessTracking } from './tracking-guess';

describe('guessTracking', () => {
  it('expects guest actions without a session', () => {
    expect(guessTracking(false, 5)).toBe('guest');
  });

  it('expects the start card when nothing was watched', () => {
    expect(guessTracking(true, 0)).toBe('start');
  });

  it('expects the watching card when episodes were watched', () => {
    expect(guessTracking(true, 3)).toBe('watching');
  });
});
