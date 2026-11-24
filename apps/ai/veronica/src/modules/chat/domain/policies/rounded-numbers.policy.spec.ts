import * as fc from 'fast-check';

import { knownNumbers, unverifiedNumbers } from './numbers-guard.policy';

const rate = fc
  .double({ min: 0.0001, max: 0.9999, noNaN: true })
  .map((value) => Number(value.toFixed(11)));
const known = (value: number) => knownNumbers([`{"engagementRate":"${value}"}`]);
const commaDecimal = (text: string) => text.replace('.', ',');

describe('rounded rates in answers', () => {
  it('accepts a known rate rounded to one to three decimals', () => {
    fc.assert(
      fc.property(rate, fc.integer({ min: 1, max: 3 }), (value, places) => {
        const written = value.toFixed(places);
        fc.pre(Number(written) % 1 !== 0);
        expect(unverifiedNumbers(`Залученість ${written}.`, known(value))).toEqual([]);
        expect(unverifiedNumbers(`Залученість ${commaDecimal(written)}.`, known(value))).toEqual(
          [],
        );
      }),
    );
  });

  it('accepts a known rate as a percent with up to one decimal', () => {
    fc.assert(
      fc.property(rate, fc.integer({ min: 0, max: 1 }), (value, places) => {
        const percent = (value * 100).toFixed(places);
        expect(unverifiedNumbers(`Залученість ${commaDecimal(percent)} %.`, known(value))).toEqual(
          [],
        );
        expect(unverifiedNumbers(`Залученість ${percent}%.`, known(value))).toEqual([]);
        expect(
          unverifiedNumbers(`Залученість ${commaDecimal(percent)} відсотка.`, known(value)),
        ).toEqual([]);
      }),
    );
  });

  it('still cuts a number that is not a rounding of any known value', () => {
    fc.assert(
      fc.property(rate, fc.integer({ min: 1, max: 3 }), (value, places) => {
        const step = 10 ** -places;
        const wrong = (Number(value.toFixed(places)) + 2 * step).toFixed(places);
        const wrongPercent = (Number((value * 100).toFixed(1)) + 0.2).toFixed(1);
        fc.pre(!wrong.endsWith('0') && !wrongPercent.endsWith('0'));
        expect(unverifiedNumbers(`Залученість ${wrong}.`, known(value))).not.toEqual([]);
        expect(unverifiedNumbers(`Залученість ${wrongPercent} %.`, known(value))).not.toEqual([]);
      }),
    );
  });

  it('reads a percent only next to a percent sign', () => {
    const value = 0.50308641975;
    expect(unverifiedNumbers('Сесій було 50.', known(value))).toEqual(['50']);
    expect(unverifiedNumbers('Користувачів 7.', known(value))).toEqual(['7']);
    expect(unverifiedNumbers('Залученість 50,3 %.', known(value))).toEqual([]);
  });

  it('accepts any known number rounded to the written precision, whole numbers too', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 99_999, noNaN: true }).map((value) => Number(value.toFixed(3))),
        fc.integer({ min: 0, max: 2 }),
        (value, places) => {
          const written = value.toFixed(places);
          fc.pre(written !== String(value));
          expect(unverifiedNumbers(`Було ${written}.`, knownNumbers([`{"v":${value}}`]))).toEqual(
            [],
          );
        },
      ),
    );
  });

  it('accepts the rates from the live answers', () => {
    expect(unverifiedNumbers('Показник відмов 0.33.', known(0.33333333333))).toEqual([]);
    const sources = knownNumbers(['{"a":"0.50308641975","b":"0.73148148148"}']);
    expect(unverifiedNumbers('Залученість 0.503, а на мобільних 0.731.', sources)).toEqual([]);
    expect(unverifiedNumbers('Залученість 50,3 %, на мобільних 73,1 %.', sources)).toEqual([]);
  });
});
