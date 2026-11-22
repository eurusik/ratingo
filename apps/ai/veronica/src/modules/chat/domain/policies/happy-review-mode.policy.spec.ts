import fc from 'fast-check';

import { parseReviewMode } from './happy-review-mode.policy';

describe('parseReviewMode', () => {
  it.each([
    ['глянь 470 повністю', 'глянь 470'],
    ['повне рев’ю 470', 'рев’ю 470'],
    ['Повного ревю 470', 'ревю 470'],
    ['review 470 FULL', 'review 470'],
  ])('reads a full review from «%s»', (text, rest) => {
    expect(parseReviewMode(text)).toEqual({ text: rest, mode: 'full', marked: true });
  });

  it('strips «нові коміти» without changing the mode', () => {
    expect(parseReviewMode('глянь нові коміти в 470')).toEqual({
      text: 'глянь в 470',
      mode: 'auto',
      marked: true,
    });
  });

  it('leaves text without a marker untouched, spacing included', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9 ]{0,40}$/).filter((text) => !/full/i.test(text)),
        (text) => {
          expect(parseReviewMode(text)).toEqual({ text, mode: 'auto', marked: false });
        },
      ),
    );
  });

  it('does not treat a word that merely contains the marker as a marker', () => {
    for (const text of ['fullstack 470', 'повністюсть', 'нові комітети']) {
      expect(parseReviewMode(text).mode).toBe('auto');
    }
  });

  it('is idempotent: stripping twice changes nothing more', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (text) => {
        const once = parseReviewMode(text);
        expect(parseReviewMode(once.text).text).toBe(once.text);
      }),
    );
  });
});
