import fc from 'fast-check';

import { isSameRepository, matchReviewRequest, parseHappyTarget } from './happy-target.policy';

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

describe('matchReviewRequest', () => {
  it.each([
    ['а глянь 469 пр', 469],
    ['переглянь PR 470', 470],
    ["рев'ю #470", 470],
    ['ревʼю #471', 471],
    ['check pr 470', 470],
    ['review pull request 12', 12],
    ['подивись на пул-реквест №7', 7],
    ['перевір 33 PR будь ласка', 33],
    ['Глянь PR#9?', 9],
    ['ну а перевір #5', 5],
  ])('treats «%s» as a review request for %i', (text, number) => {
    expect(matchReviewRequest(text)).toBe(number);
  });

  it.each([
    'що Хеппі сказав про 470?',
    'скільки PR злили за тиждень?',
    'глянь 469',
    'глянь пр',
    'перевір чи працює сайт 5 разів',
    'перевіряв PR 470?',
    'переглянь усі PR за тиждень 3',
    'чому не оновився trending #12',
    'глянь 0 пр',
    'review the 12 files of pr',
    '',
  ])('leaves «%s» to the agent', (text) => {
    expect(matchReviewRequest(text)).toBeNull();
  });

  const VERBS = ['глянь', 'переглянь', 'подивись', 'перевір', "рев'ю", 'review', 'check'];
  const SHAPES: ((number: number) => string)[] = [
    (n) => `PR ${n}`,
    (n) => `пр ${n}`,
    (n) => `#${n}`,
    (n) => `${n} пр`,
    (n) => `pull request ${n}`,
  ];

  it('catches every verb with every pull request shape and any number', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VERBS),
        fc.constantFrom(...SHAPES),
        fc.constantFrom('', 'а ', 'ну '),
        fc.integer({ min: 1, max: 999_999_999 }),
        (verb, shape, lead, number) =>
          matchReviewRequest(`${lead}${verb} ${shape(number)}`) === number,
      ),
    );
  });

  it('never fires without a verb, and a bare number is never enough', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SHAPES),
        fc.integer({ min: 1, max: 9999 }),
        (shape, number) => matchReviewRequest(shape(number)) === null,
      ),
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...VERBS),
        fc.integer({ min: 1, max: 9999 }),
        (verb, number) => matchReviewRequest(`${verb} ${number}`) === null,
      ),
    );
  });

  it('is total and only ever returns a positive integer', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        const number = matchReviewRequest(text);
        return number === null || (Number.isInteger(number) && number > 0);
      }),
    );
  });
});
