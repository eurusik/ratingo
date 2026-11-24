import * as fc from 'fast-check';

import {
  FLAGGED_NOTE_MAX_CHARS,
  withFlaggedNumbers,
  withoutFlaggedNote,
} from './flagged-numbers.policy';

describe('flagged numbers note', () => {
  it('leaves an answer with nothing flagged untouched', () => {
    expect(withFlaggedNumbers('Усе гаразд: 7.', [])).toBe('Усе гаразд: 7.');
  });

  it('adds one trusted line with the flagged numbers, deduped and capped', () => {
    expect(withFlaggedNumbers('Текст.', ['78', '0.503', '78'])).toBe(
      'Текст.\n\n<i>Не звірено з даними: 78, 0,503.</i>',
    );
    expect(withFlaggedNumbers('Текст.', ['1', '2', '3', '4', '5', '6', '7'])).toBe(
      'Текст.\n\n<i>Не звірено з даними: 1, 2, 3, 4, 5 і ще 2.</i>',
    );
  });

  it('keeps the note within its size limit', () => {
    const long = Array.from({ length: 40 }, (_, index) => `${'9'.repeat(30)}${index}`);
    const note = withFlaggedNumbers('', long);
    expect(note.length).toBeLessThanOrEqual(FLAGGED_NOTE_MAX_CHARS);
  });

  it('never puts anything but numbers into the note', () => {
    expect(withFlaggedNumbers('Текст.', ['<b>x</b>'])).toBe('Текст.');
  });

  it('keeps the answer byte-identical apart from the note', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.integer({ min: 0, max: 99_999 }).map(String), { maxLength: 8 }),
        (text, flagged) => {
          const html = withFlaggedNumbers(text, flagged);
          expect(html.startsWith(text)).toBe(true);
          expect(withoutFlaggedNote(html)).toBe(text);
        },
      ),
    );
  });
});
