import fc from 'fast-check';
import { getDictionary } from '@/shared/i18n';
import { formatMoney, formatRuntime } from './details-format';

const uk = getDictionary('uk').details;
const en = getDictionary('en').details;

describe('formatRuntime', () => {
  it.each([
    [166, '2 год 46 хв'],
    [120, '2 год'],
    [45, '45 хв'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatRuntime(minutes, uk)).toBe(expected);
  });

  it('never loses minutes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (minutes) => {
        const numbers = formatRuntime(minutes, en).match(/\d+/g)?.map(Number) ?? [];
        const total = numbers.length === 2 ? numbers[0]! * 60 + numbers[1]! : undefined;
        if (total !== undefined) expect(total).toBe(minutes);
      }),
    );
  });
});

describe('formatMoney', () => {
  it('shows millions and billions in words', () => {
    expect(formatMoney(250_000_000, 'uk', uk)).toBe('250 млн $');
    expect(formatMoney(1_796_113_523, 'uk', uk)).toBe('1,8 млрд $');
    expect(formatMoney(190_000_000, 'en', en)).toBe('$190M');
  });
});
