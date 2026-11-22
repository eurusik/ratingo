import fc from 'fast-check';

import { parseHappyTarget, isSameRepository } from './happy-target.policy';

describe('parseHappyTarget', () => {
  it.each([
    ['глянь 470', 470],
    ["рев'ю #470", 470],
    ['глянь на PR №12', 12],
    ['470', 470],
    ['що там по 470?', 470],
    ['470 будь ласка', 470],
  ])('reads the number from «%s»', (text, number) => {
    expect(parseHappyTarget(text)).toEqual({ kind: 'number', number });
  });

  it.each([
    '',
    'привіт',
    'глянь',
    '0',
    '000',
    'що ти там казав про той великий PR 470',
    'порахуй 12 і 34',
    '1234567890',
  ])('does not guess a number in «%s»', (text) => {
    expect(parseHappyTarget(text)).toEqual({ kind: 'unclear' });
  });

  it('prefers a pull request link over a number and keeps its repository', () => {
    expect(parseHappyTarget('глянь 5 https://github.com/other/repo/pull/9')).toEqual({
      kind: 'link',
      pullRequest: { owner: 'other', repo: 'repo', number: 9 },
    });
  });

  it('is total, and a number target is always a positive integer', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        const target = parseHappyTarget(text);
        return target.kind !== 'number' || (Number.isInteger(target.number) && target.number > 0);
      }),
    );
  });

  it('compares repositories ignoring letter case', () => {
    expect(isSameRepository({ owner: 'Eurusik', repo: 'RATINGO' }, 'eurusik/ratingo')).toBe(true);
    expect(isSameRepository({ owner: 'eurusik', repo: 'other' }, 'eurusik/ratingo')).toBe(false);
  });
});
