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
  const asNumber = (number: number) => ({ kind: 'number', number });
  const PICK = { kind: 'pick' };

  it.each([
    ['а глянь 469 пр', 469],
    ['переглянь PR 470', 470],
    ["рев'ю #470", 470],
    ['ревʼю #471', 471],
    ['ревью #472', 472],
    ['check pr 470', 470],
    ['review pull request 12', 12],
    ['подивись на пул-реквест №7', 7],
    ['перевір 33 PR будь ласка', 33],
    ['Глянь PR#9?', 9],
    ['ну а перевір #5', 5],
    ['глянь мр 15', 15],
    ['глянь 15 мрку', 15],
    ['шо там по мру 469', 469],
    ['що там по PR #12?', 12],
    ['глянь шо там по пулу 8', 8],
    ['глянь merge request 4', 4],
  ])('reads «%s» as a numbered request', (text, number) => {
    expect(matchReviewRequest(text)).toEqual(asNumber(number));
  });

  it.each([
    'зроби ревью',
    "Зроби рев'ю, будь ласка",
    'проревʼюй',
    'а глянь шо там по мру',
    'шо там по мру?',
    'що там по PR',
    'глянь мр',
    'глянь на мрку',
    'переглянь пулл',
    'перевір пулреквест',
    'зроби review',
    'check pr',
    'подивись PR',
  ])('reads «%s» as a request without a number', (text) => {
    expect(matchReviewRequest(text)).toEqual(PICK);
  });

  it.each([
    'що Хеппі сказав про 470?',
    'скільки PR злили за тиждень?',
    'скільки мрів відкрито',
    'глянь 469',
    'глянь по коду де може бути проблема',
    'чому падає черга — глянь в коді',
    'що там по 470',
    'шо там по черзі',
    'перевіряв PR 470?',
    'переглянь усі PR за тиждень 3',
    'чому не оновився trending #12',
    'глянь 0 пр',
    'зроби звіт',
    'зроби ревью сайту черги і ще купу всього',
    'мрія про пр',
    'review the 12 files of pr',
    '',
  ])('leaves «%s» to the agent', (text) => {
    expect(matchReviewRequest(text)).toBeNull();
  });

  const VERBS = ['глянь', 'переглянь', 'подивись', 'перевір', "рев'ю", 'ревью', 'review', 'check'];
  const TOKENS = [
    'PR',
    'пр',
    'мр',
    'мру',
    'мрку',
    'MR',
    'пулл',
    'пулреквест',
    'пул-реквест',
    'pull request',
    'merge request',
  ];
  const NUMBERED: ((token: string, number: number) => string)[] = [
    (token, n) => `${token} ${n}`,
    (token, n) => `${n} ${token}`,
    (_token, n) => `#${n}`,
  ];

  it('catches every verb with every pull request word and any number', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VERBS),
        fc.constantFrom(...TOKENS),
        fc.constantFrom(...NUMBERED),
        fc.constantFrom('', 'а ', 'ну '),
        fc.integer({ min: 1, max: 999_999_999 }),
        (verb, token, shape, lead, number) =>
          JSON.stringify(matchReviewRequest(`${lead}${verb} ${shape(token, number)}`)) ===
          JSON.stringify(asNumber(number)),
      ),
    );
  });

  it('catches every verb followed by a pull request word as a request without a number', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VERBS),
        fc.constantFrom(...TOKENS),
        (verb, token) =>
          JSON.stringify(matchReviewRequest(`${verb} ${token}`)) === JSON.stringify(PICK),
      ),
    );
  });

  it('never fires on a number alone, a verb alone or a pull request word alone', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VERBS),
        fc.integer({ min: 1, max: 9999 }),
        (verb, number) =>
          matchReviewRequest(`${verb} ${number}`) === null && matchReviewRequest(verb) === null,
      ),
    );
    fc.assert(
      fc.property(
        fc.constantFrom(...TOKENS),
        fc.integer({ min: 1, max: 9999 }),
        (token, number) =>
          matchReviewRequest(`${token} ${number}`) === null && matchReviewRequest(token) === null,
      ),
    );
  });

  it('is total and a numbered result is always a positive integer', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        const target = matchReviewRequest(text);
        return (
          target === null ||
          target.kind === 'pick' ||
          (target.kind === 'number' && Number.isInteger(target.number) && target.number > 0)
        );
      }),
    );
  });
});
