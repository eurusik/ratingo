import * as fc from 'fast-check';

import {
  extractNumbers,
  knownNumbers,
  redactUnverified,
  unverifiedNumbers,
} from './numbers-guard.policy';

const known = (...sources: string[]) => knownNumbers(sources);

describe('numbers guard', () => {
  it('accepts a number that appears in the sources', () => {
    expect(unverifiedNumbers('Невдалих: 7.', known('{"failed":7}'))).toEqual([]);
  });

  it('flags a number that appears nowhere', () => {
    expect(unverifiedNumbers('Невдалих: 8.', known('{"failed":7}'))).toEqual(['8']);
  });

  it.each([
    ['1 200', '{"requests":1200}'],
    ['1\u00a0200', '{"requests":1200}'],
    ['1,200', '{"requests":1200}'],
    ['0,17', '{"p95":0.17}'],
    ['0.170', '{"p95":0.17}'],
    ['1 234,5', '{"x":1234.5}'],
    ['1,234.5', '{"x":1234.5}'],
  ])('reads «%s» as the same number as in %s', (written, source) => {
    expect(unverifiedNumbers(`Значення ${written}.`, known(source))).toEqual([]);
  });

  it('reads the parts of a date and a time as separate numbers', () => {
    expect(extractNumbers('2026-11-22 14:30').map((c) => c[0])).toEqual([
      '2026',
      '11',
      '22',
      '14',
      '30',
    ]);
  });

  it('ignores list markers at the start of a line', () => {
    expect(unverifiedNumbers('1. Перше\n2) Друге', known(''))).toEqual([]);
  });

  it('does not treat digits inside identifiers as numbers', () => {
    expect(unverifiedNumbers('Було 95.', known('{"p95Ms":170}'))).toEqual(['95']);
    expect(extractNumbers('p95 і sync_2')).toEqual([]);
  });

  it('does not treat an HTTP status class such as 5xx as a number', () => {
    expect(
      unverifiedNumbers('Серверних помилок (5xx) було 3, клієнтських 4xx немає.', known('3')),
    ).toEqual([]);
    expect(unverifiedNumbers('Помилок 5хх.', known(''))).toEqual([]);
    expect(unverifiedNumbers('Помилок 5.', known(''))).toEqual(['5']);
  });

  it('does not accept a different number just because it shares digits', () => {
    expect(unverifiedNumbers('Було 17.', known('{"x":170}'))).toEqual(['17']);
  });

  it('cuts only the sentences with unverified numbers', () => {
    const result = redactUnverified(
      'Невдалих 7. Це на 40 відсотків більше. Решта гаразд.',
      known('7'),
    );
    expect(result.text).toBe('Невдалих 7. Решта гаразд.');
    expect(result.removedSentences).toBe(1);
  });

  it('returns an empty text when every sentence is unverified', () => {
    expect(redactUnverified('Було 40.', known('7')).text).toBe('');
  });

  describe('properties', () => {
    const integer = fc.integer({ min: 0, max: 5_000_000 });

    it('verifies every integer that the sources contain, written any common way', () => {
      fc.assert(
        fc.property(integer, fc.constantFrom('', ' ', '\u00a0', ','), (value, separator) => {
          const written =
            separator === ''
              ? String(value)
              : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
          expect(unverifiedNumbers(`Було ${written}.`, known(JSON.stringify({ value })))).toEqual(
            [],
          );
        }),
      );
    });

    it('flags every integer that the sources do not contain', () => {
      fc.assert(
        fc.property(integer, integer, (shown, written) => {
          fc.pre(shown !== written);
          expect(unverifiedNumbers(`Було ${written}.`, known(`{"v":${shown}}`))).toEqual([
            `${written}`,
          ]);
        }),
      );
    });

    it('verifies decimals the sources contain', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9999 }),
          fc.integer({ min: 1, max: 99 }),
          (whole, hundredths) => {
            const value = `${whole}.${String(hundredths).padStart(2, '0')}`;
            const asComma = value.replace('.', ',');
            expect(unverifiedNumbers(`Було ${asComma}.`, known(`{"v":${Number(value)}}`))).toEqual(
              [],
            );
          },
        ),
      );
    });

    it('leaves no unverified number after redaction', () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(fc.string({ maxLength: 12 }), integer), { minLength: 1, maxLength: 6 }),
          fc.array(integer, { maxLength: 4 }),
          (sentences, shown) => {
            const text = sentences.map(([word, value]) => `${word} ${value}.`).join(' ');
            const sources = known(JSON.stringify(shown));
            const redacted = redactUnverified(text, sources).text;
            expect(unverifiedNumbers(redacted, sources)).toEqual([]);
          },
        ),
      );
    });

    it('never rejects a text that has no digits', () => {
      fc.assert(
        fc.property(
          fc.string().filter((text) => !/\d/.test(text)),
          (text) => {
            expect(unverifiedNumbers(text, known(''))).toEqual([]);
          },
        ),
      );
    });
  });
});
