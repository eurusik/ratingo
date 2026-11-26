import * as fc from 'fast-check';

import { MAX_SPELLED_NUMBER, spellNumber } from './number-words.policy';

describe('spellNumber', () => {
  it.each([
    [0, 'zero'],
    [2, 'two'],
    [4, 'four'],
    [13, 'thirteen'],
    [20, 'twenty'],
    [45, 'forty-five'],
    [99, 'ninety-nine'],
  ])('spells %d as %s', (value, words) => {
    expect(spellNumber(value)).toBe(words);
  });

  it('spells every supported number without a digit and gives each its own words', () => {
    const spelled = Array.from({ length: MAX_SPELLED_NUMBER + 1 }, (_, value) =>
      spellNumber(value),
    );

    expect(spelled.every((words) => words !== null && !/\d/.test(words))).toBe(true);
    expect(new Set(spelled).size).toBe(spelled.length);
  });

  it('refuses what it cannot spell instead of guessing', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: MAX_SPELLED_NUMBER + 1 }),
          fc.integer({ max: -1 }),
          fc.double({ noInteger: true }),
        ),
        (value) => {
          expect(spellNumber(value)).toBeNull();
        },
      ),
    );
  });
});
